// src/services/transactions.service.ts
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

/**
 * Main listing function for Step 1 (no pricing yet).
 */
export async function listTransactionLegs(
  params: ListParams
): Promise<NormalizedLegRow[]> {
  const page = Math.max(
    1,
    params.page ?? Number(process.env.TX_DEFAULT_LIMIT ? 1 : 1)
  );
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
    return legs;
  });

  const chunks = await Promise.all(perNetPromises);
  const all = chunks.flat();

  // 4) sort deterministically
  all.sort(sortLegs);
  return all;
}
