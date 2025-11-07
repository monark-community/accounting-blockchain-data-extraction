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
  PieChart as RPieChart,
  Pie,
  Cell,
  Legend,
  Treemap,
  Tooltip as RechartsTooltip,
  AreaChart,
  Area,
  ReferenceLine,
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
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { OverviewResponse, PricedHolding } from "@/lib/portfolioTypes";
import {
  fmtUSD,
  fmtPct,
  chainBadgeClass,
  CHAIN_LABEL,
  computeHHI,
  isStable,
} from "@/lib/portfolioUtils";
import { fetchHistoricalData, type HistoricalPoint } from "@/lib/api/analytics";

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
  const [minUsdFilter, setMinUsdFilter] = useState(5);
  const [hideStables, setHideStables] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [historicalData, setHistoricalData] = useState<HistoricalPoint[]>([]);
  const [loadingHistorical, setLoadingHistorical] = useState(false);
  const [isHistoricalEstimated, setIsHistoricalEstimated] = useState(false);

  // Get address from URL params on client side to avoid hydration issues
  // Read ?address=... exactly once after mount
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setUrlAddress(sp.get("address") || "");
    setUrlReady(true);
  }, []);

  useEffect(() => {
    setMounted(true);
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

  // Fetch historical data for 6-month graph
  useEffect(() => {
    if (!address) {
      console.log("[Dashboard] No address, skipping historical data fetch");
      return;
    }
    console.log(`[Dashboard] Fetching historical data for ${address}, networks: ${networks}`);
    setLoadingHistorical(true);
    fetchHistoricalData(address, {
      networks,
      days: 180,
    })
      .then((response) => {
        console.log(`[Dashboard] Historical data received: ${response.data.length} points`);
        // Clean data by removing internal _isEstimated field
        const cleanData = response.data.map((point: any) => {
          const { _isEstimated, ...rest } = point;
          return rest;
        });
        setHistoricalData(cleanData);
        setIsHistoricalEstimated(response.isEstimated || false);
      })
      .catch((e) => {
        console.error("[Dashboard] Failed to load historical data:", e);
      })
      .finally(() => {
        setLoadingHistorical(false);
        console.log("[Dashboard] Historical data fetch completed");
      });
  }, [address, networks]);

  const historicalChartData = useMemo(() => {
    console.log(`[Dashboard] Processing historical data: ${historicalData.length} points`);
    if (historicalData.length === 0) {
      console.log("[Dashboard] No historical data to process");
      return [];
    }
    const processed = historicalData
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((point) => ({
        date: new Date(point.date).toLocaleDateString("fr-FR", {
          month: "short",
          day: "numeric",
        }),
        value: point.totalValueUsd,
        timestamp: point.timestamp,
      }));
    console.log(`[Dashboard] Processed chart data: ${processed.length} points`);
    return processed;
  }, [historicalData]);

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
          <h1 className="text-3xl font-bold text-slate-800 mb-2">
            Portfolio Dashboard
          </h1>
          <p className="text-slate-600">
            Track your crypto assets and tax obligations
          </p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="flex w-full gap-2">
            <TabsTrigger className="flex-1" value="overview">Overview</TabsTrigger>
            <TabsTrigger className="flex-1" value="graphs">Graphs</TabsTrigger>
            <TabsTrigger className="flex-1" value="all-transactions">All Transactions</TabsTrigger>
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
                  mounted ? (
                    <div className="flex flex-wrap gap-2">
                      <HoverCard>
                        <HoverCardTrigger asChild>
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-slate-200 bg-white text-xs text-slate-700 shadow-sm hover:bg-slate-50 transition cursor-help">
                            <span>Vol (24h proxy): {quality.volProxy.toFixed(2)}%</span>
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-300" />
                          </span>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-80">
                          <p className="text-sm font-medium mb-2">Volatility (24h proxy)</p>
                          <p className="text-xs text-slate-600 mb-2">Absolute value of 24h P&L divided by total portfolio value. Higher = more volatile.</p>
                          <div className="mt-2 pt-2 border-t border-slate-200">
                            <p className="text-xs font-mono text-slate-500 mb-1">Formula:</p>
                            <p className="text-xs text-slate-700 font-mono">|Δ24h USD| / TVL × 100%</p>
                            <p className="text-xs text-slate-500 mt-2">Where Δ24h = absolute change in USD over 24h, TVL = total portfolio value.</p>
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                      <HoverCard>
                        <HoverCardTrigger asChild>
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-slate-200 bg-white text-xs text-slate-700 shadow-sm hover:bg-slate-50 transition cursor-help">
                            <span>Blue-chip: {quality.bluechipShare.toFixed(1)}%</span>
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-300" />
                          </span>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-80">
                          <p className="text-sm font-medium mb-2">Blue-chip share</p>
                          <p className="text-xs text-slate-600 mb-2">Portion of portfolio held in ETH, WETH, BTC, or WBTC.</p>
                          <div className="mt-2 pt-2 border-t border-slate-200">
                            <p className="text-xs font-mono text-slate-500 mb-1">Formula:</p>
                            <p className="text-xs text-slate-700 font-mono">(Σ value ETH/WETH/BTC/WBTC) / TVL × 100%</p>
                            <p className="text-xs text-slate-500 mt-2">Sum of USD values of all ETH, WETH, BTC, WBTC tokens divided by total value.</p>
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                      <HoverCard>
                        <HoverCardTrigger asChild>
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-slate-200 bg-white text-xs text-slate-700 shadow-sm hover:bg-slate-50 transition cursor-help">
                            <span>Chains ≥2%: {quality.chainSpread}</span>
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-300" />
                          </span>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-80">
                          <p className="text-sm font-medium mb-2">Chain breadth</p>
                          <p className="text-xs text-slate-600 mb-2">Number of chains representing at least 2% of portfolio value.</p>
                          <div className="mt-2 pt-2 border-t border-slate-200">
                            <p className="text-xs font-mono text-slate-500 mb-1">Calculation:</p>
                            <p className="text-xs text-slate-700 font-mono">count(chains where chain_value / TVL ≥ 0.02)</p>
                            <p className="text-xs text-slate-500 mt-2">Multi-chain diversification indicator. Higher = better distribution.</p>
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs px-2 py-1 rounded-full border border-slate-200 bg-white">Vol (24h proxy): {quality.volProxy.toFixed(2)}%</span>
                      <span className="text-xs px-2 py-1 rounded-full border border-slate-200 bg-white">Blue-chip: {quality.bluechipShare.toFixed(1)}%</span>
                      <span className="text-xs px-2 py-1 rounded-full border border-slate-200 bg-white">Chains ≥2%: {quality.chainSpread}</span>
                    </div>
                  )
                )}
              </Card>

              <Card className="p-6 bg-white shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    {mounted ? (
                      <HoverCard>
                        <HoverCardTrigger asChild>
                          <p className="text-slate-600 text-sm font-medium cursor-help">Diversification (HHI)</p>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-80">
                          <p className="text-sm font-medium mb-2">Herfindahl–Hirschman Index (HHI)</p>
                          <p className="text-xs text-slate-600 mb-3">Concentration measure calculated on asset weights in the portfolio. Lower = better diversification.</p>
                          <div className="mt-2 pt-2 border-t border-slate-200">
                            <p className="text-xs font-mono text-slate-500 mb-1">Formula:</p>
                            <p className="text-xs text-slate-700 font-mono mb-2">HHI = Σ(w_i)² × 100</p>
                            <p className="text-xs text-slate-600 mb-2">Where w_i = percentage weight of asset i divided by 100.</p>
                          </div>
                          <div className="mt-3 pt-2 border-t border-slate-200">
                            <p className="text-xs font-medium text-slate-700 mb-1">Interpretation:</p>
                            <ul className="text-xs text-slate-600 space-y-0.5 list-disc list-inside">
                              <li>&lt; 15 : Well diversified (multiple balanced assets)</li>
                              <li>15-25 : Moderately concentrated (few dominant assets)</li>
                              <li>&gt; 25 : Highly concentrated (high concentration risk)</li>
                            </ul>
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                    ) : (
                      <p className="text-slate-600 text-sm font-medium">Diversification (HHI)</p>
                    )}
                    {loadingOv ? (
                      <div className="mt-2">
                        <Skeleton className="h-8 w-28" />
                      </div>
                    ) : mounted ? (
                      <div className="mt-2">
                        <HoverCard>
                          <HoverCardTrigger asChild>
                            <p className="text-xl font-semibold text-slate-800 cursor-help">
                              {concentration.hhi.toFixed(1)}
                            </p>
                          </HoverCardTrigger>
                          <HoverCardContent className="w-72">
                            <p className="text-xs font-medium text-slate-700 mb-1">Current HHI value</p>
                            <p className="text-xs text-slate-600 mb-2">Concentration index calculated on {ov?.allocation?.length || 0} assets in the portfolio.</p>
                            <p className="text-xs text-slate-500 italic">Hover over the title for more details on the calculation.</p>
                          </HoverCardContent>
                        </HoverCard>
                        <p className="text-xs text-slate-500">
                          {concentration.label}
                        </p>
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
                  mounted ? (
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <p className="text-xs text-slate-500 mt-1 cursor-help">
                          Eff. assets: {concentrationExtras.effN.toFixed(1)} • Top-1: {concentrationExtras.top1.toFixed(1)}% • Top-3: {concentrationExtras.top3.toFixed(1)}%
                        </p>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-80">
                        <p className="text-sm font-medium mb-2">Concentration details</p>
                        <div className="text-xs text-slate-600 mb-3 space-y-2">
                          <div>
                            <p className="font-medium text-slate-700 mb-0.5">Eff. assets (effective assets):</p>
                            <p>Effective number of equivalent assets ≈ 1/∑w². Indicates how many balanced assets compose the portfolio.</p>
                          </div>
                          <div>
                            <p className="font-medium text-slate-700 mb-0.5">Top-1:</p>
                            <p>Percentage weight of the largest asset in the portfolio.</p>
                          </div>
                          <div>
                            <p className="font-medium text-slate-700 mb-0.5">Top-3:</p>
                            <p>Cumulative sum of weights of the 3 largest positions.</p>
                          </div>
                        </div>
                        <div className="mt-3 pt-2 border-t border-slate-200">
                          <p className="text-xs font-mono text-slate-500 mb-1">Formula:</p>
                          <p className="text-xs text-slate-700 font-mono mb-2">Eff. assets = 1 / Σ(w_i)²</p>
                          <p className="text-xs text-slate-600">Where w_i = normalized weight (weight % / 100). If all assets are equal, Eff. assets = number of assets.</p>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  ) : (
                    <p className="text-xs text-slate-500 mt-1">
                      Eff. assets: {concentrationExtras.effN.toFixed(1)} • Top-1: {concentrationExtras.top1.toFixed(1)}% • Top-3: {concentrationExtras.top3.toFixed(1)}%
                    </p>
                  )
                )}
              </Card>

              <Card className="p-6 bg-white shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    {mounted ? (
                      <HoverCard>
                        <HoverCardTrigger asChild>
                          <p className="text-slate-600 text-sm font-medium cursor-help">Stablecoin Share</p>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-80">
                          <p className="text-sm font-medium mb-2">Stablecoin exposure</p>
                          <p className="text-xs text-slate-600 mb-3">Percentage of total portfolio value held in stablecoins. Indicator of currency risk and liquidity.</p>
                          <div className="mt-2 pt-2 border-t border-slate-200">
                            <p className="text-xs font-mono text-slate-500 mb-1">Formula:</p>
                            <p className="text-xs text-slate-700 font-mono mb-2">Stablecoin Share = (Σ stablecoins_value_USD) / TVL × 100%</p>
                            <p className="text-xs text-slate-600 mb-2">Where TVL = total portfolio value in USD.</p>
                          </div>
                          <div className="mt-3 pt-2 border-t border-slate-200">
                            <p className="text-xs font-medium text-slate-700 mb-1">Detected tokens:</p>
                            <p className="text-xs text-slate-600">USDT, USDC, DAI, FRAX, TUSD, USDD, LUSD, GUSD, PYUSD and variants.</p>
                          </div>
                          <div className="mt-3 pt-2 border-t border-slate-200">
                            <p className="text-xs font-medium text-slate-700 mb-1">Interpretation:</p>
                            <ul className="text-xs text-slate-600 space-y-0.5 list-disc list-inside">
                              <li>0-20% : Low exposure (volatile portfolio)</li>
                              <li>20-50% : Moderate exposure (risk/stable balance)</li>
                              <li>&gt; 50% : High exposure (defensive portfolio)</li>
                            </ul>
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                    ) : (
                      <p className="text-slate-600 text-sm font-medium">Stablecoin Share</p>
                    )}
                    {loadingOv ? (
                      <div className="mt-2">
                        <Skeleton className="h-8 w-24" />
                      </div>
                    ) : mounted ? (
                      <div className="mt-2">
                        <HoverCard>
                          <HoverCardTrigger asChild>
                            <p className="text-xl font-semibold text-slate-800 cursor-help">
                              {concentration.stableSharePct.toFixed(1)}%
                            </p>
                          </HoverCardTrigger>
                          <HoverCardContent className="w-72">
                            <p className="text-xs font-medium text-slate-700 mb-1">Current stablecoin exposure</p>
                            <p className="text-xs text-slate-600 mb-2">
                              {concentration.stableSharePct.toFixed(1)}% of the portfolio is held in stablecoins.
                            </p>
                            <p className="text-xs text-slate-500 italic">Hover over the title for more details on the calculation.</p>
                          </HoverCardContent>
                        </HoverCard>
                        <p className="text-xs text-slate-500">
                          Of total portfolio
                        </p>
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
                      <RechartsTooltip
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
                        .map((h, idx) => (
                          <div
                            key={h.contract || `${h.symbol || 'unknown'}-${(h as any).chain || 'unknown'}-${idx}`}
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
                        key={h.contract || `${h.symbol || 'unknown'}-${(h as any).chain || 'unknown'}-${index}`}
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
                            key={`${h.contract || 'no-contract'}-${(h as any).chain || 'unknown'}-${i}`}
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

          <TabsContent value="graphs" className="space-y-6">
            {/* 6-Month Portfolio Fluctuation Chart */}
            <Card className="p-6 bg-white shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800">
                  Portfolio Evolution (Last 6 Months)
                </h3>
                {loadingHistorical && (
                  <span className="text-xs text-slate-500">Loading...</span>
                )}
              </div>
              {loadingHistorical ? (
                <div className="space-y-4">
                  <Skeleton className="h-[400px] w-full" />
                  <p className="text-sm text-slate-500 text-center">
                    Fetching historical data, this may take a few seconds...
                  </p>
                </div>
              ) : historicalChartData.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-slate-500 mb-2">
                    No historical data available for this address.
                  </p>
                  <p className="text-xs text-slate-400 mb-4">
                    Historical data requires transactions over the last 6 months.
                  </p>
                  <details className="text-xs text-slate-400 text-left max-w-md mx-auto">
                    <summary className="cursor-pointer text-slate-500 mb-2">
                      Debug Information
                    </summary>
                    <div className="bg-slate-50 p-3 rounded mt-2 space-y-1">
                      <p>Address: {address?.substring(0, 10)}...</p>
                      <p>Networks: {networks?.split(",").length || 0} network(s)</p>
                      <p>Points received: {historicalData.length}</p>
                      <p>Check backend logs for more details.</p>
                    </div>
                  </details>
                </div>
              ) : (
                <>
                  {isHistoricalEstimated && (
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3 flex-1">
                          <h3 className="text-sm font-medium text-amber-800">
                            Estimated Data
                          </h3>
                          <div className="mt-1 text-sm text-amber-700">
                            <p>
                              Real historical data is not available via the API. This chart displays an estimation based on your current portfolio composition. Values may not accurately reflect actual history.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <ResponsiveContainer width="100%" height={400}>
                    <AreaChart data={historicalChartData}>
                      <defs>
                        <linearGradient id="colorPortfolio" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tickFormatter={(v) => fmtUSD(v)}
                        tick={{ fontSize: 11 }}
                        domain={["dataMin", "dataMax"]}
                      />
                      <RechartsTooltip
                        formatter={(value: number) => fmtUSD(value)}
                        labelFormatter={(label) => `Date: ${label}`}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorPortfolio)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                  {!loadingHistorical && historicalChartData.length > 0 && (
                    <div className="mt-4 text-xs text-slate-500">
                      <p>
                        Weekly data over {historicalChartData.length} points
                        {historicalChartData.length > 0 && (
                          <>
                            {" • "}
                            From {historicalChartData[0].date} to{" "}
                            {historicalChartData[historicalChartData.length - 1].date}
                          </>
                        )}
                      </p>
                    </div>
                  )}
                </>
              )}
            </Card>

            {/* Allocation by Chain */}
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
                    <RechartsTooltip
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

            {/* 24h P&L by Chain */}
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
                  <BarChart
                    data={pnlByChain}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis
                      tickFormatter={(v) => fmtUSD(v)}
                      domain={["auto", "auto"]}
                    />
                    <RechartsTooltip
                      formatter={(v: any, _n: any, e: any) => [
                        fmtUSD(v),
                        "24h Δ",
                      ]}
                    />
                    <Bar dataKey="pnl">
                      {pnlByChain.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.pnl >= 0 ? "#10b981" : "#ef4444"}
                        />
                      ))}
                    </Bar>
                    <ReferenceLine y={0} stroke="#666" strokeDasharray="2 2" />
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

            {/* Asset Distribution Pie Chart */}
            <Card className="p-6 bg-white shadow-sm">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">
                Asset Distribution
              </h3>
              {loadingOv ? (
                <Skeleton className="h-[300px] w-full" />
              ) : !ov ? (
                <div className="text-sm text-slate-500">
                  Load an address to see asset distribution.
                </div>
              ) : allocationData.length === 0 ? (
                <div className="text-sm text-slate-500">
                  No assets to display.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <RPieChart>
                    <Pie
                      data={allocationData}
                      dataKey="usd"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={(entry) => `${entry.name} (${fmtPct(entry.pct)})`}
                    >
                      {allocationData.map((entry, index) => {
                        const colors = [
                          "#3b82f6",
                          "#10b981",
                          "#f59e0b",
                          "#ef4444",
                          "#8b5cf6",
                          "#ec4899",
                          "#06b6d4",
                          "#84cc16",
                        ];
                        return (
                          <Cell
                            key={`cell-${index}`}
                            fill={colors[index % colors.length]}
                          />
                        );
                      })}
                    </Pie>
                    <RechartsTooltip
                      formatter={(value: number, name: string, props: any) => [
                        fmtUSD(value),
                        `${name} (${fmtPct(props.payload.pct)})`,
                      ]}
                    />
                    <Legend />
                  </RPieChart>
                </ResponsiveContainer>
              )}
            </Card>

            {/* Stablecoin vs Risk Assets */}
            <Card className="p-6 bg-white shadow-sm">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">
                Stablecoin vs Risk Assets
              </h3>
              {loadingOv || !ov ? (
                <Skeleton className="h-[300px] w-full" />
              ) : stableVsRisk.stable === 0 && stableVsRisk.nonStable === 0 ? (
                <div className="text-sm text-slate-500">No data available.</div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <RPieChart>
                    <Pie
                      data={[
                        { name: "Stablecoins", value: stableVsRisk.stable },
                        { name: "Risk Assets", value: stableVsRisk.nonStable },
                      ]}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={(entry) =>
                        `${entry.name}: ${fmtPct(
                          (entry.value / (ov?.kpis.totalValueUsd || 1)) * 100
                        )}`
                      }
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#f59e0b" />
                    </Pie>
                    <RechartsTooltip
                      formatter={(value: number) => fmtUSD(value)}
                    />
                    <Legend />
                  </RPieChart>
                </ResponsiveContainer>
              )}
            </Card>

            {/* Top Gainers vs Losers Comparison */}
            <Card className="p-6 bg-white shadow-sm">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">
                Top Gainers vs Losers (24h)
              </h3>
              {loadingOv || !ov ? (
                <Skeleton className="h-[300px] w-full" />
              ) : movers.gainers.length === 0 && movers.losers.length === 0 ? (
                <div className="text-sm text-slate-500">
                  No 24h change data available.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={[
                      ...movers.gainers.map((h, i) => ({
                        name: h.symbol || "Unknown",
                        value: h.delta24hUsd || 0,
                        pct: h.delta24hPct || 0,
                        type: "Gainer",
                      })),
                      ...movers.losers.map((h, i) => ({
                        name: h.symbol || "Unknown",
                        value: h.delta24hUsd || 0,
                        pct: h.delta24hPct || 0,
                        type: "Loser",
                      })),
                    ]}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(v) => fmtUSD(v)} />
                    <RechartsTooltip
                      formatter={(value: number, _name: string, props: any) => [
                        `${fmtUSD(value)} (${props.payload.pct >= 0 ? "+" : ""}${fmtPct(props.payload.pct)})`,
                        "24h Change",
                      ]}
                    />
                    <Bar dataKey="value">
                      {[...movers.gainers, ...movers.losers].map((h, index) => (
                        <Cell
                          key={`mover-cell-${index}`}
                          fill={(h.delta24hUsd || 0) >= 0 ? "#10b981" : "#ef4444"}
                        />
                      ))}
                    </Bar>
                    <ReferenceLine y={0} stroke="#666" strokeDasharray="2 2" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
            {/* Asset Performance by 24h Change */}
            <Card className="p-6 bg-white shadow-sm">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">
                Asset Performance (24h % Change)
              </h3>
              {loadingOv || !ov ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                (() => {
                  const performanceData = (ov.holdings ?? [])
                    .filter((h) => typeof h.delta24hPct === "number")
                    .sort((a, b) => (b.delta24hPct || 0) - (a.delta24hPct || 0))
                    .slice(0, 15)
                    .map((h) => ({
                      name: h.symbol || "Unknown",
                      change: h.delta24hPct || 0,
                      value: h.valueUsd || 0,
                    }));
                  return performanceData.length === 0 ? (
                    <div className="text-sm text-slate-500">
                      No 24h performance data available.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={performanceData}
                        margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="name"
                          angle={-45}
                          textAnchor="end"
                          height={80}
                          tick={{ fontSize: 10 }}
                        />
                        <YAxis tickFormatter={(v) => `${v}%`} />
                        <RechartsTooltip
                          formatter={(value: number, _name: string, props: any) => [
                            `${value >= 0 ? "+" : ""}${value.toFixed(2)}% (${fmtUSD(props.payload.value)})`,
                            "24h Change",
                          ]}
                        />
                        <Bar dataKey="change">
                          {performanceData.map((entry, index) => (
                            <Cell
                              key={`perf-cell-${index}`}
                              fill={entry.change >= 0 ? "#10b981" : "#ef4444"}
                            />
                          ))}
                        </Bar>
                        <ReferenceLine y={0} stroke="#666" strokeDasharray="2 2" />
                      </BarChart>
                    </ResponsiveContainer>
                  );
                })()
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
