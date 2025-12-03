import { Card } from "@/components/ui/card";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from "recharts";
import { fmtUSD, fmtUSDCompact, fmtPct } from "@/utils/transactionHelpers";
import type { useTransactionStats } from "@/hooks/useTransactionStats";

type StatsReturn = ReturnType<typeof useTransactionStats>;

interface CapitalGainsSnapshotProps {
  address: string;
  loadedTransactionsCount: number;
  totalCount: number | null;
  dateRangeLabel: string;
  capitalGainsSummary: StatsReturn["capitalGainsSummary"];
  incomeBreakdown: StatsReturn["incomeBreakdown"];
  counterpartyBreakdown: StatsReturn["counterpartyBreakdown"];
  gasVsProceeds: StatsReturn["gasVsProceeds"];
  stableBufferStats: StatsReturn["stableBufferStats"];
  costBasisBuckets: StatsReturn["costBasisBuckets"];
  washSaleSignals: StatsReturn["washSaleSignals"];
  unmatchedSales: StatsReturn["capitalGainsSummary"]["unmatchedSales"];
}

export function CapitalGainsSnapshot({
  address,
  loadedTransactionsCount,
  totalCount,
  dateRangeLabel,
  capitalGainsSummary,
  incomeBreakdown,
  counterpartyBreakdown,
  gasVsProceeds,
  stableBufferStats,
  costBasisBuckets,
  washSaleSignals,
  unmatchedSales,
}: CapitalGainsSnapshotProps) {
  const coveragePct =
    totalCount && totalCount > 0
      ? Math.min(1, totalCount / loadedTransactionsCount)
      : null;
  const hasRealizedData = capitalGainsSummary.realized.length > 0;
  const coveragePctDisplay =
    coveragePct != null ? Math.round(coveragePct * 100) : null;

  return (
    <Card className="bg-white shadow-sm">
      <div className="p-6 space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-slate-800">
              Capital Gains Snapshot (loaded data)
            </h3>
            <p className="text-sm text-slate-500">
              Based on {loadedTransactionsCount.toLocaleString()} loaded
              transactions for {dateRangeLabel}. Load additional pages to
              refine these estimates.
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Coverage</p>
            <p className="text-2xl font-semibold text-slate-900">
              {coveragePctDisplay != null ? `${coveragePctDisplay}%` : "—"}
            </p>
            {totalCount && (
              <p className="text-xs text-slate-500">
                {totalCount.toLocaleString()} /{" "}
                {loadedTransactionsCount.toLocaleString()}
              </p>
            )}
          </div>
        </div>
        {coveragePct != null && (
          <div>
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

        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">
              Loaded transactions
            </p>
            <p className="text-2xl font-semibold text-slate-900">
              {loadedTransactionsCount.toLocaleString()}
            </p>
            <p className="text-xs text-slate-500">
              {capitalGainsSummary.acquisitions} buys ·{" "}
              {capitalGainsSummary.disposals} disposals
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">
              Realized gains (loaded)
            </p>
            <p
              className={`text-2xl font-semibold ${
                capitalGainsSummary.totalRealized >= 0
                  ? "text-emerald-600"
                  : "text-rose-600"
              }`}
            >
              {fmtUSD(capitalGainsSummary.totalRealized)}
            </p>
            <p className="text-xs text-slate-500">Aggregated to date</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">
              Short-term
            </p>
            <p
              className={`text-2xl font-semibold ${
                capitalGainsSummary.shortTerm >= 0
                  ? "text-emerald-600"
                  : "text-rose-600"
              }`}
            >
              {fmtUSD(capitalGainsSummary.shortTerm)}
            </p>
            <p className="text-xs text-slate-500">
              &lt; 365 day holding period
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">
              Long-term
            </p>
            <p
              className={`text-2xl font-semibold ${
                capitalGainsSummary.longTerm >= 0
                  ? "text-emerald-600"
                  : "text-rose-600"
              }`}
            >
              {fmtUSD(capitalGainsSummary.longTerm)}
            </p>
            <p className="text-xs text-slate-500">
              ≥ 365 day holding period
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-slate-800">
                Realized gain timeline
              </p>
              <span className="text-xs text-slate-500">
                {hasRealizedData
                  ? "Stacked short vs long term"
                  : "Awaiting qualifying sales"}
              </span>
            </div>
            {hasRealizedData ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={capitalGainsSummary.timeline}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value: string) =>
                      new Date(value).toLocaleDateString()
                    }
                    interval="preserveStartEnd"
                    minTickGap={24}
                  />
                  <YAxis tickFormatter={(value: number) => fmtUSDCompact(value)} width={80} tick={{ fontSize: 12 }} />
                  <RechartsTooltip
                    formatter={(value: number) => fmtUSD(value)}
                    labelFormatter={(value) =>
                      new Date(value).toLocaleDateString()
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="short"
                    stackId="1"
                    stroke="#f97316"
                    fill="#fed7aa"
                    name="Short-term"
                  />
                  <Area
                    type="monotone"
                    dataKey="long"
                    stackId="1"
                    stroke="#0ea5e9"
                    fill="#bae6fd"
                    name="Long-term"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-500">
                Load additional outgoing transactions to build this chart.
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-slate-800">
                Top dispositions
              </p>
              <span className="text-xs text-slate-500">
                Largest realized gains/losses
              </span>
            </div>
            {capitalGainsSummary.topRealized.length ? (
              <div className="space-y-3">
                {capitalGainsSummary.topRealized.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 p-3"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-900">
                        {entry.asset} ·{" "}
                        <span className="text-xs text-slate-500">
                          {entry.quantity.toFixed(4)}
                        </span>
                      </p>
                      <p className="text-xs text-slate-500">
                        {entry.isLongTerm ? "Long-term" : "Short-term"} ·
                        Held {entry.holdingPeriod}d · Sold{" "}
                        {new Date(entry.saleDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-sm font-semibold ${
                          entry.gain >= 0
                            ? "text-emerald-600"
                            : "text-rose-600"
                        }`}
                      >
                        {fmtUSD(entry.gain)}
                      </p>
                      <p className="text-xs text-slate-500">
                        Basis {fmtUSD(entry.costBasis)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[220px] flex items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-500">
                No realized gains or losses in the loaded history yet.
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-slate-800">
                Tax readiness warnings
              </p>
              <span className="text-xs text-slate-500">
                Live coverage check
              </span>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Unmatched disposals
                </p>
                {unmatchedSales.length ? (
                  <ul className="mt-2 space-y-2 text-sm text-slate-700">
                    {unmatchedSales.slice(0, 3).map((sale, idx) => (
                      <li
                        key={`${sale.transactionId}-${sale.saleDate}-${sale.asset}-${sale.quantity}-${idx}`}
                        className="flex items-center justify-between"
                      >
                        <span>
                          {sale.label} · {sale.quantity.toFixed(4)}
                        </span>
                        <span className="text-rose-600">
                          {new Date(sale.saleDate).toLocaleDateString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-emerald-600">
                    All processed sales had matching cost basis in the
                    loaded history.
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Potential wash sales
                </p>
                {washSaleSignals.length ? (
                  <ul className="mt-2 space-y-2 text-sm text-slate-700">
                    {washSaleSignals.map((signal, idx) => (
                      <li
                        key={`${signal.asset}-${idx}`}
                        className="flex items-center justify-between"
                      >
                        <span>
                          {signal.asset} loss on{" "}
                          {new Date(signal.saleDate).toLocaleDateString()}
                        </span>
                        <span className="text-amber-600">
                          Rebuy{" "}
                          {new Date(
                            signal.repurchaseDate
                          ).toLocaleDateString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-emerald-600">
                    No losses with a repurchase inside the ±30 day window in
                    the loaded data.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-slate-800">
                Income mix
              </p>
              <span className="text-xs text-slate-500">
                {fmtUSD(incomeBreakdown.total)}
              </span>
            </div>
            {incomeBreakdown.entries.length ? (
              <div className="space-y-3">
                {incomeBreakdown.entries.map((entry) => {
                  const pct =
                    incomeBreakdown.total > 0
                      ? (entry.value / incomeBreakdown.total) * 100
                      : 0;
                  return (
                    <div key={entry.label}>
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                        <span>{entry.label}</span>
                        <span>{fmtPct(pct)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-2 rounded-full bg-emerald-500"
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                No income-category transactions inside the loaded range.
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-slate-800">
                Cost basis aging
              </p>
              <span className="text-xs text-slate-500">
                {capitalGainsSummary.openLots.length} open lots
              </span>
            </div>
            {capitalGainsSummary.openLots.length ? (
              <div className="space-y-2">
                {costBasisBuckets.map((bucket) => (
                  <div
                    key={bucket.id}
                    className="flex items-center justify-between text-sm text-slate-700"
                  >
                    <span>{bucket.label}</span>
                    <span className="font-mono break-words text-right">
                      {bucket.lots} · {fmtUSD(bucket.usd)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                No remaining cost basis in the currently loaded history.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-slate-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-slate-800">
                Counterparty concentration
              </p>
              <span className="text-xs text-slate-500">Top outflows</span>
            </div>
            {counterpartyBreakdown.length ? (
              <div className="space-y-2">
                {counterpartyBreakdown.map((entry) => (
                  <div
                    key={entry.label}
                    className="flex items-center justify-between text-sm text-slate-700"
                  >
                    <span>{entry.label}</span>
                    <span className="font-mono break-words text-right">
                      {fmtUSD(entry.value)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                No outgoing transactions recorded yet.
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-slate-800">
                Proceeds vs gas spend
              </p>
              <span className="text-xs text-slate-500">
                Gas {fmtPct(gasVsProceeds.gasPct)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm text-slate-700">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Proceeds
                </p>
                <p className="font-semibold break-words tabular-nums leading-tight">
                  {fmtUSD(gasVsProceeds.proceeds)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Gas
                </p>
                <p className="font-semibold text-rose-600 break-words tabular-nums leading-tight">
                  {fmtUSD(gasVsProceeds.gas)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Net
                </p>
                <p
                  className={`font-semibold break-words tabular-nums leading-tight ${
                    gasVsProceeds.net >= 0
                      ? "text-emerald-600"
                      : "text-rose-600"
                  }`}
                >
                  {fmtUSD(gasVsProceeds.net)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-slate-800">
                Stablecoin buffer
              </p>
              <span className="text-xs text-slate-500">
                Retained {fmtPct(stableBufferStats.retention)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm text-slate-700">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Inflow
                </p>
                <p className="font-semibold text-emerald-600 break-words tabular-nums leading-tight">
                  {fmtUSD(stableBufferStats.inflow)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Outflow
                </p>
                <p className="font-semibold text-rose-600 break-words tabular-nums leading-tight">
                  {fmtUSD(stableBufferStats.outflow)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Net
                </p>
                <p
                  className={`font-semibold break-words tabular-nums leading-tight ${
                    stableBufferStats.net >= 0
                      ? "text-emerald-600"
                      : "text-rose-600"
                  }`}
                >
                  {fmtUSD(stableBufferStats.net)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

