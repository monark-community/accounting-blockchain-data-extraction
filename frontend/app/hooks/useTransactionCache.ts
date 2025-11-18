import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import type { TxRow, TxType } from "@/lib/types/transactions";
import { fetchTransactions } from "@/lib/api/transactions";
import { PAGE_SIZE } from "@/utils/transactionHelpers";

interface UseTransactionCacheParams {
  address: string | null;
  selectedTypes: TxType[] | ["all"];
  networksParam?: string;
  dateRange: { from?: string; to?: string; label: string };
  dateRangeKey: string;
  selectedTypesKey: string;
  refreshKey: number;
}

/**
 * Simplified transaction cache hook
 * - Single cache: all transactions (all types, all networks, all dates) per address:dateRange
 * - On-the-fly filtering: type, network, year
 * - On-the-fly pagination: slice on filtered transactions
 * - Progressive loading: fetch until we have enough filtered transactions
 */
export function useTransactionCache({
  address,
  selectedTypes,
  networksParam,
  dateRange,
  dateRangeKey,
  selectedTypesKey,
  refreshKey,
}: UseTransactionCacheParams) {
  // State
  const [rows, setRows] = useState<TxRow[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [cacheVersion, setCacheVersion] = useState(0);

  // Cache: all transactions per address:dateRange (no network/type filtering)
  // Key: "address:dateRange"
  const rawTransactionsCache = useRef(new Map<string, TxRow[]>());

  // Cursors per network: track pagination for each network separately
  // Key: "address:dateRange:network" -> cursor string | null
  const networkCursors = useRef(new Map<string, string | null>());

  // Track which networks have been fully loaded (no more data available)
  // Key: "address:dateRange:network" -> boolean
  const networkFullyLoaded = useRef(new Map<string, boolean>());

  // Track total count from backend (if available)
  // Key: "address:dateRange" -> number | null
  const totalCountCache = useRef(new Map<string, number | null>());

  // Track previous selectedTypesKey to detect filter changes
  const prevSelectedTypesKeyRef = useRef<string | null>(null);

  // ============================================================================
  // Cache Key Helpers
  // ============================================================================

  const getBaseCacheKey = useCallback(
    (addr: string) => `${addr}:${dateRangeKey}`,
    [dateRangeKey]
  );

  const getNetworkCacheKey = useCallback(
    (addr: string, network: string) => `${addr}:${dateRangeKey}:${network}`,
    [dateRangeKey]
  );

  const namespaceKey = useMemo(
    () => (address ? getBaseCacheKey(address) : null),
    [address, getBaseCacheKey]
  );

  // ============================================================================
  // Filtering Helpers
  // ============================================================================

  /**
   * Check if a transaction matches the type filter
   */
  const matchesTypeFilter = useCallback(
    (tx: TxRow): boolean => {
      if (!Array.isArray(selectedTypes)) return false;
      if (selectedTypes.length === 1 && selectedTypes[0] === "all") {
        return true;
      }
      return (selectedTypes as TxType[]).includes(tx.type);
    },
    [selectedTypes]
  );

  /**
   * Check if a transaction matches the network filter
   */
  const matchesNetworkFilter = useCallback(
    (tx: TxRow, selectedNetworks: string[]): boolean => {
      if (selectedNetworks.length === 0) return true;
      return selectedNetworks.includes(tx.network);
    },
    []
  );

  /**
   * Filter transactions based on current filters
   * Note: Date filtering is handled server-side via API, so we only filter by type and network
   */
  const filterTransactions = useCallback(
    (allTransactions: TxRow[], selectedNetworks: string[]): TxRow[] => {
      return allTransactions.filter(
        (tx) =>
          matchesTypeFilter(tx) && matchesNetworkFilter(tx, selectedNetworks)
      );
    },
    [matchesTypeFilter, matchesNetworkFilter]
  );

  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * Sort transactions by timestamp (descending - newest first)
   */
  const sortTransactionsByDate = useCallback((transactions: TxRow[]): TxRow[] => {
    return [...transactions].sort((a, b) => {
      const tsA = new Date(a.ts).getTime();
      const tsB = new Date(b.ts).getTime();
      return tsB - tsA; // Descending
    });
  }, []);

  /**
   * Add new transactions to cache and sort
   */
  const addToCache = useCallback(
    (baseKey: string, newTransactions: TxRow[]) => {
      const existing = rawTransactionsCache.current.get(baseKey) || [];
      
      // Deduplicate: use hash + direction + asset + qty + timestamp as key
      const dedup = new Map<string, TxRow>();
      [...existing, ...newTransactions].forEach((tx) => {
        const key = `${tx.hash}:${tx.direction}:${
          tx.asset?.symbol ?? tx.asset?.contract ?? "asset"
        }:${tx.qty}:${tx.ts}`;
        if (!dedup.has(key)) {
          dedup.set(key, tx);
        }
      });

      const allTransactions = Array.from(dedup.values());
      const sorted = sortTransactionsByDate(allTransactions);
      rawTransactionsCache.current.set(baseKey, sorted);
      setCacheVersion((v) => v + 1);
    },
    [sortTransactionsByDate]
  );

  /**
   * Get selected networks array from networksParam
   */
  const getSelectedNetworks = useCallback((): string[] => {
    if (!networksParam) return [];
    return networksParam.split(",").map((n) => n.trim()).filter(Boolean);
  }, [networksParam]);

  // ============================================================================
  // Data Loading
  // ============================================================================

  /**
   * Fetch transactions for a specific network
   */
  const fetchNetworkTransactions = useCallback(
    async (
      addr: string,
      network: string,
      cursor: string | null
    ): Promise<{ rows: TxRow[]; hasNext: boolean; nextCursor: string | null; total: number | null }> => {
      const resp = await fetchTransactions(addr, {
        networks: network,
        page: 1,
        limit: PAGE_SIZE,
        minUsd: 0,
        spamFilter: "hard",
        ...(cursor ? { cursor } : {}),
        ...(dateRange.from ? { from: dateRange.from } : {}),
        ...(dateRange.to ? { to: dateRange.to } : {}),
      });

      return {
        rows: resp.rows,
        hasNext: resp.hasNext,
        nextCursor: resp.nextCursor,
        total: (resp as any)?.total ?? null,
      };
    },
    [dateRange]
  );

  /**
   * Load transactions for all selected networks (progressive loading)
   * @param neededCount - Minimum number of filtered transactions needed
   */
  const loadTransactions = useCallback(
    async (addr: string, selectedNetworks: string[], neededCount: number, retryCount = 0): Promise<void> => {
      if (selectedNetworks.length === 0) return;
      if (retryCount > 20) return; // Prevent infinite loops

      const baseKey = getBaseCacheKey(addr);
      const allTransactions = rawTransactionsCache.current.get(baseKey) || [];

      // Filter current cache to see how many match
      const filtered = filterTransactions(allTransactions, selectedNetworks);

      // If we have enough, no need to fetch
      if (filtered.length >= neededCount) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Fetch from each network that hasn't been fully loaded
        const fetchPromises: Promise<void>[] = [];
        let hasNewData = false;

        for (const network of selectedNetworks) {
          const networkKey = getNetworkCacheKey(addr, network);
          const isFullyLoaded = networkFullyLoaded.current.get(networkKey) ?? false;
          
          if (isFullyLoaded) continue;

          const cursor = networkCursors.current.get(networkKey) ?? null;

          fetchPromises.push(
            fetchNetworkTransactions(addr, network, cursor).then((result) => {
              // Update cursor
              if (result.nextCursor) {
                networkCursors.current.set(networkKey, result.nextCursor);
                hasNewData = true;
              } else {
                networkFullyLoaded.current.set(networkKey, true);
              }

              // Update total count (use first non-null value)
              if (result.total !== null) {
                const currentTotal = totalCountCache.current.get(baseKey);
                if (currentTotal === null || currentTotal === undefined) {
                  totalCountCache.current.set(baseKey, result.total);
                }
              }

              // Add to cache
              if (result.rows.length > 0) {
                addToCache(baseKey, result.rows);
                hasNewData = true;
              }
            })
          );
        }

        await Promise.all(fetchPromises);

        // Check if we need more (recursive loading)
        const updatedAll = rawTransactionsCache.current.get(baseKey) || [];
        const updatedFiltered = filterTransactions(updatedAll, selectedNetworks);

        if (updatedFiltered.length < neededCount && hasNewData) {
          // Check if any network still has more data
          const hasMoreData = selectedNetworks.some((network) => {
            const networkKey = getNetworkCacheKey(addr, network);
            return !(networkFullyLoaded.current.get(networkKey) ?? false);
          });

          if (hasMoreData) {
            // Recursively load more
            await loadTransactions(addr, selectedNetworks, neededCount, retryCount + 1);
          }
        }
      } catch (e: any) {
        setError(e?.message || "Failed to load transactions");
      } finally {
        setLoading(false);
      }
    },
    [
      getBaseCacheKey,
      getNetworkCacheKey,
      filterTransactions,
      fetchNetworkTransactions,
      addToCache,
    ]
  );

  // ============================================================================
  // Pagination
  // ============================================================================

  /**
   * Update displayed rows based on current filters and page
   */
  const updateDisplayedRows = useCallback(() => {
    if (!address) {
      setRows([]);
      setHasNext(false);
      return;
    }

    const baseKey = getBaseCacheKey(address);
    const allTransactions = rawTransactionsCache.current.get(baseKey) || [];
    const selectedNetworks = getSelectedNetworks();

    // Filter transactions
    const filtered = filterTransactions(allTransactions, selectedNetworks);

    // Paginate
    const startIndex = (page - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    const paginatedRows = filtered.slice(startIndex, endIndex);

    // Check if there are more pages
    const hasMore = filtered.length > endIndex;

    // Check if we can load more from API
    const canLoadMore = selectedNetworks.some((network) => {
      const networkKey = getNetworkCacheKey(address, network);
      return !(networkFullyLoaded.current.get(networkKey) ?? false);
    });

    setRows(paginatedRows);
    setHasNext(hasMore || canLoadMore);

    // Update total
    const cachedTotal = totalCountCache.current.get(baseKey);
    if (cachedTotal !== null && cachedTotal !== undefined) {
      setTotal(cachedTotal);
    } else if (filtered.length > 0 && !hasMore && !canLoadMore) {
      // Exact count if we have all data
      setTotal(filtered.length);
    } else {
      setTotal(null);
    }
  }, [
    address,
    page,
    getBaseCacheKey,
    getNetworkCacheKey,
    getSelectedNetworks,
    filterTransactions,
  ]);

  // ============================================================================
  // Public API
  // ============================================================================

  const load = useCallback(
    async (p: number) => {
      if (!address) return;
      setPage(p);
      const selectedNetworks = getSelectedNetworks();
      const neededCount = p * PAGE_SIZE;
      await loadTransactions(address, selectedNetworks, neededCount);
      // updateDisplayedRows will be called by useEffect
    },
    [address, getSelectedNetworks, loadTransactions]
  );

  const refresh = useCallback(() => {
    if (!address) return;
    const baseKey = getBaseCacheKey(address);
    
    // Clear cache
    rawTransactionsCache.current.delete(baseKey);
    
    // Clear cursors and loaded flags for this base context
    for (const key of Array.from(networkCursors.current.keys())) {
      if (key.startsWith(baseKey)) {
        networkCursors.current.delete(key);
      }
    }
    for (const key of Array.from(networkFullyLoaded.current.keys())) {
      if (key.startsWith(baseKey)) {
        networkFullyLoaded.current.delete(key);
      }
    }
    
    totalCountCache.current.delete(baseKey);
    setCacheVersion((v) => v + 1);
    setPage(1);
    load(1);
  }, [address, getBaseCacheKey, load]);

  // ============================================================================
  // Effects
  // ============================================================================

  // Initial load or refresh when address/dateRange changes
  useEffect(() => {
    if (!address) return;
    const baseKey = getBaseCacheKey(address);
    
    // Clear cache for this context
    rawTransactionsCache.current.delete(baseKey);
    
    // Clear cursors and loaded flags
    for (const key of Array.from(networkCursors.current.keys())) {
      if (key.startsWith(baseKey)) {
        networkCursors.current.delete(key);
      }
    }
    for (const key of Array.from(networkFullyLoaded.current.keys())) {
      if (key.startsWith(baseKey)) {
        networkFullyLoaded.current.delete(key);
      }
    }
    
    totalCountCache.current.delete(baseKey);
    setCacheVersion((v) => v + 1);
    setPage(1);
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, refreshKey, dateRangeKey]);

  // When networks change, reset to page 1 and load missing networks
  useEffect(() => {
    if (!address) return;
    setPage(1);
    const selectedNetworks = getSelectedNetworks();
    if (selectedNetworks.length === 0) {
      updateDisplayedRows();
      return;
    }
    
    // Check which networks are missing from cache
    const baseKey = getBaseCacheKey(address);
    const allTransactions = rawTransactionsCache.current.get(baseKey) || [];
    const cachedNetworks = new Set(allTransactions.map((tx) => tx.network));
    
    const missingNetworks = selectedNetworks.filter(
      (net) => !cachedNetworks.has(net)
    );

    if (missingNetworks.length > 0) {
      // Load missing networks (load enough for page 1)
      const neededCount = PAGE_SIZE;
      loadTransactions(address, missingNetworks, neededCount).then(() => {
        // After loading, update displayed rows
        updateDisplayedRows();
      });
    } else {
      // All networks are cached, just update display
      updateDisplayedRows();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [networksParam, address, getBaseCacheKey, getSelectedNetworks, loadTransactions]);

  // When filter types change, reset to page 1 and update displayed rows
  // When filters or page change, update displayed rows and load if needed
  useEffect(() => {
    if (!address) return;
    
    // Track previous selectedTypesKey to detect filter changes
    const prevSelectedTypesKey = prevSelectedTypesKeyRef.current;
    const filterChanged = prevSelectedTypesKey !== null && prevSelectedTypesKey !== selectedTypesKey;
    prevSelectedTypesKeyRef.current = selectedTypesKey;
    
    // If filter changed, reset to page 1 first
    if (filterChanged && page !== 1) {
      setPage(1);
      return; // Exit early, will re-run when page becomes 1
    }
    
    const selectedNetworks = getSelectedNetworks();
    const baseKey = getBaseCacheKey(address);
    const allTransactions = rawTransactionsCache.current.get(baseKey) || [];
    const filtered = filterTransactions(allTransactions, selectedNetworks);
    const neededForPage = page * PAGE_SIZE;

    // If we don't have enough filtered transactions, load more
    if (filtered.length < neededForPage) {
      loadTransactions(address, selectedNetworks, neededForPage).then(() => {
        updateDisplayedRows();
      });
    } else {
      updateDisplayedRows();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Note: updateDisplayedRows is intentionally excluded from dependencies to prevent double-triggering
    // when it's recreated due to filterTransactions changes. It's safe because it reads current values via closure.
  }, [selectedTypesKey, page, address, getSelectedNetworks, getBaseCacheKey, filterTransactions, loadTransactions]);

  // Get all loaded rows for stats (deduplicated)
  const loadedRowsAll = useMemo(() => {
    if (!address) return [];
    const baseKey = getBaseCacheKey(address);
    return rawTransactionsCache.current.get(baseKey) || [];
  }, [address, getBaseCacheKey, cacheVersion]);

  // Legacy compatibility (remove these if not needed)
  const maxLoadedPage = 0;
  const cachedAheadCount = 0;
  const isOverloaded = false;
  const loadIndicatorLabel = loading ? "Chargement…" : null;

  return {
    rows,
    setRows,
    page,
    setPage,
    hasNext,
    loading,
    error,
    total,
    maxLoadedPage,
    load,
    refresh,
    loadedRowsAll,
    namespaceKey,
    cachedAheadCount,
    isOverloaded,
    loadIndicatorLabel,
  };
}
