// backend/src/types/transactions.ts
import type { EvmNetwork } from "../config/networks";

export type TxKind = "native" | "erc20" | "erc721" | "erc1155";
export type LegDirection = "in" | "out";
export type TxStatus = "success" | "reverted" | "unknown";

export type TxClass =
  | "gas"
  | "transfer_in"
  | "transfer_out"
  | "swap_in"
  | "swap_out"
  | "nft_buy"
  | "nft_sell"
  | "nft_transfer_in"
  | "nft_transfer_out"
  | "income" // airdrops, mints to you with no obvious consideration
  | "expense"; // donations, tips, outflows w/o clear counter-leg

/** Canonical per-leg row (a single tx can yield many legs). */
export interface NormalizedLegRow {
  txHash: `0x${string}`;
  blockNumber: number;
  timestamp: number; // epoch seconds
  network: EvmNetwork;

  from: `0x${string}`;
  to: `0x${string}`;
  direction: LegDirection;

  kind: TxKind;
  asset: {
    contract?: `0x${string}`; // undefined for native on some sources
    symbol?: string | null;
    decimals?: number | null;
    tokenId?: string | null; // for 721/1155
  };
  swapLabel?: string | null;

  amountRaw: string; // base units as string
  amount: number; // human units (lossy ok for UI; accounting will re-use amountRaw)
  amountUsdAtTx?: number; // optional USD value at tx time

  status: TxStatus; // filled from receipt when available
  logIndex?: number; // ordering inside tx if provided by source
  source: "tokenapi-transfers" | "tokenapi-nft" | "rpc";

  class?: TxClass;
}

export interface TxCursorPosition {
  timestamp: number;
  blockNumber: number;
  txHash: `0x${string}`;
  logIndex: number;
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
