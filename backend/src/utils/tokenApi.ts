// backend/src/utils/tokenApi.ts
// ===== Token API (The Graph) helpers — multi-chain, JWT auth =====

const TOKEN_API_BASE_URL =
  process.env.TOKEN_API_BASE_URL || "https://token-api.thegraph.com";
const GRAPH_TOKEN_API_JWT = process.env.GRAPH_TOKEN_API_JWT || "";

/** Normalize a chain id that might be number, "1", or "0x1" */
export function normalizeChainId(id: string | number): number {
  if (typeof id === "number") return id;
  const s = String(id).trim();
  return s.startsWith("0x") ? parseInt(s, 16) : parseInt(s, 10);
}

/** Map EVM chainId -> Token API `network` parameter */
export function networkForChainId(chainId: string | number): string {
  const id = normalizeChainId(chainId);
  switch (id) {
    case 1:
      return "mainnet";
    case 137:
      return "polygon";
    case 10:
      return "optimism";
    case 42161:
      return "arbitrum-one";
    case 8453:
      return "base";
    case 56:
      return "bsc";
    case 43114:
      return "avalanche";
    // Add more here as needed
    default:
      console.warn("[TokenAPI] Unknown chainId, defaulting to mainnet:", id);
      return "mainnet";
  }
}

/** Convenience: stringify params safely */
function toQuery(
  params: Record<string, string | number | boolean | null | undefined>
) {
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => [k, String(v)] as [string, string]);
  return new URLSearchParams(Object.fromEntries(entries)).toString();
}

/** GET wrapper (JSON) with Bearer JWT */
export async function tokenApiGet<T>(
  path: string,
  params: Record<string, any>
): Promise<T | null> {
  const base = TOKEN_API_BASE_URL.replace(/\/+$/, "");
  const qs = toQuery(params);
  const url = `${base}${path}${qs ? `?${qs}` : ""}`;

  // console.log("[TokenAPI] URL:", url);

  if (!GRAPH_TOKEN_API_JWT) {
    console.error(
      "[TokenAPI] Missing GRAPH_TOKEN_API_JWT env — returning null"
    );
    return null;
  }

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${GRAPH_TOKEN_API_JWT}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error(
        `[TokenAPI] ${res.status} ${res.statusText} ${path}: ${txt.slice(
          0,
          300
        )}`
      );
      return null;
    }
    // console.log("[TokenAPI] ✅ OK", res.status, path);
    return (await res.json()) as T;
  } catch (e: any) {
    console.error("[TokenAPI] fetch error:", e?.message || e);
    return null;
  }
}

/** Shapes returned by Token API (we only use a subset) */
export type TokenApiRow = {
  address?: string; // token contract (ERC-20)
  symbol?: string; // token or "ETH"/"MATIC" for native
  name?: string;
  decimals?: number;
  amount?: string; // human units string (NOT USD)
  value?: number; // sometimes present as human units too; prefer `amount`
};

type TokenApiList<T> = { data?: T[] };

/** Fetch ERC-20 balances (returns multiple rows) */
export async function fetchErc20Balances(address: string, network: string) {
  const json = await tokenApiGet<TokenApiList<TokenApiRow>>(
    "/v1/evm/balances",
    {
      network,
      address,
    }
  );
  // Filter out native rows if any slipped in; we only want contracts here
  // console.log(
  //   `[fetchErc20Balances] ${network} → ${address}, count:`,
  //   json?.data?.length || 0
  // );

  return (json?.data ?? []).filter(
    (r) =>
      r.address && r.address !== "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
  );
}

/** Fetch native balance (single row list; we take first) */
export async function fetchNativeBalance(address: string, network: string) {
  const json = await tokenApiGet<TokenApiList<TokenApiRow>>(
    "/v1/evm/balances/native",
    {
      network,
      address,
    }
  );
  // console.log(
  //   `[fetchNativeBalance] ${network} → ${address}, native:`,
  //   json?.data?.[0]
  // );

  return (json?.data ?? [])[0] ?? null;
}
