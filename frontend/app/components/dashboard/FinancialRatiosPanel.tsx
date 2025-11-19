"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { fmtUSD, fmtPct, DAY_MS } from "@/utils/transactionHelpers";
import type { useTransactionStats } from "@/hooks/useTransactionStats";
import type { useTransactionCache } from "@/hooks/useTransactionCache";
import type { useTransactionFilters } from "@/hooks/useTransactionFilters";

type StatsReturn = ReturnType<typeof useTransactionStats>;
type CacheReturn = ReturnType<typeof useTransactionCache>;
type FiltersReturn = ReturnType<typeof useTransactionFilters>;

interface FinancialRatiosPanelProps {
  totalAssetsUsd: number | null;
  stableHoldingsUsd: number;
  stats: StatsReturn;
  cache: CacheReturn;
  filters: FiltersReturn;
  totalCount: number | null;
  hasActiveWallets: boolean;
}

function RatioCard({
  title,
  value,
  formula,
  details,
  note,
}: {
  title: string;
  value: string;
  formula: string;
  details: Array<{ label: string; value: string }>;
  note?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-4 bg-slate-50/60">
      <p className="text-xs uppercase tracking-wide text-slate-500">
        {formula}
      </p>
      <h4 className="mt-1 text-xl font-semibold text-slate-900">{value}</h4>
      <p className="text-sm font-medium text-slate-700 mt-1">{title}</p>
      <dl className="mt-3 space-y-1 text-xs text-slate-600">
        {details.map((detail) => (
          <div key={detail.label} className="flex justify-between gap-2">
            <dt>{detail.label}</dt>
            <dd className="font-semibold text-slate-800">{detail.value}</dd>
          </div>
        ))}
      </dl>
      {note && <p className="mt-3 text-xs text-slate-500">{note}</p>}
    </div>
  );
}

