// backend/src/services/delta24h.service.ts

import fetch from "node-fetch";
import type { EvmNetwork } from "../config/networks";
import {
  NATIVE_SENTINEL,
  getPricesFor,
  getPricesAtTimestamp,
  getNativePriceUsd,
} from "./pricing.service";

const TOKEN_API_BASE =
  process.env.TOKEN_API_BASE_URL ?? "https://token-api.thegraph.com/v1";
const TOKEN_API_JWT = process.env.GRAPH_TOKEN_API_JWT!;

// The Token API uses the "0xeeee..." sentinel for native; normalize to NATIVE_SENTINEL/null upstream.
const EEEE = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

// ---- tiny HTTP helper ----
async function tokenApiGET<T>(
  path: string,
  qs: Record<string, string | number | undefined>
): Promise<{ data: T }> {
  const url = new URL(`${TOKEN_API_BASE}${path}`);
  Object.entries(qs).forEach(([k, v]) => {
    if (v !== undefined) url.searchParams.set(k, String(v));
  });
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${TOKEN_API_JWT}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`TokenAPI ${path} ${res.status} ${text}`.trim());
  }
  return res.json() as any;
}

// ---- types from the historical endpoint (we only care about a few fields) ----
type HistPoint = {
  contract?: string | null; // may be "0xeeee..." for native
  symbol?: string | null;
  decimals: number;
  timestamp: number; // unix seconds
  amount: string; // <-- IMPORTANT: Token API returns "amount" (raw units)
};

type HistResponse = HistPoint[];

/**
 * Fetch last 2 daily balance points per contract for an address on one network,
 * fetch prices now and 24h ago, and return a map keyed by `${network}:${contract|__native__}`
 * with USD delta and pct.
 *
 * value_now  = qty_now  * price_now
 * value_24h  = qty_prev * price_24
 * deltaUsd   = value_now - value_24h
 * deltaPct   = value_24h > 0 ? deltaUsd / value_24h * 100 : null
 */
