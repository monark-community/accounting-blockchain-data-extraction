import type { TxListResponse, TxRow } from "@/lib/types/transactions";
import { mapLegToTxRow } from "@/lib/mappers/txMap";

// Build backend query params
export type TxQuery = {
  networks?: string; // e.g. "mainnet,base"
  from?: string; // ISO8601
  to?: string; // ISO8601
  page?: number; // 1-based
  limit?: number; // page size
  minUsd?: number; // dust filter
  spamFilter?: "off" | "soft" | "hard";
  class?: string; // e.g. "swap_in,swap_out"
};

export async function fetchTransactions(address: string, q: TxQuery) {
  const qs = new URLSearchParams();
  if (q.networks) qs.set("networks", q.networks);
  if (q.from) qs.set("from", q.from);
  if (q.to) qs.set("to", q.to);
  if (q.page) qs.set("page", String(q.page));
  if (q.limit) qs.set("limit", String(q.limit));
  if (q.minUsd != null) qs.set("minUsd", String(q.minUsd));
  if (q.spamFilter) qs.set("spamFilter", q.spamFilter);
  if (q.class) qs.set("class", q.class);

  const url = `/api/transactions/${encodeURIComponent(
    address
  )}?${qs.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || "Failed to fetch transactions");
  }
  const json = (await res.json()) as TxListResponse;

  const rows: TxRow[] = json.data.map((leg) =>
    mapLegToTxRow(leg, json.meta?.gasUsdByTx ?? {})
  );
  const hasNext = json.data.length >= (json.limit ?? 0); // simple next-page heuristic

  return {
    rows,
    page: json.page,
    limit: json.limit,
    hasNext,
    gasMeta: json.meta?.gasUsdByTx ?? {},
  };
}
