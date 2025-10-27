// src/services/pricing.service.ts
import fetch from "node-fetch";
import type { EvmNetwork } from "../config/networks";

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
  )}`;
  const res = await fetch(url);
  if (!res.ok) return map;
  const json = await res.json();

  const best: Record<string, number> = {};
  if (Array.isArray(json.pairs)) {
    for (const p of json.pairs) {
      const addr = String(p.baseToken?.address || "").toLowerCase();
      const price = Number(p.priceUsd);
      if (addr && Number.isFinite(price)) {
        if (!best[addr] || price > best[addr]) best[addr] = price;
      }
    }
  }

  for (const c of contracts) {
    const k = `${network}:${c.toLowerCase()}`;
    if (best[c.toLowerCase()]) map.set(k, best[c.toLowerCase()]);
  }
  return map;
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

  const [ds, llama] = await Promise.all([
    fetchDexScreenerPrices(network, need),
    fetchDefiLlamaPrices(network, need),
  ]);
  ds.forEach((v, k) => final.set(k, v));
  llama.forEach((v, k) => {
    if (!final.has(k)) final.set(k, v);
  });

  return final;
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
  const res = await fetch(url);
  if (!res.ok) return map;
  const json = await res.json();
  const coins = json?.coins ?? {};

  for (const [kk, v] of Object.entries<any>(coins)) {
    if (kk.startsWith("coingecko:")) {
      // native
      const price = Number(v.price);
      if (Number.isFinite(price)) map.set(`${network}:__native__`, price);
    } else {
      const addr = kk.split(":")[1]; // chain:0x...
      const price = Number(v.price);
      if (Number.isFinite(price)) map.set(`${network}:${addr}`, price);
    }
  }
  return map;
}
