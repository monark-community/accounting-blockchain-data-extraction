// Simplified configuration without adapters
// Adapters are handled automatically by Web3Auth React integration
// Chain configurations
const chainConfig = {
  chainNamespace: 'eip155' as const,
  chainId: '0x1', // Ethereum mainnet
  rpcTarget: 'https://rpc.ankr.com/eth',
  displayName: 'Ethereum Mainnet',
  blockExplorer: 'https://etherscan.io',
  ticker: 'ETH',
  tickerName: 'Ethereum',
}

// Simplified Web3Auth configuration for React
export const web3authConfig = {
  web3AuthOptions: {
    clientId: import.meta.env.VITE_WEB3AUTH_CLIENT_ID || "BFe98cszmbLtc3IRlPEe43JCcz0nGfA-_lIIwxFamwleAtF_WyJRevv26XJ4qs2OKIVJp5iB_QtIpCO2yjNIiJc",
    web3AuthNetwork: 'sapphire_devnet' as const,
    chainConfig: chainConfig,
    uiConfig: {
      theme: {
        primary: '#0F1419',
        secondary: '#1A1F25',
        primaryText: '#ffffff',
        secondaryText: '#ffffff',
        gray: '#ffffff',
      },
      loginMethodsOrder: ['google', 'facebook', 'twitter', 'discord'] as const,
      defaultLanguage: 'en' as const,
      primaryButton: 'externalLogin' as const,
      modalWidth: '500px',
      modalZIndex: '99998',
    },
  },
  // No manual adapter configuration needed - handled by React integration
}
