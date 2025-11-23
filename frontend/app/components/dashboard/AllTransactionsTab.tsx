import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { TxType } from "@/lib/types/transactions";
import type { TxRow } from "@/lib/types/transactions";
import { CapitalGainsSnapshot } from "./CapitalGainsSnapshot";
import { TransactionToolbar } from "./TransactionToolbar";
import { TransactionTable } from "./TransactionTable";
import FinancialRatiosPanel from "./FinancialRatiosPanel";
import { typeIcon, shortAddr, fmtUSD, PAGE_SIZE } from "@/utils/transactionHelpers";
import { useTransactionsWorkspace } from "./TransactionsWorkspaceProvider";
import { generateFinancialReport } from "@/utils/financialReport";
import { Search, X } from "lucide-react";

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
  const loadedTxCount = cache.loadedRowsAll.length;
  const coveragePct = useMemo(() => {
    if (!totalCount || totalCount <= 0) return null;
    if (!loadedTxCount || loadedTxCount <= 0) return 0;
    return Math.min(1, loadedTxCount / totalCount);
  }, [totalCount, loadedTxCount]);

  // Search state
  const [searchType, setSearchType] = useState<"hash" | "address" | "amount">("hash");
  const [searchValue, setSearchValue] = useState<string>("");
  const [activeSearchValue, setActiveSearchValue] = useState<string>("");
  const [activeSearchType, setActiveSearchType] = useState<"hash" | "address" | "amount">("hash");

  // Helper function to normalize address/hash for comparison
  const normalizeAddress = (addr: string | null | undefined): string => {
    if (!addr) return "";
    return addr.toLowerCase().replace(/^0x/, "");
  };

  // Helper function to extract search patterns from truncated format (e.g., "0x4809...a413" or "0x4809…a413")
  const extractSearchPatterns = (search: string): string[] => {
    const trimmed = search.trim().toLowerCase();
    const patterns: Set<string> = new Set([trimmed]);
    
    // Handle truncated format - support both "..." and "…" (Unicode ellipsis)
    const hasEllipsis = trimmed.includes("...") || trimmed.includes("…");
    
    if (hasEllipsis) {
      // Split by either "..." or "…"
      const parts = trimmed.split(/\.\.\.|…/);
      if (parts.length === 2) {
        const start = parts[0].replace(/^0x/, "").trim();
        const end = parts[1].trim();
        
        // Add patterns: full with 0x, full without 0x, start only, end only
        if (start && end) {
          // Try to reconstruct full hash
          patterns.add(`0x${start}${end}`);
          patterns.add(`${start}${end}`);
        }
        // Add start pattern (first few chars) - minimum 4 chars for reliable matching
        if (start && start.length >= 4) {
          patterns.add(start);
          patterns.add(`0x${start}`);
        }
        // Add end pattern (last few chars) - minimum 4 chars
        if (end && end.length >= 4) {
          patterns.add(end);
          patterns.add(`0x${end}`);
        }
        // Also add concatenated without 0x (for partial matching in middle of hash)
        if (start && end) {
          patterns.add(start + end);
        }
      }
    } else {
      // Normal case: add with and without 0x
      const without0x = trimmed.replace(/^0x/, "");
      if (without0x && without0x.length > 0) {
        patterns.add(without0x);
      }
      if (!trimmed.startsWith("0x") && trimmed.length > 0) {
        patterns.add(`0x${trimmed}`);
      }
      // Also add the trimmed value as-is
      if (trimmed.length > 0) {
        patterns.add(trimmed);
      }
    }
    
    // Remove empty patterns and ensure minimum length of 2 chars
    const result = Array.from(patterns).filter(p => p && p.length >= 2);
    
    if (process.env.NODE_ENV === "development") {
      console.log("[Search] Extracted patterns from", search, ":", result);
    }
    
    return result;
  };

  // Filter transactions based on search
  const filteredRows = useMemo(() => {
    if (!activeSearchValue.trim()) {
      return cache.rows;
    }

    const searchPatterns = extractSearchPatterns(activeSearchValue);

    // Search in all loaded transactions, not just current page
    // Use loadedRowsAll if available and has data, otherwise fall back to rows
    let transactionsToSearch: TxRow[] = [];
    
    if (cache.loadedRowsAll && cache.loadedRowsAll.length > 0) {
      transactionsToSearch = cache.loadedRowsAll;
    } else if (cache.rows && cache.rows.length > 0) {
      transactionsToSearch = cache.rows;
    }

    if (!transactionsToSearch || transactionsToSearch.length === 0) {
      return [];
    }

    // Debug: log search info
    if (process.env.NODE_ENV === "development") {
      console.log("[Search] Searching for:", {
        type: activeSearchType,
        value: activeSearchValue,
        patterns: searchPatterns,
        totalTransactions: transactionsToSearch.length,
        sampleHash: transactionsToSearch[0]?.hash,
      });
    }

    const filtered = transactionsToSearch.filter((tx: TxRow) => {
      if (!tx) return false;

      // Normalize search value once for all cases
      const searchValueLower = activeSearchValue.trim().toLowerCase();

      switch (activeSearchType) {
        case "hash":
          if (!tx.hash) return false;
          const txHashLower = tx.hash.toLowerCase();
          const txHashWithout0x = txHashLower.replace(/^0x/, "");
          
          // For truncated format (e.g., "0x4809...a413"), check if hash starts with start part AND ends with end part
          if (searchValueLower.includes("...") || searchValueLower.includes("…")) {
            const parts = searchValueLower.split(/\.\.\.|…/);
            if (parts.length === 2) {
              const startPart = parts[0].replace(/^0x/, "").trim();
              const endPart = parts[1].trim();
              // Hash must start with start part AND end with end part - EXACT match
              if (startPart && endPart) {
                const hashStarts = txHashWithout0x.startsWith(startPart);
                const hashEnds = txHashWithout0x.endsWith(endPart);
                const match = hashStarts && hashEnds;
                
                if (process.env.NODE_ENV === "development" && match) {
                  console.log("[Search] Hash match (truncated):", {
                    searchValue: activeSearchValue,
                    startPart,
                    endPart,
                    txHash: txHashLower,
                    match
                  });
                }
                return match;
              }
            }
          }
          
          // For full hash or partial hash (without ellipsis), check exact match or start/end match
          const searchWithout0x = searchValueLower.replace(/^0x/, "");
          
          // If it's a full hash (64+ chars), require exact match
          if (searchWithout0x.length >= 64) {
            const exactMatch = txHashWithout0x === searchWithout0x || txHashLower === searchValueLower;
            if (process.env.NODE_ENV === "development" && exactMatch) {
              console.log("[Search] Hash match (exact):", {
                searchValue: activeSearchValue,
                txHash: txHashLower,
                match: exactMatch
              });
            }
            return exactMatch;
          }
          
          // For partial hash, check if hash starts OR ends with the pattern (not contains!)
          const startsWith = txHashWithout0x.startsWith(searchWithout0x) || txHashLower.startsWith(searchValueLower);
          const endsWith = txHashWithout0x.endsWith(searchWithout0x) || txHashLower.endsWith(searchValueLower);
          const hashMatch = startsWith || endsWith;
          
          if (process.env.NODE_ENV === "development" && hashMatch) {
            console.log("[Search] Hash match (partial):", {
              searchValue: activeSearchValue,
              txHash: txHashLower,
              startsWith,
              endsWith,
              match: hashMatch
            });
          }
          
          return hashMatch;
          
        case "address":
          const addressesToCheck: string[] = [];
          
          if (tx.counterparty?.address) {
            addressesToCheck.push(tx.counterparty.address.toLowerCase());
            addressesToCheck.push(normalizeAddress(tx.counterparty.address));
          }
          
          if (tx.walletAddress) {
            addressesToCheck.push(tx.walletAddress.toLowerCase());
            addressesToCheck.push(normalizeAddress(tx.walletAddress));
          }
          
          if (tx.asset?.contract) {
            addressesToCheck.push(tx.asset.contract.toLowerCase());
            addressesToCheck.push(normalizeAddress(tx.asset.contract));
          }
          
          // Check each address
          const addressMatch = addressesToCheck.some(addr => {
            if (!addr) return false;
            const addrWithout0x = addr.replace(/^0x/, "");
            
            // For truncated format (e.g., "0x7f58...33ec"), check start AND end - EXACT match
            if (searchValueLower.includes("...") || searchValueLower.includes("…")) {
              const parts = searchValueLower.split(/\.\.\.|…/);
              if (parts.length === 2) {
                const startPart = parts[0].replace(/^0x/, "").trim();
                const endPart = parts[1].trim();
                if (startPart && endPart) {
                  return addrWithout0x.startsWith(startPart) && addrWithout0x.endsWith(endPart);
                }
              }
            }
            
            // For full address (42 chars with 0x, or 40 without), require exact match
            const searchWithout0x = searchValueLower.replace(/^0x/, "");
            if (searchWithout0x.length >= 40) {
              return addrWithout0x === searchWithout0x || addr === searchValueLower;
            }
            
            // For partial address, check if address starts OR ends with the pattern (not contains!)
            return addrWithout0x.startsWith(searchWithout0x) ||
                   addr.startsWith(searchValueLower) ||
                   addrWithout0x.endsWith(searchWithout0x) ||
                   addr.endsWith(searchValueLower);
          });
          
          if (process.env.NODE_ENV === "development" && addressMatch) {
            console.log("[Search] Address match found:", {
              searchValue: activeSearchValue,
              addresses: addressesToCheck
            });
          }
          
          return addressMatch;
          
        case "amount":
          // Clean the search value: replace comma with dot, remove spaces and currency symbols
          let cleanedSearch = activeSearchValue.trim();
          // Replace comma with dot for decimal separator
          cleanedSearch = cleanedSearch.replace(/,/g, ".");
          // Remove currency symbols and spaces
          cleanedSearch = cleanedSearch.replace(/[$€£¥\s]/g, "");
          // Keep only digits and dots
          cleanedSearch = cleanedSearch.replace(/[^\d.]/g, "");
          
          const searchAmount = parseFloat(cleanedSearch);
          if (isNaN(searchAmount) || searchAmount < 0) {
            if (process.env.NODE_ENV === "development") {
              console.log("[Search] Invalid amount:", {
                searchValue: activeSearchValue,
                cleanedSearch,
                searchAmount
              });
            }
            return false;
          }
          
          // For exact amount search, allow small difference for floating point precision
          // Use 0.005 tolerance (half a cent) to account for rounding
          // Check both usdAtTs and fee.usdAtTs
          const usdMatch = tx.usdAtTs != null && Math.abs(tx.usdAtTs - searchAmount) < 0.005;
          const feeMatch = tx.fee?.usdAtTs != null && Math.abs(tx.fee.usdAtTs - searchAmount) < 0.005;
          
          if (process.env.NODE_ENV === "development") {
            if (usdMatch || feeMatch) {
              console.log("[Search] Amount match found:", {
                searchValue: activeSearchValue,
                cleanedSearch,
                searchAmount,
                txUsdAtTs: tx.usdAtTs,
                feeUsdAtTs: tx.fee?.usdAtTs,
                usdDiff: tx.usdAtTs != null ? Math.abs(tx.usdAtTs - searchAmount) : null,
                feeDiff: tx.fee?.usdAtTs != null ? Math.abs(tx.fee.usdAtTs - searchAmount) : null,
                usdMatch,
                feeMatch
              });
            }
            // Log first few transactions for debugging
            if (transactionsToSearch.indexOf(tx) < 3) {
              console.log("[Search] Checking transaction:", {
                txUsdAtTs: tx.usdAtTs,
                feeUsdAtTs: tx.fee?.usdAtTs,
                searchAmount,
                usdMatch,
                feeMatch
              });
            }
          }
          
          return usdMatch || feeMatch;
          
        default:
          return true;
      }
    });

    if (process.env.NODE_ENV === "development") {
      console.log("[Search] Results:", {
        found: filtered.length,
        searched: transactionsToSearch.length
      });
    }

    return filtered;
  }, [cache.rows, cache.loadedRowsAll, activeSearchType, activeSearchValue]);

  // Handle search button click
  const handleSearch = () => {
    setActiveSearchValue(searchValue);
    setActiveSearchType(searchType);
  };

  // Handle Enter key in search input
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  // Check if there are no transactions at all in the wallet (after loading is complete and no error)
  // This is different from "no transactions match current filter" (which would have loadedRowsAll.length > 0)
  const hasNoTransactions =
    cache.loadedRowsAll.length === 0 &&
    !cache.loading &&
    !cache.error &&
    activeWallets.length > 0;

  const pageStart = (cache.page - 1) * PAGE_SIZE + 1;
  const pageEnd = pageStart + filteredRows.length - 1;

  useEffect(() => {
    if (cache.error) {
      if (process.env.NODE_ENV === 'development') {
        console.error("[AllTransactionsTab] Error:", {
          address: address
            ? `${address.slice(0, 6)}...${address.slice(-4)}`
            : "none",
          error: cache.error.slice(0, 100),
        });
      }
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
            loadedTransactionsCount={loadedTxCount}
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
            loadedRowsAll={cache.loadedRowsAll}
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
            hasNoTransactions={hasNoTransactions}
            stats={stats}
            totalAssetsUsd={totalAssetsUsd}
            stableHoldingsUsd={stableHoldingsUsd}
            totalCount={totalCount}
            onExportReport={(format) => {
              generateFinancialReport(
                {
                  transactions: cache.loadedRowsAll,
                  stats,
                    dateRangeLabel: filters.dateRange.label,
                    exportLabel,
                    totalAssetsUsd,
                    stableHoldingsUsd,
                    totalCount,
                    loadedTxCount,
                    activeWallets,
                    walletLabelLookup,
                  },
                  format
                );
              }}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-xs uppercase text-slate-500 tracking-wide">
                Loaded transactions
              </p>
              <p className="text-2xl font-semibold text-slate-900">
                {loadedTxCount.toLocaleString()}
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
                  {loadedTxCount.toLocaleString()}{" "}
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
                Search transactions
              </p>
              {activeSearchValue && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchValue("");
                    setActiveSearchValue("");
                  }}
                  className="text-xs text-slate-500 underline flex items-center gap-1 hover:text-slate-700"
                >
                  <X className="w-3 h-3" />
                  Clear
                </button>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 min-w-[200px]">
                <Select
                  value={searchType}
                  onValueChange={(value: "hash" | "address" | "amount") =>
                    setSearchType(value)
                  }
                >
                  <SelectTrigger className="h-10 bg-white border-slate-200">
                    <SelectValue placeholder="Select a field" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hash">Transaction hash</SelectItem>
                    <SelectItem value="address">Destination address</SelectItem>
                    <SelectItem value="amount">Exact amount (USD)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder={
                    searchType === "hash"
                      ? "Ex: 0x4809...a413 or full hash"
                      : searchType === "address"
                      ? "Ex: 0x7f58...33ec or full address"
                      : "Enter the exact amount in USD..."
                  }
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="pl-10 bg-white border-slate-200"
                />
              </div>
              <Button
                onClick={handleSearch}
                className="h-10 bg-slate-800 hover:bg-slate-900 text-white"
                disabled={!searchValue.trim()}
              >
                <Search className="w-4 h-4 mr-2" />
                Search
              </Button>
            </div>
            {activeSearchValue && (
              <p className="text-xs text-slate-500">
                {filteredRows.length} transaction{filteredRows.length !== 1 ? "s" : ""} found
              </p>
            )}
          </div>

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
                  disabled={
                    cache.loading ||
                    filters.isOnlyAllSelected ||
                    hasNoTransactions
                  }
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
                    disabled={cache.loading || hasNoTransactions}
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
            rows={filteredRows}
            page={cache.page}
            loading={cache.loading}
            error={cache.error}
            visibleColumns={filters.visibleColumns}
            visibleColumnsInit={filters.visibleColumnsInit}
            canPrev={canPrev}
            canNext={canNext}
            goPrev={goPrev}
            goNext={goNext}
            walletLabels={walletLabelLookup}
            loadedRowsAll={cache.loadedRowsAll}
          />
        </div>
        <div className="flex flex-col items-center gap-2 px-6 py-4 border-t border-slate-100 bg-white">
          <p className="text-xs text-slate-600">
            {filteredRows.length > 0
              ? `Page ${cache.page} • ${pageStart.toLocaleString()}–${pageEnd.toLocaleString()} of ${
                  totalCount
                    ? `${totalCount.toLocaleString()} total`
                    : `${loadedTxCount.toLocaleString()} loaded`
                }`
              : `Page ${cache.page} • No rows on this page${
                  totalCount ? ` (out of ${totalCount.toLocaleString()})` : ""
                }`}
          </p>
          <div className="flex justify-center gap-3">
            <Button
              variant="outline"
              onClick={goPrev}
              disabled={!canPrev || cache.loading}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              onClick={goNext}
              disabled={!canNext || cache.loading}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

