/**
 * Blockchain Service - Pinax Integration (EVM)
 */

import dotenv from 'dotenv';
dotenv.config();

import axios, { AxiosError } from 'axios';
import logger from '../utils/logger';
import { SupportedChain } from '../types';
import { getPinaxEndpoint } from '../config/pinax-endpoints';
import {
  PinaxRawTransaction,
  PinaxTransactionsResponse,
  PinaxQueryParams
} from '../interfaces/pinax.interface';

/**
 * Transaction normalisée (format interne LedgerLift)
 */
export interface NormalizedTransaction {
  hash: string;
  chain: SupportedChain;
  timestamp: Date;
  fromAddress: string;
  toAddress: string;
  tokenSymbol: string;
  tokenAddress: string | null;
  amount: string;
  blockNumber: bigint;
}

class BlockchainService {
  private apiKey: string;
  private maxRetries = 3;
  private baseDelay = 1000;

  constructor() {
    this.apiKey = process.env.PINAX_API_KEY || '';

    if (!this.apiKey) {
      throw new Error('PINAX_API_KEY is missing in environment variables');
    }
  }

  /**
   * Point d'entrée principal
   */
  async fetchTransactions(
    address: string,
    chain: SupportedChain,
    limit: number = 100
  ): Promise<NormalizedTransaction[]> {
    logger.info('Fetching transactions', { address, chain });

    const rawTransactions = await this.fetchFromPinax(address, chain, limit);

    return rawTransactions.map(tx => this.normalize(tx, chain));
  }

  /**
   * Appel API Pinax avec retry
   */
  private async fetchFromPinax(
    address: string,
    chain: SupportedChain,
    limit: number,
    attempt: number = 1
  ): Promise<PinaxRawTransaction[]> {

    const config = getPinaxEndpoint(chain);

    const url = `${config.baseUrl}/v1/evm/transfers`;

    const params: PinaxQueryParams = {
      address,
      network: config.network,
      limit
    };

    try {
      const response = await axios.get<PinaxTransactionsResponse>(url, {
        params,
        headers: {
          'x-api-key': this.apiKey
        },
        timeout: 30000
      });

      return response.data.data || [];

    } catch (error) {
      const axiosError = error as AxiosError;

      logger.warn('Pinax API error', {
        attempt,
        chain,
        status: axiosError.response?.status,
        message: axiosError.message
      });

      // Retry logique
      if (this.isRetriableError(axiosError) && attempt < this.maxRetries) {
        const delay = this.baseDelay * Math.pow(2, attempt - 1);
        await this.sleep(delay);
        return this.fetchFromPinax(address, chain, limit, attempt + 1);
      }

      throw new Error(
        `Pinax API failed: ${axiosError.response?.data || axiosError.message}`
      );
    }
  }

  /**
   * Détermine si erreur retriable
   */
  private isRetriableError(error: AxiosError): boolean {
    if (!error.response) return true;

    const status = error.response.status;
    return status === 429 || (status >= 500 && status < 600);
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Normalisation des transactions
   */
  private normalize(
    tx: PinaxRawTransaction,
    chain: SupportedChain
  ): NormalizedTransaction {

    return {
      hash: tx.transaction_hash || (tx as any).hash || (tx as any).id || 'unknown',
      chain,
      timestamp: new Date(tx.datetime),
      fromAddress: tx.from.toLowerCase(),
      toAddress: tx.to.toLowerCase(),
      tokenSymbol: tx.token_symbol || this.getNativeToken(chain),
      tokenAddress: tx.token_address || null,
      amount: tx.value,
      blockNumber: tx.block_number ? BigInt(tx.block_number) : BigInt(0)
    };
  }

  /**
   * Token natif fallback
   */
  private getNativeToken(chain: SupportedChain): string {
    const map: Record<string, string> = {
      ethereum: 'ETH',
      polygon: 'MATIC',
      bsc: 'BNB',
      arbitrum: 'ETH',
      optimism: 'ETH',
      avalanche: 'AVAX'
    };

    return map[chain] || 'UNKNOWN';
  }
}

export default new BlockchainService();