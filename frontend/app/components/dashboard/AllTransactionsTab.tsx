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
import { typeIcon, shortAddr } from "@/utils/transactionHelpers";

const DEFAULT_MULTI_WALLET_LIMIT = Number(
  process.env.NEXT_PUBLIC_DASHBOARD_MULTI_LIMIT ?? 3
);

const WALLET_COLOR_PALETTE = [
  "#6366f1",
  "#f97316",
  "#0ea5e9",
  "#14b8a6",
  "#ec4899",
  "#84cc16",
];

interface WalletOption {
  address: string;
  label: string;
  color?: string;
}

interface AllTransactionsTabProps {
  address?: string;
  networks?: string; // comma-separated override; omit to use UI-managed selection
  walletOptions?: WalletOption[];
  walletLimit?: number;
}

export default function AllTransactionsTab({
  address: propAddress,
  networks: propNetworks,
  walletOptions,
  walletLimit = DEFAULT_MULTI_WALLET_LIMIT,
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
  const walletOptionList = useMemo(() => {
    if (!walletOptions?.length) return [];
    return walletOptions.map((wallet, idx) => ({
      ...wallet,
      label: wallet.label || shortAddr(wallet.address),
      color:
        wallet.color ??
        WALLET_COLOR_PALETTE[idx % WALLET_COLOR_PALETTE.length],
    }));
  }, [walletOptions]);
  const [selectedWallets, setSelectedWallets] = useState<string[]>(() =>
    walletOptions && walletOptions.length
      ? walletOptions.map((wallet) => wallet.address)
      : propAddress
      ? [propAddress]
      : []
  );

  useEffect(() => {
    if (walletOptionList.length) {
      setSelectedWallets((prev) => {
        const valid = prev.filter((addr) =>
          walletOptionList.some((wallet) => wallet.address === addr)
        );
        if (valid.length) return valid;
        return walletOptionList
          .map((wallet) => wallet.address)
          .slice(0, walletLimit);
      });
    } else if (propAddress) {
      setSelectedWallets([propAddress]);
    } else {
      setSelectedWallets([]);
    }
  }, [walletOptionList, walletLimit, propAddress]);

  const activeWallets = selectedWallets.length
    ? selectedWallets
    : address
    ? [address]
    : [];

  const walletDropdownVisible = walletOptionList.length > 1;
  const walletSelectionCount = selectedWallets.length;
  const walletLimitReached = walletSelectionCount >= walletLimit;

  const walletMap = useMemo(() => {
    const map = new Map<string, WalletOption & { color?: string }>();
    walletOptionList.forEach((wallet) => {
      map.set(wallet.address, wallet);
      map.set(wallet.address.toLowerCase(), wallet);
    });
    return map;
  }, [walletOptionList]);

  const walletLabelLookup = useMemo(() => {
    const lookup: Record<string, { label: string; color?: string }> = {};
    walletOptionList.forEach((wallet) => {
      lookup[wallet.address.toLowerCase()] = {
        label: wallet.label,
        color: wallet.color,
      };
    });
    return lookup;
  }, [walletOptionList]);

  const walletButtonLabel = useMemo(() => {
    if (!walletDropdownVisible) {
      const single = activeWallets[0];
      const meta = single ? walletMap.get(single) : null;
      return meta?.label || (single ? shortAddr(single) : "Wallet");
    }
    if (!walletSelectionCount) {
      return "None selected";
    }
    if (walletSelectionCount === walletOptionList.length) {
      return "All wallets";
    }
    if (walletSelectionCount === 1) {
      const meta = walletMap.get(selectedWallets[0]);
      return meta?.label || shortAddr(selectedWallets[0]);
    }
    const first = walletMap.get(selectedWallets[0]);
    const baseLabel = first?.label || shortAddr(selectedWallets[0]);
    return `${baseLabel} +${walletSelectionCount - 1}`;
  }, [
    walletDropdownVisible,
    walletSelectionCount,
    walletOptionList.length,
    activeWallets,
    walletMap,
    selectedWallets,
  ]);

  const toggleWalletSelection = (addr: string, checked: boolean) => {
    setSelectedWallets((prev) => {
      if (checked) {
        if (prev.includes(addr)) return prev;
        if (walletLimitReached) return prev;
        return [...prev, addr];
      }
      return prev.filter((item) => item !== addr);
    });
  };

  const selectAllWallets = () => {
    if (!walletOptionList.length) return;
    setSelectedWallets(
      walletOptionList.map((wallet) => wallet.address).slice(0, walletLimit)
    );
  };

  const resetWalletSelection = () => {
    if (!walletOptionList.length) return;
    setSelectedWallets(
      walletOptionList.map((wallet) => wallet.address).slice(0, walletLimit)
    );
  };

  const exportLabel = useMemo(() => {
    if (activeWallets.length === 1) {
      return shortAddr(activeWallets[0]);
    }
    if (activeWallets.length > 1) {
      return `${activeWallets.length}-wallets`;
    }
    return "wallets";
  }, [activeWallets]);

  // Filters hook
  const filters = useTransactionFilters(propNetworks);

  // Cache hook
  const cache = useTransactionCache({
    addresses: activeWallets,
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

  // Navigation buttons - now work with filters since filtering is done client-side
  const canPrev = cache.page > 1;
  const canNext =
    cache.hasNext && !(cache.loading && cache.page >= cache.maxLoadedPage);
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
        address: address
          ? `${address.slice(0, 6)}...${address.slice(-4)}`
          : "none",
        error: cache.error.slice(0, 100),
      });
    }
  }, [cache.error, address]);

  return (
    <div className="space-y-6">
      {activeWallets.length > 0 && (
        <CapitalGainsSnapshot
          address={exportLabel}
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
              All Transactions {activeWallets.length ? "" : "(select a wallet)"}
            </h3>
            {walletOptionList.length > 0 && activeWallets.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {activeWallets.map((walletAddress) => {
                  const meta =
                    walletMap.get(walletAddress) ||
                    walletMap.get(walletAddress.toLowerCase());
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
              walletOptions={
                walletDropdownVisible ? walletOptionList : undefined
              }
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

          {filters.datePreset === "custom" && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
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

          {/* Filter chips (server-side class filter) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="type-all"
                checked={(filters.selectedTypes as any)[0] === "all"}
                onCheckedChange={(c) => filters.toggleType("all", !!c)}
                disabled={cache.loading || filters.isOnlyAllSelected}
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
                      ? (filters.selectedTypes as TxType[]).includes(
                          t as TxType
                        )
                      : false
                  }
                  onCheckedChange={(c) => filters.toggleType(t as TxType, !!c)}
                  disabled={cache.loading}
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
      </Card>
    </div>
  );
}
