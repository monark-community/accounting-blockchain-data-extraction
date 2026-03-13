/**
 * Blockchain Service
 * Récupère et normalise les transactions via Pinax API
 */
import axios from 'axios';
import logger from '../utils/logger';
import { SupportedChain } from '../types';

interface RawTransaction {
  hash: string;
  timestamp: number;
  from: string;
  to: string;
  value: string;
  tokenSymbol?: string;
  tokenAddress?: string;
  gasUsed?: string;
  gasPrice?: string;
  blockNumber?: number;
}

interface NormalizedTransaction {
  hash: string;
  chain: string;
  timestamp: Date;
  fromAddress: string;
  toAddress: string;
  tokenSymbol: string;
  tokenAddress?: string;
  amount: string;
  gasUsed?: number;
  gasPrice?: string;
  blockNumber?: number;
}

export class BlockchainService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.PINAX_API_KEY || '';
    this.baseUrl = process.env.PINAX_BASE_URL || 'https://api.pinax.network';
    
    if (!this.apiKey) {
      logger.warn('PINAX_API_KEY not configured');
    }
  }

  async fetchTransactions(
    address: string,
    chain: SupportedChain
  ): Promise<RawTransaction[]> {
    try {
      logger.info('Fetching transactions from Pinax', { address, chain });

      const response = await axios.get(
        `${this.baseUrl}/transactions`,
        {
          params: { address: address.toLowerCase(), chain },
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const transactions = response.data.transactions || [];
      logger.info('Transactions fetched', { count: transactions.length });
      return transactions;
    } catch (error) {
      logger.error('Pinax API error:', error);
      return [];
    }
  }

  normalize(raw: RawTransaction, chain: SupportedChain): NormalizedTransaction {
    return {
      hash: raw.hash,
      chain,
      timestamp: new Date(raw.timestamp * 1000),
      fromAddress: raw.from.toLowerCase(),
      toAddress: raw.to.toLowerCase(),
      tokenSymbol: this.extractTokenSymbol(raw, chain),
      tokenAddress: raw.tokenAddress?.toLowerCase(),
      amount: this.formatAmount(raw.value, chain),
      gasUsed: raw.gasUsed ? parseInt(raw.gasUsed) : undefined,
      gasPrice: raw.gasPrice,
      blockNumber: raw.blockNumber
    };
  }

  private formatAmount(value: string, chain: SupportedChain): string {
    const decimals = chain === 'solana' ? 9 : 18;
    const bigIntValue = BigInt(value);
    const divisor = BigInt(10 ** decimals);
    const integerPart = bigIntValue / divisor;
    const fractionalPart = bigIntValue % divisor;
    const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    return `${integerPart}.${fractionalStr}`;
  }

  private extractTokenSymbol(raw: RawTransaction, chain: SupportedChain): string {
    if (raw.tokenSymbol) return raw.tokenSymbol;
    
    const tokens: Record<string, string> = {
      ethereum: 'ETH', polygon: 'MATIC', bsc: 'BNB',
      arbitrum: 'ETH', optimism: 'ETH', avalanche: 'AVAX', solana: 'SOL'
    };
    return tokens[chain] || 'UNKNOWN';
  }
}

export default new BlockchainService();