export default function FinancialRatiosPanel({
  totalAssetsUsd,
  stableHoldingsUsd,
  stats,
  cache,
  filters,
  totalCount,
  hasActiveWallets,
}: FinancialRatiosPanelProps) {
  const loadedTxCount = cache.loadedRowsAll.length;
  const coveragePct =
    totalCount && totalCount > 0
      ? Math.min(1, (loadedTxCount || 0) / totalCount)
      : null;
  const coveragePctDisplay =
    coveragePct != null ? Math.round(coveragePct * 100) : null;

  const flowStats = useMemo(() => {
    let expenseTotal = 0;
    let minTs: number | null = null;
    let maxTs: number | null = null;
    cache.loadedRowsAll.forEach((row) => {
      if (row.type === "expense" && row.direction === "out") {
        expenseTotal += row.usdAtTs ?? 0;
      }
      const ts = Date.parse(row.ts);
      if (!Number.isNaN(ts)) {
        if (minTs == null || ts < minTs) minTs = ts;
        if (maxTs == null || ts > maxTs) maxTs = ts;
      }
    });
    const spanDays =
      minTs != null && maxTs != null
        ? Math.max(1, Math.round((maxTs - minTs) / DAY_MS) + 1)
        : 0;
    return { expenseTotal, spanDays };
  }, [cache.loadedRowsAll]);

  const totalIncome = stats.incomeBreakdown.total ?? 0;
  const totalExpenses = flowStats.expenseTotal;
  const gasTotal = stats.gasVsProceeds.gas ?? 0;
  const netIncome = totalIncome - totalExpenses - gasTotal;
  const netMargin =
    totalIncome > 0 ? netIncome / totalIncome : null;
  const assetTurnover =
    totalAssetsUsd && totalAssetsUsd > 0
      ? totalIncome / totalAssetsUsd
      : null;
  const roa =
    totalAssetsUsd && totalAssetsUsd > 0
      ? netIncome / totalAssetsUsd
      : null;

  const avgDailyBurn =
    flowStats.spanDays > 0 ? (totalExpenses + gasTotal) / flowStats.spanDays : null;
  const daysOfSufficiency =
    avgDailyBurn && avgDailyBurn > 0
      ? stableHoldingsUsd / avgDailyBurn
      : null;

  const gasCoverage =
    stats.gasVsProceeds.proceeds > 0
      ? (stats.gasVsProceeds.proceeds - stats.gasVsProceeds.gas) /
        stats.gasVsProceeds.proceeds
      : null;

  const unavailableRatios = [
    {
      title: "Return on Equity (ROE)",
      reason:
        "Requires shareholder equity or retained earnings, which wallets do not expose.",
    },
    {
      title: "Current & Quick Ratios",
      reason:
        "Need current asset/liability schedules beyond on-chain balances.",
    },
    {
      title: "Cash Conversion Cycle",
      reason:
        "No on-chain receivables, payables, or inventory turnover data.",
    },
    {
      title: "Breakeven, Operating & Financial Leverage",
      reason:
        "Missing fixed vs variable cost split, EBIT history, and formal debt balances.",
    },
  ];

  const ratioCards = [
    {
      id: "net-margin",
      title: "Net Margin",
      value: netMargin != null ? fmtPct(netMargin) : "—",
      formula: "Net income / total income",
      details: [
        {
          label: "Net income",
          value: fmtUSD(netIncome),
        },
        { label: "Total income", value: fmtUSD(totalIncome) },
      ],
      note:
        totalIncome === 0
          ? "Requires at least one income transaction in the loaded sample."
          : "Income includes on-chain inflows classified as income events.",
    },
    {
      id: "asset-turnover",
      title: "Asset Turnover",
      value:
        assetTurnover != null ? `${assetTurnover.toFixed(2)}×` : "—",
      formula: "Total income / total assets",
      details: [
        { label: "Total income", value: fmtUSD(totalIncome) },
        {
          label: "Total assets",
          value:
            totalAssetsUsd != null ? fmtUSD(totalAssetsUsd) : "—",
        },
      ],
      note:
        totalAssetsUsd == null
          ? "Portfolio value unavailable — refresh overview to sync holdings."
          : "Assets taken from the latest overview snapshot, not an audited balance sheet.",
    },
    {
      id: "roa",
      title: "Return on Assets (ROA)",
      value: roa != null ? fmtPct(roa) : "—",
      formula: "Net income / total assets",
      details: [
        { label: "Net income", value: fmtUSD(netIncome) },
        {
          label: "Total assets",
          value:
            totalAssetsUsd != null ? fmtUSD(totalAssetsUsd) : "—",
        },
      ],
      note:
        totalAssetsUsd == null
          ? "Requires a current portfolio valuation."
          : "Treats wallet value as an equity proxy — taxes and off-chain liabilities not included.",
    },
    {
      id: "sufficiency",
      title: "Days of Sufficiency",
      value:
        daysOfSufficiency != null
          ? `${daysOfSufficiency.toFixed(1)} days`
          : "—",
      formula: "Liquid reserves / avg daily burn",
      details: [
        { label: "Liquid reserves", value: fmtUSD(stableHoldingsUsd) },
        {
          label: "Avg daily burn",
          value:
            avgDailyBurn != null ? fmtUSD(avgDailyBurn) : "—",
        },
      ],
      note:
        flowStats.spanDays === 0
          ? "Load at least two days of transactions to estimate burn rate."
          : "Liquid reserves use current stablecoin holdings across connected wallets.",
    },
    {
      id: "gas-coverage",
      title: "Gas Coverage",
      value: gasCoverage != null ? fmtPct(gasCoverage) : "—",
      formula: "(Proceeds − gas fees) / proceeds",
      details: [
        { label: "Proceeds", value: fmtUSD(stats.gasVsProceeds.proceeds) },
        { label: "Gas spend", value: fmtUSD(stats.gasVsProceeds.gas) },
      ],
      note:
        stats.gasVsProceeds.proceeds === 0
          ? "Need at least one outbound transaction in the sample."
          : "Highlights how much gross outflow is lost to network fees.",
    },
  ];

  return (
    <Card className="bg-white shadow-sm">
      <div className="p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-800">
              Financial Ratios
            </h3>
            <p className="text-sm text-slate-500">
              Based on loaded transactions for {filters.dateRange.label}. Load
              additional pages to improve coverage.
            </p>
          </div>
          <div className="text-sm text-slate-500">
            Page {cache.page} • {filters.networksButtonLabel}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mt-6">
          <div>
            <p className="text-xs uppercase text-slate-500">Loaded tx</p>
            <p className="text-2xl font-semibold text-slate-900">
              {loadedTxCount.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">
              Coverage vs estimate
            </p>
            <p className="text-2xl font-semibold text-slate-900">
              {coveragePctDisplay != null ? `${coveragePctDisplay}%` : "—"}
            </p>
            {totalCount && (
              <p className="text-xs text-slate-500">
                {loadedTxCount.toLocaleString()}{" "}
                / {totalCount.toLocaleString()}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">Active window</p>
            <p className="text-2xl font-semibold text-slate-900">
              {flowStats.spanDays > 0 ? `${flowStats.spanDays} days` : "—"}
            </p>
          </div>
        </div>

        {coveragePct != null && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>Loaded vs estimated total</span>
              <span>{coveragePctDisplay}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-2 bg-indigo-500"
                style={{
                  width: `${Math.min(coveragePct * 100, 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {!hasActiveWallets ? (
          <p className="mt-6 text-sm text-slate-600">
            Select at least one wallet to compute ratios. Use the wallet picker
            in the toolbar above.
          </p>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              {ratioCards.map((ratio) => (
                <RatioCard key={ratio.id} {...ratio} />
              ))}
            </div>
            <p className="text-xs text-slate-500">
              These ratios are illustrative only and rely on the loaded
              transactions plus the latest portfolio snapshot. Taxes,
              off-chain liabilities, and historical accounting entries are out
              of scope for this wallet-native view.
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 px-6 py-4 bg-slate-50/80">
        <h4 className="text-sm font-semibold text-slate-800 mb-2">
          Ratios unavailable with current data
        </h4>
        <ul className="list-disc pl-5 space-y-1 text-sm text-slate-600">
          {unavailableRatios.map((item) => (
            <li key={item.title}>
              <span className="font-medium text-slate-800">{item.title}:</span>{" "}
              {item.reason}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
