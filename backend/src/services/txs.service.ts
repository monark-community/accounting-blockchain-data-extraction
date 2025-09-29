import { alchemy } from "../utils/alchemy";
import { getEthUsdAt, getErc20UsdAt } from "../utils/prices";

type TxRow = {
  ts: string;
  hash: string;
  network: "eth-mainnet";
  wallet: string;
  direction: "in" | "out";
  type: "income" | "expense" | "swap" | "gas";
  asset: {
    symbol: string | null;
    contract: string | null;
    decimals: number | null;
  };
  qty: string; // raw decimal string from Alchemy
  usdAtTs: number | null; // fill later
  priceUsdAtTs: number | null; // fill later
  counterparty: { address: string | null; label: string | null };
  fee: { eth: string | null; usd: number | null } | null; // fill later
  isApprox: boolean; // for pricing later
};

function normAddr(a?: string | null) {
  return a ? a.toLowerCase() : null;
}

const kindToCategories = (kind?: string) => {
  switch ((kind || "all").toLowerCase()) {
    case "transactions":
      return ["external", "internal"] as const; // ETH only (normal + internal)
    case "tokens":
      return ["erc20"] as const; // ERC-20 only
    default:
      return ["external", "internal", "erc20"] as const; // everything (default)
  }
};

async function pullTransfers(
  direction: "in" | "out",
  address: string,
  categories: readonly ("external" | "internal" | "erc20")[],
  target: number
) {
  const paramsBase =
    direction === "out" ? { fromAddress: address } : { toAddress: address };

  let pageKey: string | undefined;
  const acc: any[] = [];
  const MAX_PAGES = 6; // safety cap

  for (let i = 0; i < MAX_PAGES; i++) {
    const res = await alchemy.core.getAssetTransfers({
      ...paramsBase,
      category: categories as any,
      withMetadata: true,
      order: "desc",
      maxCount: 100n,
      pageKey,
    });
    acc.push(...(res.transfers || []));
    if (!res.pageKey || acc.length >= target) break;
    pageKey = res.pageKey;
  }
  return acc;
}

async function enrichUsdAtTs(rows: TxRow[]) {
  // group rows by unix-second to batch price lookups
  const groups = new Map<
    number,
    { eth: TxRow[]; erc20ByAddr: Map<string, TxRow[]> }
  >();

  for (const r of rows) {
    const tsSec = Math.floor(new Date(r.ts).getTime() / 1000);
    let g = groups.get(tsSec);
    if (!g) {
      g = { eth: [], erc20ByAddr: new Map() };
      groups.set(tsSec, g);
    }
    const isEth = !r.asset.contract;
    if (isEth) {
      g.eth.push(r);
    } else {
      const addr = String(r.asset.contract).toLowerCase();
      const arr = g.erc20ByAddr.get(addr) ?? [];
      arr.push(r);
      g.erc20ByAddr.set(addr, arr);
    }
  }

  for (const [tsSec, g] of groups) {
    // ETH rows
    if (g.eth.length) {
      const p = await getEthUsdAt(tsSec);
      for (const r of g.eth) {
        const qty = Number(r.qty) || 0;
        r.priceUsdAtTs = p;
        r.usdAtTs = p > 0 ? qty * p : null;
      }
    }
    // ERC-20 rows (batch by timestamp)
    if (g.erc20ByAddr.size) {
      const addrs = Array.from(g.erc20ByAddr.keys());
      const priceMap = await getErc20UsdAt(addrs, tsSec); // Map<addrLower, price>
      for (const addr of addrs) {
        const price = priceMap.get(addr) ?? 0;
        for (const r of g.erc20ByAddr.get(addr)!) {
          const qty = Number(r.qty) || 0;
          r.priceUsdAtTs = price || null;
          r.usdAtTs = price > 0 ? qty * price : null;
        }
      }
    }
  }

  return rows;
}

// BigInt → ETH string (no precision loss)
function weiToEthString(wei: bigint) {
  const base = 10n ** 18n;
  const i = wei / base;
  const f = (wei % base).toString().padStart(18, "0").replace(/0+$/, "");
  return f.length ? `${i.toString()}.${f}` : i.toString();
}

