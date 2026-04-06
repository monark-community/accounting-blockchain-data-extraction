/**
 * Price Service  
 * Récupère les prix historiques via CoinGecko avec cache
 */
import axios from 'axios';
import prisma from '../config/database';
import logger from '../utils/logger';

interface PriceData {
  tokenSymbol: string;
  date: Date;
  priceUsd: number;
  priceCad?: number;
  priceEur?: number;
}

export class PriceService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.COINGECKO_API_KEY || '';
    this.baseUrl = 'https://api.coingecko.com/api/v3';
  }

  async getHistoricalPrice(tokenSymbol: string, date: Date): Promise<PriceData | null> {
    const cached = await this.getFromCache(tokenSymbol, date);
    if (cached) return cached;

    const price = await this.fetchFromCoinGecko(tokenSymbol, date);
    if (price) await this.saveToCache(price);
    return price;
  }

  private async getFromCache(tokenSymbol: string, date: Date): Promise<PriceData | null> {
    try {
      const cached = await prisma.priceCache.findFirst({
        where: {
          tokenSymbol: tokenSymbol.toUpperCase(),
          chain: null,
          date: this.dateOnly(date)
        }
      });

      if (!cached) return null;

      return {
        tokenSymbol: cached.tokenSymbol,
        date: cached.date,
        priceUsd: cached.priceUsd?.toNumber() || 0,
        priceCad: cached.priceCad?.toNumber(),
        priceEur: cached.priceEur?.toNumber()
      };
    } catch (error) {
      logger.error('Cache read error:', error);
      return null;
    }
  }

  private async fetchFromCoinGecko(tokenSymbol: string, date: Date): Promise<PriceData | null> {
    try {
      const coinId = this.mapSymbolToCoinId(tokenSymbol);
      const formattedDate = this.formatDate(date);

      const response = await axios.get(
        `${this.baseUrl}/coins/${coinId}/history`,
        {
          params: { date: formattedDate, localization: false },
          headers: this.apiKey ? { 'x-cg-pro-api-key': this.apiKey } : {},
          timeout: 10000
        }
      );

      const data = response.data.market_data;
      if (!data?.current_price) return null;

      return {
        tokenSymbol: tokenSymbol.toUpperCase(),
        date,
        priceUsd: data.current_price.usd || 0,
        priceCad: data.current_price.cad,
        priceEur: data.current_price.eur
      };
    } catch (error) {
      logger.error('CoinGecko error:', error);
      return null;
    }
  }

  private async saveToCache(price: PriceData): Promise<void> {
    try {
      await prisma.priceCache.create({
        data: {
          tokenSymbol: price.tokenSymbol,
          chain: null,
          date: this.dateOnly(price.date),
          priceUsd: price.priceUsd,
          priceCad: price.priceCad,
          priceEur: price.priceEur,
          source: 'coingecko'
        }
      });
    } catch (error) {
      logger.warn('Cache write error:', error);
    }
  }

  private mapSymbolToCoinId(symbol: string): string {
    const mapping: Record<string, string> = {
      ETH: 'ethereum',
      BTC: 'bitcoin',
      MATIC: 'matic-network',
      BNB: 'binancecoin',
      SOL: 'solana',
      AVAX: 'avalanche-2',
      USDC: 'usd-coin',
      USDT: 'tether',
      DAI: 'dai'
    };

    return mapping[symbol.toUpperCase()] || symbol.toLowerCase();
  }

  private formatDate(date: Date): string {
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
  }

  private dateOnly(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }
}

export default new PriceService();