import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
} from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
  useBalance,
  useEnsName,
  useChainId,
} from "wagmi";
import { useWeb3Auth } from "@web3auth/no-modal-react-hooks";
import {
  mainnet,
  polygon,
  bsc,
  avalanche,
  arbitrum,
  optimism,
} from "wagmi/chains";

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
  chainId: number;
  isMetaMaskInstalled: boolean;
  connectError: Error | null;
  isPending: boolean;
  isLoggingOut: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  addWallet: (wallet: Omit<Wallet, "id">) => void;
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
  [mainnet.id]: { name: "Ethereum Mainnet", chainId: mainnet.id },
  [polygon.id]: { name: "Polygon", chainId: polygon.id },
  [bsc.id]: { name: "BSC", chainId: bsc.id },
  [avalanche.id]: { name: "Avalanche", chainId: avalanche.id },
  [arbitrum.id]: { name: "Arbitrum", chainId: arbitrum.id },
  [optimism.id]: { name: "Optimism", chainId: optimism.id },
};

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const { address, isConnected } = useAccount();
  const {
    connect,
    connectors,
    error: connectError,
    isPending,
    reset,
  } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const chainId = useChainId();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Web3Auth integration
  const web3auth = useWeb3Auth();

  // Get balance and ENS name for connected wallet
  const { data: balance } = useBalance({
    address: address,
  });

  const { data: ensName } = useEnsName({
    address: address,
  });

  // Check if MetaMask is installed
  const isMetaMaskInstalled =
    typeof window !== "undefined" &&
    connectors.some((connector) => connector.name === "MetaMask");

  // Get current network name
  const currentNetwork = networks[chainId]?.name || "Unknown Network";

  // Check Web3Auth connection status
  const web3AuthIsConnected = web3auth?.isConnected || false;
  // Get Web3Auth wallet address using getAccount() method
  const [web3AuthAddress, setWeb3AuthAddress] = useState<string>("");
  const web3AuthUserInfo = web3auth?.userInfo;

  // Get Web3Auth account address when connected
  useEffect(() => {
    const getWeb3AuthAccount = async () => {
      if (web3AuthIsConnected && web3auth?.web3Auth?.provider) {
        try {
          const provider = web3auth.web3Auth.provider;
          const accounts = (await provider.request({
            method: "eth_accounts",
          })) as string[];
          if (accounts && accounts.length > 0) {
            setWeb3AuthAddress(accounts[0]);
          }
        } catch (error) {
          console.error("Error getting Web3Auth account:", error);
        }
      } else {
        setWeb3AuthAddress("");
      }
    };

    getWeb3AuthAccount();
  }, [web3AuthIsConnected, web3auth]);

  // Listen for Web3Auth connection events
  useEffect(() => {
    if (web3auth?.web3Auth) {
      const handleAccountChange = () => {
        console.log("Web3Auth account changed, updating address");
        // Trigger a re-fetch of the account
        setTimeout(() => {
          const getAccount = async () => {
            try {
              if (web3auth?.web3Auth?.provider) {
                const provider = web3auth.web3Auth.provider;
                const accounts = (await provider.request({
                  method: "eth_accounts",
                })) as string[];
                if (accounts && accounts.length > 0) {
                  setWeb3AuthAddress(accounts[0]);
                }
              }
            } catch (error) {
              console.error("Error updating Web3Auth account:", error);
            }
          };
          getAccount();
        }, 1000);
      };

      // Add event listeners for Web3Auth events
      web3auth.web3Auth.on("connected", handleAccountChange);
      web3auth.web3Auth.on("disconnected", () => {
        setWeb3AuthAddress("");
      });

      return () => {
        // Clean up event listeners
        web3auth.web3Auth?.off("connected", handleAccountChange);
        web3auth.web3Auth?.off("disconnected", () => {
          setWeb3AuthAddress("");
        });
      };
    }
  }, [web3auth?.web3Auth]);

  // Debug log to see what Web3Auth provides
  // useEffect(() => {
  //   if (web3auth) {
  //     console.log('Web3Auth debug info:', {
  //       isConnected: web3auth.isConnected,
  //       userInfo: web3auth.userInfo,
  //       web3AuthAddress: web3AuthAddress,
  //       allProperties: Object.keys(web3auth)
  //     });
  //   }
  // }, [web3auth, web3AuthAddress]);

  // Determine the primary wallet address (prioritize MetaMask over Web3Auth)
  const primaryAddress = address || web3AuthAddress;
  const primaryIsConnected = isConnected || web3AuthIsConnected;

  // Create wallet data from connected account
  const connectedWallets: Wallet[] = [];

  // Add MetaMask wallet if connected
  if (address) {
    connectedWallets.push({
      id: address,
      address,
      name: ensName || `MetaMask Wallet`,
      network: currentNetwork.toLowerCase(),
      balance: balance ? balance.formatted : undefined,
      ensName,
    });
  }

  // Add Web3Auth wallet if connected (avoid duplicates)
  if (web3AuthAddress && !address) {
    const userName =
      (web3AuthUserInfo as any)?.name ||
      (web3AuthUserInfo as any)?.email ||
      "Social Wallet";
    connectedWallets.push({
      id: web3AuthAddress,
      address: web3AuthAddress,
      name: userName,
      network: currentNetwork.toLowerCase(),
      balance: undefined, // Web3Auth doesn't provide balance directly
      ensName: undefined,
    });
    // Debug log to verify Web3Auth integration
    console.log("Web3Auth wallet detected:", {
      address: web3AuthAddress,
      userName,
      userInfo: web3AuthUserInfo,
    });
  }

  const userWallet = primaryAddress;
  const userAlias =
    ensName ||
    (web3AuthUserInfo as any)?.name ||
    (web3AuthUserInfo as any)?.email ||
    "" ||
    (primaryAddress
      ? `Wallet ${primaryAddress.slice(0, 6)}...${primaryAddress.slice(-4)}`
      : "");

  const connectWallet = async () => {
    const metaMaskConnector = connectors.find(
      (connector) => connector.name === "MetaMask"
    );
    if (metaMaskConnector) {
      // Reset any previous connection errors before attempting new connection
      reset();
      return connect({ connector: metaMaskConnector });
    } else {
      throw new Error("MetaMask connector not found");
    }
  };

  const disconnectWallet = async () => {
    setIsLoggingOut(true);
    try {
      // Disconnect Web3Auth first if connected
      if (web3AuthIsConnected && web3auth?.web3Auth) {
        await web3auth.web3Auth.logout();
      }
      // Also disconnect from Wagmi if connected
      if (isConnected) {
        disconnect();
      }
    } catch (error) {
      console.error("Disconnect error:", error);
      // Fallback to wagmi disconnect
      disconnect();
    }
  };

  const addWallet = (wallet: Omit<Wallet, "id">) => {
    // In Wagmi, we don't manually add wallets - they're managed by the wallet provider
    console.log("Wallet addition handled by wallet provider:", wallet);
  };

  const removeWallet = (id: string) => {
    // In Wagmi, we don't manually remove wallets - they're managed by the wallet provider
    console.log("Wallet removal handled by wallet provider:", id);
  };

  const updatePreferences = (preferences: Partial<UserPreferences>) => {
    // This would typically be stored in localStorage or a backend
    console.log("Preferences updated:", preferences);
  };

  const exportWallets = () => {
    const data = {
      wallets: connectedWallets,
      preferences: {
        currency: "CAD",
        country: "Canada",
        state: "Quebec",
      },
      exportDate: new Date().toISOString(),
    };
    return JSON.stringify(data, null, 2);
  };

  const importWallets = (data: string) => {
    try {
      const parsed = JSON.parse(data);
      if (parsed.wallets && Array.isArray(parsed.wallets)) {
        // In Wagmi, wallet management is handled by the wallet provider
        console.log(
          "Wallet import handled by wallet provider:",
          parsed.wallets
        );
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const getWalletName = (walletId: string) => {
    const wallet = connectedWallets.find((w) => w.id === walletId);
    return wallet ? wallet.name : "Unknown Wallet";
  };

  const switchNetworkHandler = async (chainId: number) => {
    console.log("Attempting to switch to chain ID:", chainId);

    if (!window.ethereum) {
      throw new Error("MetaMask is not installed");
    }

    try {
      // First try to switch to the network using MetaMask API directly
      console.log(
        "Calling wallet_switchEthereumChain with chainId:",
        `0x${chainId.toString(16)}`
      );
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });
      console.log("Network switched successfully");
    } catch (error: any) {
      console.log("Switch failed with error:", error);

      // If the network is not added to MetaMask (error code 4902), add it first
      if (error.code === 4902) {
        console.log("Network not found, attempting to add network");
        const networkConfig = getNetworkConfig(chainId);
        if (networkConfig) {
          try {
            console.log("Adding network with config:", networkConfig);
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [networkConfig],
            });
            console.log("Network added successfully, switching now");
            // After adding, try to switch again
            await window.ethereum.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: `0x${chainId.toString(16)}` }],
            });
            console.log("Network switched after adding");
          } catch (addError) {
            console.error("Failed to add network:", addError);
            throw addError;
          }
        } else {
          throw new Error(
            `Network configuration not found for chain ID ${chainId}`
          );
        }
      } else {
        throw error;
      }
    }
  };

  // Helper function to get network configuration for adding to MetaMask
  const getNetworkConfig = (chainId: number) => {
    const networkConfigs: Record<number, any> = {
      1: {
        chainId: "0x1",
        chainName: "Ethereum Mainnet",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: ["https://mainnet.infura.io/v3/"],
        blockExplorerUrls: ["https://etherscan.io"],
      },
      137: {
        chainId: "0x89",
        chainName: "Polygon Mainnet",
        nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
        rpcUrls: ["https://polygon-rpc.com/"],
        blockExplorerUrls: ["https://polygonscan.com"],
      },
      56: {
        chainId: "0x38",
        chainName: "BNB Smart Chain",
        nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
        rpcUrls: ["https://bsc-dataseed.binance.org/"],
        blockExplorerUrls: ["https://bscscan.com"],
      },
      43114: {
        chainId: "0xa86a",
        chainName: "Avalanche C-Chain",
        nativeCurrency: { name: "AVAX", symbol: "AVAX", decimals: 18 },
        rpcUrls: ["https://api.avax.network/ext/bc/C/rpc"],
        blockExplorerUrls: ["https://snowtrace.io"],
      },
      42161: {
        chainId: "0xa4b1",
        chainName: "Arbitrum One",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: ["https://arb1.arbitrum.io/rpc"],
        blockExplorerUrls: ["https://arbiscan.io"],
      },
      10: {
        chainId: "0xa",
        chainName: "Optimism",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: ["https://mainnet.optimism.io"],
        blockExplorerUrls: ["https://optimistic.etherscan.io"],
      },
      5: {
        chainId: "0x5",
        chainName: "Goerli Testnet",
        nativeCurrency: { name: "Goerli Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: ["https://goerli.infura.io/v3/"],
        blockExplorerUrls: ["https://goerli.etherscan.io"],
      },
      11155111: {
        chainId: "0xaa36a7",
        chainName: "Sepolia Testnet",
        nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: ["https://sepolia.infura.io/v3/"],
        blockExplorerUrls: ["https://sepolia.etherscan.io"],
      },
      80001: {
        chainId: "0x13881",
        chainName: "Mumbai Testnet",
        nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
        rpcUrls: ["https://rpc-mumbai.maticvigil.com/"],
        blockExplorerUrls: ["https://mumbai.polygonscan.com"],
      },
    };
    return networkConfigs[chainId];
  };

  const getWalletBalance = async (address: string): Promise<string> => {
    // This would use Wagmi's useBalance hook in a component
    // For now, return the current balance if it matches the address
    if (address === userWallet && balance) {
      return balance.formatted;
    }
    return "0";
  };

  // Reset isLoggingOut when disconnect completes
  useEffect(() => {
    if (!isConnected && isLoggingOut) {
      setIsLoggingOut(false);
    }
  }, [isConnected, isLoggingOut]);

  const userPreferences: UserPreferences = {
    currency: "CAD",
    country: "Canada",
    state: "Quebec",
  };

  return (
    <WalletContext.Provider
      value={{
        isConnected: primaryIsConnected,
        userWallet,
        userAlias,
        connectedWallets,
        userPreferences,
        currentNetwork,
        chainId,
        isMetaMaskInstalled,
        connectError,
        isPending,
        isLoggingOut,
        connectWallet,
        disconnectWallet,
        addWallet,
        removeWallet,
        updatePreferences,
        exportWallets,
        importWallets,
        getWalletName,
        switchNetwork: switchNetworkHandler,
        getWalletBalance,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
};
