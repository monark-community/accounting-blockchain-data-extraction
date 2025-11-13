// backend/src/services/historical.service.ts

import fetch from "node-fetch";
import type { EvmNetwork } from "../config/networks";
import {
  NATIVE_SENTINEL,
  getPricesAtTimestamp,
  getNativePriceUsd,
} from "./pricing.service";
import { getHoldingsOverview } from "./holdings.service";
import {
  isAnkrConfigured,
  getAnkrHistoricalPortfolio,
} from "./ankr.service";

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

// Toggle verbose pricing/debug logs. When false only concise errors are printed.
const LOGS_DEBUG = (process.env.LOGS_DEBUG ?? "false") === "true";
function dbg(...args: any[]) {
  if (LOGS_DEBUG) console.log(...args);
}

async function tokenApiGET<T>(
  path: string,
  qs: Record<string, string | number | undefined>
): Promise<{ data: T }> {
  const url = new URL(`${TOKEN_API_BASE}${path}`);
  Object.entries(qs).forEach(([k, v]) => {
    if (v !== undefined) url.searchParams.set(k, String(v));
  });

  const fullUrl = url.toString();
  dbg(`[TokenAPI] GET ${path}`, {
    network: qs.network,
    address: qs.address?.toString().substring(0, 10) + "...",
    interval: qs.interval,
    limit: qs.limit,
  });

  const res = await fetch(fullUrl, {
    headers: { Authorization: `Bearer ${TOKEN_API_JWT}` },
  });

  dbg(`[TokenAPI] Response status: ${res.status} ${res.statusText}`);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    dbg(`[TokenAPI] Error response body:`, text);
    throw new Error(`TokenAPI ${path} ${res.status} ${text}`.trim());
  }

  const json = await res.json();
  const dataLength = Array.isArray(json.data)
    ? json.data.length
    : json.data
    ? Object.keys(json.data).length
    : 0;
  dbg(`[TokenAPI] Response data length: ${dataLength}`);

  if (dataLength > 0 && Array.isArray(json.data)) {
    dbg(`[TokenAPI] First data point sample:`, {
      timestamp: json.data[0]?.timestamp,
      contract: json.data[0]?.contract?.substring(0, 10) + "...",
      symbol: json.data[0]?.symbol,
      amount: json.data[0]?.amount?.substring(0, 20) + "...",
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
 * Fetch historical portfolio value using Ankr API (no 10-point limit!)
 * Falls back to The Graph API if Ankr fails or is not configured
 */
export async function getHistoricalPortfolioValue(
  network: EvmNetwork,
  address: string,
  days: number = 180
): Promise<HistoricalPoint[]> {
  dbg(
    `[Historical] Fetching data for ${network}:${address} (requested ${days} days)`
  );

  // Try Ankr first (supports unlimited historical data with 500M free credits/month)
  const useAnkr = isAnkrConfigured();
  
  if (useAnkr) {
    try {
      dbg(`[Historical] Using Ankr API for ${network}:${address}`);
      return await getHistoricalPortfolioValueAnkr(network, address, days);
    } catch (err: any) {
      console.warn(
        `[Historical] Ankr API failed for ${network}:${address}, falling back to The Graph:`,
        err.message
      );
      // Fall through to The Graph fallback
    }
  } else {
    dbg(`[Historical] ANKR_API_KEY not set, using The Graph API (limited to 10 points)`);
  }

  // Fallback to The Graph API (original implementation, limited to 10 points)
  return await getHistoricalPortfolioValueTheGraph(network, address, days);
}

/**
 * Fetch historical portfolio value using Ankr API
 * This method has no arbitrary limits and 500M free credits/month (vs Covalent's 100k)
 */
async function getHistoricalPortfolioValueAnkr(
  network: EvmNetwork,
  address: string,
  days: number = 180
): Promise<HistoricalPoint[]> {
  const months = Math.ceil(days / 30);
  
  dbg(
    `[Historical/Ankr] Fetching ${months} months of data for ${network}:${address.substring(0, 10)}...`
  );

  // Get historical portfolio data from Ankr
  const ankrData = await getAnkrHistoricalPortfolio(network, address, months);

  dbg(
    `[Historical/Ankr] Retrieved ${ankrData.length} monthly data points`
  );

  if (ankrData.length === 0) {
    dbg(`[Historical/Ankr] No historical data found for ${network}:${address}`);
    return [];
  }

  // Convert Ankr data to HistoricalPoint format
  const result: HistoricalPoint[] = ankrData.map(point => ({
    date: point.date,
    timestamp: point.timestamp,
    totalValueUsd: point.totalValueUsd,
    byChain: {
      [network]: point.totalValueUsd,
    },
    byAsset: {}, // Ankr doesn't provide per-asset breakdown in free tier
  }));

  dbg(
    `[Historical/Ankr] Generated ${result.length} historical points for ${network}:${address}`
  );

  if (result.length > 0) {
    dbg(
      `[Historical/Ankr] ${network}:${address} - First point: ${
        result[0].date
      } ($${result[0].totalValueUsd.toFixed(2)}), Last: ${
        result[result.length - 1].date
      } ($${result[result.length - 1].totalValueUsd.toFixed(2)})`
    );
  }

  return result.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Original implementation using The Graph API
 * Limited to 10 data points maximum
 */
async function getHistoricalPortfolioValueTheGraph(
  network: EvmNetwork,
  address: string,
  days: number = 180
): Promise<HistoricalPoint[]> {
  dbg(
    `[Historical/TheGraph] Fetching data for ${network}:${address} (requested ${days} days, limited to 10 points)`
  );

  const interval: "1d" | "7d" = "7d";
  const maxLimit = 10;
  const targetWeeks = Math.ceil(days / 7);
  const limit = Math.min(targetWeeks, maxLimit);

  dbg(
    `[Historical/TheGraph] Requesting ${limit} weekly points (interval=7d) for ~${
      limit * 7
    } days coverage`
  );

  let allData: HistPoint[] = [];

  try {
    dbg(
      `[Historical/TheGraph] Calling Token API: network=${network}, address=${address.substring(
        0,
        10
      )}..., interval=${interval}, limit=${limit}`
    );
    const { data } = await tokenApiGET<HistResponse>(
      "/evm/balances/historical",
      {
        network,
        address,
        interval,
        limit,
      }
    );

    dbg(`[Historical/TheGraph] API response type:`, typeof data);
    dbg(`[Historical/TheGraph] API response isArray:`, Array.isArray(data));
    if (data && Array.isArray(data)) {
      dbg(`[Historical/TheGraph] API returned array with ${data.length} items`);
      if (data.length > 0) {
        dbg(`[Historical/TheGraph] First item sample:`, {
          timestamp: data[0].timestamp,
          contract: data[0].contract?.substring(0, 10) + "...",
          symbol: data[0].symbol,
          amount: data[0].amount?.substring(0, 20) + "...",
        });
        allData = data;
      } else {
        dbg(
          `[Historical/TheGraph] API returned empty array - no historical data for this address/network`
        );
      }
    } else {
      dbg(
        `[Historical/TheGraph] API returned invalid data format:`,
        typeof data,
        data ? Object.keys(data) : "null/undefined"
      );
    }
  } catch (err: any) {
    dbg(
      `[Historical/TheGraph] API request failed for ${network}:${address.substring(
        0,
        10
      )}...`
    );
    dbg(`[Historical/TheGraph] Error message:`, err.message);
    dbg(`[Historical/TheGraph] Error stack:`, err.stack);
  }

  dbg(
    `[Historical/TheGraph] ${network}:${address} - Total received ${allData.length} data points`
  );

  if (allData.length === 0) {
    dbg(`[Historical/TheGraph] No data available for ${network}:${address}`);
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
    if (
      !existing ||
      parseFloat(row.amount) > parseFloat(existing.amount || "0")
    ) {
      tsMap.set(row.timestamp, row);
    }
  }

  const allTimestamps = new Set<number>();
  byContract.forEach((tsMap) => {
    tsMap.forEach((_, ts) => allTimestamps.add(ts));
  });
  const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);

  dbg(
    `[Historical/TheGraph] ${network}:${address} - Found ${sortedTimestamps.length} unique timestamps, ${byContract.size} unique contracts`
  );

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

  dbg(
    `[Historical/TheGraph] ${network}:${address} - Generated ${result.length} historical points`
  );

  if (result.length > 0) {
    dbg(
      `[Historical/TheGraph] ${network}:${address} - First point: ${
        result[0].date
      } (${result[0].totalValueUsd.toFixed(2)} USD), Last: ${
        result[result.length - 1].date
      } (${result[result.length - 1].totalValueUsd.toFixed(2)} USD)`
    );
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
  dbg(
    `[Historical] Starting multi-network fetch for ${address} on networks: ${networks.join(
      ", "
    )}`
  );

  const results = await Promise.all(
    networks.map((net) => getHistoricalPortfolioValue(net, address, days))
  );

  dbg(
    `[Historical] Multi-network fetch complete. Results: ${results
      .map((r, i) => `${networks[i]}:${r.length} points`)
      .join(", ")}`
  );

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

  dbg(
    `[Historical] Multi-network merge complete: ${final.length} final points`
  );

  if (final.length > 0) {
    dbg(
      `[Historical] Date range: ${final[0].date} to ${
        final[final.length - 1].date
      }`
    );
    dbg(
      `[Historical] Value range: ${final[0].totalValueUsd.toFixed(
        2
      )} to ${final[final.length - 1].totalValueUsd.toFixed(2)} USD`
    );
  } else {
    dbg(
      `[Historical] WARNING: No historical points generated for ${address}, using fallback`
    );
    // FALLBACK: Generate estimated history from current holdings
    const estimated = await generateEstimatedHistory(networks, address, days);
    if (estimated.length > 0) {
      dbg(
        `[Historical] Fallback generated ${estimated.length} estimated points`
      );
      // Mark as estimated
      return estimated.map((p) => ({ ...p, _isEstimated: true }));
    }
  }

  // Mark as real data
  return final.map((p) => ({ ...p, _isEstimated: false }));
}

/**
 * Generate estimated historical portfolio values based on current holdings
 */
async function generateEstimatedHistory(
  networks: EvmNetwork[],
  address: string,
  days: number = 180
): Promise<HistoricalPoint[]> {
  dbg(
    `[Historical] Fallback: Generating estimated history from current holdings`
  );

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
      dbg(`[Historical] No current holdings found for fallback`);
      return [];
    }

    const currentTotalValue = currentHoldings.kpis.totalValueUsd || 0;

    if (currentTotalValue === 0) {
      dbg(
        `[Historical] Current portfolio value is 0, cannot generate fallback`
      );
      return [];
    }

    dbg(
      `[Historical] Current portfolio value: ${currentTotalValue.toFixed(
        2
      )} USD`
    );
    dbg(`[Historical] Generating ${Math.ceil(days / 7)} weekly points`);

    const now = Math.floor(Date.now() / 1000);
    const weekInSeconds = 7 * 24 * 60 * 60;
    const numWeeks = Math.ceil(days / 7);
    const points: HistoricalPoint[] = [];

    const volatility = 0.08;
    const valuePoints: number[] = [currentTotalValue];

    for (let i = 1; i <= numWeeks; i++) {
      const seed = ((now - i * weekInSeconds) % 1000) / 1000;
      const change = (seed - 0.5) * volatility * 2;
      const prevValue = valuePoints[i - 1] / (1 + change);
      const bounded = Math.max(
        currentTotalValue * 0.2,
        Math.min(currentTotalValue * 2, prevValue)
      );
      valuePoints.push(bounded);
    }

    valuePoints.reverse();

    for (let week = 0; week <= numWeeks; week++) {
      const timestamp = now - (numWeeks - week) * weekInSeconds;
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
          byAsset[holding.symbol] =
            (byAsset[holding.symbol] || 0) + weekAssetValue;
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

    dbg(`[Historical] Generated ${points.length} estimated historical points`);
    dbg(
      `[Historical] Estimated value range: ${points[0].totalValueUsd.toFixed(
        2
      )} to ${points[points.length - 1].totalValueUsd.toFixed(2)} USD`
    );

    return points;
  } catch (err: any) {
    dbg(`[Historical] Failed to generate estimated history:`, err.message);
    return [];
  }
}
