/**
 * Step 2: pricing at timestamp (per leg) + native pricing for gas.
 * Uses DeFi Llama "prices/historical" endpoint with light caching.
 */

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
  // Native coin
  if (!contract) {
    const id = nativeCoinId(network);
    return id ? getUsdAtTs(id, ts) : undefined;
  }
  // ERC-20 coin via platform:address
  const platform = platformOf(network);
  if (!platform) return undefined;
  const id = `${platform}:${contract.toLowerCase()}`;
  return getUsdAtTs(id, ts);
}

export async function quoteNativeUsdAtTs(
  network: string,
  ts: number
): Promise<number | undefined> {
  const id = nativeCoinId(network);
  return id ? getUsdAtTs(id, ts) : undefined;
}
