/**
 * Web3Auth configuration with Openlogin adapter
 * Uses lazy initialization to avoid server-side module loading issues
 */

export function getWeb3AuthConfig() {
  // Only run on client side
  if (typeof window === "undefined") {
    throw new Error(
      "Web3Auth config should only be initialized on client side"
    );
  }

  const clientId = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID;

  if (!clientId) {
    throw new Error(
      "NEXT_PUBLIC_WEB3AUTH_CLIENT_ID is required. Please set it in your environment variables."
    );
  }

  const { OpenloginAdapter } = require("@web3auth/openlogin-adapter");
  const { EthereumPrivateKeyProvider } = require("@web3auth/ethereum-provider");

  // Web3Auth configuration with Openlogin adapter
  const chainConfig = {
    chainNamespace: "eip155" as const,
    chainId: "0x1", // Ethereum mainnet
    rpcTarget: process.env.NEXT_PUBLIC_ANKR_API_KEY
      ? `https://rpc.ankr.com/eth/${process.env.NEXT_PUBLIC_ANKR_API_KEY}`
      : "https://rpc.ankr.com/eth",
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
      network: "mainnet",
      clientId: clientId,
      uxMode: "redirect" as const,
      redirectUrl: `${window.location.origin}/auth`,
    },
    privateKeyProvider: privateKeyProvider,
  });

  // Correct Web3Auth configuration with PrivateKey Provider
  return {
    web3AuthOptions: {
      clientId: clientId,
      web3AuthNetwork: "sapphire_mainnet" as const,
      chainConfig: chainConfig,
      privateKeyProvider: privateKeyProvider,
      storageType: "session" as const,
      mfaSettings: {
        mfaLevel: "optional" as const,
      },
    },
    adapters: [openloginAdapter] as any,
  };
}
