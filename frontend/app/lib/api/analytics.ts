export type HistoricalPoint = {
  date: string;
  timestamp: number;
  totalValueUsd: number;
  byChain: Record<string, number>;
  byAsset: Record<string, number>;
};

export type HistoricalResponse = {
  address: string;
  networks: string[];
  days: number;
  data: HistoricalPoint[];
  isEstimated?: boolean;
  warnings?: {
    defiLlamaRateLimited?: boolean;
    defiLlamaRetryAfterMs?: number;
  };
};

export async function fetchHistoricalData(
  address: string,
  options?: {
    networks?: string;
    days?: number;
    useFallback?: boolean;
  }
): Promise<HistoricalResponse> {
  const qs = new URLSearchParams();
  if (options?.networks) qs.set("networks", options.networks);
  if (options?.days) qs.set("days", String(options.days));
  if (options?.useFallback) qs.set("useFallback", "true");

  const url = `/api/analytics/historical/${encodeURIComponent(
    address
  )}?${qs.toString()}`;

  console.log(`[API Analytics] Fetching: ${url}`);

  const res = await fetch(url);
  console.log(`[API Analytics] Response status: ${res.status} ${res.statusText}`);

  if (!res.ok) {
    const msg = await res.text();
    console.error(`[API Analytics] Error response:`, msg);
    throw new Error(msg || "Failed to fetch historical data");
  }

  const json = await res.json();
  console.log(`[API Analytics] Response received:`, {
    address: json.address,
    networks: json.networks,
    days: json.days,
    dataLength: json.data?.length || 0,
    useFallback: options?.useFallback,
  });

  return json;
}

