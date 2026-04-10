/**
 * Pinax Endpoint Configuration
 */

export interface PinaxEndpointConfig {
  baseUrl: string;
  network: string;
}

const BASE_URL = 'https://token-api.thegraph.com';

export const PINAX_ENDPOINTS: Record<string, PinaxEndpointConfig> = {

  ethereum: {
    baseUrl: BASE_URL,
    network: 'mainnet'
  },

  polygon: {
    baseUrl: BASE_URL,
    network: 'matic'
  },  // ← VIRGULE AJOUTÉE ICI

  bsc: {
    baseUrl: BASE_URL,
    network: 'bsc'
  },

  arbitrum: {
    baseUrl: BASE_URL,
    network: 'arbitrum-one'
  },

  optimism: {
    baseUrl: BASE_URL,
    network: 'optimism'
  },

  avalanche: {
    baseUrl: BASE_URL,
    network: 'avalanche'
  }
};

/**
 * Helper pour récupérer config
 */
export function getPinaxEndpoint(chain: string): PinaxEndpointConfig {
  const config = PINAX_ENDPOINTS[chain];

  if (!config) {
    throw new Error(`Unsupported chain: ${chain}`);
  }

  return config;
}