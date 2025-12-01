// backend/src/services/tx.normalize.ts
import type { NormalizedLegRow } from "../types/transactions";
import type { EvmNetwork } from "../config/networks";

/** Minimal shapes we expect back from Token API. */
export interface TokenApiTransfer {
  transaction_id: `0x${string}`;
  block_num: number;
  timestamp: number; // epoch seconds
  network: string;

  from: `0x${string}`;
  to: `0x${string}`;

  // fungible/native
  contract?: `0x${string}` | null; // native may be represented as special 0xeeee… or null
  symbol?: string | null;
  decimals?: number | null;

  // amounts (varies by API; we support common patterns)
  amount?: string | null; // base units as string
  value?: number | null; // human units if provided
  log_index?: number | null;
}

export interface TokenApiNftTransfer {
  transaction_id: `0x${string}`;
  block_num: number;
  timestamp: number;
  network: string;

  from: `0x${string}` | null;
  to: `0x${string}` | null;

  contract: `0x${string}`;
  token_id: string;
  // 1155 may have quantity/amount; default to "1" for 721
  amount?: string | null; // base units as string (1155)
  value?: number | null; // human units if provided
  log_index?: number | null;
}

/** Best-effort lowercasing; we’ll add EIP-55 checksum later. */
function normAddr(a?: string | null): `0x${string}` {
  const v = (a ?? "0x").toLowerCase();
  return v as `0x${string}`;
}

function toNumberFromBase(
  amountRaw: string | null | undefined,
  decimals?: number | null
): number {
  if (!amountRaw) return 0;
  // If the source already gave a human-readable number (contains a dot or exponent), trust it.
  if (/[.\deE+-]/.test(amountRaw) && !/^\d+$/.test(amountRaw)) {
    const n = Number(amountRaw);
    return Number.isFinite(n) ? n : 0;
  }
  const d = typeof decimals === "number" ? decimals : 18;
  if (d <= 0) return Number(amountRaw);
  // Avoid BigInt math gymnastics here; UI-level precision is ok for Step 1.
  const s = amountRaw.padStart(d + 1, "0");
  const intPart = s.slice(0, -d) || "0";
  const fracPart = s.slice(-d);
  return Number(`${intPart}.${fracPart}`.replace(/^0+(?=\d)/, ""));
}

const NATIVE_SENTINEL = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

/** Token API (fungible/native) → legs */
export function normalizeFungibleTransfer(
  row: TokenApiTransfer,
  wallet: `0x${string}`,
  network: EvmNetwork
): NormalizedLegRow {
  const txHash = row.transaction_id;
  const from = normAddr(row.from);
  const to = normAddr(row.to);

  const isNative =
    row.contract?.toLowerCase() === NATIVE_SENTINEL || !row.contract;
  const kind = isNative ? "native" : "erc20";

  const direction = from === wallet ? "out" : "in";

  // Prefer provided human `value`; fallback to base conversion.
  const amountRaw = row.amount ?? null;
  const amountFromRaw = toNumberFromBase(
    amountRaw,
    row.decimals ?? (isNative ? 18 : undefined)
  );
  const amount =
    amountRaw != null
      ? amountFromRaw
      : typeof row.value === "number" && row.value >= 0
      ? row.value
      : 0;

  return {
    txHash,
    blockNumber: row.block_num,
    timestamp: row.timestamp,
    network,
    from,
    to,
    direction,
    kind,
    asset: {
      contract: isNative ? undefined : (row.contract as `0x${string}`),
      symbol: row.symbol ?? (isNative ? "ETH" : null),
      decimals: row.decimals ?? (isNative ? 18 : null),
      tokenId: null,
    },
    amountRaw: amountRaw ?? "0",
    amount,
    status: "unknown",
    logIndex: row.log_index ?? undefined,
    source: "tokenapi-transfers",
  };
}

/** Token API (NFT) → legs */
export function normalizeNftTransfer(
  row: TokenApiNftTransfer,
  wallet: `0x${string}`,
  network: EvmNetwork
): NormalizedLegRow {
  const txHash = row.transaction_id;
  const from = normAddr(row.from);
  const to = normAddr(row.to);
  const direction = from === wallet ? "out" : "in";

  // ERC721 default amount 1; ERC1155 may provide quantity.
  const decimals = 0;
  const amountRaw = row.amount ?? "1";
  const amount = row.value ?? Number(amountRaw); // value may already be parsed as count

  // Heuristic: if there’s an amount > 1 → erc1155; else erc721
  const kind = amount > 1 ? "erc1155" : "erc721";

  return {
    txHash,
    blockNumber: row.block_num,
    timestamp: row.timestamp,
    network,
    from,
    to,
    direction,
    kind,
    asset: {
      contract: row.contract as `0x${string}`,
      symbol: null,
      decimals,
      tokenId: row.token_id ?? null,
    },
    amountRaw,
    amount,
    status: "unknown",
    logIndex: row.log_index ?? undefined,
    source: "tokenapi-nft",
  };
}
