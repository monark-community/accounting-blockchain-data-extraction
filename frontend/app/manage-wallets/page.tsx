'use client';

import { useState, useEffect } from "react";
import { ArrowLeft, Plus, Trash2, Edit2, Wallet, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/WalletContext";
import { useWallets } from "@/hooks/use-wallets";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { mainnet, polygon, bsc, avalanche, arbitrum, optimism, goerli, sepolia, polygonMumbai } from 'wagmi/chains';

const ManageWallets = () => {
  const { connectedWallets, switchNetwork, currentNetwork, getWalletBalance, isConnected } = useWallet();
  const { wallets: userWallets, loading: walletsLoading, addWallet: addUserWallet, removeWallet: removeUserWallet, updateWallet } = useWallets();
  const { toast } = useToast();
  const router = useRouter();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newWalletAddress, setNewWalletAddress] = useState("");
  const [newWalletName, setNewWalletName] = useState("");
  const [newWalletNetwork, setNewWalletNetwork] = useState("ethereum");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingWallet, setEditingWallet] = useState<{ address: string; name: string } | null>(null);
  const [editWalletName, setEditWalletName] = useState("");
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);
  const [availableNetworks, setAvailableNetworks] = useState<(typeof networks[0] & { balance?: number; isPopular?: boolean })[]>([]);
  const [isDetectingNetworks, setIsDetectingNetworks] = useState(false);
  const [showTestnets, setShowTestnets] = useState(true);

  const networks = [
    // Mainnets
    { value: 'ethereum', label: 'Ethereum', chainId: mainnet.id, type: 'mainnet' },
    { value: 'polygon', label: 'Polygon', chainId: polygon.id, type: 'mainnet' },
    { value: 'bsc', label: 'Binance Smart Chain', chainId: bsc.id, type: 'mainnet' },
    { value: 'avalanche', label: 'Avalanche', chainId: avalanche.id, type: 'mainnet' },
    { value: 'arbitrum', label: 'Arbitrum', chainId: arbitrum.id, type: 'mainnet' },
    { value: 'optimism', label: 'Optimism', chainId: optimism.id, type: 'mainnet' },
    // Testnets
    { value: 'goerli', label: 'Goerli (Testnet)', chainId: goerli.id, type: 'testnet' },
    { value: 'sepolia', label: 'Sepolia (Testnet)', chainId: sepolia.id, type: 'testnet' },
    { value: 'mumbai', label: 'Mumbai (Polygon Testnet)', chainId: polygonMumbai.id, type: 'testnet' }
  ];

  // Most popular networks to show as fallback
  const popularNetworks = [
    { value: 'ethereum', label: 'Ethereum', chainId: mainnet.id, type: 'mainnet', isPopular: true },
    { value: 'polygon', label: 'Polygon', chainId: polygon.id, type: 'mainnet', isPopular: true },
    { value: 'arbitrum', label: 'Arbitrum', chainId: arbitrum.id, type: 'mainnet', isPopular: true },
    { value: 'optimism', label: 'Optimism', chainId: optimism.id, type: 'mainnet', isPopular: true },
    { value: 'sepolia', label: 'Sepolia (Testnet)', chainId: sepolia.id, type: 'testnet', isPopular: true }
  ];

  // Function to detect networks with funds
  const detectAvailableNetworks = async () => {
    setIsDetectingNetworks(true);
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        const networksWithFunds = [];
        const currentAccount = window.ethereum.selectedAddress;
        
        if (!currentAccount && !isConnected) {
          toast({
            title: "No Account Selected",
            description: "Please connect your wallet first to check network balances.",
            variant: "destructive",
          });
          setAvailableNetworks(popularNetworks);
          setIsDetectingNetworks(false);
          return;
        }
        
        // If connected via Web3Auth but no MetaMask account, just show popular networks
        if (!currentAccount && isConnected) {
          setAvailableNetworks(popularNetworks);
          setIsDetectingNetworks(false);
          return;
        }
        
        for (const network of networks) {
          try {
            // Switch to the network first
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: `0x${network.chainId.toString(16)}` }],
            });
            
            // Get balance for the current account on this network
            const balance = await window.ethereum.request({
              method: 'eth_getBalance',
              params: [currentAccount, 'latest'],
            });
            
            // Convert balance from wei to ether
            const balanceInEth = parseInt(balance, 16) / Math.pow(10, 18);
            
            // Only add networks that have funds (balance > 0)
            if (balanceInEth > 0) {
              networksWithFunds.push({
                ...network,
                balance: balanceInEth
              });
            }
          } catch (error: any) {
            // If error code is 4902, the network is not added to MetaMask
            if (error.code !== 4902) {
              // Network exists but might have other issues, try to get balance anyway
              try {
                const balance = await window.ethereum.request({
                  method: 'eth_getBalance',
                  params: [currentAccount, 'latest'],
                });
                const balanceInEth = parseInt(balance, 16) / Math.pow(10, 18);
                if (balanceInEth > 0) {
                  networksWithFunds.push({
                    ...network,
                    balance: balanceInEth
                  });
                }
              } catch (balanceError) {
                console.log(`Could not get balance for ${network.label}:`, balanceError);
              }
            }
          }
        }
        
        // If no networks with funds found, show popular networks as fallback
        if (networksWithFunds.length === 0) {
          setAvailableNetworks(popularNetworks);
          toast({
            title: "No Networks with Funds Found",
            description: "Showing popular networks you can add to your wallet.",
            variant: "destructive",
          });
        } else {
          setAvailableNetworks(networksWithFunds);
          toast({
            title: "Networks with Funds Detected",
            description: `Found ${networksWithFunds.length} networks with available funds.`,
          });
        }
      } catch (error) {
        console.error('Error detecting networks with funds:', error);
        // Fallback to showing popular networks
        setAvailableNetworks(popularNetworks);
        toast({
          title: "Network Detection Failed",
          description: "Showing popular networks you can add to your wallet.",
          variant: "destructive",
        });
      }
    } else {
      // Fallback to showing popular networks if MetaMask is not available
      setAvailableNetworks(popularNetworks);
    }
    setIsDetectingNetworks(false);
  };

  // Detect available networks on component mount
  useEffect(() => {
    detectAvailableNetworks();
  }, []);

  const handleSwitchNetwork = async (chainId: number) => {
    console.log('handleSwitchNetwork called with chainId:', chainId);
    setIsSwitchingNetwork(true);
    try {
      console.log('Calling switchNetwork function');
      await switchNetwork(chainId);
      console.log('switchNetwork completed successfully');
      toast({
        title: "Network Switched",
        description: "Successfully switched network!",
      });
    } catch (error: any) {
      console.error('switchNetwork failed:', error);
      toast({
        title: "Network Switch Failed",
        description: error.message || "Failed to switch network. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSwitchingNetwork(false);
    }
  };

  const handleRefreshBalance = async (address: string) => {
    try {
      const balance = await getWalletBalance(address);
      toast({
        title: "Balance Refreshed",
        description: `Balance: ${balance} ETH`,
      });
    } catch (error: any) {
      toast({
        title: "Failed to Refresh Balance",
        description: error.message || "Failed to get wallet balance.",
        variant: "destructive",
      });
    }
  };

  const handleAddWallet = async () => {
    if (!newWalletAddress.trim() || !newWalletName.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide both wallet address and name.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Get chainId from network value
      const networkConfig = networks.find(n => n.value === newWalletNetwork);
      await addUserWallet(newWalletAddress, newWalletName, networkConfig?.chainId || 1);

      toast({
        title: "Wallet added",
        description: `${newWalletName} has been added successfully.`,
      });

      setNewWalletAddress("");
      setNewWalletName("");
      setNewWalletNetwork("ethereum");
      setIsAddDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Error adding wallet",
        description: error.message || "Failed to add wallet",
        variant: "destructive",
      });
    }
  };

  const handleRemoveWallet = async (address: string, name: string) => {
    try {
      await removeUserWallet(address);
      toast({
        title: "Wallet removed",
        description: `${name} has been removed from your account.`,
      });
    } catch (error: any) {
      toast({
        title: "Error removing wallet",
        description: error.message || "Failed to remove wallet",
        variant: "destructive",
      });
    }
  };

  const handleEditWallet = (address: string, name: string) => {
    setEditingWallet({ address, name });
    setEditWalletName(name);
    setIsEditDialogOpen(true);
  };

  const handleUpdateWallet = async () => {
    if (!editingWallet || !editWalletName.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide a wallet name.",
        variant: "destructive",
      });
      return;
    }

    try {
      await updateWallet(editingWallet.address, editWalletName.trim());
      toast({
        title: "Wallet updated",
        description: `Wallet name has been updated to "${editWalletName.trim()}".`,
      });

      setEditingWallet(null);
      setEditWalletName("");
      setIsEditDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Error updating wallet",
        description: error.message || "Failed to update wallet",
        variant: "destructive",
      });
    }
  };

  // Check if wallet name has changed
  const hasNameChanged = editingWallet && editWalletName.trim() !== editingWallet.name;

  const getNetworkBadgeColor = (network: string) => {
    const colors: Record<string, string> = {
      ethereum: 'bg-blue-100 text-blue-800',
      polygon: 'bg-purple-100 text-purple-800',
      bsc: 'bg-yellow-100 text-yellow-800',
      avalanche: 'bg-red-100 text-red-800',
      solana: 'bg-green-100 text-green-800',
      arbitrum: 'bg-indigo-100 text-indigo-800',
      optimism: 'bg-pink-100 text-pink-800'
    };
    return colors[network] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Navbar />
      <div className="pt-28 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => router.back()}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <h1 className="text-3xl font-bold text-slate-800">Manage Wallets</h1>
            </div>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Add Wallet
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Wallet</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="wallet-name">Wallet Name</Label>
                    <Input
                      id="wallet-name"
                      placeholder="e.g., Trading Wallet"
                      value={newWalletName}
                      onChange={(e) => setNewWalletName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="wallet-address">Wallet Address</Label>
                    <Input
                      id="wallet-address"
                      placeholder="0x..."
                      value={newWalletAddress}
                      onChange={(e) => setNewWalletAddress(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="network">Network</Label>
                    <Select value={newWalletNetwork} onValueChange={setNewWalletNetwork}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {networks.map((network) => (
                          <SelectItem key={network.value} value={network.value}>
                            {network.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button onClick={handleAddWallet} className="flex-1">
                      Add Wallet
                    </Button>
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Edit Wallet Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Wallet Name</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="edit-wallet-name">Wallet Name</Label>
                    <Input
                      id="edit-wallet-name"
                      placeholder="e.g., Trading Wallet"
                      value={editWalletName}
                      onChange={(e) => setEditWalletName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleUpdateWallet();
                        }
                      }}
                    />
                    {editingWallet && (
                      <p className="text-xs text-slate-500 mt-1 font-mono">
                        {editingWallet.address}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button 
                      onClick={handleUpdateWallet} 
                      className="flex-1"
                      disabled={!hasNameChanged || !editWalletName.trim()}
                    >
                      Update Wallet
                    </Button>
                    <Button variant="outline" onClick={() => {
                      setIsEditDialogOpen(false);
                      setEditingWallet(null);
                      setEditWalletName("");
                    }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Network Switching Section */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5" />
                Networks with Funds
                <div className="ml-auto flex gap-2">
                  <Button
                    variant={showTestnets ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowTestnets(!showTestnets)}
                  >
                    {showTestnets ? 'Hide Testnets' : 'Show Testnets'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={detectAvailableNetworks}
                    disabled={isDetectingNetworks}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isDetectingNetworks ? 'animate-spin' : ''}`} />
                    {isDetectingNetworks ? 'Checking Balances...' : 'Refresh Balances'}
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Current Network</p>
                  <p className="font-semibold">{currentNetwork || 'Not Connected'}</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {availableNetworks.length > 0 ? (
                    availableNetworks
                      .filter(network => showTestnets || network.type === 'mainnet')
                      .map((network) => {
                      // Check if current network matches this network
                      const isCurrentNetwork = currentNetwork?.toLowerCase().includes(network.value.toLowerCase()) || 
                                             network.label.toLowerCase() === currentNetwork?.toLowerCase();
                      
                      return (
                        <button
                          key={network.value}
                          onClick={() => handleSwitchNetwork(network.chainId)}
                          disabled={isSwitchingNetwork}
                          className={`
                            relative flex flex-col items-start justify-between gap-2 px-4 py-3 rounded-lg border-2 transition-all duration-200 min-w-[140px] text-left
                            ${isCurrentNetwork 
                              ? 'bg-blue-600 border-blue-600 text-white shadow-md' 
                              : 'bg-white border-slate-200 text-slate-700 hover:border-blue-400 hover:shadow-sm'
                            }
                            ${isSwitchingNetwork ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                            ${network.type === 'testnet' && !isCurrentNetwork ? 'border-orange-200 bg-orange-50' : ''}
                          `}
                        >
                          <div className="flex items-center justify-between w-full gap-2">
                            <span className="font-semibold text-sm truncate">
                              {isSwitchingNetwork ? "Switching..." : network.label}
                            </span>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {network.type === 'testnet' && (
                                <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded uppercase tracking-wide">
                                  TEST
                                </span>
                              )}
                              {network.isPopular && !network.balance && !isCurrentNetwork && (
                                <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded uppercase tracking-wide">
                                  Popular
                                </span>
                              )}
                            </div>
                          </div>
                          {network.balance ? (
                            <span className={`text-xs font-medium ${isCurrentNetwork ? 'text-blue-100' : 'text-slate-500'}`}>
                              {network.balance.toFixed(4)} {network.type === 'testnet' ? 'Test ETH' : 'ETH'}
                            </span>
                          ) : network.isPopular && !isCurrentNetwork ? (
                            <span className="text-xs text-slate-400">
                              Click to add to wallet
                            </span>
                          ) : null}
                        </button>
                      );
                    })
                  ) : (
                    <div className="text-center text-slate-500 py-4">
                      <p className="text-sm">No networks detected</p>
                      <p className="text-xs mt-1">Connect your wallet to see available networks</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            {userWallets.map((wallet) => (
              <Card key={wallet.address} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <Wallet className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{wallet.name}</h3>
                        <p className="text-slate-600 font-mono text-sm">{wallet.address}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getNetworkBadgeColor('ethereum')}`}>
                          Chain ID: {wallet.chain_id}
                        </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleRefreshBalance(wallet.address)}
                        title="Refresh Balance"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleEditWallet(wallet.address, wallet.name)}
                        title="Edit Wallet Name"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveWallet(wallet.address, wallet.name)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {!walletsLoading && userWallets.length === 0 && (
            <Card className="p-12 text-center">
              <Wallet className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-600 mb-2">No wallets connected</h3>
              <p className="text-slate-500">Add your first wallet to start tracking transactions using the button above</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManageWallets;