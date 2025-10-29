"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  BarChart3,
  PieChart,
  DollarSign,
  Crown,
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
  PieChart as RPieChart,
  Pie,
  Cell,
  Legend,
  Treemap,
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
  const { wallets: userWallets } = useWallets();
  const router = useRouter();
  const [accountingMethod, setAccountingMethod] =
    useState<AccountingMethod>("FIFO");

  const [urlAddress, setUrlAddress] = useState<string>("");
  const [urlReady, setUrlReady] = useState(false);
  const [ov, setOv] = useState<OverviewResponse | null>(null);
  const [loadingOv, setLoadingOv] = useState(false);
  const [errorOv, setErrorOv] = useState<string | null>(null);
  const [showChange, setShowChange] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<string>("");
  const [minUsdFilter, setMinUsdFilter] = useState(5);
  const [hideStables, setHideStables] = useState(false);

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

  // Get all wallets from backend (main wallet from users table + secondary wallets from user_wallets table)
  const allWallets = useMemo(() => {
    // userWallets already contains:
    // 1. Main wallet (from users table) with up-to-date name
    // 2. Secondary wallets (from user_wallets table)
    // Just identify which is the main wallet
    return userWallets.map(w => ({
      ...w,
      isMain: w.address.toLowerCase() === userWallet?.toLowerCase()
    }));
  }, [userWallet, userWallets]);

  // Calculate width based on longest wallet name
  const maxWalletWidth = useMemo(() => {
    if (allWallets.length === 0) return 280;
    const longestName = allWallets.reduce((longest, wallet) => 
      wallet.name.length > longest.length ? wallet.name : longest, 
      allWallets[0].name
    );
    // Account for: checkmark space (32px) + crown icon (16px) + gap (8px) + name + address format "(0x...10...8)" (~28 chars) + padding (40px left + 16px right) + arrow (32px)
    const checkmarkSpace = 32; // space for checkmark in dropdown
    const iconSpace = 16 + 8; // crown + gap
    const addressChars = 28; // "(0x12345678...12345678)"
    const padding = 40 + 16; // left (pl-10) + right (pr-4) padding
    const arrowSpace = 32;
    // Rough estimation: ~8px per character for font-medium, ~6px for monospace
    const estimatedWidth = checkmarkSpace + iconSpace + (longestName.length * 8) + (addressChars * 6) + padding + arrowSpace;
    return Math.max(280, estimatedWidth);
  }, [allWallets]);

  // Auto-select first wallet (main wallet) when wallets are loaded
  useEffect(() => {
    if (allWallets.length > 0 && !selectedWallet && !urlAddress) {
      setSelectedWallet(allWallets[0].address);
    }
  }, [allWallets, selectedWallet, urlAddress]);

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
    )}&withDelta24h=true&minUsd=0&includeZero=true&spamFilter=hard&_ts=${Date.now()}`;

    fetch(url, { cache: "no-store" })
      .then(async (r) => (r.ok ? r.json() : Promise.reject(await r.json())))
      .then((data: OverviewResponse) => {
        // console.log("[FE] holdings overview kpis =", data.kpis); // sanity log
        setOv(data);
      })
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

  const stableVsRisk = useMemo(() => {
    if (!ov) return { stable: 0, nonStable: 0 };
    const stable = (ov.holdings ?? [])
      .filter((h) => isStable(h.symbol))
      .reduce((s, h) => s + (h.valueUsd || 0), 0);
    const total = ov.kpis.totalValueUsd || 0;
    return { stable, nonStable: Math.max(total - stable, 0) };
  }, [ov]);

  const effectiveN = (weightsPct: number[]) => {
    const w = weightsPct.map((p) => p / 100);
    const sumSq = w.reduce((s, x) => s + x * x, 0) || 1;
    return 1 / sumSq;
  };

  const concentrationExtras = useMemo(() => {
    const ws = (ov?.allocation ?? []).map((a) => a.weightPct);
    const effN = effectiveN(ws);
    const sorted = [...(ov?.allocation ?? [])].sort(
      (a, b) => b.weightPct - a.weightPct
    );
    const top1 = sorted[0]?.weightPct ?? 0;
    const top3 = sorted.slice(0, 3).reduce((s, a) => s + a.weightPct, 0);
    return { effN, top1, top3 };
  }, [ov]);

  const pnlByChain = useMemo(() => {
    const map = new Map<
      string,
      { label: string; pnl: number; value: number }
    >();
    for (const h of ov?.holdings ?? []) {
      const cur = map.get(h.chain) ?? {
        label: CHAIN_LABEL[h.chain] ?? h.chain,
        pnl: 0,
        value: 0,
      };
      cur.pnl += h.delta24hUsd ?? 0;
      cur.value += h.valueUsd ?? 0;
      map.set(h.chain, cur);
    }
    return [...map.values()].sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));
  }, [ov]);

  const treemapData = useMemo(() => {
    if (!ov) return [];
    return (ov.holdings ?? [])
      .filter((h) => (h.valueUsd || 0) > 0)
      .map((h) => ({
        name: `${CHAIN_LABEL[h.chain] ?? h.chain} / ${h.symbol || "(unknown)"}`,
        size: h.valueUsd || 0,
      }));
  }, [ov]);

  const filteredHoldings = useMemo(() => {
    return (ov?.holdings ?? [])
      .filter((h) => (h.valueUsd ?? 0) >= minUsdFilter)
      .filter((h) => (hideStables ? !isStable(h.symbol) : true))
      .sort((a, b) => (b.valueUsd || 0) - (a.valueUsd || 0));
  }, [ov, minUsdFilter, hideStables]);

  const quality = useMemo(() => {
    if (!ov) return null;
    const tvl = ov.kpis.totalValueUsd || 1;
    const volProxy = (Math.abs(ov.kpis.delta24hUsd || 0) / tvl) * 100;
    const bluechipShare =
      ((ov.holdings ?? [])
        .filter((h) =>
          ["ETH", "WETH", "WBTC", "BTC"].includes(
            (h.symbol || "").toUpperCase()
          )
        )
        .reduce((s, h) => s + (h.valueUsd || 0), 0) /
        tvl) *
      100;
    const chainSpread = chainBreakdown.filter((c) => c.pct >= 2).length;
    return { volProxy, bluechipShare, chainSpread };
  }, [ov, chainBreakdown]);

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
            {allWallets.length > 1 && (
              <div className="relative inline-block">
                <Select value={selectedWallet} onValueChange={setSelectedWallet}>
                  <SelectTrigger 
                    className="h-12 pl-10 pr-4 border-2 border-slate-200 rounded-xl bg-white shadow-md hover:border-blue-400 focus:ring-2 focus:ring-blue-500 transition-all duration-200 text-slate-800 font-medium"
                    style={{ width: `${maxWalletWidth}px` }}
                  >
                    <div className="flex items-center gap-2">
                      {(() => {
                        const selected = allWallets.find(w => w.address === selectedWallet);
                        if (!selected) return null;
                        return (
                          <>
                            {selected.isMain && (
                              <Crown className="w-4 h-4 text-amber-500 flex-shrink-0" />
                            )}
                            <span className="font-medium">{selected.name}</span>
                            <span className="text-slate-500 font-mono text-sm">
                              ({selected.address.slice(0, 10)}...{selected.address.slice(-8)})
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-2 shadow-lg w-[var(--radix-select-trigger-width)]">
                    {allWallets.map((wallet) => (
                      <SelectItem 
                        key={wallet.address} 
                        value={wallet.address}
                        className="py-3 pl-10 pr-4 text-slate-800 font-medium cursor-pointer hover:bg-blue-50 focus:bg-blue-50"
                      >
                        <div className="flex items-center gap-2">
                          {wallet.isMain && (
                            <Crown className="w-4 h-4 text-amber-500 flex-shrink-0" />
                          )}
                          <span className="font-medium">{wallet.name}</span>
                          <span className="text-slate-500 font-mono text-sm">
                            ({wallet.address.slice(0, 10)}...{wallet.address.slice(-8)})
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                {quality && (
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs px-2 py-1 rounded bg-slate-100">
                      Vol (24h proxy): {quality.volProxy.toFixed(2)}%
                    </span>
                    <span className="text-xs px-2 py-1 rounded bg-slate-100">
                      Blue-chip: {quality.bluechipShare.toFixed(1)}%
                    </span>
                    <span className="text-xs px-2 py-1 rounded bg-slate-100">
                      Chains ≥2%: {quality.chainSpread}
                    </span>
                  </div>
                )}
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
                {!loadingOv && (
                  <p className="text-xs text-slate-500 mt-1">
                    Eff. assets: {concentrationExtras.effN.toFixed(1)} • Top-1:{" "}
                    {concentrationExtras.top1.toFixed(1)}% • Top-3:{" "}
                    {concentrationExtras.top3.toFixed(1)}%
                  </p>
                )}
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
            </div>

            {/* Charts */}
            <div className="grid lg:grid-cols-2 gap-6">
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

              <Card className="p-6 bg-white shadow-sm">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">
                  Stable vs. Risk Assets
                </h3>
                {loadingOv || !ov ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <RPieChart>
                      <Pie
                        data={[
                          { name: "Stablecoins", value: stableVsRisk.stable },
                          {
                            name: "Non-stables",
                            value: stableVsRisk.nonStable,
                          },
                        ]}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={110}
                        label={(e) =>
                          `${e.name} (${fmtPct(
                            (e.value / (ov?.kpis.totalValueUsd || 1)) * 100
                          )})`
                        }
                      >
                        <Cell /> <Cell />
                      </Pie>
                      <Legend />
                    </RPieChart>
                  </ResponsiveContainer>
                )}
              </Card>

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
                  24h P&L by Chain
                </h3>
                {loadingOv || !ov ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : pnlByChain.length === 0 ? (
                  <div className="text-sm text-slate-500">No 24h data.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={pnlByChain}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis tickFormatter={(v) => fmtUSD(v)} />
                      <Tooltip
                        formatter={(v: any, _n: any, e: any) => [
                          fmtUSD(v),
                          "24h Δ",
                        ]}
                      />
                      <Bar dataKey="pnl" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
                {!loadingOv && !!ov && (
                  <p className="text-xs text-slate-500 mt-2">
                    Weighted move:{" "}
                    {fmtUSD(pnlByChain.reduce((s, r) => s + r.pnl, 0))} over
                    24h.
                  </p>
                )}
              </Card>

              <Card className="p-6 bg-white shadow-sm lg:col-span-2">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">
                  Performance Heatmap
                </h3>
                {loadingOv ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : !ov ? (
                  <div className="text-sm text-slate-500">
                    Load an address to see performance metrics.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-6 gap-2">
                      {ov.holdings
                        .filter((h) => (h.valueUsd || 0) > minUsdFilter)
                        .sort((a, b) => (b.valueUsd || 0) - (a.valueUsd || 0))
                        .slice(0, 12)
                        .map((h) => (
                          <div
                            key={h.contract || h.symbol}
                            className={`p-4 rounded-lg ${
                              !h.delta24hPct
                                ? "bg-slate-100"
                                : h.delta24hPct > 5
                                ? "bg-green-500"
                                : h.delta24hPct > 2
                                ? "bg-green-300"
                                : h.delta24hPct > 0
                                ? "bg-green-100"
                                : h.delta24hPct > -2
                                ? "bg-red-100"
                                : h.delta24hPct > -5
                                ? "bg-red-300"
                                : "bg-red-500"
                            }`}
                          >
                            <div className="text-center">
                              <p className="font-medium text-sm mb-1">
                                {h.symbol}
                              </p>
                              <p
                                className={`text-xs ${
                                  !h.delta24hPct
                                    ? "text-slate-600"
                                    : h.delta24hPct > 0
                                    ? "text-green-800"
                                    : "text-red-800"
                                }`}
                              >
                                {h.delta24hPct?.toFixed(1)}%
                              </p>
                              <p className="text-xs text-slate-600 mt-1">
                                {fmtUSD(h.valueUsd || 0)}
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>

                    <div className="flex justify-center gap-4 text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-red-500 rounded"></span>
                        <span>{"< -5%"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-red-300 rounded"></span>
                        <span>-5% to -2%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-red-100 rounded"></span>
                        <span>-2% to 0%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-green-100 rounded"></span>
                        <span>0% to 2%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-green-300 rounded"></span>
                        <span>2% to 5%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-green-500 rounded"></span>
                        <span>{"> 5%"}</span>
                      </div>
                    </div>
                  </div>
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
                        key={`${h.contract ?? 'native'}-${h.symbol ?? 'unknown'}-${index}`}
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

            <Card className="p-6 bg-white shadow-sm mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800">
                  All Holdings
                </h3>
                <div className="flex items-center gap-3">
                  <label className="text-sm">
                    Min value (USD):
                    <input
                      type="number"
                      className="ml-2 px-2 py-1 border rounded w-24"
                      value={minUsdFilter}
                      onChange={(e) =>
                        setMinUsdFilter(parseFloat(e.target.value || "0"))
                      }
                    />
                  </label>
                  <label className="text-sm flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={hideStables}
                      onChange={(e) => setHideStables(e.target.checked)}
                    />
                    Hide stables
                  </label>
                </div>
              </div>

              {loadingOv ? (
                <div className="space-y-2">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                </div>
              ) : !filteredHoldings || filteredHoldings.length === 0 ? (
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
                      {filteredHoldings
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
