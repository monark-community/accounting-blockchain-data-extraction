import { useEffect, useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Eye,
  ExternalLink,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Repeat,
  Fuel,
} from "lucide-react";

import type { TxRow, TxType } from "@/lib/types/transactions";
import { fetchTransactions } from "@/lib/api/transactions";

// --- UI helpers
const fmtUSD = (n: number | null | undefined) =>
  n == null
    ? "—"
    : n.toLocaleString(undefined, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      });
const fmtQty = (qty: string, dir: "in" | "out") =>
  `${dir === "in" ? "+" : "-"}${qty}`;
const shortAddr = (a?: string | null) =>
  a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—";
const typeColor = (t: TxType) =>
  ({
    income: "text-green-600",
    expense: "text-red-600",
    swap: "text-blue-600",
    gas: "text-amber-600",
  }[t]);
const typeIcon = (t: TxType) =>
  t === "income" ? (
    <TrendingUp className="w-4 h-4" />
  ) : t === "expense" ? (
    <TrendingDown className="w-4 h-4" />
  ) : t === "swap" ? (
    <Repeat className="w-4 h-4" />
  ) : t === "gas" ? (
    <Fuel className="w-4 h-4" />
  ) : null;

const explorerBase = (network?: string) => {
  switch ((network || "").toLowerCase()) {
    case "mainnet":
    case "ethereum":
      return "https://etherscan.io";
    case "sepolia":
    case "eth-sepolia":
      return "https://sepolia.etherscan.io";
    case "base":
      return "https://basescan.org";
    case "polygon":
      return "https://polygonscan.com";
    case "bsc":
      return "https://bscscan.com";
    case "optimism":
      return "https://optimistic.etherscan.io";
    case "arbitrum-one":
      return "https://arbiscan.io";
    case "avalanche":
      return "https://snowtrace.io";
    case "unichain":
      return "https://uniscan.xyz";
  }
};
const etherscanTxUrl = (hash: string, network?: string) =>
  `${explorerBase(network)}/tx/${hash}`;
const networkLabel = (network?: string) => {
  switch ((network || "").toLowerCase()) {
    case "mainnet":
    case "ethereum":
      return "Ethereum";
    case "sepolia":
    case "eth-sepolia":
      return "Sepolia";
    case "base":
      return "Base";
    case "polygon":
      return "Polygon";
    case "bsc":
      return "BSC";
    case "optimism":
      return "Optimism";
    case "arbitrum-one":
      return "Arbitrum";
    case "avalanche":
      return "Avalanche";
    case "unichain":
      return "Unichain";
    default:
      return network || "Unknown";
  }
};

// Map UI chip → backend class= param
function uiTypesToClassParam(selected: TxType[] | ["all"]): string | null {
  if (!Array.isArray(selected) || (selected as any)[0] === "all") return null;
  const set = new Set<TxType>(selected as TxType[]);
  const classes: string[] = [];
  if (set.has("swap")) classes.push("swap_in", "swap_out");
  if (set.has("income"))
    classes.push("transfer_in", "nft_transfer_in", "nft_buy", "income");
  if (set.has("expense"))
    classes.push("transfer_out", "nft_transfer_out", "nft_sell", "expense");
  // NOTE: "gas" isn’t a leg row today; we show fees per tx in the row. Leaving out.
  return classes.length ? classes.join(",") : null;
}

const PAGE_SIZE = 20;

export interface AllTransactionsTabPersistedState {
  rows: TxRow[];
  page: number;
  hasNext: boolean;
  selectedTypes: TxType[] | ["all"];
  visibleColumns: Record<
    "type" | "date" | "network" | "asset" | "qty" | "usd" | "counterparty" | "tx",
    boolean
  >;
  filteredCacheEntries: Array<[string, { rows: TxRow[]; hasNext: boolean }]>;
  rawCacheEntries?: Array<[string, { rows: TxRow[]; hasNext: boolean }]>;
  refreshKey: number;
  error: string | null;
}

interface AllTransactionsTabProps {
  address?: string;
  persistedState?: AllTransactionsTabPersistedState | null;
  onPersist?: (address: string, state: AllTransactionsTabPersistedState) => void;
}

