// DefiLlama-based pricing (no API key).
// Returns ETH USD and a Map<contract, priceUsd> for ERC-20s.

type LlamaResp = {
  coins: Record<string, { price: number }>;
};

const LLAMA = "https://coins.llama.fi/prices/current";
const LLAMA_HIST = "https://coins.llama.fi/prices/historical";

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

// Returns Map<addr, { price:number, h24:number|null }> using highest-liquidity pair (>= minLiquidityUsd)
export async function getErc20NowAndH24ViaDexScreener(
  contracts: string[],
  minLiquidityUsd = 50_000
): Promise<Map<string, { price: number; h24: number | null }>> {
  const out = new Map<string, { price: number; h24: number | null }>();
  const uniq = Array.from(new Set(contracts.map((a) => a.toLowerCase())));
  for (let i = 0; i < uniq.length; i += 30) {
    const batch = uniq.slice(i, i + 30);
    const url = `https://api.dexscreener.com/tokens/v1/ethereum/${batch.join(
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
        p?.priceChange?.h24 != null ? Number(p.priceChange.h24) : null; // % change
      if (!addr || !(price > 0) || !(liq >= minLiquidityUsd)) continue;
      const prev = out.get(addr) as any;
      const prevLiq = prev?.__liq ?? 0;
      if (!prev || liq > prevLiq)
        out.set(addr, { price, h24, __liq: liq } as any);
    }
  }
  // strip internal field
  for (const [k, v] of out) {
    delete (v as any).__liq;
  }
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

// ETH @ timestamp (unix seconds)
export async function getEthUsdAt(ts: number): Promise<number> {
  const r = await fetch(`${LLAMA_HIST}/${ts}/coingecko:ethereum`);
  const j = await r.json();
  return Number(j?.coins?.["coingecko:ethereum"]?.price ?? 0);
}

// ERC-20s (ethereum) @ timestamp
export async function getErc20UsdAt(
  addrs: string[],
  ts: number
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const uniq = Array.from(new Set(addrs.map((a) => a.toLowerCase())));
  for (let i = 0; i < uniq.length; i += 100) {
    const batch = uniq
      .slice(i, i + 100)
      .map((a) => `ethereum:${a}`)
      .join(",");
    const r = await fetch(`${LLAMA_HIST}/${ts}/${encodeURIComponent(batch)}`);
    const j = await r.json();
    for (const [k, v] of Object.entries<any>(j?.coins ?? {})) {
      const addr = k.split(":")[1]?.toLowerCase();
      if (addr && v?.price != null) out.set(addr, Number(v.price));
    }
  }
  return out;
}

/** Convert raw token quantity (hex or decimal string) to a JS number using decimals. */
export async function toDecimalQty(
  input: string | number,
  decimals = 18
): number {
  // Accepts "0x..." hex, decimal string, or number
  let raw: bigint;
  if (typeof input === "number") {
    raw = BigInt(Math.trunc(input));
  } else if (typeof input === "string" && input.startsWith("0x")) {
    raw = BigInt(input);
  } else {
    raw = BigInt(String(input));
  }

  if (decimals === 0) return Number(raw);

  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const frac = raw % base;

  // Keep up to 6 fractional digits to avoid huge floats
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, 6);
  return Number(`${whole}.${fracStr}`);
}
