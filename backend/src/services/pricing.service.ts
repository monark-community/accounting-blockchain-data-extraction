// src/services/pricing.service.ts
import fetch from "node-fetch";
import type { EvmNetwork } from "../config/networks";

export const NATIVE_SENTINEL = "__native__";

// Rate limiter for DeFiLlama
const LLAMA_RPM = Number(process.env.LLAMA_RPM ?? 60);
const llamaQueue: { timestamp: number }[] = [];

async function rateLimitLlama() {
  const now = Date.now();
  // Remove requests older than 1 minute
  while (llamaQueue.length > 0 && now - llamaQueue[0].timestamp > 60000) {
    llamaQueue.shift();
  }

  if (llamaQueue.length >= LLAMA_RPM) {
    const oldestRequest = llamaQueue[0];
    const waitTime = 60000 - (now - oldestRequest.timestamp);
    if (waitTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  llamaQueue.push({ timestamp: Date.now() });
}

// Toggle verbose pricing/debug logs. When false only concise errors are printed.
const LOGS_DEBUG = (process.env.LOGS_DEBUG ?? "false") === "true";
function dbg(...args: any[]) {
  if (LOGS_DEBUG) console.log(...args);
}

const RATE_LIMIT_COOLDOWN_MS = Number(
  process.env.DEFI_LLAMA_RATE_LIMIT_COOLDOWN_MS ?? 5 * 60 * 1000
);
let defiLlamaRateLimitedUntil = 0;

function markDefiLlamaRateLimited() {
  defiLlamaRateLimitedUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
}

export function getPricingWarnings() {
  const remaining = defiLlamaRateLimitedUntil - Date.now();
  if (remaining > 0) {
    return {
      defiLlamaRateLimited: true,
      defiLlamaRetryAfterMs: remaining,
    };
  }
  return {
    defiLlamaRateLimited: false,
    defiLlamaRetryAfterMs: 0,
  };
}

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
const dexPairCache = new Map<string, string | null>(); // `${network}:${token}` -> pairId
const dexHistCache = new Map<string, number>(); // `${pairId}:${bucketTs}` -> price

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

async function getDexPairId(
  network: EvmNetwork,
  contract: string
): Promise<string | null> {
  const key = `${network}:${contract.toLowerCase()}`;
  if (dexPairCache.has(key)) return dexPairCache.get(key)!;

  const chain = dsChainMap[network];
  if (!chain) {
    dexPairCache.set(key, null);
    return null;
  }

  const url = `${DEX_BASE}/tokens/${contract}?chain=${encodeURIComponent(
    chain
  )}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      dexPairCache.set(key, null);
      return null;
    }
    const json = await res.json();
    const pairs: any[] = Array.isArray(json?.pairs) ? json.pairs : [];
    if (!pairs.length) {
      dexPairCache.set(key, null);
      return null;
    }
    pairs.sort(
      (a, b) => Number(b?.liquidity?.usd ?? 0) - Number(a?.liquidity?.usd ?? 0)
    );
    const pairId = pairs[0]?.pairId ?? null;
    dexPairCache.set(key, pairId);
    return pairId;
  } catch {
    dexPairCache.set(key, null);
    return null;
  }
}

async function getDexPriceAtTimestamp(
  pairId: string,
  timestampSec: number
): Promise<number | undefined> {
  const bucket = Math.floor(timestampSec / (5 * 60)) * (5 * 60);
  const cacheKey = `${pairId}:${bucket}`;
  if (dexHistCache.has(cacheKey)) return dexHistCache.get(cacheKey);

  const from = timestampSec - 30 * 60;
  const to = timestampSec + 30 * 60;
  const url = `${DEX_CHART_BASE}/${encodeURIComponent(
    pairId
  )}?from=${from}&to=${to}&resolution=5`;
  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const json = await res.json();
    const bars: Array<{ t: number; c: number }> = Array.isArray(json?.bars)
      ? json.bars
      : [];
    if (!bars.length) return undefined;
    let best = bars[0];
    let bestDiff = Number.MAX_SAFE_INTEGER;
    for (const bar of bars) {
      const t = bar.t > 10_000_000_000 ? Math.floor(bar.t / 1000) : bar.t;
      const diff = Math.abs(t - timestampSec);
      if (diff < bestDiff) {
        best = { t, c: bar.c };
        bestDiff = diff;
      }
    }
    const price = Number(best?.c);
    if (Number.isFinite(price)) {
      dexHistCache.set(cacheKey, price);
      return price;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

async function fetchDexScreenerPricesAtTimestamp(
  network: EvmNetwork,
  contracts: string[],
  timestampSec: number
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!ENABLE_DEXSCREENER || !contracts.length) return out;
  for (const c of contracts) {
    const pairId = await getDexPairId(network, c);
    if (!pairId) continue;
    const price = await getDexPriceAtTimestamp(pairId, timestampSec);
    if (typeof price === "number") {
      out.set(`${network}:${c.toLowerCase()}`, price);
    }
  }
  return out;
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
  dbg("[DeFiLlama] Fetching prices from:", url);
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 429) {
      markDefiLlamaRateLimited();
    }
    console.error("[DeFiLlama] Error fetching prices:", res.status);
    return map;
  }
  const json = await res.json();
  const coins = json?.coins ?? {};
  dbg("[DeFiLlama] Got response:", json);
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
  const llamaKeys: string[] = [];
  if (chain) {
    llamaKeys.push(...contracts.map((c) => `${chain}:${c.toLowerCase()}`));
    if (includeNative) {
      const id = nativeToLlamaId[network];
      if (id) llamaKeys.push(id);
    }
  }

  if (llamaKeys.length) {
    await rateLimitLlama();
    const url = `https://coins.llama.fi/prices/historical/${timestampSec}/${llamaKeys.join(
      ","
    )}`;
    dbg("[DeFiLlama Historical] Fetching prices from:", url);
    
    // Retry logic for 429 errors with exponential backoff
    let retries = 3;
    let delay = 1000; // Start with 1 second
    while (retries > 0) {
      try {
        const res = await fetch(url);
        if (res.status === 429) {
          markDefiLlamaRateLimited();
          // Rate limited - wait and retry
          retries--;
          if (retries > 0) {
            console.warn(
              `[DeFiLlama Historical] Rate limited (429), retrying in ${delay}ms... (${retries} retries left)`
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay *= 2; // Exponential backoff: 1s, 2s, 4s
            continue;
          } else {
            console.error(
              "[DeFiLlama Historical] Rate limited (429) - max retries exceeded"
            );
            break;
          }
        }
        if (!res.ok) {
          console.error(
            "[DeFiLlama Historical] Error fetching prices:",
            res.status
          );
          break;
        }
        // Success - parse response
        const json = await res.json();
        dbg("[DeFiLlama Historical] Got response:", json);
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
        break; // Success - exit retry loop
      } catch (err) {
        retries--;
        if (retries > 0) {
          console.warn(
            `[DeFiLlama Historical] Fetch error, retrying in ${delay}ms... (${retries} retries left):`,
            err
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
        } else {
          console.error("[DeFiLlama Historical] Fetch error:", err);
        }
      }
    }
  }

  const missing = contracts
    .map((c) => c.toLowerCase())
    .filter((c) => c !== NATIVE_SENTINEL && !map.has(`${network}:${c}`));

  if (missing.length) {
    const fallback = await fetchDexScreenerPricesAtTimestamp(
      network,
      missing,
      timestampSec
    );
    fallback.forEach((v, k) => map.set(k, v));
  }

  return map;
}
