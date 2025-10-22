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

const wcId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
if (!wcId) throw new Error("Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID");

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
