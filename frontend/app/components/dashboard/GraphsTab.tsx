"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { OverviewResponse, PricedHolding } from "@/lib/types/portfolio";
import type { HistoricalPoint } from "@/lib/api/analytics";
import { fmtUSD, fmtUSDCompact, fmtPct, CHAIN_LABEL, CHAIN_STACK_COLORS } from "@/lib/portfolioUtils";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  ReferenceLine,
  PieChart as RPieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useEffect, useState, type ReactElement } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { TrendingUp, BarChart3, PieChart, DollarSign, Activity, Briefcase, Calendar, Link2, AlertTriangle, HelpCircle } from "lucide-react";

interface AllocationRow {
  name: string;
  pct: number;
  usd: number;
}
interface ChainBreakdownRow {
  chain: string;
  label: string;
  usd: number;
  pct: number;
}
interface PnlRow {
  label: string;
  pnl: number;
  value: number;
}
interface StableVsRisk {
  stable: number;
  nonStable: number;
}
interface Movers {
  gainers: PricedHolding[];
  losers: PricedHolding[];
}
interface HistoricalChartPoint {
  date: string;
  value: number;
  timestamp: number;
}
interface NetFlowPoint {
  date: string;
  delta: number;
}
interface ChainHistorySeries {
  data: Record<string, number | string>[];
  series: Array<{ key: string; label: string; color: string }>;
}

const STABLE_SYMBOLS = new Set([
  "USDT",
  "USDC",
  "DAI",
  "FRAX",
  "LUSD",
  "PYUSD",
  "BUSD",
]);
const shortAddr = (value?: string) =>
  value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "—";

const InfoHover = ({ description }: { description: string }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        type="button"
        className="p-1 rounded-full text-slate-400 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-200 transition-colors"
        aria-label="More info"
      >
        <HelpCircle className="h-4 w-4" />
      </button>
    </TooltipTrigger>
    <TooltipContent className="max-w-xs text-xs leading-5">
      {description}
    </TooltipContent>
  </Tooltip>
);

const chartVisibilityDefaults = {
  portfolioEvolution: true,
  netPortfolioChange: true,
  chainAllocationTime: true,
  allocationByChain: true,
  pnlByChain: true,
  assetDistribution: true,
  stableVsRisk: true,
  gainersLosers: true,
  assetPerformance: true,
  liquidityManagement: true,
  accountingClassification: true,
  pricingSourceQuality: true,
  taxReserveCoverage: true,
  taxPlanning: true,
  crossChainReconciliation: true,
  portfolioRiskEvaluation: true,
} as const;

type ChartVisibilityKey = keyof typeof chartVisibilityDefaults;
type ChartVisibilityState = Record<ChartVisibilityKey, boolean>;

interface GraphsTabProps {
  address?: string;
  networks: string;
  loadingHistorical: boolean;
  historicalChartData: HistoricalChartPoint[];
  historicalData: HistoricalPoint[];
  isHistoricalEstimated: boolean;
  useFallbackEstimation: boolean;
  onFallbackPreferenceChange: (useFallback: boolean) => void;
  loadingOv: boolean;
  ov: OverviewResponse | null;
  chainBreakdown: ChainBreakdownRow[];
  pnlByChain: PnlRow[];
  allocationData: AllocationRow[];
  stableVsRisk: StableVsRisk;
  movers: Movers;
  netFlowData: NetFlowPoint[];
  chainHistory: ChainHistorySeries;
  walletBreakdown: Array<{
    address: string;
    label: string;
    color: string;
    totalValueUsd: number;
    delta24hUsd: number;
  }>;
  walletSummary: string;
}

// Helper function to group small holdings into "Others"
// Following data visualization best practices: keep only items >= 5% or top 5-7 items
const groupSmallHoldings = <T extends { pct: number }>(
  data: T[],
  threshold: number = 5,
  maxItems: number = 6
): { mainData: T[]; othersData: T[] } => {
  // Sort from largest to smallest (best practice)
  const sorted = [...data].sort((a, b) => b.pct - a.pct);
  const mainData: T[] = [];
  const othersData: T[] = [];

  sorted.forEach((item) => {
    // Keep items if they're >= threshold OR we haven't reached maxItems yet
    if (item.pct >= threshold || mainData.length < maxItems) {
      mainData.push(item);
    } else {
      othersData.push(item);
    }
  });

  return { mainData, othersData };
};

