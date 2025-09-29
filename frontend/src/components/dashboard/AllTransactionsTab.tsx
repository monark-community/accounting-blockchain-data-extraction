// --- File: src/components/dashboard/AllTransactionsTab.tsx
// Assumes backend route: GET /api/portfolio/txs/:address?kind=all&limit=20&cursor=...
// Reads the wallet address from the URL (e.g., /dashboard?address=vitalik.eth)

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// --- Types aligned with backend JSON shape
export type TxType = "income" | "expense" | "swap" | "gas";
export type Direction = "in" | "out";

export interface TxRow {
  ts: string; // ISO timestamp
  blockNumber: number;
  hash: string;
  network: string; // e.g. "eth-mainnet"
  wallet?: string; // may be present in feed wrapper; not required for row
  direction: Direction;
  type: TxType;
  asset: { symbol: string; contract: string | null; decimals: number };
  qty: string; // decimal string
  priceUsdAtTs: number | null;
  usdAtTs: number | null;
  counterparty?: { address: string; label: string | null };
  fee?: null | {
    asset: "ETH";
    qty: string;
    priceUsdAtTs: number | null;
    usdAtTs: number | null;
  };
  isApprox?: boolean;
}

export interface TxFeed {
  network: "eth-mainnet";
  wallet: { input: string; address: string; ens: string | null };
  window: { from: string | null; to: string | null };
  page: { limit: number; cursor: string | null; nextCursor: string | null };
  items: TxRow[];
}

const fmtUSD = (n: number | null | undefined) =>
  n == null
    ? "—"
    : n.toLocaleString(undefined, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      });

const fmtQty = (qty: string, dir: Direction) => {
  const sign = dir === "in" ? "+" : "-";
  return `${sign}${qty}`;
};

const shortAddr = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");

const typeColor = (t: TxType) =>
  ({
    income: "text-green-600",
    expense: "text-red-600",
    swap: "text-blue-600",
    gas: "text-amber-600",
  }[t]);

const typeIcon = (t: TxType) => {
  switch (t) {
    case "income":
      return <TrendingUp className="w-4 h-4" />;
    case "expense":
      return <TrendingDown className="w-4 h-4" />;
    case "swap":
      return <Repeat className="w-4 h-4" />;
    case "gas":
      return <Fuel className="w-4 h-4" />;
    default:
      return null;
  }
};

