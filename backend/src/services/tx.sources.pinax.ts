// backend/src/services/tx.sources.pinax.ts
import type { PageParams } from "../types/transactions";
import type {
  TokenApiTransfer,
  TokenApiNftTransfer,
} from "./../services/tx.normalize";
import { fetchWithRetry } from "../utils/http";
import { markTokenApiRateLimited } from "./tokenApiStatus";

// Simple in-process throttle for Token API to avoid 429s.
// Configurable via env: TOKEN_API_RPM (requests per minute, default 300)
// const TOKEN_API_RPM = Math.max(60, Number(process.env.TOKEN_API_RPM ?? 300));
// const TOKEN_API_MIN_INTERVAL_MS = Math.floor(60000 / TOKEN_API_RPM);
// let tokenApiNextAt = 0;
// async function tokenApiThrottle() {
//   const now = Date.now();
//   if (now < tokenApiNextAt) {
//     await new Promise((r) => setTimeout(r, tokenApiNextAt - now));
//   }
//   tokenApiNextAt =
//     Math.max(Date.now(), tokenApiNextAt) + TOKEN_API_MIN_INTERVAL_MS;
// }

const TOKEN_API_BASE =
  process.env.TOKEN_API_BASE_URL?.replace(/\/+$/, "") ??
  "https://token-api.thegraph.com/v1";
const TOKEN_API_KEY = process.env.GRAPH_TOKEN_API_KEY;
const TOKEN_API_JWT = process.env.GRAPH_TOKEN_API_JWT;
const TOKEN_API_LIMIT_MAX = Number(process.env.TOKEN_API_LIMIT_MAX ?? 40);
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
  const target = Math.max(1, p.limit ?? TOKEN_API_LIMIT_MAX);
  const common = {
    network: p.network,
    start_time: p.fromTime,
    end_time: p.toTime,
  };
  async function fetchDirection(direction: "out" | "in") {
    const rows: TokenApiTransfer[] = [];
    let page = Math.max(1, p.page ?? 1);

    while (rows.length < target) {
      const limitThisCall = Math.min(TOKEN_API_LIMIT_MAX, target - rows.length);
      const directionParams =
        direction === "out"
          ? { from_address: p.address }
          : { to_address: p.address };
      const query = qs({
        ...common,
        ...directionParams,
        page,
        limit: limitThisCall,
      });

      try {
        const res = await fetchWithRetry(`${base}?${query}`, {
          headers: tokenApiHeaders(),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          if (res.status === 429) {
            markTokenApiRateLimited();
          }
          throw new Error(
            `${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`
          );
        }
        const payload = await res.json();
        const chunk: TokenApiTransfer[] = Array.isArray(payload)
          ? payload
          : payload?.data ?? [];
        if (!chunk.length) break;
        rows.push(...chunk);
        if (chunk.length < limitThisCall) break;
        page += 1;
      } catch (e: any) {
        if (String(e?.message ?? "").includes("429")) {
          markTokenApiRateLimited();
        }
        console.error(
          `TokenAPI transfers ${direction === "out" ? "outbound" : "inbound"} ${
            p.network
          } p${page} limit=${limitThisCall}: ${e?.message ?? e}`
        );
        break;
      }
    }

    return rows;
  }

  const [outRows, inRows] = await Promise.all([
    fetchDirection("out"),
    fetchDirection("in"),
  ]);

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
  const target = Math.max(1, p.limit ?? TOKEN_API_LIMIT_MAX);
  const rows: TokenApiNftTransfer[] = [];
  let page = Math.max(1, p.page ?? 1);

  while (rows.length < target) {
    const limitThisCall = Math.min(TOKEN_API_LIMIT_MAX, target - rows.length);
    const query = qs({
      network: p.network,
      address: p.address,
      start_time: p.fromTime,
      end_time: p.toTime,
      page,
      limit: limitThisCall,
    });

    try {
      const res = await fetchWithRetry(`${base}?${query}`, {
        headers: tokenApiHeaders(),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error(
          `TokenAPI NFT ${p.network} p${page} limit=${limitThisCall}: ${
            res.status
          }${text ? `: ${text.slice(0, 200)}` : ""} — returning partial NFT set`
        );
        break;
      }
      const json = await res.json();
      const chunk: TokenApiNftTransfer[] = Array.isArray(json)
        ? json
        : json?.data ?? [];
      if (!chunk.length) break;
      rows.push(...chunk);
      if (chunk.length < limitThisCall) break;
      page += 1;
    } catch (e: any) {
      console.error(
        `TokenAPI NFT ${p.network} p${page} limit=${limitThisCall} error: ${
          e?.message ?? e
        }`
      );
      break;
    }
  }

  return rows;
}
