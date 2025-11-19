// backend/src/services/holdings.service.ts

import fetch from "node-fetch";
import { EVM_NETWORKS, type EvmNetwork } from "../config/networks";
import { getDelta24hValueByContract, getPrevQtyMap } from "./delta24h.service";
import { SPAM_FILTER_MODE, scoreSpam, cleanSymbol } from "../config/filters";
import {
  getPricesFor,
  getPricesForWithSource,
  NATIVE_SENTINEL,
  getNativePriceUsd,
  normalizeContractKey,
  getPricesAtTimestamp,
  getPricingWarnings,
} from "./pricing.service";
import {
  markTokenApiRateLimited,
  getTokenApiWarnings,
} from "./tokenApiStatus";

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
  priceSource: "native" | "map" | "tokenapi" | "unknown";
};

type PricingWarnings = {
  defiLlamaRateLimited?: boolean;
  defiLlamaRetryAfterMs?: number;
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
  warnings?: PricingWarnings;
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
    if (res.status === 429) {
      markTokenApiRateLimited();
    }
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

  const contractsByNet = new Map<EvmNetwork, string[]>();
  for (const [net, list] of byNet) {
    const erc20s = list
      .map((x) => x.contract.toLowerCase())
      .filter((c) => c !== NATIVE_SENTINEL);
    contractsByNet.set(net, Array.from(new Set(erc20s)));
  }

  const priceMap = new Map<string, number>(); // `${net}:${contract}`
  const priceSrc = new Map<string, string>(); // `${net}:${contract}` -> 'defillama' | 'dexscreener'
  for (const [net, list] of byNet) {
    const erc20s = list
      .filter((x) => x.contract.toLowerCase() !== NATIVE_SENTINEL)
      .map((x) => x.contract.toLowerCase());
    const unique = [...new Set(erc20s)];
    const { prices, sources } = await getPricesForWithSource(net, unique);
    prices.forEach((v, k) => priceMap.set(k, v));
    sources.forEach((src, k) => priceSrc.set(k, src));
  }

  // 2b) add native prices
  const nativePriceMap = new Map<EvmNetwork, number>();
  for (const net of networks) {
    const p = await getNativePriceUsd(net);
    if (p != null) nativePriceMap.set(net, p);
  }

  // 3) Optional 24h delta (qty change only — value uses current price)
  const prevQtyByNet = new Map<
    EvmNetwork,
    Map<string, { prevQty: number; decimals: number }>
  >();
  const price24ByNet = new Map<EvmNetwork, Map<string, number>>();
  if (withDelta24h) {
    const t24 = Math.floor((Date.now() - 24 * 3600 * 1000) / 1000);

    for (const net of networks) {
      // prev qty map from historical (may be missing many tokens; that's fine)
      const prevMap = await getPrevQtyMap(net, address);
      prevQtyByNet.set(net, prevMap); // keys like "__native__" or contract lower

      const contracts = contractsByNet.get(net) ?? [];
      // ask 24h prices for all current contracts; include native
      const p24 = await getPricesAtTimestamp(
        net,
        contracts,
        t24,
        /*includeNative*/ true
      );
      price24ByNet.set(net, p24);
    }
  }

  // 4) assemble holdings with filtering
  const spamMode = opts?.spamFilter ?? SPAM_FILTER_MODE;
  const holdings: (PricedHolding & {
    isSpam?: boolean;
    spamReasons?: string[];
  })[] = rows
    .map((r: any) => {
      const qty = toFloat(r.amount, r.decimals);

      // ETH debug log (optional)
      if (r.symbol === "ETH" && r.network === "mainnet") {
        const key = `${r.network}:${normalizeContractKey(r.contract)}`;
        // console.log("ETH mainnet key for delta lookup =", key);
      }

      // Normalize once for everything below
      // ONE normalized key for everything below
      const kContract = normalizeContractKey(r.contract); // returns "__native__" for native
      const key = `${r.network}:${kContract}`; // <-- matches delta & price maps
      const isNative = kContract === NATIVE_SENTINEL;

      const displaySymbol = cleanSymbol(r.symbol);

      // pick the right price source
      let priceUsd = 0 as number;
      let priceSource: "native" | "map" | "tokenapi" | "unknown" = "unknown";

      if (isNative) {
        const p = nativePriceMap.get(r.network);
        if (p != null) {
          priceUsd = p;
          priceSource = "native";
        } else if (typeof r.price_usd === "number") {
          priceUsd = r.price_usd;
          priceSource = "tokenapi";
        }
      } else {
        const p = priceMap.get(key);
        if (p != null) {
          priceUsd = p;
          priceSource = (priceSrc.get(key) as any) || "map";
        } else if (typeof r.price_usd === "number") {
          priceUsd = r.price_usd;
          priceSource = "tokenapi";
        }
      }

      // // optional sanity guard against absurd ERC‑20 prices
      // if (!isNative && priceSource === "tokenapi" && priceUsd > 1_000_000) {
      //   // drop to 0 or keep but mark clearly
      //   // priceUsd = 0;
      //   // priceSource = 'unknown';
      // }

      const qtyNow = toFloat(r.amount, r.decimals);
      const valueUsd = qtyNow * (priceUsd || 0);

      let delta24hUsd = 0;
      let delta24hPct: number | null = 0;
      // attach delta values from map
      if (withDelta24h) {
        const p24Map = price24ByNet.get(r.network) ?? new Map<string, number>();
        const prevMap =
          prevQtyByNet.get(r.network) ??
          new Map<string, { prevQty: number; decimals: number }>();

        // key for lookups inside the per-network maps:
        const contractKey = normalizeContractKey(r.contract); // '__native__' or actual address lower
        const key24 = isNative ? `${r.network}:${NATIVE_SENTINEL}` : key;

        const hasPrevQty = prevMap.has(contractKey);
        const hasPrice24 = p24Map.has(key24);
        const prevQty = hasPrevQty ? prevMap.get(contractKey)!.prevQty : qtyNow; // assume unchanged qty if missing
        const price24 = hasPrice24 ? (p24Map.get(key24) as number) : 0;

        const valueNow = qtyNow * (priceUsd || 0);
        if (hasPrice24) {
          const value24 = prevQty * price24;
          delta24hUsd = valueNow - value24;
          delta24hPct = value24 > 0 ? (delta24hUsd / value24) * 100 : null;
        } else {
          // Without a 24h price, both USD delta and pct are unreliable
          delta24hUsd = null as unknown as number; // keep type, but will serialize as null
          delta24hPct = null;
        }

        // if (!p24Map.has(key24) && valueNow > 0) {
        //   console.log("[Δ24h miss:price24]", {
        //     key24,
        //     symbol: r.symbol,
        //     isNative,
        //   });
        // }
        if (!prevMap.has(contractKey)) {
          // benign: just means we assumed qtyPrev = qtyNow
          // console.log("[Δ24h miss:prevQty]", { network: r.network, contractKey, symbol: r.symbol });
        }
      }

      // spam filtering
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
          priceSource,
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
  // Compute 24h KPI only from tokens with a known 24h price
  let valueNowSum24 = 0;
  let value24Sum = 0;
  let have24 = false;
  for (const h of holdings) {
    const net = h.chain;
    const p24Map = price24ByNet.get(net) ?? new Map<string, number>();
    const isNative = h.contract == null;
    const contractKey = isNative
      ? NATIVE_SENTINEL
      : (h.contract as string).toLowerCase();
    const key24 = isNative
      ? `${net}:${NATIVE_SENTINEL}`
      : `${net}:${contractKey}`;
    const price24 = p24Map.get(key24);
    if (typeof price24 === "number" && price24 > 0) {
      have24 = true;
      valueNowSum24 += h.valueUsd;
      const prevMap =
        prevQtyByNet.get(net) ??
        new Map<string, { prevQty: number; decimals: number }>();
      const prevQty =
        prevMap.get(contractKey)?.prevQty ?? parseFloat(h.qty || "0");
      value24Sum += prevQty * price24;
    }
  }
  const deltaAggUsd = have24 ? valueNowSum24 - value24Sum : 0;
  const deltaAggPct =
    have24 && value24Sum > 0 ? (deltaAggUsd / value24Sum) * 100 : 0;

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
    warnings: {
      ...getPricingWarnings(),
      ...getTokenApiWarnings(),
    },
  };
}
