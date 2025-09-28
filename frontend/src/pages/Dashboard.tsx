import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  BarChart3,
  PieChart,
  DollarSign,
} from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import Navbar from "@/components/Navbar";
import IncomeTab from "@/components/dashboard/IncomeTab";
import ExpensesTab from "@/components/dashboard/ExpensesTab";
import CapitalGainsTab from "@/components/dashboard/CapitalGainsTab";
import AllTransactionsTab from "@/components/dashboard/AllTransactionsTab";
import {
  type CapitalGainEntry,
  type AccountingMethod,
} from "@/utils/capitalGains";
import { useSearchParams } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { Tooltip } from "recharts";

type PricedHolding = {
  contract: string | null;
  symbol: string;
  decimals: number;
  qty: string;
  priceUsd: number;
  valueUsd: number;
};

type OverviewResponse = {
  address: string;
  asOf: string;
  currency: "USD";
  kpis: { totalValueUsd: number; delta24hUsd: number; delta24hPct: number };
  holdings: PricedHolding[];
  allocation: { symbol: string; valueUsd: number; weightPct: number }[];
  topHoldings: { symbol: string; valueUsd: number; weightPct: number }[];
};

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
    walletId: "1",
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
    walletId: "1",
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
    walletId: "2",
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
    walletId: "3",
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
    walletId: "2",
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
    walletId: "1",
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
    walletId: "3",
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
    walletId: "2",
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
    walletId: "1",
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
    walletId: "3",
  },
];

const mockCapitalGainsData = (
  transactions: Transaction[]
): {
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
      saleDate: "2023-06-01",
      purchaseDate: "2022-06-01",
      transactionId: `tx-${i}`,
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
      saleDate: "2023-06-01",
      purchaseDate: "2023-01-01",
      transactionId: `tx-unrealized-${i}`,
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

const fmtUSD = (n: number) =>
  n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });

