// backend/src/services/historical.service.ts

import fetch from "node-fetch";
import type { EvmNetwork } from "../config/networks";
import {
  NATIVE_SENTINEL,
  getPricesAtTimestamp,
  getNativePriceUsd,
} from "./pricing.service";
import { getHoldingsOverview } from "./holdings.service";

const TOKEN_API_BASE =
  process.env.TOKEN_API_BASE_URL ?? "https://token-api.thegraph.com/v1";
const TOKEN_API_JWT = process.env.GRAPH_TOKEN_API_JWT!;

const EEEE = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

type HistPoint = {
  contract?: string | null;
  symbol?: string | null;
  decimals: number;
  timestamp: number;
  amount: string;
};

type HistResponse = HistPoint[];

async function tokenApiGET<T>(
  path: string,
  qs: Record<string, string | number | undefined>
): Promise<{ data: T }> {
  const url = new URL(`${TOKEN_API_BASE}${path}`);
  Object.entries(qs).forEach(([k, v]) => {
    if (v !== undefined) url.searchParams.set(k, String(v));
  });

  const fullUrl = url.toString();
  console.log(`[TokenAPI] GET ${path}`, {
    network: qs.network,
    address: qs.address?.toString().substring(0, 10) + '...',
    interval: qs.interval,
    limit: qs.limit,
  });

  const res = await fetch(fullUrl, {
    headers: { Authorization: `Bearer ${TOKEN_API_JWT}` },
  });

  console.log(`[TokenAPI] Response status: ${res.status} ${res.statusText}`);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[TokenAPI] Error response body:`, text);
    throw new Error(`TokenAPI ${path} ${res.status} ${text}`.trim());
  }

  const json = await res.json();
  const dataLength = Array.isArray(json.data) ? json.data.length : (json.data ? Object.keys(json.data).length : 0);
  console.log(`[TokenAPI] Response data length: ${dataLength}`);

  if (dataLength > 0 && Array.isArray(json.data)) {
    console.log(`[TokenAPI] First data point sample:`, {
      timestamp: json.data[0]?.timestamp,
      contract: json.data[0]?.contract?.substring(0, 10) + '...',
      symbol: json.data[0]?.symbol,
      amount: json.data[0]?.amount?.substring(0, 20) + '...',
    });
  }

  return json as any;
}

function toDecimal(amountStr: string, decimals: number): number {
  try {
    const a = BigInt(amountStr || "0");
    const base = 10n ** BigInt(decimals ?? 0);
    const whole = a / base;
    const frac = a % base;
    return Number(whole) + Number(frac) / Number(base);
  } catch {
    return 0;
  }
}

export type HistoricalPoint = {
  date: string;
  timestamp: number;
  totalValueUsd: number;
  byChain: Record<string, number>;
  byAsset: Record<string, number>;
};

/**
 * Fetch historical portfolio value using weekly intervals (7d)
 */
export async function getHistoricalPortfolioValue(
  network: EvmNetwork,
  address: string,
  days: number = 180
): Promise<HistoricalPoint[]> {
  console.log(
    `[Historical] Fetching data for ${network}:${address} (requested ${days} days)`
  );

  const interval: "1d" | "7d" = "7d";
  const maxLimit = 10;
  const targetWeeks = Math.ceil(days / 7);
  const limit = Math.min(targetWeeks, maxLimit);

  console.log(
    `[Historical] Requesting ${limit} weekly points (interval=7d) for ~${limit * 7} days coverage`
  );

  let allData: HistPoint[] = [];

  try {
    console.log(`[Historical] Calling Token API: network=${network}, address=${address.substring(0, 10)}..., interval=${interval}, limit=${limit}`);
    const { data } = await tokenApiGET<HistResponse>(
      "/evm/balances/historical",
      {
        network,
        address,
        interval,
        limit,
      }
    );

    console.log(`[Historical] API response type:`, typeof data);
    console.log(`[Historical] API response isArray:`, Array.isArray(data));
    if (data && Array.isArray(data)) {
      console.log(`[Historical] API returned array with ${data.length} items`);
      if (data.length > 0) {
        console.log(`[Historical] First item sample:`, {
          timestamp: data[0].timestamp,
          contract: data[0].contract?.substring(0, 10) + "...",
          symbol: data[0].symbol,
          amount: data[0].amount?.substring(0, 20) + "...",
        });
        allData = data;
      } else {
        console.log(`[Historical] API returned empty array - no historical data for this address/network`);
      }
    } else {
      console.log(`[Historical] API returned invalid data format:`, typeof data, data ? Object.keys(data) : 'null/undefined');
    }
  } catch (err: any) {
    console.error(`[Historical] API request failed for ${network}:${address.substring(0, 10)}...`);
    console.error(`[Historical] Error message:`, err.message);
    console.error(`[Historical] Error stack:`, err.stack);
  }

  console.log(
    `[Historical] ${network}:${address} - Total received ${allData.length} data points`
  );

  if (allData.length === 0) {
    console.log(`[Historical] No data available for ${network}:${address}`);
    return [];
  }

  // Group by contract and timestamp
  const byContract = new Map<string, Map<number, HistPoint>>();

  for (const row of allData) {
    const cRaw = (row.contract ?? EEEE).toLowerCase();
    const key = cRaw === EEEE ? NATIVE_SENTINEL : cRaw;

    if (!byContract.has(key)) {
      byContract.set(key, new Map());
    }
    const tsMap = byContract.get(key)!;
    const existing = tsMap.get(row.timestamp);
    if (!existing || parseFloat(row.amount) > parseFloat(existing.amount || "0")) {
      tsMap.set(row.timestamp, row);
    }
  }

  const allTimestamps = new Set<number>();
  byContract.forEach((tsMap) => {
    tsMap.forEach((_, ts) => allTimestamps.add(ts));
  });
  const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);

  console.log(`[Historical] ${network}:${address} - Found ${sortedTimestamps.length} unique timestamps, ${byContract.size} unique contracts`);

  const result: HistoricalPoint[] = [];

  for (const timestamp of sortedTimestamps) {
    const date = new Date(timestamp * 1000);
    const contractsForThisTimestamp: Array<{
      contract: string;
      decimals: number;
      qty: number;
      symbol?: string;
    }> = [];

    byContract.forEach((tsMap, contract) => {
      const point = tsMap.get(timestamp);
      if (point) {
        contractsForThisTimestamp.push({
          contract,
          decimals: point.decimals,
          qty: toDecimal(point.amount || "0", point.decimals),
          symbol: point.symbol ?? undefined,
        });
      }
    });

    if (contractsForThisTimestamp.length === 0) continue;

    const contractAddrs = contractsForThisTimestamp
      .map((c) => c.contract)
      .filter((c) => c !== NATIVE_SENTINEL);

    const priceMap = await getPricesAtTimestamp(
      network,
      contractAddrs,
      timestamp,
      true
    );

    let nativePrice = 0;
    if (contractsForThisTimestamp.some((c) => c.contract === NATIVE_SENTINEL)) {
      nativePrice =
        priceMap.get(`${network}:${NATIVE_SENTINEL}`) ??
        (await getNativePriceUsd(network)) ??
        0;
    }

    const byChain: Record<string, number> = {};
    const byAsset: Record<string, number> = {};
    let totalValueUsd = 0;

    for (const { contract, qty, symbol } of contractsForThisTimestamp) {
      let price = 0;
      if (contract === NATIVE_SENTINEL) {
        price = nativePrice;
      } else {
        price = priceMap.get(`${network}:${contract}`) ?? 0;
      }

      const valueUsd = qty * price;
      totalValueUsd += valueUsd;

      const chain = network;
      byChain[chain] = (byChain[chain] || 0) + valueUsd;

      if (symbol) {
        byAsset[symbol] = (byAsset[symbol] || 0) + valueUsd;
      }
    }

    result.push({
      date: date.toISOString().split("T")[0],
      timestamp,
      totalValueUsd,
      byChain,
      byAsset,
    });
  }

  console.log(`[Historical] ${network}:${address} - Generated ${result.length} historical points`);

  if (result.length > 0) {
    console.log(`[Historical] ${network}:${address} - First point: ${result[0].date} (${result[0].totalValueUsd.toFixed(2)} USD), Last: ${result[result.length - 1].date} (${result[result.length - 1].totalValueUsd.toFixed(2)} USD)`);
  }

  return result.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Get historical portfolio value across multiple networks
 */
export async function getMultiNetworkHistoricalPortfolio(
  networks: EvmNetwork[],
  address: string,
  days: number = 180
): Promise<HistoricalPoint[]> {
  console.log(`[Historical] Starting multi-network fetch for ${address} on networks: ${networks.join(", ")}`);

  const results = await Promise.all(
    networks.map((net) => getHistoricalPortfolioValue(net, address, days))
  );

  console.log(`[Historical] Multi-network fetch complete. Results: ${results.map((r, i) => `${networks[i]}:${r.length} points`).join(", ")}`);

  const byTimestamp = new Map<number, HistoricalPoint>();

  for (const networkResults of results) {
    for (const point of networkResults) {
      const existing = byTimestamp.get(point.timestamp);
      if (existing) {
        existing.totalValueUsd += point.totalValueUsd;
        for (const [chain, value] of Object.entries(point.byChain)) {
          existing.byChain[chain] = (existing.byChain[chain] || 0) + value;
        }
        for (const [asset, value] of Object.entries(point.byAsset)) {
          existing.byAsset[asset] = (existing.byAsset[asset] || 0) + value;
        }
      } else {
        byTimestamp.set(point.timestamp, { ...point });
      }
    }
  }

  let final = Array.from(byTimestamp.values()).sort(
    (a, b) => a.timestamp - b.timestamp
  );

  console.log(`[Historical] Multi-network merge complete: ${final.length} final points`);

  if (final.length > 0) {
    console.log(`[Historical] Date range: ${final[0].date} to ${final[final.length - 1].date}`);
    console.log(`[Historical] Value range: ${final[0].totalValueUsd.toFixed(2)} to ${final[final.length - 1].totalValueUsd.toFixed(2)} USD`);
  } else {
    console.warn(
      `[Historical] WARNING: No historical points generated for ${address}, using fallback`
    );
    // FALLBACK: Generate estimated history from current holdings
    const estimated = await generateEstimatedHistory(networks, address, days);
    if (estimated.length > 0) {
      console.log(`[Historical] Fallback generated ${estimated.length} estimated points`);
      // Mark as estimated
      return estimated.map(p => ({ ...p, _isEstimated: true }));
    }
  }

  // Mark as real data
  return final.map(p => ({ ...p, _isEstimated: false }));
}

/**
 * Generate estimated historical portfolio values based on current holdings
 */
async function generateEstimatedHistory(
  networks: EvmNetwork[],
  address: string,
  days: number = 180
): Promise<HistoricalPoint[]> {
  console.log(`[Historical] Fallback: Generating estimated history from current holdings`);
  
  try {
    const currentHoldings = await getHoldingsOverview(
      address,
      networks,
      false,
      {
        minUsd: 0,
        includeZero: false,
        spamFilter: "soft",
      }
    );

    if (!currentHoldings.holdings || currentHoldings.holdings.length === 0) {
      console.log(`[Historical] No current holdings found for fallback`);
      return [];
    }

    const currentTotalValue = currentHoldings.kpis.totalValueUsd || 0;
    
    if (currentTotalValue === 0) {
      console.log(`[Historical] Current portfolio value is 0, cannot generate fallback`);
      return [];
    }

    console.log(`[Historical] Current portfolio value: ${currentTotalValue.toFixed(2)} USD`);
    console.log(`[Historical] Generating ${Math.ceil(days / 7)} weekly points`);

    const now = Math.floor(Date.now() / 1000);
    const weekInSeconds = 7 * 24 * 60 * 60;
    const numWeeks = Math.ceil(days / 7);
    const points: HistoricalPoint[] = [];

    const volatility = 0.08;
    const valuePoints: number[] = [currentTotalValue];
    
    for (let i = 1; i <= numWeeks; i++) {
      const seed = (now - (i * weekInSeconds)) % 1000 / 1000;
      const change = (seed - 0.5) * volatility * 2;
      const prevValue = valuePoints[i - 1] / (1 + change);
      const bounded = Math.max(currentTotalValue * 0.2, Math.min(currentTotalValue * 2, prevValue));
      valuePoints.push(bounded);
    }
    
    valuePoints.reverse();

    for (let week = 0; week <= numWeeks; week++) {
      const timestamp = now - ((numWeeks - week) * weekInSeconds);
      const date = new Date(timestamp * 1000);
      const weekValue = valuePoints[week] || currentTotalValue;

      const byChain: Record<string, number> = {};
      const byAsset: Record<string, number> = {};

      for (const holding of currentHoldings.holdings) {
        const proportion = (holding.valueUsd || 0) / currentTotalValue;
        const weekAssetValue = weekValue * proportion;
        
        const chain = holding.chain || "unknown";
        byChain[chain] = (byChain[chain] || 0) + weekAssetValue;
        
        if (holding.symbol) {
          byAsset[holding.symbol] = (byAsset[holding.symbol] || 0) + weekAssetValue;
        }
      }

      points.push({
        date: date.toISOString().split("T")[0],
        timestamp,
        totalValueUsd: weekValue,
        byChain,
        byAsset,
      });
    }

    points.sort((a, b) => a.timestamp - b.timestamp);

    console.log(`[Historical] Generated ${points.length} estimated historical points`);
    console.log(`[Historical] Estimated value range: ${points[0].totalValueUsd.toFixed(2)} to ${points[points.length - 1].totalValueUsd.toFixed(2)} USD`);

    return points;
  } catch (err: any) {
    console.error(`[Historical] Failed to generate estimated history:`, err.message);
    return [];
  }
}

