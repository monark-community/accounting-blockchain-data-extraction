import type { NormalizedLegRow, TxRow } from "@/lib/types/transactions";

// Map backend classes → UI buckets
function mapClassToUiType(
  cls?: string | null,
  direction?: "in" | "out"
): "income" | "expense" | "swap" | "gas" {
  const c = (cls ?? "").toLowerCase();

  // 1) EXPENSE buckets
  if (
    c === "expense" ||
    c === "transfer_out" ||
    c === "nft_transfer_out" ||
    c === "nft_sell"
  ) {
    return "expense";
  }

  // 2) SWAPS
  if (c === "swap_in" || c === "swap_out") {
    return "swap";
  }

  // 3) INCOME buckets
  if (
    c === "income" ||
    c === "transfer_in" ||
    c === "nft_transfer_in" ||
    c === "nft_buy"
  ) {
    return "income";
  }

  // 4) GAS (if you ever tag it as a class later)
  if (c === "gas") {
    return "gas";
  }

  // 5) Fallback by direction if class is missing/unknown
  return direction === "out" ? "expense" : "income";
}

export function mapLegToTxRow(
  leg: NormalizedLegRow,
  gasUsdByTx: Record<string, number>
): TxRow {
  const tsIso = new Date(leg.timestamp * 1000).toISOString();
  const type = mapClassToUiType(leg.class, leg.direction);
  const isGas = type === "gas";

  // We don't know the native qty spent for gas here—only USD is given by meta.
  const gasUsd = gasUsdByTx?.[leg.txHash] ?? null;

  return {
    ts: tsIso,
    blockNumber: leg.blockNumber,
    hash: leg.txHash,
    network: leg.network,
    direction: leg.direction,
    type,
    asset: {
      symbol: leg.asset?.symbol ?? null,
      contract: (leg.asset?.contract as string) ?? null,
      decimals: leg.asset?.decimals ?? null,
    },
    qty: String(leg.amount ?? 0),
    priceUsdAtTs:
      leg.amountUsdAtTx && leg.amount ? leg.amountUsdAtTx / leg.amount : null,
    usdAtTs: leg.amountUsdAtTx ?? null,
    counterparty: isGas
      ? { address: null, label: "Network fee" }
      : leg.to
      ? {
          address:
            leg.direction === "in" ? (leg.from as string) : (leg.to as string),
          label: null,
        }
      : null,
    fee:
      !isGas && gasUsd != null
        ? { asset: "NATIVE", qty: null, priceUsdAtTs: null, usdAtTs: gasUsd }
        : null,
    isApprox: false,
  };
}
