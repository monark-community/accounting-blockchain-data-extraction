import { Alchemy, Network } from "alchemy-sdk";

const NETWORK_MAP: Record<string, Network> = {
  "eth-mainnet": Network.ETH_MAINNET,
  "eth-sepolia": Network.ETH_SEPOLIA,
};

const apiKey = process.env.ALCHEMY_API_KEY;
const netStr = process.env.ALCHEMY_NETWORK;

if (!apiKey) throw new Error("Missing ALCHEMY_API_KEY");
if (!netStr || !NETWORK_MAP[netStr]) {
  throw new Error(
    `Invalid ALCHEMY_NETWORK "${netStr}". Use "eth-mainnet" or "eth-sepolia".`
  );
}

export const alchemy = new Alchemy({ apiKey, network: NETWORK_MAP[netStr] });
export const currentNetwork = NETWORK_MAP[netStr];
