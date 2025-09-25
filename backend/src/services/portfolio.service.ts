import { de } from "zod/v4/locales";
import { alchemy } from "../utils/alchemy";
import {
  getEthUsd,
  getErc20Usd,
  // getErc20UsdViaDexScreener,
  getErc20NowAndH24ViaDexScreener,
  resolveContractsOnEthereum,
  getEthUsdAt,
  getErc20UsdAt,
} from "../utils/prices";

function fromHexQty(hex: string, decimals = 18): string {
  const bi = BigInt(hex);
  const base = BigInt(10) ** BigInt(decimals);
  const whole = bi / base;
  const frac = bi % base;
  const s = frac
    .toString()
    .padStart(decimals, "0")
    .slice(0, 8)
    .replace(/0+$/, "");
  return s ? `${whole}.${s}` : whole.toString();
}

export async function getHoldings(address: string) {
  const ethBal = await alchemy.core.getBalance(address).catch(() => null);
  if (!ethBal) {
    const err = new Error("Wallet not found");
    (err as any).code = "WalletNotFound";
    throw err;
  }
  const ethQty = fromHexQty((ethBal as any)._hex ?? (ethBal as any), 18);

  const tb = await alchemy.core.getTokenBalances(address);
  const nonZero = tb.tokenBalances.filter(
    (t) => t.tokenBalance && t.tokenBalance !== "0x0"
  );

  const tokens = await Promise.all(
    nonZero.map(async (t) => {
      const md = await alchemy.core
        .getTokenMetadata(t.contractAddress)
        .catch(() => null);
      const decimals = md?.decimals ?? 18;
      const symbol = md?.symbol ?? "UNKNOWN";
      const qty = fromHexQty(t.tokenBalance!, decimals);
      return { contract: t.contractAddress, symbol, decimals, qty };
    })
  );

  return {
    address,
    chain: process.env.ALCHEMY_NETWORK ?? "eth-sepolia",
    currency: "USD",
    asOf: new Date().toISOString(),
    holdings: [
      { contract: null as null, symbol: "ETH", decimals: 18, qty: ethQty },
      ...tokens,
    ],
  };
}

export async function getOverview(address: string) {
  // 1) Base holdings + current prices
  const base = await getHoldings(address);
  const ethUsd = await getEthUsd();

  const erc20 = base.holdings.filter((h) => h.contract && Number(h.qty) > 0);
  const contracts = Array.from(
    new Set(erc20.map((h) => String(h.contract).toLowerCase()))
  );
  const priceMap = await getErc20Usd(contracts);

  // DexScreener fallback for current prices
  const missingNow = contracts.filter((c) => !priceMap.has(c));
  if (missingNow.length) {
    const dsNow = await getErc20NowAndH24ViaDexScreener(
      missingNow.slice(0, 60)
    );
    for (const a of missingNow) {
      const row = dsNow.get(a);
      if (row?.price && row.price > 0) priceMap.set(a, row.price);
    }
  }

  // 2) Build 24h-ago price map (DefiLlama + DexScreener h24%)
  const ts24h = Math.floor(Date.now() / 1000) - 24 * 3600;
  const histEth = await getEthUsdAt(ts24h);
  const histMap = await getErc20UsdAt(contracts, ts24h);

  // Fill gaps with DexScreener h24%: now = prev * (1 + h24/100) => prev = now / (1+h24/100)
  const needDs = contracts.filter((a) => !histMap.has(a));
  if (needDs.length) {
    const dsNowH24 = await getErc20NowAndH24ViaDexScreener(needDs.slice(0, 60));
    for (const a of needDs) {
      const row = dsNowH24.get(a);
      if (!row) continue;
      if (!priceMap.has(a) && row.price > 0) priceMap.set(a, row.price);
      if (row.h24 != null && isFinite(row.h24) && row.h24 > -100) {
        const prev = row.price / (1 + row.h24 / 100);
        if (prev > 0 && isFinite(prev)) histMap.set(a, prev);
      }
    }
  }

  // 3) Holdings with per-token 24h fields
  const pricedHoldings = base.holdings.map((h) => {
    const addr = h.contract ? String(h.contract).toLowerCase() : null;
    const qty = Number(h.qty);
    const priceNow = addr ? priceMap.get(addr) ?? 0 : ethUsd;
    const price24h = addr ? histMap.get(addr) ?? 0 : histEth;

    const valueNow = qty * priceNow;
    const hasHist = qty > 0 && price24h > 0;
    const value24h = hasHist ? qty * price24h : null;
    const deltaUsd = hasHist ? valueNow - (value24h as number) : null;
    const deltaPct =
      hasHist && (value24h as number) > 0
        ? ((deltaUsd as number) / (value24h as number)) * 100
        : null;

    return {
      ...h,
      priceUsd: priceNow,
      priceUsd24h: hasHist ? price24h : null,
      valueUsd: valueNow,
      valueUsd24h: value24h,
      delta24hUsd: deltaUsd,
      delta24hPct: deltaPct,
    };
  });

  // 4) KPIs + allocation/top
  const totalValueUsd = pricedHoldings.reduce(
    (s, h) => s + (h.valueUsd || 0),
    0
  );
  const totalPrev = pricedHoldings.reduce(
    (s, h) =>
      s + (typeof h.valueUsd24h === "number" ? (h.valueUsd24h as number) : 0),
    0
  );
  const delta24hUsd = totalValueUsd - totalPrev;
  const delta24hPct = totalPrev ? (delta24hUsd / totalPrev) * 100 : 0;

  const allocation = pricedHoldings
    .filter((h) => (h.valueUsd || 0) > 0)
    .map((h) => ({
      symbol: h.symbol || "(unknown)",
      valueUsd: h.valueUsd || 0,
      weightPct: totalValueUsd ? ((h.valueUsd || 0) / totalValueUsd) * 100 : 0,
    }))
    .sort((a, b) => b.valueUsd - a.valueUsd);

  const topHoldings = allocation.slice(0, 10);

  return {
    address: base.address,
    asOf: new Date().toISOString(),
    currency: "USD",
    kpis: { totalValueUsd, delta24hUsd, delta24hPct },
    holdings: pricedHoldings,
    allocation,
    topHoldings,
  };
}

