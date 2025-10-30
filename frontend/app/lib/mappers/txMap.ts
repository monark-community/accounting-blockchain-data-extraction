import type { NormalizedLegRow, TxRow } from "@/lib/types/transactions";

// Map backend classes → UI buckets
function mapClassToUiType(
  cls?: string | null,
  direction?: "in" | "out"
): TxRow["type"] {
  if (!cls) {
    // Default by direction
    return direction === "in" ? "income" : "expense";
  }
  if (cls.startsWith("swap_")) return "swap";
  if (cls === "gas") return "gas"; // (we currently expose gas via meta only)
  if (
    cls.startsWith("transfer_") ||
    cls.startsWith("nft_transfer_") ||
    cls === "income"
  )
    return "income";
  if (cls === "expense" || cls.startsWith("nft_sell") || cls === "transfer_out")
    return "expense";
  // fallback by direction
  return direction === "in" ? "income" : "expense";
}

export function mapLegToTxRow(
  leg: NormalizedLegRow,
  gasUsdByTx: Record<string, number>
): TxRow {
  const tsIso = new Date(leg.timestamp * 1000).toISOString();
  const type = mapClassToUiType(leg.class, leg.direction);

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
    counterparty: leg.to
      ? {
          address:
            leg.direction === "in" ? (leg.from as string) : (leg.to as string),
          label: null,
        }
      : null,
    fee:
      gasUsd != null
        ? { asset: "NATIVE", qty: null, priceUsdAtTs: null, usdAtTs: gasUsd }
        : null,
    isApprox: false,
  };
}
