// backend/src/services/tx.pricing.ts
import { fetchWithRetry } from "../utils/http";

type PlatformId =
  | "ethereum"
  | "bsc"
  | "polygon"
  | "optimism"
  | "base"
  | "arbitrum"
  | "avalanche"
  | "unichain"; // best effort; falls back gracefully

const LLAMA_BASE = "https://coins.llama.fi";
const ENABLE_DEX =
  String(process.env.ENABLE_DEXSCREENER ?? "true").toLowerCase() === "true";
const DEX_BASE = "https://api.dexscreener.com/latest/dex";
const DEX_CHART_BASE = "https://api.dexscreener.com/chart/bars";

const inMem = new Map<string, number>(); // key: `${ts}:${coinId}` → priceUsd

function platformOf(network: string): PlatformId | null {
  switch (network) {
    case "mainnet":
      return "ethereum";
    case "bsc":
      return "bsc";
    case "polygon":
      return "polygon";
    case "optimism":
      return "optimism";
    case "base":
      return "base";
    case "arbitrum-one":
      return "arbitrum";
    case "avalanche":
      return "avalanche";
    case "unichain":
      return "unichain"; // may not exist in Llama; will fallback
    default:
      return null;
  }
}

/** Map native price coin ids for networks (Coingecko ids Llama understands). */
function nativeCoinId(network: string): string | null {
  switch (network) {
    case "mainnet":
      return "coingecko:ethereum";
    case "bsc":
      return "coingecko:binancecoin";
    case "polygon":
      return "coingecko:polygon-pos";
    case "optimism":
      return "coingecko:optimism";
    case "base":
      return "coingecko:base";
    case "arbitrum-one":
      return "coingecko:arbitrum";
    case "avalanche":
      return "coingecko:avalanche-2";
    case "unichain":
      return null; // unknown; will return undefined price
    default:
      return null;
  }
}

// Map our EVM networks to DexScreener chain ids
function dexChainOf(network: string): string | null {
  switch (network) {
    case "mainnet":
      return "ethereum";
    case "bsc":
      return "bsc";
    case "polygon":
      return "polygon";
    case "optimism":
      return "optimism";
    case "base":
      return "base";
    case "arbitrum-one":
      return "arbitrum";
    case "avalanche":
      return "avalanche";
    // Unichain may or may not be supported; return null to skip
    case "unichain":
      return null;
    default:
      return null;
  }
}

// Simple caches
const pairIdCache = new Map<string, string | null>(); // key: `${chain}:${token}` -> pairId or null
const dexPriceCache = new Map<string, number>(); // key: `${pairId}:${bucketTs}` -> priceUsd

/**
 * Resolve the best pairId for a token on a given chain (highest liquidity).
 * Uses: GET /latest/dex/tokens/{tokenAddress}?chain={chain}
 */
async function dexTopPairIdForToken(
  chain: string,
  tokenAddress: string
): Promise<string | null> {
  const key = `${chain}:${tokenAddress.toLowerCase()}`;
  if (pairIdCache.has(key)) return pairIdCache.get(key)!;

  try {
    const url = `${DEX_BASE}/tokens/${tokenAddress}?chain=${encodeURIComponent(
      chain
    )}`;
    const res = await fetchWithRetry(url, {}, { retries: 1, timeoutMs: 10000 });
    if (!res.ok) {
      pairIdCache.set(key, null);
      return null;
    }
    const json = await res.json();

    // Expect { pairs: [{ pairId, liquidity: { usd }, ... }, ... ] }
    const pairs: any[] = Array.isArray(json?.pairs) ? json.pairs : [];
    if (!pairs.length) {
      pairIdCache.set(key, null);
      return null;
    }

    // Pick highest liquidity in USD, fall back to the first
    pairs.sort(
      (a, b) => Number(b?.liquidity?.usd ?? 0) - Number(a?.liquidity?.usd ?? 0)
    );
    const top = pairs[0];
    const pairId = (top?.pairId ?? null) as string | null;
    pairIdCache.set(key, pairId);
    return pairId;
  } catch {
    pairIdCache.set(key, null);
    return null;
  }
}

