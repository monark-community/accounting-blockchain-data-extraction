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
import type { NormalizedLegRow, PageParams } from "../types/transactions";
import { quoteTokenUsdAtTs, quoteNativeUsdAtTs } from "./tx.pricing";
import { classifyLegs } from "./tx.classify";
import { getTransactionCountFromCovalent } from "./tx.count.covalent";

type ListParams = {
  address: `0x${string}`;
  networks?: string | string[];
  from?: string; // ISO datetime or epoch seconds (string ok)
  to?: string; // ISO datetime or epoch seconds (string ok)
  page?: number; // default 1
  limit?: number; // default 20
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
  if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
  if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
  if (a.txHash !== b.txHash) return a.txHash < b.txHash ? -1 : 1;
  const ai = a.logIndex ?? 0,
    bi = b.logIndex ?? 0;
  return ai - bi;
}

/** Main listing function: normalized legs + USD pricing + gas USD meta. */
export async function listTransactionLegs(
  params: ListParams
): Promise<NormalizedLegRow[]> {
  const page = Math.max(1, params.page ?? 1);
  const defaultLimit = Number(process.env.TX_DEFAULT_LIMIT ?? 20);
  const maxLimit = Number(process.env.TX_MAX_LIMIT ?? 40);
  const pageSize = Math.min(
    Math.max(1, params.limit ?? defaultLimit),
    maxLimit
  );
  const requestedWindow = pageSize * page;
  const fetchWindow = Math.max(
    pageSize,
    Math.min(requestedWindow, TX_FETCH_WINDOW_CAP)
  );
  const wallet = params.address.toLowerCase() as `0x${string}`;

  const nets: EvmNetwork[] = parseNetworks(params.networks ?? undefined);
  const fromTime = toEpochSeconds(params.from);
  const toTime = toEpochSeconds(params.to);

  debugLog("list:start", {
    address: wallet,
    page,
    pageSize,
    fetchWindow,
    networks: nets,
    fromTime,
    toTime,
  });

  // 1) fetch + normalize per network (limit cross-network concurrency)
  const maxConc = Math.max(
    1,
    Number(process.env.NETWORK_FETCH_CONCURRENCY ?? 2)
  );
  const queue: EvmNetwork[] = [...nets];
  const chunksArr: NormalizedLegRow[][] = [];

  async function runForNetwork(network: EvmNetwork) {
    const basePage: PageParams = {
      network,
      address: wallet,
      fromTime,
      toTime,
      page: 1,
      limit: fetchWindow,
    };

    const [fungible, nft] = await Promise.all([
      fetchFungibleTransfersPage(basePage),
      fetchNftTransfersPage(basePage),
    ]);
    debugLog("network:fetched", {
      network,
      fungibleCount: fungible.length,
      nftCount: nft.length,
      fetchWindow,
    });

    const legsF = fungible.map((r) =>
      normalizeFungibleTransfer(r, basePage.address, network)
    );
    const legsN = nft.map((r) =>
      normalizeNftTransfer(r, basePage.address, network)
    );
    const legs = [...legsF, ...legsN];

    // 2) receipts per network (unique tx hashes in this page window)
    const uniqTx = Array.from(new Set(legs.map((l) => l.txHash)));
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
      console.error(`Receipts fetch failed for ${network}:`, e?.message || e);
      receipts = {};
    }

    // 3) fill status
    for (const l of legs) {
      const rc = receipts[l.txHash];
      if (rc) l.status = rc.status;
    }
    debugLog("network:receipts", {
      network,
      uniqueTx: uniqTx.length,
      receipts: Object.keys(receipts).length,
    });

    // 4) pricing: per-leg USD at timestamp (pre-warm unique keys in parallel)
    const uniquePriceKeys = new Map<
      string,
      { contract?: string; ts: number }
    >();
    for (const l of legs) {
      uniquePriceKeys.set(
        `${(l.asset.contract ?? "native").toLowerCase()}@${l.timestamp}`,
        {
          contract: l.asset.contract,
          ts: l.timestamp,
        }
      );
    }
    await Promise.all(
      Array.from(uniquePriceKeys.values()).map(({ contract, ts }) =>
        quoteTokenUsdAtTs(network, contract, ts)
      )
    );
    // assign from warmed cache
    for (const l of legs) {
      const px = await quoteTokenUsdAtTs(
        network,
        l.asset.contract,
        l.timestamp
      );
      if (typeof px === "number") l.amountUsdAtTx = l.amount * px;
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
        txHash,
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
        amountUsdAtTx: gasUsdValue,
        status: rc.status,
        logIndex: Number.MAX_SAFE_INTEGER,
        source: "rpc",
        class: "gas",
      });
    }
    debugLog("network:gas", {
      network,
      gasEntries: Object.keys(gasUsdByTx).length,
      syntheticGasLegs: legs.filter((l) => l.class === "gas").length,
    });
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
  debugLog("list:complete", {
    address: wallet,
    totalLegs: all.length,
    networksProcessed: chunks.length,
    gasMetaEntries: Object.keys(gasMeta).length,
  });
  return all;
}

/**
 * Get total transaction count using Covalent API
 * Returns null if Covalent is not available or fails
 * Note: This does not account for filters (from/to, minUsd, spamFilter, class)
 * as Covalent API doesn't support these filters. The count is the total raw count.
 */
export async function getTransactionCountTotal(
  params: ListParams
): Promise<number | null> {
  const nets: EvmNetwork[] = parseNetworks(params.networks ?? undefined);

  // Get count from Covalent for each network and sum them (limit concurrency)
  const maxConc = Math.max(
    1,
    Number(process.env.NETWORK_FETCH_CONCURRENCY ?? 2)
  );
  const queue = [...nets];
  const results: Array<number | null> = new Array(nets.length).fill(null);

  async function worker() {
    while (queue.length) {
      const network = queue.shift()!;
      const idx = nets.indexOf(network);
      try {
        results[idx] = await getTransactionCountFromCovalent(
          params.address,
          network
        );
      } catch (error: any) {
        if (process.env.NODE_ENV !== "production") {
          console.error(
            `[Transactions] Failed to get count from Covalent for ${network}:`,
            error?.message || error
          );
        }
        results[idx] = null;
      }
    }
  }

  const workers = Array.from({ length: Math.min(maxConc, queue.length) }, () =>
    worker()
  );
  await Promise.all(workers);
  const counts = results;

  // Sum all valid counts
  const validCounts = counts.filter((c): c is number => c !== null && c >= 0);

  if (validCounts.length === 0) {
    return null; // No valid counts
  }

  const total = validCounts.reduce((sum, count) => sum + count, 0);
  return total;
}
