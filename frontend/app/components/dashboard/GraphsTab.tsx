"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { OverviewResponse, PricedHolding } from "@/lib/types/portfolio";
import type { HistoricalPoint } from "@/lib/api/analytics";
import { fmtUSD, fmtPct } from "@/lib/portfolioUtils";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, BarChart, Bar, ReferenceLine, PieChart as RPieChart, Pie, Cell, Legend } from "recharts";

interface AllocationRow { name: string; pct: number; usd: number }
interface ChainBreakdownRow { chain: string; label: string; usd: number; pct: number }
interface PnlRow { label: string; pnl: number; value: number }
interface StableVsRisk { stable: number; nonStable: number }
interface Movers { gainers: PricedHolding[]; losers: PricedHolding[] }
interface HistoricalChartPoint { date: string; value: number; timestamp: number }

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
}: GraphsTabProps) => (
  <div className="space-y-6">
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
          {fmtUSD(pnlByChain.reduce((s, r) => s + r.pnl, 0))} over 24h.
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
  </div>
);

export default GraphsTab;
