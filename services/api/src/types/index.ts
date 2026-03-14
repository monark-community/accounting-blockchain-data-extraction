import { Request } from 'express';

// Request avec userId pour les routes authentifiées
export interface AuthRequest extends Request {
  userId?: string;
}

// Chaînes supportées
export const SUPPORTED_CHAINS = [
  'ethereum',
  'polygon',
  'bsc',
  'arbitrum',
  'optimism',
  'avalanche',
  'solana'
] as const;

export type SupportedChain = typeof SUPPORTED_CHAINS[number];

// Catégories de transactions
export const TRANSACTION_CATEGORIES = [
  'revenue',
  'expense',
  'transfer',
  'swap',
  'staking',
  'reward',
  'fee',
  'other'
] as const;

export type TransactionCategory = typeof TRANSACTION_CATEGORIES[number];