// Fetch receipts for outbound hashes and create synthetic gas rows
async function addGasRows(
  items: TxRow[],
  walletLower: string
): Promise<TxRow[]> {
  // only for outbound txs we returned
  const byHash = new Map<string, TxRow>();
  for (const r of items) if (r.direction === "out") byHash.set(r.hash, r);

  if (!byHash.size) return items;

  // fetch receipts in parallel (light cap)
  const hashes = Array.from(byHash.keys());
  const batches = [];
  const cap = 5;
  for (let i = 0; i < hashes.length; i += cap) {
    const slice = hashes.slice(i, i + cap);
    batches.push(
      Promise.all(
        slice.map(async (h) => {
          try {
            const rcpt = await alchemy.core.getTransactionReceipt(h);
            if (!rcpt) return null;
            // prefer effectiveGasPrice; fall back to tx.gasPrice if needed
            let gasPrice = rcpt.effectiveGasPrice
              ? BigInt(rcpt.effectiveGasPrice)
              : undefined;
            if (!gasPrice) {
              const tx = await alchemy.core.getTransaction(h);
              gasPrice = tx?.gasPrice ? BigInt(tx.gasPrice) : 0n;
            }
            const gasUsed = rcpt.gasUsed ? BigInt(rcpt.gasUsed) : 0n;
            const wei = gasPrice * gasUsed;
            return { h, wei };
          } catch {
            return null;
          }
        })
      )
    );
  }

  const gasRows: TxRow[] = [];
  for (const batch of await Promise.all(batches)) {
    for (const entry of batch) {
      if (!entry) continue;
      const baseRow = byHash.get(entry.h)!; // exists by construction
      if (!baseRow) continue;
      const qtyEth = weiToEthString(entry.wei);
      // build synthetic gas row at the same timestamp
      gasRows.push({
        ts: baseRow.ts,
        hash: entry.h,
        network: baseRow.network,
        wallet: walletLower,
        direction: "out",
        type: "gas",
        asset: { symbol: "ETH", contract: null, decimals: 18 },
        qty: qtyEth,
        usdAtTs: null,
        priceUsdAtTs: null,
        counterparty: baseRow.counterparty,
        fee: null,
        isApprox: false,
      });
    }
  }

  const merged = [...items, ...gasRows];
  // newest first
  merged.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
  // keep exactly 20 (gas rows count toward the page size)
  return merged.slice(0, 20);
}

export async function getLast20Transfers(
  address: string,
  type?: "income" | "expense" | "swap",
  kind?: "all" | "transactions" | "tokens"
) {
  const acct = address.toLowerCase();
  const categories = kindToCategories(kind);

  // Pull *both* directions with paging; over-fetch to ensure we can slice 20 after merging
  const NEED = 80; // fetch enough to classify swaps then slice to 20
  const [outRaw, inRaw] = await Promise.all([
    pullTransfers("out", acct, categories, NEED),
    pullTransfers("in", acct, categories, NEED),
  ]);

  const rows: TxRow[] = [];
  const pushRows = (items: any[], direction: "in" | "out") => {
    for (const t of items ?? []) {
      const isEthExternal =
        t.category === "external" || t.category === "internal";
      const sym = isEthExternal ? "ETH" : t.asset ?? null;
      const contract = isEthExternal ? null : normAddr(t.rawContract?.address);
      const qty = String(t.value ?? "0");
      const ts = new Date(
        t.metadata?.blockTimestamp ?? Date.now()
      ).toISOString();
      const hash = t.hash ?? t.uniqueId ?? "";
      const counterparty =
        direction === "in" ? normAddr(t.from) : normAddr(t.to);

      rows.push({
        ts,
        hash,
        network: "eth-mainnet",
        wallet: acct,
        direction,
        type: direction === "in" ? "income" : "expense", // temp; swap-marking below
        asset: { symbol: sym, contract, decimals: isEthExternal ? 18 : null },
        qty,
        usdAtTs: null,
        priceUsdAtTs: null,
        counterparty: { address: counterparty, label: null },
        fee: null,
        isApprox: false,
      });
    }
  };

  pushRows(outRaw, "out");
  pushRows(inRaw, "in");

  // Mark swaps: any hash with both in & out → set both legs to "swap"
  const byHash = new Map<string, { hasIn: boolean; hasOut: boolean }>();
  for (const r of rows) {
    const e = byHash.get(r.hash) ?? { hasIn: false, hasOut: false };
    if (r.direction === "in") e.hasIn = true;
    else e.hasOut = true;
    byHash.set(r.hash, e);
  }
  for (const r of rows) {
    const e = byHash.get(r.hash);
    if (e && e.hasIn && e.hasOut) r.type = "swap";
  }

  // Sort newest-first, then slice *exactly* 20 (after optional type filter)
  rows.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
  let items = rows;
  if (type) items = items.filter((r) => r.type === type);
  items = items.slice(0, 20);

  items = await addGasRows(items, acct);

  try {
    await enrichUsdAtTs(items);
  } catch (e) {
    console.error("enrichUsdAtTs failed:", e);
  }

  return { items, nextCursor: null, hasMore: items.length === 20 };
}
