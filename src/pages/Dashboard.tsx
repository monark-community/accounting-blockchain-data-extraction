import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, BarChart3, PieChart, DollarSign } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar } from 'recharts';
import Navbar from "@/components/Navbar";
import IncomeTab from "@/components/dashboard/IncomeTab";
import ExpensesTab from "@/components/dashboard/ExpensesTab";
import CapitalGainsTab from "@/components/dashboard/CapitalGainsTab";
import AllTransactionsTab from "@/components/dashboard/AllTransactionsTab";
import { calculateCapitalGains, type AccountingMethod } from "@/utils/capitalGains";

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

interface CapitalGainEntry {
  id: string;
  asset: string;
  quantity: number;
  costBasis: number;
  salePrice: number;
  gain: number;
  gainPercent: number;
  holdingPeriod: number;
  isLongTerm: boolean;
}

const mockTransactions: Transaction[] = [
  {
    id: "1",
    date: "2023-01-15",
    description: "ETH deposit",
    amount: "2.5 ETH",
    usdValue: 3750,
    hash: "0xabc123",
    type: "income",
    network: "ethereum",
    walletId: "1"
  },
  {
    id: "2",
    date: "2023-02-01",
    description: "BTC purchase",
    amount: "0.1 BTC",
    usdValue: -2300,
    hash: "0xdef456",
    type: "expense",
    network: "ethereum",
    walletId: "1"
  },
  {
    id: "3",
    date: "2023-02-10",
    description: "ETH/USDC swap",
    amount: "1.0 ETH",
    usdValue: 1500,
    hash: "0xghi789",
    type: "swap",
    network: "ethereum",
    walletId: "2"
  },
  {
    id: "4",
    date: "2023-03-01",
    description: "MATIC staking reward",
    amount: "150 MATIC",
    usdValue: 150,
    hash: "0xjkl012",
    type: "income",
    network: "polygon",
    walletId: "3"
  },
  {
    id: "5",
    date: "2023-03-15",
    description: "SOL transfer",
    amount: "5 SOL",
    usdValue: -1000,
    hash: "0xmno345",
    type: "expense",
    network: "solana",
    walletId: "2"
  },
  {
    id: "6",
    date: "2023-04-01",
    description: "USDC interest",
    amount: "20 USDC",
    usdValue: 20,
    hash: "0xpqr678",
    type: "income",
    network: "ethereum",
    walletId: "1"
  },
  {
    id: "7",
    date: "2023-04-15",
    description: "AVAX purchase",
    amount: "2 AVAX",
    usdValue: -200,
    hash: "0xstu901",
    type: "expense",
    network: "avalanche",
    walletId: "3"
  },
  {
    id: "8",
    date: "2023-05-01",
    description: "LINK airdrop",
    amount: "10 LINK",
    usdValue: 75,
    hash: "0vwx234",
    type: "income",
    network: "ethereum",
    walletId: "2"
  },
  {
    id: "9",
    date: "2023-05-15",
    description: "BNB transfer",
    amount: "0.5 BNB",
    usdValue: -150,
    hash: "0xyz567",
    type: "expense",
    network: "bsc",
    walletId: "1"
  },
  {
    id: "10",
    date: "2023-06-01",
    description: "UNI swap",
    amount: "3 UNI",
    usdValue: 45,
    hash: "0x123abc",
    type: "swap",
    network: "ethereum",
    walletId: "3"
  }
];

const mockCapitalGainsData = (transactions: Transaction[]): {
  realized: CapitalGainEntry[];
  unrealized: CapitalGainEntry[];
  totalRealizedGains: number;
  totalUnrealizedGains: number;
  shortTermGains: number;
  longTermGains: number;
} => {
  const realized: CapitalGainEntry[] = [];
  const unrealized: CapitalGainEntry[] = [];
  let totalRealizedGains = 0;
  let totalUnrealizedGains = 0;
  let shortTermGains = 0;
  let longTermGains = 0;

  // Mock Realized Gains
  for (let i = 1; i <= 5; i++) {
    const gain: CapitalGainEntry = {
      id: `realized-${i}`,
      asset: `Asset ${i}`,
      quantity: i * 10,
      costBasis: 100 * i,
      salePrice: 150 * i,
      gain: 50 * i,
      gainPercent: 50,
      holdingPeriod: 365 + i,
      isLongTerm: true,
    };
    realized.push(gain);
    totalRealizedGains += gain.gain;
    longTermGains += gain.gain;
  }

  // Mock Unrealized Gains
  for (let i = 1; i <= 5; i++) {
    const gain: CapitalGainEntry = {
      id: `unrealized-${i}`,
      asset: `Asset ${i}`,
      quantity: i * 5,
      costBasis: 50 * i,
      salePrice: 75 * i,
      gain: 25 * i,
      gainPercent: 50,
      holdingPeriod: 180 - i,
      isLongTerm: false,
    };
    unrealized.push(gain);
    totalUnrealizedGains += gain.gain;
    shortTermGains += gain.gain;
  }

  return {
    realized,
    unrealized,
    totalRealizedGains,
    totalUnrealizedGains,
    shortTermGains,
    longTermGains,
  };
};

