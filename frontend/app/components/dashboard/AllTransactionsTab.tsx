import { useEffect, useMemo, useState, useRef, useCallback } from "react";
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
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
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
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from "recharts";

import type { TxRow, TxType } from "@/lib/types/transactions";
import { fetchTransactions } from "@/lib/api/transactions";
import {
  NETWORK_OPTIONS,
  NETWORK_IDS,
  PRIMARY_NETWORK_ID,
  networkLabel,
  normalizeNetworkList,
} from "@/lib/networks";
import {
  CapitalGainsCalculator,
  type AccountingMethod,
  type CapitalGainEntry,
  type CostBasisEntry,
  type UnmatchedSale,
} from "@/utils/capitalGains";

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
    income: "text-emerald-600",
    expense: "text-rose-600",
    swap: "text-indigo-600",
    gas: "text-sky-600",
  }[t] ?? "text-slate-600");
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
const STABLE_SYMBOLS = new Set([
  "USDT",
  "USDC",
  "DAI",
  "FRAX",
  "LUSD",
  "PYUSD",
  "BUSD",
]);
const DAY_MS = 24 * 60 * 60 * 1000;
const fmtPct = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)}%`;
};
const etherscanTxUrl = (hash: string, network?: string) =>
  `${explorerBase(network)}/tx/${hash}`;
const DEFAULT_NETWORKS: string[] = [PRIMARY_NETWORK_ID];

function parseNetworkQuery(value?: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
}

function startOfYearIso(year: number): string {
  return new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)).toISOString();
}

function endOfYearIso(year: number): string {
  return new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)).toISOString();
}

function isoFromDateInput(value: string, opts?: { endOfDay?: boolean }) {
  if (!value) return undefined;
  const parts = value.split("-").map((p) => Number(p));
  if (parts.length !== 3) return undefined;
  const [y, m, d] = parts;
  if ([y, m, d].some((n) => Number.isNaN(n))) return undefined;
  return new Date(
    Date.UTC(
      y,
      (m || 1) - 1,
      d || 1,
      opts?.endOfDay ? 23 : 0,
      opts?.endOfDay ? 59 : 0,
      opts?.endOfDay ? 59 : 0,
      opts?.endOfDay ? 999 : 0
    )
  ).toISOString();
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

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
  if (set.has("gas")) classes.push("gas");
  return classes.length ? classes.join(",") : null;
}

function classifyIncomeCategory(row: TxRow): string {
  const label = `${row.counterparty?.label ?? ""} ${row.swapLabel ?? ""}`
    .trim()
    .toLowerCase();
  const symbol = (row.asset?.symbol ?? "").toUpperCase();
  if (label.includes("stake") || label.includes("staking")) return "Staking";
  if (label.includes("airdrop")) return "Airdrops";
  if (label.includes("nft")) return "NFT royalties";
  if (
    label.includes("bridge") ||
    label.includes("wormhole") ||
    label.includes("layerzero")
  )
    return "Bridge inflow";
  if (
    label.includes("coinbase") ||
    label.includes("binance") ||
    label.includes("kraken") ||
    label.includes("okx")
  )
    return "Exchange transfers";
  if (symbol.includes("LP")) return "LP rewards";
  return "Other income";
}

const PAGE_SIZE = 20;

interface AllTransactionsTabProps {
  address?: string;
  networks?: string; // comma-separated override; omit to use UI-managed selection
}

type DatePreset = "all" | "current" | "previous" | "custom";

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

  // Server data & pagination
  const [rows, setRows] = useState<TxRow[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [total, setTotal] = useState<number | null>(null); // Total count from backend (Covalent)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [maxLoadedPage, setMaxLoadedPage] = useState(0);
  const [cacheVersion, setCacheVersion] = useState(0);
  const bumpCacheVersion = useCallback(() => setCacheVersion((v) => v + 1), []);

  // Networks: default to Ethereum mainnet, allow user/URL overrides
  const [networks, setNetworks] = useState<string[]>(() =>
    propNetworks
      ? normalizeNetworkList(parseNetworkQuery(propNetworks))
      : [...DEFAULT_NETWORKS]
  );
  useEffect(() => {
    if (propNetworks) {
      setNetworks(normalizeNetworkList(parseNetworkQuery(propNetworks)));
    } else {
      const sp = new URLSearchParams(window.location.search);
      const n = sp.get("networks");
      setNetworks(
        normalizeNetworkList(n ? parseNetworkQuery(n) : [...DEFAULT_NETWORKS])
      );
    }
  }, [propNetworks]);
  const networksParam = networks.length ? networks.join(",") : undefined;
  const networksButtonLabel = useMemo(() => {
    if (!networks.length || networks.length === NETWORK_IDS.length) {
      return "All chains";
    }
    if (networks.length === 1) {
      return networkLabel(networks[0]);
    }
    const primary = networkLabel(networks[0]);
    return `${primary} +${networks.length - 1}`;
  }, [networks]);

  const currentYear = useMemo(() => new Date().getUTCFullYear(), []);
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const dateRange = useMemo(() => {
    if (datePreset === "current") {
      return {
        from: startOfYearIso(currentYear),
        to: endOfYearIso(currentYear),
        label: `Tax year ${currentYear}`,
      };
    }
    if (datePreset === "previous") {
      const year = currentYear - 1;
      return {
        from: startOfYearIso(year),
        to: endOfYearIso(year),
        label: `Tax year ${year}`,
      };
    }
    if (datePreset === "custom") {
      const from = isoFromDateInput(customFrom);
      const to = isoFromDateInput(customTo, { endOfDay: true });
      const label =
        customFrom || customTo
          ? `${customFrom || "…"} → ${customTo || "…"}`
          : "Custom range";
      return { from, to, label };
    }
    return { from: undefined, to: undefined, label: "All time" };
  }, [datePreset, customFrom, customTo, currentYear]);
  const fromParam = dateRange.from;
  const toParam = dateRange.to;
  const dateRangeLabel = dateRange.label;
  const dateRangeKey =
    fromParam || toParam ? `${fromParam ?? ""}:${toParam ?? ""}` : "(all)";

  useEffect(() => {
    if (datePreset !== "custom") return;
    if (customFrom || customTo) return;
    const start = toDateInputValue(new Date(Date.UTC(currentYear, 0, 1)));
    const today = toDateInputValue(new Date());
    setCustomFrom(start);
    setCustomTo(today);
  }, [datePreset, customFrom, customTo, currentYear]);

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
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pageStatus, setPageStatus] = useState<{
    page: number;
    state: "loading" | "success" | "error";
    message: string;
  } | null>(null);

  // Simple filter chip state
  const [selectedTypes, setSelectedTypes] = useState<TxType[] | ["all"]>([
    "all",
  ] as any);
  const selectedTypesKey = useMemo(
    () => JSON.stringify(selectedTypes),
    [selectedTypes]
  );

  // Visible columns
  const visibleColumnsInit = {
    type: true,
    date: true,
    network: true,
    asset: true,
    qty: true,
    usd: true,
    fee: true,
    counterparty: true,
    tx: true,
  } as const;
  const [visibleColumns, setVisibleColumns] = useState<
    Record<keyof typeof visibleColumnsInit, boolean>
  >({ ...visibleColumnsInit });

  // Generate cache key for current filters
  const getBaseCacheKey = (addr: string) => {
    const filterKey = JSON.stringify(selectedTypes);
    const nets = networksParam || "(all)";
    return `${addr}:${nets}:${filterKey}:${dateRangeKey}`;
  };
  const getCacheKey = (addr: string, pageNum: number) =>
    `${getBaseCacheKey(addr)}:${pageNum}`;
  const namespaceKey = useMemo(
    () => (address ? getBaseCacheKey(address) : null),
    [address, networksParam, dateRangeKey, selectedTypesKey]
  );

  const ensureCursorMap = (addr: string) => {
    const ns = getBaseCacheKey(addr);
    if (!cursorCache.current.has(ns)) {
      cursorCache.current.set(ns, new Map([[1, null]]));
    }
    return { map: cursorCache.current.get(ns)!, namespace: ns };
  };

  // Load current page (with cache check)
  async function load(p: number) {
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
    setPageStatus({ page: p, state: "loading", message: `Loading page ${p}…` });
    try {
      const classParam = uiTypesToClassParam(selectedTypes);
      const {
        rows,
        hasNext,
        total: totalCount,
        nextCursor,
      } = await fetchTransactions(address, {
        // networks: if undefined → backend default = all supported EVM networks
        ...(networksParam ? { networks: networksParam } : {}),
        page: p,
        limit: PAGE_SIZE,
        minUsd: 0,
        spamFilter: "hard",
        ...(cursorParam ? { cursor: cursorParam } : {}),
        ...(classParam ? { class: classParam } : {}),
        ...(fromParam ? { from: fromParam } : {}),
        ...(toParam ? { to: toParam } : {}),
      });

      // Store in cache
      pageCache.current.set(cacheKey, {
        rows,
        hasNext,
        total: totalCount,
        nextCursor: nextCursor ?? null,
      });
      bumpCacheVersion();

      setRows(rows);
      setHasNext(hasNext);
      setTotal(totalCount); // Store total count from backend
      setMaxLoadedPage((prev) => (p > prev ? p : prev));
      cursorMap.set(p + 1, nextCursor ?? null);
      setPageStatus({ page: p, state: "success", message: `Page ${p} loaded` });

      // Prefetch next page in background (if available)
      if (hasNext && nextCursor) {
        preloadNextPage(p + 1);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load transactions");
      setRows([]);
      setHasNext(false);
      setTotal(null);
      setPageStatus({
        page: p,
        state: "error",
        message: `Failed to load page ${p}`,
      });
    } finally {
      setLoading(false);
    }
  }

  // Preload next page in background (silent, no loading state)
  async function preloadNextPage(nextPage: number) {
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
      const {
        rows,
        hasNext,
        total: totalCount,
        nextCursor,
      } = await fetchTransactions(address, {
        ...(networksParam ? { networks: networksParam } : {}),
        page: nextPage,
        limit: PAGE_SIZE,
        minUsd: 0,
        spamFilter: "hard",
        ...(cursorParam ? { cursor: cursorParam } : {}),
        ...(classParam ? { class: classParam } : {}),
        ...(fromParam ? { from: fromParam } : {}),
        ...(toParam ? { to: toParam } : {}),
      });

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
  }

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

  useEffect(() => {
    if (!pageStatus || pageStatus.state === "loading") return;
    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
      statusTimeoutRef.current = null;
    }
    statusTimeoutRef.current = setTimeout(() => {
      setPageStatus((curr) => (curr?.state === "loading" ? curr : null));
    }, 2000);
    return () => {
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
        statusTimeoutRef.current = null;
      }
    };
  }, [pageStatus]);

  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
    };
  }, []);

  // When server-side class filter changes (chips), reload current page with new filter
  useEffect(() => {
    if (!address) return;
    // Don't clear cache - it's already organized by filter via getCacheKey
    // This allows instant navigation when returning to previously visited filters
    // Load current page with new filter (if page doesn't exist, backend will handle it)
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTypesKey]);

  const isInitialLoading = loading && rows.length === 0;

  // Use total from backend (Covalent) if available, otherwise fallback to estimation
  const totalCount = useMemo(() => {
    if (total !== null) return total; // Use real total from backend
    // Fallback to estimation if backend total not available
    if (rows.length === 0) return null;
    if (hasNext) {
      return page * PAGE_SIZE; // At least this many
    } else {
      return (page - 1) * PAGE_SIZE + rows.length; // Exact count
    }
  }, [total, page, hasNext, rows.length]);

  const totalPages = useMemo(() => {
    if (!totalCount) return null;
    return Math.ceil(totalCount / PAGE_SIZE);
  }, [totalCount]);

  // Check if any filter is active (not "all")
  const hasActiveFilter = useMemo(() => {
    return !Array.isArray(selectedTypes) || (selectedTypes as any)[0] !== "all";
  }, [selectedTypes]);

  // Block navigation buttons when filters are active
  const canPrev = !hasActiveFilter && page > 1;
  const canNext =
    !hasActiveFilter && hasNext && !(loading && page >= maxLoadedPage);
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

  const toggleNetworkSelection = (id: string, checked: boolean) => {
    setNetworks((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return normalizeNetworkList(Array.from(next));
    });
  };
  const selectAllNetworks = () => setNetworks([...NETWORK_IDS]);
  const resetToDefaultNetworks = () => setNetworks([...DEFAULT_NETWORKS]);

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
  const loadedRowsAll = useMemo(() => {
    if (!address || !namespaceKey) return [];
    const prefix = `${namespaceKey}:`;
    const dedup = new Map<string, TxRow>();
    for (const [key, value] of pageCache.current.entries()) {
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
    }
    return Array.from(dedup.values());
  }, [address, namespaceKey, cacheVersion]);

  type GainEntryWithKey = CapitalGainEntry & { assetKey: string };
  type BuyEventsEntry = { assetKey: string; label: string; timestamps: number[] };
  type OpenLotDisplay = CostBasisEntry & { label: string };
  type UnmatchedSaleDisplay = UnmatchedSale & { label: string };

  const gainsMethod: AccountingMethod = "FIFO";
  const capitalGainsSummary = useMemo(() => {
    if (!loadedRowsAll.length) {
      return {
        realized: [] as CapitalGainEntry[],
        realizedRaw: [] as GainEntryWithKey[],
        totalRealized: 0,
        shortTerm: 0,
        longTerm: 0,
        timeline: [] as Array<{ date: string; short: number; long: number }>,
        topRealized: [] as CapitalGainEntry[],
        transactionsCount: 0,
        acquisitions: 0,
        disposals: 0,
        openLots: [] as OpenLotDisplay[],
        unmatchedSales: [] as UnmatchedSaleDisplay[],
        buyEvents: [] as BuyEventsEntry[],
      };
    }
    const sorted = [...loadedRowsAll].sort(
      (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
    );
    const calculator = new CapitalGainsCalculator(gainsMethod);
    const realizedDisplay: CapitalGainEntry[] = [];
    const realizedRaw: GainEntryWithKey[] = [];
    const assetLabels = new Map<string, string>();
    const buyEvents = new Map<string, number[]>();
    let acquisitions = 0;
    let disposals = 0;

    for (const row of sorted) {
      const qtyRaw = row.qty ? Number(row.qty) : 0;
      const quantity = Number.isFinite(qtyRaw) ? Math.abs(qtyRaw) : 0;
      if (!quantity) continue;
      const assetKey =
        row.asset?.contract?.toLowerCase() ??
        row.asset?.symbol?.toUpperCase() ??
        null;
      if (!assetKey) continue;
      const assetLabel =
        row.asset?.symbol ??
        (row.asset?.contract ? shortAddr(row.asset.contract) : assetKey);
      assetLabels.set(assetKey, assetLabel);
      const price =
        row.priceUsdAtTs ??
        (row.usdAtTs != null && quantity ? row.usdAtTs / quantity : null);
      if (price == null || !Number.isFinite(price)) continue;

      if (row.direction === "in") {
        acquisitions += 1;
        const tsMs = new Date(row.ts).getTime();
        if (!Number.isNaN(tsMs)) {
          if (!buyEvents.has(assetKey)) buyEvents.set(assetKey, []);
          buyEvents.get(assetKey)!.push(tsMs);
        }
        calculator.addToCostBasis({
          id: `${row.hash}:${row.ts}`,
          asset: assetKey,
          quantity,
          costBasis: price * quantity,
          purchaseDate: row.ts,
          purchasePrice: price,
        });
      } else {
        disposals += 1;
        const gains = calculator.calculateGains(
          assetKey,
          quantity,
          price,
          row.ts,
          row.hash
        );
        if (gains.length) {
          gains.forEach((g) => {
            realizedRaw.push({ ...g, assetKey });
            realizedDisplay.push({
              ...g,
              asset: assetLabels.get(assetKey) ?? assetLabel,
            });
          });
        }
      }
    }

    const totalRealized = realizedDisplay.reduce(
      (sum, entry) => sum + entry.gain,
      0
    );
    const shortTerm = realizedDisplay
      .filter((entry) => !entry.isLongTerm)
      .reduce((sum, entry) => sum + entry.gain, 0);
    const longTerm = realizedDisplay
      .filter((entry) => entry.isLongTerm)
      .reduce((sum, entry) => sum + entry.gain, 0);

    const timelineMap = new Map<
      string,
      { date: string; short: number; long: number }
    >();
    for (const entry of realizedDisplay) {
      if (!entry.saleDate) continue;
      const dateKey = entry.saleDate.slice(0, 10);
      if (!timelineMap.has(dateKey)) {
        timelineMap.set(dateKey, { date: dateKey, short: 0, long: 0 });
      }
      const bucket = timelineMap.get(dateKey)!;
      if (entry.isLongTerm) bucket.long += entry.gain;
      else bucket.short += entry.gain;
    }
    const timeline = Array.from(timelineMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    const topRealized = [...realizedDisplay]
      .sort((a, b) => Math.abs(b.gain) - Math.abs(a.gain))
      .slice(0, 5);
    const openLots: OpenLotDisplay[] = calculator.getOpenLots().map((lot) => ({
      ...lot,
      label: assetLabels.get(lot.asset) ?? lot.asset,
    }));
    const unmatchedSales: UnmatchedSaleDisplay[] = calculator
      .getUnmatchedSales()
      .map((sale) => ({
        ...sale,
        label: assetLabels.get(sale.asset) ?? sale.asset,
      }));
    const buyEventsList: BuyEventsEntry[] = Array.from(buyEvents.entries()).map(
      ([assetKey, timestamps]) => ({
        assetKey,
        label: assetLabels.get(assetKey) ?? assetKey,
        timestamps: [...timestamps].sort(),
      })
    );

    return {
      realized: realizedDisplay,
      realizedRaw,
      totalRealized,
      shortTerm,
      longTerm,
      timeline,
      topRealized,
      transactionsCount: loadedRowsAll.length,
      acquisitions,
      disposals,
      openLots,
      unmatchedSales,
      buyEvents: buyEventsList,
    };
  }, [loadedRowsAll, gainsMethod]);
  const loadedTransactionsCount = capitalGainsSummary.transactionsCount;
  const coveragePct =
    totalCount && totalCount > 0
      ? Math.min(1, loadedTransactionsCount / totalCount)
      : null;
  const hasRealizedData = capitalGainsSummary.realized.length > 0;
  const coveragePctDisplay =
    coveragePct != null ? Math.round(coveragePct * 100) : null;
  const unmatchedSales = capitalGainsSummary.unmatchedSales;
  const incomeBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    let total = 0;
    loadedRowsAll.forEach((row) => {
      if (row.type !== "income" || row.direction !== "in") return;
      const usd = row.usdAtTs ?? 0;
      if (!usd) return;
      const category = classifyIncomeCategory(row);
      map.set(category, (map.get(category) ?? 0) + usd);
      total += usd;
    });
    const entries = Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([label, value]) => ({ label, value }));
    const topSum = entries.reduce((sum, entry) => sum + entry.value, 0);
    if (total - topSum > 0) {
      entries.push({ label: "Other income", value: total - topSum });
    }
    return { total, entries };
  }, [loadedRowsAll]);
  const counterpartyBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    loadedRowsAll.forEach((row) => {
      if (row.direction !== "out") return;
      const usd = row.usdAtTs ?? 0;
      if (!usd) return;
      const label =
        row.counterparty?.label ??
        (row.counterparty?.address
          ? shortAddr(row.counterparty.address)
          : "Unknown");
      map.set(label, (map.get(label) ?? 0) + usd);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, value]) => ({ label, value }));
  }, [loadedRowsAll]);
  const gasVsProceeds = useMemo(() => {
    let proceeds = 0;
    let gas = 0;
    loadedRowsAll.forEach((row) => {
      if (row.direction === "out") {
        proceeds += row.usdAtTs ?? 0;
      }
      gas += row.fee?.usdAtTs ?? 0;
    });
    return {
      proceeds,
      gas,
      net: proceeds - gas,
      gasPct: proceeds > 0 ? (gas / proceeds) * 100 : null,
    };
  }, [loadedRowsAll]);
  const stableBufferStats = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    loadedRowsAll.forEach((row) => {
      const symbol = (row.asset?.symbol ?? "").toUpperCase();
      if (!symbol || !STABLE_SYMBOLS.has(symbol)) return;
      const usd = row.usdAtTs ?? 0;
      if (!usd) return;
      if (row.direction === "in") inflow += usd;
      else outflow += usd;
    });
    return {
      inflow,
      outflow,
      net: inflow - outflow,
      retention:
        inflow > 0 ? Math.max(0, inflow - outflow) / inflow * 100 : null,
    };
  }, [loadedRowsAll]);
  const costBasisBuckets = useMemo(() => {
    const now = Date.now();
    const buckets = [
      { id: "0-30", label: "0-30 days", min: 0, max: 30, usd: 0, lots: 0 },
      { id: "31-90", label: "31-90 days", min: 31, max: 90, usd: 0, lots: 0 },
      {
        id: "91-365",
        label: "91-365 days",
        min: 91,
        max: 365,
        usd: 0,
        lots: 0,
      },
      {
        id: "1-2y",
        label: "1-2 years",
        min: 366,
        max: 730,
        usd: 0,
        lots: 0,
      },
      { id: "2y+", label: "2+ years", min: 731, max: Infinity, usd: 0, lots: 0 },
    ];
    capitalGainsSummary.openLots.forEach((lot) => {
      const purchaseMs = Date.parse(lot.purchaseDate);
      if (Number.isNaN(purchaseMs)) return;
      const ageDays = Math.max(0, Math.floor((now - purchaseMs) / DAY_MS));
      const bucket = buckets.find(
        (b) => ageDays >= b.min && ageDays <= b.max
      );
      if (!bucket) return;
      bucket.usd += lot.costBasis;
      bucket.lots += 1;
    });
    return buckets;
  }, [capitalGainsSummary.openLots]);
  const washSaleSignals = useMemo(() => {
    if (!capitalGainsSummary.realizedRaw.length) return [];
    const buyMap = new Map(
      capitalGainsSummary.buyEvents.map((entry) => [entry.assetKey, entry])
    );
    const windowMs = 30 * DAY_MS;
    const signals: Array<{
      asset: string;
      saleDate: string;
      repurchaseDate: string;
      lossUsd: number;
    }> = [];
    for (const entry of capitalGainsSummary.realizedRaw) {
      if (entry.gain >= 0) continue;
      const buyEntry = buyMap.get(entry.assetKey);
      if (!buyEntry) continue;
      const saleMs = Date.parse(entry.saleDate);
      if (Number.isNaN(saleMs)) continue;
      let chosenTs: number | null = null;
      for (const ts of buyEntry.timestamps) {
        if (ts >= saleMs && ts - saleMs <= windowMs) {
          chosenTs = ts;
          break;
        }
      }
      if (chosenTs == null) {
        for (let i = buyEntry.timestamps.length - 1; i >= 0; i--) {
          const ts = buyEntry.timestamps[i];
          if (saleMs - ts <= windowMs && saleMs - ts >= 0) {
            chosenTs = ts;
            break;
          }
        }
      }
      if (chosenTs != null) {
        signals.push({
          asset: buyEntry.label,
          saleDate: entry.saleDate,
          repurchaseDate: new Date(chosenTs).toISOString(),
          lossUsd: entry.gain,
        });
      }
      if (signals.length >= 4) break;
    }
    return signals;
  }, [capitalGainsSummary.realizedRaw, capitalGainsSummary.buyEvents]);

  return (
    <div className="space-y-6">
      {address && (
        <Card className="bg-white shadow-sm">
          <div className="p-6 space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">
                  Capital Gains Snapshot (loaded data)
                </h3>
                <p className="text-sm text-slate-500">
                  Based on {loadedTransactionsCount.toLocaleString()} loaded
                  transactions for {dateRangeLabel}. Load additional pages to
                  refine these estimates.
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Coverage</p>
                <p className="text-lg font-semibold text-slate-800">
                  {coveragePctDisplay != null ? `${coveragePctDisplay}%` : "—"}
                </p>
                {totalCount && (
                  <p className="text-xs text-slate-500">
                    {loadedTransactionsCount.toLocaleString()} /{" "}
                    {totalCount.toLocaleString()}
                  </p>
                )}
              </div>
            </div>
            {coveragePct != null && (
              <div>
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>Loaded vs estimated total</span>
                  <span>{coveragePctDisplay}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-2 bg-indigo-500"
                    style={{
                      width: `${Math.min(coveragePct * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">
                  Loaded transactions
                </p>
                <p className="text-xl font-semibold text-slate-900">
                  {loadedTransactionsCount.toLocaleString()}
                </p>
                <p className="text-xs text-slate-500">
                  {capitalGainsSummary.acquisitions} buys ·{" "}
                  {capitalGainsSummary.disposals} disposals
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">
                  Realized gains (loaded)
                </p>
                <p
                  className={`text-xl font-semibold ${
                    capitalGainsSummary.totalRealized >= 0
                      ? "text-emerald-600"
                      : "text-rose-600"
                  }`}
                >
                  {fmtUSD(capitalGainsSummary.totalRealized)}
                </p>
                <p className="text-xs text-slate-500">Aggregated to date</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">
                  Short-term
                </p>
                <p
                  className={`text-xl font-semibold ${
                    capitalGainsSummary.shortTerm >= 0
                      ? "text-emerald-600"
                      : "text-rose-600"
                  }`}
                >
                  {fmtUSD(capitalGainsSummary.shortTerm)}
                </p>
                <p className="text-xs text-slate-500">
                  &lt; 365 day holding period
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">
                  Long-term
                </p>
                <p
                  className={`text-xl font-semibold ${
                    capitalGainsSummary.longTerm >= 0
                      ? "text-emerald-600"
                      : "text-rose-600"
                  }`}
                >
                  {fmtUSD(capitalGainsSummary.longTerm)}
                </p>
                <p className="text-xs text-slate-500">
                  ≥ 365 day holding period
                </p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-slate-800">
                    Realized gain timeline
                  </p>
                  <span className="text-xs text-slate-500">
                    {hasRealizedData
                      ? "Stacked short vs long term"
                      : "Awaiting qualifying sales"}
                  </span>
                </div>
                {hasRealizedData ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={capitalGainsSummary.timeline}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value: string) =>
                          new Date(value).toLocaleDateString()
                        }
                        interval="preserveStartEnd"
                        minTickGap={24}
                      />
                      <YAxis tickFormatter={(value: number) => fmtUSD(value)} />
                      <RechartsTooltip
                        formatter={(value: number) => fmtUSD(value)}
                        labelFormatter={(value) =>
                          new Date(value).toLocaleDateString()
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="short"
                        stackId="1"
                        stroke="#f97316"
                        fill="#fed7aa"
                        name="Short-term"
                      />
                      <Area
                        type="monotone"
                        dataKey="long"
                        stackId="1"
                        stroke="#0ea5e9"
                        fill="#bae6fd"
                        name="Long-term"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[220px] flex items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-500">
                    Load additional outgoing transactions to build this chart.
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-slate-800">
                    Top dispositions
                  </p>
                  <span className="text-xs text-slate-500">
                    Largest realized gains/losses
                  </span>
                </div>
                {capitalGainsSummary.topRealized.length ? (
                  <div className="space-y-3">
                    {capitalGainsSummary.topRealized.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between rounded-lg border border-slate-100 p-3"
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-slate-900">
                            {entry.asset} ·{" "}
                            <span className="text-xs text-slate-500">
                              {entry.quantity.toFixed(4)}
                            </span>
                          </p>
                          <p className="text-xs text-slate-500">
                            {entry.isLongTerm ? "Long-term" : "Short-term"} ·
                            Held {entry.holdingPeriod}d · Sold{" "}
                            {new Date(entry.saleDate).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p
                            className={`text-sm font-semibold ${
                              entry.gain >= 0
                                ? "text-emerald-600"
                                : "text-rose-600"
                            }`}
                          >
                            {fmtUSD(entry.gain)}
                          </p>
                          <p className="text-xs text-slate-500">
                            Basis {fmtUSD(entry.costBasis)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-[220px] flex items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-500">
                    No realized gains or losses in the loaded history yet.
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-100 p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-slate-800">
                    Tax readiness warnings
                  </p>
                  <span className="text-xs text-slate-500">
                    Live coverage check
                  </span>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Unmatched disposals
                    </p>
                    {unmatchedSales.length ? (
                      <ul className="mt-2 space-y-2 text-sm text-slate-700">
                        {unmatchedSales.slice(0, 3).map((sale) => (
                          <li
                            key={`${sale.transactionId}-${sale.saleDate}`}
                            className="flex items-center justify-between"
                          >
                            <span>
                              {sale.label} · {sale.quantity.toFixed(4)}
                            </span>
                            <span className="text-rose-600">
                              {new Date(sale.saleDate).toLocaleDateString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-emerald-600">
                        All processed sales had matching cost basis in the
                        loaded history.
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Potential wash sales
                    </p>
                    {washSaleSignals.length ? (
                      <ul className="mt-2 space-y-2 text-sm text-slate-700">
                        {washSaleSignals.map((signal, idx) => (
                          <li
                            key={`${signal.asset}-${idx}`}
                            className="flex items-center justify-between"
                          >
                            <span>
                              {signal.asset} loss on{" "}
                              {new Date(signal.saleDate).toLocaleDateString()}
                            </span>
                            <span className="text-amber-600">
                              Rebuy{" "}
                              {new Date(
                                signal.repurchaseDate
                              ).toLocaleDateString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-emerald-600">
                        No losses with a repurchase inside the ±30 day window in
                        the loaded data.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-100 p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-slate-800">
                    Income mix
                  </p>
                  <span className="text-xs text-slate-500">
                    {fmtUSD(incomeBreakdown.total)}
                  </span>
                </div>
                {incomeBreakdown.entries.length ? (
                  <div className="space-y-3">
                    {incomeBreakdown.entries.map((entry) => {
                      const pct =
                        incomeBreakdown.total > 0
                          ? (entry.value / incomeBreakdown.total) * 100
                          : 0;
                      return (
                        <div key={entry.label}>
                          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                            <span>{entry.label}</span>
                            <span>{fmtPct(pct)}</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-2 rounded-full bg-emerald-500"
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    No income-category transactions inside the loaded range.
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-100 p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-slate-800">
                    Cost basis aging
                  </p>
                  <span className="text-xs text-slate-500">
                    {capitalGainsSummary.openLots.length} open lots
                  </span>
                </div>
                {capitalGainsSummary.openLots.length ? (
                  <div className="space-y-2">
                    {costBasisBuckets.map((bucket) => (
                      <div
                        key={bucket.id}
                        className="flex items-center justify-between text-sm text-slate-700"
                      >
                        <span>{bucket.label}</span>
                        <span className="font-mono">
                          {bucket.lots} · {fmtUSD(bucket.usd)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    No remaining cost basis in the currently loaded history.
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-slate-100 p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-slate-800">
                    Counterparty concentration
                  </p>
                  <span className="text-xs text-slate-500">Top outflows</span>
                </div>
                {counterpartyBreakdown.length ? (
                  <div className="space-y-2">
                    {counterpartyBreakdown.map((entry) => (
                      <div
                        key={entry.label}
                        className="flex items-center justify-between text-sm text-slate-700"
                      >
                        <span>{entry.label}</span>
                        <span className="font-mono">{fmtUSD(entry.value)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    No outgoing transactions recorded yet.
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-100 p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-slate-800">
                    Proceeds vs gas spend
                  </p>
                  <span className="text-xs text-slate-500">
                    Gas {fmtPct(gasVsProceeds.gasPct)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm text-slate-700">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Proceeds
                    </p>
                    <p className="font-semibold">{fmtUSD(gasVsProceeds.proceeds)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Gas
                    </p>
                    <p className="font-semibold text-rose-600">
                      {fmtUSD(gasVsProceeds.gas)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Net
                    </p>
                    <p
                      className={`font-semibold ${
                        gasVsProceeds.net >= 0
                          ? "text-emerald-600"
                          : "text-rose-600"
                      }`}
                    >
                      {fmtUSD(gasVsProceeds.net)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-100 p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-slate-800">
                    Stablecoin buffer
                  </p>
                  <span className="text-xs text-slate-500">
                    Retained {fmtPct(stableBufferStats.retention)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm text-slate-700">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Inflow
                    </p>
                    <p className="font-semibold text-emerald-600">
                      {fmtUSD(stableBufferStats.inflow)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Outflow
                    </p>
                    <p className="font-semibold text-rose-600">
                      {fmtUSD(stableBufferStats.outflow)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Net
                    </p>
                    <p
                      className={`font-semibold ${
                        stableBufferStats.net >= 0
                          ? "text-emerald-600"
                          : "text-rose-600"
                      }`}
                    >
                      {fmtUSD(stableBufferStats.net)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card className="bg-white shadow-sm">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-slate-800">
              All Transactions {address ? "" : "(load an address)"}
            </h3>
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center text-xs text-slate-600 mr-2">
                {hasActiveFilter ? (
                  loading ? (
                    <span className="font-medium">Loading...</span>
                  ) : (
                    <span className="font-medium">
                      {rows.length} transaction{rows.length !== 1 ? "s" : ""}
                    </span>
                  )
                ) : totalCount && totalPages ? (
                  <span className="font-medium">
                    Page {page} of {totalPages} ({totalCount.toLocaleString()}{" "}
                    total)
                  </span>
                ) : totalCount ? (
                  <span className="font-medium">
                    Page {page} ({totalCount.toLocaleString()}+ transactions)
                  </span>
                ) : (
                  <span className="font-medium">Page {page}</span>
                )}
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Date: {dateRangeLabel}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Date range</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={datePreset}
                    onValueChange={(value) =>
                      setDatePreset(value as DatePreset)
                    }
                  >
                    <DropdownMenuRadioItem value="all">
                      All time
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="current">
                      Tax year {currentYear}
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="previous">
                      Tax year {currentYear - 1}
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="custom">
                      Custom range
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Networks: {networksButtonLabel}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Select networks</DropdownMenuLabel>
                  {NETWORK_OPTIONS.map((net) => (
                    <DropdownMenuCheckboxItem
                      key={net.id}
                      checked={networks.includes(net.id)}
                      onCheckedChange={(checked) =>
                        toggleNetworkSelection(net.id, !!checked)
                      }
                    >
                      {net.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      selectAllNetworks();
                    }}
                  >
                    Select all
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      resetToDefaultNetworks();
                    }}
                  >
                    Reset to default
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

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
                  disabled={!canPrev}
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
                  disabled={!canNext}
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

          {datePreset === "custom" && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-xs text-slate-600 font-medium flex flex-col gap-1">
                <span>From</span>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.currentTarget.value)}
                  className="rounded border border-slate-200 px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200"
                />
              </label>
              <label className="text-xs text-slate-600 font-medium flex flex-col gap-1">
                <span>To</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(event) => setCustomTo(event.currentTarget.value)}
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
        {address && isInitialLoading && (
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
                  {visibleColumns.fee && <TableHead>Gas (USD)</TableHead>}
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
        {address && rows.length > 0 && (
          <div className="overflow-x-auto relative">
            <Table>
              <TableHeader>
                <TableRow>
                  {visibleColumns.type && <TableHead>Type</TableHead>}
                  {visibleColumns.date && <TableHead>Date</TableHead>}
                  {visibleColumns.network && <TableHead>Network</TableHead>}
                  {visibleColumns.asset && <TableHead>Asset</TableHead>}
                  {visibleColumns.qty && <TableHead>Qty</TableHead>}
                  {visibleColumns.usd && <TableHead>USD @ time</TableHead>}
                  {visibleColumns.fee && <TableHead>Gas (USD)</TableHead>}
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
                        {tx.type === "swap" && tx.swapLabel ? (
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-indigo-600">
                              {tx.swapLabel}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {tx.asset?.symbol ||
                                (tx.asset?.contract
                                  ? shortAddr(tx.asset.contract)
                                  : "—")}
                            </span>
                          </div>
                        ) : (
                          tx.asset?.symbol ||
                          (tx.asset?.contract
                            ? shortAddr(tx.asset.contract)
                            : "—")
                        )}
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
                    {visibleColumns.fee && (
                      <TableCell className="font-mono">
                        {fmtUSD(tx.fee?.usdAtTs ?? null)}
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
            {address && pageStatus && (
              <div
                className={`absolute top-3 right-4 flex items-center gap-2 rounded-full px-3 py-1 text-xs shadow ${
                  pageStatus.state === "loading"
                    ? "bg-amber-50 text-amber-800"
                    : pageStatus.state === "success"
                    ? "bg-emerald-50 text-emerald-800"
                    : "bg-rose-50 text-rose-800"
                }`}
              >
                {pageStatus.message}
              </div>
            )}

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
