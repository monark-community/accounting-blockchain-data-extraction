const TOKEN_API_LIMIT_COOLDOWN_MS = Number(
  process.env.TOKEN_API_RATE_LIMIT_COOLDOWN_MS ?? 5 * 60 * 1000
);

let tokenApiRateLimitedUntil = 0;

export function markTokenApiRateLimited() {
  tokenApiRateLimitedUntil = Date.now() + TOKEN_API_LIMIT_COOLDOWN_MS;
}

export function getTokenApiWarnings() {
  const remaining = tokenApiRateLimitedUntil - Date.now();
  if (remaining > 0) {
    return {
      tokenApiRateLimited: true,
      tokenApiRetryAfterMs: remaining,
    };
  }
  return {
    tokenApiRateLimited: false,
    tokenApiRetryAfterMs: 0,
  };
}
