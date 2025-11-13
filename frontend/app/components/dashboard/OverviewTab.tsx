"use client";

import type { Dispatch, SetStateAction } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import type { OverviewResponse, PricedHolding } from "@/lib/types/portfolio";
import {
  fmtUSD,
  fmtPct,
  chainBadgeClass,
  CHAIN_LABEL,
} from "@/lib/portfolioUtils";
import {
  ResponsiveContainer,
  PieChart as RPieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Crown,
} from "lucide-react";

interface Movers {
  gainers: PricedHolding[];
  losers: PricedHolding[];
}
interface Concentration {
  hhi: number;
  label: string;
  stableSharePct: number;
}
interface ConcentrationExtras {
  effN: number;
  top1: number;
  top3: number;
}
interface QualityMetrics {
  volProxy: number;
  bluechipShare: number;
  chainSpread: number;
}
interface ChainExposureSlice {
  chain: string;
  name: string;
  value: number;
  pct: number;
}
interface RiskBucket {
  id: string;
  label: string;
  description: string;
  criteria: string;
  accent: string;
  barColor: string;
  usd: number;
  pct: number;
  assetCount: number;
}

interface OverviewTabProps {
  loadingOv: boolean;
  ov: OverviewResponse | null;
  userCurrency: string;
  mounted: boolean;
  quality: QualityMetrics | null;
  concentration: Concentration;
  concentrationExtras: ConcentrationExtras;
  topHoldingsLive: PricedHolding[];
  errorOv: string | null;
  showChange: boolean;
  setShowChange: Dispatch<SetStateAction<boolean>>;
  movers: Movers;
  minUsdFilter: number;
  setMinUsdFilter: (value: number) => void;
  hideStables: boolean;
  setHideStables: (value: boolean) => void;
  filteredHoldings: PricedHolding[];
  riskBuckets: RiskBucket[];
}

const CHAIN_COLOR_PALETTE = [
  "#2563eb",
  "#0ea5e9",
  "#f97316",
  "#16a34a",
  "#9333ea",
  "#facc15",
];
const OTHER_CHAIN_COLOR = "#94a3b8";