export async function getTokenForAddress(params: {
  address: string;
  contract?: string;
  symbol?: string;
}) {
  const address = params.address.trim();
  let contracts: string[] = [];

  if (params.contract) {
    const c = params.contract.trim().toLowerCase();
    if (!c.startsWith("0x") || c.length !== 42)
      throw Object.assign(new Error("Bad contract"), { code: "BadRequest" });
    contracts = [c];
  } else if (params.symbol) {
    contracts = await resolveContractsOnEthereum(params.symbol);
    if (!contracts.length)
      return {
        matches: [],
        note: "No ethereum tokens matched that symbol/name.",
      };
  } else {
    throw Object.assign(new Error("contract or symbol required"), {
      code: "BadRequest",
    });
  }

  // Ask Alchemy for just these contracts (fast)
  const res: any = await alchemy.core.getTokenBalances(address, contracts);
  const balances = (res?.tokenBalances ?? []).map((t: any) => ({
    contract: String(t.contractAddress).toLowerCase(),
    balHex: t.tokenBalance as string | null,
  }));

  // Enrich metadata + qty only for matches with a non-null balance (zero hex still possible)
  const enriched = await Promise.all(
    balances.map(async (b) => {
      const md = await alchemy.core
        .getTokenMetadata(b.contract)
        .catch(() => null);
      const decimals = md?.decimals ?? 18;
      const symbol = md?.symbol ?? "";
      const name = md?.name ?? "";
      const qty = b.balHex ? fromHexQty(b.balHex, decimals) : "0";
      return { contract: b.contract, symbol, name, decimals, qty };
    })
  );

  // Price (DefiLlama first, DexScreener fallback)
  const addrs = enriched.map((e) => e.contract);
  const priceMap = await getErc20Usd(addrs);
  const missing = addrs.filter((a) => !priceMap.has(a));
  if (missing.length) {
    const ds = await getErc20NowAndH24ViaDexScreener(missing.slice(0, 60));
    for (const [k, v] of ds) priceMap.set(k, v);
  }

  const items = enriched.map((e) => {
    const priceUsd = priceMap.get(e.contract) ?? 0;
    const valueUsd = Number(e.qty) * priceUsd;
    return { ...e, priceUsd, valueUsd };
  });

  // If user searched by symbol, return all matches; if by contract, return single
  return params.symbol ? { matches: items } : items[0];
}
