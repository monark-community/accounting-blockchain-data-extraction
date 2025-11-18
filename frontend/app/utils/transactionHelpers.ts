import type { ReactNode } from "react";
import React from "react";
import {
  TrendingDown,
  TrendingUp,
  Repeat,
  Fuel,
} from "lucide-react";
import type { TxType } from "@/lib/types/transactions";
import { PRIMARY_NETWORK_ID } from "@/lib/networks";
import type { TxRow } from "@/lib/types/transactions";

// Formatting helpers
export const fmtUSD = (n: number | null | undefined) =>
  n == null
    ? "—"
    : n.toLocaleString(undefined, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      });

export const fmtQty = (qty: string, dir: "in" | "out") =>
  `${dir === "in" ? "+" : "-"}${qty}`;

export const shortAddr = (a?: string | null) =>
  a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—";

export const typeColor = (t: TxType) =>
  ({
    income: "text-emerald-600",
    expense: "text-rose-600",
    swap: "text-indigo-600",
    gas: "text-sky-600",
  }[t] ?? "text-slate-600");

export const typeIcon = (t: TxType): ReactNode => {
  if (t === "income") return <TrendingUp className="w-4 h-4" />;
  if (t === "expense") return <TrendingDown className="w-4 h-4" />;
  if (t === "swap") return <Repeat className="w-4 h-4" />;
  if (t === "gas") return <Fuel className="w-4 h-4" />;
  return null;
};

export const explorerBase = (network?: string) => {
  switch ((network || "").toLowerCase()) {
    case "mainnet":
    case "ethereum":
      return "https://etherscan.io";
    case "sepolia":
    case "eth-sepolia":
      return "https://sepolia.etherscan.io";
    case "base":
      return "https://basescan.org";
    case "polygon":
      return "https://polygonscan.com";
    case "bsc":
      return "https://bscscan.com";
    case "optimism":
      return "https://optimistic.etherscan.io";
    case "arbitrum-one":
      return "https://arbiscan.io";
    case "avalanche":
      return "https://snowtrace.io";
    case "unichain":
      return "https://uniscan.xyz";
  }
};

export const etherscanTxUrl = (hash: string, network?: string) =>
  `${explorerBase(network)}/tx/${hash}`;

export const STABLE_SYMBOLS = new Set([
  "USDT",
  "USDC",
  "DAI",
  "FRAX",
  "LUSD",
  "PYUSD",
  "BUSD",
]);

export const DAY_MS = 24 * 60 * 60 * 1000;

export const fmtPct = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)}%`;
};

export const DEFAULT_NETWORKS: string[] = [PRIMARY_NETWORK_ID];

export function parseNetworkQuery(value?: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
}

// Date helper functions
export function startOfYearIso(year: number): string {
  return new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)).toISOString();
}

export function endOfYearIso(year: number): string {
  return new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)).toISOString();
}

export function isoFromDateInput(value: string, opts?: { endOfDay?: boolean }) {
  if (!value) return undefined;
  const parts = value.split("-").map((p) => Number(p));
  if (parts.length !== 3) return undefined;
  const [y, m, d] = parts;
  if ([y, m, d].some((n) => Number.isNaN(n))) return undefined;
  return new Date(
    Date.UTC(
      y,
      (m || 1) - 1,
      d || 1,
      opts?.endOfDay ? 23 : 0,
      opts?.endOfDay ? 59 : 0,
      opts?.endOfDay ? 59 : 0,
      opts?.endOfDay ? 999 : 0
    )
  ).toISOString();
}

export function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

// Map UI chip → backend class= param
export function uiTypesToClassParam(selected: TxType[] | ["all"]): string | null {
  if (!Array.isArray(selected) || (selected as any)[0] === "all") return null;
  const set = new Set<TxType>(selected as TxType[]);
  const classes: string[] = [];
  if (set.has("swap")) classes.push("swap_in", "swap_out");
  if (set.has("income"))
    classes.push("transfer_in", "nft_transfer_in", "nft_buy", "income");
  if (set.has("expense"))
    classes.push("transfer_out", "nft_transfer_out", "nft_sell", "expense");
  if (set.has("gas")) classes.push("gas");
  return classes.length ? classes.join(",") : null;
}

export function classifyIncomeCategory(row: TxRow): string {
  const label = `${row.counterparty?.label ?? ""} ${row.swapLabel ?? ""}`
    .trim()
    .toLowerCase();
  const symbol = (row.asset?.symbol ?? "").toUpperCase();
  if (label.includes("stake") || label.includes("staking")) return "Staking";
  if (label.includes("airdrop")) return "Airdrops";
  if (label.includes("nft")) return "NFT royalties";
  if (
    label.includes("bridge") ||
    label.includes("wormhole") ||
    label.includes("layerzero")
  )
    return "Bridge inflow";
  if (
    label.includes("coinbase") ||
    label.includes("binance") ||
    label.includes("kraken") ||
    label.includes("okx")
  )
    return "Exchange transfers";
  if (symbol.includes("LP")) return "LP rewards";
  return "Other income";
}

export const PAGE_SIZE = 20;

