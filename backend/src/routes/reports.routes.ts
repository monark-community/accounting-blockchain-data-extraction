// backend/src/routes/reports.routes.ts

import { Router } from "express";
import { listTransactionLegs } from "../services/transactions.service";
import { getHoldingsOverview } from "../services/holdings.service";
import { applyLegFilters } from "../utils/tx.filters";

const router = Router();

/**
 * GET /api/reports/financial
 * Query:
 *  - address: wallet address (0x...)
 *  - networks, from, to: optional filters
 *
 * Returns a CSV tailored for QuickBooks import with Debit/Credit columns and rich context.
 */
router.get("/financial", async (req, res) => {
  try {
    const rawAddr = String(req.query.address ?? "").trim();
    const ok = /^0x[0-9a-f]{40}$/i.test(rawAddr);
    if (!ok) return res.status(400).json({ error: "Invalid address" });
    const address = rawAddr.toLowerCase() as `0x${string}`;

    // 0) Load holdings overview to build a statement-style summary
    const ov = await getHoldingsOverview(address);
    const format = String(req.query.format || "statement").toLowerCase(); // statement | bank | journal

    const legsRaw = await listTransactionLegs({
      address,
      networks: req.query.networks as string | string[] | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      // Pull a large page for reporting; capped by service env safeguards
      page: 1,
      limit: Number(process.env.REPORT_MAX_ROWS ?? 1000),
    });

    const gasMeta = (legsRaw as any)._gasUsdByTx as Record<string, number> | undefined;
    if (gasMeta) delete (legsRaw as any)._gasUsdByTx;

    // Basic spam/dust filtering for reports (defaults align with transactions route)
    const minUsd = req.query.minUsd ? Number(req.query.minUsd) : 0;
    const spamFilter =
      (req.query.spamFilter as "off" | "soft" | "hard") ??
      process.env.SPAM_FILTER_MODE ??
      "soft";
    const legs = applyLegFilters(legsRaw, { minUsd, spamFilter });

    // Keep only accounting-relevant legs (income/expense and NFT buy/sell treated accordingly)
    const relevant = legs.filter((l) => {
      const c = l.class;
      return (
        c === "income" ||
        c === "expense" ||
        c === "nft_buy" ||
        c === "nft_sell" ||
        c === "transfer_in" ||
        c === "transfer_out"
      );
    });

    // CSV helpers
    const escape = (v: any) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    // QuickBooks-friendly columns + richer context (only fields we can derive now)
    const headers = [
      "Date",            // YYYY-MM-DD
      "Description",     // human readable
      "Debit",           // expenses
      "Credit",          // income
      "Amount",          // signed amount in USD (income > 0, expense < 0)
      "Payee",           // counterparty address
      "Reference",       // network:txHash
      "Account",         // e.g., <SYMBOL> Wallet
      "Network",         // chain
      "TxHash",          // hash
      "CryptoAmount",    // human units
      "CryptoSymbol",    // symbol
      "USDAtTx",         // usd valuation at timestamp
      "FeeUsd",          // gas usd by tx
      "From",
      "To",
      "Class"           // normalized class
    ];

    const lines: string[] = [];

    // ===== Statement-style summary (Assets/Liabilities) =====
    const totalValue = ov.kpis?.totalValueUsd ?? 0;
    const deltaUsd = ov.kpis?.delta24hUsd ?? 0;
    const deltaPct = ov.kpis?.delta24hPct ?? 0;

    // naive stablecoin detection by symbol
    const STABLES = new Set(["USDC", "USDT", "DAI", "TUSD", "USDP", "GUSD", "FDUSD", "FRAX", "LUSD"]);
    let stableTotal = 0;
    let volatileTotal = 0;
    const byChain = new Map<string, number>();
    for (const h of ov.holdings ?? []) {
      const v = h.valueUsd || 0;
      if (STABLES.has((h.symbol || "").toUpperCase())) stableTotal += v;
      else volatileTotal += v;
      byChain.set(h.chain, (byChain.get(h.chain) || 0) + v);
    }

    if (format === "statement") {
      lines.push("Personal Financial Statement");
      lines.push(`Prepared For,${ov.address}`);
      lines.push(`Date,${new Date().toISOString().slice(0,10)}`);
      lines.push("");
      lines.push("ASSETS");
      lines.push(`Crypto Holdings (Total),${totalValue.toFixed(2)}`);
      lines.push(`Stablecoins (Total),${stableTotal.toFixed(2)}`);
      lines.push(`Volatile Assets (Total),${volatileTotal.toFixed(2)}`);
      lines.push(`24h Change (USD),${deltaUsd.toFixed(2)}`);
      lines.push(`24h Change (%),${deltaPct.toFixed(2)}`);
      for (const [chain, v] of byChain) {
        lines.push(`By Chain - ${chain},${v.toFixed(2)}`);
      }
      // Top holdings (up to 5)
      const top = [...(ov.holdings || [])]
        .sort((a, b) => (b.valueUsd || 0) - (a.valueUsd || 0))
        .slice(0, 5);
      if (top.length) {
        lines.push("");
        lines.push("TOP HOLDINGS");
        for (const t of top) {
          const sym = t.symbol || "Asset";
          const val = (t.valueUsd || 0).toFixed(2);
          lines.push(`${sym},${val}`);
        }
      }
      // Allocation by symbol (top 10)
      const bySymbol = new Map<string, number>();
      for (const h of ov.holdings || []) {
        const key = (h.symbol || "Asset").toUpperCase();
        bySymbol.set(key, (bySymbol.get(key) || 0) + (h.valueUsd || 0));
      }
      const alloc = [...bySymbol.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      if (alloc.length) {
        lines.push("");
        lines.push("ALLOCATION BY SYMBOL");
        for (const [sym, val] of alloc) {
          const pct = totalValue > 0 ? (100 * val / totalValue) : 0;
          lines.push(`${sym},${val.toFixed(2)} (${pct.toFixed(2)}%)`);
        }
      }
      lines.push("");
      lines.push("Total Assets," + totalValue.toFixed(2));
      lines.push("");
      lines.push("LIABILITIES");
      lines.push("Total Liabilities,0.00");
      lines.push("");
      lines.push("NET WORTH," + totalValue.toFixed(2));
      lines.push("");
    }

    // ===== Detailed transaction lines (QuickBooks-friendly) =====
    lines.push(headers.join(","));

    for (const l of relevant) {
      const date = new Date((l.timestamp || 0) * 1000).toISOString().slice(0, 10); // YYYY-MM-DD
      const symbol = l.asset?.symbol ?? (l.asset?.contract ? "Token" : "Native");
      const qty = l.amount ?? 0;
      const usd = l.amountUsdAtTx ?? 0;
      const isIncome = l.class === "income" || l.class === "transfer_in" || l.class === "nft_sell";
      const isExpense = l.class === "expense" || l.class === "transfer_out" || l.class === "nft_buy";
      const debit = isExpense ? Math.abs(usd).toFixed(2) : "";
      const credit = isIncome ? Math.abs(usd).toFixed(2) : "";
      const signedAmount = (isIncome ? 1 : isExpense ? -1 : 0) * Math.abs(usd);
      const feeUsd = gasMeta?.[l.txHash] != null ? Number(gasMeta[l.txHash]).toFixed(2) : "";
      const counterparty = l.to?.toLowerCase() === address ? l.from : l.to;
      const description = `${isIncome ? "Income" : isExpense ? "Expense" : "Transfer"} ${symbol} ${qty}`;
      const payee = l.class === "income" ? (l.from ?? "") : l.class === "expense" ? (l.to ?? "") : (counterparty ?? "");
      const reference = `${l.network}:${l.txHash}`;
      const account = symbol ? `${symbol} Wallet` : "Crypto Wallet";
      const network = l.network;
      const txHash = l.txHash;
      const memo = `Dir:${l.direction} Class:${l.class || ''} Net:${network} FeeUsd:${feeUsd || '0'}`;

      let row: string[];
      if (format === "bank") {
        // Minimal bank-style import: Date, Description, Amount, Payee, Reference, Memo
        row = [
          date,
          description,
          signedAmount ? signedAmount.toFixed(2) : "",
          payee,
          reference,
          memo,
        ].map(escape);
      } else if (format === "journal") {
        // Journal-style: Date, Account, Debit, Credit, Memo, Class, Name(Payee)
        row = [
          date,
          account,
          debit,
          credit,
          memo,
          l.class ?? "",
          payee,
        ].map(escape);
      } else {
        // statement/default: full enriched set
        row = [
          date,
          description,
          debit,
          credit,
          signedAmount ? signedAmount.toFixed(2) : "",
          payee,
          reference,
          account,
          network,
          txHash,
          qty || "",
          symbol || "",
          usd ? usd.toFixed(2) : "",
          feeUsd,
          l.from ?? "",
          l.to ?? "",
          l.class ?? "",
        ].map(escape);
      }

      lines.push(row.join(","));
    }

    const filename = `financial_report_${address.slice(0, 6)}_${Date.now()}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    // UTF-8 BOM for Excel compatibility
    res.send(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(lines.join("\n"))]));
  } catch (err: any) {
    res.status(500).json({ error: "Report generation failed", detail: err?.message ?? String(err) });
  }
});

export default router;