const Dashboard = () => {
  const { connectedWallets, getWalletName, userPreferences } = useWallet();
  const [accountingMethod, setAccountingMethod] = useState<AccountingMethod>('FIFO');

  const transactions = mockTransactions;
  const capitalGainsData = mockCapitalGainsData(transactions);

  const portfolioData = [
    { month: 'Jan', value: 45000 },
    { month: 'Feb', value: 52000 },
    { month: 'Mar', value: 48000 },
    { month: 'Apr', value: 61000 },
    { month: 'May', value: 55000 },
    { month: 'Jun', value: 67000 },
  ];

  const assetAllocation = [
    { name: 'ETH', value: 45, amount: 30150, network: 'ethereum' },
    { name: 'BTC', value: 30, amount: 20100, network: 'ethereum' },
    { name: 'USDC', value: 15, amount: 10050, network: 'ethereum' },
    { name: 'MATIC', value: 10, amount: 6700, network: 'polygon' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Portfolio Dashboard</h1>
          <p className="text-slate-600">Track your crypto assets and tax obligations</p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="income">Income</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            <TabsTrigger value="capital-gains">Capital Gains</TabsTrigger>
            <TabsTrigger value="all-transactions">All Transactions</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Portfolio Summary Cards */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="p-6 bg-white shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-600 text-sm font-medium">Total Portfolio Value</p>
                    <CurrencyDisplay 
                      amount={67000} 
                      currency={userPreferences.currency}
                      variant="large"
                      showSign={false}
                    />
                  </div>
                  <Wallet className="w-12 h-12 text-blue-500" />
                </div>
              </Card>

              <Card className="p-6 bg-white shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-600 text-sm font-medium">24h Change</p>
                    <CurrencyDisplay 
                      amount={2340} 
                      currency={userPreferences.currency}
                      variant="large"
                    />
                  </div>
                  <TrendingUp className="w-12 h-12 text-green-500" />
                </div>
              </Card>

              <Card className="p-6 bg-white shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-600 text-sm font-medium">Unrealized P&L</p>
                    <CurrencyDisplay 
                      amount={12500} 
                      currency={userPreferences.currency}
                      variant="large"
                    />
                  </div>
                  <BarChart3 className="w-12 h-12 text-purple-500" />
                </div>
              </Card>

              <Card className="p-6 bg-white shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-600 text-sm font-medium">Tax Liability</p>
                    <CurrencyDisplay 
                      amount={3200} 
                      currency={userPreferences.currency}
                      variant="large"
                    />
                  </div>
                  <DollarSign className="w-12 h-12 text-orange-500" />
                </div>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="p-6 bg-white shadow-sm">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Portfolio Performance</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={portfolioData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              <Card className="p-6 bg-white shadow-sm">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Asset Allocation</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={assetAllocation}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Bar dataKey="value" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>

            {/* Asset Breakdown */}
            <Card className="p-6 bg-white shadow-sm">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Top Holdings</h3>
              <div className="space-y-4">
                {assetAllocation.map((asset) => (
                  <div key={asset.name} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        {asset.name}
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{asset.name}</p>
                        <p className="text-sm text-slate-500">{asset.value}% of portfolio</p>
                      </div>
                    </div>
                    <CurrencyDisplay 
                      amount={asset.amount} 
                      currency={asset.name}
                      network={asset.network}
                      showSign={false}
                    />
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="income">
            <IncomeTab 
              transactions={transactions}
              connectedWallets={connectedWallets}
              getWalletName={getWalletName}
            />
          </TabsContent>

          <TabsContent value="expenses">
            <ExpensesTab 
              transactions={transactions}
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
              transactions={transactions}
              connectedWallets={connectedWallets}
              getWalletName={getWalletName}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;
