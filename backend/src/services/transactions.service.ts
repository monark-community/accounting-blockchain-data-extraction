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

type ListParams = {
  address: `0x${string}`;
  networks?: string | string[];
  from?: string; // ISO datetime or epoch seconds (string ok)
  to?: string; // ISO datetime or epoch seconds (string ok)
  page?: number; // default 1
  limit?: number; // default 100
};

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
  const limit = Math.min(
    Math.max(1, params.limit ?? Number(process.env.TX_DEFAULT_LIMIT ?? 100)),
    Number(process.env.TX_MAX_LIMIT ?? 200)
  );

  const nets: EvmNetwork[] = parseNetworks(params.networks ?? undefined);
  const fromTime = toEpochSeconds(params.from);
  const toTime = toEpochSeconds(params.to);

  // 1) fetch + normalize per network
  const perNetPromises = nets.map(async (network) => {
    const basePage: PageParams = {
      network,
      address: params.address.toLowerCase() as `0x${string}`,
      fromTime,
      toTime,
      page,
      limit,
    };

    const [fungible, nft] = await Promise.all([
      fetchFungibleTransfersPage(basePage),
      fetchNftTransfersPage(basePage),
    ]);

    const legsF = fungible.map((r) =>
      normalizeFungibleTransfer(r, basePage.address, network)
    );
    const legsN = nft.map((r) =>
      normalizeNftTransfer(r, basePage.address, network)
    );
    const legs = [...legsF, ...legsN];

    // 2) receipts per network (unique tx hashes in this page window)
    const uniqTx = Array.from(new Set(legs.map((l) => l.txHash)));
    const receipts = await fetchReceiptsBatch(network, uniqTx);

    // 3) fill status
    for (const l of legs) {
      const rc = receipts[l.txHash];
      if (rc) l.status = rc.status;
    }

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

      let px = nativeUsdCache[ts];
      if (px === undefined) {
        px = await quoteNativeUsdAtTs(network, ts);
        nativeUsdCache[ts] = px;
      }
      if (typeof px === "number") {
        const ethSpent = (rc.gasUsed * rc.effectiveGasPrice) / 1e18;
        gasUsdByTx[txHash] = ethSpent * px;
      }
    }
    // Attach meta on this chunk
    (legs as any)._gasUsdByTx = gasUsdByTx;

    return legs;
  });

  const chunks = await Promise.all(perNetPromises);
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
