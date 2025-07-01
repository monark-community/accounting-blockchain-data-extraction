import { useState, useMemo } from "react";
import { BarChart3, TrendingUp, TrendingDown, Repeat, Coins, Filter, Search, Calendar, Plus, Eye, EyeOff, Wallet, Settings, Trash2, Calculator, FileText, PieChart } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import Navbar from "@/components/Navbar";
import { CapitalGainsCalculator, parseAssetFromAmount, parseSwapTransaction, type CapitalGainEntry, type AccountingMethod } from "@/utils/capitalGains";

const Dashboard = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["all"]);
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>(["all"]);
  const [selectedWallets, setSelectedWallets] = useState<string[]>(["all"]);
  const [amountRange, setAmountRange] = useState([0, 50000]);
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isWalletDialogOpen, setIsWalletDialogOpen] = useState(false);
  const [isManageWalletsDialogOpen, setIsManageWalletsDialogOpen] = useState(false);
  const [isTaxReportDialogOpen, setIsTaxReportDialogOpen] = useState(false);
  const [newWalletAddress, setNewWalletAddress] = useState("");
  const [editingWallet, setEditingWallet] = useState<{ id: string; name: string } | null>(null);
  const [accountingMethod, setAccountingMethod] = useState<AccountingMethod>('FIFO');

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState({
    type: true,
    date: true,
    description: true,
    network: true,
    wallet: true,
    amount: true,
    usdValue: true,
    transaction: true
  });

  // Connected wallets
  const [connectedWallets, setConnectedWallets] = useState([
    { id: "1", address: "0x1234...5678", name: "Main Wallet", network: "ethereum" },
    { id: "2", address: "0x9876...5432", name: "Trading Wallet", network: "ethereum" },
    { id: "3", address: "0xabcd...efgh", name: "DeFi Wallet", network: "polygon" }
  ]);

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

  const transactionTypes = ["income", "swap", "expense"];
  const networks = ["ethereum", "polygon", "solana", "bsc", "avalanche"];

  const filteredTransactions = allTransactions.filter(tx => {
    const matchesSearch = tx.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tx.amount.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tx.hash.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = selectedTypes.includes("all") || selectedTypes.includes(tx.type);
    const matchesNetwork = selectedNetworks.includes("all") || selectedNetworks.includes(tx.network);
    const matchesWallet = selectedWallets.includes("all") || selectedWallets.includes(tx.walletId);
    const matchesAmount = Math.abs(tx.usdValue) >= amountRange[0] && Math.abs(tx.usdValue) <= amountRange[1];
    
    let matchesDate = true;
    if (dateFrom || dateTo) {
      const txDate = new Date(tx.date);
      if (dateFrom && txDate < dateFrom) matchesDate = false;
      if (dateTo && txDate > dateTo) matchesDate = false;
    }
    
    return matchesSearch && matchesType && matchesNetwork && matchesWallet && matchesAmount && matchesDate;
  });

  // Updated summary with capital gains
  const summary = {
    totalIncome: "$24,665.10",
    totalExpenses: "$158.64",
    totalSwaps: 8,
    netWorth: "$24,506.46",
    realizedGains: capitalGainsData.totalRealizedGains,
    unrealizedGains: capitalGainsData.totalUnrealizedGains,
    shortTermGains: capitalGainsData.shortTermGains,
    longTermGains: capitalGainsData.longTermGains
  };

  const handleTypeChange = (type: string, checked: boolean) => {
    if (type === "all") {
      setSelectedTypes(checked ? ["all"] : []);
    } else {
      const newTypes = checked 
        ? [...selectedTypes.filter(t => t !== "all"), type]
        : selectedTypes.filter(t => t !== type);
      setSelectedTypes(newTypes.length === 0 ? ["all"] : newTypes);
    }
  };

  const handleNetworkChange = (network: string, checked: boolean) => {
    if (network === "all") {
      setSelectedNetworks(checked ? ["all"] : []);
    } else {
      const newNetworks = checked 
        ? [...selectedNetworks.filter(n => n !== "all"), network]
        : selectedNetworks.filter(n => n !== network);
      setSelectedNetworks(newNetworks.length === 0 ? ["all"] : newNetworks);
    }
  };

  const handleWalletChange = (walletId: string, checked: boolean) => {
    if (walletId === "all") {
      setSelectedWallets(checked ? ["all"] : []);
    } else {
      const newWallets = checked 
        ? [...selectedWallets.filter(w => w !== "all"), walletId]
        : selectedWallets.filter(w => w !== walletId);
      setSelectedWallets(newWallets.length === 0 ? ["all"] : newWallets);
    }
  };

  const handleColumnVisibilityChange = (columnKey: string, visible: boolean) => {
    setVisibleColumns(prev => ({ ...prev, [columnKey]: visible }));
  };

  const addWallet = () => {
    if (newWalletAddress.trim()) {
      const newWallet = {
        id: (connectedWallets.length + 1).toString(),
        address: newWalletAddress,
        name: `Wallet ${connectedWallets.length + 1}`,
        network: "ethereum"
      };
      setConnectedWallets([...connectedWallets, newWallet]);
      setNewWalletAddress("");
      setIsWalletDialogOpen(false);
    }
  };

  const updateWalletName = (walletId: string, newName: string) => {
    setConnectedWallets(prev => 
      prev.map(wallet => 
        wallet.id === walletId ? { ...wallet, name: newName } : wallet
      )
    );
    setEditingWallet(null);
  };

  const removeWallet = (walletId: string) => {
    setConnectedWallets(prev => prev.filter(wallet => wallet.id !== walletId));
    // Update selected wallets filter if the removed wallet was selected
    setSelectedWallets(prev => prev.filter(w => w !== walletId));
  };

  const getWalletName = (walletId: string) => {
    const wallet = connectedWallets.find(w => w.id === walletId);
    return wallet ? wallet.name : "Unknown Wallet";
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case "income": return "text-green-600";
      case "expense": return "text-red-600";
      case "swap": return "text-blue-600";
      default: return "text-slate-600";
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "income": return <TrendingUp className="w-4 h-4" />;
      case "expense": return <TrendingDown className="w-4 h-4" />;
      case "swap": return <Repeat className="w-4 h-4" />;
      default: return <Coins className="w-4 h-4" />;
    }
  };

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
                <Dialog open={isTaxReportDialogOpen} onOpenChange={setIsTaxReportDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Tax Report
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Tax Report & Capital Gains</DialogTitle>
                      <DialogDescription>
                        Comprehensive tax reporting with capital gains analysis
                      </DialogDescription>
                    </DialogHeader>
                    <Tabs defaultValue="summary" className="w-full">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="summary">Summary</TabsTrigger>
                        <TabsTrigger value="realized">Realized Gains</TabsTrigger>
                        <TabsTrigger value="unrealized">Unrealized Gains</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="summary" className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <Card className="p-4">
                            <h3 className="font-semibold text-green-600 mb-2">Total Realized Gains</h3>
                            <p className="text-2xl font-bold">
                              ${capitalGainsData.totalRealizedGains.toFixed(2)}
                            </p>
                          </Card>
                          <Card className="p-4">
                            <h3 className="font-semibold text-blue-600 mb-2">Total Unrealized Gains</h3>
                            <p className="text-2xl font-bold">
                              ${capitalGainsData.totalUnrealizedGains.toFixed(2)}
                            </p>
                          </Card>
                          <Card className="p-4">
                            <h3 className="font-semibold text-orange-600 mb-2">Short-term Gains</h3>
                            <p className="text-2xl font-bold">
                              ${summary.shortTermGains.toFixed(2)}
                            </p>
                          </Card>
                          <Card className="p-4">
                            <h3 className="font-semibold text-purple-600 mb-2">Long-term Gains</h3>
                            <p className="text-2xl font-bold">
                              ${summary.longTermGains.toFixed(2)}
                            </p>
                          </Card>
                        </div>
                        <div className="mt-4">
                          <Label htmlFor="accounting-method">Accounting Method</Label>
                          <Select value={accountingMethod} onValueChange={(value: AccountingMethod) => setAccountingMethod(value)}>
                            <SelectTrigger className="w-full mt-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="FIFO">FIFO (First In, First Out)</SelectItem>
                              <SelectItem value="LIFO">LIFO (Last In, First Out)</SelectItem>
                              <SelectItem value="SPECIFIC_ID">Specific Identification</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="realized" className="space-y-4">
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Asset</TableHead>
                                <TableHead>Quantity</TableHead>
                                <TableHead>Sale Price</TableHead>
                                <TableHead>Cost Basis</TableHead>
                                <TableHead>Gain/Loss</TableHead>
                                <TableHead>Gain %</TableHead>
                                <TableHead>Holding Period</TableHead>
                                <TableHead>Tax Treatment</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {capitalGainsData.realized.map((gain) => (
                                <TableRow key={gain.id}>
                                  <TableCell className="font-medium">{gain.asset}</TableCell>
                                  <TableCell>{gain.quantity}</TableCell>
                                  <TableCell>${gain.salePrice.toFixed(2)}</TableCell>
                                  <TableCell>${gain.costBasis.toFixed(2)}</TableCell>
                                  <TableCell className={gain.gain >= 0 ? "text-green-600" : "text-red-600"}>
                                    ${gain.gain.toFixed(2)}
                                  </TableCell>
                                  <TableCell className={gain.gainPercent >= 0 ? "text-green-600" : "text-red-600"}>
                                    {gain.gainPercent.toFixed(2)}%
                                  </TableCell>
                                  <TableCell>{gain.holdingPeriod} days</TableCell>
                                  <TableCell>
                                    <Badge variant={gain.isLongTerm ? "default" : "secondary"}>
                                      {gain.isLongTerm ? "Long-term" : "Short-term"}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="unrealized" className="space-y-4">
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Asset</TableHead>
                                <TableHead>Quantity</TableHead>
                                <TableHead>Current Price</TableHead>
                                <TableHead>Cost Basis</TableHead>
                                <TableHead>Unrealized Gain/Loss</TableHead>
                                <TableHead>Gain %</TableHead>
                                <TableHead>Holding Period</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {capitalGainsData.unrealized.map((gain) => (
                                <TableRow key={gain.id}>
                                  <TableCell className="font-medium">{gain.asset}</TableCell>
                                  <TableCell>{gain.quantity}</TableCell>
                                  <TableCell>${gain.salePrice.toFixed(2)}</TableCell>
                                  <TableCell>${gain.costBasis.toFixed(2)}</TableCell>
                                  <TableCell className={gain.gain >= 0 ? "text-green-600" : "text-red-600"}>
                                    ${gain.gain.toFixed(2)}
                                  </TableCell>
                                  <TableCell className={gain.gainPercent >= 0 ? "text-green-600" : "text-red-600"}>
                                    {gain.gainPercent.toFixed(2)}%
                                  </TableCell>
                                  <TableCell>{gain.holdingPeriod} days</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </DialogContent>
                </Dialog>
                
                <Dialog open={isManageWalletsDialogOpen} onOpenChange={setIsManageWalletsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="flex items-center gap-2">
                      <Settings className="w-4 h-4" />
                      Manage Wallets
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Manage Wallets</DialogTitle>
                      <DialogDescription>
                        View and manage your connected wallets
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {connectedWallets.map((wallet) => (
                        <div key={wallet.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <Wallet className="w-5 h-5 text-slate-500" />
                            <div>
                              {editingWallet?.id === wallet.id ? (
                                <Input
                                  defaultValue={wallet.name}
                                  onBlur={(e) => updateWalletName(wallet.id, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      updateWalletName(wallet.id, e.currentTarget.value);
                                    }
                                  }}
                                  className="w-32"
                                  autoFocus
                                />
                              ) : (
                                <div
                                  className="font-medium cursor-pointer hover:text-blue-600"
                                  onClick={() => setEditingWallet({ id: wallet.id, name: wallet.name })}
                                >
                                  {wallet.name}
                                </div>
                              )}
                              <div className="text-sm text-slate-500">{wallet.address}</div>
                              <Badge variant="outline" className="text-xs mt-1 capitalize">
                                {wallet.network}
                              </Badge>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeWallet(wallet.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      {connectedWallets.length === 0 && (
                        <div className="text-center py-8 text-slate-500">
                          No wallets connected yet.
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
                
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

          {/* Enhanced Summary Cards with Capital Gains */}
          <div className="grid md:grid-cols-2 lg:grid-cols-6 gap-6 mb-8">
            <Card className="p-6 bg-white shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-sm font-medium">Total Income</p>
                  <p className="text-2xl font-bold text-green-600">{summary.totalIncome}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-500" />
              </div>
            </Card>

            <Card className="p-6 bg-white shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-sm font-medium">Total Expenses</p>
                  <p className="text-2xl font-bold text-red-600">{summary.totalExpenses}</p>
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
                  <p className="text-2xl font-bold text-slate-800">{summary.netWorth}</p>
                </div>
                <Coins className="w-8 h-8 text-yellow-500" />
              </div>
            </Card>
          </div>

          {/* Transactions Table */}
          <Card className="bg-white shadow-sm">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-slate-800">
                  Transactions ({filteredTransactions.length})
                </h2>
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Eye className="w-4 h-4 mr-2" />
                        Columns
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      {Object.entries(visibleColumns).map(([key, visible]) => (
                        <DropdownMenuCheckboxItem
                          key={key}
                          checked={visible}
                          onCheckedChange={(checked) => handleColumnVisibilityChange(key, !!checked)}
                        >
                          {key.charAt(0).toUpperCase() + key.slice(1)}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="outline" size="sm">
                    <Filter className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>

              {/* Search and Filters */}
              <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                <div className="flex-1 max-w-md">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <Input
                      placeholder="Search transactions..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                  className="flex items-center gap-2"
                >
                  <Filter className="w-4 h-4" />
                  Filters
                  {(selectedTypes.length > 1 || !selectedTypes.includes("all") || 
                    selectedNetworks.length > 1 || !selectedNetworks.includes("all") ||
                    selectedWallets.length > 1 || !selectedWallets.includes("all") ||
                    dateFrom || dateTo) && (
                    <Badge variant="secondary" className="ml-1 text-xs">
                      Active
                    </Badge>
                  )}
                </Button>
              </div>

              <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
                <CollapsibleContent className="space-y-6">
                  <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6 pt-4 border-t">
                    {/* Transaction Types */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Transaction Types</Label>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="type-all"
                            checked={selectedTypes.includes("all")}
                            onCheckedChange={(checked) => handleTypeChange("all", !!checked)}
                          />
                          <Label htmlFor="type-all" className="text-sm font-normal">All Types</Label>
                        </div>
                        {transactionTypes.map((type) => (
                          <div key={type} className="flex items-center space-x-2">
                            <Checkbox
                              id={`type-${type}`}
                              checked={selectedTypes.includes(type)}
                              onCheckedChange={(checked) => handleTypeChange(type, !!checked)}
                            />
                            <Label htmlFor={`type-${type}`} className="text-sm font-normal capitalize flex items-center gap-1">
                              {getTransactionIcon(type)}
                              {type}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Networks */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Networks</Label>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="network-all"
                            checked={selectedNetworks.includes("all")}
                            onCheckedChange={(checked) => handleNetworkChange("all", !!checked)}
                          />
                          <Label htmlFor="network-all" className="text-sm font-normal">All Networks</Label>
                        </div>
                        {networks.map((network) => (
                          <div key={network} className="flex items-center space-x-2">
                            <Checkbox
                              id={`network-${network}`}
                              checked={selectedNetworks.includes(network)}
                              onCheckedChange={(checked) => handleNetworkChange(network, !!checked)}
                            />
                            <Label htmlFor={`network-${network}`} className="text-sm font-normal capitalize">
                              {network}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Wallets */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Wallets</Label>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="wallet-all"
                            checked={selectedWallets.includes("all")}
                            onCheckedChange={(checked) => handleWalletChange("all", !!checked)}
                          />
                          <Label htmlFor="wallet-all" className="text-sm font-normal">All Wallets</Label>
                        </div>
                        {connectedWallets.map((wallet) => (
                          <div key={wallet.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`wallet-${wallet.id}`}
                              checked={selectedWallets.includes(wallet.id)}
                              onCheckedChange={(checked) => handleWalletChange(wallet.id, !!checked)}
                            />
                            <Label htmlFor={`wallet-${wallet.id}`} className="text-sm font-normal flex items-center gap-1">
                              <Wallet className="w-3 h-3" />
                              {wallet.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Amount Range */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Amount Range (USD)</Label>
                      <div className="space-y-2">
                        <Slider
                          value={amountRange}
                          onValueChange={setAmountRange}
                          max={50000}
                          min={0}
                          step={100}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>${amountRange[0].toLocaleString()}</span>
                          <span>${amountRange[1].toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Date Range */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Date Range</Label>
                      <div className="flex gap-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="flex-1 justify-start text-left font-normal">
                              <Calendar className="mr-2 h-4 w-4" />
                              {dateFrom ? format(dateFrom, "MMM dd") : "From"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={dateFrom}
                              onSelect={setDateFrom}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="flex-1 justify-start text-left font-normal">
                              <Calendar className="mr-2 h-4 w-4" />
                              {dateTo ? format(dateTo, "MMM dd") : "To"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={dateTo}
                              onSelect={setDateTo}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {visibleColumns.type && <TableHead>Type</TableHead>}
                    {visibleColumns.date && <TableHead>Date</TableHead>}
                    {visibleColumns.description && <TableHead>Description</TableHead>}
                    {visibleColumns.network && <TableHead>Network</TableHead>}
                    {visibleColumns.wallet && <TableHead>Wallet</TableHead>}
                    {visibleColumns.amount && <TableHead>Amount</TableHead>}
                    {visibleColumns.usdValue && <TableHead>USD Value</TableHead>}
                    {visibleColumns.transaction && <TableHead>Transaction</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((tx) => (
                    <TableRow key={tx.id}>
                      {visibleColumns.type && (
                        <TableCell>
                          <div className={`flex items-center gap-2 ${getTransactionColor(tx.type)}`}>
                            {getTransactionIcon(tx.type)}
                            <span className="capitalize text-xs font-medium">{tx.type}</span>
                          </div>
                        </TableCell>
                      )}
                      {visibleColumns.date && <TableCell className="font-medium">{tx.date}</TableCell>}
                      {visibleColumns.description && <TableCell>{tx.description}</TableCell>}
                      {visibleColumns.network && (
                        <TableCell>
                          <Badge variant="outline" className="capitalize text-xs">
                            {tx.network}
                          </Badge>
                        </TableCell>
                      )}
                      {visibleColumns.wallet && (
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {getWalletName(tx.walletId)}
                          </Badge>
                        </TableCell>
                      )}
                      {visibleColumns.amount && (
                        <TableCell className={`font-mono ${getTransactionColor(tx.type)}`}>
                          {tx.amount}
                        </TableCell>
                      )}
                      {visibleColumns.usdValue && (
                        <TableCell className={`font-mono ${getTransactionColor(tx.type)}`}>
                          {tx.usdValue === 0 ? "$0.00" : 
                           tx.usdValue > 0 ? `+$${tx.usdValue.toFixed(2)}` : 
                           `-$${Math.abs(tx.usdValue).toFixed(2)}`}
                        </TableCell>
                      )}
                      {visibleColumns.transaction && (
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs">
                            {tx.hash}
                          </Badge>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {filteredTransactions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={Object.values(visibleColumns).filter(Boolean).length} className="text-center py-8 text-slate-500">
                        No transactions found matching your filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