const Dashboard = () => {
  const { connectedWallets, getWalletName, userPreferences } = useWallet();
  const [accountingMethod, setAccountingMethod] =
    useState<AccountingMethod>("FIFO");

  const transactions = mockTransactions;
  const capitalGainsData = mockCapitalGainsData(transactions);

  const portfolioData = [
    { month: "Jan", value: 45000 },
    { month: "Feb", value: 52000 },
    { month: "Mar", value: 48000 },
    { month: "Apr", value: 61000 },
    { month: "May", value: 55000 },
    { month: "Jun", value: 67000 },
  ];

  const fmtUSD = (n: number) =>
    n.toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    });
  const fmtPct = (n: number) => `${n.toFixed(1)}%`;

  const [params] = useSearchParams();
  const address = params.get("address") || "";

  // --- Overview state ---
  const [ov, setOv] = useState<OverviewResponse | null>(null);
  const [loadingOv, setLoadingOv] = useState(false);
  const [errorOv, setErrorOv] = useState<string | null>(null);

  const [showChange, setShowChange] = useState(false);

  const topHoldingsLive = useMemo(() => {
    if (!ov) return [];
    return (ov.holdings || [])
      .filter((h) => (h.valueUsd ?? 0) > 0)
      .sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0))
      .slice(0, 5);
  }, [ov]);

  const allocationData = useMemo(() => {
    if (!ov) return [];
    // keep only priced tokens (value > 0)
    const items = ov.allocation
      .filter((a) => (a.valueUsd ?? 0) > 0)
      .sort((a, b) => b.valueUsd - a.valueUsd);

    // top N, group the rest as "Other"
    const TOP_N = 8;
    const top = items.slice(0, TOP_N);
    const otherVal = items.slice(TOP_N).reduce((s, x) => s + x.valueUsd, 0);
    const total = top.reduce((s, x) => s + x.valueUsd, 0) + otherVal || 1;

    const rows = top.map((a) => ({
      name: a.symbol || "(unknown)",
      pct: (a.valueUsd / total) * 100,
      usd: a.valueUsd,
    }));
    if (otherVal > 0) {
      rows.push({
        name: "Other",
        pct: (otherVal / total) * 100,
        usd: otherVal,
      });
    }
    return rows;
  }, [ov]);

  useEffect(() => {
    if (!address) return;
    setLoadingOv(true);
    setErrorOv(null);
    fetch(`/api/portfolio/overview/${encodeURIComponent(address)}?minUsd=1`)
      .then(async (r) => (r.ok ? r.json() : Promise.reject(await r.json())))
      .then(setOv)
      .catch((e) => setErrorOv(e?.error?.message || "Failed to load overview"))
      .finally(() => setLoadingOv(false));
  }, [address]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">
            Portfolio Dashboard
          </h1>
          <p className="text-slate-600">
            Track your crypto assets and tax obligations
          </p>
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
                    <p className="text-slate-600 text-sm font-medium">
                      Total Portfolio Value
                    </p>
                    <CurrencyDisplay
                      amount={ov?.kpis.totalValueUsd ?? 0}
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
                    <p className="text-slate-600 text-sm font-medium">
                      24h Change
                    </p>
                    <CurrencyDisplay
                      amount={ov?.kpis.delta24hUsd ?? 0}
                      currency={userPreferences.currency}
                      variant="large"
                    />
                  </div>
                  {ov?.kpis.delta24hUsd >= 0 ? (
                    <TrendingUp className="w-12 h-12 text-green-500" />
                  ) : (
                    <TrendingDown className="w-12 h-12 text-red-500" />
                  )}
                </div>
              </Card>

              {/* 
              
              TO DO : Metrics below require real data, so hiding for now, do after the MVP (demo) is done

              <Card className="p-6 bg-white shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-600 text-sm font-medium">
                      Unrealized P&L
                    </p>
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
                    <p className="text-slate-600 text-sm font-medium">
                      Tax Liability
                    </p>
                    <CurrencyDisplay
                      amount={3200}
                      currency={userPreferences.currency}
                      variant="large"
                    />
                  </div>
                  <DollarSign className="w-12 h-12 text-orange-500" />
                </div>
              </Card> */}
            </div>

            {/* Charts */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* <Card className="p-6 bg-white shadow-sm">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">
                  Portfolio Performance
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={portfolioData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#3b82f6"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card> */}

              <Card className="p-6 bg-white shadow-sm">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">
                  Asset Allocation
                </h3>

                {!ov && (
                  <div className="text-sm text-slate-500">
                    Load an address to see allocation.
                  </div>
                )}
                {ov && allocationData.length === 0 && (
                  <div className="text-sm text-slate-500">
                    No priced tokens to display.
                  </div>
                )}

                {ov && allocationData.length > 0 && (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={allocationData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                      <Tooltip
                        formatter={(value: any, _name, entry: any) => {
                          if (entry?.payload) {
                            const row = entry.payload as {
                              pct: number;
                              usd: number;
                            };
                            return [
                              `${fmtPct(row.pct)} • ${fmtUSD(row.usd)}`,
                              "Allocation",
                            ];
                          }
                          return [value, "Allocation"];
                        }}
                        labelFormatter={(label) => String(label)}
                      />
                      <Bar dataKey="pct" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>
            </div>

            {/* Asset Breakdown */}
            <Card className="p-6 bg-white shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800">
                  Top Holdings
                </h3>
                <button
                  onClick={() => setShowChange((v) => !v)}
                  className="text-sm px-3 py-1 rounded-md border border-slate-200 hover:bg-slate-100"
                >
                  {showChange ? "Show Value" : "Show 24h Change"}
                </button>
              </div>

              <div className="space-y-4">
                {loadingOv && (
                  <div className="text-sm text-slate-500">
                    Loading overview…
                  </div>
                )}
                {errorOv && (
                  <div className="text-sm text-red-500">{errorOv}</div>
                )}

                {ov &&
                  topHoldingsLive.map((h) => {
                    const delta = h.delta24hUsd ?? null;
                    const pct = h.delta24hPct ?? null;
                    const color =
                      delta == null
                        ? "text-slate-600"
                        : delta >= 0
                        ? "text-green-600"
                        : "text-red-600";
                    return (
                      <div
                        key={(h.contract ?? h.symbol) || Math.random()}
                        className="flex items-center justify-between p-4 bg-slate-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {(h.symbol || "TOK").slice(0, 3).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-slate-800">
                              {h.symbol || "(unknown)"}
                            </p>
                            <p className="text-sm text-slate-500">
                              {/* weight from allocation isn’t 1:1; show share via value proportion */}
                              {ov.kpis?.totalValueUsd
                                ? `${(
                                    (h.valueUsd / ov.kpis.totalValueUsd) *
                                    100
                                  ).toFixed(1)}% of portfolio`
                                : "—"}
                            </p>
                          </div>
                        </div>

                        {/* Right-side value */}
                        {!showChange ? (
                          <CurrencyDisplay
                            amount={h.valueUsd ?? 0}
                            currency="USD"
                            showSign={false}
                          />
                        ) : (
                          <div className="text-right">
                            <div className={`font-semibold ${color}`}>
                              <CurrencyDisplay
                                amount={delta ?? 0}
                                currency="USD"
                                showSign
                              />
                            </div>
                            <div className="text-xs text-slate-500">
                              {pct == null
                                ? "—"
                                : `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                {!loadingOv &&
                  !errorOv &&
                  ov &&
                  topHoldingsLive.length === 0 && (
                    <div className="text-sm text-slate-500">
                      No holdings with USD value.
                    </div>
                  )}
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
