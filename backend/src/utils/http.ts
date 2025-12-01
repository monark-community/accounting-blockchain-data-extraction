// backend/src/utils/http.ts
export async function fetchWithRetry(
  url: string,
  opts: RequestInit = {},
  {
    retries = 2,
    timeoutMs = Number(process.env.HTTP_TIMEOUT_MS ?? 15000),
    retryOn = [429, 500, 502, 503, 504],
  }: { retries?: number; timeoutMs?: number; retryOn?: number[] } = {}
) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...opts, signal: controller.signal });
      clearTimeout(id);
      if (res.ok) return res;
      if (!retryOn.includes(res.status) || attempt === retries) return res;
      // Respect Retry-After for 429/5xx if provided
      // let waitMs = 500 * (attempt + 1);
      // if (res.status === 429) {
      //   const ra = res.headers.get("retry-after");
      //   if (ra) {
      //     const s = Number(ra);
      //     if (Number.isFinite(s) && s > 0) {
      //       waitMs = Math.max(waitMs, Math.floor(s * 1000));
      //     }
      //   }
      // }
      // await new Promise((r) => setTimeout(r, waitMs));
      // continue;
    } catch (err) {
      clearTimeout(id);
      if (attempt === retries) throw err;
    }
    // simple backoff: 0.5s, 1.0s, ...
    await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
  }
  throw new Error("fetchWithRetry exhausted");
}
