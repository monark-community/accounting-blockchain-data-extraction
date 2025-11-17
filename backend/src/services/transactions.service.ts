// backend/src/services/transactions.service.ts

import {
  fetchFungibleTransfersPage,
  fetchNftTransfersPage,
} from "./tx.sources.pinax";
import {
  normalizeFungibleTransfer,
  normalizeNftTransfer,
} from "./tx.normalize";
import { fetchReceiptsBatch } from "./tx.enrich.rpc";
import { parseNetworks, type EvmNetwork } from "../config/networks";
import type {
  NormalizedLegRow,
  PageParams,
  TxCursorPosition,
} from "../types/transactions";
import { quoteTokenUsdAtTs, quoteNativeUsdAtTs } from "./tx.pricing";
import { classifyLegs } from "./tx.classify";

type ListParams = {
  address: `0x${string}`;
  networks?: string | string[];
  from?: string; // ISO datetime or epoch seconds (string ok)
  to?: string; // ISO datetime or epoch seconds (string ok)
  page?: number; // default 1
  limit?: number; // default 20
  cursor?: TxCursorPosition | null;
};

const ZERO_ADDRESS: `0x${string}` =
  "0x0000000000000000000000000000000000000000";
const NATIVE_SYMBOL: Record<EvmNetwork, string> = {
  mainnet: "ETH",
  bsc: "BNB",
  polygon: "MATIC",
  optimism: "ETH",
  base: "ETH",
  "arbitrum-one": "ETH",
  avalanche: "AVAX",
  unichain: "ETH",
};
const TX_FETCH_WINDOW_CAP = Number(process.env.TX_FETCH_WINDOW_CAP ?? 80);
const PRICING_BATCH_SIZE = Number(process.env.PRICING_BATCH_SIZE ?? 50); // Increased to 50 for better throughput (DeFiLlama can handle this)
const LOGS_DEBUG =
  String(process.env.LOGS_DEBUG ?? "false").toLowerCase() === "true";
const debugLog = (...args: any[]) => {
  if (LOGS_DEBUG) {
    console.log("[transactions.service]", ...args);
  }
};

function nativeSymbolFor(network: EvmNetwork): string {
  return NATIVE_SYMBOL[network] ?? "ETH";
}

function toEpochSeconds(v?: string): number | undefined {
  if (!v) return undefined;
  // Accept epoch or ISO
  if (/^\d+$/.test(v)) return Number(v);
  const t = Date.parse(v);
  return Number.isNaN(t) ? undefined : Math.floor(t / 1000);
}

function sortLegs(a: NormalizedLegRow, b: NormalizedLegRow): number {
  if (a.timestamp !== b.timestamp) return b.timestamp - a.timestamp;
  if (a.blockNumber !== b.blockNumber) return b.blockNumber - a.blockNumber;
  if (a.txHash !== b.txHash) return a.txHash < b.txHash ? 1 : -1;
  const ai = a.logIndex ?? 0;
  const bi = b.logIndex ?? 0;
  return bi - ai;
}

/**
 * Process items in batches to limit concurrency and avoid rate limits
 */
async function processInBatches<T, R>(
  items: T[],
  batchSize: number,
  processor: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }
  return results;
}