export async function getDelta24hValueByContract(
  network: EvmNetwork,
  address: string
): Promise<Map<string, { deltaUsd: number; deltaPct: number | null }>> {
  // 1) balances (last 2 daily points)
  const { data } = await tokenApiGET<HistResponse>("/evm/balances/historical", {
    network,
    address,
    interval: "1d",
    limit: 2,
  });

  // group by contract (normalize native)
  const byContract = new Map<
    string, // contractLower | NATIVE_SENTINEL
    HistPoint[]
  >();

  for (const row of data) {
    const cRaw = (row.contract ?? EEEE).toLowerCase();
    const key = cRaw === EEEE ? NATIVE_SENTINEL : cRaw;
    if (!byContract.has(key)) byContract.set(key, []);
    byContract.get(key)!.push(row);
  }

  // For each contract, keep the last two (prev, curr)
  const pairs: Array<{
    key: string; // contractLower | NATIVE_SENTINEL
    prev: HistPoint | null;
    curr: HistPoint | null;
  }> = [];
  byContract.forEach((arr, key) => {
    // sort ascending by timestamp just in case
    const sorted = arr.slice().sort((a, b) => a.timestamp - b.timestamp);
    const slice = sorted.slice(-2);
    const prev = slice.length === 2 ? slice[0] : null;
    const curr = slice.length >= 1 ? slice[slice.length - 1] : null;
    if (curr) pairs.push({ key, prev, curr });
  });

  // 2) prepare price queries: now & 24h ago
  const contractAddrs: string[] = pairs
    .map((p) => p.key)
    .filter((k) => k !== NATIVE_SENTINEL) as string[];

  // now prices (ERC-20s)
  const priceNowMap = await getPricesFor(network, contractAddrs, true);
  // native price now
  const nativeNow = await getNativePriceUsd(network);

  // prices 24h ago (ERC-20s + native)
  const t24 = Math.floor((Date.now() - 24 * 3600 * 1000) / 1000);
  const price24Map = await getPricesAtTimestamp(
    network,
    contractAddrs,
    t24,
    /*includeNative*/ true
  );

  // 3) compute deltas
  const out = new Map<string, { deltaUsd: number; deltaPct: number | null }>();

  for (const { key, prev, curr } of pairs) {
    const decimals = curr?.decimals ?? prev?.decimals ?? 18;

    // quantities
    const qtyNow = toDecimal(curr?.amount ?? "0", decimals);
    // If the historical API didn't give us a previous point, approximate by assuming qty unchanged
    const hasPrev = !!prev;
    const qtyPrev = hasPrev ? toDecimal(prev!.amount ?? "0", decimals) : qtyNow;

    // prices
    let priceNow = 0;
    let price24 = 0;

    if (key === NATIVE_SENTINEL) {
      priceNow = nativeNow ?? 0;
      price24 = price24Map.get(`${network}:__native__`) ?? 0;
      // console.log("[Δ24h native]", network, {
      //   priceNow,
      //   price24,
      // });
    } else {
      priceNow = priceNowMap.get(`${network}:${key}`) ?? 0;
      price24 = price24Map.get(`${network}:${key}`) ?? 0;
      // console.log("[Δ24h erc20]", network, key, {
      //   priceNow,
      //   price24,
      // });
    }

    const valueNow = qtyNow * (priceNow || 0);
    const value24 = qtyPrev * (price24 || 0);
    const deltaUsd = valueNow - value24;
    const deltaPct =
      value24 > 0 ? (deltaUsd / value24) * 100 : valueNow > 0 ? 100 : null;

    // if (network === "mainnet" && key === NATIVE_SENTINEL) {
    //   console.log(
    //     "[Δ24h ETH] qtyPrev=%s qtyNow=%s price24=%s priceNow=%s value24=%s valueNow=%s deltaUsd=%s",
    //     qtyPrev,
    //     qtyNow,
    //     price24,
    //     priceNow,
    //     qtyPrev * price24,
    //     qtyNow * priceNow,
    //     qtyNow * priceNow - qtyPrev * price24
    //   );
    // }

    out.set(`${network}:${key}`, { deltaUsd, deltaPct });
  }

  console.log("[Δ24h]", network, {
    pairs: pairs.length,
    priceNowErc20: priceNowMap.size,
    price24Map: Array.from(price24Map.keys()).slice(0, 3), // peek
  });

  return out;
}

// exact decimal conversion for big integers
function toDecimal(amountStr: string, decimals: number): number {
  try {
    const a = BigInt(amountStr || "0");
    const base = 10n ** BigInt(decimals ?? 0);
    const whole = a / base;
    const frac = a % base;
    return Number(whole) + Number(frac) / Number(base);
  } catch {
    return 0;
  }
}

export async function getPrevQtyMap(
  network: EvmNetwork,
  address: string
): Promise<Map<string, { prevQty: number; decimals: number }>> {
  const { data } = await tokenApiGET<HistResponse>("/evm/balances/historical", {
    network,
    address,
    interval: "1d",
    limit: 2,
  });

  const byContract = new Map<string, HistPoint[]>();
  for (const row of data) {
    const cRaw = (row.contract ?? EEEE).toLowerCase();
    const key = cRaw === EEEE ? NATIVE_SENTINEL : cRaw;
    if (!byContract.has(key)) byContract.set(key, []);
    byContract.get(key)!.push(row);
  }

  const out = new Map<string, { prevQty: number; decimals: number }>();
  byContract.forEach((arr, key) => {
    const sorted = arr.slice().sort((a, b) => a.timestamp - b.timestamp);
    const slice = sorted.slice(-2);
    if (slice.length === 2) {
      const prev = slice[0];
      out.set(key, {
        prevQty: toDecimal(prev.amount, prev.decimals),
        decimals: prev.decimals,
      });
    }
  });

  return out; // keys are contractLower | __native__
}