const GraphsTab = ({
  address,
  networks,
  loadingHistorical,
  historicalChartData,
  historicalData,
  isHistoricalEstimated,
  useFallbackEstimation,
  onFallbackPreferenceChange,
  loadingOv,
  ov,
  chainBreakdown,
  pnlByChain,
  allocationData,
  stableVsRisk,
  movers,
  netFlowData,
  chainHistory,
  walletBreakdown,
  walletSummary,
}: GraphsTabProps) => {
  const [visibleCharts, setVisibleCharts] = useState<ChartVisibilityState>({
    ...chartVisibilityDefaults,
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const stored = window.localStorage.getItem("chartVisibilityPreferences");
    if (!stored) {
      return;
    }
    try {
      const parsed = JSON.parse(stored) as Partial<ChartVisibilityState>;
      setVisibleCharts((prev) => ({
        ...prev,
        ...parsed,
      }));
    } catch {
      setVisibleCharts({ ...chartVisibilityDefaults });
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      "chartVisibilityPreferences",
      JSON.stringify(visibleCharts)
    );
  }, [visibleCharts]);

  const toggleChart = (chartKey: ChartVisibilityKey) => {
    setVisibleCharts((prev) => ({
      ...prev,
      [chartKey]: !prev[chartKey],
    }));
  };

  const toggleAllCharts = (visible: boolean) => {
    setVisibleCharts(
      Object.keys(chartVisibilityDefaults).reduce((acc, key) => {
        acc[key as ChartVisibilityKey] = visible;
        return acc;
      }, {} as ChartVisibilityState)
    );
  };

  const pieCards: ReactElement[] = [];

  if (visibleCharts.assetDistribution) {
    pieCards.push(
      <Card
        key="assetDistribution"
        className="p-6 bg-white shadow-sm h-full"
      >
        <h3 className="text-lg font-semibold text-slate-800 mb-4">
          Asset Distribution
        </h3>
        {loadingOv ? (
          <Skeleton className="h-[320px] w-full" />
        ) : !ov ? (
          <div className="text-sm text-slate-500">
          Select at least one wallet to see asset distribution.
          </div>
        ) : allocationData.length === 0 ? (
          <div className="text-sm text-slate-500">No assets to display.</div>
        ) : (
          (() => {
            const { mainData, othersData } = groupSmallHoldings(allocationData, 5, 6);
            const hasOthers = othersData.length > 0;
            const othersTotal = othersData.reduce((sum, item) => sum + item.usd, 0);
            const othersPct = othersData.reduce((sum, item) => sum + item.pct, 0);
            
            const chartData = hasOthers
              ? [...mainData, { name: "Others", usd: othersTotal, pct: othersPct }]
              : mainData;

            return (
              <ResponsiveContainer width="100%" height={280}>
                <RPieChart>
                  <Pie
                    data={chartData}
                    dataKey="usd"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                    label={(entry) => {
                      if (entry.pct < 5) return null;
                      return `${entry.name.slice(0, 8)}${entry.name.length > 8 ? '...' : ''}`;
                    }}
                    labelLine={{ strokeWidth: 1 }}
                    stroke="#fff"
                    strokeWidth={2}
                  >
                    {chartData.map((entry, index) => {
                      const colors = [
                        "#3b82f6",
                        "#10b981",
                        "#f59e0b",
                        "#ef4444",
                        "#8b5cf6",
                        "#ec4899",
                        "#06b6d4",
                        "#84cc16",
                        "#94a3b8",
                      ];
                      return (
                        <Cell
                          key={`asset-dist-${index}`}
                          fill={entry.name === "Others" ? "#94a3b8" : colors[index % colors.length]}
                          style={{ cursor: 'pointer' }}
                        />
                      );
                    })}
                  </Pie>
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const data = payload[0].payload;
                      
                      if (data.name === "Others" && hasOthers) {
                        return (
                          <div className="bg-white p-4 rounded-xl shadow-2xl border-2 border-slate-300 max-w-sm animate-in fade-in duration-200">
                            {/* Header */}
                            <div className="border-b-2 border-slate-200 pb-3 mb-3">
                              <div className="flex items-center justify-between">
                                <p className="font-bold text-base text-slate-800">Others</p>
                                <span className="px-2 py-1 bg-slate-100 rounded-md text-xs font-semibold text-slate-700">
                                  {fmtPct(othersPct)}
                                </span>
                              </div>
                              <p className="text-sm font-semibold text-slate-600 mt-1">{fmtUSD(othersTotal)}</p>
                              <p className="text-xs text-slate-500 mt-1">{othersData.length} assets grouped</p>
                            </div>
                            
                            {/* Details list with scroll */}
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                              {othersData.map((item, idx) => (
                                <div 
                                  key={idx} 
                                  className="flex justify-between items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors"
                                >
                                  <span className="text-sm font-medium text-slate-700 truncate flex-1">
                                    {item.name}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                      {fmtPct(item.pct)}
                                    </span>
                                    <span className="text-xs text-slate-500 min-w-[70px] text-right">
                                      {fmtUSD(item.usd)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      
                      return (
                        <div className="bg-white p-3 rounded-lg shadow-xl border-2 border-slate-300">
                          <p className="font-bold text-sm text-slate-800">{data.name}</p>
                          <p className="text-sm font-semibold text-slate-600 mt-1">{fmtUSD(data.usd)}</p>
                          <p className="text-xs text-slate-500 mt-1">{fmtPct(data.pct)}</p>
                        </div>
                      );
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: '12px' }}
                    formatter={(value) => {
                      if (value.length > 15) return value.slice(0, 15) + '...';
                      return value;
                    }}
                  />
                </RPieChart>
              </ResponsiveContainer>
            );
          })()
        )}
      </Card>
    );
  }

  if (visibleCharts.stableVsRisk) {
    pieCards.push(
      <Card key="stableVsRisk" className="p-6 bg-white shadow-sm h-full">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">
          Stablecoin vs Risk Assets
        </h3>
        {loadingOv || !ov ? (
          <Skeleton className="h-[320px] w-full" />
        ) : stableVsRisk.stable === 0 && stableVsRisk.nonStable === 0 ? (
          <div className="text-sm text-slate-500">No data available.</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
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
                outerRadius={75}
                label={(entry) => {
                  const pct = (entry.value / (ov?.kpis.totalValueUsd || 1)) * 100;
                  return `${fmtPct(pct)}`;
                }}
                labelLine={{ strokeWidth: 1 }}
              >
                <Cell fill="#10b981" />
                <Cell fill="#f59e0b" />
              </Pie>
              <RechartsTooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const data = payload[0].payload;
                  const pct = (data.value / (ov?.kpis.totalValueUsd || 1)) * 100;
                  
                  return (
                    <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
                      <p className="font-semibold text-sm">{data.name}</p>
                      <p className="text-xs text-slate-600">{fmtUSD(data.value)}</p>
                      <p className="text-xs text-slate-500">{fmtPct(pct)}</p>
                    </div>
                  );
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
            </RPieChart>
          </ResponsiveContainer>
        )}
      </Card>
    );
  }

  if (visibleCharts.accountingClassification) {
    pieCards.push(
      <Card
        key="accountingClassification"
        className="p-6 bg-white shadow-sm h-full"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-800">
              Accounting Classification
            </h3>
            <InfoHover description="Breaks down holdings into accounting buckets so auditors can reconcile stablecoins, majors, and staking receipts quickly." />
          </div>
          <span className="text-xs text-slate-500">
            Distribution by asset type
          </span>
        </div>
        {loadingOv || !ov ? (
          <Skeleton className="h-[300px] w-full" />
        ) : (
          (() => {
            const classify = (symbol: string) => {
              const s = (symbol || "").toUpperCase();
              if (STABLE_SYMBOLS.has(s)) return "Stablecoins";
              if (["ETH", "WETH"].includes(s)) return "Ethereum";
              if (["BTC", "WBTC"].includes(s)) return "Bitcoin";
              if (["STETH", "RETH", "CBETH", "WSTETH"].includes(s))
                return "Liquid Staking";
              return "Other Tokens";
            };

            const categoryMap = new Map<string, number>();
            for (const h of ov.holdings ?? []) {
              const cat = classify(h.symbol);
              categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + (h.valueUsd || 0));
            }

            const accountingDataRaw = Array.from(categoryMap.entries()).map(
              ([name, value]) => ({
                name,
                value,
                pct: ((value / (ov.kpis.totalValueUsd || 1)) * 100),
                percentage:
                  ((value / (ov.kpis.totalValueUsd || 1)) * 100).toFixed(1) +
                  "%",
              })
            );

            // Group small categories into "Others" (best practice: threshold 5%)
            const { mainData: mainCategories, othersData: othersCategories } = groupSmallHoldings(
              accountingDataRaw,
              5,
              6
            );

            const hasOthers = othersCategories.length > 0;
            const othersTotal = othersCategories.reduce((sum, item) => sum + item.value, 0);
            const othersPct = othersCategories.reduce((sum, item) => sum + item.pct, 0);

            const accountingData = hasOthers
              ? [...mainCategories, { 
                  name: "Others", 
                  value: othersTotal, 
                  pct: othersPct,
                  percentage: othersPct.toFixed(1) + "%" 
                }]
              : mainCategories;

            return accountingData.length === 0 ? (
              <div className="text-sm text-slate-500">
                No classification data available.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <RPieChart>
                  <Pie
                    data={accountingData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                    label={(entry) => {
                      if (entry.pct < 5) return null;
                      return `${entry.name.slice(0, 10)}${entry.name.length > 10 ? '...' : ''}`;
                    }}
                    labelLine={{ strokeWidth: 1 }}
                    stroke="#fff"
                    strokeWidth={2}
                  >
                    {accountingData.map((entry, index) => {
                      const colors = [
                        "#10b981",
                        "#3b82f6",
                        "#f59e0b",
                        "#8b5cf6",
                        "#ec4899",
                        "#06b6d4",
                        "#94a3b8",
                      ];
                      return (
                        <Cell
                          key={`acc-cell-${index}`}
                          fill={entry.name === "Others" ? "#94a3b8" : colors[index % colors.length]}
                          style={{ cursor: 'pointer' }}
                        />
                      );
                    })}
                  </Pie>
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const data = payload[0].payload;
                      
                      if (data.name === "Others" && hasOthers) {
                        return (
                          <div className="bg-white p-4 rounded-xl shadow-2xl border-2 border-slate-300 max-w-sm animate-in fade-in duration-200">
                            {/* Header */}
                            <div className="border-b-2 border-slate-200 pb-3 mb-3">
                              <div className="flex items-center justify-between">
                                <p className="font-bold text-base text-slate-800">Others</p>
                                <span className="px-2 py-1 bg-slate-100 rounded-md text-xs font-semibold text-slate-700">
                                  {data.percentage}
                                </span>
                              </div>
                              <p className="text-sm font-semibold text-slate-600 mt-1">{fmtUSD(othersTotal)}</p>
                              <p className="text-xs text-slate-500 mt-1">{othersCategories.length} categories grouped</p>
                            </div>
                            
                            {/* Details list with scroll */}
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                              {othersCategories.map((item, idx) => (
                                <div 
                                  key={idx} 
                                  className="flex justify-between items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors"
                                >
                                  <span className="text-sm font-medium text-slate-700 truncate flex-1">
                                    {item.name}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                      {item.percentage}
                                    </span>
                                    <span className="text-xs text-slate-500 min-w-[70px] text-right">
                                      {fmtUSD(item.value)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      
                      return (
                        <div className="bg-white p-3 rounded-lg shadow-xl border-2 border-slate-300">
                          <p className="font-bold text-sm text-slate-800">{data.name}</p>
                          <p className="text-sm font-semibold text-slate-600 mt-1">{fmtUSD(data.value)}</p>
                          <p className="text-xs text-slate-500 mt-1">{data.percentage}</p>
                        </div>
                      );
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                </RPieChart>
              </ResponsiveContainer>
            );
          })()
        )}
      </Card>
    );
  }
  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
      {/* Chart Selection Panel */}
      <Card className="p-6 bg-white shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800">
            Select Charts to Display
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => toggleAllCharts(true)}
              className="text-sm px-3 py-1 rounded-md border border-slate-200 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
            >
              Select All
            </button>
            <button
              onClick={() => toggleAllCharts(false)}
              className="text-sm px-3 py-1 rounded-md border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Deselect All
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[
            {
              key: "portfolioEvolution",
              label: "Portfolio Evolution",
              icon: TrendingUp,
            },
            {
              key: "netPortfolioChange",
              label: "Net Portfolio Change",
              icon: Activity,
            },
            {
              key: "chainAllocationTime",
              label: "Chain Allocation Over Time",
              icon: Link2,
            },
            {
              key: "allocationByChain",
              label: "Allocation by Chain",
              icon: BarChart3,
            },
            { key: "pnlByChain", label: "24h P&L by Chain", icon: BarChart3 },
            {
              key: "assetDistribution",
              label: "Asset Distribution",
              icon: PieChart,
            },
            {
              key: "stableVsRisk",
              label: "Stablecoin vs Risk",
              icon: DollarSign,
            },
            {
              key: "gainersLosers",
              label: "Top Gainers vs Losers",
              icon: TrendingUp,
            },
            {
              key: "assetPerformance",
              label: "Asset Performance",
              icon: BarChart3,
            },
            {
              key: "liquidityManagement",
              label: "Liquidity Management",
              icon: DollarSign,
            },
            {
              key: "accountingClassification",
              label: "Accounting Classification",
              icon: Briefcase,
            },
            {
              key: "pricingSourceQuality",
              label: "Pricing Source Quality",
              icon: PieChart,
            },
            {
              key: "taxReserveCoverage",
              label: "Tax Reserve Coverage",
              icon: DollarSign,
            },
            {
              key: "taxPlanning",
              label: "Tax Planning",
              icon: Calendar,
            },
            {
              key: "crossChainReconciliation",
              label: "Cross-Chain Reconciliation",
              icon: Link2,
            },
            {
              key: "portfolioRiskEvaluation",
              label: "Portfolio Risk Evaluation",
              icon: AlertTriangle,
            },
          ].map(({ key, label, icon: Icon }) => (
            <div
              key={key}
              className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                visibleCharts[key as keyof typeof visibleCharts]
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
              onClick={() => toggleChart(key as keyof typeof visibleCharts)}
            >
              <Checkbox
                checked={visibleCharts[key as keyof typeof visibleCharts]}
                onCheckedChange={() =>
                  toggleChart(key as keyof typeof visibleCharts)
                }
                className="pointer-events-none"
              />
              <Icon
                className={`w-5 h-5 ${
                  visibleCharts[key as keyof typeof visibleCharts]
                    ? "text-blue-600"
                    : "text-slate-400"
                }`}
              />
              <span
                className={`text-sm font-medium ${
                  visibleCharts[key as keyof typeof visibleCharts]
                    ? "text-blue-900"
                    : "text-slate-600"
                }`}
              >
                {label}
              </span>
            </div>
          ))}
      </div>
    </Card>
    {walletBreakdown.length > 1 && (
      <Card className="p-4 bg-white shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-slate-800">
            Aggregated wallets
          </p>
          <span className="text-xs text-slate-500">{walletSummary}</span>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-slate-600">
          {walletBreakdown.map((wallet) => (
            <span
              key={wallet.address}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 bg-slate-50"
            >
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: wallet.color }}
              />
              {wallet.label} · {fmtUSD(wallet.totalValueUsd)}
            </span>
          ))}
        </div>
      </Card>
    )}

      {/* 6-Month Portfolio Fluctuation Chart */}
      {visibleCharts.portfolioEvolution && (
        <Card className="p-6 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-slate-800">
            Portfolio Evolution (Last 6 Months)
          </h3>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={useFallbackEstimation}
              onCheckedChange={onFallbackPreferenceChange}
              id="fallback-estimation"
            />
            <label htmlFor="fallback-estimation" className="text-sm text-slate-600 cursor-pointer">
              Use fallback estimation
            </label>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-200 transition-colors"
                  aria-label="More info about fallback estimation"
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs leading-5">
                Enable this to use estimated historical data based on your current holdings instead of Ankr API data. Useful when Ankr data is inaccurate or unavailable.
              </TooltipContent>
            </Tooltip>
          </div>
          {loadingHistorical && (
            <span className="text-xs text-slate-500">Loading...</span>
          )}
        </div>
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
            No historical data available for the selected wallets.
          </p>
          <p className="text-xs text-slate-400 mb-4">
            Historical data requires transactions over the last 6
            months.
          </p>
          <details className="text-xs text-slate-400 text-left max-w-md mx-auto">
            <summary className="cursor-pointer text-slate-500 mb-2">
              Debug Information
            </summary>
            <div className="bg-slate-50 p-3 rounded mt-2 space-y-1">
              <p>
                Wallets:{" "}
                {walletSummary || shortAddr(address)}
              </p>
              <p>
                Networks: {networks?.split(",").length || 0} network(s)
              </p>
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
                  <svg
                    className="h-5 w-5 text-amber-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-medium text-amber-800">
                    Estimated Data
                  </h3>
                  <div className="mt-1 text-sm text-amber-700">
                    <p>
                      Real historical data is not available via the API.
                      This chart displays an estimation based on your
                      current portfolio composition. Values may not
                      accurately reflect actual history.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={historicalChartData}>
              <defs>
                <linearGradient
                  id="colorPortfolio"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor="#3b82f6"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="#3b82f6"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={(v) => fmtUSDCompact(v)}
                tick={{ fontSize: 12 }}
                width={80}
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
                    {
                      historicalChartData[
                        historicalChartData.length - 1
                      ].date
                    }
                  </>
                )}
              </p>
            </div>
          )}
        </>
      )}
        </Card>
      )}

    {/* Net Portfolio Flow */}
    {visibleCharts.netPortfolioChange && (
      <Card className="p-6 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-800">
          Net Portfolio Change (Period over Period)
        </h3>
      </div>
      {netFlowData.length === 0 ? (
        <div className="text-sm text-slate-500">
          Not enough historical points to compute flows.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={netFlowData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(v) => fmtUSDCompact(v)} tick={{ fontSize: 12 }} width={80} />
            <RechartsTooltip
              formatter={(value: number) => fmtUSD(value)}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Bar dataKey="delta">
              {netFlowData.map((entry, index) => (
                <Cell
                  key={`flow-${index}`}
                  fill={entry.delta >= 0 ? "#10b981" : "#ef4444"}
                />
              ))}
            </Bar>
            <ReferenceLine y={0} stroke="#666" strokeDasharray="2 2" />
          </BarChart>
        </ResponsiveContainer>
      )}
      </Card>
    )}

    {/* Chain Allocation over Time */}
    {visibleCharts.chainAllocationTime && (
      <Card className="p-6 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-slate-800">
          Chain Allocation Over Time
        </h3>
        <span className="text-xs text-slate-500">
          Percentage of portfolio by chain (stacked).
        </span>
      </div>
      {chainHistory.data.length === 0 ? (
        <div className="text-sm text-slate-500">
          Not enough historical data to visualize chain rotation.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={chainHistory.data} stackOffset="expand">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fontSize: 12 }} width={50} domain={[0, 1]} />
            <RechartsTooltip
              formatter={(value: number, name: string) => [
                `${value.toFixed(1)}%`,
                chainHistory.series.find((s) => s.key === name)?.label || name,
              ]}
            />
            {chainHistory.series.map((series) => (
              <Area
                key={series.key}
                type="monotone"
                dataKey={series.key}
                stackId="1"
                stroke={series.color}
                fill={series.color}
                strokeWidth={1.5}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      )}
      </Card>
    )}

    {/* Allocation by Chain */}
    {visibleCharts.allocationByChain && (
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
          Select at least one wallet to see allocation by chain.
        </div>
      ) : chainBreakdown.length === 0 ? (
        <div className="text-sm text-slate-500">
          No priced tokens to display.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chainBreakdown}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(v) => `${v}%`} domain={[0, 100]} tick={{ fontSize: 12 }} width={50} />
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
                return [String(value), "Allocation"];
              }}
              labelFormatter={(label) => String(label)}
            />
            <Bar dataKey="pct" />
          </BarChart>
        </ResponsiveContainer>
      )}
      </Card>
    )}

    {/* 24h P&L by Chain */}
    {visibleCharts.pnlByChain && (
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
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis
              tickFormatter={(v) => fmtUSDCompact(v)}
              domain={["auto", "auto"]}
              tick={{ fontSize: 12 }}
              width={80}
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
          {fmtUSD(pnlByChain.reduce((s, r) => s + r.pnl, 0))} over 24h.
        </p>
    )}
      </Card>
    )}

    {pieCards.length === 0 ? null : pieCards.length === 1 ? (
      pieCards[0]
    ) : (
      <div
        className={`grid gap-6 lg:grid-cols-2 ${
          pieCards.length > 2 ? "xl:grid-cols-3" : ""
        }`}
      >
        {pieCards}
      </div>
    )}

    {/* Top Gainers vs Losers Comparison */}
    {visibleCharts.gainersLosers && (
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
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => fmtUSDCompact(v)} tick={{ fontSize: 12 }} width={80} />
                <RechartsTooltip
                  formatter={(value: number, _name: string, props: any) => [
                    `${fmtUSD(value)} (${
                      props.payload.pct >= 0 ? "+" : ""
                    }${fmtPct(props.payload.pct)})`,
                    "24h Change",
                  ]}
                />
            <Bar dataKey="value">
              {[...movers.gainers, ...movers.losers].map((h, index) => (
                <Cell
                  key={`mover-cell-${index}`}
                  fill={
                    (h.delta24hUsd || 0) >= 0 ? "#10b981" : "#ef4444"
                  }
                />
              ))}
            </Bar>
            <ReferenceLine y={0} stroke="#666" strokeDasharray="2 2" />
          </BarChart>
        </ResponsiveContainer>
      )}
      </Card>
    )}
    
    {/* Asset Performance by 24h Change */}
    {visibleCharts.assetPerformance && (
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
                  tick={{ fontSize: 11 }}
                />
                <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} width={50} />
                <RechartsTooltip
                  formatter={(
                    value: number,
                    _name: string,
                    props: any
                  ) => [
                    `${value >= 0 ? "+" : ""}${value.toFixed(
                      2
                    )}% (${fmtUSD(props.payload.value)})`,
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
                <ReferenceLine
                  y={0}
                  stroke="#666"
                  strokeDasharray="2 2"
                />
              </BarChart>
            </ResponsiveContainer>
          );
        })()
      )}
      </Card>
    )}

    {/* Liquidity Management */}
    {visibleCharts.liquidityManagement && (
      <Card className="p-6 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-slate-800">
            Liquidity Management
          </h3>
          <InfoHover description="Tracks how much of the portfolio is sitting in stablecoins versus harder-to-unwind assets so you can meet fiat settlement needs." />
        </div>
        <span className="text-xs text-slate-500">Cash Flow Analysis</span>
      </div>
      {loadingOv || !ov ? (
        <Skeleton className="h-[300px] w-full" />
      ) : (
        (() => {
          const stablecoins = (ov.holdings ?? []).filter((h) =>
            STABLE_SYMBOLS.has((h.symbol || "").toUpperCase())
          );
          const totalStable = stablecoins.reduce(
            (s, h) => s + (h.valueUsd || 0),
            0
          );
          const totalPortfolio = ov.kpis.totalValueUsd || 1;
          const liquidityRatio = (totalStable / totalPortfolio) * 100;

          const liquidityData = stablecoins.map((h) => ({
            name: h.symbol || "Unknown",
            value: h.valueUsd || 0,
            percentage:
              totalStable === 0 ? 0 : ((h.valueUsd || 0) / totalStable) * 100,
          }));

          return (
            <>
              <div className="mb-4 grid grid-cols-3 gap-4">
                <div className="bg-emerald-50 p-4 rounded-lg">
                  <p className="text-xs text-slate-600 mb-1">
                    Total liquid assets
                  </p>
                  <p className="text-2xl font-bold text-emerald-700">
                    {fmtUSD(totalStable)}
                  </p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-xs text-slate-600 mb-1">
                    Liquidity ratio
                  </p>
                  <p className="text-2xl font-bold text-blue-700">
                    {liquidityRatio.toFixed(1)}%
                  </p>
                </div>
                <div className="bg-amber-50 p-4 rounded-lg">
                  <p className="text-xs text-slate-600 mb-1">
                    Illiquid assets
                  </p>
                  <p className="text-2xl font-bold text-amber-700">
                    {fmtUSD(totalPortfolio - totalStable)}
                  </p>
                </div>
              </div>
              {liquidityData.length === 0 ? (
                <div className="text-sm text-slate-500">
                  No stablecoins detected in your portfolio.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={liquidityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={(v) => fmtUSDCompact(v)} tick={{ fontSize: 12 }} width={80} />
                    <RechartsTooltip
                      formatter={(value: number, _name: string, props: any) => [
                        `${fmtUSD(value)} (${props.payload.percentage.toFixed(
                          1
                        )}%)`,
                        "Liquidity",
                      ]}
                    />
                    <Bar dataKey="value" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </>
          );
        })()
      )}
      </Card>
    )}

    {/* Pricing Source Quality */}
    {visibleCharts.pricingSourceQuality && (
      <Card className="p-6 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-slate-800">
            Pricing Source Quality
          </h3>
          <InfoHover description="Highlights how much of the portfolio relies on on-chain DEX quotes vs. internal mappings or external APIs so you know which values are safest for reporting." />
        </div>
        <span className="text-xs text-slate-500">Valuation coverage</span>
      </div>
      {loadingOv || !ov ? (
        <Skeleton className="h-[300px] w-full" />
      ) : (
        (() => {
          const priceSourceMeta: Record<
            NonNullable<PricedHolding["priceSource"]>,
            { label: string; color: string }
          > = {
            native: { label: "On-chain DEX", color: "#10b981" },
            map: { label: "Internal Map", color: "#6366f1" },
            tokenapi: { label: "Token API", color: "#06b6d4" },
            unknown: { label: "Unknown", color: "#94a3b8" },
          };

          const totals = new Map<string, number>();
          for (const holding of ov.holdings ?? []) {
            const key = holding.priceSource ?? "unknown";
            totals.set(key, (totals.get(key) ?? 0) + (holding.valueUsd || 0));
          }

          const priceSourceData = Object.entries(priceSourceMeta)
            .map(([key, meta]) => ({
              key,
              label: meta.label,
              value: totals.get(key) ?? 0,
              color: meta.color,
            }))
            .filter((entry) => entry.value > 0)
            .sort((a, b) => b.value - a.value);

          const totalPortfolio = ov.kpis.totalValueUsd || 0;
          const unknownShare =
            totalPortfolio === 0
              ? 0
              : ((totals.get("unknown") ?? 0) / totalPortfolio) * 100;

          return priceSourceData.length === 0 ? (
            <div className="text-sm text-slate-500">
              Unable to compute valuation quality without holdings.
            </div>
          ) : (
            <>
                <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={priceSourceData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => fmtUSDCompact(v)} tick={{ fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={140}
                    tick={{ fontSize: 12 }}
                  />
                  <RechartsTooltip
                    formatter={(value: number) => fmtUSD(value)}
                    labelFormatter={(label) => `Source: ${label}`}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {priceSourceData.map((entry) => (
                      <Cell key={`pricing-${entry.key}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-4 mt-4">
                {priceSourceData.map((entry) => (
                  <div
                    key={`pricing-stat-${entry.key}`}
                    className="bg-slate-50 rounded-lg p-3"
                  >
                    <p className="text-xs text-slate-500">{entry.label}</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {fmtUSD(entry.value)}
                    </p>
                    <p className="text-xs text-slate-500">
                      Share:{" "}
                      {fmtPct(
                        totalPortfolio === 0
                          ? 0
                          : ((entry.value / totalPortfolio) || 0) * 100
                      )}
                    </p>
                  </div>
                ))}
              </div>
              {unknownShare > 0 && (
                <p className="text-xs text-amber-600 mt-3">
                  {fmtPct(unknownShare)} of the portfolio uses fallback prices.
                  Consider refreshing those quotes before filing.
                </p>
              )}
            </>
          );
        })()
      )}
      </Card>
    )}

    {/* Tax Reserve Coverage */}
    {visibleCharts.taxReserveCoverage && (
      <Card className="p-6 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-slate-800">
            Tax Reserve Coverage
          </h3>
          <InfoHover description="Stress-tests whether your stablecoin buffer can cover an estimated short-term tax bill (30% of current gains) plus 1.5% wealth tax above $1.3M." />
        </div>
        <span className="text-xs text-slate-500">Readiness check</span>
      </div>
      {loadingOv || !ov ? (
        <Skeleton className="h-[340px] w-full" />
      ) : (
        (() => {
          const holdings = ov.holdings ?? [];
          const stableBuffer = holdings.reduce((sum, holding) => {
            const symbol = (holding.symbol || "").toUpperCase();
            return STABLE_SYMBOLS.has(symbol)
              ? sum + (holding.valueUsd || 0)
              : sum;
          }, 0);

          const totalValue = ov.kpis.totalValueUsd || 0;
          const deltaGain = Math.max(ov.kpis.delta24hUsd || 0, 0);
          const assumedShortTermRate = 0.3;
          const shortTermTax = deltaGain * assumedShortTermRate;

          const wealthTaxThreshold = 1_300_000;
          const wealthTaxRate = 0.015;
          const wealthTaxBase = Math.max(totalValue - wealthTaxThreshold, 0);
          const wealthTax = wealthTaxBase * wealthTaxRate;

          const estimatedTax = shortTermTax + wealthTax;
          const coveragePct =
            estimatedTax === 0 ? 0 : (stableBuffer / estimatedTax) * 100;
          const fundingGap = Math.max(estimatedTax - stableBuffer, 0);

          const reserveData = [
            { name: "Stable Buffer", value: stableBuffer, color: "#0ea5e9" },
            { name: "Estimated Tax", value: estimatedTax, color: "#f97316" },
          ];

          return (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={reserveData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => fmtUSDCompact(v)} tick={{ fontSize: 12 }} width={80} />
                  <RechartsTooltip formatter={(value: number) => fmtUSD(value)} />
                  <Bar dataKey="value">
                    {reserveData.map((entry) => (
                      <Cell key={`reserve-${entry.name}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-xs text-slate-600 mb-1">
                    Stable liquidity
                  </p>
                  <p className="text-2xl font-semibold text-blue-700">
                    {fmtUSD(stableBuffer)}
                  </p>
                  <p className="text-xs text-slate-500">
                    Covers {fmtPct(Math.min(coveragePct, 100))}
                  </p>
                </div>
                <div className="bg-amber-50 rounded-lg p-4">
                  <p className="text-xs text-slate-600 mb-1">
                    Estimated liability
                  </p>
                  <p className="text-2xl font-semibold text-amber-700">
                    {fmtUSD(estimatedTax)}
                  </p>
                  <div className="text-xs text-slate-500 space-y-1 mt-1">
                    <p>Short-term: {fmtUSD(shortTermTax)}</p>
                    <p>Wealth tax: {fmtUSD(wealthTax)}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>Coverage</span>
                  <span>
                    {fmtPct(Math.min(coveragePct, 100))}{" "}
                    {coveragePct >= 100 ? "(fully covered)" : ""}
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-2 rounded-full ${coveragePct >= 100 ? "bg-emerald-500" : "bg-amber-500"}`}
                    style={{ width: `${Math.min(coveragePct, 120)}%` }}
                  />
                </div>
                {coveragePct < 100 && (
                  <p className="text-xs text-rose-600 mt-2">
                    You are {fmtUSD(fundingGap)} short of the estimated
                    liability. Consider topping up stablecoins.
                  </p>
                )}
                {coveragePct >= 100 && (
                  <p className="text-xs text-emerald-600 mt-2">
                    Stable reserves cover the modeled liability. You can lock a
                    portion for tax escrow with confidence.
                  </p>
                )}
              </div>
            </>
          );
        })()
      )}
      </Card>
    )}

    {/* Tax Planning */}
    {visibleCharts.taxPlanning && (
      <Card className="p-6 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-slate-800">
            Tax Planning
          </h3>
          <InfoHover description="Surface taxable base, unrealized P&L, and upcoming filing reminders for wallets that need extra compliance." />
        </div>
        <span className="text-xs text-slate-500">Tax Calendar</span>
      </div>
      {loadingOv || !ov ? (
        <Skeleton className="h-[300px] w-full" />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-xs text-slate-600 mb-1">
                Total taxable value
              </p>
              <p className="text-2xl font-bold text-blue-700">
                {fmtUSD(ov.kpis.totalValueUsd || 0)}
              </p>
              <p className="text-xs text-slate-500 mt-2">
                Basis for wealth tax calculation
              </p>
            </div>
            <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
              <p className="text-xs text-slate-600 mb-1">
                Unrealized gain (24h)
              </p>
              <p
                className={`text-2xl font-bold ${
                  (ov.kpis.delta24hUsd || 0) >= 0
                    ? "text-emerald-700"
                    : "text-red-700"
                }`}
              >
                {fmtUSD(ov.kpis.delta24hUsd || 0)}
              </p>
              <p className="text-xs text-slate-500 mt-2">
                Potential taxable gain/loss
              </p>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-lg">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">
              Key tax deadlines
            </h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      Annual return
                    </p>
                    <p className="text-xs text-slate-500">
                      Crypto income 2024
                    </p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-blue-700">
                  May 15, 2025
                </span>
              </div>
              <div className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      Wealth tax (IFI)
                    </p>
                    <p className="text-xs text-slate-500">
                      If crypto net worth {">"} $1.3M
                    </p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-amber-700">
                  June 15, 2025
                </span>
              </div>
              <div className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      Realized gains
                    </p>
                    <p className="text-xs text-slate-500">
                      30% flat tax on gains
                    </p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-emerald-700">
                  Rolling throughout the year
                </span>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
            <p className="text-xs text-purple-800 font-semibold mb-2">
              💡 Tax tip
            </p>
            <p className="text-sm text-slate-700">
              Capital gains from cryptocurrency disposals are taxed at 30% (flat
              tax). Remember to declare every realized gain when swapping
              crypto-to-crypto or crypto-to-fiat.
            </p>
          </div>
        </div>
      )}
      </Card>
    )}

    {/* Cross-Chain Reconciliation */}
    {visibleCharts.crossChainReconciliation && (
      <Card className="p-6 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-slate-800">
            Cross-Chain Reconciliation
          </h3>
          <InfoHover description="Aggregates holdings per network so you can trace where value sits before initiating bridge or settlement operations." />
        </div>
        <span className="text-xs text-slate-500">Cross-Chain Analysis</span>
      </div>
      {loadingOv || !ov ? (
        <Skeleton className="h-[300px] w-full" />
      ) : (
        (() => {
          const chainMap = new Map<
            string,
            { label: string; value: number; assets: number }
          >();
          for (const h of ov.holdings ?? []) {
            const existing = chainMap.get(h.chain) ?? {
              label: CHAIN_LABEL[h.chain] ?? h.chain,
              value: 0,
              assets: 0,
            };
            existing.value += h.valueUsd || 0;
            existing.assets += 1;
            chainMap.set(h.chain, existing);
          }

          const crossChainData = Array.from(chainMap.entries())
            .map(([chain, data]) => ({
              chain,
              label: data.label,
              value: data.value,
              assets: data.assets,
              percentage: (
                (data.value / (ov.kpis.totalValueUsd || 1)) *
                100
              ).toFixed(1),
            }))
            .sort((a, b) => b.value - a.value);

          return (
            <>
              <div className="mb-4 grid grid-cols-3 gap-4">
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-xs text-slate-600 mb-1">
                    Chains tracked
                  </p>
                  <p className="text-2xl font-bold text-purple-700">
                    {crossChainData.length}
                  </p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-xs text-slate-600 mb-1">
                    Total assets
                  </p>
                  <p className="text-2xl font-bold text-blue-700">
                    {(ov.holdings ?? []).length}
                  </p>
                </div>
                <div className="bg-emerald-50 p-4 rounded-lg">
                  <p className="text-xs text-slate-600 mb-1">Primary chain</p>
                  <p className="text-lg font-bold text-emerald-700">
                    {crossChainData[0]?.label || "N/A"}
                  </p>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {crossChainData.map((chain, idx) => (
                  <div
                    key={chain.chain}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{
                          backgroundColor:
                            CHAIN_STACK_COLORS[
                              idx % CHAIN_STACK_COLORS.length
                            ],
                        }}
                      />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {chain.label}
                        </p>
                        <p className="text-xs text-slate-500">
                          {chain.assets} asset{chain.assets > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-800">
                        {fmtUSD(chain.value)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {chain.percentage}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {crossChainData.length > 0 && (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={crossChainData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => fmtUSDCompact(v)} tick={{ fontSize: 12 }} width={80} />
                    <RechartsTooltip
                      formatter={(value: number, _name: string, props: any) => [
                        `${fmtUSD(value)} (${props.payload.percentage}%)`,
                        "Value",
                      ]}
                    />
                    <Bar dataKey="value">
                      {crossChainData.map((entry, index) => (
                        <Cell
                          key={`cross-cell-${index}`}
                          fill={
                            CHAIN_STACK_COLORS[
                              index % CHAIN_STACK_COLORS.length
                            ]
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </>
          );
        })()
      )}
      </Card>
    )}

    {/* Portfolio Risk Evaluation (Concentration) */}
    {visibleCharts.portfolioRiskEvaluation && (
      <Card className="p-6 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-slate-800">
            Portfolio Risk Evaluation
          </h3>
          <InfoHover description="Uses the Herfindahl-Hirschman Index (HHI) to highlight concentration risk and the number of truly independent bets in the portfolio." />
        </div>
        <span className="text-xs text-slate-500">Concentration Analysis</span>
      </div>
      {loadingOv || !ov ? (
        <Skeleton className="h-[300px] w-full" />
      ) : (
        (() => {
          const weights = (ov.allocation ?? []).map((a) => a.weightPct / 100);
          const hhi =
            weights.reduce((sum, w) => sum + w * w, 0) * 10000 || 0;
          const effectiveN =
            weights.length > 0
              ? 1 / weights.reduce((sum, w) => sum + w * w, 0)
              : 0;

          const sorted = [...(ov.allocation ?? [])].sort(
            (a, b) => b.weightPct - a.weightPct
          );
          const top3Holdings = sorted.slice(0, 3);
          const top3Concentration = top3Holdings.reduce(
            (s, a) => s + a.weightPct,
            0
          );

          const riskLevel =
            hhi > 2500
              ? { label: "Very high", color: "red", bg: "bg-red-50" }
              : hhi > 1500
              ? { label: "High", color: "orange", bg: "bg-orange-50" }
              : hhi > 1000
              ? { label: "Moderate", color: "amber", bg: "bg-amber-50" }
              : { label: "Low", color: "emerald", bg: "bg-emerald-50" };

          const concentrationData = sorted.slice(0, 10).map((a) => ({
            name: a.symbol || "Unknown",
            concentration: a.weightPct,
            value: a.valueUsd,
          }));

          return (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className={`${riskLevel.bg} p-4 rounded-lg border border-${riskLevel.color}-200`}>
                  <p className="text-xs text-slate-600 mb-1">HHI index</p>
                  <p className={`text-2xl font-bold text-${riskLevel.color}-700`}>
                    {hhi.toFixed(0)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Risk: {riskLevel.label}
                  </p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-xs text-slate-600 mb-1">
                    Effective number of assets
                  </p>
                  <p className="text-2xl font-bold text-blue-700">
                    {effectiveN.toFixed(1)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Diversification
                  </p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <p className="text-xs text-slate-600 mb-1">
                    Top 3 concentration
                  </p>
                  <p className="text-2xl font-bold text-purple-700">
                    {top3Concentration.toFixed(1)}%
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {top3Holdings.length} assets
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">
                  Top 3 concentration risks
                </h4>
                <div className="space-y-2">
                  {top3Holdings.map((holding, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-white rounded border border-slate-200"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-500">
                          #{idx + 1}
                        </span>
                        <span className="text-sm font-medium text-slate-800">
                          {holding.symbol}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-800">
                          {holding.weightPct.toFixed(2)}%
                        </p>
                        <p className="text-xs text-slate-500">
                          {fmtUSD(holding.valueUsd)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {concentrationData.length > 0 && (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={concentrationData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} width={50} />
                    <RechartsTooltip
                      formatter={(value: number, _name: string, props: any) => [
                        `${value.toFixed(2)}% (${fmtUSD(props.payload.value)})`,
                        "Concentration",
                      ]}
                    />
                    <Bar dataKey="concentration">
                      {concentrationData.map((entry, index) => {
                        const color =
                          entry.concentration > 25
                            ? "#ef4444"
                            : entry.concentration > 15
                            ? "#f97316"
                            : entry.concentration > 10
                            ? "#f59e0b"
                            : "#10b981";
                        return (
                          <Cell key={`conc-cell-${index}`} fill={color} />
                        );
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}

              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="text-xs text-blue-800 font-semibold mb-2">
                  📊 HHI interpretation
                </p>
                <ul className="text-sm text-slate-700 space-y-1">
                  <li>• HHI {"<"} 1000: Well-diversified portfolio</li>
                  <li>• HHI 1000-1500: Moderate concentration</li>
                  <li>• HHI 1500-2500: High concentration</li>
                  <li>• HHI {">"} 2500: Very high concentration</li>
                </ul>
              </div>
            </div>
          );
        })()
      )}
      </Card>
    )}
      </div>
    </TooltipProvider>
  );
};

export default GraphsTab;
