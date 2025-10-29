// src/services/tx.sources.pinax.ts

import { parseNetworks, type EvmNetwork } from "../config/networks";
import type { PageParams } from "../types/transactions";
import type {
  TokenApiTransfer,
  TokenApiNftTransfer,
} from "./../services/tx.normalize";

const TOKEN_API_BASE =
  process.env.TOKEN_API_BASE_URL?.replace(/\/+$/, "") ??
  "https://token-api.thegraph.com/v1";
const TOKEN_API_KEY = process.env.GRAPH_TOKEN_API_KEY;
const TOKEN_API_JWT = process.env.GRAPH_TOKEN_API_JWT;

/** Build headers allowing either API key or JWT (prefer JWT when present). */
function tokenApiHeaders(): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (TOKEN_API_JWT) h["authorization"] = `Bearer ${TOKEN_API_JWT}`;
  if (TOKEN_API_KEY) h["x-api-key"] = TOKEN_API_KEY;
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
  const common = {
    network: p.network,
    start_time: p.fromTime,
    end_time: p.toTime,
    page: p.page,
    limit: p.limit,
    // we’ll rely on server-side ordering by block/timestamp/log
  };

  const [outRes, inRes] = await Promise.all([
    fetch(`${base}?${qs({ ...common, from_address: p.address })}`, {
      headers: tokenApiHeaders(),
    }),
    fetch(`${base}?${qs({ ...common, to_address: p.address })}`, {
      headers: tokenApiHeaders(),
    }),
  ]);

  if (!outRes.ok)
    throw new Error(
      `TokenAPI transfers (from) ${p.network} p${p.page}: ${outRes.status}`
    );
  if (!inRes.ok)
    throw new Error(
      `TokenAPI transfers (to) ${p.network} p${p.page}: ${inRes.status}`
    );

  const outJson = await outRes.json();
  const inJson = await inRes.json();

  // Expect shape: { data: TokenApiTransfer[] } ; tolerate bare arrays too.
  const outRows: TokenApiTransfer[] = Array.isArray(outJson)
    ? outJson
    : outJson?.data ?? [];
  const inRows: TokenApiTransfer[] = Array.isArray(inJson)
    ? inJson
    : inJson?.data ?? [];

  // Union; we’ll sort after normalization.
  return [...outRows, ...inRows];
}

export async function fetchNftTransfersPage(
  p: PageParams
): Promise<TokenApiNftTransfer[]> {
  const base = `${TOKEN_API_BASE}/evm/nft/transfers`;
  const u = `${base}?${qs({
    network: p.network,
    address: p.address,
    start_time: p.fromTime,
    end_time: p.toTime,
    page: p.page,
    limit: p.limit,
  })}`;

  const res = await fetch(u, { headers: tokenApiHeaders() });
  if (!res.ok)
    throw new Error(`TokenAPI NFT ${p.network} p${p.page}: ${res.status}`);
  const json = await res.json();
  const rows: TokenApiNftTransfer[] = Array.isArray(json)
    ? json
    : json?.data ?? [];
  return rows;
}
