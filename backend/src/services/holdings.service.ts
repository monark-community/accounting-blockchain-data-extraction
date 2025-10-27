// src/services/holdings.service.ts
import fetch from "node-fetch";
import { EVM_NETWORKS, type EvmNetwork } from "../config/networks";
import { getPricesFor, NATIVE_SENTINEL } from "./pricing.service";
import { getDelta24hQtyByContract } from "./delta24h.service";

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
  withDelta24h = true
): Promise<OverviewResponse> {
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

  // 3) Optional 24h delta (qty change only — value uses current price)
  const deltaMaps = new Map<string, { deltaQty: number; prevQty: number }>(); // `${net}:${contract}`
  if (withDelta24h) {
    for (const net of networks) {
      const dm = await getDelta24hQtyByContract(net, address);
      dm.forEach((v, k) => deltaMaps.set(k, v));
    }
  }

  // 4) Assemble holdings
  const holdings: PricedHolding[] = rows.map((r) => {
    const qty = toFloat(r.balance, r.decimals);
    const key = `${r.network}:${(r.contract ?? NATIVE_SENTINEL).toLowerCase()}`;
    const priceUsd =
      (typeof r.price_usd === "number" ? r.price_usd : undefined) ??
      priceMap.get(key) ??
      0;

    const valueUsd = qty * priceUsd;

    let delta24hUsd: number | null = null;
    let delta24hPct: number | null = null;
    const d = deltaMaps.get(key);
    if (d) {
      delta24hUsd = d.deltaQty * priceUsd;
      const prevVal = d.prevQty * priceUsd;
      delta24hPct =
        prevVal > 0 ? (delta24hUsd / prevVal) * 100 : valueUsd > 0 ? 100 : 0;
    }

    return {
      chain: r.network,
      contract:
        r.contract.toLowerCase() === NATIVE_SENTINEL ? null : r.contract,
      symbol: r.symbol,
      decimals: r.decimals,
      qty: qty.toString(),
      priceUsd,
      valueUsd,
      delta24hUsd,
      delta24hPct,
    };
  });

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
