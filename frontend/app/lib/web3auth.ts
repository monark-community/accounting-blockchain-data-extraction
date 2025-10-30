import { OpenloginAdapter } from "@web3auth/openlogin-adapter";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";

// Web3Auth configuration with Openlogin adapter
const chainConfig = {
  chainNamespace: "eip155" as const,
  chainId: "0x1", // Ethereum mainnet
  rpcTarget: `https://rpc.ankr.com/eth${
    process.env.NEXT_PUBLIC_ANKR_API_KEY
      ? `/${process.env.NEXT_PUBLIC_ANKR_API_KEY}`
      : ""
  }`,
  displayName: "Ethereum Mainnet",
  blockExplorer: "https://etherscan.io",
  ticker: "ETH",
  tickerName: "Ethereum",
};

// Initialize Ethereum PrivateKey Provider - REQUIRED FOR WALLET CREATION
const privateKeyProvider = new EthereumPrivateKeyProvider({
  config: {
    chainConfig: chainConfig,
  },
});

// Initialize Openlogin adapter with PrivateKey Provider
const openloginAdapter = new OpenloginAdapter({
  adapterSettings: {
    network: "testnet",
    clientId: process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID!,
    uxMode: "redirect" as const,
    redirectUrl:
      typeof window !== "undefined"
        ? `${window.location.origin}/auth`
        : "/auth",
  },
  privateKeyProvider: privateKeyProvider,
});

// Correct Web3Auth configuration with PrivateKey Provider
export const web3authConfig = {
  web3AuthOptions: {
    clientId: process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID!,
    web3AuthNetwork: "sapphire_devnet" as const,
    chainConfig: chainConfig,
    privateKeyProvider: privateKeyProvider, // ← Also add to main config
    mfaSettings: {
      mfaLevel: 'optional' as const, // Users can enable 2FA if they want
    },
  },
  adapters: [openloginAdapter] as any,
};
