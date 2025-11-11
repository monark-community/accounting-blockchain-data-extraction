"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { OverviewResponse, PricedHolding } from "@/lib/types/portfolio";
import type { HistoricalPoint } from "@/lib/api/analytics";
import { fmtUSD, fmtPct, CHAIN_LABEL, CHAIN_STACK_COLORS } from "@/lib/portfolioUtils";
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
import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { TrendingUp, BarChart3, PieChart, DollarSign, Activity, Briefcase, Calendar, Link2, AlertTriangle } from "lucide-react";

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
  loadingOv: boolean;
  ov: OverviewResponse | null;
  chainBreakdown: ChainBreakdownRow[];
  pnlByChain: PnlRow[];
  allocationData: AllocationRow[];
  stableVsRisk: StableVsRisk;
  movers: Movers;
  netFlowData: NetFlowPoint[];
  chainHistory: ChainHistorySeries;
}

const GraphsTab = ({
  address,
  networks,
  loadingHistorical,
  historicalChartData,
  historicalData,
  isHistoricalEstimated,
  loadingOv,
  ov,
  chainBreakdown,
  pnlByChain,
  allocationData,
  stableVsRisk,
  movers,
  netFlowData,
  chainHistory,
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

  return (
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

      {/* 6-Month Portfolio Fluctuation Chart */}
      {visibleCharts.portfolioEvolution && (
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
            Historical data requires transactions over the last 6
            months.
          </p>
          <details className="text-xs text-slate-400 text-left max-w-md mx-auto">
            <summary className="cursor-pointer text-slate-500 mb-2">
              Debug Information
            </summary>
            <div className="bg-slate-50 p-3 rounded mt-2 space-y-1">
              <p>Address: {address?.substring(0, 10)}...</p>
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
            <XAxis dataKey="date" />
            <YAxis tickFormatter={(v) => fmtUSD(v)} />
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
            <XAxis dataKey="date" />
            <YAxis tickFormatter={(v) => `${v.toFixed(0)}%`} />
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
          {fmtUSD(pnlByChain.reduce((s, r) => s + r.pnl, 0))} over 24h.
        </p>
      )}
      </Card>
    )}

    {/* Asset Distribution Pie Chart */}
    {visibleCharts.assetDistribution && (
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
    )}

    {/* Stablecoin vs Risk Assets */}
    {visibleCharts.stableVsRisk && (
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
            <XAxis dataKey="name" />
            <YAxis tickFormatter={(v) => fmtUSD(v)} />
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
                  tick={{ fontSize: 10 }}
                />
                <YAxis tickFormatter={(v) => `${v}%`} />
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

    {/* Gestion de liquidité (Liquidity Management) */}
    {visibleCharts.liquidityManagement && (
      <Card className="p-6 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-800">
          Gestion de liquidité
        </h3>
        <span className="text-xs text-slate-500">Cash Flow Analysis</span>
      </div>
      {loadingOv || !ov ? (
        <Skeleton className="h-[300px] w-full" />
      ) : (
        (() => {
          const stablecoins = (ov.holdings ?? []).filter((h) =>
            ["USDT", "USDC", "DAI", "FRAX", "LUSD", "PYUSD", "BUSD"].includes(
              (h.symbol || "").toUpperCase()
            )
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
            percentage: ((h.valueUsd || 0) / totalStable) * 100,
          }));

          return (
            <>
              <div className="mb-4 grid grid-cols-3 gap-4">
                <div className="bg-emerald-50 p-4 rounded-lg">
                  <p className="text-xs text-slate-600 mb-1">
                    Liquidités totales
                  </p>
                  <p className="text-2xl font-bold text-emerald-700">
                    {fmtUSD(totalStable)}
                  </p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-xs text-slate-600 mb-1">
                    Ratio de liquidité
                  </p>
                  <p className="text-2xl font-bold text-blue-700">
                    {liquidityRatio.toFixed(1)}%
                  </p>
                </div>
                <div className="bg-amber-50 p-4 rounded-lg">
                  <p className="text-xs text-slate-600 mb-1">
                    Actifs illiquides
                  </p>
                  <p className="text-2xl font-bold text-amber-700">
                    {fmtUSD(totalPortfolio - totalStable)}
                  </p>
                </div>
              </div>
              {liquidityData.length === 0 ? (
                <div className="text-sm text-slate-500">
                  Aucun stablecoin détecté dans votre portefeuille.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={liquidityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(v) => fmtUSD(v)} />
                    <RechartsTooltip
                      formatter={(value: number, _name: string, props: any) => [
                        `${fmtUSD(value)} (${props.payload.percentage.toFixed(
                          1
                        )}%)`,
                        "Liquidité",
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

    {/* Classification comptable (Transaction Types) */}
    {visibleCharts.accountingClassification && (
      <Card className="p-6 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-800">
          Classification comptable
        </h3>
        <span className="text-xs text-slate-500">
          Distribution par type d'actif
        </span>
      </div>
      {loadingOv || !ov ? (
        <Skeleton className="h-[300px] w-full" />
      ) : (
        (() => {
          const classify = (symbol: string) => {
            const s = (symbol || "").toUpperCase();
            if (["USDT", "USDC", "DAI", "FRAX", "LUSD", "PYUSD", "BUSD"].includes(s))
              return "Stablecoins";
            if (["ETH", "WETH"].includes(s)) return "Ethereum";
            if (["BTC", "WBTC"].includes(s)) return "Bitcoin";
            if (["STETH", "RETH", "CBETH", "WSTETH"].includes(s))
              return "Liquid Staking";
            return "Autres tokens";
          };

          const categoryMap = new Map<string, number>();
          for (const h of ov.holdings ?? []) {
            const cat = classify(h.symbol);
            categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + (h.valueUsd || 0));
          }

          const accountingData = Array.from(categoryMap.entries()).map(
            ([name, value]) => ({
              name,
              value,
              percentage:
                ((value / (ov.kpis.totalValueUsd || 1)) * 100).toFixed(1) + "%",
            })
          );

          return accountingData.length === 0 ? (
            <div className="text-sm text-slate-500">
              Aucune donnée de classification disponible.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <RPieChart>
                <Pie
                  data={accountingData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={110}
                  label={(entry) => `${entry.name} (${entry.percentage})`}
                >
                  {accountingData.map((entry, index) => {
                    const colors = [
                      "#10b981",
                      "#3b82f6",
                      "#f59e0b",
                      "#8b5cf6",
                      "#ec4899",
                      "#06b6d4",
                    ];
                    return (
                      <Cell
                        key={`acc-cell-${index}`}
                        fill={colors[index % colors.length]}
                      />
                    );
                  })}
                </Pie>
                <RechartsTooltip formatter={(value: number) => fmtUSD(value)} />
                <Legend />
              </RPieChart>
            </ResponsiveContainer>
          );
        })()
      )}
      </Card>
    )}

    {/* Planification fiscale (Tax Planning) */}
    {visibleCharts.taxPlanning && (
      <Card className="p-6 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-800">
          Planification fiscale
        </h3>
        <span className="text-xs text-slate-500">Tax Calendar</span>
      </div>
      {loadingOv || !ov ? (
        <Skeleton className="h-[300px] w-full" />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-xs text-slate-600 mb-1">
                Valeur totale imposable
              </p>
              <p className="text-2xl font-bold text-blue-700">
                {fmtUSD(ov.kpis.totalValueUsd || 0)}
              </p>
              <p className="text-xs text-slate-500 mt-2">
                Base de calcul pour l'impôt sur la fortune
              </p>
            </div>
            <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
              <p className="text-xs text-slate-600 mb-1">
                Plus-value latente (24h)
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
                Potentiel gain/perte imposable
              </p>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-lg">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">
              Échéances fiscales importantes
            </h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      Déclaration annuelle
                    </p>
                    <p className="text-xs text-slate-500">
                      Revenus cryptomonnaies 2024
                    </p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-blue-700">
                  15 Mai 2025
                </span>
              </div>
              <div className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      Impôt sur la fortune (IFI)
                    </p>
                    <p className="text-xs text-slate-500">
                      Si patrimoine crypto {">"} 1.3M€
                    </p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-amber-700">
                  15 Juin 2025
                </span>
              </div>
              <div className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      Plus-values réalisées
                    </p>
                    <p className="text-xs text-slate-500">
                      Flat tax 30% sur gains
                    </p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-emerald-700">
                  Au fil de l'eau
                </span>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
            <p className="text-xs text-purple-800 font-semibold mb-2">
              💡 Conseil fiscal
            </p>
            <p className="text-sm text-slate-700">
              Les plus-values de cession de cryptomonnaies sont imposées à 30%
              (flat tax). Pensez à déclarer tous vos gains réalisés lors de
              conversions crypto-to-crypto ou crypto-to-fiat.
            </p>
          </div>
        </div>
      )}
      </Card>
    )}

    {/* Réconciliation multi-chaînes (Cross-Chain) */}
    {visibleCharts.crossChainReconciliation && (
      <Card className="p-6 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-800">
          Réconciliation multi-chaînes
        </h3>
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
                    Nombre de chaînes
                  </p>
                  <p className="text-2xl font-bold text-purple-700">
                    {crossChainData.length}
                  </p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-xs text-slate-600 mb-1">
                    Actifs totaux
                  </p>
                  <p className="text-2xl font-bold text-blue-700">
                    {(ov.holdings ?? []).length}
                  </p>
                </div>
                <div className="bg-emerald-50 p-4 rounded-lg">
                  <p className="text-xs text-slate-600 mb-1">Chaîne principale</p>
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
                          {chain.assets} actif{chain.assets > 1 ? "s" : ""}
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
                    <XAxis dataKey="label" angle={-45} textAnchor="end" height={80} />
                    <YAxis tickFormatter={(v) => fmtUSD(v)} />
                    <RechartsTooltip
                      formatter={(value: number, _name: string, props: any) => [
                        `${fmtUSD(value)} (${props.payload.percentage}%)`,
                        "Valeur",
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

    {/* Évaluation du risque portfolio (Concentration) */}
    {visibleCharts.portfolioRiskEvaluation && (
      <Card className="p-6 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-800">
          Évaluation du risque portfolio
        </h3>
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
              ? { label: "Très élevé", color: "red", bg: "bg-red-50" }
              : hhi > 1500
              ? { label: "Élevé", color: "orange", bg: "bg-orange-50" }
              : hhi > 1000
              ? { label: "Modéré", color: "amber", bg: "bg-amber-50" }
              : { label: "Faible", color: "emerald", bg: "bg-emerald-50" };

          const concentrationData = sorted.slice(0, 10).map((a) => ({
            name: a.symbol || "Unknown",
            concentration: a.weightPct,
            value: a.valueUsd,
          }));

          return (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className={`${riskLevel.bg} p-4 rounded-lg border border-${riskLevel.color}-200`}>
                  <p className="text-xs text-slate-600 mb-1">Indice HHI</p>
                  <p className={`text-2xl font-bold text-${riskLevel.color}-700`}>
                    {hhi.toFixed(0)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Risque: {riskLevel.label}
                  </p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-xs text-slate-600 mb-1">
                    Nombre effectif d'actifs
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
                    Concentration Top 3
                  </p>
                  <p className="text-2xl font-bold text-purple-700">
                    {top3Concentration.toFixed(1)}%
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {top3Holdings.length} actifs
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">
                  Top 3 positions à risque
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
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis tickFormatter={(v) => `${v}%`} />
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
                  📊 Interprétation HHI
                </p>
                <ul className="text-sm text-slate-700 space-y-1">
                  <li>• HHI {"<"} 1000: Portfolio bien diversifié</li>
                  <li>• HHI 1000-1500: Concentration modérée</li>
                  <li>• HHI 1500-2500: Concentration élevée</li>
                  <li>• HHI {">"} 2500: Concentration très élevée</li>
                </ul>
              </div>
            </div>
          );
        })()
      )}
      </Card>
    )}
    </div>
  );
};

export default GraphsTab;
