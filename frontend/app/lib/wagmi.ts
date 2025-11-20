import { createConfig, http } from "wagmi";
import {
  mainnet,
  polygon,
  bsc,
  avalanche,
  arbitrum,
  optimism,
  goerli,
  sepolia,
  polygonMumbai,
} from "wagmi/chains";
import { injected, metaMask, walletConnect } from "wagmi/connectors";

const wcId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "e39f5e338ac4bd21a11e8ccb91d2ad90";
if (wcId === "placeholder_walletconnect_id") {
  console.warn("⚠️ NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID not set. WalletConnect won't work.");
}

export const config = createConfig({
  chains: [
    mainnet,
    polygon,
    bsc,
    avalanche,
    arbitrum,
    optimism,
    goerli,
    sepolia,
    polygonMumbai,
  ],
  connectors: [injected(), metaMask(), walletConnect({ projectId: wcId })],
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
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
