// backend/src/utils/tx.filters.ts

import type { NormalizedLegRow } from "../types/transactions";
import { ENABLE_SPAM_FILTER, scoreSpam } from "./spam.filter"; // your existing heuristics

export type SpamMode = "off" | "soft" | "hard";

export function applyLegFilters(
  legs: NormalizedLegRow[],
  {
    minUsd = 0,
    spamFilter = (process.env.SPAM_FILTER_MODE as SpamMode) ?? "soft",
  }: { minUsd?: number; spamFilter?: SpamMode }
): NormalizedLegRow[] {
  return legs.filter((l) => {
    // dust filter on priced legs; allow NFTs (no USD) to pass for now
    if (typeof l.amountUsdAtTx === "number" && l.amountUsdAtTx < minUsd)
      return false;

    if (!ENABLE_SPAM_FILTER || spamFilter === "off") return true;
    const sym = l.asset?.symbol ?? null;
    const { score } = scoreSpam(sym);
    if (spamFilter === "soft") return score < 3; // keep mildly suspicious
    if (spamFilter === "hard") return score < 1; // only very safe symbols
    return true;
  });
}
