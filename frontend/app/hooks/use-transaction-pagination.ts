import { useRef, useState, useEffect, useMemo } from "react";
import type { TxRow, TxType } from "@/lib/types/transactions";
import { fetchTransactions } from "@/lib/api/transactions";

const PAGE_SIZE = 20;

// Types
export type RawPagePayload = { rows: TxRow[]; hasNext: boolean };
export type FilteredPagePayload = {
  rows: TxRow[];
  hasNext: boolean;
  resolvedPage: number;
  exhausted?: boolean;
  totalFiltered?: number;
};

export interface ComboState {
  networks: string[];
  rawPages: Map<number, RawPagePayload>;
  rawPromises: Map<number, Promise<RawPagePayload>>;
  filteredPages: Map<string, FilteredPagePayload>;
  filteredTotals: Map<string, { total: number; maxPage: number }>;
  // Next cursor from the last backend response, used for fetching continuation (step 3)
  rawNextCursor: string | null;
}

// Cache utilities
const makeNetworkKey = (list: string[]): string => {
  if (!list.length) return "(none)";
  return [...list].sort().join(",");
};

const getComboKey = (addr: string, networkKey: string, from?: string, to?: string): string => {
  const dateKey = from || to ? `::${from ?? ""}:${to ?? ""}` : "";
  return `${addr.toLowerCase()}::${networkKey}${dateKey}`;
};

const getFilteredBaseKey = (types: TxType[] | ["all"]): string => {
  if (!Array.isArray(types) || (types as any)[0] === "all") {
    return "all";
  }
  const sorted = [...(types as TxType[])].sort();
  return sorted.join(",");
};

const getFilteredKey = (types: TxType[] | ["all"], pageNum: number): string =>
  `${getFilteredBaseKey(types)}:${pageNum}`;

const findLastCachedPageForFilter = (
  comboState: ComboState,
  types: TxType[] | ["all"]
): number => {
  const baseKey = getFilteredBaseKey(types);
  let maxPage = 0;
  for (const key of Array.from(comboState.filteredPages.keys())) {
    if (key.startsWith(`${baseKey}:`)) {
      const pageNum = parseInt(key.split(":")[1] || "0", 10);
      if (pageNum > maxPage) {
        maxPage = pageNum;
      }
    }
  }
  return maxPage;
};

// Global cache (shared across all instances)
const globalComboCache = new Map<string, ComboState>();

const ensureComboState = (addr: string, networkList: string[], from?: string, to?: string): ComboState => {
  const comboKey = getComboKey(addr, makeNetworkKey(networkList), from, to);
  let state = globalComboCache.get(comboKey);
  if (!state) {
    state = {
      networks: [...networkList],
      rawPages: new Map(),
      rawPromises: new Map(),
      filteredPages: new Map(),
      filteredTotals: new Map(),
      rawNextCursor: null,
    };
    globalComboCache.set(comboKey, state);
  }
  return state;
};

const clearComboStatesForAddress = (addr: string): void => {
  const prefix = `${addr.toLowerCase()}::`;
  const entries = Array.from(globalComboCache.entries());
  const toDelete: string[] = [];
  for (const [key] of entries) {
    if (key.startsWith(prefix)) {
      toDelete.push(key);
    }
  }
  toDelete.forEach((key) => globalComboCache.delete(key));
};

