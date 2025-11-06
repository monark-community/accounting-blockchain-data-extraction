// src/services/pricing.service.ts
import fetch from "node-fetch";
import type { EvmNetwork } from "../config/networks";
import { fetchWithRetry } from "../utils/http";

export const NATIVE_SENTINEL = "__native__";

const ENABLE_DEXSCREENER =
  (process.env.ENABLE_DEXSCREENER ?? "false") === "true";
const ENABLE_DEFI_LLAMA = (process.env.ENABLE_DEFI_LLAMA ?? "false") === "true";

type PriceMap = Map<string, number>; // key: `${network}:${contractLower}`

const llamaChainMap: Record<EvmNetwork, string | null> = {
  mainnet: "ethereum",
  bsc: "bsc",
  polygon: "polygon",
  optimism: "optimism",
  base: "base",
  "arbitrum-one": "arbitrum",
  avalanche: "avax",
  unichain: null,
};

// DexScreener chain ids for our networks (used for spot and historical bars)
const dsChainMap: Record<EvmNetwork, string | null> = {
  mainnet: "ethereum",
  bsc: "bsc",
  polygon: "polygon",
  optimism: "optimism",
  base: "base",
  "arbitrum-one": "arbitrum",
  avalanche: "avalanche",
  unichain: null,
};

const DEX_BASE = "https://api.dexscreener.com/latest/dex";
const DEX_CHART_BASE = "https://api.dexscreener.com/chart/bars";

const nativeToLlamaId: Record<EvmNetwork, string | null> = {
  mainnet: "coingecko:ethereum",
  optimism: "coingecko:ethereum",
  base: "coingecko:ethereum",
  "arbitrum-one": "coingecko:ethereum",
  bsc: "coingecko:binancecoin",
  avalanche: "coingecko:avalanche-2",
  polygon: "coingecko:polygon-ecosystem-token", // POL
  unichain: "coingecko:ethereum",
};

export function normalizeContractKey(c?: string | null): string {
  if (!c) return NATIVE_SENTINEL;
  return /^0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee$/i.test(c)
    ? NATIVE_SENTINEL
    : c.toLowerCase();
}

// --- DexScreener fallback ---
async function fetchDexScreenerPrices(
  network: EvmNetwork,
  contracts: string[]
): Promise<PriceMap> {
  const map: PriceMap = new Map();
  if (!ENABLE_DEXSCREENER || !contracts.length) return map;

  const chain = dsChainMap[network];
  if (!chain) return map;

  const url = `https://api.dexscreener.com/latest/dex/tokens/${contracts.join(
    ","
  )}?chain=${encodeURIComponent(chain)}`;
  const res = await fetch(url);
  if (!res.ok) return map;
  const json = await res.json();

  // Choose the pair with the highest liquidity for each base token,
  // to avoid thin/dust pairs with unrealistic prices.
  const best: Record<string, { price: number; liq: number }> = {};
  if (Array.isArray(json.pairs)) {
    for (const p of json.pairs) {
      const addr = String(p.baseToken?.address || "").toLowerCase();
      const price = Number(p.priceUsd);
      const liq = Number(p?.liquidity?.usd ?? 0);
      if (!addr || !Number.isFinite(price)) continue;
      const prev = best[addr];
      if (!prev || liq > prev.liq) best[addr] = { price, liq };
    }
  }

  // Optionally gate on minimum liquidity to drop obvious outliers
  const MIN_LIQ_USD = 10_000; // conservative threshold
  for (const c of contracts) {
    const rec = best[c.toLowerCase()];
    if (rec && (rec.liq >= MIN_LIQ_USD || rec.liq === 0)) {
      map.set(`${network}:${c.toLowerCase()}`, rec.price);
    }
  }
  return map;
}

// Resolve highest-liquidity Dex pair for a token
async function dexTopPairIdForToken(
  network: EvmNetwork,
  token: string
): Promise<string | null> {
  if (!ENABLE_DEXSCREENER) return null;
  const chain = dsChainMap[network];
  if (!chain) return null;
  try {
    const url = `${DEX_BASE}/tokens/${token}?chain=${encodeURIComponent(
      chain
    )}`;
    const res = await fetchWithRetry(url, {}, { retries: 1, timeoutMs: 10000 });
    if (!res.ok) return null;
    const json = await res.json();
    const pairs: any[] = Array.isArray(json?.pairs) ? json.pairs : [];
    if (!pairs.length) return null;
    pairs.sort(
      (a, b) => Number(b?.liquidity?.usd ?? 0) - Number(a?.liquidity?.usd ?? 0)
    );
    return (pairs[0]?.pairId as string) ?? null;
  } catch {
    return null;
  }
}

