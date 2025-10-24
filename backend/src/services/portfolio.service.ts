import {
  tokenApiGet,
  networkForChainId,
  normalizeChainId,
  fetchErc20Balances,
  fetchNativeBalance,
  TokenApiRow,
} from "../utils/tokenApi";

import { toHumanQty } from "../utils/pricesBasic";

import { fetchPricesUsd } from "../utils/priceApi";

/** ===== Public output shape expected by your frontend ===== */
export type HoldingRow = {
  contract: string | null; // null for native
  symbol: string;
  decimals: number;
  qty: string; // human units string
};

export type HoldingsResponse = {
  address: string;
  chain: string; // e.g., "eth-mainnet", "bsc-mainnet", "polygon-mainnet"
  chainId: number; // e.g., 1, 56, 137...
  currency: "USD";
  asOf: string; // ISO
  holdings: HoldingRow[];
  pagination: {
    page: number;
    nextPage: number | null;
    totalPages: number;
  };
};

/** Derive a chain label for the UI */
function chainLabelForNetwork(network: string): string {
  // Keep simple “<short>-mainnet” naming for now
  switch (network) {
    case "mainnet":
      return "eth-mainnet";
    case "bsc":
      return "bnb-mainnet";
    case "polygon":
      return "polygon-mainnet";
    case "optimism":
      return "optimism-mainnet";
    case "arbitrum-one":
      return "arbitrum-one";
    case "base":
      return "base-mainnet";
    case "avalanche":
      return "avalanche-mainnet";
    default:
      return `${network}`;
  }
}

/** Normalize one TokenAPI row to your HoldingRow */
function toHoldingRow(row: TokenApiRow, isNative = false): HoldingRow {
  const decimals = Number.isFinite(row.decimals)
    ? Number(row.decimals)
    : isNative
    ? 18
    : 18;
  // Prefer amount (string human units); if missing, fallback to value or "0"
  const qty =
    typeof row.amount === "string" && row.amount.length > 0
      ? row.amount
      : typeof row.value === "number"
      ? String(row.value)
      : "0";

  return {
    contract: isNative ? null : String(row.address || "").toLowerCase(),
    symbol: row.symbol || (isNative ? "ETH" : ""),
    decimals,
    qty,
  };
}

/** ===== What /overview returns to the frontend ===== */
export type OverviewHoldingRow = {
  contract: string | null; // null for native
  symbol: string;
  decimals: number;
  qty: string; // human units (string)
  priceUsd: number; // current price
  valueUsd: number; // qty * priceUsd
  priceUsd24h: number | null;
  valueUsd24h: number | null;
  delta24hUsd: number | null; // valueUsd - valueUsd24h
  delta24hPct: number | null; // 100 * delta24hUsd / valueUsd24h
};

export type AllocationRow = {
  symbol: string;
  valueUsd: number;
  weightPct: number;
};

export type OverviewResponse = {
  address: string;
  asOf: string; // ISO
  currency: "USD";
  kpis: {
    totalValueUsd: number;
    delta24hUsd: number;
    delta24hPct: number;
  };
  holdings: OverviewHoldingRow[];
  allocation: AllocationRow[];
  topHoldings: AllocationRow[];
};

/** Small helper to turn a TokenAPI row into our base holding (before pricing) */
function toBaseHolding(row: TokenApiRow, isNative = false) {
  const decimals = Number.isFinite(row.decimals) ? Number(row.decimals) : 18;

  return {
    contract: isNative ? null : String(row.address || "").toLowerCase(),
    symbol: row.symbol || (isNative ? "ETH" : ""),
    decimals,
    qty: toHumanQty(row),
  };
}

/** Build allocation/topHoldings from priced holdings */
function buildAllocation(holdings: OverviewHoldingRow[]): {
  allocation: AllocationRow[];
  topHoldings: AllocationRow[];
} {
  const total = holdings.reduce((s, h) => s + (h.valueUsd || 0), 0);
  const allocation = holdings
    .filter((h) => (h.valueUsd || 0) > 0)
    .map<AllocationRow>((h) => ({
      symbol: h.symbol || "(unknown)",
      valueUsd: h.valueUsd || 0,
      weightPct: total ? ((h.valueUsd || 0) / total) * 100 : 0,
    }))
    .sort((a, b) => b.valueUsd - a.valueUsd);
  return { allocation, topHoldings: allocation.slice(0, 10) };
}

