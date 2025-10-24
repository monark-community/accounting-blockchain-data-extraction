// backend/src/utils/priceApi.ts
// Multi-EVM prices via DefiLlama (+ optional DexScreener fallback)

import { networkForChainId } from "./tokenApi";

export type PriceQuote = { priceUsd: number; priceUsd24h: number | null };

/** Map EVM chainId -> DefiLlama key + native coin id */
function llamaChainKey(chainId: number): { key: string; nativeId: string } {
  switch (chainId) {
    case 1:
      return { key: "ethereum", nativeId: "coingecko:ethereum" };
    case 56:
      return { key: "bsc", nativeId: "coingecko:binancecoin" };
    case 137:
      return { key: "polygon", nativeId: "coingecko:polygon-pos" };
    case 42161:
      return { key: "arbitrum", nativeId: "coingecko:arbitrum" };
    case 10:
      return { key: "optimism", nativeId: "coingecko:optimism" };
    case 8453:
      return { key: "base", nativeId: "coingecko:base" };
    case 43114:
      return { key: "avalanche", nativeId: "coingecko:avalanche-2" };
    default:
      return { key: "ethereum", nativeId: "coingecko:ethereum" };
  }
}

/** Map EVM chainId -> DexScreener chain slug */
function dsChain(chainId: number): string {
  switch (chainId) {
    case 1:
      return "ethereum";
    case 56:
      return "bsc";
    case 137:
      return "polygon";
    case 42161:
      return "arbitrum";
    case 10:
      return "optimism";
    case 8453:
      return "base";
    case 43114:
      return "avalanche";
    default:
      return "ethereum";
  }
}

const LLAMA_NOW = "https://coins.llama.fi/prices/current";
const LLAMA_H24 = "https://coins.llama.fi/prices/historical";

type LlamaResp = { coins: Record<string, { price: number }> };

function chunk<T>(arr: T[], size = 120): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function llamaNow(ids: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const batch of chunk(ids)) {
    // use path style for NOW (works fine)
    const url = `${LLAMA_NOW}/${encodeURIComponent(batch.join(","))}`;
    const r = await fetch(url);
    if (!r.ok) continue;
    const j = (await r.json()) as LlamaResp;
    for (const [k, v] of Object.entries(j.coins ?? {}))
      out[k] = Number(v.price ?? 0);
  }
  return out;
}

async function llama24h(ids: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const batch of chunk(ids, 80)) {
    const coinsParam = batch.map((id) => encodeURIComponent(id)).join(","); // <-- key change
    const url = `${LLAMA_H24}/24h?coins=${coinsParam}`;
    const r = await fetch(url);
    if (r.ok) {
      const j = (await r.json()) as LlamaResp;
      for (const [k, v] of Object.entries(j.coins ?? {}))
        out[k] = Number(v.price ?? 0);
      continue;
    }

    // Fallback: explicit timestamp (24h ago) with path style
    if (r.status === 400) {
      const ts = Math.floor(Date.now() / 1000) - 86400;
      const pathParam = encodeURIComponent(batch.join(","));
      const urlTs = `${LLAMA_H24}/${ts}/${pathParam}`;
      const rTs = await fetch(urlTs);
      if (rTs.ok) {
        const j = (await rTs.json()) as LlamaResp;
        for (const [k, v] of Object.entries(j.coins ?? {}))
          out[k] = Number(v.price ?? 0);
      } else {
        console.warn("[prices] llama 24h fallback non-200:", rTs.status);
      }
    } else {
      console.warn("[prices] llama 24h non-200:", r.status);
    }
  }
  return out;
}

/** Build DefiLlama IDs for native + ERC-20s on a chain */
function buildLlamaIds(chainId: number, addrs: string[]) {
  const { key, nativeId } = llamaChainKey(chainId);
  const ids = new Set<string>([nativeId]);
  for (const a of addrs) if (a) ids.add(`${key}:${a.toLowerCase()}`);
  return { ids: Array.from(ids), nativeId, chainKey: key };
}