/** Main listing function: normalized legs + USD pricing + gas USD meta. */
export async function listTransactionLegs(
  params: ListParams
): Promise<NormalizedLegRow[]> {
  const page = Math.max(1, params.page ?? 1);
  const cursor = params.cursor ?? null;
  const defaultLimit = Number(process.env.TX_DEFAULT_LIMIT ?? 20);
  const maxLimit = Number(process.env.TX_MAX_LIMIT ?? 40);
  const pageSize = Math.min(
    Math.max(1, params.limit ?? defaultLimit),
    maxLimit
  );
  const windowMultiplier = cursor ? 3 : page;
  const requestedWindow = pageSize * windowMultiplier;
  const fetchWindow = Math.max(
    pageSize,
    Math.min(requestedWindow, TX_FETCH_WINDOW_CAP)
  );
  const wallet = params.address.toLowerCase() as `0x${string}`;

  const nets: EvmNetwork[] = parseNetworks(params.networks ?? undefined);
  const fromTime = toEpochSeconds(params.from);
  const toTimeRaw = toEpochSeconds(params.to);
  const cursorTime = cursor?.timestamp;
  const toTime =
    cursorTime != null && toTimeRaw != null
      ? Math.min(cursorTime, toTimeRaw)
      : cursorTime ?? toTimeRaw;

  const serviceStartTime = process.hrtime.bigint();

  // 1) fetch + normalize per network (limit cross-network concurrency)
  const maxConc = Math.max(
    1,
    Number(process.env.NETWORK_FETCH_CONCURRENCY ?? 2)
  );
  const queue: EvmNetwork[] = [...nets];
  const chunksArr: NormalizedLegRow[][] = [];

  async function runForNetwork(network: EvmNetwork) {
    const networkStartTime = process.hrtime.bigint();

    const basePage: PageParams = {
      network,
      address: wallet,
      fromTime,
      toTime,
      page: 1,
      limit: fetchWindow,
    };

    const fetchStartTime = process.hrtime.bigint();
    const [fungible, nft] = await Promise.all([
      fetchFungibleTransfersPage(basePage),
      fetchNftTransfersPage(basePage),
    ]);
    const fetchTime = Number(process.hrtime.bigint() - fetchStartTime) / 1_000_000;

    const legsF = fungible.map((r) =>
      normalizeFungibleTransfer(r, basePage.address, network)
    );
    const legsN = nft.map((r) =>
      normalizeNftTransfer(r, basePage.address, network)
    );
    const legs = [...legsF, ...legsN];

    // 2) receipts per network (unique tx hashes in this page window)
    const uniqTx = Array.from(new Set(legs.map((l) => l.txHash)));
    const receiptsStartTime = process.hrtime.bigint();
    
    // Fetch receipts defensively — failures should not break the listing.
    let receipts: Record<
      string,
      {
        status: "success" | "reverted" | "unknown";
        gasUsed: number;
        effectiveGasPrice: number;
      }
    >;
    try {
      receipts = await fetchReceiptsBatch(network, uniqTx);
    } catch (e: any) {
      console.error(`[Backend] Receipts fetch failed for ${network}:`, e?.message || String(e));
      receipts = {};
    }

    // 3) fill status
    for (const l of legs) {
      const rc = receipts[l.txHash];
      if (rc) l.status = rc.status;
    }

    // 4) pricing: per-leg USD at timestamp (pre-warm unique keys in batches to avoid rate limits)
    const pricingStartTime = process.hrtime.bigint();
    const uniquePriceKeys = new Map<
      string,
      { contract?: string; ts: number; legIndices: number[] }
    >();
    
    // Group legs by price key to avoid duplicate lookups
    legs.forEach((l, idx) => {
      const key = `${(l.asset.contract ?? "native").toLowerCase()}@${l.timestamp}`;
      if (!uniquePriceKeys.has(key)) {
        uniquePriceKeys.set(key, {
          contract: l.asset.contract,
          ts: l.timestamp,
          legIndices: [],
        });
      }
      uniquePriceKeys.get(key)!.legIndices.push(idx);
    });
    
    // Process price requests in batches to avoid overwhelming DeFiLlama API
    const priceResults = await processInBatches(
      Array.from(uniquePriceKeys.entries()),
      PRICING_BATCH_SIZE,
      async ([key, { contract, ts }]) => {
        const price = await quoteTokenUsdAtTs(network, contract, ts);
        return { key, price };
      }
    );
    
    // Build price map for fast lookup
    const priceMap = new Map<string, number | undefined>();
    for (const { key, price } of priceResults) {
      priceMap.set(key, price);
    }
    
    // Assign prices from map (instant lookup instead of sequential calls)
    for (const [key, { legIndices }] of uniquePriceKeys.entries()) {
      const px = priceMap.get(key);
      if (typeof px === "number") {
        for (const idx of legIndices) {
          legs[idx].amountUsdAtTx = legs[idx].amount * px;
        }
      }
    }
    const pricingTime = Number(process.hrtime.bigint() - pricingStartTime) / 1_000_000;
    
    // Log pricing time if significant (>1s) - debug only
    if (pricingTime > 1000) {
      debugLog("pricing:time", {
        network,
        uniqueKeys: uniquePriceKeys.size,
        seconds: Number((pricingTime / 1000).toFixed(1)),
      });
    }

    // 4b) Step 3 — Classify legs per transaction (swap, transfer, nft_buy/sell, …)
    const byTx = new Map<string, NormalizedLegRow[]>();
    for (const leg of legs) {
      if (!byTx.has(leg.txHash)) byTx.set(leg.txHash, []);
      byTx.get(leg.txHash)!.push(leg);
    }
    for (const txLegs of byTx.values()) {
      classifyLegs(txLegs);
    }

    // 5) per-tx gas USD … (keep your existing gas code below)
    const gasUsdByTx: Record<string, number> = {};
    const nativeUsdCache: Record<number, number | undefined> = {};
    for (const [txHash, rc] of Object.entries(receipts)) {
      const sampleLeg = legs.find((x) => x.txHash === txHash);
      if (!sampleLeg) continue;
      const ts = sampleLeg.timestamp;

      const tsForPrice = Math.min(ts, Math.floor(Date.now() / 1000));
      let px = nativeUsdCache[tsForPrice];
      if (px === undefined) {
        px = await quoteNativeUsdAtTs(network, tsForPrice);
        nativeUsdCache[tsForPrice] = px;
      }

      const ethSpent = (rc.gasUsed * rc.effectiveGasPrice) / 1e18;
      if (ethSpent <= 0) continue;

      const gasUsdValue = typeof px === "number" ? Number(ethSpent * px) : null;
      if (gasUsdValue !== null) {
        gasUsdByTx[txHash] = gasUsdValue;
      }

      const weiSpent = (
        BigInt(rc.gasUsed ?? 0) * BigInt(rc.effectiveGasPrice ?? 0)
      ).toString();
      legs.push({
        txHash: txHash as `0x${string}`,
        blockNumber: sampleLeg.blockNumber,
        timestamp: sampleLeg.timestamp,
        network,
        from: wallet,
        to: ZERO_ADDRESS,
        direction: "out",
        kind: "native",
        asset: {
          contract: undefined,
          symbol: nativeSymbolFor(network),
          decimals: 18,
          tokenId: null,
        },
        amountRaw: weiSpent,
        amount: ethSpent,
        amountUsdAtTx: gasUsdValue ?? undefined,
        status: rc.status,
        logIndex: Number.MAX_SAFE_INTEGER,
        source: "rpc",
        class: "gas",
      });
    }
    const networkTime = Number(process.hrtime.bigint() - networkStartTime) / 1_000_000;
    // Attach meta on this chunk
    (legs as any)._gasUsdByTx = gasUsdByTx;

    return legs;
  }

  async function worker() {
    while (queue.length) {
      const net = queue.shift()!;
      const legs = await runForNetwork(net);
      chunksArr.push(legs);
    }
  }

  const workers = Array.from({ length: Math.min(maxConc, queue.length) }, () =>
    worker()
  );
  await Promise.all(workers);
  const chunks = chunksArr;
  const all = chunks.flat();

  // collect gas meta from chunks (each chunk may have _gasUsdByTx)
  const gasMeta: Record<string, number> = {};
  for (const ch of chunks) {
    const m = (ch as any)._gasUsdByTx as Record<string, number> | undefined;
    if (m) Object.assign(gasMeta, m);
  }

  all.sort(sortLegs);
  
  // Return both legs and meta so the route can include it
  (all as any)._gasUsdByTx = gasMeta;
  
  return all;
}
