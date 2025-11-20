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

  const clientId =
    process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID ||
    "BIx-z-wuZBd1kin7X-dhH0Y0-lhePnm_1e4JnpzWQWB1NgBgigLUifarfWCMEChxeI0DwTRuusaVjncM2-_4EMg";

  if (!process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID) {
    console.warn(
      "⚠️ NEXT_PUBLIC_WEB3AUTH_CLIENT_ID not set. Using placeholder. Auth won't work properly."
    );
  }

  const { OpenloginAdapter } = require("@web3auth/openlogin-adapter");
  const { EthereumPrivateKeyProvider } = require("@web3auth/ethereum-provider");

  // Web3Auth configuration with Openlogin adapter
  const chainConfig = {
    chainNamespace: "eip155" as const,
    chainId: "0x1", // Ethereum mainnet
    rpcTarget: `https://rpc.ankr.com/eth${
      process.env.NEXT_PUBLIC_ANKR_API_KEY
        ? `/${process.env.NEXT_PUBLIC_ANKR_API_KEY}`
        : "/359d37c2dbd7ba5a4efe63395d64587af0264b2aef5659b0411cfc662aa26d9e"
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
