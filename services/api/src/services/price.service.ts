/**
 * Price Service
 * Récupère les prix historiques via CoinGecko avec cache local
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
  private rateLimitDelay = 1000; // 1 seconde entre appels

  constructor() {
    this.apiKey = process.env.COINGECKO_API_KEY || '';
    this.baseUrl = process.env.COINGECKO_BASE_URL || 'https://api.coingecko.com/api/v3';
    
    if (!this.apiKey) {
      logger.warn('COINGECKO_API_KEY not configured - using public API');
    }
  }

  /**
   * Récupère le prix historique (avec cache)
   */
  async getHistoricalPrice(
    tokenSymbol: string,
    date: Date
  ): Promise<PriceData | null> {
    try {
      // 1. Vérifier le cache local
      const cached = await this.getFromCache(tokenSymbol, date);
      
      if (cached) {
        logger.debug('Price from cache', {
          tokenSymbol,
          date: this.formatDateISO(date),
          priceUsd: cached.priceUsd
        });
        return cached;
      }

      // 2. Appeler CoinGecko
      logger.info('Fetching price from CoinGecko', {
        tokenSymbol,
        date: this.formatDateISO(date)
      });

      const price = await this.fetchFromCoinGecko(tokenSymbol, date);
      
      if (price) {
        // 3. Sauvegarder dans le cache
        await this.saveToCache(price);
        return price;
      }

      return null;
    } catch (error) {
      logger.error('Error getting historical price', {
        tokenSymbol,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Récupère plusieurs prix en batch (optimisé)
   */
  async getBatchPrices(
    requests: Array<{ tokenSymbol: string; date: Date }>
  ): Promise<Map<string, PriceData | null>> {
    const results = new Map<string, PriceData | null>();

    for (const req of requests) {
      const key = `${req.tokenSymbol}_${this.formatDateISO(req.date)}`;
      const price = await this.getHistoricalPrice(req.tokenSymbol, req.date);
      results.set(key, price);

      // Rate limiting
      await this.sleep(this.rateLimitDelay);
    }

    return results;
  }

  /**
   * Cherche dans le cache local
   */
private async getFromCache(
  tokenSymbol: string,
  date: Date
): Promise<PriceData | null> {
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
    return null;
  }
}
  /**
   * Appelle CoinGecko API
   */
  private async fetchFromCoinGecko(
    tokenSymbol: string,
    date: Date
  ): Promise<PriceData | null> {
    try {
      const coinId = this.mapSymbolToCoinId(tokenSymbol);
      const formattedDate = this.formatDateCoinGecko(date);

      const response = await axios.get(
        `${this.baseUrl}/coins/${coinId}/history`,
        {
          params: { date: formattedDate, localization: false },
          headers: this.apiKey ? { 'x-cg-pro-api-key': this.apiKey } : {},
          timeout: 15000
        }
      );

      const data = response.data.market_data;

      if (!data || !data.current_price) {
        return null;
      }

      return {
        tokenSymbol: tokenSymbol.toUpperCase(),
        date,
        priceUsd: data.current_price.usd || 0,
        priceCad: data.current_price.cad,
        priceEur: data.current_price.eur
      };
    } catch (error) {
      logger.error('CoinGecko API error', {
        tokenSymbol,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Sauvegarde dans le cache
   */
  private async saveToCache(price: PriceData): Promise<void> {
    try {
      await prisma.priceCache.create({
        data: {
          tokenSymbol: price.tokenSymbol,
          chain: null,
          date: this.dateOnly(price.date),
          priceUsd: price.priceUsd,
          priceCad: price.priceCad || null,
          priceEur: price.priceEur || null,
          source: 'coingecko'
        }
      });
    } catch (error) {
      // Ignorer si doublon (contrainte unique)
    }
  }

  /**
   * Mapping symboles → CoinGecko IDs
   */
  private mapSymbolToCoinId(symbol: string): string {
    const mapping: Record<string, string> = {
      'ETH': 'ethereum',
      'BTC': 'bitcoin',
      'MATIC': 'matic-network',
      'BNB': 'binancecoin',
      'SOL': 'solana',
      'AVAX': 'avalanche-2',
      'USDC': 'usd-coin',
      'USDT': 'tether',
      'DAI': 'dai',
      'WETH': 'weth',
      'LINK': 'chainlink',
      'UNI': 'uniswap'
    };

    return mapping[symbol.toUpperCase()] || symbol.toLowerCase();
  }

  private formatDateCoinGecko(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  private formatDateISO(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private dateOnly(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default new PriceService();