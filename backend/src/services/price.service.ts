type CoinGeckoSearchResponse = {
  coins: Array<{
    id: string;
    name: string;
    symbol: string;
    market_cap_rank?: number;
  }>;
};

type CoinGeckoHistoryResponse = {
  market_data?: {
    current_price?: Record<string, number>;
  };
};

function formatCoinGeckoDate(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getUTCFullYear());
  return `${dd}-${mm}-${yyyy}`;
}

export class PriceService {
  private baseUrl = "https://api.coingecko.com/api/v3";
  private idCache = new Map<string, string>(); // symbol -> id

  private headers(): Record<string, string> {
    const h: Record<string, string> = { Accept: "application/json" };
    const key = process.env.COINGECKO_API_KEY;
    if (key) h["x-cg-demo-api-key"] = key; // optionnel
    return h;
  }

  private async resolveCoinId(symbol: string): Promise<string> {
    const s = symbol.trim().toLowerCase();
    const cached = this.idCache.get(s);
    if (cached) return cached;

    const url = `${this.baseUrl}/search?query=${encodeURIComponent(symbol)}`;
    const resp = await fetch(url, { headers: this.headers() });

    if (!resp.ok) {
      throw new Error(`CoinGecko search failed: ${resp.status} ${resp.statusText}`);
    }

    const data = (await resp.json()) as CoinGeckoSearchResponse;

    const candidates = (data.coins ?? []).filter((c) => c.symbol?.toLowerCase() === s);
    const best =
      candidates.sort((a, b) => (a.market_cap_rank ?? 999999) - (b.market_cap_rank ?? 999999))[0] ??
      data.coins?.[0];

    if (!best?.id) {
      throw new Error(`Unable to resolve CoinGecko id for symbol "${symbol}"`);
    }

    this.idCache.set(s, best.id);
    return best.id;
  }

  async getHistoricalPrice(symbol: string, date: Date): Promise<number> {
    const id = await this.resolveCoinId(symbol);
    const dateStr = formatCoinGeckoDate(date);

    const url = `${this.baseUrl}/coins/${encodeURIComponent(id)}/history?date=${encodeURIComponent(
      dateStr,
    )}`;

    const resp = await fetch(url, { headers: this.headers() });

    if (!resp.ok) {
      throw new Error(`CoinGecko history failed: ${resp.status} ${resp.statusText}`);
    }

    const data = (await resp.json()) as CoinGeckoHistoryResponse;
    const usd = data.market_data?.current_price?.usd;

    if (typeof usd !== "number") {
      throw new Error(`No USD price found for ${symbol} (${id}) at ${dateStr}`);
    }

    return usd;
  }
}