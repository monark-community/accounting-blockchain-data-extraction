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

  const promise = fetchTransactions(addr, {
    ...(comboState.networks.length
      ? { networks: comboState.networks.join(",") }
      : {}),
    page: pageNum,
    limit: PAGE_SIZE,
    minUsd: 0,
    spamFilter: "hard",
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  })
    .then(({ rows, hasNext }) => {
      const payload = { rows, hasNext };
      comboState.rawPages.set(pageNum, payload);
      comboState.rawPromises.delete(pageNum);
      return payload;
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

  const preloadNextPage = async (nextPage: number, comboState: ComboState) => {
    if (!address) return;
    const cacheKey = getFilteredKey(selectedTypes, nextPage);
    if (comboState.filteredPages.has(cacheKey)) {
      return;
    }

    try {
      await collectFilteredPage(address, comboState, selectedTypes, nextPage, from, to);
    } catch (e) {
      console.debug("[Prefetch] Failed to preload page", nextPage, e);
    }
  };

  const load = async (p: number, allowFallbackToLastPage: boolean = false) => {
    if (!address) return;

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
      if (cached.hasNext) {
        preloadNextPage(resolvedPage + 1, comboState);
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
    setLoading(true);
    setError(null);
    try {
      const result = await collectFilteredPage(
        address,
        comboState,
        selectedTypes,
        pageToLoad,
        from,
        to
      );
      if (loadTokenRef.current !== token) {
        return;
      }
      const resolvedPage = result.resolvedPage ?? pageToLoad;
      setRows(result.rows);
      setHasNext(result.hasNext);
      if (resolvedPage !== page) {
        setPage(resolvedPage);
      }
      if (result.hasNext) {
        preloadNextPage(resolvedPage + 1, comboState);
      }
    } catch (e: any) {
      if (loadTokenRef.current !== token) {
        return;
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

  // Load on filter change
  useEffect(() => {
    if (!address) return;
    load(page, true); // Allow fallback to last cached page when filter changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(selectedTypes), networkKey, from, to]);

  const goPrev = () => {
    const p = Math.max(1, page - 1);
    setPage(p);
    load(p, false); // Normal navigation: no fallback, show loading state
  };

  const goNext = () => {
    const p = page + 1;
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
      setPage(p);
      load(p, false); // Normal navigation: no fallback, show loading state
    },
    goPrev,
    goNext,
    refresh,
  };
}

