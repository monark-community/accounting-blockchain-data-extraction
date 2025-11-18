import { useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { TxType } from "@/lib/types/transactions";
import { CapitalGainsSnapshot } from "./CapitalGainsSnapshot";
import { TransactionToolbar } from "./TransactionToolbar";
import { TransactionTable } from "./TransactionTable";
import FinancialRatiosPanel from "./FinancialRatiosPanel";
import { typeIcon, shortAddr, fmtUSD } from "@/utils/transactionHelpers";
import { useTransactionsWorkspace } from "./TransactionsWorkspaceProvider";

interface AllTransactionsTabProps {
  totalAssetsUsd: number | null;
  stableHoldingsUsd: number;
}

export default function AllTransactionsTab({
  totalAssetsUsd,
  stableHoldingsUsd,
}: AllTransactionsTabProps) {
  const {
    address,
    activeWallets,
    walletOptionList,
    walletDropdownVisible,
    walletButtonLabel,
    walletLimitReached,
    walletLimit,
    walletLabelLookup,
    selectedWallets,
    toggleWalletSelection,
    selectAllWallets,
    resetWalletSelection,
    exportLabel,
    filters,
    cache,
    stats,
    totalCount,
    canPrev,
    canNext,
    goPrev,
    goNext,
    setRefreshKey,
  } = useTransactionsWorkspace();
  const coveragePct = useMemo(() => {
    if (!totalCount || totalCount <= 0) return null;
    return Math.min(
      1,
      stats.capitalGainsSummary.transactionsCount / totalCount
    );
  }, [totalCount, stats.capitalGainsSummary.transactionsCount]);

  useEffect(() => {
    if (cache.error) {
      console.error("[AllTransactionsTab] Error:", {
        address: address
          ? `${address.slice(0, 6)}...${address.slice(-4)}`
          : "none",
        error: cache.error.slice(0, 100),
      });
    }
  }, [cache.error, address]);

  return (
    <div className="space-y-6">
      <div
        className={`grid gap-6 ${
          activeWallets.length ? "lg:grid-cols-2" : "lg:grid-cols-1"
        }`}
      >
        {activeWallets.length > 0 && (
          <CapitalGainsSnapshot
            address={exportLabel}
            loadedTransactionsCount={
              stats.capitalGainsSummary.transactionsCount
            }
            totalCount={totalCount}
            dateRangeLabel={filters.dateRange.label}
            capitalGainsSummary={stats.capitalGainsSummary}
            incomeBreakdown={stats.incomeBreakdown}
            counterpartyBreakdown={stats.counterpartyBreakdown}
            gasVsProceeds={stats.gasVsProceeds}
            stableBufferStats={stats.stableBufferStats}
            costBasisBuckets={stats.costBasisBuckets}
            washSaleSignals={stats.washSaleSignals}
            unmatchedSales={stats.capitalGainsSummary.unmatchedSales}
          />
        )}
        <FinancialRatiosPanel
          totalAssetsUsd={totalAssetsUsd}
          stableHoldingsUsd={stableHoldingsUsd}
          stats={stats}
          cache={cache}
          filters={filters}
          totalCount={totalCount}
          hasActiveWallets={activeWallets.length > 0}
        />
      </div>

      <Card className="bg-white shadow-sm">
        <div className="p-6 space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-xl font-bold text-slate-800">
                All Transactions{" "}
                <span className="text-sm font-normal text-slate-500">
                  {filters.dateRange.label}
                </span>
              </h3>
              <p className="text-sm text-slate-500">
                Review every ledger entry, refine filters, then export or run
                ratios using the controls on the right.
              </p>
              {walletOptionList.length > 0 && activeWallets.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {activeWallets.map((walletAddress) => {
                    const meta =
                      walletLabelLookup[walletAddress.toLowerCase()] || null;
                    return (
                      <span
                        key={walletAddress}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700"
                      >
                        <span
                          className="inline-block w-2 h-2 rounded-full"
                          style={{ backgroundColor: meta?.color || "#94a3b8" }}
                        />
                        {meta?.label || shortAddr(walletAddress)}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
            <TransactionToolbar
              exportLabel={exportLabel}
              loading={cache.loading}
              page={cache.page}
              rows={cache.rows}
              filterIsAll={filters.filterIsAll}
              loadIndicatorLabel={cache.loadIndicatorLabel}
              isOverloaded={cache.isOverloaded}
              datePreset={filters.datePreset}
              dateRangeLabel={filters.dateRange.label}
              currentYear={filters.currentYear}
              setDatePreset={filters.setDatePreset}
              networks={filters.networks}
              networksButtonLabel={filters.networksButtonLabel}
              toggleNetworkSelection={filters.toggleNetworkSelection}
              selectAllNetworks={filters.selectAllNetworks}
              resetToDefaultNetworks={filters.resetToDefaultNetworks}
              visibleColumns={filters.visibleColumns}
              visibleColumnsInit={filters.visibleColumnsInit}
              setVisibleColumns={filters.setVisibleColumns}
              typeLabelForExport={filters.typeLabelForExport}
              canPrev={canPrev}
              canNext={canNext}
              goPrev={goPrev}
              goNext={goNext}
              refresh={cache.refresh}
              setRefreshKey={setRefreshKey}
              walletOptions={walletDropdownVisible ? walletOptionList : undefined}
              selectedWallets={selectedWallets}
              walletButtonLabel={walletButtonLabel}
              toggleWalletSelection={
                walletDropdownVisible ? toggleWalletSelection : undefined
              }
              selectAllWallets={
                walletDropdownVisible ? selectAllWallets : undefined
              }
              resetWalletSelection={
                walletDropdownVisible ? resetWalletSelection : undefined
              }
              walletLimitReached={
                walletDropdownVisible ? walletLimitReached : undefined
              }
              walletLimit={walletDropdownVisible ? walletLimit : undefined}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-xs uppercase text-slate-500 tracking-wide">
                Loaded transactions
              </p>
              <p className="text-2xl font-semibold text-slate-900">
                {stats.capitalGainsSummary.transactionsCount.toLocaleString()}
              </p>
              <p className="text-xs text-slate-500">
                Page {cache.page} · {filters.networksButtonLabel}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-xs uppercase text-slate-500 tracking-wide">
                Coverage vs estimate
              </p>
              <p className="text-2xl font-semibold text-slate-900">
                {coveragePct != null
                  ? `${Math.round(coveragePct * 100)}%`
                  : "—"}
              </p>
              {totalCount && (
                <p className="text-xs text-slate-500">
                  {stats.capitalGainsSummary.transactionsCount.toLocaleString()}{" "}
                  / {totalCount.toLocaleString()}
                </p>
              )}
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-xs uppercase text-slate-500 tracking-wide">
                Current selection value
              </p>
              <p className="text-2xl font-semibold text-slate-900">
                {totalAssetsUsd != null ? fmtUSD(totalAssetsUsd) : "—"}
              </p>
              <p className="text-xs text-slate-500">
                Based on latest overview snapshot
              </p>
            </div>
          </div>

          {filters.datePreset === "custom" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs text-slate-600 font-medium flex flex-col gap-1">
                <span>From</span>
                <input
                  type="date"
                  value={filters.customFrom}
                  onChange={(event) =>
                    filters.setCustomFrom(event.currentTarget.value)
                  }
                  className="rounded border border-slate-200 px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200"
                />
              </label>
              <label className="text-xs text-slate-600 font-medium flex flex-col gap-1">
                <span>To</span>
                <input
                  type="date"
                  value={filters.customTo}
                  onChange={(event) =>
                    filters.setCustomTo(event.currentTarget.value)
                  }
                  className="rounded border border-slate-200 px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200"
                />
              </label>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm font-semibold text-slate-800">
                Transaction types
              </p>
              {!filters.filterIsAll && (
                <button
                  type="button"
                  className="text-xs text-slate-500 underline"
                  onClick={() => filters.toggleType("all", true)}
                >
                  Clear filters
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div className="flex items-center space-x-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                <Checkbox
                  id="type-all"
                  checked={(filters.selectedTypes as any)[0] === "all"}
                  onCheckedChange={(c) => filters.toggleType("all", !!c)}
                  disabled={cache.loading || filters.isOnlyAllSelected}
                />
                <Label htmlFor="type-all" className="text-sm font-medium">
                  All types
                </Label>
              </div>
              {["income", "expense", "swap", "gas"].map((t) => (
                <div
                  key={t}
                  className="flex items-center space-x-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
                >
                  <Checkbox
                    id={`type-${t}`}
                    checked={
                      Array.isArray(filters.selectedTypes) &&
                      (filters.selectedTypes as any)[0] !== "all"
                        ? (filters.selectedTypes as TxType[]).includes(
                            t as TxType
                          )
                        : false
                    }
                    onCheckedChange={(c) =>
                      filters.toggleType(t as TxType, !!c)
                    }
                    disabled={cache.loading}
                  />
                  <Label
                    htmlFor={`type-${t}`}
                    className="text-sm font-medium capitalize flex items-center gap-1"
                  >
                    {typeIcon(t as TxType)} {t}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100">
          <TransactionTable
            address={activeWallets.length ? exportLabel : null}
            rows={cache.rows}
            loading={cache.loading}
            error={cache.error}
            visibleColumns={filters.visibleColumns}
            visibleColumnsInit={filters.visibleColumnsInit}
            canPrev={canPrev}
            canNext={canNext}
            goPrev={goPrev}
            goNext={goNext}
            walletLabels={walletLabelLookup}
          />
        </div>
      </Card>

    </div>
  );
}
