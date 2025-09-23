import { Alchemy, Network } from "alchemy-sdk";

const NETWORK_MAP: Record<string, Network> = {
  "eth-mainnet": Network.ETH_MAINNET,
  "eth-sepolia": Network.ETH_SEPOLIA,
};

const apiKey = process.env.ALCHEMY_API_KEY!;
const network =
  NETWORK_MAP[process.env.ALCHEMY_NETWORK ?? "eth-sepolia"] ??
  Network.ETH_SEPOLIA;

export const alchemy = new Alchemy({ apiKey, network });
export const currentNetwork = network;
