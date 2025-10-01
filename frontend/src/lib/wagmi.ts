import { createConfig, http } from 'wagmi'
import { mainnet, polygon, bsc, avalanche, arbitrum, optimism, goerli, sepolia, polygonMumbai } from 'wagmi/chains'
import { injected, metaMask, walletConnect } from 'wagmi/connectors'

export const config = createConfig({
  chains: [mainnet, polygon, bsc, avalanche, arbitrum, optimism, goerli, sepolia, polygonMumbai],
  connectors: [
    injected(),
    metaMask(),
    walletConnect({
      projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '1f9b0b8b8b8b8b8b8b8b8b8b8b8b8b8b',
    }),
  ],
  transports: {
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [bsc.id]: http(),
    [avalanche.id]: http(),
    [arbitrum.id]: http(),
    [optimism.id]: http(),
    [goerli.id]: http(),
    [sepolia.id]: http(),
    [polygonMumbai.id]: http(),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
