
import { useState } from "react";
import { TrendingDown, Search, Filter, Calendar, Eye } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { CurrencyDisplay } from "@/components/ui/currency-display";
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

interface ExpensesTabProps {
  transactions: Transaction[];
  connectedWallets: Array<{ id: string; name: string; address: string; network: string }>;
  getWalletName: (walletId: string) => string;
}

const ExpensesTab = ({ transactions, connectedWallets, getWalletName }: ExpensesTabProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>(["all"]);
  const [selectedWallets, setSelectedWallets] = useState<string[]>(["all"]);
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    date: true,
    description: true,
    network: true,
    wallet: true,
    amount: true,
    usdValue: true,
    transaction: true
  });

  const expenseTransactions = transactions.filter(tx => tx.type === "expense");
  const networks = ["ethereum", "polygon", "solana", "bsc", "avalanche"];

  const filteredTransactions = expenseTransactions.filter(tx => {
    const matchesSearch = tx.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tx.amount.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tx.hash.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesNetwork = selectedNetworks.includes("all") || selectedNetworks.includes(tx.network);
    const matchesWallet = selectedWallets.includes("all") || selectedWallets.includes(tx.walletId);
    
    let matchesDate = true;
    if (dateFrom || dateTo) {
      const txDate = new Date(tx.date);
      if (dateFrom && txDate < dateFrom) matchesDate = false;
      if (dateTo && txDate > dateTo) matchesDate = false;
    }
    
    return matchesSearch && matchesNetwork && matchesWallet && matchesDate;
  });

  const totalExpenses = Math.abs(filteredTransactions.reduce((sum, tx) => sum + tx.usdValue, 0));

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

  return (
    <div className="space-y-6">
      {/* Expenses Summary */}
      <Card className="p-6 bg-white shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-600 text-sm font-medium">Total Expenses</p>
            <CurrencyDisplay 
              amount={totalExpenses} 
              currency="USD"
              variant="large"
              showSign={false}
              className="text-red-600"
            />
            <p className="text-sm text-slate-500 mt-1">{filteredTransactions.length} transactions</p>
          </div>
          <TrendingDown className="w-12 h-12 text-red-500" />
        </div>
      </Card>

      {/* Expenses Transactions Table */}
      <Card className="bg-white shadow-sm">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-slate-800">
              Expense Transactions ({filteredTransactions.length})
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
                      onCheckedChange={(checked) => setVisibleColumns(prev => ({ ...prev, [key]: !!checked }))}
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
                  placeholder="Search expense transactions..."
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
            </Button>
          </div>

          <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
            <CollapsibleContent className="space-y-6">
              <div className="grid md:grid-cols-3 gap-6 pt-4 border-t">
                {/* Networks */}
                <div className="space-y-3">
                  <label className="text-sm font-medium">Networks</label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="expense-network-all"
                        checked={selectedNetworks.includes("all")}
                        onChange={(e) => handleNetworkChange("all", e.target.checked)}
                        className="rounded"
                      />
                      <label htmlFor="expense-network-all" className="text-sm">All Networks</label>
                    </div>
                    {networks.map((network) => (
                      <div key={network} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`expense-network-${network}`}
                          checked={selectedNetworks.includes(network)}
                          onChange={(e) => handleNetworkChange(network, e.target.checked)}
                          className="rounded"
                        />
                        <label htmlFor={`expense-network-${network}`} className="text-sm capitalize">
                          {network}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Wallets */}
                <div className="space-y-3">
                  <label className="text-sm font-medium">Wallets</label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="expense-wallet-all"
                        checked={selectedWallets.includes("all")}
                        onChange={(e) => handleWalletChange("all", e.target.checked)}
                        className="rounded"
                      />
                      <label htmlFor="expense-wallet-all" className="text-sm">All Wallets</label>
                    </div>
                    {connectedWallets.map((wallet) => (
                      <div key={wallet.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`expense-wallet-${wallet.id}`}
                          checked={selectedWallets.includes(wallet.id)}
                          onChange={(e) => handleWalletChange(wallet.id, e.target.checked)}
                          className="rounded"
                        />
                        <label htmlFor={`expense-wallet-${wallet.id}`} className="text-sm">
                          {wallet.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Date Range */}
                <div className="space-y-3">
                  <label className="text-sm font-medium">Date Range</label>
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
                    <TableCell>
                      <CurrencyDisplay 
                        amount={parseFloat(tx.amount.split(' ')[0])} 
                        currency={tx.amount.split(' ')[1]}
                        network={tx.network}
                        showSign={false}
                      />
                    </TableCell>
                  )}
                  {visibleColumns.usdValue && (
                    <TableCell>
                      <CurrencyDisplay 
                        amount={-Math.abs(tx.usdValue)} 
                        currency="USD"
                        className="text-red-600"
                      />
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
                    No expense transactions found.
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

export default ExpensesTab;
