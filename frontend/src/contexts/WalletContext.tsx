
import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface Wallet {
  id: string;
  address: string;
  name: string;
  network: string;
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
  connectWallet: () => void;
  disconnectWallet: () => void;
  addWallet: (wallet: Omit<Wallet, 'id'>) => void;
  removeWallet: (id: string) => void;
  updatePreferences: (preferences: Partial<UserPreferences>) => void;
  exportWallets: () => string;
  importWallets: (data: string) => boolean;
  getWalletName: (walletId: string) => string;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [userWallet, setUserWallet] = useState("");
  const [userAlias, setUserAlias] = useState("");
  const [connectedWallets, setConnectedWallets] = useState<Wallet[]>([
    { id: "1", address: "0x1234...5678", name: "Main Wallet", network: "ethereum" },
    { id: "2", address: "0x9876...5432", name: "Trading Wallet", network: "ethereum" },
    { id: "3", address: "0xabcd...efgh", name: "DeFi Wallet", network: "polygon" }
  ]);
  const [userPreferences, setUserPreferences] = useState<UserPreferences>({
    currency: 'CAD',
    country: 'Canada',
    state: 'Quebec'
  });

  const connectWallet = () => {
    setUserWallet("0x1234567890abcdef");
    setUserAlias("CryptoUser");
    setIsConnected(true);
  };

  const disconnectWallet = () => {
    setIsConnected(false);
    setUserWallet("");
    setUserAlias("");
  };

  const addWallet = (wallet: Omit<Wallet, 'id'>) => {
    const newWallet = {
      ...wallet,
      id: (connectedWallets.length + 1).toString(),
    };
    setConnectedWallets([...connectedWallets, newWallet]);
  };

  const removeWallet = (id: string) => {
    setConnectedWallets(prev => prev.filter(wallet => wallet.id !== id));
  };

  const updatePreferences = (preferences: Partial<UserPreferences>) => {
    setUserPreferences(prev => ({ ...prev, ...preferences }));
  };

  const exportWallets = () => {
    const data = {
      wallets: connectedWallets,
      preferences: userPreferences,
      exportDate: new Date().toISOString()
    };
    return JSON.stringify(data, null, 2);
  };

  const importWallets = (data: string) => {
    try {
      const parsed = JSON.parse(data);
      if (parsed.wallets && Array.isArray(parsed.wallets)) {
        setConnectedWallets(parsed.wallets);
        if (parsed.preferences) {
          setUserPreferences(parsed.preferences);
        }
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

  return (
    <WalletContext.Provider value={{
      isConnected,
      userWallet,
      userAlias,
      connectedWallets,
      userPreferences,
      connectWallet,
      disconnectWallet,
      addWallet,
      removeWallet,
      updatePreferences,
      exportWallets,
      importWallets,
      getWalletName
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