export default function AllTransactionsTab() {
  const [params] = useSearchParams();
  const address = params.get("address") || "";
  const PAGE_SIZE = 20; // keep in sync with ?limit
  const [totalCount, setTotalCount] = useState<number | null>(null); // optional; backend may return null
  const [viewPage, setViewPage] = useState(1); // 1-based page window for the visible slice

  // server data
  const [items, setItems] = useState<TxRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // MVP filter: transaction type only
  const [selectedTypes, setSelectedTypes] = useState<TxType[] | ["all"]>([
    "all",
  ] as any);

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
  >({ ...visibleColumnsInit });

  const loadPage = async (append: boolean) => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set("kind", "all");
      qs.set("limit", String(PAGE_SIZE));
      if (append && nextCursor) qs.set("cursor", nextCursor);

      const res = await fetch(
        `/api/portfolio/txs/${encodeURIComponent(address)}?${qs}`
      );
      if (!res.ok) {
        let msg = "Failed to load transactions";
        try {
          const j = await res.json();
          msg = j?.error?.message || msg;
        } catch {}
        throw new Error(msg);
      }
      const data = (await res.json()) as TxFeed;
      const pageItems = data?.items || [];
      setItems((prev) => (append ? [...prev, ...pageItems] : pageItems));
      setNextCursor(data?.page?.nextCursor || null);
      if ((data as any)?.page?.total != null) {
        setTotalCount((data as any).page.total);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  };

  // initial & when address changes or refresh
  useEffect(() => {
    setItems([]);
    setNextCursor(null);
    setViewPage(1);
    if (address) loadPage(false);
  }, [address, refreshKey]);

  const filtered = useMemo(() => {
    if (!items?.length) return [] as TxRow[];
    const types = Array.isArray(selectedTypes) ? selectedTypes : ["all"];
    if ((types as any)[0] === "all") return items;
    return items.filter((r) => (types as TxType[]).includes(r.type));
  }, [items, selectedTypes]);

  const windowStartIdx = (viewPage - 1) * PAGE_SIZE; // 0-based index
  const windowEndIdx = Math.min(windowStartIdx + PAGE_SIZE, filtered.length);
  const windowRows = filtered.slice(windowStartIdx, windowEndIdx);

  const labelStart = filtered.length ? windowStartIdx + 1 : 0; // 1-based for display
  const labelEnd = windowEndIdx; // inclusive 1-based

  const canPrev = viewPage > 1;
  const canNext = windowEndIdx < filtered.length || !!nextCursor;

  const goPrev = () => setViewPage((p) => Math.max(1, p - 1));

  const goNext = async () => {
    // If we’re at the end of loaded rows but backend has more, load then advance
    if (windowEndIdx >= filtered.length && nextCursor) {
      await loadPage(true);
    }
    setViewPage((p) => p + 1);
  };

  const toggleType = (t: TxType | "all", checked: boolean) => {
    if (t === "all") {
      setSelectedTypes(checked ? (["all"] as any) : ([] as any));
      return;
    }
    setSelectedTypes((prev: any) => {
      const arr: TxType[] =
        Array.isArray(prev) && prev[0] !== "all" ? prev : [];
      const next = checked ? [...arr, t] : arr.filter((x) => x !== t);
      return next.length ? next : (["all"] as any);
    });
  };

  const onRefresh = () => setRefreshKey((k) => k + 1);

  const explorerBase = (network?: string) => {
    switch (network) {
      case "eth-mainnet":
      case "ethereum":
        return "https://etherscan.io";
      case "eth-sepolia":
      case "sepolia":
        return "https://sepolia.etherscan.io";
      default:
        return "https://etherscan.io"; // MVP fallback
    }
  };
  const etherscanTxUrl = (hash: string, network?: string) =>
    `${explorerBase(network)}/tx/${hash}`;

  const networkLabel = (network?: string) => {
    switch (network) {
      case "eth-mainnet":
      case "ethereum":
        return "Ethereum";
      case "eth-sepolia":
      case "sepolia":
        return "Sepolia";
      default:
        return network || "Unknown";
    }
  };

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
                <span className="font-medium">
                  Latest {labelStart}–{labelEnd}
                </span>
                {totalCount != null && (
                  <span className="ml-1">of {totalCount}</span>
                )}
              </div>
              <div className="hidden sm:flex items-center gap-1">
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
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={loading}
              >
                <RefreshCw
                  className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            </div>
          </div>

          {/* MVP Filter: Transaction Type only */}
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

        {/* Status messages */}
        {!address && (
          <div className="p-6 text-sm text-slate-500">
            Enter an address on the Overview tab to load transactions.
          </div>
        )}
        {address && loading && items.length === 0 && (
          <div className="p-6 text-sm text-slate-500">
            Loading transactions…
          </div>
        )}
        {address && error && (
          <div className="p-6 text-sm text-red-600">{error}</div>
        )}

        {/* Table */}
        {address && items.length > 0 && (
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
                {windowRows.map((tx, idx) => (
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
                          shortAddr(tx.counterparty?.address)}
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

                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={
                        Object.values(visibleColumns).filter(Boolean).length
                      }
                      className="text-center py-8 text-slate-500"
                    >
                      No transactions found for the selected type(s).
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination */}
        {address && (nextCursor || loading) && (
          <div className="p-4 flex justify-center">
            <Button
              onClick={() => loadPage(true)}
              disabled={loading || !nextCursor}
              variant="outline"
            >
              {loading ? "Loading…" : nextCursor ? "Load more" : "No more"}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
