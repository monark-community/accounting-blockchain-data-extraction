// backend/src/config/covalent.ts

import type { EvmNetwork } from "./networks";

const COVALENT_API_BASE = "https://api.covalenthq.com/v1";

/**
 * Map our internal network names to Covalent chain IDs
 * Reference: https://www.covalenthq.com/docs/networks
 */
export const COVALENT_CHAIN_IDS: Record<EvmNetwork, number | null> = {
  "mainnet": 1, // Ethereum Mainnet
  "bsc": 56, // Binance Smart Chain
  "polygon": 137, // Polygon
  "optimism": 10, // Optimism
  "base": 8453, // Base
  "arbitrum-one": 42161, // Arbitrum One
  "avalanche": 43114, // Avalanche C-Chain
  "unichain": null, // Unichain - not supported by Covalent
};

/**
 * Get Covalent API key from environment
 */
export function getCovalentApiKey(): string | null {
  return process.env.COVALENT_API_KEY || null;
}

/**
 * Check if Covalent is configured
 */
export function isCovalentConfigured(): boolean {
  return getCovalentApiKey() !== null;
}

/**
 * Get Covalent chain ID for a network
 * Returns null if network is not supported by Covalent
 */
export function getCovalentChainId(network: EvmNetwork): number | null {
  return COVALENT_CHAIN_IDS[network];
}

/**
 * Check if a network is supported by Covalent
 */
export function isNetworkSupportedByCovalent(network: EvmNetwork): boolean {
  return getCovalentChainId(network) !== null;
}

/**
 * Get Covalent API base URL
 */
export function getCovalentApiBase(): string {
  return COVALENT_API_BASE;
}

