import { useEffect, useMemo, useState } from "react";
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

export default function AllTransactionsTab() {
  // Address from URL
  const [address, setAddress] = useState<string>("");
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    setAddress(urlParams.get("address") || "");
  }, []);

  // Server data & pagination
  const [rows, setRows] = useState<TxRow[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Simple filter chip state
  const [selectedTypes, setSelectedTypes] = useState<TxType[] | ["all"]>([
    "all",
  ] as any);

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
  >({ ...visibleColumnsInit });

  // Load current page
  async function load(p: number) {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const classParam = uiTypesToClassParam(selectedTypes);
      const { rows, hasNext } = await fetchTransactions(address, {
        // networks: (omitted) → backend default = all supported EVM networks
        networks: "mainnet",
        page: p,
        limit: PAGE_SIZE,
        minUsd: 0,
        spamFilter: "soft",
        ...(classParam ? { class: classParam } : {}),
      });
      setRows(rows);
      setHasNext(hasNext);
    } catch (e: any) {
      setError(e?.message || "Failed to load transactions");
      setRows([]);
      setHasNext(false);
    } finally {
      setLoading(false);
    }
  }

  // Initial/refresh
  useEffect(() => {
    setPage(1);
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, refreshKey]);

  // When server-side class filter changes (chips), go back to page 1
  useEffect(() => {
    if (!address) return;
    setPage(1);
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(selectedTypes)]);

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
                {/* Page label: we don’t have total; show page window only */}
                <span className="font-medium">Page {page}</span>
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

              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (!address) return;
                  try {
                    const qs = new URLSearchParams({ address, networks: "mainnet" });
                    const url = `/api/reports/financial?${qs.toString()}`;
                    const res = await fetch(url);
                    if (!res.ok) {
                      const msg = await res.text();
                      throw new Error(msg || "Failed to generate report");
                    }
                    const blob = await res.blob();
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = `financial_report_${address.slice(0, 6)}_${Date.now()}.csv`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                  } catch (e) {
                    console.error(e);
                  }
                }}
              >
                Financial Report
              </Button>

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
        {address && loading && rows.length === 0 && (
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
        {address && rows.length > 0 && (
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