const OverviewTab = ({
  loadingOv,
  ov,
  userCurrency,
  mounted,
  quality,
  concentration,
  concentrationExtras,
  topHoldingsLive,
  errorOv,
  showChange,
  setShowChange,
  movers,
  minUsdFilter,
  setMinUsdFilter,
  hideStables,
  setHideStables,
  filteredHoldings,
  riskBuckets,
}: OverviewTabProps) => {
  const totalValueUsd = ov?.kpis.totalValueUsd ?? 0;
  const largestHolding =
    !loadingOv && ov && topHoldingsLive.length > 0 ? topHoldingsLive[0] : null;
  const largestHoldingShare =
    largestHolding && totalValueUsd > 0
      ? (largestHolding.valueUsd / totalValueUsd) * 100
      : 0;
  const chainExposureData: ChainExposureSlice[] = ov
    ? (() => {
        const totals = ov.holdings.reduce<Record<string, number>>(
          (acc, holding) => {
            const chain = holding.chain ?? "unknown";
            acc[chain] = (acc[chain] || 0) + (holding.valueUsd || 0);
            return acc;
          },
          {}
        );
        const sorted = Object.entries(totals)
          .map(([chain, usd]) => ({
            chain,
            name: CHAIN_LABEL[chain as keyof typeof CHAIN_LABEL] ?? chain,
            value: usd,
            pct: totalValueUsd > 0 ? (usd / totalValueUsd) * 100 : 0,
          }))
          .filter((entry) => entry.value > 0)
          .sort((a, b) => b.value - a.value);
        const limited = sorted.slice(0, 5);
        const otherValue = sorted
          .slice(5)
          .reduce((sum, entry) => sum + entry.value, 0);
        if (otherValue > 0) {
          limited.push({
            chain: "other",
            name: "Other",
            value: otherValue,
            pct: totalValueUsd > 0 ? (otherValue / totalValueUsd) * 100 : 0,
          });
        }
        return limited;
      })()
    : [];
  const getChainColor = (chain: string, idx: number) =>
    chain === "other"
      ? OTHER_CHAIN_COLOR
      : CHAIN_COLOR_PALETTE[idx % CHAIN_COLOR_PALETTE.length];
  return (
    <div className="space-y-6">
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
                  currency={userCurrency}
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
              <p className="text-slate-600 text-sm font-medium">24h Change</p>
              {loadingOv ? (
                <div className="mt-2">
                  <Skeleton className="h-8 w-24" />
                </div>
              ) : (
                <CurrencyDisplay
                  amount={ov?.kpis.delta24hUsd ?? 0}
                  currency={userCurrency}
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
          {quality &&
            (mounted ? (
              <div className="flex flex-wrap gap-2">
                <HoverCard>
                  <HoverCardTrigger asChild>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-slate-200 bg-white text-xs text-slate-700 shadow-sm hover:bg-slate-50 transition cursor-help">
                      <span>
                        Vol (24h proxy): {quality.volProxy.toFixed(2)}%
                      </span>
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-300" />
                    </span>
                  </HoverCardTrigger>
                  <HoverCardContent className="w-80">
                    <p className="text-sm font-medium mb-2">
                      Volatility (24h proxy)
                    </p>
                    <p className="text-xs text-slate-600 mb-2">
                      Absolute value of 24h P&L divided by total portfolio
                      value. Higher = more volatile.
                    </p>
                    <div className="mt-2 pt-2 border-t border-slate-200">
                      <p className="text-xs font-mono text-slate-500 mb-1">
                        Formula:
                      </p>
                      <p className="text-xs text-slate-700 font-mono">
                        |Δ24h USD| / TVL × 100%
                      </p>
                      <p className="text-xs text-slate-500 mt-2">
                        Where Δ24h = absolute change in USD over 24h, TVL =
                        total portfolio value.
                      </p>
                    </div>
                  </HoverCardContent>
                </HoverCard>
                <HoverCard>
                  <HoverCardTrigger asChild>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-slate-200 bg-white text-xs text-slate-700 shadow-sm hover:bg-slate-50 transition cursor-help">
                      <span>
                        Blue-chip: {quality.bluechipShare.toFixed(1)}%
                      </span>
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-300" />
                    </span>
                  </HoverCardTrigger>
                  <HoverCardContent className="w-80">
                    <p className="text-sm font-medium mb-2">Blue-chip share</p>
                    <p className="text-xs text-slate-600 mb-2">
                      Portion of portfolio held in ETH, WETH, BTC, or WBTC.
                    </p>
                    <div className="mt-2 pt-2 border-t border-slate-200">
                      <p className="text-xs font-mono text-slate-500 mb-1">
                        Formula:
                      </p>
                      <p className="text-xs text-slate-700 font-mono">
                        (Σ value ETH/WETH/BTC/WBTC) / TVL × 100%
                      </p>
                      <p className="text-xs text-slate-500 mt-2">
                        Sum of USD values of all ETH, WETH, BTC, WBTC tokens
                        divided by total value.
                      </p>
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
                    <p className="text-xs text-slate-600 mb-2">
                      Number of chains representing at least 2% of portfolio
                      value.
                    </p>
                    <div className="mt-2 pt-2 border-t border-slate-200">
                      <p className="text-xs font-mono text-slate-500 mb-1">
                        Calculation:
                      </p>
                      <p className="text-xs text-slate-700 font-mono">
                        count(chains where chain_value / TVL ≥ 0.02)
                      </p>
                      <p className="text-xs text-slate-500 mt-2">
                        Multi-chain diversification indicator. Higher = better
                        distribution.
                      </p>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <span className="text-xs px-2 py-1 rounded-full border border-slate-200 bg-white">
                  Vol (24h proxy): {quality.volProxy.toFixed(2)}%
                </span>
                <span className="text-xs px-2 py-1 rounded-full border border-slate-200 bg-white">
                  Blue-chip: {quality.bluechipShare.toFixed(1)}%
                </span>
                <span className="text-xs px-2 py-1 rounded-full border border-slate-200 bg-white">
                  Chains ≥2%: {quality.chainSpread}
                </span>
              </div>
            ))}
        </Card>

        <Card className="p-6 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              {mounted ? (
                <HoverCard>
                  <HoverCardTrigger asChild>
                    <p className="text-slate-600 text-sm font-medium cursor-help">
                      Diversification (HHI)
                    </p>
                  </HoverCardTrigger>
                  <HoverCardContent className="w-80">
                    <p className="text-sm font-medium mb-2">
                      Herfindahl–Hirschman Index (HHI)
                    </p>
                    <p className="text-xs text-slate-600 mb-3">
                      Concentration measure calculated on asset weights in the
                      portfolio. Lower = better diversification.
                    </p>
                    <div className="mt-2 pt-2 border-t border-slate-200">
                      <p className="text-xs font-mono text-slate-500 mb-1">
                        Formula:
                      </p>
                      <p className="text-xs text-slate-700 font-mono mb-2">
                        HHI = Σ(w_i)² × 100
                      </p>
                      <p className="text-xs text-slate-600 mb-2">
                        Where w_i = percentage weight of asset i divided by 100.
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-200">
                      <p className="text-xs font-medium text-slate-700 mb-1">
                        Interpretation:
                      </p>
                      <ul className="text-xs text-slate-600 space-y-0.5 list-disc list-inside">
                        <li>
                          &lt; 15 : Well diversified (multiple balanced assets)
                        </li>
                        <li>
                          15-25 : Moderately concentrated (few dominant assets)
                        </li>
                        <li>
                          &gt; 25 : Highly concentrated (high concentration
                          risk)
                        </li>
                      </ul>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              ) : (
                <p className="text-slate-600 text-sm font-medium">
                  Diversification (HHI)
                </p>
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
                      <p className="text-xs font-medium text-slate-700 mb-1">
                        Current HHI value
                      </p>
                      <p className="text-xs text-slate-600 mb-2">
                        Concentration index calculated on{" "}
                        {ov?.allocation?.length || 0} assets in the portfolio.
                      </p>
                      <p className="text-xs text-slate-500 italic">
                        Hover over the title for more details on the
                        calculation.
                      </p>
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
          {!loadingOv &&
            (mounted ? (
              <HoverCard>
                <HoverCardTrigger asChild>
                  <p className="text-xs text-slate-500 mt-1 cursor-help">
                    Eff. assets: {concentrationExtras.effN.toFixed(1)} • Top-1:{" "}
                    {concentrationExtras.top1.toFixed(1)}% • Top-3:{" "}
                    {concentrationExtras.top3.toFixed(1)}%
                  </p>
                </HoverCardTrigger>
                <HoverCardContent className="w-80">
                  <p className="text-sm font-medium mb-2">
                    Concentration details
                  </p>
                  <div className="text-xs text-slate-600 mb-3 space-y-2">
                    <div>
                      <p className="font-medium text-slate-700 mb-0.5">
                        Eff. assets (effective assets):
                      </p>
                      <p>
                        Effective number of equivalent assets ≈ 1/∑w². Indicates
                        how many balanced assets compose the portfolio.
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-slate-700 mb-0.5">
                        Top-1:
                      </p>
                      <p>
                        Percentage weight of the largest asset in the portfolio.
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-slate-700 mb-0.5">
                        Top-3:
                      </p>
                      <p>
                        Cumulative sum of weights of the 3 largest positions.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-200">
                    <p className="text-xs font-mono text-slate-500 mb-1">
                      Formula:
                    </p>
                    <p className="text-xs text-slate-700 font-mono mb-2">
                      Eff. assets = 1 / Σ(w_i)²
                    </p>
                    <p className="text-xs text-slate-600">
                      Where w_i = normalized weight (weight % / 100). If all
                      assets are equal, Eff. assets = number of assets.
                    </p>
                  </div>
                </HoverCardContent>
              </HoverCard>
            ) : (
              <p className="text-xs text-slate-500 mt-1">
                Eff. assets: {concentrationExtras.effN.toFixed(1)} • Top-1:{" "}
                {concentrationExtras.top1.toFixed(1)}% • Top-3:{" "}
                {concentrationExtras.top3.toFixed(1)}%
              </p>
            ))}
        </Card>

        <Card className="p-6 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-slate-600 text-sm font-medium">
                Largest Position
              </p>
              {loadingOv ? (
                <div className="mt-2">
                  <Skeleton className="h-8 w-24" />
                </div>
              ) : !ov || !largestHolding ? (
                <p className="mt-2 text-sm text-slate-500">
                  No holdings with USD value.
                </p>
              ) : (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xl font-semibold text-slate-800">
                      {largestHolding.symbol || "(unknown)"}
                    </p>
                    <span
                      className={`px-2 py-0.5 text-xs rounded ${
                        chainBadgeClass[largestHolding.chain] ||
                        "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {CHAIN_LABEL[largestHolding.chain] ??
                        largestHolding.chain}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">
                    {fmtUSD(largestHolding.valueUsd || 0)} •{" "}
                    {fmtPct(largestHoldingShare)} of portfolio
                  </p>
                  {largestHolding.delta24hUsd != null && (
                    <div
                      className={`text-xs font-medium ${
                        largestHolding.delta24hUsd >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      <CurrencyDisplay
                        amount={largestHolding.delta24hUsd}
                        currency="USD"
                        showSign
                      />
                      {largestHolding.delta24hPct != null && (
                        <span className="ml-1">
                          ({largestHolding.delta24hPct >= 0 ? "+" : ""}
                          {largestHolding.delta24hPct.toFixed(2)}%)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <Crown className="w-12 h-12 text-amber-500" />
          </div>
          {!loadingOv && largestHolding && (
            <p className="text-xs text-slate-500 mt-1">
              Share captured by your top holding today.
            </p>
          )}
        </Card>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6 bg-white shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-slate-600">Risk Buckets</p>
              <p className="text-xs text-slate-500">
                Distribution across stablecoins, blue chips, and long-tail
                assets.
              </p>
            </div>
          </div>
          {riskBuckets.every((b) => b.usd === 0) ? (
            <div className="text-sm text-slate-500">
              Load an address to see risk distribution.
            </div>
          ) : (
            <div className="space-y-4">
              {riskBuckets.map((bucket) => (
                <div key={bucket.id} className="space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <HoverCard>
                        <HoverCardTrigger asChild>
                          <div
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-help ${bucket.accent}`}
                          >
                            {bucket.label}
                          </div>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-64">
                          <p className="text-xs font-medium text-slate-700 mb-1">
                            {bucket.label}
                          </p>
                          <p className="text-xs text-slate-500 mb-2">
                            {bucket.criteria}
                          </p>
                          <p className="text-xs text-slate-500">
                            Assets in bucket: {bucket.assetCount}
                          </p>
                          <p className="text-xs text-slate-500">
                            Share: {bucket.pct.toFixed(1)}% (
                            {fmtUSD(bucket.usd)})
                          </p>
                        </HoverCardContent>
                      </HoverCard>
                      <p className="text-xs text-slate-500 mt-1">
                        {bucket.description}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-800">
                        {bucket.pct.toFixed(1)}%
                      </p>
                      <p className="text-xs text-slate-500">
                        {fmtUSD(bucket.usd)}
                      </p>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${bucket.pct}%`,
                        backgroundColor: bucket.barColor,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6 bg-white shadow-sm lg:col-span-2">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">
            Chain Concentration
          </h3>
          {loadingOv ? (
            <Skeleton className="h-[300px] w-full" />
          ) : !ov ? (
            <div className="text-sm text-slate-500">
              Load an address to see chain distribution.
            </div>
          ) : chainExposureData.length === 0 ? (
            <div className="text-sm text-slate-500">
              No priced tokens to display.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <RPieChart>
                <Pie
                  data={chainExposureData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={110}
                  label={(entry) => `${entry.name} (${fmtPct(entry.pct)})`}
                >
                  {chainExposureData.map((entry, idx) => (
                    <Cell
                      key={entry.chain}
                      fill={getChainColor(entry.chain, idx)}
                    />
                  ))}
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
                      key={
                        h.contract ||
                        `${h.symbol || "unknown"}-${
                          (h as any).chain || "unknown"
                        }-${idx}`
                      }
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
                        <p className="font-medium text-sm mb-1">{h.symbol}</p>
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
          <h3 className="text-lg font-semibold text-slate-800">Top Holdings</h3>
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
          {errorOv && <div className="text-sm text-red-500">{errorOv}</div>}

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
                  key={
                    h.contract ||
                    `${h.symbol || "unknown"}-${
                      (h as any).chain || "unknown"
                    }-${index}`
                  }
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
                          {CHAIN_LABEL[(h as any).chain] ?? (h as any).chain}
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

          {!loadingOv && !errorOv && ov && topHoldingsLive.length === 0 && (
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
          <h3 className="text-lg font-semibold text-slate-800">All Holdings</h3>
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
          <div className="text-sm text-slate-500">No holdings to display.</div>
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
                      key={`${h.contract || "no-contract"}-${
                        (h as any).chain || "unknown"
                      }-${i}`}
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
                          {CHAIN_LABEL[(h as any).chain] ?? (h as any).chain}
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
    </div>
  );
};

export default OverviewTab;
