// backend/src/services/tx.sources.pinax.ts
import { parseNetworks, type EvmNetwork } from "../config/networks";
import type { PageParams } from "../types/transactions";
import type {
  TokenApiTransfer,
  TokenApiNftTransfer,
} from "./../services/tx.normalize";
import { fetchWithRetry } from "../utils/http";

// Simple in-process throttle for Token API to avoid 429s.
// Configurable via env: TOKEN_API_RPM (requests per minute, default 300)
const TOKEN_API_RPM = Math.max(60, Number(process.env.TOKEN_API_RPM ?? 300));
const TOKEN_API_MIN_INTERVAL_MS = Math.floor(60000 / TOKEN_API_RPM);
let tokenApiNextAt = 0;
async function tokenApiThrottle() {
  const now = Date.now();
  if (now < tokenApiNextAt) {
    await new Promise((r) => setTimeout(r, tokenApiNextAt - now));
  }
  tokenApiNextAt = Math.max(Date.now(), tokenApiNextAt) + TOKEN_API_MIN_INTERVAL_MS;
}

const TOKEN_API_BASE =
  process.env.TOKEN_API_BASE_URL?.replace(/\/+$/, "") ??
  "https://token-api.thegraph.com/v1";
const TOKEN_API_KEY = process.env.GRAPH_TOKEN_API_KEY;
const TOKEN_API_JWT = process.env.GRAPH_TOKEN_API_JWT;
const TOKEN_API_LIMIT_MAX = Number(process.env.TOKEN_API_LIMIT_MAX ?? 10);
const DEBUG_TOKEN_API =
  String(process.env.DEBUG_TOKEN_API).toLowerCase() === "true";
const TOKEN_API_AUTH_MODE = TOKEN_API_JWT
  ? "jwt"
  : TOKEN_API_KEY
  ? "key"
  : "none";
// One-time note to help operators understand which auth mode is active
// (does not print secrets)
// console.log(`[tokenapi] base=${TOKEN_API_BASE} auth=${TOKEN_API_AUTH_MODE}`);

/** Build headers allowing either API key or JWT (prefer JWT when present). */
function tokenApiHeaders(): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json" };
  // Use exactly ONE auth mechanism to avoid conflicts server-side.
  if (TOKEN_API_JWT) {
    h["authorization"] = `Bearer ${TOKEN_API_JWT}`;
  } else if (TOKEN_API_KEY) {
    h["x-api-key"] = TOKEN_API_KEY;
  }
  if (DEBUG_TOKEN_API) {
    const mode = TOKEN_API_JWT ? "jwt" : TOKEN_API_KEY ? "key" : "none";
    // console.log(`[tokenapi] headers auth=${mode}`);
  }
  return h;
}

function qs(params: Record<string, any>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    u.set(k, String(v));
  }
  return u.toString();
}

export async function fetchFungibleTransfersPage(
  p: PageParams
): Promise<TokenApiTransfer[]> {
  const base = `${TOKEN_API_BASE}/evm/transfers`;
  const effLimit = Math.max(
    1,
    Math.min(p.limit ?? TOKEN_API_LIMIT_MAX, TOKEN_API_LIMIT_MAX)
  );
  // if ((p.limit ?? 0) > effLimit) {
  //   console.warn(
  //     `[tokenapi] capping fungible limit from ${p.limit} to ${effLimit} (max=${TOKEN_API_LIMIT_MAX})`
  //   );
  // }
  const common = {
    network: p.network,
    start_time: p.fromTime,
    end_time: p.toTime,
    page: p.page,
    limit: effLimit,
    // we’ll rely on server-side ordering by block/timestamp/log
  };
  let outRows: TokenApiTransfer[] = [];
  try {
    await tokenApiThrottle();
    const r = await fetchWithRetry(
      `${base}?${qs({ ...common, from_address: p.address })}`,
      { headers: tokenApiHeaders() }
    );
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      throw new Error(`${r.status}${text ? `: ${text.slice(0, 200)}` : ""}`);
    }
    const j = await r.json();
    outRows = Array.isArray(j) ? j : j?.data ?? [];
  } catch (e: any) {
    // if outbound fails (e.g., 403/429/5xx), continue with inbound results
    console.error(
      `TokenAPI transfers outbound ${p.network} p${p.page} limit=${p.limit}: ${
        e?.message ?? e
      }`
    );
  }

  // inbound
  let inRows: TokenApiTransfer[] = [];
  try {
    await tokenApiThrottle();
    const r = await fetchWithRetry(
      `${base}?${qs({ ...common, to_address: p.address })}`,
      { headers: tokenApiHeaders() }
    );
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      throw new Error(`${r.status}${text ? `: ${text.slice(0, 200)}` : ""}`);
    }
    const j = await r.json();
    inRows = Array.isArray(j) ? j : j?.data ?? [];
  } catch (e: any) {
    // if inbound fails, we still return outbound results
    console.error(
      `TokenAPI transfers inbound ${p.network} p${p.page} limit=${p.limit}: ${
        e?.message ?? e
      }`
    );
  }

  if (!outRows.length && !inRows.length) {
    // Degrade gracefully instead of failing the whole request.
    console.error(
      `TokenAPI transfers page failed for ${p.network} (try adding from/to or a smaller limit) — returning empty set`
    );
    return [];
  }
  return [...outRows, ...inRows];
}

export async function fetchNftTransfersPage(
  p: PageParams
): Promise<TokenApiNftTransfer[]> {
  const base = `${TOKEN_API_BASE}/evm/nft/transfers`;
  const effLimit = Math.max(
    1,
    Math.min(p.limit ?? TOKEN_API_LIMIT_MAX, TOKEN_API_LIMIT_MAX)
  );
  // if ((p.limit ?? 0) > effLimit) {
  //   console.warn(
  //     `[tokenapi] capping NFT limit from ${p.limit} to ${effLimit} (max=${TOKEN_API_LIMIT_MAX})`
  //   );
  // }
  const u = `${base}?${qs({
    network: p.network,
    address: p.address,
    start_time: p.fromTime,
    end_time: p.toTime,
    page: p.page,
    limit: effLimit,
  })}`;

  try {
    await tokenApiThrottle();
    const res = await fetchWithRetry(u, { headers: tokenApiHeaders() });
    if (!res.ok) {
      // Do not hard-fail the entire listing on NFT errors (e.g., 403 for missing credentials).
      const text = await res.text().catch(() => "");
      console.error(
        `TokenAPI NFT ${p.network} p${p.page} limit=${p.limit}: ${res.status}${
          text ? `: ${text.slice(0, 200)}` : ""
        } — returning empty NFT set`
      );
      return [];
    }
    const json = await res.json();
    const rows: TokenApiNftTransfer[] = Array.isArray(json)
      ? json
      : json?.data ?? [];
    return rows;
  } catch (e: any) {
    // Network/timeouts also shouldn’t break the page; degrade gracefully.
    console.error(
      `TokenAPI NFT ${p.network} p${p.page} error: ${e?.message ?? e}`
    );
    return [];
  }
}
