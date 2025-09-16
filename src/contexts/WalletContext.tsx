import React, { createContext, useContext, ReactNode } from 'react';
import { 
  useAccount, 
  useConnect, 
  useDisconnect, 
  useSwitchChain,
  useBalance,
  useEnsName,
  useChainId
} from 'wagmi';
import { mainnet, polygon, bsc, avalanche, arbitrum, optimism } from 'wagmi/chains';

export interface Wallet {
  id: string;
  address: string;
  name: string;
  network: string;
  balance?: string;
  ensName?: string;
}

export interface UserPreferences {
  currency: string;
  country: string;
  state: string;
}

interface WalletContextType {
  isConnected: boolean;
  userWallet: string;
  userAlias: string;
  connectedWallets: Wallet[];
  userPreferences: UserPreferences;
  currentNetwork: string;
  isMetaMaskInstalled: boolean;
  connectWallet: () => void;
  disconnectWallet: () => void;
  addWallet: (wallet: Omit<Wallet, 'id'>) => void;
  removeWallet: (id: string) => void;
  updatePreferences: (preferences: Partial<UserPreferences>) => void;
  exportWallets: () => string;
  importWallets: (data: string) => boolean;
  getWalletName: (walletId: string) => string;
  switchNetwork: (chainId: number) => void;
  getWalletBalance: (address: string) => Promise<string>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

// Network configurations
const networks = {
  [mainnet.id]: { name: 'Ethereum Mainnet', chainId: mainnet.id },
  [polygon.id]: { name: 'Polygon', chainId: polygon.id },
  [bsc.id]: { name: 'BSC', chainId: bsc.id },
  [avalanche.id]: { name: 'Avalanche', chainId: avalanche.id },
  [arbitrum.id]: { name: 'Arbitrum', chainId: arbitrum.id },
  [optimism.id]: { name: 'Optimism', chainId: optimism.id }
};

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const chainId = useChainId();
  
  // Get balance and ENS name for connected wallet
  const { data: balance } = useBalance({
    address: address,
  });
  
  const { data: ensName } = useEnsName({
    address: address,
  });

  // Check if MetaMask is installed
  const isMetaMaskInstalled = typeof window !== 'undefined' && 
    connectors.some(connector => connector.name === 'MetaMask');

  // Get current network name
  const currentNetwork = networks[chainId]?.name || 'Unknown Network';

  // Create wallet data from connected account
  const connectedWallets: Wallet[] = address ? [{
    id: address,
    address,
    name: ensName || `Main Wallet`,
    network: currentNetwork.toLowerCase(),
    balance: balance ? balance.formatted : undefined,
    ensName
  }] : [];

  const userWallet = address || "";
  const userAlias = ensName || (address ? `Wallet ${address.slice(0, 6)}...${address.slice(-4)}` : "");

  const connectWallet = () => {
    const metaMaskConnector = connectors.find(connector => connector.name === 'MetaMask');
    if (metaMaskConnector) {
      connect({ connector: metaMaskConnector });
    }
  };

  const disconnectWallet = () => {
    disconnect();
  };

  const addWallet = (wallet: Omit<Wallet, 'id'>) => {
    // In Wagmi, we don't manually add wallets - they're managed by the wallet provider
    console.log('Wallet addition handled by wallet provider:', wallet);
  };

  const removeWallet = (id: string) => {
    // In Wagmi, we don't manually remove wallets - they're managed by the wallet provider
    console.log('Wallet removal handled by wallet provider:', id);
  };

  const updatePreferences = (preferences: Partial<UserPreferences>) => {
    // This would typically be stored in localStorage or a backend
    console.log('Preferences updated:', preferences);
  };

  const exportWallets = () => {
    const data = {
      wallets: connectedWallets,
      preferences: {
        currency: 'CAD',
        country: 'Canada',
        state: 'Quebec'
      },
      exportDate: new Date().toISOString()
    };
    return JSON.stringify(data, null, 2);
  };

  const importWallets = (data: string) => {
    try {
      const parsed = JSON.parse(data);
      if (parsed.wallets && Array.isArray(parsed.wallets)) {
        // In Wagmi, wallet management is handled by the wallet provider
        console.log('Wallet import handled by wallet provider:', parsed.wallets);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const getWalletName = (walletId: string) => {
    const wallet = connectedWallets.find(w => w.id === walletId);
    return wallet ? wallet.name : 'Unknown Wallet';
  };

  const switchNetworkHandler = (chainId: number) => {
    switchChain({ chainId: chainId as any });
  };

  const getWalletBalance = async (address: string): Promise<string> => {
    // This would use Wagmi's useBalance hook in a component
    // For now, return the current balance if it matches the address
    if (address === userWallet && balance) {
      return balance.formatted;
    }
    return "0";
  };

  const userPreferences: UserPreferences = {
    currency: 'CAD',
    country: 'Canada',
    state: 'Quebec'
  };

  return (
    <WalletContext.Provider value={{
      isConnected,
      userWallet,
      userAlias,
      connectedWallets,
      userPreferences,
      currentNetwork,
      isMetaMaskInstalled,
      connectWallet,
      disconnectWallet,
      addWallet,
      removeWallet,
      updatePreferences,
      exportWallets,
      importWallets,
      getWalletName,
      switchNetwork: switchNetworkHandler,
      getWalletBalance
    }}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};