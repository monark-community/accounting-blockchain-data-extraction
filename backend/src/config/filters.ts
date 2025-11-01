// backend/src/config/filters.ts

export type SpamMode = "off" | "soft" | "hard";

export const SPAM_FILTER_MODE: SpamMode = (process.env.SPAM_FILTER_MODE ??
  "soft") as SpamMode;

/** very small whitelist for blue-chips & stables that should NEVER be filtered */
export const SYMBOL_WHITELIST = new Set([
  "ETH",
  "WETH",
  "BTC",
  "WBTC",
  "BNB",
  "AVAX",
  "MATIC",
  "POL",
  "USDT",
  "USDC",
  "DAI",
  "FRAX",
  "LUSD",
  "TUSD",
  "GUSD",
  "PYUSD",
  "ARB",
  "OP",
  "BASE",
]);

/** crude heuristics; returns {score, reasons[]} */
export function scoreSpam(symbol?: string | null): {
  score: number;
  reasons: string[];
} {
  const reasons: string[] = [];
  let score = 0;
  const s = (symbol ?? "").trim();

  if (!s) {
    score += 0.5;
    reasons.push("empty-symbol");
  }
  if (SYMBOL_WHITELIST.has(s.toUpperCase())) return { score: 0, reasons };

  // 0x0x0x… or obviously broken
  if (/^(0x){2,}/i.test(s)) {
    score += 2;
    reasons.push("repeated-0x");
  }

  // Promo / phishing-y keywords
  if (
    /\b(CLAIM|AIRDROP|REWARD|BONUS|VISIT|HTTP|HTTPS|T\.ME|TELEGRAM|GET\s+REWARD)\b/i.test(
      s
    )
  ) {
    score += 2;
    reasons.push("promo-keywords");
  }

  // starting with a phishing-y prefix
  if (
    /^(T\.ME|TELEGRAM|HTTP|HTTPS|CLAIM|AIRDROP|REWARD|BONUS|VISIT|GET\s+REWARD)/i.test(
      s
    )
  ) {
    score += 2;
    reasons.push("promo-prefix");
  }

  // Not english letters/numbers only
  if (/[^a-zA-Z0-9]/.test(s)) {
    score += 5;
    reasons.push("non-english-chars");
  }

  // Non-ASCII (a lot of spam uses this); keep score modest so it’s “soft”
  if (/[^ -~]/.test(s)) {
    score += 0.5;
    reasons.push("non-ascii");
  }

  // Very long token “symbols” (these are almost always junk)
  if (s.length > 24) {
    score += 1.5;
    reasons.push("very-long");
  }

  // Pipes and separators (e.g., “PAWS | t.me/…”)
  if (/[|]/.test(s)) {
    score += 1;
    reasons.push("pipe-separator");
  }

  return { score, reasons };
}

/** sanitize display symbol (fallback to contract snippet in the FE if still bad) */
export function cleanSymbol(symbol?: string | null): string | null {
  if (!symbol) return null;
  const s = symbol.trim();
  // collapse repeated 0x
  const s2 = s.replace(/^(?:0x){2,}/i, "0x");
  return s2.slice(0, 64);
}
