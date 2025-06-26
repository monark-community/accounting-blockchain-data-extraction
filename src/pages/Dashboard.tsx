
import { useState } from "react";
import { BarChart3, TrendingUp, TrendingDown, Repeat, Coins, Filter, Search, Calendar } from "lucide-react";
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
import { format } from "date-fns";
import Navbar from "@/components/Navbar";

const Dashboard = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["all"]);
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>(["all"]);
  const [amountRange, setAmountRange] = useState([0, 50000]);
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  // Expanded transaction data with more entries
  const allTransactions = [
    {
      id: "1",
      date: "2024-06-15",
      description: "Freelance Payment - Web3 Consulting",
      amount: "2.5 ETH",
      usdValue: 6250.00,
      hash: "0x1234...5678",
      type: "income",
      network: "ethereum"
    },
    {
      id: "2",
      date: "2024-06-13",
      description: "DAO Governance Reward",
      amount: "150.0 COMP",
      usdValue: 8250.00,
      hash: "0x9876...5432",
      type: "income",
      network: "ethereum"
    },
    {
      id: "3",
      date: "2024-06-14",
      description: "USDC → ETH",
      amount: "-1000 USDC / +0.4 ETH",
      usdValue: 0.00,
      hash: "0xabcd...efgh",
      type: "swap",
      network: "ethereum"
    },
    {
      id: "4",
      date: "2024-06-12",
      description: "ETH → USDT",
      amount: "-0.5 ETH / +1250 USDT",
      usdValue: 0.00,
      hash: "0xdef0...1234",
      type: "swap",
      network: "ethereum"
    },
    {
      id: "5",
      date: "2024-06-11",
      description: "DeFi Protocol Fee",
      amount: "-25 USDC",
      usdValue: -25.00,
      hash: "0x5678...90ab",
      type: "expense",
      network: "ethereum"
    },
    {
      id: "6",
      date: "2024-06-10",
      description: "Uniswap LP Rewards",
      amount: "0.15 ETH",
      usdValue: 375.00,
      hash: "0x1111...2222",
      type: "income",
      network: "ethereum"
    },
    {
      id: "7",
      date: "2024-06-09",
      description: "MATIC → USDC",
      amount: "-500 MATIC / +350 USDC",
      usdValue: 0.00,
      hash: "0x3333...4444",
      type: "swap",
      network: "polygon"
    },
    {
      id: "8",
      date: "2024-06-08",
      description: "Polygon Bridge Fee",
      amount: "-5.2 MATIC",
      usdValue: -3.64,
      hash: "0x5555...6666",
      type: "expense",
      network: "polygon"
    },
    {
      id: "9",
      date: "2024-06-07",
      description: "NFT Sale Proceeds",
      amount: "3.8 ETH",
      usdValue: 9500.00,
      hash: "0x7777...8888",
      type: "income",
      network: "ethereum"
    },
    {
      id: "10",
      date: "2024-06-06",
      description: "Aave Interest Payment",
      amount: "45.6 USDC",
      usdValue: 45.60,
      hash: "0x9999...aaaa",
      type: "income",
      network: "ethereum"
    },
    {
      id: "11",
      date: "2024-06-05",
      description: "SOL → USDC",
      amount: "-25 SOL / +875 USDC",
      usdValue: 0.00,
      hash: "0xbbbb...cccc",
      type: "swap",
      network: "solana"
    },
    {
      id: "12",
      date: "2024-06-04",
      description: "Solana Staking Reward",
      amount: "2.1 SOL",
      usdValue: 73.50,
      hash: "0xdddd...eeee",
      type: "income",
      network: "solana"
    },
    {
      id: "13",
      date: "2024-06-03",
      description: "Gas Fee Refund",
      amount: "0.02 ETH",
      usdValue: 50.00,
      hash: "0xffff...0000",
      type: "income",
      network: "ethereum"
    },
    {
      id: "14",
      date: "2024-06-02",
      description: "BNB → BUSD",
      amount: "-5 BNB / +1250 BUSD",
      usdValue: 0.00,
      hash: "0x1010...1111",
      type: "swap",
      network: "bsc"
    },
    {
      id: "15",
      date: "2024-06-01",
      description: "PancakeSwap LP Fee",
      amount: "-0.5 BNB",
      usdValue: -125.00,
      hash: "0x1212...1313",
      type: "expense",
      network: "bsc"
    },
    {
      id: "16",
      date: "2024-05-31",
      description: "Yield Farming Reward",
      amount: "125.4 CAKE",
      usdValue: 628.00,
      hash: "0x1414...1515",
      type: "income",
      network: "bsc"
    },
    {
      id: "17",
      date: "2024-05-30",
      description: "AVAX Staking Reward",
      amount: "1.8 AVAX",
      usdValue: 45.00,
      hash: "0x1616...1717",
      type: "income",
      network: "avalanche"
    },
    {
      id: "18",
      date: "2024-05-29",
      description: "Cross-chain Bridge",
      amount: "-100 USDC",
      usdValue: -5.00,
      hash: "0x1818...1919",
      type: "expense",
      network: "ethereum"
    }
  ];

  const transactionTypes = ["income", "swap", "expense"];
  const networks = ["ethereum", "polygon", "solana", "bsc", "avalanche"];

  const filteredTransactions = allTransactions.filter(tx => {
    const matchesSearch = tx.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tx.amount.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tx.hash.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = selectedTypes.includes("all") || selectedTypes.includes(tx.type);
    const matchesNetwork = selectedNetworks.includes("all") || selectedNetworks.includes(tx.network);
    const matchesAmount = Math.abs(tx.usdValue) >= amountRange[0] && Math.abs(tx.usdValue) <= amountRange[1];
    
    let matchesDate = true;
    if (dateFrom || dateTo) {
      const txDate = new Date(tx.date);
      if (dateFrom && txDate < dateFrom) matchesDate = false;
      if (dateTo && txDate > dateTo) matchesDate = false;
    }
    
    return matchesSearch && matchesType && matchesNetwork && matchesAmount && matchesDate;
  });

  const summary = {
    totalIncome: "$24,665.10",
    totalExpenses: "$158.64",
    totalSwaps: 8,
    netWorth: "$24,506.46"
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
            <h1 className="text-3xl font-bold text-slate-800 mb-2">Accounting Dashboard</h1>
            <p className="text-slate-600">Overview of your connected wallets and transactions</p>
          </div>

          {/* Summary Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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

          {/* Search and Filters */}
          <Card className="bg-white shadow-sm mb-6">
            <div className="p-6">
              <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between mb-4">
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
                    dateFrom || dateTo) && (
                    <Badge variant="secondary" className="ml-1 text-xs">
                      Active
                    </Badge>
                  )}
                </Button>
              </div>

              <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
                <CollapsibleContent className="space-y-6">
                  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 pt-4 border-t">
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
          </Card>

          {/* Transactions Table */}
          <Card className="bg-white shadow-sm">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-800">
                  Transactions ({filteredTransactions.length})
                </h2>
                <Button variant="outline" size="sm">
                  <Filter className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Network</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>USD Value</TableHead>
                    <TableHead>Transaction</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        <div className={`flex items-center gap-2 ${getTransactionColor(tx.type)}`}>
                          {getTransactionIcon(tx.type)}
                          <span className="capitalize text-xs font-medium">{tx.type}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{tx.date}</TableCell>
                      <TableCell>{tx.description}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize text-xs">
                          {tx.network}
                        </Badge>
                      </TableCell>
                      <TableCell className={`font-mono ${getTransactionColor(tx.type)}`}>
                        {tx.amount}
                      </TableCell>
                      <TableCell className={`font-mono ${getTransactionColor(tx.type)}`}>
                        {tx.usdValue === 0 ? "$0.00" : 
                         tx.usdValue > 0 ? `+$${tx.usdValue.toFixed(2)}` : 
                         `-$${Math.abs(tx.usdValue).toFixed(2)}`}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {tx.hash}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredTransactions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-slate-500">
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