// Historical price near timestamp from DexScreener bars
async function dexBarUsdAtTs(
  pairId: string,
  tsSec: number
): Promise<number | null> {
  try {
    const from = tsSec - 30 * 60;
    const to = tsSec + 30 * 60;
    const url = `${DEX_CHART_BASE}/${encodeURIComponent(
      pairId
    )}?from=${from}&to=${to}&resolution=5`;
    const res = await fetchWithRetry(url, {}, { retries: 1, timeoutMs: 10000 });
    if (!res.ok) return null;
    const json = await res.json();
    const bars: Array<{ t: number; c: number }> = Array.isArray(json?.bars)
      ? json.bars
      : [];
    if (!bars.length) return null;
    let best = bars[0];
    let bestDiff = Math.abs((best.t ?? 0) - tsSec * 1000);
    for (const b of bars) {
      const bt = b.t > 10_000_000_000 ? Math.floor(b.t / 1000) : b.t;
      const diff = Math.abs(bt - tsSec);
      if (diff < bestDiff) {
        best = { ...b, t: bt } as any;
        bestDiff = diff;
      }
    }
    const price = Number(best?.c);
    return Number.isFinite(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}

// --- DeFiLlama fallback ---
async function fetchDefiLlamaPrices(
  network: EvmNetwork,
  contracts: string[]
): Promise<PriceMap> {
  const map: PriceMap = new Map();
  if (!ENABLE_DEFI_LLAMA || !contracts.length) return map;

  const chain = llamaChainMap[network];
  if (!chain) return map;

  const keys = contracts.map((c) => `${chain}:${c.toLowerCase()}`);
  const url = `https://coins.llama.fi/prices/current/${keys.join(",")}`;
  const res = await fetch(url);
  if (!res.ok) return map;
  const json = await res.json();
  const coins = json?.coins ?? {};
  for (const [kk, v] of Object.entries<any>(coins)) {
    const addr = kk.split(":")[1];
    const k = `${network}:${addr}`;
    const price = Number(v.price);
    if (Number.isFinite(price)) map.set(k, price);
  }
  return map;
}

// Public: ERC-20 prices (native usually comes with balances/native via Token API)
export async function getPricesFor(
  network: EvmNetwork,
  contracts: string[],
  _nativeNeeded: boolean
): Promise<PriceMap> {
  const need = [...new Set(contracts.map((c) => c.toLowerCase()))];
  const final: PriceMap = new Map();

  // Prefer DeFiLlama when available; fill gaps with DexScreener
  const [llama, ds] = await Promise.all([
    fetchDefiLlamaPrices(network, need),
    fetchDexScreenerPrices(network, need),
  ]);
  llama.forEach((v, k) => final.set(k, v));
  ds.forEach((v, k) => {
    if (!final.has(k)) final.set(k, v);
  });

  return final;
}

export async function getPricesForWithSource(
  network: EvmNetwork,
  contracts: string[]
): Promise<{
  prices: PriceMap;
  sources: Map<string, "defillama" | "dexscreener">;
}> {
  const need = [...new Set(contracts.map((c) => c.toLowerCase()))];
  const prices: PriceMap = new Map();
  const sources: Map<string, "defillama" | "dexscreener"> = new Map();

  const [llama, ds] = await Promise.all([
    fetchDefiLlamaPrices(network, need),
    fetchDexScreenerPrices(network, need),
  ]);

  // Prefer Llama; fill with Dex
  llama.forEach((v, k) => {
    prices.set(k, v);
    sources.set(k, "defillama");
  });
  ds.forEach((v, k) => {
    if (!prices.has(k)) {
      prices.set(k, v);
      sources.set(k, "dexscreener");
    }
  });

  return { prices, sources };
}

export async function getNativePriceUsd(
  network: EvmNetwork
): Promise<number | null> {
  // Map networks to a single Coingecko ID
  const cgMap: Record<EvmNetwork, string> = {
    mainnet: "coingecko:ethereum",
    optimism: "coingecko:ethereum", // ETH on L2
    base: "coingecko:ethereum", // ETH on L2
    "arbitrum-one": "coingecko:ethereum", // ETH on L2
    bsc: "coingecko:binancecoin",
    avalanche: "coingecko:avalanche-2",
    polygon: "coingecko:polygon-ecosystem-token", // POL (Polygon PoS migrated; adjust if you still use MATIC)
    unichain: "coingecko:ethereum", // until a dedicated native ID is published
  };

  const id = cgMap[network];
  if (!id) return null;

  const url = `https://coins.llama.fi/prices/current/${id}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  const price = json?.coins?.[id]?.price;
  return typeof price === "number" ? price : null;
}

// Batch historical prices at a UNIX timestamp (seconds)
export async function getPricesAtTimestamp(
  network: EvmNetwork,
  contracts: string[],
  timestampSec: number,
  includeNative = false
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const chain = llamaChainMap[network];
  if (!chain) return map;

  const keys: string[] = contracts.map((c) => `${chain}:${c.toLowerCase()}`);
  if (includeNative) {
    const id = nativeToLlamaId[network];
    if (id) keys.push(id);
  }
  if (!keys.length) return map;

  const url = `https://coins.llama.fi/prices/historical/${timestampSec}/${keys.join(
    ","
  )}`;
  try {
    const res = await fetchWithRetry(url, {}, { retries: 2, timeoutMs: 10000 });
    if (res.ok) {
      const json = await res.json();
      const coins = json?.coins ?? {};
      for (const [kk, v] of Object.entries<any>(coins)) {
        if (kk.startsWith("coingecko:")) {
          const price = Number(v.price);
          if (Number.isFinite(price)) map.set(`${network}:__native__`, price);
        } else {
          const addr = kk.split(":")[1];
          const price = Number(v.price);
          if (Number.isFinite(price)) map.set(`${network}:${addr}`, price);
        }
      }
    }
  } catch {}

  // DexScreener bar fallback for ERC-20s missing a 24h price
  if (ENABLE_DEXSCREENER) {
    for (const c of contracts) {
      const key = `${network}:${c.toLowerCase()}`;
      if (map.has(key)) continue;
      const pairId = await dexTopPairIdForToken(network, c);
      if (!pairId) continue;
      const px = await dexBarUsdAtTs(pairId, timestampSec);
      if (px && px > 0) map.set(key, px);
    }
  }

  return map;
}