export default function AllTransactionsTab({
  address: propAddress,
  persistedState,
  onPersist,
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

  // Server data & pagination
  const [rows, setRows] = useState<TxRow[]>(() => persistedState?.rows ?? []);
  const [page, setPage] = useState(() => persistedState?.page ?? 1);
  const [hasNext, setHasNext] = useState<boolean>(
    () => persistedState?.hasNext ?? false
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    () => persistedState?.error ?? null
  );
  const [refreshKey, setRefreshKey] = useState(
    () => persistedState?.refreshKey ?? 0
  );

  // Cache for pages: key = "address:filterKey:page" -> { rows, hasNext }
  const filteredPageCache = useRef(
    new Map<string, { rows: TxRow[]; hasNext: boolean }>(
      persistedState?.filteredCacheEntries ?? []
    )
  );
  const rawPageCache = useRef(
    new Map<string, { rows: TxRow[]; hasNext: boolean }>(
      persistedState?.rawCacheEntries ?? []
    )
  );
  const skipInitialLoadRef = useRef<number>(persistedState ? 2 : 0);
  const skipFilterLoadRef = useRef<number>(persistedState ? 2 : 0);

  // Simple filter chip state
  const [selectedTypes, setSelectedTypes] = useState<TxType[] | ["all"]>(
    () => persistedState?.selectedTypes ?? (["all"] as any)
  );

  // Visible columns
  const visibleColumnsInit = {
    type: true,
    date: true,
    network: true,
    asset: true,
    qty: true,
    usd: true,
    counterparty: true,
    tx: true,
  } as const;
  const [visibleColumns, setVisibleColumns] = useState<
    Record<keyof typeof visibleColumnsInit, boolean>
  >(
    () =>
      persistedState?.visibleColumns
        ? { ...persistedState.visibleColumns }
        : { ...visibleColumnsInit }
  );

  // Generate cache key for current filters
  const getFilterKey = () => JSON.stringify(selectedTypes);
  const getFilteredCacheKey = (addr: string, filterKey: string, pageNum: number) =>
    `${addr}:${filterKey}:${pageNum}`;
  const getRawCacheKey = (addr: string, pageNum: number) => `${addr}:${pageNum}`;
  const getCacheKey = (addr: string, pageNum: number) =>
    getFilteredCacheKey(addr, getFilterKey(), pageNum);
  const getFilteredPage = (addr: string, filterKey: string, pageNum: number) =>
    filteredPageCache.current.get(getFilteredCacheKey(addr, filterKey, pageNum));
  const setFilteredPage = (
    addr: string,
    filterKey: string,
    pageNum: number,
    value: { rows: TxRow[]; hasNext: boolean }
  ) => {
    filteredPageCache.current.set(
      getFilteredCacheKey(addr, filterKey, pageNum),
      value
    );
  };
  const ensureRawPage = async (
    addr: string,
    pageNum: number
  ): Promise<{ rows: TxRow[]; hasNext: boolean }> => {
    const cacheKey = getRawCacheKey(addr, pageNum);
    const cached = rawPageCache.current.get(cacheKey);
    if (cached) return cached;

    const { rows: rawRows, hasNext: rawHasNext } = await fetchTransactions(
      addr,
      {
        networks: "mainnet",
        page: pageNum,
        limit: PAGE_SIZE,
        minUsd: 0,
        spamFilter: "soft",
      }
    );
    const stored = { rows: rawRows, hasNext: rawHasNext };
    rawPageCache.current.set(cacheKey, stored);
    return stored;
  };
  const collectFilteredPage = async (
    addr: string,
    pageNum: number
  ): Promise<{ rows: TxRow[]; hasNext: boolean }> => {
    const filterKey = getFilterKey();
    const cached = getFilteredPage(addr, filterKey, pageNum);
    if (cached) return cached;

    const isAllSelected =
      !Array.isArray(selectedTypes) || (selectedTypes as any)[0] === "all";

    if (isAllSelected) {
      const rawPage = await ensureRawPage(addr, pageNum);
      setFilteredPage(addr, filterKey, pageNum, rawPage);
      return rawPage;
    }

    const selectedSet = new Set(
      Array.isArray(selectedTypes) && (selectedTypes as any)[0] !== "all"
        ? (selectedTypes as TxType[])
        : []
    );

    const rowsAccum: TxRow[] = [];
    const limit = PAGE_SIZE;
    let remainingToSkip = Math.max(0, (pageNum - 1) * limit);
    let rawPageIndex = 1;
    let hasMoreFiltered = false;
    let lastRawHasNext = false;

    while (rowsAccum.length < limit) {
      const { rows: rawRows, hasNext: rawHasNext } = await ensureRawPage(
        addr,
        rawPageIndex
      );
      lastRawHasNext = rawHasNext;
      const filtered = rawRows.filter((row) => selectedSet.has(row.type));

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
          const { rows: probeRows, hasNext: probeHasNext } = await ensureRawPage(
            addr,
            probeIndex
          );
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

    const payload = { rows: rowsAccum, hasNext: hasNextFiltered };
    setFilteredPage(addr, filterKey, pageNum, payload);
    return payload;
  };

  // Load current page (with cache check)
  async function load(
    p: number,
    options: {
      forceHasNext?: boolean;
    } = {}
  ) {
    if (!address) return;
    
    // Check cache first
    setLoading(true);
    setError(null);
    try {
      const { rows: filteredRows, hasNext: filteredHasNext } =
        await collectFilteredPage(address, p);
      const finalHasNext =
        typeof options.forceHasNext === "boolean"
          ? options.forceHasNext
          : filteredHasNext;

      if (filteredRows.length === 0 && p > 1) {
        const prevPage = p - 1;
        const prevKey = getCacheKey(address, prevPage);
        const prevCached = filteredPageCache.current.get(prevKey);
        filteredPageCache.current.delete(prevKey);
        setHasNext(false);
        setPage(prevPage);
        if (prevCached) {
          filteredPageCache.current.set(prevKey, {
            rows: prevCached.rows,
            hasNext: false,
          });
          setRows(prevCached.rows);
          return;
        }
        return load(prevPage, { forceHasNext: false });
      }

      setRows(filteredRows);
      setHasNext(finalHasNext);
      
      // Prefetch next page in background (if available)
      if (finalHasNext) {
        preloadNextPage(p + 1);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load transactions");
      setRows([]);
      setHasNext(false);
    } finally {
      setLoading(false);
    }
  }

  // Preload next page in background (silent, no loading state)
  async function preloadNextPage(nextPage: number) {
    if (!address) return;
    
    // Check if already cached
    const cacheKey = getCacheKey(address, nextPage);
    if (filteredPageCache.current.has(cacheKey)) {
      return; // Already cached
    }
    
    try {
      await collectFilteredPage(address, nextPage);
    } catch (e) {
      console.debug("[Prefetch] Failed to preload page", nextPage, e);
    }
  }

  // Initial/refresh - clear cache when address or filters change
  useEffect(() => {
    if (!address) return;
    if (skipInitialLoadRef.current > 0) {
      skipInitialLoadRef.current -= 1;
      return;
    }
    setPage(1);
    filteredPageCache.current.clear(); // Clear cache when address or filters change
    rawPageCache.current.clear();
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, refreshKey]);

  // When server-side class filter changes (chips), reload current page with new filter
  useEffect(() => {
    if (!address) return;
    if (skipFilterLoadRef.current > 0) {
      skipFilterLoadRef.current -= 1;
      return;
    }
    // Don't clear cache - it's already organized by filter via getCacheKey
    // This allows instant navigation when returning to previously visited filters
    // Load current page with new filter (if page doesn't exist, backend will handle it)
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(selectedTypes)]);

  // Persist state whenever key pieces change
  useEffect(() => {
    if (!onPersist || !address) return;
    const snapshotSelectedTypes = Array.isArray(selectedTypes)
      ? ([...selectedTypes] as TxType[] | ["all"])
      : (["all"] as ["all"]);
    const snapshotVisibleColumns = { ...visibleColumns };
    const snapshotFilteredCache = Array.from(
      filteredPageCache.current.entries()
    ).map(
      ([key, value]) =>
        [
          key,
          { rows: value.rows, hasNext: value.hasNext },
        ] as [string, { rows: TxRow[]; hasNext: boolean }]
    );
    const snapshotRawCache = Array.from(rawPageCache.current.entries()).map(
      ([key, value]) =>
        [
          key,
          { rows: value.rows, hasNext: value.hasNext },
        ] as [string, { rows: TxRow[]; hasNext: boolean }]
    );
    onPersist(address, {
      rows,
      page,
      hasNext,
      selectedTypes: snapshotSelectedTypes,
      visibleColumns: snapshotVisibleColumns,
      filteredCacheEntries: snapshotFilteredCache,
      rawCacheEntries: snapshotRawCache,
      refreshKey,
      error,
    });
  }, [
    onPersist,
    address,
    rows,
    page,
    hasNext,
    selectedTypes,
    visibleColumns,
    refreshKey,
    error,
  ]);

  // Navigation controls (optimistic pagination)
  const canPrev = page > 1;
  const canNext = hasNext;
  const goPrev = () => {
    const p = Math.max(1, page - 1);
    setPage(p);
    load(p);
  };
  const goNext = () => {
    const p = page + 1;
    setPage(p);
    load(p);
  };

  // Export helpers (unchanged from your file)
  const nowStamp = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(
      d.getHours()
    )}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  };
  const shortForFile = (a: string) =>
    a ? `${a.slice(0, 6)}_${a.slice(-4)}` : "wallet";
  type Scope = "visible" | "loaded";
  function mapTxForCsv(tx: TxRow) {
    return {
      date_iso: tx.ts,
      type: tx.type,
      direction: tx.direction,
      asset: tx.asset?.symbol ?? "",
      contract: tx.asset?.contract ?? "",
      decimals: tx.asset?.decimals ?? "",
      qty: tx.qty ?? "",
      price_usd_at_ts: tx.priceUsdAtTs ?? "",
      usd_at_ts: tx.usdAtTs ?? "",
      network: tx.network ?? "",
      tx_hash: tx.hash ?? "",
      counterparty: tx.counterparty?.address ?? "",
      counterparty_label: tx.counterparty?.label ?? "",
    };
  }
  function toCsv(rows: ReturnType<typeof mapTxForCsv>[]) {
    const headers = Object.keys(rows[0] ?? { date_iso: "", type: "" });
    const escape = (v: any) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      headers.join(","),
      ...rows.map((r) => headers.map((h) => escape((r as any)[h])).join(",")),
    ].join("\n");
    return new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), lines], {
      type: "text/csv;charset=utf-8",
    });
  }
  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  function exportCsv(
    address: string,
    rows: TxRow[],
    scope: Scope,
    typeLabel: string
  ) {
    if (!rows?.length) return;
    const blob = toCsv(rows.map(mapTxForCsv));
    downloadBlob(
      blob,
      `ledgerlift_${shortForFile(
        address
      )}_${typeLabel}_${nowStamp()}_${scope}.csv`
    );
  }
  function exportJson(
    address: string,
    rows: TxRow[],
    scope: Scope,
    typeLabel: string
  ) {
    if (!rows?.length) return;
    const blob = new Blob([JSON.stringify(rows, null, 2)], {
      type: "application/json",
    });
    downloadBlob(
      blob,
      `ledgerlift_${shortForFile(
        address
      )}_${typeLabel}_${nowStamp()}_${scope}.json`
    );
  }

  // Filters UI helpers
  const toggleType = (t: TxType | "all", checked: boolean) => {
    if (t === "all") {
      return setSelectedTypes(checked ? (["all"] as any) : ([] as any));
    }
    setSelectedTypes((prev: any) => {
      const arr: TxType[] =
        Array.isArray(prev) && prev[0] !== "all" ? prev : [];
      const next = checked ? [...arr, t] : arr.filter((x) => x !== t);
      return next.length ? next : (["all"] as any);
    });
  };
  const visibleRows = rows;
  const typeLabelForExport =
    (selectedTypes as any)[0] === "all"
      ? "all"
      : (selectedTypes as TxType[]).join("-");

  return (
    <div className="space-y-6">
      <Card className="bg-white shadow-sm">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-slate-800">
              All Transactions {address ? "" : "(load an address)"}
            </h3>
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center text-xs text-slate-600 mr-2">
                {loading ? (
                  <span className="font-medium">Loading...</span>
                ) : (
                  <span className="font-medium">
                    Page {page}
                    {!hasNext && rows.length > 0 ? " (end of list)" : ""}
                  </span>
                )}
              </div>

              {/* Columns & Export */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Eye className="w-4 h-4 mr-2" /> Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {(
                    Object.keys(visibleColumns) as Array<
                      keyof typeof visibleColumnsInit
                    >
                  ).map((key) => (
                    <DropdownMenuCheckboxItem
                      key={key}
                      checked={visibleColumns[key]}
                      onCheckedChange={(checked) =>
                        setVisibleColumns((prev) => ({
                          ...prev,
                          [key]: !!checked,
                        }))
                      }
                    >
                      {String(key).charAt(0).toUpperCase() +
                        String(key).slice(1)}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <button
                    className="w-full text-left px-2 py-1.5 hover:bg-slate-50"
                    onClick={() =>
                      exportCsv(
                        address,
                        visibleRows,
                        "visible",
                        typeLabelForExport
                      )
                    }
                  >
                    CSV (visible)
                  </button>
                  <div className="h-px bg-slate-200 my-1" />
                  <button
                    className="w-full text-left px-2 py-1.5 hover:bg-slate-50"
                    onClick={() =>
                      exportJson(
                        address,
                        visibleRows,
                        "visible",
                        typeLabelForExport
                      )
                    }
                  >
                    JSON (visible)
                  </button>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="hidden sm:flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (canPrev) {
                      goPrev();
                    }
                  }}
                  disabled={!canPrev || loading}
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (canNext) {
                      goNext();
                    }
                  }}
                  disabled={!canNext || loading}
                >
                  Next
                </Button>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setRefreshKey((k) => k + 1)}
                disabled={loading}
              >
                <RefreshCw
                  className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
                />{" "}
                Refresh
              </Button>
            </div>
          </div>

          {/* Filter chips (server-side class filter) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="type-all"
                checked={(selectedTypes as any)[0] === "all"}
                onCheckedChange={(c) => toggleType("all", !!c)}
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
                    Array.isArray(selectedTypes) &&
                    (selectedTypes as any)[0] !== "all"
                      ? (selectedTypes as TxType[]).includes(t as TxType)
                      : false
                  }
                  onCheckedChange={(c) => toggleType(t as TxType, !!c)}
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

        {/* Status */}
        {!address && (
          <div className="p-6 text-sm text-slate-500">
            Enter an address on the Overview tab to load transactions.
          </div>
        )}
        {address && loading && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {visibleColumns.type && <TableHead>Type</TableHead>}
                  {visibleColumns.date && <TableHead>Date</TableHead>}
                  {visibleColumns.network && <TableHead>Network</TableHead>}
                  {visibleColumns.asset && <TableHead>Asset</TableHead>}
                  {visibleColumns.qty && <TableHead>Qty</TableHead>}
                  {visibleColumns.usd && <TableHead>USD @ time</TableHead>}
                  {visibleColumns.counterparty && (
                    <TableHead>Counterparty</TableHead>
                  )}
                  {visibleColumns.tx && <TableHead>Tx</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(6)].map((_, i) => (
                  <TableRow key={i}>
                    {Object.keys(visibleColumns).map((k) =>
                      visibleColumns[k as keyof typeof visibleColumns] ? (
                        <TableCell key={k}>
                          <Skeleton className="h-4 w-28" />
                        </TableCell>
                      ) : null
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {address && error && (
          <div className="p-6 text-sm text-red-600">{error}</div>
        )}

        {/* Table */}
        {address && !loading && rows.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {visibleColumns.type && <TableHead>Type</TableHead>}
                  {visibleColumns.date && <TableHead>Date</TableHead>}
                  {visibleColumns.network && <TableHead>Network</TableHead>}
                  {visibleColumns.asset && <TableHead>Asset</TableHead>}
                  {visibleColumns.qty && <TableHead>Qty</TableHead>}
                  {visibleColumns.usd && <TableHead>USD @ time</TableHead>}
                  {visibleColumns.counterparty && (
                    <TableHead>Counterparty</TableHead>
                  )}
                  {visibleColumns.tx && <TableHead>Tx</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((tx, idx) => (
                  <TableRow key={`${tx.hash}-${idx}`}>
                    {visibleColumns.type && (
                      <TableCell>
                        <div
                          className={`flex items-center gap-2 ${typeColor(
                            tx.type
                          )}`}
                        >
                          {typeIcon(tx.type)}
                          <span className="capitalize text-xs font-medium">
                            {tx.type}
                          </span>
                        </div>
                      </TableCell>
                    )}
                    {visibleColumns.date && (
                      <TableCell className="font-medium">
                        {new Date(tx.ts).toLocaleString()}
                      </TableCell>
                    )}
                    {visibleColumns.network && (
                      <TableCell className="font-mono">
                        {networkLabel(tx.network)}
                      </TableCell>
                    )}
                    {visibleColumns.asset && (
                      <TableCell className="font-mono">
                        {tx.asset?.symbol ||
                          (tx.asset?.contract
                            ? shortAddr(tx.asset.contract)
                            : "—")}
                      </TableCell>
                    )}
                    {visibleColumns.qty && (
                      <TableCell
                        className={`font-mono ${
                          tx.direction === "in"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {fmtQty(tx.qty, tx.direction)}
                      </TableCell>
                    )}
                    {visibleColumns.usd && (
                      <TableCell className="font-mono">
                        {fmtUSD(tx.usdAtTs)}
                      </TableCell>
                    )}
                    {visibleColumns.counterparty && (
                      <TableCell className="font-mono">
                        {tx.counterparty?.label ||
                          shortAddr(tx.counterparty?.address || undefined)}
                      </TableCell>
                    )}
                    {visibleColumns.tx && (
                      <TableCell>
                        <a
                          className="inline-flex items-center gap-1 text-xs font-mono underline text-slate-700 hover:text-slate-900"
                          href={etherscanTxUrl(tx.hash, tx.network)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {shortAddr(tx.hash)}{" "}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pager footer (mobile) */}
            <div className="flex sm:hidden justify-end gap-2 p-3">
              <Button
                variant="outline"
                size="sm"
                onClick={goPrev}
                disabled={!canPrev}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={goNext}
                disabled={!canNext}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
