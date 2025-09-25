// DefiLlama-based pricing (no API key).
// Returns ETH USD and a Map<contract, priceUsd> for ERC-20s.

type LlamaResp = {
  coins: Record<string, { price: number }>;
};

const LLAMA = "https://coins.llama.fi/prices/current";

// ETH (native)
export async function getEthUsd(): Promise<number> {
  const url = `${LLAMA}/coingecko:ethereum`;
  const r = await fetch(url);
  const j: LlamaResp = await r.json();
  return Number(j?.coins?.["coingecko:ethereum"]?.price ?? 0);
}

// ERC-20s (Ethereum) by contract address
export async function getErc20Usd(
  contracts: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!contracts.length) return map;

  // DefiLlama accepts multiple coins: ethereum:0x...,ethereum:0x...
  // Chunk to stay well under URL limits.
  const uniq = Array.from(new Set(contracts.map((c) => c.toLowerCase())));
  const chunks: string[][] = [];
  for (let i = 0; i < uniq.length; i += 100)
    chunks.push(uniq.slice(i, i + 100));

  for (const batch of chunks) {
    const coinsParam = batch.map((c) => `ethereum:${c}`).join(",");
    const r = await fetch(`${LLAMA}/${encodeURIComponent(coinsParam)}`);
    const j: LlamaResp = await r.json();
    for (const [k, v] of Object.entries(j?.coins ?? {})) {
      // k is like "ethereum:0xabc..."; extract address
      const addr = k.split(":")[1]?.toLowerCase();
      if (addr && v?.price != null) map.set(addr, Number(v.price));
    }
  }
  return map;
}

export async function getErc20UsdViaDexScreener(
  contracts: string[],
  minLiquidityUsd = 50_000
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const uniq = Array.from(new Set(contracts.map((a) => a.toLowerCase())));
  // Batch up to 30 addresses per call (per DexScreener docs)
  for (let i = 0; i < uniq.length; i += 30) {
    const batch = uniq.slice(i, i + 30);
    const url = `https://api.dexscreener.com/tokens/v1/ethereum/${batch.join(
      ","
    )}`;
    const r = await fetch(url);
    if (!r.ok) continue;
    const j = (await r.json()) as any;
    // The response has a "pairs" array with priceUsd and liquidity.usd
    const pairs: any[] = j?.pairs ?? j?.[0]?.pairs ?? [];
    for (const p of pairs) {
      const base = p?.baseToken?.address?.toLowerCase?.();
      const price = Number(p?.priceUsd ?? 0);
      const liq = Number(p?.liquidity?.usd ?? 0);
      if (!base || !isFinite(price) || !isFinite(liq)) continue;
      if (liq < minLiquidityUsd || price <= 0) continue;
      // Keep the price from the highest-liquidity pair per token
      const prev = out.get(base);
      const prevLiq = (out as any)._liq?.[base] ?? 0;
      if (!prev || liq > prevLiq) {
        out.set(base, price);
        // store liq alongside to compare later (not exposed)
        (out as any)._liq = (out as any)._liq || {};
        (out as any)._liq[base] = liq;
      }
    }
  }
  // cleanup private field
  if ((out as any)._liq) delete (out as any)._liq;
  return out;
}

// Resolve symbol/name to likely Ethereum token contracts via DexScreener search
export async function resolveContractsOnEthereum(
  query: string
): Promise<string[]> {
  const q = query.trim();
  if (!q) return [];
  const url = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(
    q
  )}`;
  const r = await fetch(url);
  if (!r.ok) return [];
  const j = (await r.json()) as any;
  const pairs: any[] = j?.pairs ?? [];
  const addrs = new Set<string>();
  for (const p of pairs) {
    if (p?.chainId !== "ethereum") continue;
    const base = p?.baseToken;
    const sym = String(base?.symbol || "");
    const name = String(base?.name || "");
    const addr = String(base?.address || "").toLowerCase();
    if (!addr.startsWith("0x")) continue;
    // prefer exact symbol match; still allow name includes
    const match =
      sym.toLowerCase() === q.toLowerCase() ||
      name.toLowerCase().includes(q.toLowerCase());
    if (match) addrs.add(addr);
    if (addrs.size >= 10) break; // cap
  }
  return Array.from(addrs);
}