/**
 * Fetch price near a timestamp using chart bars:
 * GET /chart/bars/{pairId}?from={ts-Δ}&to={ts+Δ}&resolution=5
 * - We use a ±30min window and pick the closest bar to ts.
 */
async function dexUsdAtTs(
  pairId: string,
  ts: number
): Promise<number | undefined> {
  // Bucket by 5-minute window to improve cache hit rate
  const bucket = Math.floor(ts / (5 * 60)) * (5 * 60);
  const cacheKey = `${pairId}:${bucket}`;
  if (dexPriceCache.has(cacheKey)) return dexPriceCache.get(cacheKey);

  const from = ts - 30 * 60;
  const to = ts + 30 * 60;
  const url = `${DEX_CHART_BASE}/${encodeURIComponent(
    pairId
  )}?from=${from}&to=${to}&resolution=5`;

  try {
    const res = await fetchWithRetry(url, {}, { retries: 1, timeoutMs: 10000 });
    if (!res.ok) return undefined;
    const json = await res.json();
    const bars: Array<{ t: number; c: number }> = Array.isArray(json?.bars)
      ? json.bars
      : [];

    if (!bars.length) return undefined;

    // Pick bar with time closest to ts; use close price
    let best = bars[0];
    let bestDiff = Math.abs((best.t ?? 0) - ts * 1000); // some APIs use ms; normalize carefully
    for (const b of bars) {
      // Dexscreener bar times are in seconds (or ms). Try both safely:
      const bt = b.t > 10_000_000_000 ? Math.floor(b.t / 1000) : b.t;
      const diff = Math.abs(bt - ts);
      if (diff < bestDiff) {
        best = { ...b, t: bt };
        bestDiff = diff;
      }
    }

    const price = Number(best?.c);
    if (Number.isFinite(price) && price > 0) {
      dexPriceCache.set(cacheKey, price);
      return price;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/** Fetch a single coin USD price at timestamp (seconds). Caches in-memory. */
async function getUsdAtTs(
  coinId: string,
  ts: number
): Promise<number | undefined> {
  const key = `${ts}:${coinId}`;
  if (inMem.has(key)) return inMem.get(key);
  try {
    const url = `${LLAMA_BASE}/prices/historical/${ts}/${encodeURIComponent(
      coinId
    )}`;
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const json = await res.json();
    const price = json?.coins?.[coinId]?.price;
    if (typeof price === "number") {
      inMem.set(key, price);
      return price;
    }
  } catch {
    /* noop */
  }
  return undefined;
}

/** Convenience helpers exposed to the service layer. */
export async function quoteTokenUsdAtTs(
  network: string,
  contract: string | undefined,
  ts: number
): Promise<number | undefined> {
  // 1) Llama (unchanged)
  const primary = await (async () => {
    // Native coin via Llama
    if (!contract) {
      const id = nativeCoinId(network);
      return id ? getUsdAtTs(id, ts) : undefined;
    }
    // ERC-20 via Llama platform mapping
    const platform = platformOf(network);
    if (!platform) return undefined;
    const id = `${platform}:${contract.toLowerCase()}`;
    return getUsdAtTs(id, ts);
  })();

  if (typeof primary === "number") return primary;

  // 2) DexScreener fallback (ERC-20 only)
  if (!ENABLE_DEX || !contract) return undefined;
  const chain = dexChainOf(network);
  if (!chain) return undefined;

  const pairId = await dexTopPairIdForToken(chain, contract);
  if (!pairId) return undefined;

  return dexUsdAtTs(pairId, ts);
}

export async function quoteNativeUsdAtTs(
  network: string,
  ts: number
): Promise<number | undefined> {
  const id = nativeCoinId(network);
  return id ? getUsdAtTs(id, ts) : undefined;
}
