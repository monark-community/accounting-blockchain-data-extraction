"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { Tooltip } from "recharts";
import { useWallets } from "@/hooks/use-wallets";

type PricedHolding = {
  contract: string | null;
  symbol: string;
  decimals: number;
  qty: string;
  priceUsd: number;
  valueUsd: number;
  delta24hUsd?: number | null;
  delta24hPct?: number | null;
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

/** Format a number as USD */
const fmtUSD = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

/** Format a number as percentage */
const fmtPct = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(n / 100);

const Dashboard = () => {
  const {
    connectedWallets,
    getWalletName,
    userPreferences,
    chainId,
    userWallet,
    isConnected,
  } = useWallet();
  const { wallets: userWallets } = useWallets();
  const router = useRouter();
  const [accountingMethod, setAccountingMethod] =
    useState<AccountingMethod>("FIFO");

  // Remove mock data
  const [urlAddress, setUrlAddress] = useState<string>("");
  const [urlReady, setUrlReady] = useState(false);
  const [ov, setOv] = useState<OverviewResponse | null>(null);
  const [loadingOv, setLoadingOv] = useState(false);
  const [errorOv, setErrorOv] = useState<string | null>(null);
  const [showChange, setShowChange] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<string>("");

  // Get address from URL params on client side to avoid hydration issues
  // Read ?address=... exactly once after mount
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setUrlAddress(sp.get("address") || "");
    setUrlReady(true);
  }, []);

  // Use URL address if available, otherwise use selected wallet, otherwise use connected wallet address
  const address = useMemo(
    () =>
      urlAddress ? urlAddress : selectedWallet || (isConnected && userWallet ? userWallet : ""),
    [urlAddress, selectedWallet, isConnected, userWallet]
  );

  // Auto-select first wallet when userWallets are loaded and no wallet is selected
  useEffect(() => {
    if (userWallets.length > 0 && !selectedWallet && !urlAddress) {
      setSelectedWallet(userWallets[0].address);
    }
  }, [userWallets, selectedWallet, urlAddress]);

  // Redirect to home ONLY after URL is parsed and truly no address is available
  useEffect(() => {
    if (!urlReady) return;
    if (!address && !isConnected) {
      router.push("/");
    }
  }, [urlReady, address, isConnected, router]);

  // --- Overview state ---
  const topHoldingsLive = useMemo(() => {
    const rows = (ov?.holdings ?? []).slice();
    rows.sort((a, b) => {
      const va = a.valueUsd ?? 0;
      const vb = b.valueUsd ?? 0;
      if (vb !== va) return vb - va; // prefer priced when available
      // fallback by qty if both 0
      const qa = parseFloat(a.qty || "0");
      const qb = parseFloat(b.qty || "0");
      return qb - qa;
    });
    return rows.slice(0, 5);
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
    fetch(
      `/api/portfolio/overview/${encodeURIComponent(
        address
      )}?minUsd=0&chainId=${chainId}`
    )
      .then(async (r) => (r.ok ? r.json() : Promise.reject(await r.json())))
      .then(setOv)
      .catch((e) => setErrorOv(e?.error?.message || "Failed to load overview"))
      .finally(() => setLoadingOv(false));
  }, [address, chainId, userWallet, isConnected]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-800 mb-2">
                Portfolio Dashboard
              </h1>
              <p className="text-slate-600">
                Track your crypto assets and tax obligations
              </p>
            </div>
            {userWallets.length > 0 && (
              <select
                value={selectedWallet}
                onChange={(e) => setSelectedWallet(e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {userWallets.map((wallet) => (
                  <option key={wallet.address} value={wallet.address}>
                    {wallet.name} ({wallet.address.slice(0, 6)}...{wallet.address.slice(-4)})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="all-transactions">All Transactions</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Portfolio Summary Cards */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="p-6 bg-white shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-slate-600 text-sm font-medium">
                      Total Portfolio Value
                    </p>
                    {loadingOv ? (
                      <div className="mt-2">
                        <Skeleton className="h-8 w-32" />
                      </div>
                    ) : (
                      <CurrencyDisplay
                        amount={ov?.kpis.totalValueUsd ?? 0}
                        currency={userPreferences.currency}
                        variant="large"
                        showSign={false}
                      />
                    )}
                  </div>
                  <Wallet className="w-12 h-12 text-blue-500" />
                </div>
              </Card>

              <Card className="p-6 bg-white shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-slate-600 text-sm font-medium">
                      24h Change
                    </p>
                    {loadingOv ? (
                      <div className="mt-2">
                        <Skeleton className="h-8 w-24" />
                      </div>
                    ) : (
                      <CurrencyDisplay
                        amount={ov?.kpis.delta24hUsd ?? 0}
                        currency={userPreferences.currency}
                        variant="large"
                      />
                    )}
                  </div>
                  {loadingOv ? (
                    <Skeleton className="w-12 h-12 rounded-full" />
                  ) : ov?.kpis.delta24hUsd >= 0 ? (
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

                {loadingOv ? (
                  <div className="space-y-4">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-[300px] w-full" />
                  </div>
                ) : !ov ? (
                  <div className="text-sm text-slate-500">
                    Load an address to see allocation.
                  </div>
                ) : ov && allocationData.length === 0 ? (
                  <div className="text-sm text-slate-500">
                    No priced tokens to display.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={allocationData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                      <Tooltip
                        formatter={(
                          value: unknown,
                          _name: string,
                          entry: { payload?: { pct: number; usd: number } }
                        ) => {
                          if (entry?.payload) {
                            const row = entry.payload;
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
                  <>
                    {/* Loading skeletons for top holdings */}
                    {[...Array(3)].map((_, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-4 bg-slate-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Skeleton className="w-10 h-10 rounded-full" />
                          <div>
                            <Skeleton className="h-4 w-16 mb-2" />
                            <Skeleton className="h-3 w-20" />
                          </div>
                        </div>
                        <div className="text-right">
                          <Skeleton className="h-4 w-20 mb-1" />
                          <Skeleton className="h-3 w-12" />
                        </div>
                      </div>
                    ))}
                  </>
                )}
                {errorOv && (
                  <div className="text-sm text-red-500">{errorOv}</div>
                )}

                {!loadingOv &&
                  ov &&
                  topHoldingsLive.map((h, index) => {
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
                        key={h.contract ?? h.symbol ?? `holding-${index}`}
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
                              {/* weight from allocation isn't 1:1; show share via value proportion */}
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

          <TabsContent value="all-transactions">
            <AllTransactionsTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;
