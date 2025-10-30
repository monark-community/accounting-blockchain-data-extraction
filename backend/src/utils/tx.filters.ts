// backend/src/utils/tx.filters.ts
import type { NormalizedLegRow } from "../types/transactions";
import { scoreSpam, SPAM_FILTER_MODE, type SpamMode } from "../config/filters";

const ENABLE_SPAM_FILTER =
  String(process.env.ENABLE_SPAM_FILTER ?? "true").toLowerCase() === "true";

/**
 * Apply min-USD and spam filters to normalized legs.
 * - minUsd applies only when amountUsdAtTx is known (we keep NFTs unpriced).
 * - spam filter is symbol-based; only meaningful for fungible legs (native/erc20).
 */
export function applyLegFilters(
  legs: NormalizedLegRow[],
  {
    minUsd = 0,
    spamFilter = (SPAM_FILTER_MODE as SpamMode) ?? "soft",
  }: { minUsd?: number; spamFilter?: SpamMode }
): NormalizedLegRow[] {
  return legs.filter((l) => {
    // 1) Dust filter: only filter priced legs below the threshold
    if (typeof l.amountUsdAtTx === "number" && l.amountUsdAtTx < minUsd) {
      return false;
    }

    // 2) Spam filter (symbol-based): skip if disabled or NFTs
    if (!ENABLE_SPAM_FILTER || spamFilter === "off") return true;
    if (l.kind === "erc721" || l.kind === "erc1155") return true;

    const sym = l.asset?.symbol ?? null;
    const { score } = scoreSpam(sym);

    // soft = allow mild suspicion; hard = allow only very safe
    if (spamFilter === "soft") return score < 3;
    if (spamFilter === "hard") return score < 1;

    return true;
  });
}
