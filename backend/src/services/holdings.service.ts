// src/services/holdings.service.ts
import fetch from "node-fetch";
import { EVM_NETWORKS, type EvmNetwork } from "../config/networks";
import { getDelta24hQtyByContract } from "./delta24h.service";
import { SPAM_FILTER_MODE, scoreSpam, cleanSymbol } from "../config/filters";
import {
  getPricesFor,
  NATIVE_SENTINEL,
  getNativePriceUsd,
} from "./pricing.service";

const TOKEN_API_BASE =
  process.env.TOKEN_API_BASE_URL ?? "https://token-api.thegraph.com/v1";
const TOKEN_API_JWT = process.env.GRAPH_TOKEN_API_JWT!;

type RawBalance = {
  address: string;
  contract: string; // ERC20 or NATIVE_SENTINEL
  symbol: string;
  decimals: number;
  balance: string; // raw
  price_usd?: number; // may be present for native
  network: EvmNetwork;
};

type PricedHolding = {
  chain: EvmNetwork; // added for your frontend charts
  contract: string | null;
  symbol: string;
  decimals: number;
  qty: string; // human (string)
  priceUsd: number;
  valueUsd: number;
  delta24hUsd?: number | null;
  delta24hPct?: number | null;
};

type OverviewResponse = {
  address: string;
  asOf: string;
  currency: "USD";
  kpis: { totalValueUsd: number; delta24hUsd: number; delta24hPct: number };
  holdings: PricedHolding[];
  allocation: {
    symbol: string;
    valueUsd: number;
    weightPct: number;
    chain: EvmNetwork;
  }[];
  topHoldings: {
    symbol: string;
    valueUsd: number;
    weightPct: number;
    chain: EvmNetwork;
  }[];
};

async function tokenApiGET<T>(
  path: string,
  qs: Record<string, string | number | undefined>
) {
  const url = new URL(`${TOKEN_API_BASE}${path}`);
  Object.entries(qs).forEach(([k, v]) => {
    if (v !== undefined) url.searchParams.set(k, String(v));
  });
  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${TOKEN_API_JWT}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`TokenAPI ${path} ${res.status}: ${text}`);
    throw new Error(`TokenAPI ${path} ${res.status}`);
  }
  return res.json() as Promise<{ data: T }>;
}

async function getEvmTokenBalances(
  network: EvmNetwork,
  address: string
): Promise<RawBalance[]> {
  const { data } = await tokenApiGET<RawBalance[]>("/evm/balances", {
    network,
    address,
  });
  return data.map((r) => ({ ...r, network }));
}
async function getEvmNativeBalance(
  network: EvmNetwork,
  address: string
): Promise<RawBalance[]> {
  const { data } = await tokenApiGET<RawBalance[]>("/evm/balances/native", {
    network,
    address,
  });
  return data.map((r) => ({ ...r, network }));
}

function toFloat(balanceRaw: string, decimals: number): number {
  const d = BigInt(balanceRaw || "0");
  const scale = 10n ** BigInt(decimals);
  return Number(d) / Number(scale);
}

