import { useEffect, useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { TxType } from "@/lib/types/transactions";
import { useTransactionFilters } from "@/hooks/useTransactionFilters";
import { useTransactionCache } from "@/hooks/useTransactionCache";
import { useTransactionStats } from "@/hooks/useTransactionStats";
import { CapitalGainsSnapshot } from "./CapitalGainsSnapshot";
import { TransactionToolbar } from "./TransactionToolbar";
import { TransactionTable } from "./TransactionTable";
import { typeIcon } from "@/utils/transactionHelpers";

interface AllTransactionsTabProps {
  address?: string;
  networks?: string; // comma-separated override; omit to use UI-managed selection
}

export default function AllTransactionsTab({
  address: propAddress,
  networks: propNetworks,
}: AllTransactionsTabProps) {
  // Use prop address if provided, otherwise read from URL
  const [address, setAddress] = useState<string>(propAddress || "");

  useEffect(() => {
    if (propAddress) {
      setAddress(propAddress);
    } else {
      const urlParams = new URLSearchParams(window.location.search);
      setAddress(urlParams.get("address") || "");
    }
  }, [propAddress]);

  const [refreshKey, setRefreshKey] = useState(0);

  // Filters hook
  const filters = useTransactionFilters(propNetworks);

  // Cache hook
  const cache = useTransactionCache({
    address,
    selectedTypes: filters.selectedTypes,
    networksParam: filters.networksParam,
    dateRange: filters.dateRange,
    dateRangeKey: filters.dateRangeKey,
    selectedTypesKey: filters.selectedTypesKey,
    refreshKey,
  });

  // Stats hook
  const stats = useTransactionStats(cache.loadedRowsAll);

  // Use total from backend (Covalent) if available, otherwise fallback to estimation
  const totalCount = useMemo(() => {
    if (cache.total !== null) return cache.total; // Use real total from backend
    // Fallback to estimation if backend total not available
    if (cache.rows.length === 0) return null;
    if (cache.hasNext) {
      return cache.page * 20; // At least this many
    } else {
      return (cache.page - 1) * 20 + cache.rows.length; // Exact count
    }
  }, [cache.total, cache.page, cache.hasNext, cache.rows.length]);

  // Check if there are no transactions (after loading is complete and no error)
  const hasNoTransactions = cache.rows.length === 0 && !cache.loading && !cache.error && address !== "";

  // Navigation buttons - now work with filters since filtering is done client-side
  const canPrev = cache.page > 1;
  const canNext = cache.hasNext;
  const goPrev = () => {
    const p = Math.max(1, cache.page - 1);
    cache.setPage(p);
    cache.load(p);
  };
  const goNext = () => {
    const p = cache.page + 1;
    cache.setPage(p);
    cache.load(p);
  };

  // Log only significant state changes (errors or page changes)
  useEffect(() => {
    if (cache.error) {
      console.error("[AllTransactionsTab] Error:", {
        address: address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "none",
        error: cache.error.slice(0, 100),
      });
    }
  }, [cache.error, address]);

  return (
    <div className="space-y-6">
      {address && (
        <CapitalGainsSnapshot
          address={address}
          loadedTransactionsCount={stats.capitalGainsSummary.transactionsCount}
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

      <Card className="bg-white shadow-sm">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-slate-800">
              All Transactions {address ? "" : "(load an address)"}
            </h3>
            <TransactionToolbar
              address={address || ""}
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
              hasNoTransactions={hasNoTransactions}
            />
          </div>

          {filters.datePreset === "custom" && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-xs text-slate-600 font-medium flex flex-col gap-1">
                <span>From</span>
                <input
                  type="date"
                  value={filters.customFrom}
                  onChange={(event) => filters.setCustomFrom(event.currentTarget.value)}
                  className="rounded border border-slate-200 px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200"
                />
              </label>
              <label className="text-xs text-slate-600 font-medium flex flex-col gap-1">
                <span>To</span>
                <input
                  type="date"
                  value={filters.customTo}
                  onChange={(event) => filters.setCustomTo(event.currentTarget.value)}
                  className="rounded border border-slate-200 px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200"
                />
              </label>
            </div>
          )}

          {/* Filter chips (server-side class filter) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="type-all"
                checked={(filters.selectedTypes as any)[0] === "all"}
                onCheckedChange={(c) => filters.toggleType("all", !!c)}
                disabled={cache.loading || filters.isOnlyAllSelected || hasNoTransactions}
              />
              <Label htmlFor="type-all" className="text-sm font-normal">
                All Types
              </Label>
            </div>
            {["income", "expense", "swap", "gas"].map((t) => (
              <div key={t} className="flex items-center space-x-2">
                <Checkbox
                  id={`type-${t}`}
                  checked={
                    Array.isArray(filters.selectedTypes) &&
                    (filters.selectedTypes as any)[0] !== "all"
                      ? (filters.selectedTypes as TxType[]).includes(t as TxType)
                      : false
                  }
                  onCheckedChange={(c) => filters.toggleType(t as TxType, !!c)}
                  disabled={cache.loading || hasNoTransactions}
                />
                <Label
                  htmlFor={`type-${t}`}
                  className="text-sm font-normal capitalize flex items-center gap-1"
                >
                  {typeIcon(t as TxType)} {t}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <TransactionTable
          address={address}
          rows={cache.rows}
          loading={cache.loading}
          error={cache.error}
          visibleColumns={filters.visibleColumns}
          visibleColumnsInit={filters.visibleColumnsInit}
          canPrev={canPrev}
          canNext={canNext}
          goPrev={goPrev}
          goNext={goNext}
        />
      </Card>
    </div>
  );
}
