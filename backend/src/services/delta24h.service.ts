// src/services/delta24h.service.ts
import fetch from "node-fetch";
import type { EvmNetwork } from "../config/networks";
import { NATIVE_SENTINEL } from "./pricing.service";

const TOKEN_API_BASE =
  process.env.TOKEN_API_BASE_URL ?? "https://token-api.thegraph.com/v1";
const TOKEN_API_JWT = process.env.GRAPH_TOKEN_API_JWT!;

type HistRow = {
  contract: string; // ERC-20 or NATIVE_SENTINEL
  decimals: number;
  symbol: string;
  // balances at buckets: we request limit=2 so we'll get two points (prev, current)
  balance: string; // current bucket raw
  prev_balance?: string; // previous bucket raw (we’ll derive)
};

type HistResp = {
  // For simplicity assume data is array with two points per token; some APIs flatten.
  // We’ll request with limit=2 and expect the API to include the latest 2 daily points per token.
  // If actual payload differs, adapt mapping here.
  data: Array<{
    contract: string;
    decimals: number;
    symbol: string;
    balance: string; // latest
    timestamp: number;
  }>;
};

async function tokenApiGET<T>(
  path: string,
  qs: Record<string, string | number | undefined>
) {
  const url = new URL(`${TOKEN_API_BASE}${path}`);
  Object.entries(qs).forEach(([k, v]) => {
    if (v !== undefined) url.searchParams.set(k, String(v));
  });
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${TOKEN_API_JWT}` },
  });
  if (!res.ok) throw new Error(`TokenAPI ${path} ${res.status}`);
  return res.json() as Promise<{ data: any }>;
}

function toFloat(balanceRaw: string, decimals: number): number {
  const d = BigInt(balanceRaw || "0");
  const scale = 10n ** BigInt(decimals);
  return Number(d) / Number(scale);
}

/**
 * Returns a per-contract delta object:
 * { `${network}:${contractLower}`: { deltaQty, prevQty } }
 */
export async function getDelta24hQtyByContract(
  network: EvmNetwork,
  address: string
): Promise<Map<string, { deltaQty: number; prevQty: number }>> {
  // We call the historical balances endpoint, ask for last 2 daily points.
  const { data } = await tokenApiGET<HistResp>("/evm/balances/historical", {
    network,
    address,
    interval: "1d",
    limit: 2,
  });

  // Expected shape: data is flat rows (contract,timestamp,balance) — we regroup by contract.
  const byContract = new Map<
    string,
    Array<{ balance: string; decimals: number }>
  >();
  for (const row of data as any[]) {
    const c = (row.contract ?? NATIVE_SENTINEL).toLowerCase();
    if (!byContract.has(c)) byContract.set(c, []);
    byContract.get(c)!.push({ balance: row.balance, decimals: row.decimals });
  }

  const out = new Map<string, { deltaQty: number; prevQty: number }>();
  byContract.forEach((arr, c) => {
    // Sort newest last if needed
    const sorted = arr.slice(-2); // last two
    if (sorted.length < 2) return;
    const prev = sorted[0];
    const curr = sorted[1];
    const prevQty = toFloat(prev.balance, prev.decimals);
    const currQty = toFloat(curr.balance, curr.decimals);
    const deltaQty = currQty - prevQty;
    out.set(c, { deltaQty, prevQty });
  });

  // Key with network prefix to match price map keys
  const keyed = new Map<string, { deltaQty: number; prevQty: number }>();
  out.forEach((v, c) => keyed.set(`${network}:${c}`, v));
  return keyed;
}
