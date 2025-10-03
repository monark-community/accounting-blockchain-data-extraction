import { OpenloginAdapter } from '@web3auth/openlogin-adapter';
import { EthereumPrivateKeyProvider } from '@web3auth/ethereum-provider';

// Web3Auth configuration with Openlogin adapter
const chainConfig = {
  chainNamespace: 'eip155' as const,
  chainId: '0x1', // Ethereum mainnet
  rpcTarget: `https://rpc.ankr.com/eth${import.meta.env.VITE_ANKR_API_KEY ? `/${import.meta.env.VITE_ANKR_API_KEY}` : ''}`,
  displayName: 'Ethereum Mainnet',
  blockExplorer: 'https://etherscan.io',
  ticker: 'ETH',
  tickerName: 'Ethereum',
}

// Initialize Ethereum PrivateKey Provider - REQUIRED FOR WALLET CREATION
const privateKeyProvider = new EthereumPrivateKeyProvider({
  config: { 
    chainConfig: chainConfig 
  },
});

// Initialize Openlogin adapter with PrivateKey Provider
const openloginAdapter = new OpenloginAdapter({
  adapterSettings: {
    network: 'testnet',
    clientId: import.meta.env.VITE_WEB3AUTH_CLIENT_ID || "BFe98cszmbLtc3IRlPEe43JCcz0nGfA-_lIIwxFamwleAtF_WyJRevv26XJ4qs2OKIVJp5iB_QtIpCO2yjNIiJc",
    uxMode: 'redirect' as const,
    redirectUrl: typeof window !== 'undefined' ? `${window.location.origin}/auth` : '/auth',
  },
  privateKeyProvider: privateKeyProvider,
});

// Correct Web3Auth configuration with PrivateKey Provider
export const web3authConfig = {
  web3AuthOptions: {
    clientId: import.meta.env.VITE_WEB3AUTH_CLIENT_ID || "BFe98cszmbLtc3IRlPEe43JCcz0nGfA-_lIIwxFamwleAtF_WyJRevv26XJ4qs2OKIVJp5iB_QtIpCO2yjNIiJc",
    web3AuthNetwork: 'sapphire_devnet' as const,
    chainConfig: chainConfig,
    privateKeyProvider: privateKeyProvider, // ← Also add to main config
  },
  adapters: [openloginAdapter],
}
