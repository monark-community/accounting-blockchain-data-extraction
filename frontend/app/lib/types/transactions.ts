export type TxType = "income" | "expense" | "swap" | "gas"; // UI buckets
export type Direction = "in" | "out";

export interface TxRow {
  ts: string; // ISO time
  blockNumber: number;
  hash: string;
  network: string; // e.g. "mainnet"
  walletAddress?: string;
  direction: Direction;
  type: TxType; // UI bucket (transfer_in -> income, transfer_out -> expense)
  asset: {
    symbol: string | null;
    contract: string | null;
    decimals: number | null;
  };
  swapLabel?: string | null;
  qty: string; // decimal string
  priceUsdAtTs: number | null;
  usdAtTs: number | null;
  counterparty?: { address: string | null; label: string | null } | null;
  fee?: null | {
    asset: string; // e.g. "ETH"
    qty: string | null;
    priceUsdAtTs: number | null;
    usdAtTs: number | null;
  };
  isApprox?: boolean;
}

// Raw backend shapes (partial)
export interface NormalizedLegRow {
  txHash: string;
  blockNumber: number;
  timestamp: number; // epoch seconds
  network: string;
  from: `0x${string}`;
  to?: `0x${string}` | null;
  direction: "in" | "out";
  kind: "native" | "erc20" | "erc721" | "erc1155";
  amount: number; // already decimal
  amountUsdAtTx?: number | null;
  asset: {
    symbol?: string | null;
    contract?: `0x${string}` | null;
    decimals?: number | null;
  };
  class?: string | null; // swap_in, transfer_out, nft_transfer_in, income, expense, ...
}
export interface TxListResponse {
  data: NormalizedLegRow[];
  meta: { gasUsdByTx: Record<string, number> };
  page: number;
  limit: number;
  hasNext?: boolean;
  nextCursor?: string | null;
  warnings?: {
    defiLlamaRateLimited?: boolean;
    defiLlamaRetryAfterMs?: number;
    tokenApiRateLimited?: boolean;
    tokenApiRetryAfterMs?: number;
  };
}
