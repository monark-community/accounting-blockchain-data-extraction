import { PriceService } from "./price.service";
describe("PriceService", () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn();
    delete process.env.COINGECKO_API_KEY;
  });

  it("retourne le prix historique USD", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          coins: [{ id: "bitcoin", symbol: "btc", name: "Bitcoin", market_cap_rank: 1 }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          market_data: { current_price: { usd: 42000 } }
        })
      });

    const svc = new PriceService();
    const price = await svc.getHistoricalPrice("BTC", new Date("2024-12-30T00:00:00Z"));

    expect(price).toBe(42000);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});