export async function getHoldingsOverview(
  address: string,
  networks: EvmNetwork[] = EVM_NETWORKS,
  withDelta24h = true,
  opts?: {
    minUsd?: number;
    includeZero?: boolean;
    spamFilter?: "off" | "soft" | "hard";
  }
): Promise<OverviewResponse> {
  const minUsd = Math.max(0, Number(opts?.minUsd ?? 0));
  const includeZero = !!opts?.includeZero;
  const spamFilterOn = opts?.spamFilter ?? true;

  // 1) Fetch balances per network
  const rows: RawBalance[] = [];
  for (const net of networks) {
    const [erc20, native] = await Promise.all([
      getEvmTokenBalances(net, address),
      getEvmNativeBalance(net, address),
    ]);
    rows.push(...erc20, ...native);
  }

  // 2) Build price map (Token API → fallbacks) for missing ERC-20s
  const byNet = new Map<EvmNetwork, RawBalance[]>();
  for (const r of rows) {
    if (!byNet.has(r.network)) byNet.set(r.network, []);
    byNet.get(r.network)!.push(r);
  }

  const priceMap = new Map<string, number>(); // `${net}:${contract}`
  for (const [net, list] of byNet) {
    const erc20s = list
      .filter((x) => x.contract.toLowerCase() !== NATIVE_SENTINEL)
      .map((x) => x.contract.toLowerCase());
    const unique = [...new Set(erc20s)];
    const m = await getPricesFor(net, unique, true);
    m.forEach((v, k) => priceMap.set(k, v));
  }

  // 2b) add native prices
  const nativePriceMap = new Map<EvmNetwork, number>();
  for (const net of networks) {
    const p = await getNativePriceUsd(net);
    if (p != null) nativePriceMap.set(net, p);
  }

  // 3) Optional 24h delta (qty change only — value uses current price)
  const deltaMaps = new Map<string, { deltaQty: number; prevQty: number }>(); // `${net}:${contract}`
  if (withDelta24h) {
    for (const net of networks) {
      const dm = await getDelta24hQtyByContract(net, address);
      dm.forEach((v, k) => deltaMaps.set(k, v));
    }
  }

  // 4) assemble holdings with filtering
  const spamMode = opts?.spamFilter ?? SPAM_FILTER_MODE;
  const holdings: (PricedHolding & {
    isSpam?: boolean;
    spamReasons?: string[];
  })[] = rows
    .map((r) => {
      const qty = toFloat(r.amount, r.decimals);
      const isNative =
        (r.contract?.toLowerCase?.() ?? NATIVE_SENTINEL) === NATIVE_SENTINEL;
      const key = `${r.network}:${(
        r.contract ?? NATIVE_SENTINEL
      ).toLowerCase()}`;

      const displaySymbol = cleanSymbol(r.symbol);

      let priceUsd =
        (typeof r.price_usd === "number" ? r.price_usd : undefined) ??
        (isNative
          ? nativePriceMap.get(r.network) ?? 0
          : priceMap.get(key) ?? 0);

      const valueUsd = qty * (priceUsd || 0);

      let delta24hUsd: number | null = null;
      let delta24hPct: number | null = null;
      const d = deltaMaps.get(key);
      if (d) {
        delta24hUsd = d.deltaQty * (priceUsd || 0);
        const prevVal = d.prevQty * (priceUsd || 0);
        delta24hPct =
          prevVal > 0 ? (delta24hUsd / prevVal) * 100 : valueUsd > 0 ? 100 : 0;
      }

      const spamEval = scoreSpam(displaySymbol);

      const row: PricedHolding & { isSpam?: boolean; spamReasons?: string[] } =
        {
          chain: r.network,
          contract: isNative ? null : r.contract,
          symbol: displaySymbol ?? "(unknown)",
          decimals: r.decimals,
          qty: qty.toString(),
          priceUsd: priceUsd || 0,
          valueUsd,
          delta24hUsd,
          delta24hPct,
        };

      if (spamMode !== "off" && spamEval.score >= 2) {
        row.isSpam = true;
        row.spamReasons = spamEval.reasons;
      }
      return row;
    })
    // basic numeric gating first
    .filter((h) => (opts?.includeZero ? true : h.qty !== "0"))
    .filter((h) => (opts?.includeZero ? true : h.valueUsd > 0))
    .filter((h) =>
      opts?.minUsd ? h.valueUsd >= Math.max(0, opts!.minUsd!) : true
    )
    // drop only if "hard"
    .filter((h) => (spamMode === "hard" ? !h.isSpam : true));

  // 5) KPIs & allocation
  const totalValueUsd = holdings.reduce((s, h) => s + h.valueUsd, 0);
  const deltaAggUsd = holdings.reduce((s, h) => s + (h.delta24hUsd ?? 0), 0);
  const deltaAggPct =
    totalValueUsd > 0 ? (deltaAggUsd / (totalValueUsd - deltaAggUsd)) * 100 : 0;

  const allocation = holdings
    .map((h) => ({ symbol: h.symbol, valueUsd: h.valueUsd, chain: h.chain }))
    .filter((x) => x.valueUsd > 0)
    .sort((a, b) => b.valueUsd - a.valueUsd)
    .map((x) => ({
      ...x,
      weightPct: totalValueUsd ? (100 * x.valueUsd) / totalValueUsd : 0,
    }));

  const topHoldings = allocation.slice(0, 5);

  return {
    address,
    asOf: new Date().toISOString(),
    currency: "USD",
    kpis: { totalValueUsd, delta24hUsd: deltaAggUsd, delta24hPct: deltaAggPct },
    holdings,
    allocation,
    topHoldings,
  };
}
