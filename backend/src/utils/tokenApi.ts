// backend/src/utils/tokenApi.ts
const BASE = process.env.TOKEN_API_BASE_URL ?? "https://token-api.thegraph.com";
const TOKEN = process.env.GRAPH_TOKEN_API_JWT;

type Query = Record<string, string | number | boolean | undefined>;

export async function tokenApiGet<T>(
  path: string,
  query: Query = {}
): Promise<T> {
  if (!TOKEN) throw new Error("Missing GRAPH_TOKEN_API_JWT");
  const url = new URL(path.startsWith("/") ? path : `/${path}`, BASE);
  for (const [k, v] of Object.entries(query))
    if (v !== undefined) url.searchParams.set(k, String(v));
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json", Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) throw new Error(`[tokenApi] ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export function resolveNetwork(chain?: string | number) {
  const s = typeof chain === "string" ? chain.toLowerCase() : chain;
  if (s === "bsc" || s === "bnb-mainnet" || s === 56)
    return {
      networkId: "bsc" as const,
      chainId: 56,
      chainLabel: "bnb-mainnet" as const,
    };
  return {
    networkId: "mainnet" as const,
    chainId: 1,
    chainLabel: "eth-mainnet" as const,
  };
}
