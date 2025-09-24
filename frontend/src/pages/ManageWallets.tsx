
import { useState } from "react";
import { ArrowLeft, Plus, Trash2, Edit2, Wallet, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/WalletContext";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { mainnet, polygon, bsc, avalanche, arbitrum, optimism } from 'wagmi/chains';

const ManageWallets = () => {
  const { connectedWallets, addWallet, removeWallet, switchNetwork, currentNetwork, getWalletBalance } = useWallet();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newWalletAddress, setNewWalletAddress] = useState("");
  const [newWalletName, setNewWalletName] = useState("");
  const [newWalletNetwork, setNewWalletNetwork] = useState("ethereum");
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);

  const networks = [
    { value: 'ethereum', label: 'Ethereum', chainId: mainnet.id },
    { value: 'polygon', label: 'Polygon', chainId: polygon.id },
    { value: 'bsc', label: 'Binance Smart Chain', chainId: bsc.id },
    { value: 'avalanche', label: 'Avalanche', chainId: avalanche.id },
    { value: 'arbitrum', label: 'Arbitrum', chainId: arbitrum.id },
    { value: 'optimism', label: 'Optimism', chainId: optimism.id }
  ];

  const handleSwitchNetwork = async (chainId: number) => {
    setIsSwitchingNetwork(true);
    try {
      switchNetwork(chainId);
      toast({
        title: "Network Switched",
        description: "Successfully switched network!",
      });
    } catch (error: any) {
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

  const handleAddWallet = () => {
    if (!newWalletAddress.trim() || !newWalletName.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide both wallet address and name.",
        variant: "destructive",
      });
      return;
    }

    addWallet({
      address: newWalletAddress,
      name: newWalletName,
      network: newWalletNetwork
    });

    toast({
      title: "Wallet added",
      description: `${newWalletName} has been added successfully.`,
    });

    setNewWalletAddress("");
    setNewWalletName("");
    setNewWalletNetwork("ethereum");
    setIsAddDialogOpen(false);
  };

  const handleRemoveWallet = (id: string, name: string) => {
    removeWallet(id);
    toast({
      title: "Wallet removed",
      description: `${name} has been removed from your account.`,
    });
  };

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
                onClick={() => navigate(-1)}
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
          </div>

          {/* Network Switching Section */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5" />
                Network Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Current Network</p>
                  <p className="font-semibold">{currentNetwork || 'Not Connected'}</p>
                </div>
                <div className="flex gap-2">
                  {networks.map((network) => (
                    <Button
                      key={network.value}
                      variant={currentNetwork?.toLowerCase() === network.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleSwitchNetwork(network.chainId)}
                      disabled={isSwitchingNetwork}
                    >
                      {isSwitchingNetwork ? "Switching..." : network.label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            {connectedWallets.map((wallet) => (
              <Card key={wallet.id} className="hover:shadow-md transition-shadow">
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
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getNetworkBadgeColor(wallet.network)}`}>
                            {wallet.network}
                          </span>
                          {wallet.balance && (
                            <span className="text-green-600 text-xs font-medium">
                              {parseFloat(wallet.balance).toFixed(4)} ETH
                            </span>
                          )}
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
                      <Button variant="ghost" size="sm">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveWallet(wallet.id, wallet.name)}
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

          {connectedWallets.length === 0 && (
            <Card className="p-12 text-center">
              <Wallet className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-600 mb-2">No wallets connected</h3>
              <p className="text-slate-500 mb-6">Add your first wallet to start tracking transactions</p>
              <Button onClick={() => setIsAddDialogOpen(true)} className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add Your First Wallet
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManageWallets;
