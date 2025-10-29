//src/types/transactions.ts
import type { EvmNetwork } from "../config/networks";

export type TxKind = "native" | "erc20" | "erc721" | "erc1155";
export type Direction = "in" | "out";
export type TxStatus = "success" | "reverted" | "unknown";

/** Canonical per-leg row (a single tx can yield many legs). */
export interface NormalizedLegRow {
  txHash: `0x${string}`;
  blockNumber: number;
  timestamp: number; // epoch seconds
  network: EvmNetwork;

  from: `0x${string}`;
  to: `0x${string}`;
  direction: Direction;

  kind: TxKind;
  asset: {
    contract?: `0x${string}`; // undefined for native on some sources
    symbol?: string | null;
    decimals?: number | null;
    tokenId?: string | null; // for 721/1155
  };

  amountRaw: string; // base units as string
  amount: number; // human units (lossy ok for UI; accounting will re-use amountRaw)

  status: TxStatus; // filled from receipt when available
  logIndex?: number; // ordering inside tx if provided by source
  source: "tokenapi-transfers" | "tokenapi-nft" | "rpc";
}

/** Inputs to fetch a single “page window” for one network. */
export interface PageParams {
  network: EvmNetwork;
  address: `0x${string}`;
  fromTime?: number; // epoch seconds
  toTime?: number; // epoch seconds
  page: number; // 1-based
  limit: number; // per source page size
}
