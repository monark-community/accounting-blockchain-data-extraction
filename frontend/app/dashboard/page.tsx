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
import { OverviewResponse, PricedHolding } from "@/lib/portfolioTypes";
import {
  fmtUSD,
  fmtPct,
  chainBadgeClass,
  CHAIN_LABEL,
  computeHHI,
  isStable,
} from "@/lib/portfolioUtils";

const Dashboard = () => {
  const {
    connectedWallets,
    getWalletName,
    userPreferences,
    chainId,
    userWallet,
    isConnected,
  } = useWallet();
  const router = useRouter();
  const [accountingMethod, setAccountingMethod] =
    useState<AccountingMethod>("FIFO");

  const [urlAddress, setUrlAddress] = useState<string>("");
  const [urlReady, setUrlReady] = useState(false);
  const [ov, setOv] = useState<OverviewResponse | null>(null);
  const [loadingOv, setLoadingOv] = useState(false);
  const [errorOv, setErrorOv] = useState<string | null>(null);
  const [showChange, setShowChange] = useState(false);

  // Get address from URL params on client side to avoid hydration issues
  // Read ?address=... exactly once after mount
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setUrlAddress(sp.get("address") || "");
    setUrlReady(true);
  }, []);

  // Use URL address if available, otherwise use connected wallet address
  const address = useMemo(
    () =>
      urlAddress ? urlAddress : isConnected && userWallet ? userWallet : "",
    [urlAddress, isConnected, userWallet]
  );

  // Redirect to home ONLY after URL is parsed and truly no address is available
  useEffect(() => {
    if (!urlReady) return;
    if (!address && !isConnected) {
      router.push("/");
    }
  }, [urlReady, address, isConnected, router]);

  const [networks, setNetworks] = useState<string>(
    "mainnet,polygon,base,optimism,arbitrum-one,bsc,avalanche,unichain"
  );

  useEffect(() => {
    if (!address) return;
    setLoadingOv(true);
    setErrorOv(null);

    const url = `/api/holdings/${encodeURIComponent(
      address
    )}?networks=${encodeURIComponent(
      networks
    )}&withDelta24h=false&minUsd=0&includeZero=true&spamFilter=hard`;

    fetch(url)
      .then(async (r) => (r.ok ? r.json() : Promise.reject(await r.json())))
      .then((data: OverviewResponse) => setOv(data))
      .catch((e) => setErrorOv(e?.error ?? "Failed to load overview"))
      .finally(() => setLoadingOv(false));
  }, [address, networks, userWallet, isConnected]);

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

  // Chain-level breakdown (sum of values per chain)
  const chainBreakdown = useMemo(() => {
    if (!ov) return [];
    const byChain = new Map<string, number>();
    for (const h of ov.holdings) {
      byChain.set(h.chain, (byChain.get(h.chain) ?? 0) + (h.valueUsd || 0));
    }
    const total = [...byChain.values()].reduce((s, v) => s + v, 0) || 1;
    return [...byChain.entries()]
      .map(([chain, usd]) => ({
        chain,
        label: CHAIN_LABEL[chain] ?? chain,
        usd,
        pct: (usd / total) * 100,
      }))
      .sort((a, b) => b.usd - a.usd);
  }, [ov]);

  // Top movers (24h) — requires deltas present
  const movers = useMemo(() => {
    const rows = (ov?.holdings ?? []).filter(
      (h) => typeof h.delta24hUsd === "number"
    );
    const gainers = rows
      .slice()
      .sort((a, b) => b.delta24hUsd! - a.delta24hUsd!)
      .slice(0, 5);
    const losers = rows
      .slice()
      .sort((a, b) => a.delta24hUsd! - b.delta24hUsd!)
      .slice(0, 5);
    return { gainers, losers };
  }, [ov]);

  // Concentration metrics & stablecoin share (quick badges)
  const concentration = useMemo(() => {
    const w = (ov?.allocation ?? []).map((a) => a.weightPct);
    const hhi = computeHHI(w);
    const label =
      hhi > 25
        ? "Highly concentrated"
        : hhi > 15
        ? "Moderately concentrated"
        : "Well diversified";
    const stablesUSD = (ov?.holdings ?? [])
      .filter((h) => isStable(h.symbol))
      .reduce((s, h) => s + (h.valueUsd || 0), 0);
    const stableSharePct =
      (ov?.kpis.totalValueUsd ?? 0) > 0
        ? (stablesUSD / ov!.kpis.totalValueUsd) * 100
        : 0;
    return { hhi, label, stableSharePct };
  }, [ov]);

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

              <Card className="p-6 bg-white shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-slate-600 text-sm font-medium">
                      Diversification (HHI)
                    </p>
                    {loadingOv ? (
                      <div className="mt-2">
                        <Skeleton className="h-8 w-28" />
                      </div>
                    ) : (
                      <div className="mt-2">
                        <p className="text-xl font-semibold text-slate-800">
                          {concentration.hhi.toFixed(1)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {concentration.label}
                        </p>
                      </div>
                    )}
                  </div>
                  <BarChart3 className="w-12 h-12 text-purple-500" />
                </div>
              </Card>

              <Card className="p-6 bg-white shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-slate-600 text-sm font-medium">
                      Stablecoin Share
                    </p>
                    {loadingOv ? (
                      <div className="mt-2">
                        <Skeleton className="h-8 w-24" />
                      </div>
                    ) : (
                      <div className="mt-2">
                        <p className="text-xl font-semibold text-slate-800">
                          {concentration.stableSharePct.toFixed(1)}%
                        </p>
                        <p className="text-xs text-slate-500">
                          Of total portfolio
                        </p>
                      </div>
                    )}
                  </div>
                  <DollarSign className="w-12 h-12 text-orange-500" />
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
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-slate-800">
                    Allocation by Chain
                  </h3>
                </div>

                {loadingOv ? (
                  <div className="space-y-4">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-[300px] w-full" />
                  </div>
                ) : !ov ? (
                  <div className="text-sm text-slate-500">
                    Load an address to see allocation by chain.
                  </div>
                ) : chainBreakdown.length === 0 ? (
                  <div className="text-sm text-slate-500">
                    No priced tokens to display.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chainBreakdown}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
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
                      <Bar dataKey="pct" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>

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
                            <p className="font-medium text-slate-800 flex items-center gap-2">
                              {h.symbol || "(unknown)"}
                              <span
                                className={`px-2 py-0.5 text-xs rounded ${
                                  chainBadgeClass[(h as any).chain] ||
                                  "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {CHAIN_LABEL[(h as any).chain] ??
                                  (h as any).chain}
                              </span>
                            </p>
                            <p className="text-sm text-slate-500">
                              {ov?.kpis?.totalValueUsd
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

            <Card className="p-6 bg-white shadow-sm mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800">
                  All Holdings
                </h3>
                {/* optional: filters dropdown later */}
              </div>

              {loadingOv ? (
                <div className="space-y-2">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                </div>
              ) : !ov || ov.holdings.length === 0 ? (
                <div className="text-sm text-slate-500">
                  No holdings to display.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="px-2 py-2">Asset</th>
                        <th className="px-2 py-2">Chain</th>
                        <th className="px-2 py-2 text-right">Qty</th>
                        <th className="px-2 py-2 text-right">Price</th>
                        <th className="px-2 py-2 text-right">Value</th>
                        <th className="px-2 py-2 text-right">24h Δ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ov.holdings
                        .slice()
                        .sort((a, b) => (b.valueUsd || 0) - (a.valueUsd || 0))
                        .map((h, i) => (
                          <tr
                            key={`${h.contract ?? h.symbol ?? i}`}
                            className="border-t"
                          >
                            <td className="px-2 py-2 font-medium text-slate-800">
                              {h.symbol || "(unknown)"}
                            </td>
                            <td className="px-2 py-2">
                              <span
                                className={`px-2 py-0.5 text-xs rounded ${
                                  chainBadgeClass[(h as any).chain] ||
                                  "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {CHAIN_LABEL[(h as any).chain] ??
                                  (h as any).chain}
                              </span>
                            </td>
                            <td className="px-2 py-2 text-right">
                              {parseFloat(h.qty).toLocaleString()}
                            </td>
                            <td className="px-2 py-2 text-right">
                              {fmtUSD(h.priceUsd || 0)}
                            </td>
                            <td className="px-2 py-2 text-right">
                              {fmtUSD(h.valueUsd || 0)}
                            </td>
                            <td
                              className={`px-2 py-2 text-right ${
                                (h.delta24hUsd ?? 0) >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {h.delta24hUsd == null
                                ? "—"
                                : `${h.delta24hUsd >= 0 ? "+" : ""}${fmtUSD(
                                    Math.abs(h.delta24hUsd)
                                  )}`}
                              {h.delta24hPct == null
                                ? ""
                                : ` (${h.delta24hPct.toFixed(2)}%)`}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card className="p-6 bg-white shadow-sm mt-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">
                Top Movers (24h)
              </h3>

              {loadingOv ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                </div>
              ) : !ov ? (
                <div className="text-sm text-slate-500">
                  Load an address to see movers.
                </div>
              ) : movers.gainers.length + movers.losers.length === 0 ? (
                <div className="text-sm text-slate-500">
                  No 24h change data available.
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Gainers */}
                  <div>
                    <p className="text-sm font-medium text-green-700 mb-2">
                      Top Gainers
                    </p>
                    {movers.gainers.map((h, i) => (
                      <div
                        key={`g-${i}`}
                        className="flex items-center justify-between py-2 border-b border-slate-100"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 text-xs rounded ${
                              chainBadgeClass[h.chain] ||
                              "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {CHAIN_LABEL[h.chain] ?? h.chain}
                          </span>
                          <span className="font-medium text-slate-800">
                            {h.symbol || "(unknown)"}
                          </span>
                        </div>
                        <div className="text-right text-green-700 font-semibold">
                          {fmtUSD(h.delta24hUsd ?? 0)}{" "}
                          <span className="text-xs text-green-700">
                            ({h.delta24hPct?.toFixed(2) ?? "0.00"}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Losers */}
                  <div>
                    <p className="text-sm font-medium text-red-700 mb-2">
                      Top Losers
                    </p>
                    {movers.losers.map((h, i) => (
                      <div
                        key={`l-${i}`}
                        className="flex items-center justify-between py-2 border-b border-slate-100"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 text-xs rounded ${
                              chainBadgeClass[h.chain] ||
                              "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {CHAIN_LABEL[h.chain] ?? h.chain}
                          </span>
                          <span className="font-medium text-slate-800">
                            {h.symbol || "(unknown)"}
                          </span>
                        </div>
                        <div className="text-right text-red-700 font-semibold">
                          {fmtUSD(h.delta24hUsd ?? 0)}{" "}
                          <span className="text-xs text-red-700">
                            ({h.delta24hPct?.toFixed(2) ?? "0.00"}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
