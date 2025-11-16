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

  // Cache for pages: key = "address:filterKey:page" -> { rows, hasNext, total }
  const pageCache = useRef(
    new Map<
      string,
      {
        rows: TxRow[];
        hasNext: boolean;
        total: number | null;
        nextCursor: string | null;
      }
    >()
  );
  const cursorCache = useRef(new Map<string, Map<number, string | null>>());

  // Local pagination state
  const [rows, setRows] = useState<TxRow[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);

  // Generate cache key for current filters
  const getBaseCacheKey = useCallback((addr: string) => {
    const filterKey = JSON.stringify(selectedTypes);
    const nets = networksParam || "(all)";
    return `${addr}:${nets}:${filterKey}:${dateRangeKey}`;
  }, [selectedTypes, networksParam, dateRangeKey]);
  
  const getCacheKey = useCallback((addr: string, pageNum: number) =>
    `${getBaseCacheKey(addr)}:${pageNum}`, [getBaseCacheKey]);
    
  const namespaceKey = useMemo(
    () => (address ? getBaseCacheKey(address) : null),
    [address, getBaseCacheKey]
  );

  // Prefetch/cache status: compute how many pages are already cached ahead
  const cachedAheadCount = useMemo(() => {
    if (!address || !namespaceKey) return 0;
    const prefix = `${namespaceKey}:`;
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
  }, [address, namespaceKey, page, cacheVersion]);
  const isOverloaded = cachedAheadCount >= 3 || (loading && cachedAheadCount >= 1);
  const loadIndicatorLabel = isOverloaded
    ? `Préchargement élevé: ${cachedAheadCount} page(s)`
    : cachedAheadCount > 0
    ? `Pages en cache: ${cachedAheadCount}`
    : loading
    ? `Chargement…`
    : null;

  const ensureCursorMap = useCallback((addr: string) => {
    const ns = getBaseCacheKey(addr);
    if (!cursorCache.current.has(ns)) {
      cursorCache.current.set(ns, new Map([[1, null]]));
    }
    return { map: cursorCache.current.get(ns)!, namespace: ns };
  }, [getBaseCacheKey]);

  // Load current page (with cache check)
  const load = useCallback(async (p: number) => {
    if (!address) return;

    // Check cache first
    const cacheKey = getCacheKey(address, p);
    const cached = pageCache.current.get(cacheKey);
    const { map: cursorMap } = ensureCursorMap(address);
    const cursorParam = cursorMap.get(p) ?? null;

    if (cached) {
      // Use cached data immediately (no loading state)
      setRows(cached.rows);
      setHasNext(cached.hasNext);
      setTotal(cached.total);
      setMaxLoadedPage((prev) => (p > prev ? p : prev));
      cursorMap.set(p + 1, cached.nextCursor ?? null);

      // Prefetch next page in background (if available)
      if (cached.hasNext && cached.nextCursor) {
        preloadNextPage(p + 1);
      }
      return;
    }

    // Not in cache, fetch from API
    setLoading(true);
    setError(null);
    try {
      const classParam = uiTypesToClassParam(selectedTypes);
      const resp = await fetchTransactions(address, {
        // networks: if undefined → backend default = all supported EVM networks
        ...(networksParam ? { networks: networksParam } : {}),
        page: p,
        limit: PAGE_SIZE,
        minUsd: 0,
        spamFilter: "hard",
        ...(cursorParam ? { cursor: cursorParam } : {}),
        ...(classParam ? { class: classParam } : {}),
        ...(dateRange.from ? { from: dateRange.from } : {}),
        ...(dateRange.to ? { to: dateRange.to } : {}),
      });
      const { rows, hasNext, nextCursor } = resp as any;
      const totalCount = (resp as any)?.total ?? null;

      // Chunk and cache: build 20-sized pages starting at requested page p
      const chunks: TxRow[][] = [];
      for (let i = 0; i < rows.length; i += PAGE_SIZE) {
        chunks.push(rows.slice(i, i + PAGE_SIZE));
      }
      chunks.forEach((chunk, idx) => {
        const logicalPage = p + idx;
        const key = getCacheKey(address, logicalPage);
        const isLast = idx === chunks.length - 1;
        const pageHasNext = !isLast || hasNext;
        const pageNextCursor = isLast ? nextCursor ?? null : null;
        pageCache.current.set(key, {
          rows: chunk,
          hasNext: pageHasNext,
          total: totalCount,
          nextCursor: pageNextCursor,
        });
        // Prepare cursor for following page (only meaningful after last chunk)
        cursorMap.set(logicalPage + 1, pageNextCursor);
      });
      bumpCacheVersion();

      // Drive UI from the requested page slice we just cached
      const current = pageCache.current.get(cacheKey)!;
      setRows(current.rows);
      setHasNext(current.hasNext);
      setTotal(totalCount);
      setMaxLoadedPage((prev) => (p > prev ? p : prev));

      // Prefetch next page in background (if available)
      if (current.hasNext && cursorMap.get(p + 1)) {
        preloadNextPage(p + 1);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load transactions");
      setRows([]);
      setHasNext(false);
      setTotal(null);
    } finally {
      setLoading(false);
    }
  }, [address, selectedTypes, networksParam, dateRange, getCacheKey, ensureCursorMap, bumpCacheVersion]);

  // Preload next page in background (silent, no loading state)
  const preloadNextPage = useCallback(async (nextPage: number) => {
    if (!address) return;

    // Check if already cached
    const cacheKey = getCacheKey(address, nextPage);
    if (pageCache.current.has(cacheKey)) {
      return; // Already cached
    }

    const cursorInfo = ensureCursorMap(address);
    const cursorParam = cursorInfo.map.get(nextPage);
    if (cursorParam === undefined) {
      // We don't have a cursor for this page yet
      return;
    }

    try {
      const classParam = uiTypesToClassParam(selectedTypes);
      const resp = await fetchTransactions(address, {
        ...(networksParam ? { networks: networksParam } : {}),
        page: nextPage,
        limit: PAGE_SIZE,
        minUsd: 0,
        spamFilter: "hard",
        ...(cursorParam ? { cursor: cursorParam } : {}),
        ...(classParam ? { class: classParam } : {}),
        ...(dateRange.from ? { from: dateRange.from } : {}),
        ...(dateRange.to ? { to: dateRange.to } : {}),
      });
      const { rows, hasNext, nextCursor } = resp as any;
      const totalCount = (resp as any)?.total ?? null;

      // Store in cache (silently, no state updates)
      pageCache.current.set(cacheKey, {
        rows,
        hasNext,
        total: totalCount,
        nextCursor: nextCursor ?? null,
      });
      bumpCacheVersion();
      cursorInfo.map.set(nextPage + 1, nextCursor ?? null);
    } catch (e) {
      // Silent failure - prefetch errors should not affect UI
      console.debug("[Prefetch] Failed to preload page", nextPage, e);
    }
  }, [address, selectedTypes, networksParam, dateRange, getCacheKey, ensureCursorMap, bumpCacheVersion]);

  const refresh = useCallback(() => {
    if (!address) return;
    pageCache.current.clear();
    cursorCache.current.clear();
    setMaxLoadedPage(0);
    bumpCacheVersion();
    setPage(1);
    load(1);
  }, [address, bumpCacheVersion, load]);

  // Initial/refresh - clear cache when address or filters change
  useEffect(() => {
    if (!address) return;
    setPage(1);
    pageCache.current.clear(); // Clear cache when address or filters change
    cursorCache.current.clear();
    setMaxLoadedPage(0);
    bumpCacheVersion();
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, refreshKey, networksParam, dateRangeKey, bumpCacheVersion]);

  // When server-side class filter changes (chips), reload current page with new filter
  useEffect(() => {
    if (!address) return;
    // Don't clear cache - it's already organized by filter via getCacheKey
    // This allows instant navigation when returning to previously visited filters
    // Load current page with new filter (if page doesn't exist, backend will handle it)
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTypesKey]);

  // Get all loaded rows for stats calculation
  const loadedRowsAll = useMemo(() => {
    if (!address || !namespaceKey) return [];
    const prefix = `${namespaceKey}:`;
    const dedup = new Map<string, TxRow>();
    Array.from(pageCache.current.entries()).forEach(([key, value]) => {
      if (key === namespaceKey || key.startsWith(prefix)) {
        value.rows.forEach((row) => {
          const dedupKey = `${row.hash}:${row.direction}:${
            row.asset?.symbol ?? row.asset?.contract ?? "asset"
          }:${row.qty}:${row.ts}`;
          if (!dedup.has(dedupKey)) {
            dedup.set(dedupKey, row);
          }
        });
      }
    });
    return Array.from(dedup.values());
  }, [address, namespaceKey, cacheVersion]);

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