// Page fetching
const ensureRawPage = async (
  addr: string,
  comboState: ComboState,
  pageNum: number,
  from?: string,
  to?: string
): Promise<RawPagePayload> => {
  if (comboState.rawPages.has(pageNum)) {
    return comboState.rawPages.get(pageNum)!;
  }
  if (comboState.rawPromises.has(pageNum)) {
    return comboState.rawPromises.get(pageNum)!;
  }

  const promise = fetchTransactions(
    addr,
    {
      ...(comboState.networks.length
        ? { networks: comboState.networks.join(",") }
        : {}),
      page: pageNum,
      limit: PAGE_SIZE,
      minUsd: 0,
      spamFilter: "hard",
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    },
    0,
    "useTransactionPagination"
  )
    .then(({ rows, hasNext, page: respPage, nextCursor }) => {
      // Chunk all returned rows into PAGE_SIZE pages starting at the response page
      const startPage = respPage ?? pageNum;
      const chunks: TxRow[][] = [];
      for (let i = 0; i < rows.length; i += PAGE_SIZE) {
        chunks.push(rows.slice(i, i + PAGE_SIZE));
      }

      chunks.forEach((chunk, idx) => {
        const logicalPage = startPage + idx;
        if (!comboState.rawPages.has(logicalPage)) {
          const isLastChunk = idx === chunks.length - 1;
          comboState.rawPages.set(logicalPage, {
            rows: chunk,
            // If there are more chunks or backend indicates more, mark hasNext true
            hasNext: !isLastChunk || hasNext === true,
          });
        }
      });

      // Save next cursor for continuation (used in step 3)
      comboState.rawNextCursor = nextCursor ?? null;

      // Dev-only summary log
      if (process.env.NODE_ENV === 'development') {
        console.log(
          `[Transactions] 📦 Buffered ${rows.length} legs into ${chunks.length} page(s) starting at ${startPage}`
        );
      }

      comboState.rawPromises.delete(pageNum);
      // Return the specifically requested page if populated; otherwise the last chunked page
      if (comboState.rawPages.has(pageNum)) {
        return comboState.rawPages.get(pageNum)!;
      }
      const lastLogical = startPage + Math.max(0, chunks.length - 1);
      return comboState.rawPages.get(lastLogical)!;
    })
    .catch((error) => {
      comboState.rawPromises.delete(pageNum);
      throw error;
    });

  comboState.rawPromises.set(pageNum, promise);
  return promise;
};

const collectFilteredPage = async (
  addr: string,
  comboState: ComboState,
  types: TxType[] | ["all"],
  pageNum: number,
  from?: string,
  to?: string
): Promise<FilteredPagePayload> => {
  const cacheKey = getFilteredKey(types, pageNum);
  const cached = comboState.filteredPages.get(cacheKey);
  if (cached) {
    return cached;
  }

  const baseKey = getFilteredBaseKey(types);

  if (!Array.isArray(types) || (types as any)[0] === "all") {
    const raw = await ensureRawPage(addr, comboState, pageNum, from, to);
    const payload: FilteredPagePayload = {
      rows: raw.rows,
      hasNext: raw.hasNext,
      resolvedPage: pageNum,
    };
    comboState.filteredPages.set(cacheKey, payload);
    return payload;
  }

  const selectedSet = new Set(types as TxType[]);
  const rowsAccum: TxRow[] = [];
  const limit = PAGE_SIZE;
  let rawPageIndex = 1;
  let remainingToSkip = Math.max(0, (pageNum - 1) * limit);
  let hasMoreFiltered = false;
  let lastRawHasNext = false;
  let filteredSeen = 0;

  while (rowsAccum.length < limit) {
    const { rows: rawRows, hasNext: rawHasNext } = await ensureRawPage(
      addr,
      comboState,
      rawPageIndex,
      from,
      to
    );
    lastRawHasNext = rawHasNext;
    const filtered = rawRows.filter((row) => selectedSet.has(row.type));
    filteredSeen += filtered.length;

    if (remainingToSkip > 0) {
      if (remainingToSkip >= filtered.length) {
        remainingToSkip -= filtered.length;
      } else {
        const sliceStart = remainingToSkip;
        remainingToSkip = 0;
        const available = filtered.slice(sliceStart);
        const slots = limit - rowsAccum.length;
        if (available.length > slots) {
          rowsAccum.push(...available.slice(0, slots));
          hasMoreFiltered = true;
          break;
        } else {
          rowsAccum.push(...available);
        }
      }
    } else if (filtered.length) {
      const slots = limit - rowsAccum.length;
      if (filtered.length > slots) {
        rowsAccum.push(...filtered.slice(0, slots));
        hasMoreFiltered = true;
        break;
      } else {
        rowsAccum.push(...filtered);
      }
    }

    if (!rawHasNext) {
      break;
    }
    rawPageIndex += 1;
  }

  let hasNextFiltered = false;
  if (hasMoreFiltered) {
    hasNextFiltered = true;
  } else if (rowsAccum.length === limit) {
    if (lastRawHasNext) {
      let probeIndex = rawPageIndex;
      while (true) {
        const { rows: probeRows, hasNext: probeHasNext } =
          await ensureRawPage(addr, comboState, probeIndex, from, to);
        const probeFiltered = probeRows.filter((row) =>
          selectedSet.has(row.type)
        );
        if (probeFiltered.length > 0) {
          hasNextFiltered = true;
          break;
        }
        if (!probeHasNext) {
          hasNextFiltered = false;
          break;
        }
        probeIndex += 1;
      }
    } else {
      hasNextFiltered = false;
    }
  } else {
    hasNextFiltered = false;
  }

  const exhausted = remainingToSkip > 0 && !lastRawHasNext;

  if (exhausted) {
    const totalFiltered = filteredSeen;
    const maxPage =
      totalFiltered === 0
        ? 1
        : Math.max(1, Math.ceil(totalFiltered / limit));
    comboState.filteredTotals.set(baseKey, {
      total: totalFiltered,
      maxPage,
    });
    const fallbackPage = Math.min(pageNum, maxPage);

    if (fallbackPage < pageNum) {
      const fallbackKey = getFilteredKey(types, fallbackPage);
      let fallbackPayload = comboState.filteredPages.get(fallbackKey);
      if (!fallbackPayload) {
        fallbackPayload = await collectFilteredPage(
          addr,
          comboState,
          types,
          fallbackPage,
          from,
          to
        );
      }
      const payload: FilteredPagePayload = {
        rows: fallbackPayload.rows,
        hasNext: fallbackPayload.hasNext,
        resolvedPage: fallbackPayload.resolvedPage,
        exhausted: true,
        totalFiltered,
      };
      comboState.filteredPages.set(cacheKey, payload);
      return payload;
    }
  }

  const payload: FilteredPagePayload = {
    rows: rowsAccum,
    hasNext: hasNextFiltered,
    resolvedPage: pageNum,
    exhausted,
    totalFiltered: exhausted ? filteredSeen : undefined,
  };
  comboState.filteredPages.set(cacheKey, payload);
  return payload;
};

