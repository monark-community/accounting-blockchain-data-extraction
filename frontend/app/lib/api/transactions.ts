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
  cursor?: string | null;
};

export async function fetchTransactions(address: string, q: TxQuery, retryCount = 0) {
  const fetchStartTime = performance.now();
  const qs = new URLSearchParams();
  if (q.networks) qs.set("networks", q.networks);
  if (q.from) qs.set("from", q.from);
  if (q.to) qs.set("to", q.to);
  if (q.page) qs.set("page", String(q.page));
  if (q.limit) qs.set("limit", String(q.limit));
  if (q.minUsd != null) qs.set("minUsd", String(q.minUsd));
  if (q.spamFilter) qs.set("spamFilter", q.spamFilter);
  if (q.class) qs.set("class", q.class);
  if (q.cursor) qs.set("cursor", q.cursor);

  const url = `/api/transactions/${encodeURIComponent(
    address
  )}?${qs.toString()}`;

  const networkStartTime = performance.now();
  
  // Add timeout to prevent hanging requests (240 seconds = 4 minutes max)
  // Increased from 120s to allow backend more time for multi-network requests
  const REQUEST_TIMEOUT_MS = 240000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  
  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    // Retry on network errors (ECONNRESET, socket hang up, timeout)
    const isNetworkError = 
      error.name === 'AbortError' ||
      error.message?.includes('socket hang up') ||
      error.message?.includes('ECONNRESET') ||
      error.message?.includes('Failed to fetch') ||
      error.code === 'ECONNRESET';
    
    const maxRetries = 2;
    const baseDelay = 3000; // 3 seconds
    
    if (isNetworkError && retryCount < maxRetries) {
      const delay = baseDelay * Math.pow(2, retryCount); // Exponential backoff: 3s, 6s
      console.log(`[Transactions] Retrying (${retryCount + 1}/${maxRetries}) after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchTransactions(address, q, retryCount + 1);
    }
    
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout: The server took too long to respond (>${REQUEST_TIMEOUT_MS / 1000}s)`);
    }
    throw error;
  }
  
  const networkTime = performance.now() - networkStartTime;

  if (!res.ok) {
    const msg = await res.text();
    const totalTime = performance.now() - fetchStartTime;
    console.error(`[Transactions] ❌ HTTP ${res.status} (${(totalTime / 1000).toFixed(1)}s):`, msg.slice(0, 100));
    throw new Error(msg || "Failed to fetch transactions");
  }

  const json = (await res.json()) as TxListResponse;

  const rows: TxRow[] = json.data.map((leg) =>
    mapLegToTxRow(leg, json.meta?.gasUsdByTx ?? {})
  );
  
  const hasNext =
    typeof json.hasNext === "boolean"
      ? json.hasNext
      : json.data.length >= (json.limit ?? 0);

  const totalTime = performance.now() - fetchStartTime;
  
  // Single summary log with key timings
  if (process.env.NODE_ENV !== 'production') {
    const hasNextFlag =
      typeof json.hasNext === "boolean" ? (json.hasNext ? "yes" : "no") : "unknown";
    const cursorFlag = json.nextCursor ? "yes" : "no";
    console.log(
      `[Transactions] ✅ Page ${json.page} | ${rows.length} rows | hasNext=${hasNextFlag} | cursor=${cursorFlag} | Network: ${(networkTime / 1000).toFixed(1)}s | Total: ${(totalTime / 1000).toFixed(1)}s`
    );
  }

  return {
    rows,
    page: json.page,
    limit: json.limit,
    hasNext,
    gasMeta: json.meta?.gasUsdByTx ?? {},
    nextCursor: json.nextCursor ?? null,
    warnings: json.warnings,
  };
}
