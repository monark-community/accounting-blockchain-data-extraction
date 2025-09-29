import { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Repeat,
  Coins,
  Filter,
  Search,
  Calendar,
  Eye,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: string;
  usdValue: number;
  hash: string;
  type: "income" | "expense" | "swap";
  network: string;
  walletId: string;
}

interface AllTransactionsTabProps {
  transactions: Transaction[];
  connectedWallets: Array<{
    id: string;
    name: string;
    address: string;
    network: string;
  }>;
  getWalletName: (walletId: string) => string;
}

const AllTransactionsTab = ({
  transactions,
  connectedWallets,
  getWalletName,
}: AllTransactionsTabProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["all"]);
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>(["all"]);
  const [selectedWallets, setSelectedWallets] = useState<string[]>(["all"]);
  const [amountRange, setAmountRange] = useState([0, 50000]);
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    type: true,
    date: true,
    description: true,
    network: true,
    wallet: true,
    amount: true,
    usdValue: true,
    transaction: true,
  });

  const transactionTypes = ["income", "swap", "expense"];
  const networks = ["ethereum", "polygon", "solana", "bsc", "avalanche"];

  const filteredTransactions = transactions.filter((tx) => {
    const matchesSearch =
      tx.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.amount.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.hash.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType =
      selectedTypes.includes("all") || selectedTypes.includes(tx.type);
    const matchesNetwork =
      selectedNetworks.includes("all") || selectedNetworks.includes(tx.network);
    const matchesWallet =
      selectedWallets.includes("all") || selectedWallets.includes(tx.walletId);
    const matchesAmount =
      Math.abs(tx.usdValue) >= amountRange[0] &&
      Math.abs(tx.usdValue) <= amountRange[1];

    let matchesDate = true;
    if (dateFrom || dateTo) {
      const txDate = new Date(tx.date);
      if (dateFrom && txDate < dateFrom) matchesDate = false;
      if (dateTo && txDate > dateTo) matchesDate = false;
    }

    return (
      matchesSearch &&
      matchesType &&
      matchesNetwork &&
      matchesWallet &&
      matchesAmount &&
      matchesDate
    );
  });

  const handleTypeChange = (type: string, checked: boolean) => {
    if (type === "all") {
      setSelectedTypes(checked ? ["all"] : []);
    } else {
      const newTypes = checked
        ? [...selectedTypes.filter((t) => t !== "all"), type]
        : selectedTypes.filter((t) => t !== type);
      setSelectedTypes(newTypes.length === 0 ? ["all"] : newTypes);
    }
  };

  const handleNetworkChange = (network: string, checked: boolean) => {
    if (network === "all") {
      setSelectedNetworks(checked ? ["all"] : []);
    } else {
      const newNetworks = checked
        ? [...selectedNetworks.filter((n) => n !== "all"), network]
        : selectedNetworks.filter((n) => n !== network);
      setSelectedNetworks(newNetworks.length === 0 ? ["all"] : newNetworks);
    }
  };

  const handleWalletChange = (walletId: string, checked: boolean) => {
    if (walletId === "all") {
      setSelectedWallets(checked ? ["all"] : []);
    } else {
      const newWallets = checked
        ? [...selectedWallets.filter((w) => w !== "all"), walletId]
        : selectedWallets.filter((w) => w !== walletId);
      setSelectedWallets(newWallets.length === 0 ? ["all"] : newWallets);
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case "income":
        return "text-green-600";
      case "expense":
        return "text-red-600";
      case "swap":
        return "text-blue-600";
      default:
        return "text-slate-600";
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "income":
        return <TrendingUp className="w-4 h-4" />;
      case "expense":
        return <TrendingDown className="w-4 h-4" />;
      case "swap":
        return <Repeat className="w-4 h-4" />;
      default:
        return <Coins className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* All Transactions Table */}
      <Card className="bg-white shadow-sm">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-slate-800">
              All Transactions ({filteredTransactions.length})
            </h3>
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
                      onCheckedChange={(checked) =>
                        setVisibleColumns((prev) => ({
                          ...prev,
                          [key]: !!checked,
                        }))
                      }
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
              {(selectedTypes.length > 1 ||
                !selectedTypes.includes("all") ||
                selectedNetworks.length > 1 ||
                !selectedNetworks.includes("all") ||
                selectedWallets.length > 1 ||
                !selectedWallets.includes("all") ||
                dateFrom ||
                dateTo) && (
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
                  <Label className="text-sm font-medium">
                    Transaction Types
                  </Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="type-all"
                        checked={selectedTypes.includes("all")}
                        onCheckedChange={(checked) =>
                          handleTypeChange("all", !!checked)
                        }
                      />
                      <Label htmlFor="type-all" className="text-sm font-normal">
                        All Types
                      </Label>
                    </div>
                    {transactionTypes.map((type) => (
                      <div key={type} className="flex items-center space-x-2">
                        <Checkbox
                          id={`type-${type}`}
                          checked={selectedTypes.includes(type)}
                          onCheckedChange={(checked) =>
                            handleTypeChange(type, !!checked)
                          }
                        />
                        <Label
                          htmlFor={`type-${type}`}
                          className="text-sm font-normal capitalize flex items-center gap-1"
                        >
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
                        onCheckedChange={(checked) =>
                          handleNetworkChange("all", !!checked)
                        }
                      />
                      <Label
                        htmlFor="network-all"
                        className="text-sm font-normal"
                      >
                        All Networks
                      </Label>
                    </div>
                    {networks.map((network) => (
                      <div
                        key={network}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          id={`network-${network}`}
                          checked={selectedNetworks.includes(network)}
                          onCheckedChange={(checked) =>
                            handleNetworkChange(network, !!checked)
                          }
                        />
                        <Label
                          htmlFor={`network-${network}`}
                          className="text-sm font-normal capitalize"
                        >
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
                        onCheckedChange={(checked) =>
                          handleWalletChange("all", !!checked)
                        }
                      />
                      <Label
                        htmlFor="wallet-all"
                        className="text-sm font-normal"
                      >
                        All Wallets
                      </Label>
                    </div>
                    {connectedWallets.map((wallet) => (
                      <div
                        key={wallet.id}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          id={`wallet-${wallet.id}`}
                          checked={selectedWallets.includes(wallet.id)}
                          onCheckedChange={(checked) =>
                            handleWalletChange(wallet.id, !!checked)
                          }
                        />
                        <Label
                          htmlFor={`wallet-${wallet.id}`}
                          className="text-sm font-normal"
                        >
                          {wallet.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Amount Range */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">
                    Amount Range (USD)
                  </Label>
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
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 justify-start text-left font-normal"
                        >
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
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 justify-start text-left font-normal"
                        >
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
                {visibleColumns.description && (
                  <TableHead>Description</TableHead>
                )}
                {visibleColumns.network && <TableHead>Network</TableHead>}
                {visibleColumns.wallet && <TableHead>Wallet</TableHead>}
                {visibleColumns.amount && <TableHead>Amount</TableHead>}
                {visibleColumns.usdValue && <TableHead>USD Value</TableHead>}
                {visibleColumns.transaction && (
                  <TableHead>Transaction</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.map((tx) => (
                <TableRow key={tx.id}>
                  {visibleColumns.type && (
                    <TableCell>
                      <div
                        className={`flex items-center gap-2 ${getTransactionColor(
                          tx.type
                        )}`}
                      >
                        {getTransactionIcon(tx.type)}
                        <span className="capitalize text-xs font-medium">
                          {tx.type}
                        </span>
                      </div>
                    </TableCell>
                  )}
                  {visibleColumns.date && (
                    <TableCell className="font-medium">{tx.date}</TableCell>
                  )}
                  {visibleColumns.description && (
                    <TableCell>{tx.description}</TableCell>
                  )}
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
                    <TableCell
                      className={`font-mono ${getTransactionColor(tx.type)}`}
                    >
                      {tx.amount}
                    </TableCell>
                  )}
                  {visibleColumns.usdValue && (
                    <TableCell
                      className={`font-mono ${getTransactionColor(tx.type)}`}
                    >
                      {tx.usdValue === 0
                        ? "$0.00"
                        : tx.usdValue > 0
                        ? `+$${tx.usdValue.toFixed(2)}`
                        : `-$${Math.abs(tx.usdValue).toFixed(2)}`}
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
                  <TableCell
                    colSpan={
                      Object.values(visibleColumns).filter(Boolean).length
                    }
                    className="text-center py-8 text-slate-500"
                  >
                    No transactions found matching your filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};

export default AllTransactionsTab;
