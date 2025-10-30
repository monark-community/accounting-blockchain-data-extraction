// backend/src/services/tx.classify.ts

import type { NormalizedLegRow, TxClass } from "../types/transactions";

type TxLegs = NormalizedLegRow[];

/** helpers */
function legsIn(legs: TxLegs) {
  return legs.filter((l) => l.direction === "in");
}
function legsOut(legs: TxLegs) {
  return legs.filter((l) => l.direction === "out");
}

function hasKind(
  legs: TxLegs,
  kind: NormalizedLegRow["kind"],
  dir?: "in" | "out"
) {
  const sel = dir ? legs.filter((l) => l.direction === dir) : legs;
  return sel.some((l) => l.kind === kind);
}

function sumUsd(legs: TxLegs) {
  return legs.reduce((s, l) => s + (l.amountUsdAtTx ?? 0), 0);
}

/**
 * Classify legs with simple intents:
 * - SWAP: both in & out contain fungible (erc20/native)
 * - NFT BUY: erc721/1155 IN and fungible OUT
 * - NFT SELL: erc721/1155 OUT and fungible IN
 * - TRANSFER_IN/OUT: only single-direction fungible
 * - INCOME/EXPENSE: fallback labels when value exists but no counter-leg
 * Gas is handled in summary via gasUsdByTx; we don't mark legs "gas".
 */
export function classifyLegs(legs: TxLegs): void {
  const inFungible = legsIn(legs).filter(
    (l) => l.kind === "native" || l.kind === "erc20"
  );
  const outFungible = legsOut(legs).filter(
    (l) => l.kind === "native" || l.kind === "erc20"
  );
  const inNft = legsIn(legs).filter(
    (l) => l.kind === "erc721" || l.kind === "erc1155"
  );
  const outNft = legsOut(legs).filter(
    (l) => l.kind === "erc721" || l.kind === "erc1155"
  );

  const hasSwapPattern = inFungible.length > 0 && outFungible.length > 0;
  const hasNftBuy = inNft.length > 0 && outFungible.length > 0;
  const hasNftSell = outNft.length > 0 && inFungible.length > 0;

  if (hasSwapPattern) {
    inFungible.forEach((l) => (l.class = "swap_in"));
    outFungible.forEach((l) => (l.class = "swap_out"));
  }
  if (hasNftBuy) {
    inNft.forEach((l) => (l.class = "nft_buy"));
    outFungible.forEach((l) => {
      if (!l.class) l.class = "expense";
    });
  }
  if (hasNftSell) {
    outNft.forEach((l) => (l.class = "nft_sell"));
    inFungible.forEach((l) => {
      if (!l.class) l.class = "income";
    });
  }

  // pure transfers (only one direction seen, no counter)
  if (!hasSwapPattern && !hasNftBuy && !hasNftSell) {
    if (
      inFungible.length &&
      !outFungible.length &&
      !inNft.length &&
      !outNft.length
    ) {
      inFungible.forEach((l) => (l.class = "transfer_in"));
    }
    if (
      outFungible.length &&
      !inFungible.length &&
      !inNft.length &&
      !outNft.length
    ) {
      outFungible.forEach((l) => (l.class = "transfer_out"));
    }
  }

  // fallbacks: if something still unclassified with value
  for (const l of legs) {
    if (!l.class) {
      if (l.direction === "in") l.class = "income";
      else l.class = "expense";
    }
  }
}