/** Main: get price map for all rows you’ll price (native + erc20) */
export async function fetchPricesUsd(
  chainId: number,
  rows: Array<{ contract: string | null; symbol: string }>
): Promise<Record<string, PriceQuote>> {
  const contracts = Array.from(
    new Set(
      rows
        .map((r) => r.contract)
        .filter(Boolean)
        .map((s) => (s as string).toLowerCase())
    )
  );
  const { ids, nativeId, chainKey } = buildLlamaIds(chainId, contracts);
  if (ids.length === 0) return {};

  // Hit DefiLlama (now + 24h)
  const urlNow = `${LLAMA_NOW}/${encodeURIComponent(ids.join(","))}`;
  const urlH24 = `${LLAMA_H24}/${encodeURIComponent(ids.join(","))}`;

  const nowMap = await llamaNow(ids);
  const h24Map = await llama24h(ids);

  // Build output keyed like your holdings lookup:
  // - native uses key `native:<network>` (your overview code already expects that)
  // - erc20 uses contract lowercase
  const out: Record<string, PriceQuote> = {};

  const nativeNow = nowMap[nativeId] ?? 0;
  const nativeOld = Number.isFinite(h24Map[nativeId]) ? h24Map[nativeId] : null;
  const networkKey = networkForChainId(chainId);
  out[`native:${networkKey}`] = { priceUsd: nativeNow, priceUsd24h: nativeOld };

  console.log("[prices] keys sample:", Object.keys(out).slice(0, 5));
  console.log(
    "[prices] native key present?",
    `native:${networkForChainId(chainId)}` in out
  );

  for (const c of contracts) {
    const id = `${chainKey}:${c}`;
    const pNow = nowMap[id] ?? 0;
    const pOld = Number.isFinite(h24Map[id]) ? h24Map[id] : null;
    out[c] = { priceUsd: pNow, priceUsd24h: pOld };
  }

  // Optional: fallback for unresolved tokens via DexScreener (highest-liquidity pair)
  // Only try for the ones with price 0
  const missing = contracts.filter((c) => !(out[c]?.priceUsd > 0));
  if (missing.length) {
    const ds = await getDexScreenerNowAndH24(chainId, missing, 50_000);
    for (const [addr, q] of ds) {
      out[addr] = {
        priceUsd: q.price,
        priceUsd24h:
          q.h24 != null && out[addr]?.priceUsd
            ? out[addr].priceUsd / (1 + q.h24 / 100) // derive ~24h ago from % change
            : null,
      };
    }
  }

  return out;
}

/** DexScreener fallback (multi-chain) */
async function getDexScreenerNowAndH24(
  chainId: number,
  contracts: string[],
  minLiquidityUsd = 50_000
): Promise<Map<string, { price: number; h24: number | null }>> {
  const out = new Map<string, { price: number; h24: number | null }>();
  const chain = dsChain(chainId);
  const uniq = Array.from(new Set(contracts.map((a) => a.toLowerCase())));
  for (const batch of chunk(uniq, 30)) {
    const url = `https://api.dexscreener.com/tokens/v1/${chain}/${batch.join(
      ","
    )}`;
    const r = await fetch(url);
    if (!r.ok) continue;
    const j = (await r.json()) as any;
    const pairs: any[] = j?.pairs ?? j?.[0]?.pairs ?? [];
    for (const p of pairs) {
      const addr = p?.baseToken?.address?.toLowerCase?.();
      const price = Number(p?.priceUsd ?? 0);
      const liq = Number(p?.liquidity?.usd ?? 0);
      const h24 =
        p?.priceChange?.h24 != null ? Number(p.priceChange.h24) : null; // %
      if (!addr || !(price > 0) || !(liq >= minLiquidityUsd)) continue;
      const prev = out.get(addr) as any;
      const prevLiq = prev?.__liq ?? 0;
      if (!prev || liq > prevLiq)
        out.set(addr, { price, h24, __liq: liq } as any);
    }
  }
  // strip internal field
  for (const [k, v] of out) delete (v as any).__liq;
  return out;
}
