import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import type { TxRow, TxType, TxListResponse } from "@/lib/types/transactions";
import { fetchTransactions } from "@/lib/api/transactions";
import { PAGE_SIZE } from "@/utils/transactionHelpers";

// Backend TX_MAX_LIMIT is 40, use it to reduce number of requests
const FETCH_LIMIT = 40;

interface UseTransactionCacheParams {
  address?: string | null;
  addresses?: string[];
  selectedTypes: TxType[] | ["all"];
  networksParam?: string;
  dateRange: { from?: string; to?: string; label: string };
  dateRangeKey: string;
  selectedTypesKey: string;
  refreshKey: number;
}

/**
 * Simplified transaction cache hook with optional multi-wallet support.
 * - Maintains a network-specific cache per wallet (address:dateRange:network)
 * - Filters on type + network client-side (date handled server-side)
 * - Supports progressive loading and on-the-fly pagination
 */
export function useTransactionCache({
  address,
  addresses,
  selectedTypes,
  networksParam,
  dateRange,
  dateRangeKey,
  selectedTypesKey,
  refreshKey,
}: UseTransactionCacheParams) {
  // Normalize wallet list (fallback to single address)
  const activeAddresses = useMemo(() => {
    const input = addresses && addresses.length ? addresses : address ? [address] : [];
    const unique = new Map<string, string>();
    input.forEach((addr) => {
      if (!addr) return;
      const normalized = addr.toLowerCase();
      if (!unique.has(normalized)) unique.set(normalized, addr);
    });
    return Array.from(unique.values());
  }, [addresses, address]);

  // State
  const [rows, setRows] = useState<TxRow[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [cacheVersion, setCacheVersion] = useState(0);
  const [warnings, setWarnings] =
    useState<TxListResponse["warnings"] | null>(null);
  const isDefaultTypeFilter = useMemo(
    () =>
      Array.isArray(selectedTypes) &&
      selectedTypes.length === 1 &&
      selectedTypes[0] === "all",
    [selectedTypes]
  );

  // Cache structures (per wallet + network)
  const networkCache = useRef(new Map<string, TxRow[]>());
  const networkCursors = useRef(new Map<string, string | null>());
  const networkFullyLoaded = useRef(new Map<string, boolean>());
  const totalCountCache = useRef(new Map<string, number | null>());
  const prevSelectedTypesKeyRef = useRef<string | null>(null);
  const networksLoadingRef = useRef(false);
  // Track in-flight requests to prevent duplicates
  const inflightRequests = useRef(new Set<string>());
  // Track if initial load has been triggered to prevent multiple useEffect triggers
  const initialLoadTriggeredRef = useRef<string | null>(null);
  const prevNetworksKeyRef = useRef<string | null>(null);

  // Cache Key Helpers
  const getBaseCacheKey = useCallback(
    (addr: string) => `${addr}:${dateRangeKey}`,
    [dateRangeKey]
  );

  const getTotalCacheKey = useCallback(
    (addr: string) => `${addr}:${dateRangeKey}:${networksParam ?? "all"}`,
    [dateRangeKey, networksParam]
  );

  const namespaceKey = useMemo(() => {
    if (!activeAddresses.length) return null;
    const normalized = activeAddresses.map((addr) => addr.toLowerCase()).sort();
    return `${normalized.join("|")}:${dateRangeKey}:${networksParam ?? "all"}`;
  }, [activeAddresses, dateRangeKey, networksParam]);

  const getNetworkCacheKey = useCallback(
    (addr: string, network: string) => `${addr}:${dateRangeKey}:${network}`,
    [dateRangeKey]
  );

  // Filtering Helpers
  const matchesTypeFilter = useCallback(
    (tx: TxRow): boolean => {
      if (!Array.isArray(selectedTypes)) return false;
      if (selectedTypes.length === 1 && selectedTypes[0] === "all") return true;
      return (selectedTypes as TxType[]).includes(tx.type);
    },
    [selectedTypes]
  );

  const matchesNetworkFilter = useCallback(
    (tx: TxRow, selectedNetworks: string[]): boolean => {
      if (!selectedNetworks.length) return true;
      return selectedNetworks.includes(tx.network);
    },
    []
  );

  const filterTransactions = useCallback(
    (txs: TxRow[], selectedNetworks: string[]): TxRow[] =>
      txs.filter(
        (tx) => matchesTypeFilter(tx) && matchesNetworkFilter(tx, selectedNetworks)
      ),
    [matchesTypeFilter, matchesNetworkFilter]
  );

  // Cache Management helpers
  const sortTransactionsByDate = useCallback(
    (transactions: TxRow[]): TxRow[] =>
      [...transactions].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()),
    []
  );

  const addToNetworkCache = useCallback(
    (networkKey: string, originAddress: string, newTransactions: TxRow[]) => {
      const existing = networkCache.current.get(networkKey) || [];
      const dedup = new Map<string, TxRow>();
      [
        ...existing,
        ...newTransactions.map((tx) => ({
          ...tx,
          walletAddress: originAddress,
        })),
      ].forEach((tx) => {
        const key = [
          tx.hash,
          tx.direction,
          tx.walletAddress ?? "",
          tx.asset?.symbol ?? tx.asset?.contract ?? "asset",
          tx.qty,
          tx.ts,
        ].join("|");
        if (!dedup.has(key)) dedup.set(key, tx);
      });
      networkCache.current.set(networkKey, sortTransactionsByDate(Array.from(dedup.values())));
      setCacheVersion((v) => v + 1);
    },
    [sortTransactionsByDate]
  );

  const collectTransactions = useCallback(
    (addr: string, selectedNetworks: string[]): TxRow[] => {
      if (!selectedNetworks.length) return [];
      const combined: TxRow[] = [];
      selectedNetworks.forEach((network) => {
        const networkKey = getNetworkCacheKey(addr, network);
        const cache = networkCache.current.get(networkKey);
        if (cache?.length) {
          combined.push(...cache);
        }
      });
      return sortTransactionsByDate(combined);
    },
    [getNetworkCacheKey, sortTransactionsByDate]
  );

  const getSelectedNetworks = useCallback((): string[] => {
    if (!networksParam) return [];
    return networksParam.split(",").map((n) => n.trim()).filter(Boolean);
  }, [networksParam]);

  // Data Loading
  const fetchNetworkTransactions = useCallback(
    async (
      addr: string,
      networks: string,
      cursor: string | null
    ): Promise<{
      rows: TxRow[];
      hasNext: boolean;
      nextCursor: string | null;
      total: number | null;
      networkMap: Map<string, TxRow[]>;
      warnings: TxListResponse["warnings"] | null;
    }> => {
      const resp = await fetchTransactions(
        addr,
        {
          networks,
          page: 1,
          limit: FETCH_LIMIT,
          minUsd: 0,
          spamFilter: "hard",
          ...(cursor ? { cursor } : {}),
          ...(dateRange.from ? { from: dateRange.from } : {}),
          ...(dateRange.to ? { to: dateRange.to } : {}),
        },
        0,
        "useTransactionCache"
      );
      const networkMap = new Map<string, TxRow[]>();
      resp.rows.forEach((tx) => {
        if (!networkMap.has(tx.network)) networkMap.set(tx.network, []);
        networkMap.get(tx.network)!.push(tx);
      });
      return {
        rows: resp.rows,
        hasNext: resp.hasNext,
        nextCursor: resp.nextCursor,
        total: (resp as any)?.total ?? null,
        networkMap,
        warnings: resp.warnings ?? null,
      };
    },
    [dateRange]
  );

  const inflightRequestsRef = useRef(0);
  const loadingFlagRef = useRef(false);
  const beginLoading = useCallback(() => {
    inflightRequestsRef.current += 1;
    if (!loadingFlagRef.current) {
      loadingFlagRef.current = true;
      setLoading(true);
    }
  }, []);
  const endLoading = useCallback(() => {
    inflightRequestsRef.current = Math.max(0, inflightRequestsRef.current - 1);
    if (inflightRequestsRef.current === 0 && loadingFlagRef.current) {
      loadingFlagRef.current = false;
      setLoading(false);
    }
  }, []);

  const loadTransactions = useCallback(
    async (
      addr: string,
      selectedNetworks: string[],
      neededCount: number,
      retryCount = 0
    ): Promise<void> => {
      if (!selectedNetworks.length) return;
      if (retryCount > 20) return;
      
      // Create a unique key for this request to prevent duplicates
      const requestKey = `${addr}:${selectedNetworks.sort().join(",")}:${neededCount}:${retryCount}`;
      if (inflightRequests.current.has(requestKey)) {
        return;
      }
      
      inflightRequests.current.add(requestKey);
      beginLoading();
      setError(null);
      try {
        const networksWithoutCache = selectedNetworks.filter((network) => {
          const networkKey = getNetworkCacheKey(addr, network);
          const cache = networkCache.current.get(networkKey);
          return !cache || !cache.length;
        });

        if (networksWithoutCache.length) {
          let seeded = false;
          const result = await fetchNetworkTransactions(
            addr,
            networksWithoutCache.join(","),
            null
          );
          setWarnings(result.warnings ?? null);
          for (const network of networksWithoutCache) {
            const networkKey = getNetworkCacheKey(addr, network);
            const networkTxs = result.networkMap.get(network) || [];
            if (result.nextCursor && networkTxs.length) {
              networkCursors.current.set(networkKey, result.nextCursor);
              seeded = true;
            } else if (!result.nextCursor) {
              networkFullyLoaded.current.set(networkKey, true);
            }
            const baseKey = getTotalCacheKey(addr);
            if (result.total !== null) {
              if (!totalCountCache.current.has(baseKey)) {
                totalCountCache.current.set(baseKey, result.total);
              }
            }
            if (networkTxs.length) {
              addToNetworkCache(networkKey, addr, networkTxs);
              seeded = true;
            }
          }
          if (seeded) {
            await loadTransactions(addr, selectedNetworks, neededCount, retryCount + 1);
            return;
          }
        }

        const combined = collectTransactions(addr, selectedNetworks);
        const filtered = filterTransactions(combined, selectedNetworks);
        if (filtered.length >= neededCount) {
          return;
        }

        const networksToLoad = selectedNetworks.filter((network) => {
          const networkKey = getNetworkCacheKey(addr, network);
          return !(networkFullyLoaded.current.get(networkKey) ?? false);
        });
        if (!networksToLoad.length) {
          return;
        }

        let sharedCursor: string | null = null;
        networksToLoad.forEach((network) => {
          const networkKey = getNetworkCacheKey(addr, network);
          const cursor = networkCursors.current.get(networkKey) ?? null;
          if (cursor && !sharedCursor) sharedCursor = cursor;
        });

        const result = await fetchNetworkTransactions(
          addr,
          networksToLoad.join(","),
          sharedCursor
        );

        setWarnings(result.warnings ?? null);
        let hasNewData = false;
        for (const network of networksToLoad) {
          const networkKey = getNetworkCacheKey(addr, network);
          const networkTxs = result.networkMap.get(network) || [];
          if (result.nextCursor && networkTxs.length) {
            networkCursors.current.set(networkKey, result.nextCursor);
            hasNewData = true;
          } else if (!result.nextCursor) {
            networkFullyLoaded.current.set(networkKey, true);
          }
          const baseKey = getTotalCacheKey(addr);
          if (result.total !== null) {
            if (!totalCountCache.current.has(baseKey)) {
              totalCountCache.current.set(baseKey, result.total);
            }
          }
          if (networkTxs.length) {
            addToNetworkCache(networkKey, addr, networkTxs);
            hasNewData = true;
          }
        }

        if (hasNewData) {
          await loadTransactions(addr, selectedNetworks, neededCount, retryCount + 1);
        }
      } catch (e: any) {
        setError(e?.message || "Failed to load transactions");
      } finally {
        inflightRequests.current.delete(requestKey);
        endLoading();
      }
    },
    [
      fetchNetworkTransactions,
      getNetworkCacheKey,
      getBaseCacheKey,
      getTotalCacheKey,
      collectTransactions,
      filterTransactions,
      addToNetworkCache,
      beginLoading,
      endLoading,
    ]
  );

  // Pagination helper
  const updateDisplayedRows = useCallback(() => {
    if (!activeAddresses.length) {
      setRows([]);
      setHasNext(false);
      setTotal(null);
      return;
    }

    const selectedNetworks = getSelectedNetworks();
    if (!selectedNetworks.length) {
      setRows([]);
      setHasNext(false);
      setTotal(null);
      return;
    }

    let combinedAll: TxRow[] = [];
    activeAddresses.forEach((addr) => {
      combinedAll = combinedAll.concat(
        collectTransactions(addr, selectedNetworks)
      );
    });

    const filtered = filterTransactions(
      sortTransactionsByDate(combinedAll),
      selectedNetworks
    );
    const startIndex = (page - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    setRows(filtered.slice(startIndex, endIndex));

    const hasMore = filtered.length > endIndex;
    const canLoadMore = activeAddresses.some((addr) =>
      selectedNetworks.some((network) => {
        const networkKey = getNetworkCacheKey(addr, network);
        return !(networkFullyLoaded.current.get(networkKey) ?? false);
      })
    );
    const totals = activeAddresses.map((addr) =>
      totalCountCache.current.get(getTotalCacheKey(addr)) ?? null
    );
    const aggregatedTotal = totals.every((value) => typeof value === "number")
      ? totals.reduce((sum, value) => sum + (value ?? 0), 0)
      : null;
    setHasNext(hasMore || canLoadMore);

    if (aggregatedTotal != null && isDefaultTypeFilter) {
      setTotal(aggregatedTotal);
    } else if (!hasMore && !canLoadMore && filtered.length) {
      setTotal(filtered.length);
    } else {
      setTotal(null);
    }
  }, [
    activeAddresses,
    page,
    getSelectedNetworks,
    filterTransactions,
    sortTransactionsByDate,
    getNetworkCacheKey,
    getBaseCacheKey,
    getTotalCacheKey,
    collectTransactions,
    isDefaultTypeFilter,
  ]);

  // Keep a stable ref to updateDisplayedRows so effects that don't depend on `page`
  // can invoke the latest version without re-running when `page` changes.
  const updateDisplayedRowsRef = useRef(updateDisplayedRows);
  useEffect(() => {
    updateDisplayedRowsRef.current = updateDisplayedRows;
  }, [updateDisplayedRows]);

  // Public API
  const load = useCallback(
    async (p: number) => {
      if (!activeAddresses.length) return;
      setPage(p);
      const selectedNetworks = getSelectedNetworks();
      const needed = p * PAGE_SIZE;
      await Promise.all(
        activeAddresses.map((addr) =>
          loadTransactions(addr, selectedNetworks, needed)
        )
      );
    },
    [activeAddresses, getSelectedNetworks, loadTransactions]
  );

  const refresh = useCallback(() => {
    if (!activeAddresses.length) return;
    activeAddresses.forEach((addr) => {
      const baseKey = getBaseCacheKey(addr);
      for (const key of Array.from(networkCache.current.keys())) {
        if (key.startsWith(baseKey)) networkCache.current.delete(key);
      }
      for (const key of Array.from(networkCursors.current.keys())) {
        if (key.startsWith(baseKey)) networkCursors.current.delete(key);
      }
      for (const key of Array.from(networkFullyLoaded.current.keys())) {
        if (key.startsWith(baseKey)) networkFullyLoaded.current.delete(key);
      }
      totalCountCache.current.delete(getTotalCacheKey(addr));
    });
    setCacheVersion((v) => v + 1);
    setPage(1);
    load(1);
  }, [activeAddresses, getBaseCacheKey, getTotalCacheKey, load]);

  // ============================================================================
  // Effects
  // ============================================================================

  useEffect(() => {
    if (!activeAddresses.length) return;
    
    // Create a stable key for this effect's dependencies
    const effectKey = `${activeAddresses.map(a => a.toLowerCase()).sort().join('|')}:${refreshKey}:${dateRangeKey}`;
    
    // Prevent re-triggering if the same effect key was already processed
    if (initialLoadTriggeredRef.current === effectKey) {
      return;
    }
    
    initialLoadTriggeredRef.current = effectKey;
    
    activeAddresses.forEach((addr) => {
      const baseKey = getBaseCacheKey(addr);
      for (const key of Array.from(networkCache.current.keys())) {
        if (key.startsWith(baseKey)) networkCache.current.delete(key);
      }
      for (const key of Array.from(networkCursors.current.keys())) {
        if (key.startsWith(baseKey)) networkCursors.current.delete(key);
      }
      for (const key of Array.from(networkFullyLoaded.current.keys())) {
        if (key.startsWith(baseKey)) networkFullyLoaded.current.delete(key);
      }
      totalCountCache.current.delete(getTotalCacheKey(addr));
    });
    setCacheVersion((v) => v + 1);
    setPage(1);
    load(1);
  }, [activeAddresses, refreshKey, dateRangeKey, getBaseCacheKey, getTotalCacheKey, load]);

  useEffect(() => {
    if (!activeAddresses.length) return;
    
    // Create a stable key for this effect's dependencies
    const networksEffectKey = `${activeAddresses.map(a => a.toLowerCase()).sort().join('|')}:${networksParam || "all"}`;
    
    // Prevent re-triggering if networks haven't actually changed
    if (prevNetworksKeyRef.current === networksEffectKey) {
      return;
    }
    
    prevNetworksKeyRef.current = networksEffectKey;
    
    setPage(1);
    networksLoadingRef.current = false;
    const selectedNetworks = getSelectedNetworks();
    if (!selectedNetworks.length) {
      updateDisplayedRowsRef.current?.();
      return;
    }

    const missingNetworks = activeAddresses.some((addr) =>
      selectedNetworks.some((network) => {
        const networkKey = getNetworkCacheKey(addr, network);
        const cache = networkCache.current.get(networkKey);
        return !cache || !cache.length;
      })
    );

    if (missingNetworks) {
      networksLoadingRef.current = true;
      Promise.all(
        activeAddresses.map((addr) =>
          loadTransactions(addr, selectedNetworks, PAGE_SIZE)
        )
      ).finally(() => {
        networksLoadingRef.current = false;
        updateDisplayedRowsRef.current?.();
      });
    } else {
      updateDisplayedRowsRef.current?.();
    }
  }, [
    activeAddresses,
    networksParam,
    getSelectedNetworks,
    getNetworkCacheKey,
    loadTransactions,
  ]);

  useEffect(() => {
    if (!activeAddresses.length) return;
    if (loading || networksLoadingRef.current) return;

    const prevKey = prevSelectedTypesKeyRef.current;
    const filterChanged = prevKey !== null && prevKey !== selectedTypesKey;
    prevSelectedTypesKeyRef.current = selectedTypesKey;
    if (filterChanged && page !== 1) {
      setPage(1);
      return;
    }

    updateDisplayedRows();
  }, [
    activeAddresses,
    selectedTypesKey,
    page,
    loading,
    updateDisplayedRows,
  ]);

  // Loaded rows for stats (across wallets)
  const loadedRowsAll = useMemo(() => {
    if (!activeAddresses.length) return [];
    const selectedNetworks = getSelectedNetworks();
    if (!selectedNetworks.length) return [];
    let combinedAll: TxRow[] = [];
    activeAddresses.forEach((addr) => {
      combinedAll = combinedAll.concat(
        collectTransactions(addr, selectedNetworks)
      );
    });
    return sortTransactionsByDate(combinedAll);
  }, [
    activeAddresses,
    getSelectedNetworks,
    collectTransactions,
    sortTransactionsByDate,
    cacheVersion,
  ]);

  // Legacy compatibility values
  const maxLoadedPage = 0;
  const cachedAheadCount = 0;
  const isOverloaded = false;
  const loadIndicatorLabel = loading ? "Loading…" : null;

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
    warnings,
  };
}
