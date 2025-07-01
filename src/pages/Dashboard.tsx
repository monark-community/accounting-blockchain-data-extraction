import { useState, useMemo } from "react";
import { TrendingUp, TrendingDown, Repeat, Coins, Calculator, PieChart, Plus, Settings, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Navbar from "@/components/Navbar";
import { CapitalGainsCalculator, parseAssetFromAmount, parseSwapTransaction, type CapitalGainEntry, type AccountingMethod } from "@/utils/capitalGains";
import IncomeTab from "@/components/dashboard/IncomeTab";
import ExpensesTab from "@/components/dashboard/ExpensesTab";
import CapitalGainsTab from "@/components/dashboard/CapitalGainsTab";
import AllTransactionsTab from "@/components/dashboard/AllTransactionsTab";

const Dashboard = () => {
  const [isWalletDialogOpen, setIsWalletDialogOpen] = useState(false);
  const [isManageWalletsDialogOpen, setIsManageWalletsDialogOpen] = useState(false);
  const [newWalletAddress, setNewWalletAddress] = useState("");
  const [accountingMethod, setAccountingMethod] = useState<AccountingMethod>('FIFO');

  // Connected wallets
  const [connectedWallets, setConnectedWallets] = useState([
    { id: "1", address: "0x1234...5678", name: "Main Wallet", network: "ethereum" },
    { id: "2", address: "0x9876...5432", name: "Trading Wallet", network: "ethereum" },
    { id: "3", address: "0xabcd...efgh", name: "DeFi Wallet", network: "polygon" }
  ]);

  // Add wallet function
  const addWallet = () => {
    if (newWalletAddress.trim()) {
      const newWallet = {
        id: (connectedWallets.length + 1).toString(),
        address: newWalletAddress,
        name: `Wallet ${connectedWallets.length + 1}`,
        network: "ethereum" // Default network
      };
      setConnectedWallets([...connectedWallets, newWallet]);
      setNewWalletAddress("");
      setIsWalletDialogOpen(false);
    }
  };

  // Get wallet name function
  const getWalletName = (walletId: string) => {
    const wallet = connectedWallets.find(w => w.id === walletId);
    return wallet ? wallet.name : 'Unknown Wallet';
  };

  // All transactions
  const allTransactions = [
    {
      id: "1",
      date: "2024-06-15",
      description: "Freelance Payment - Web3 Consulting",
      amount: "2.5 ETH",
      usdValue: 6250.00,
      hash: "0x1234...5678",
      type: "income" as const,
      network: "ethereum",
      walletId: "1"
    },
    {
      id: "2",
      date: "2024-06-13",
      description: "DAO Governance Reward",
      amount: "150.0 COMP",
      usdValue: 8250.00,
      hash: "0x9876...5432",
      type: "income" as const,
      network: "ethereum",
      walletId: "1"
    },
    {
      id: "3",
      date: "2024-06-14",
      description: "USDC → ETH",
      amount: "-1000 USDC / +0.4 ETH",
      usdValue: 0.00,
      hash: "0xabcd...efgh",
      type: "swap" as const,
      network: "ethereum",
      walletId: "2"
    },
    {
      id: "4",
      date: "2024-06-12",
      description: "ETH → USDT",
      amount: "-0.5 ETH / +1250 USDT",
      usdValue: 0.00,
      hash: "0xdef0...1234",
      type: "swap" as const,
      network: "ethereum",
      walletId: "1"
    },
    {
      id: "5",
      date: "2024-06-11",
      description: "DeFi Protocol Fee",
      amount: "-25 USDC",
      usdValue: -25.00,
      hash: "0x5678...90ab",
      type: "expense" as const,
      network: "ethereum",
      walletId: "2"
    },
    {
      id: "6",
      date: "2024-06-10",
      description: "Uniswap LP Rewards",
      amount: "0.15 ETH",
      usdValue: 375.00,
      hash: "0x1111...2222",
      type: "income" as const,
      network: "ethereum",
      walletId: "1"
    },
    {
      id: "7",
      date: "2024-06-09",
      description: "MATIC → USDC",
      amount: "-500 MATIC / +350 USDC",
      usdValue: 0.00,
      hash: "0x3333...4444",
      type: "swap" as const,
      network: "polygon",
      walletId: "3"
    },
    {
      id: "8",
      date: "2024-06-08",
      description: "Polygon Bridge Fee",
      amount: "-5.2 MATIC",
      usdValue: -3.64,
      hash: "0x5555...6666",
      type: "expense" as const,
      network: "polygon",
      walletId: "3"
    },
    {
      id: "9",
      date: "2024-06-07",
      description: "NFT Sale Proceeds",
      amount: "3.8 ETH",
      usdValue: 9500.00,
      hash: "0x7777...8888",
      type: "income" as const,
      network: "ethereum",
      walletId: "1"
    },
    {
      id: "10",
      date: "2024-06-06",
      description: "Aave Interest Payment",
      amount: "45.6 USDC",
      usdValue: 45.60,
      hash: "0x9999...aaaa",
      type: "income" as const,
      network: "ethereum",
      walletId: "2"
    },
    {
      id: "11",
      date: "2024-06-05",
      description: "SOL → USDC",
      amount: "-25 SOL / +875 USDC",
      usdValue: 0.00,
      hash: "0xbbbb...cccc",
      type: "swap" as const,
      network: "solana",
      walletId: "1"
    },
    {
      id: "12",
      date: "2024-06-04",
      description: "Solana Staking Reward",
      amount: "2.1 SOL",
      usdValue: 73.50,
      hash: "0xdddd...eeee",
      type: "income" as const,
      network: "solana",
      walletId: "1"
    },
    {
      id: "13",
      date: "2024-06-03",
      description: "Gas Fee Refund",
      amount: "0.02 ETH",
      usdValue: 50.00,
      hash: "0xffff...0000",
      type: "income" as const,
      network: "ethereum",
      walletId: "2"
    },
    {
      id: "14",
      date: "2024-06-02",
      description: "BNB → BUSD",
      amount: "-5 BNB / +1250 BUSD",
      usdValue: 0.00,
      hash: "0x1010...1111",
      type: "swap" as const,
      network: "bsc",
      walletId: "1"
    },
    {
      id: "15",
      date: "2024-06-01",
      description: "PancakeSwap LP Fee",
      amount: "-0.5 BNB",
      usdValue: -125.00,
      hash: "0x1212...1313",
      type: "expense" as const,
      network: "bsc",
      walletId: "1"
    },
    {
      id: "16",
      date: "2024-05-31",
      description: "Yield Farming Reward",
      amount: "125.4 CAKE",
      usdValue: 628.00,
      hash: "0x1414...1515",
      type: "income" as const,
      network: "bsc",
      walletId: "1"
    },
    {
      id: "17",
      date: "2024-05-30",
      description: "AVAX Staking Reward",
      amount: "1.8 AVAX",
      usdValue: 45.00,
      hash: "0x1616...1717",
      type: "income" as const,
      network: "avalanche",
      walletId: "2"
    },
    {
      id: "18",
      date: "2024-05-29",
      description: "Cross-chain Bridge",
      amount: "-100 USDC",
      usdValue: -5.00,
      hash: "0x1818...1919",
      type: "expense" as const,
      network: "ethereum",
      walletId: "3"
    }
  ];

  // Calculate capital gains using the transactions
  const capitalGainsData = useMemo(() => {
    const calculator = new CapitalGainsCalculator(accountingMethod);
    const realizedGains: CapitalGainEntry[] = [];
    
    // Mock current prices for unrealized gains calculation
    const currentPrices = new Map([
      ['ETH', 2500],
      ['USDC', 1],
      ['USDT', 1],
      ['COMP', 55],
      ['MATIC', 0.7],
      ['SOL', 35],
      ['BNB', 250],
      ['BUSD', 1],
      ['CAKE', 5],
      ['AVAX', 25]
    ]);

    // Sort transactions by date to process in chronological order
    const sortedTransactions = [...allTransactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    for (const tx of sortedTransactions) {
      if (tx.type === 'income') {
        // Add to cost basis
        const { asset, quantity } = parseAssetFromAmount(tx.amount);
        if (asset !== 'UNKNOWN' && quantity > 0) {
          calculator.addToCostBasis({
            id: tx.id,
            asset,
            quantity,
            costBasis: Math.abs(tx.usdValue),
            purchaseDate: tx.date,
            purchasePrice: Math.abs(tx.usdValue) / quantity
          });
        }
      } else if (tx.type === 'swap') {
        // Handle swap transactions
        const { sold, bought } = parseSwapTransaction(tx.amount);
        
        if (sold.asset !== 'UNKNOWN' && sold.quantity > 0) {
          // Calculate gains for sold asset
          const salePrice = currentPrices.get(sold.asset) || 0;
          const gains = calculator.calculateGains(
            sold.asset,
            sold.quantity,
            salePrice,
            tx.date,
            tx.id
          );
          realizedGains.push(...gains);
        }
        
        if (bought.asset !== 'UNKNOWN' && bought.quantity > 0) {
          // Add bought asset to cost basis
          const purchasePrice = currentPrices.get(bought.asset) || 0;
          calculator.addToCostBasis({
            id: `${tx.id}_buy`,
            asset: bought.asset,
            quantity: bought.quantity,
            costBasis: purchasePrice * bought.quantity,
            purchaseDate: tx.date,
            purchasePrice
          });
        }
      }
    }

    const unrealizedGains = calculator.getUnrealizedGains(currentPrices);

    return {
      realized: realizedGains,
      unrealized: unrealizedGains,
      totalRealizedGains: realizedGains.reduce((sum, gain) => sum + gain.gain, 0),
      totalUnrealizedGains: unrealizedGains.reduce((sum, gain) => sum + gain.gain, 0),
      shortTermGains: realizedGains.filter(g => !g.isLongTerm).reduce((sum, gain) => sum + gain.gain, 0),
      longTermGains: realizedGains.filter(g => g.isLongTerm).reduce((sum, gain) => sum + gain.gain, 0)
    };
  }, [accountingMethod, allTransactions]);

  // Updated summary with capital gains
  const summary = {
    totalIncome: allTransactions.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + tx.usdValue, 0),
    totalExpenses: Math.abs(allTransactions.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + tx.usdValue, 0)),
    totalSwaps: allTransactions.filter(tx => tx.type === 'swap').length,
    realizedGains: capitalGainsData.totalRealizedGains,
    unrealizedGains: capitalGainsData.totalUnrealizedGains,
    shortTermGains: capitalGainsData.shortTermGains,
    longTermGains: capitalGainsData.longTermGains
  };

  const netWorth = summary.totalIncome - summary.totalExpenses + summary.realizedGains + summary.unrealizedGains;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Navbar />
      <div className="pt-28 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-800 mb-2">Accounting Dashboard</h1>
                <p className="text-slate-600">Comprehensive crypto accounting with tax reporting and capital gains tracking</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Tax Report
                </Button>
                
                <Button variant="outline" className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Manage Wallets
                </Button>
                
                <Dialog open={isWalletDialogOpen} onOpenChange={setIsWalletDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      Connect Wallet
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Connect New Wallet</DialogTitle>
                      <DialogDescription>
                        Add a new wallet address to track transactions
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="wallet-address">Wallet Address</Label>
                        <Input
                          id="wallet-address"
                          placeholder="0x..."
                          value={newWalletAddress}
                          onChange={(e) => setNewWalletAddress(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={addWallet} className="flex-1">
                          Add Wallet
                        </Button>
                        <Button variant="outline" onClick={() => setIsWalletDialogOpen(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>

          {/* Enhanced Summary Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-6 gap-6 mb-8">
            <Card className="p-6 bg-white shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-sm font-medium">Total Income</p>
                  <p className="text-2xl font-bold text-green-600">${summary.totalIncome.toFixed(2)}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-500" />
              </div>
            </Card>

            <Card className="p-6 bg-white shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-sm font-medium">Total Expenses</p>
                  <p className="text-2xl font-bold text-red-600">${summary.totalExpenses.toFixed(2)}</p>
                </div>
                <TrendingDown className="w-8 h-8 text-red-500" />
              </div>
            </Card>

            <Card className="p-6 bg-white shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-sm font-medium">Realized Gains</p>
                  <p className={`text-2xl font-bold ${summary.realizedGains >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${summary.realizedGains.toFixed(2)}
                  </p>
                </div>
                <Calculator className="w-8 h-8 text-green-500" />
              </div>
            </Card>

            <Card className="p-6 bg-white shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-sm font-medium">Unrealized Gains</p>
                  <p className={`text-2xl font-bold ${summary.unrealizedGains >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    ${summary.unrealizedGains.toFixed(2)}
                  </p>
                </div>
                <PieChart className="w-8 h-8 text-blue-500" />
              </div>
            </Card>

            <Card className="p-6 bg-white shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-sm font-medium">Total Swaps</p>
                  <p className="text-2xl font-bold text-blue-600">{summary.totalSwaps}</p>
                </div>
                <Repeat className="w-8 h-8 text-blue-500" />
              </div>
            </Card>

            <Card className="p-6 bg-white shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-sm font-medium">Net Worth</p>
                  <p className="text-2xl font-bold text-slate-800">${netWorth.toFixed(2)}</p>
                </div>
                <Coins className="w-8 h-8 text-yellow-500" />
              </div>
            </Card>
          </div>

          {/* Main Content Tabs */}
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="income">Income</TabsTrigger>
              <TabsTrigger value="expenses">Expenses</TabsTrigger>
              <TabsTrigger value="capital-gains">Capital Gains</TabsTrigger>
              <TabsTrigger value="all-transactions">All Transactions</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="space-y-4">
              <Card className="p-6 bg-white shadow-sm">
                <h3 className="text-xl font-bold text-slate-800 mb-4">Quick Overview</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold text-slate-700 mb-2">Tax Summary</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Short-term Gains:</span>
                        <span className="font-mono">${summary.shortTermGains.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Long-term Gains:</span>
                        <span className="font-mono">${summary.longTermGains.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span>Total Taxable Income:</span>
                        <span className="font-mono font-bold">${(summary.totalIncome + summary.realizedGains).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-700 mb-2">Portfolio Performance</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Realized P&L:</span>
                        <span className={`font-mono ${summary.realizedGains >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ${summary.realizedGains.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Unrealized P&L:</span>
                        <span className={`font-mono ${summary.unrealizedGains >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ${summary.unrealizedGains.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span>Total P&L:</span>
                        <span className={`font-mono font-bold ${(summary.realizedGains + summary.unrealizedGains) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ${(summary.realizedGains + summary.unrealizedGains).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </TabsContent>
            
            <TabsContent value="income">
              <IncomeTab 
                transactions={allTransactions}
                connectedWallets={connectedWallets}
                getWalletName={getWalletName}
              />
            </TabsContent>
            
            <TabsContent value="expenses">
              <ExpensesTab 
                transactions={allTransactions}
                connectedWallets={connectedWallets}
                getWalletName={getWalletName}
              />
            </TabsContent>
            
            <TabsContent value="capital-gains">
              <CapitalGainsTab 
                capitalGainsData={capitalGainsData}
                accountingMethod={accountingMethod}
                setAccountingMethod={setAccountingMethod}
              />
            </TabsContent>
            
            <TabsContent value="all-transactions">
              <AllTransactionsTab 
                transactions={allTransactions}
                connectedWallets={connectedWallets}
                getWalletName={getWalletName}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
