// shared types aligned with backend
export type PricedHolding = {
  chain:
    | "mainnet"
    | "bsc"
    | "polygon"
    | "optimism"
    | "base"
    | "arbitrum-one"
    | "avalanche"
    | "unichain";
  contract: string | null;
  symbol: string;
  decimals: number;
  qty: string;
  priceUsd: number;
  valueUsd: number;
  delta24hUsd?: number | null;
  delta24hPct?: number | null;
};

export type OverviewResponse = {
  address: string;
  asOf: string;
  currency: "USD";
  kpis: { totalValueUsd: number; delta24hUsd: number; delta24hPct: number };
  holdings: PricedHolding[];
  allocation: {
    symbol: string;
    valueUsd: number;
    weightPct: number;
    chain: PricedHolding["chain"];
  }[];
  topHoldings: {
    symbol: string;
    valueUsd: number;
    weightPct: number;
    chain: PricedHolding["chain"];
  }[];
};