// Hook interface
export interface UseTransactionPaginationOptions {
  address?: string;
  networks: string[];
  selectedTypes: TxType[] | ["all"];
  refreshKey?: number;
  from?: string; // ISO8601 date string
  to?: string; // ISO8601 date string
}

export interface UseTransactionPaginationReturn {
  rows: TxRow[];
  page: number;
  hasNext: boolean;
  loading: boolean;
  error: string | null;
  setPage: (page: number) => void;
  goPrev: () => void;
  goNext: () => void;
  refresh: () => void;
}

export function useTransactionPagination({
  address,
  networks,
  selectedTypes,
  refreshKey = 0,
  from,
  to,
}: UseTransactionPaginationOptions): UseTransactionPaginationReturn {
  const [rows, setRows] = useState<TxRow[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadTokenRef = useRef(0);

  const networkKey = useMemo(() => makeNetworkKey(networks), [networks]);

  // Track ongoing preloads and regular loads to prevent duplicates
  const preloadPromises = useRef<Map<number, Promise<void>>>(new Map());
  const activeLoads = useRef<Map<number, Promise<any>>>(new Map());

  const preloadNextPage = async (nextPage: number, comboState: ComboState) => {
    if (!address) return;
    const cacheKey = getFilteredKey(selectedTypes, nextPage);
    if (comboState.filteredPages.has(cacheKey)) {
      return;
    }

    // Prevent duplicate preload requests
    if (preloadPromises.current.has(nextPage)) {
      return preloadPromises.current.get(nextPage);
    }

    // Also check if a regular load is already in progress for this page
    if (activeLoads.current.has(nextPage)) {
      return;
    }

    const preloadPromise = (async () => {
      try {
        await collectFilteredPage(address, comboState, selectedTypes, nextPage, from, to);
      } catch {
        // Silently fail preloads
      } finally {
        preloadPromises.current.delete(nextPage);
      }
    })();

    preloadPromises.current.set(nextPage, preloadPromise);
    return preloadPromise;
  };

  const load = async (p: number, allowFallbackToLastPage: boolean = false) => {
    if (!address) return;

    const loadStartTime = performance.now();

    const networkList = [...networks];
    const comboState = ensureComboState(address, networkList, from, to);
    const filteredKey = getFilteredKey(selectedTypes, p);
    const cached = comboState.filteredPages.get(filteredKey);

    const token = ++loadTokenRef.current;

    if (cached) {
      const resolvedPage = cached.resolvedPage ?? p;
      if (resolvedPage !== page) {
        setPage(resolvedPage);
      }
      setRows(cached.rows);
      setHasNext(cached.hasNext);
      // Preload next page from cache (fast, so safe to do immediately)
      if (cached.hasNext) {
        setTimeout(() => {
          preloadNextPage(resolvedPage + 1, comboState);
        }, 100);
      }
      return;
    }

    // If requested page is not cached and fallback is allowed (filter change),
    // find the last cached page for this filter and display it.
    // Otherwise (normal navigation), load the requested page directly.
    if (allowFallbackToLastPage) {
      const lastCachedPage = findLastCachedPageForFilter(comboState, selectedTypes);
      
      if (lastCachedPage > 0) {
        // Display the last cached page
        const lastCachedKey = getFilteredKey(selectedTypes, lastCachedPage);
        const lastCached = comboState.filteredPages.get(lastCachedKey);
        if (lastCached) {
          const resolvedPage = lastCached.resolvedPage ?? lastCachedPage;
          if (resolvedPage !== page) {
            setPage(resolvedPage);
          }
          setRows(lastCached.rows);
          setHasNext(lastCached.hasNext);
          if (lastCached.hasNext) {
            preloadNextPage(resolvedPage + 1, comboState);
          }
          return;
        }
      }
    }

    // Load the requested page directly (normal navigation) or page 1 (filter change with no cache)
    const pageToLoad = allowFallbackToLastPage && p > 1 ? 1 : p;
    
    // Prevent duplicate loads for the same page
    if (activeLoads.current.has(pageToLoad)) {
      const existingPromise = activeLoads.current.get(pageToLoad);
      try {
        await existingPromise;
      } catch {
        // Ignore errors from duplicate load
      }
      return;
    }
    
    setLoading(true);
    setError(null);
    const fetchStartTime = performance.now();
    
    const loadPromise = (async () => {
      try {
        return await collectFilteredPage(
          address,
          comboState,
          selectedTypes,
          pageToLoad,
          from,
          to
        );
      } finally {
        activeLoads.current.delete(pageToLoad);
      }
    })();
    
    activeLoads.current.set(pageToLoad, loadPromise);
    
    try {
      const result = await loadPromise;
      const fetchTime = performance.now() - fetchStartTime;
      if (loadTokenRef.current !== token) {
        return;
      }
      const resolvedPage = result.resolvedPage ?? pageToLoad;
      const totalTime = performance.now() - loadStartTime;
      setRows(result.rows);
      setHasNext(result.hasNext);
      if (resolvedPage !== page) {
        setPage(resolvedPage);
      }
      // Preload next page only if current page loaded quickly (< 5s) to avoid overloading
      const shouldPreload = fetchTime < 5000 && result.hasNext;
      if (shouldPreload) {
        // Delay preload slightly to not interfere with current request
        setTimeout(() => {
          preloadNextPage(resolvedPage + 1, comboState);
        }, 500);
      }
    } catch (e: any) {
      if (loadTokenRef.current !== token) {
        return;
      }
      if (process.env.NODE_ENV === 'development') {
        console.error(`[Transactions] ❌ Error loading page ${pageToLoad}:`, e?.message || String(e));
      }
      setError(e?.message || "Failed to load transactions");
      setRows([]);
      setHasNext(false);
    } finally {
      if (loadTokenRef.current === token) {
        setLoading(false);
      }
    }
  };

  // Load on address/refresh/date range change
  useEffect(() => {
    if (!address) return;
    setPage(1);
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, refreshKey, from, to]);

  // Load on filter/network change (but not on page change to avoid duplicates)
  useEffect(() => {
    if (!address) return;
    // Only reload if filters/networks changed, not if page changed
    // This prevents duplicate loads when page changes via goNext/goPrev
    load(page, true); // Allow fallback to last cached page when filter changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(selectedTypes), networkKey]);

  const goPrev = () => {
    const p = Math.max(1, page - 1);
    if (p === page) return; // Already on first page
    setPage(p);
    load(p, false); // Normal navigation: no fallback, show loading state
  };

  const goNext = () => {
    const p = page + 1;
    if (!hasNext && p > page) return; // No next page available
    setPage(p);
    load(p, false); // Normal navigation: no fallback, show loading state
  };

  const refresh = () => {
    if (address) {
      clearComboStatesForAddress(address);
    }
    setPage(1);
    load(1, false); // Refresh: no fallback, show loading state
  };

  return {
    rows,
    page,
    hasNext,
    loading,
    error,
    setPage: (p: number) => {
      if (p === page) return; // Avoid reloading same page
      setPage(p);
      load(p, false); // Normal navigation: no fallback, show loading state
    },
    goPrev,
    goNext,
    refresh,
  };
}

