// Minimal CoinGecko helpers (no API key needed)
type TokenPrice = Record<string, { usd?: number }>;

const CG_BASE = "https://api.coingecko.com/api/v3";

export async function getEthUsd(): Promise<number> {
  const r = await fetch(
    `${CG_BASE}/simple/price?ids=ethereum&vs_currencies=usd`
  );
  const j = await r.json();
  return Number(j?.ethereum?.usd ?? 0);
}

function chunk<T>(arr: T[], size = 100): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function getErc20Usd(
  contracts: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const uniq = Array.from(new Set(contracts.map((c) => c.toLowerCase())));
  for (const batch of chunk(uniq, 100)) {
    const url = `${CG_BASE}/simple/token_price/ethereum?contract_addresses=${batch.join(
      ","
    )}&vs_currencies=usd`;
    const r = await fetch(url);
    const j: TokenPrice = await r.json();
    for (const [addr, obj] of Object.entries(j)) {
      if (obj?.usd != null) map.set(addr.toLowerCase(), Number(obj.usd));
    }
  }
  return map;
}
