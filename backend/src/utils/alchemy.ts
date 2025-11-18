// backend/src/utils/alchemy.ts
import { Alchemy, Network } from "alchemy-sdk";

// Map chain IDs to Alchemy networks
const CHAIN_ID_TO_NETWORK: Record<number, Network> = {
  1: Network.ETH_MAINNET, // Ethereum Mainnet
  11155111: Network.ETH_SEPOLIA, // Sepolia Testnet
  5: Network.ETH_GOERLI, // Goerli Testnet (deprecated but still supported)
  137: Network.MATIC_MAINNET, // Polygon Mainnet
  80001: Network.MATIC_MUMBAI, // Polygon Mumbai Testnet
  42161: Network.ARB_MAINNET, // Arbitrum Mainnet
  421614: Network.ARB_SEPOLIA, // Arbitrum Sepolia Testnet
  10: Network.OPT_MAINNET, // Optimism Mainnet
  11155420: Network.OPT_SEPOLIA, // Optimism Sepolia Testnet
  // BSC and Avalanche not supported by Alchemy SDK
  // 56: BNB Mainnet - not available in Alchemy
  // 97: BNB Testnet - not available in Alchemy
  // 43114: Avalanche Mainnet - not available in Alchemy
  // 43113: Avalanche Testnet - not available in Alchemy
};

const apiKey = process.env.ALCHEMY_API_KEY;
if (!apiKey) throw new Error("Missing ALCHEMY_API_KEY");

// Create a function to get Alchemy instance for a specific chain ID
export function getAlchemyForChainId(chainId: number): Alchemy {
  const network = CHAIN_ID_TO_NETWORK[chainId];
  if (!network) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }
  return new Alchemy({ apiKey, network });
}

// Default Alchemy instance (for backward compatibility)
const defaultChainId = 1; // Ethereum Mainnet
export const alchemy = getAlchemyForChainId(defaultChainId);
export const currentNetwork = CHAIN_ID_TO_NETWORK[defaultChainId];

// Helper function to get network name from chain ID
export function getNetworkName(chainId: number): string {
  const networkNames: Record<number, string> = {
    1: "eth-mainnet",
    11155111: "eth-sepolia",
    5: "eth-goerli",
    137: "polygon-mainnet",
    80001: "polygon-mumbai",
    42161: "arbitrum-mainnet",
    421614: "arbitrum-sepolia",
    10: "optimism-mainnet",
    11155420: "optimism-sepolia",
    56: "bsc-mainnet",
    97: "bsc-testnet",
    43114: "avalanche-mainnet",
    43113: "avalanche-testnet",
  };
  return networkNames[chainId] || `chain-${chainId}`;
}
