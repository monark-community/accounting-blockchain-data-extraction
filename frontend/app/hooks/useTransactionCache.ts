import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import type { TxRow, TxType } from "@/lib/types/transactions";
import { fetchTransactions } from "@/lib/api/transactions";
import {
  PAGE_SIZE,
  uiTypesToClassParam,
} from "@/utils/transactionHelpers";

interface UseTransactionCacheParams {
  address: string | null;
  selectedTypes: TxType[] | ["all"];
  networksParam?: string;
  dateRange: { from?: string; to?: string; label: string };
  dateRangeKey: string;
  selectedTypesKey: string;
  refreshKey: number;
}

export function useTransactionCache({
  address,
  selectedTypes,
  networksParam,
  dateRange,
  dateRangeKey,
  selectedTypesKey,
  refreshKey,
}: UseTransactionCacheParams) {
  const [maxLoadedPage, setMaxLoadedPage] = useState(0);
  const [cacheVersion, setCacheVersion] = useState(0);
  const bumpCacheVersion = useCallback(() => setCacheVersion((v) => v + 1), []);

  // Raw transactions cache: stores all transactions without type filtering
  // Key: "address:networks:dateRange" (SANS selectedTypes)
  const rawTransactionsCache = useRef(new Map<string, TxRow[]>());

  // Global next cursor: one cursor per base context (address + networks + dateRange)
  // Key: "address:networks:dateRange" (SANS selectedTypes)
  const globalNextCursor = useRef(new Map<string, string | null>());

  // Cache for pages: key = "baseKey:filterType:page" -> { rows, hasNext, total }
  const pageCache = useRef(
    new Map<
      string,
      {
        rows: TxRow[];
        hasNext: boolean;
        total: number | null;
      }
    >()
  );

  // Incomplete pages cache: pages with < 20 legs
  const incompletePageCache = useRef(
    new Map<string, { rows: TxRow[] }>()
  );

  // Track how many raw transactions have been paginated for each filter type
  // Key: "baseKey:filterType" -> number of raw transactions already paginated
  const paginatedCount = useRef(new Map<string, number>());

  // Local pagination state
  const [rows, setRows] = useState<TxRow[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);

  // Generate base cache key (without selectedTypes): "address:networks:dateRange"
  const getBaseCacheKey = useCallback((addr: string) => {
    const nets = networksParam || "(all)";
    return `${addr}:${nets}:${dateRangeKey}`;
  }, [networksParam, dateRangeKey]);

  // Generate cache key for a specific filter type and page
  const getFilterCacheKey = useCallback(
    (addr: string, filterType: string, pageNum: number) => {
      const baseKey = getBaseCacheKey(addr);
      return `${baseKey}:${filterType}:${pageNum}`;
    },
    [getBaseCacheKey]
  );

  // Legacy: keep for compatibility with existing code
  const getCacheKey = useCallback(
    (addr: string, pageNum: number) => {
      const filterKey = JSON.stringify(selectedTypes);
      const baseKey = getBaseCacheKey(addr);
      return `${baseKey}:${filterKey}:${pageNum}`;
    },
    [getBaseCacheKey, selectedTypes]
  );

  const namespaceKey = useMemo(
    () => (address ? getBaseCacheKey(address) : null),
    [address, getBaseCacheKey]
  );

  // Get filter type string from selectedTypes
  const getFilterType = useCallback((): string => {
    if (Array.isArray(selectedTypes) && selectedTypes.length === 1 && selectedTypes[0] === "all") {
      return "all";
    }
    if (Array.isArray(selectedTypes) && selectedTypes.length === 1) {
      return selectedTypes[0];
    }
    // Multiple types selected - sort to ensure consistent cache keys
    const sorted = Array.isArray(selectedTypes) ? [...selectedTypes].sort() : selectedTypes;
    return JSON.stringify(sorted);
  }, [selectedTypes]);

  // Prefetch/cache status: compute how many pages are already cached ahead for current filter
  const cachedAheadCount = useMemo(() => {
    if (!address) return 0;
    const filterType = getFilterType();
    const baseKey = getBaseCacheKey(address);
    const prefix = `${baseKey}:${filterType}:`;
    let count = 0;
    for (const key of Array.from(pageCache.current.keys())) {
      if (key.startsWith(prefix)) {
        const parts = key.split(":");
        const maybePage = Number(parts[parts.length - 1]);
        if (Number.isFinite(maybePage) && maybePage > page) {
          count += 1;
        }
      }
    }
    return count;
  }, [address, page, getBaseCacheKey, getFilterType, cacheVersion]);
  const isOverloaded = cachedAheadCount >= 3 || (loading && cachedAheadCount >= 1);
  const loadIndicatorLabel = isOverloaded
    ? `Préchargement élevé: ${cachedAheadCount} page(s)`
    : cachedAheadCount > 0
    ? `Pages en cache: ${cachedAheadCount}`
    : loading
    ? `Chargement…`
    : null;

  // Generate all possible filter combinations
  const getAllFilterCombinations = useCallback((): Array<string | TxType[]> => {
    const baseTypes: TxType[] = ["income", "expense", "swap", "gas"];
    const combinations: Array<string | TxType[]> = ["all"];

    // Add individual types
    baseTypes.forEach((type) => combinations.push(type));

      // Generate all combinations of 2, 3, and 4 types
      for (let r = 2; r <= baseTypes.length; r++) {
        const generateCombinations = (
          arr: TxType[],
          size: number,
          start: number = 0,
          current: TxType[] = []
        ): void => {
          if (current.length === size) {
            // Sort to ensure consistent cache keys (e.g., ["income","expense"] not ["expense","income"])
            combinations.push([...current].sort());
            return;
          }
          for (let i = start; i < arr.length; i++) {
            current.push(arr[i]);
            generateCombinations(arr, size, i + 1, current);
            current.pop();
          }
        };
        generateCombinations(baseTypes, r);
      }

      return combinations;
  }, []);

  // Check if a transaction matches a filter (single type or combination)
  const transactionMatchesFilter = useCallback(
    (row: TxRow, filter: string | TxType[]): boolean => {
      if (filter === "all") return true;
      if (typeof filter === "string") {
        return row.type === filter;
      }
      // Filter is an array of types (combination)
      return filter.includes(row.type);
    },
    []
  );

  // Filter and paginate raw transactions for all filter types
  const filterAndPaginate = useCallback(
    (rawRows: TxRow[], baseKey: string, totalCount: number | null) => {
      // Check if there are more raw transactions available (via global cursor)
      const hasMoreRaw = globalNextCursor.current.get(baseKey) !== null;

      // Get all possible filter combinations
      const allFilters = getAllFilterCombinations();

      // Process each filter combination
      allFilters.forEach((filter) => {
        // Generate filter key (string for single type, JSON for combinations)
        const filterKeyStr =
          typeof filter === "string" ? filter : JSON.stringify(filter);
        const filterKey = `${baseKey}:${filterKeyStr}`;
        const alreadyPaginated = paginatedCount.current.get(filterKey) || 0;

        // Only process new raw transactions (those not yet paginated)
        const newRawRows = rawRows.slice(alreadyPaginated);
        if (newRawRows.length === 0) {
          // No new transactions to process
          return;
        }

        // Filter new transactions: single pass through transactions
        // Each transaction is checked against this filter and added if it matches
        const newFiltered: TxRow[] = [];
        for (const row of newRawRows) {
          if (transactionMatchesFilter(row, filter)) {
            newFiltered.push(row);
          }
        }

        if (newFiltered.length === 0) {
          // No new transactions match this filter
          paginatedCount.current.set(filterKey, rawRows.length);
          return;
        }

        // Collect existing incomplete pages for this filter
        const existingIncomplete = new Map<number, TxRow[]>();
        for (const [key, value] of Array.from(
          incompletePageCache.current.entries()
        )) {
          if (key.startsWith(`${baseKey}:${filterKeyStr}:`)) {
            const pageNum = Number(key.split(":")[key.split(":").length - 1]);
            if (Number.isFinite(pageNum)) {
              existingIncomplete.set(pageNum, value.rows);
            }
          }
        }

        // Start pagination, completing incomplete pages first
        let newFilteredIndex = 0;
        let currentPageNum = 1;

        // Find the highest page number already cached (complete or incomplete)
        let highestPageNum = 0;
        for (const key of Array.from(pageCache.current.keys())) {
          if (key.startsWith(`${baseKey}:${filterKeyStr}:`)) {
            const pageNum = Number(key.split(":")[key.split(":").length - 1]);
            if (Number.isFinite(pageNum) && pageNum > highestPageNum) {
              highestPageNum = pageNum;
            }
          }
        }
        for (const key of Array.from(incompletePageCache.current.keys())) {
          if (key.startsWith(`${baseKey}:${filterKeyStr}:`)) {
            const pageNum = Number(key.split(":")[key.split(":").length - 1]);
            if (Number.isFinite(pageNum) && pageNum > highestPageNum) {
              highestPageNum = pageNum;
            }
          }
        }

        // First, complete existing incomplete pages
        for (const [pageNum, existingRows] of Array.from(existingIncomplete.entries()).sort((a, b) => a[0] - b[0])) {
          const needed = PAGE_SIZE - existingRows.length;
          if (needed > 0 && newFilteredIndex < newFiltered.length) {
            const toAdd = newFiltered.slice(newFilteredIndex, newFilteredIndex + needed);
            const completed = [...existingRows, ...toAdd];
            newFilteredIndex += toAdd.length;

            if (completed.length === PAGE_SIZE) {
              // Page is now complete
              const cacheKey = getFilterCacheKey(address!, filterKeyStr, pageNum);
              pageCache.current.set(cacheKey, {
                rows: completed,
                hasNext: hasMoreRaw || newFilteredIndex < newFiltered.length,
                total: totalCount,
              });
              incompletePageCache.current.delete(cacheKey);
            } else {
              // Still incomplete
              const cacheKey = getFilterCacheKey(address!, filterKeyStr, pageNum);
              incompletePageCache.current.set(cacheKey, { rows: completed });
            }
          }
        }

        // Then, paginate remaining new filtered transactions into new pages
        // Start from the page after the highest existing page
        currentPageNum = highestPageNum + 1;
        while (newFilteredIndex < newFiltered.length) {
          const chunk = newFiltered.slice(
            newFilteredIndex,
            newFilteredIndex + PAGE_SIZE
          );
          newFilteredIndex += chunk.length;
          const cacheKey = getFilterCacheKey(
            address!,
            filterKeyStr,
            currentPageNum
          );

          if (chunk.length === PAGE_SIZE) {
            // Complete page
            const isLast = newFilteredIndex >= newFiltered.length;
            pageCache.current.set(cacheKey, {
              rows: chunk,
              hasNext: !isLast || hasMoreRaw,
              total: totalCount,
            });
          } else if (chunk.length > 0) {
            // Incomplete page
            incompletePageCache.current.set(cacheKey, { rows: chunk });
          }
          currentPageNum++;
        }

        // Update paginated count for this filter
        paginatedCount.current.set(filterKey, rawRows.length);
      });

      bumpCacheVersion();
    },
    [
      address,
      getFilterCacheKey,
      bumpCacheVersion,
      getAllFilterCombinations,
      transactionMatchesFilter,
    ]
  );

  // Load current page (with cache check and auto-completion)
  const load = useCallback(
    async (p: number, retryCount = 0) => {
      if (!address) return;

      const baseKey = getBaseCacheKey(address);
      const filterType = getFilterType();
      const filterCacheKey = getFilterCacheKey(address, filterType, p);

      // Check complete page cache first
      const cached = pageCache.current.get(filterCacheKey);
      if (cached) {
        setRows(cached.rows);
        setHasNext(cached.hasNext);
        setTotal(cached.total);
        setMaxLoadedPage((prev) => (p > prev ? p : prev));
        return;
      }

      // Check incomplete page cache
      const incomplete = incompletePageCache.current.get(filterCacheKey);
      if (incomplete && incomplete.rows.length === PAGE_SIZE) {
        // Page was completed, move to complete cache
        pageCache.current.set(filterCacheKey, {
          rows: incomplete.rows,
          hasNext: true, // Assume more available
          total: null,
        });
        incompletePageCache.current.delete(filterCacheKey);
        setRows(incomplete.rows);
        setHasNext(true);
        setTotal(null);
        setMaxLoadedPage((prev) => (p > prev ? p : prev));
        return;
      }

      // Page not in cache or incomplete - need to fetch more raw transactions
      setLoading(true);
      setError(null);

      try {
        // Get global cursor for this base context
        const cursor = globalNextCursor.current.get(baseKey) ?? null;

        // Fetch raw transactions (all types, no class filter)
        const resp = await fetchTransactions(address, {
          ...(networksParam ? { networks: networksParam } : {}),
          page: 1, // Always page 1, cursor handles pagination
          limit: PAGE_SIZE,
          minUsd: 0,
          spamFilter: "hard",
          ...(cursor ? { cursor } : {}),
          // NO class param - we want all transactions
          ...(dateRange.from ? { from: dateRange.from } : {}),
          ...(dateRange.to ? { to: dateRange.to } : {}),
        });

        const { rows: newRows, hasNext, nextCursor } = resp as any;
        const totalCount = (resp as any)?.total ?? null;

        // Add new raw transactions to cache
        const existingRaw = rawTransactionsCache.current.get(baseKey) || [];
        const updatedRaw = [...existingRaw, ...newRows];
        rawTransactionsCache.current.set(baseKey, updatedRaw);

        // Update global cursor
        if (nextCursor) {
          globalNextCursor.current.set(baseKey, nextCursor);
        }

        // Filter and paginate for all filter types
        filterAndPaginate(updatedRaw, baseKey, totalCount);

        // Check if requested page is now complete
        const nowCached = pageCache.current.get(filterCacheKey);
        if (nowCached && nowCached.rows.length === PAGE_SIZE) {
          // Page is complete
          setRows(nowCached.rows);
          setHasNext(nowCached.hasNext);
          setTotal(nowCached.total);
          setMaxLoadedPage((prev) => (p > prev ? p : prev));
        } else {
          // Page still incomplete - recursively fetch more until complete
          // Prevent infinite loop with retry limit
          if (retryCount < 10 && hasNext && nextCursor) {
            await load(p, retryCount + 1);
          } else {
            // Show incomplete page or error
            const incompleteNow = incompletePageCache.current.get(filterCacheKey);
            if (incompleteNow) {
              setRows(incompleteNow.rows);
              setHasNext(false);
              setTotal(totalCount);
            } else {
              setRows([]);
              setHasNext(false);
              setTotal(totalCount);
            }
          }
        }
      } catch (e: any) {
        setError(e?.message || "Failed to load transactions");
        setRows([]);
        setHasNext(false);
        setTotal(null);
      } finally {
        setLoading(false);
      }
    },
    [
      address,
      networksParam,
      dateRange,
      getBaseCacheKey,
      getFilterType,
      getFilterCacheKey,
      filterAndPaginate,
    ]
  );

  const refresh = useCallback(() => {
    if (!address) return;
    const baseKey = getBaseCacheKey(address);
    // Clear all caches
    rawTransactionsCache.current.delete(baseKey);
    globalNextCursor.current.delete(baseKey);
    pageCache.current.clear();
    incompletePageCache.current.clear();
    // Clear paginated counts for this base context
    for (const key of Array.from(paginatedCount.current.keys())) {
      if (key.startsWith(baseKey)) {
        paginatedCount.current.delete(key);
      }
    }
    setMaxLoadedPage(0);
    bumpCacheVersion();
    setPage(1);
    load(1);
  }, [address, getBaseCacheKey, bumpCacheVersion, load]);

  // Initial/refresh - clear cache when address or base filters change (networks, dateRange)
  useEffect(() => {
    if (!address) return;
    const baseKey = getBaseCacheKey(address);
    setPage(1);
    // Clear raw cache and cursor for this base context
    rawTransactionsCache.current.delete(baseKey);
    globalNextCursor.current.delete(baseKey);
    // Clear all page caches (they depend on base context)
    pageCache.current.clear();
    incompletePageCache.current.clear();
    // Clear paginated counts for this base context
    for (const key of Array.from(paginatedCount.current.keys())) {
      if (key.startsWith(baseKey)) {
        paginatedCount.current.delete(key);
      }
    }
    setMaxLoadedPage(0);
    bumpCacheVersion();
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, refreshKey, networksParam, dateRangeKey, bumpCacheVersion]);

  // When filter type changes (selectedTypes), just switch to cached pages (no API call)
  useEffect(() => {
    if (!address) return;
    const filterType = getFilterType();
    const filterCacheKey = getFilterCacheKey(address, filterType, page);
    
    // Check if page exists in cache
    const cached = pageCache.current.get(filterCacheKey);
    if (cached) {
      setRows(cached.rows);
      setHasNext(cached.hasNext);
      setTotal(cached.total);
      setMaxLoadedPage((prev) => (page > prev ? page : prev));
    } else {
      // Page doesn't exist - load it (will fetch if needed)
      load(page);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTypesKey]);

  // Get all loaded rows for stats calculation (from raw transactions cache)
  const loadedRowsAll = useMemo(() => {
    if (!address) return [];
    const baseKey = getBaseCacheKey(address);
    const rawRows = rawTransactionsCache.current.get(baseKey) || [];
    
    // Deduplicate by hash + direction + asset + qty + timestamp
    const dedup = new Map<string, TxRow>();
    rawRows.forEach((row) => {
      const dedupKey = `${row.hash}:${row.direction}:${
        row.asset?.symbol ?? row.asset?.contract ?? "asset"
      }:${row.qty}:${row.ts}`;
      if (!dedup.has(dedupKey)) {
        dedup.set(dedupKey, row);
      }
    });
    return Array.from(dedup.values());
  }, [address, getBaseCacheKey, cacheVersion]);

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

