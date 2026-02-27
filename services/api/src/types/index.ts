import { Request } from 'express';

/**
 * Extended Express Request with userId from JWT
 */
export interface AuthRequest extends Request {
  userId?: string;
}

/**
 * DTO for creating a new wallet
 */
export interface CreateWalletDto {
  address: string;
  chain: string;
  label?: string;
  isPrimary?: boolean;
}

/**
 * DTO for updating a transaction
 */
export interface UpdateTransactionDto {
  category?: string;
  isInternal?: boolean;
  notes?: string;
  tags?: string[];
}

/**
 * Pagination query parameters
 */
export interface PaginationQuery {
  page?: number;
  limit?: number;
}

/**
 * Transaction filtering parameters
 */
export interface TransactionFilters {
  walletId?: string;
  chain?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Transaction categories for classification
 */
export type TransactionCategory =
  | 'revenue'
  | 'expense'
  | 'transfer'
  | 'swap'
  | 'gas'
  | 'fee'
  | 'spam'
  | 'reward';

/**
 * Supported blockchain networks
 */
export const SUPPORTED_CHAINS = [
  'ethereum',
  'polygon',
  'bsc',
  'arbitrum',
  'optimism',
  'avalanche',
  'solana',
] as const;

export type SupportedChain = (typeof SUPPORTED_CHAINS)[number];