/** Main: Get holdings (EVM) */
export async function getHoldings(
  address: string,
  opts?: { chain?: string | number; page?: number; limit?: number }
): Promise<HoldingsResponse> {
  const addr = String(address).trim().toLowerCase();
  const chainIdNum = normalizeChainId(opts?.chain ?? 1);
  const network = networkForChainId(chainIdNum);
  const page = Math.max(1, opts?.page ?? 1);
  const limit = Math.min(Math.max(1, opts?.limit ?? 20), 1000); // safety cap
  const pageFetchSize = Math.max(limit * page, 200); // one-shot fetch, slice locally

  // Pull both ERC20 and native
  const [erc20, native] = await Promise.all([
    fetchErc20Balances(addr, network),
    fetchNativeBalance(addr, network),
  ]);

  // Normalize to HoldingRow[]
  const rows: HoldingRow[] = [
    ...(native ? [toHoldingRow(native, true)] : []),
    ...erc20.map((r) => toHoldingRow(r, false)),
  ];

  // Timestamp: prefer native’s “as of” inferred from server time
  const asOf = new Date().toISOString();

  // Local pagination
  const start = (page - 1) * limit;
  const end = start + limit;
  const total = rows.length;

  // Helpful debug logs while you wire the UI
  // console.log(
  //   `[holdings] ${addr} on ${network} — total rows: ${total} (native:${!!native})`
  // );

  // console.log(
  //   `[getHoldings] network=${network} native=${!!native} erc20=${erc20.length}`
  // );

  // console.log("[getHoldings] sample:", rows.slice(0, 3));

  return {
    address: addr,
    chain: chainLabelForNetwork(network),
    chainId: chainIdNum,
    currency: "USD",
    asOf,
    holdings: rows.slice(start, end),
    pagination: {
      page,
      nextPage: end < total ? page + 1 : null,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

/** ===== Main: Overview (EVM) =====
 * Respects: minUsd (filter after pricing), chainId (hex or number)
 */
export async function getOverview(
  address: string,
  chainIdInput: string | number = 1,
  minUsd: number = 0
): Promise<OverviewResponse> {
  const addr = String(address).trim().toLowerCase();
  const chainId = normalizeChainId(chainIdInput);
  const network = networkForChainId(chainId);

  // 1) Fetch balances (native + ERC-20)
  const [erc20, native] = await Promise.all([
    fetchErc20Balances(addr, network),
    fetchNativeBalance(addr, network),
  ]);

  // console.log(`[getOverview] addr=${addr} network=${network}`);
  // console.log("[getOverview] erc20 count:", erc20?.length || 0);
  // console.log("[getOverview] native row:", native);

  // 2) Normalize into base holdings (no pricing yet)
  const base = [
    ...(native ? [toBaseHolding(native, true)] : []),
    ...erc20.map((r) => toBaseHolding(r, false)),
  ];

  // 3) Fetch prices and attach
  const priceMap = await fetchPricesUsd(chainId, base);

  console.log("[overview] priceMap size:", Object.keys(priceMap).length);
  console.log("[overview] check native key:", `native:${network}`);

  const holdings: OverviewHoldingRow[] = base.map((h) => {
    const key = h.contract ? h.contract : `native:${network}`;
    const quote = priceMap[key.toLowerCase?.() ?? key] ?? {
      priceUsd: 0,
      priceUsd24h: null,
    };
    const qtyNum = parseFloat(h.qty || "0");
    const priceNow = Number.isFinite(quote.priceUsd) ? quote.priceUsd : 0;
    const valueNow = qtyNum * priceNow;
    const price24h = quote.priceUsd24h;
    const value24h = price24h != null ? qtyNum * price24h : null;
    const deltaUsd = value24h != null ? valueNow - value24h : null;
    const deltaPct =
      value24h && value24h !== 0 ? (deltaUsd! / value24h) * 100 : null;

    return {
      ...h,
      priceUsd: priceNow,
      valueUsd: valueNow,
      priceUsd24h: price24h,
      valueUsd24h: value24h,
      delta24hUsd: deltaUsd,
      delta24hPct: deltaPct,
    };
  });

  // console.log("[getOverview] first 3 holdings:", holdings.slice(0, 3));

  // 4) Apply minUsd filter (keep rows with valueUsd >= minUsd)
  const filtered =
    minUsd && minUsd > 0
      ? holdings.filter((h) => (h.valueUsd || 0) >= minUsd)
      : holdings;

  // 5) KPIs and allocation
  const totalValueUsd = filtered.reduce((s, h) => s + (h.valueUsd || 0), 0);
  // For now, portfolio 24h deltas are 0 unless you wire real prices (then sum from holdings)
  const portfolioDeltaUsd = filtered.reduce(
    (s, h) => s + (h.delta24hUsd || 0),
    0
  );
  const portfolioValue24h = filtered.reduce(
    (s, h) => s + (h.valueUsd24h || 0),
    0
  );
  const portfolioDeltaPct = portfolioValue24h
    ? (portfolioDeltaUsd / portfolioValue24h) * 100
    : 0;

  const { allocation, topHoldings } = buildAllocation(filtered);

  // 6) Sort holdings descending by value (nicer UX)
  filtered.sort((a, b) => (b.valueUsd || 0) - (a.valueUsd || 0));

  // 7) Return in the exact shape your frontend expects
  return {
    address: addr,
    asOf: new Date().toISOString(),
    currency: "USD",
    kpis: {
      totalValueUsd,
      delta24hUsd: portfolioDeltaUsd,
      delta24hPct: portfolioDeltaPct,
    },
    holdings: filtered,
    allocation,
    topHoldings,
  };
}
