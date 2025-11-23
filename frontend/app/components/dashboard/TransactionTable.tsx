import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExternalLink } from "lucide-react";
import type { TxRow } from "@/lib/types/transactions";
import { networkLabel } from "@/lib/networks";
import {
  fmtUSD,
  fmtQty,
  shortAddr,
  typeColor,
  typeIcon,
  etherscanTxUrl,
  PAGE_SIZE,
} from "@/utils/transactionHelpers";

interface TransactionTableProps {
  address: string | null;
  rows: TxRow[];
  page: number;
  loading: boolean;
  error: string | null;
  visibleColumns: Record<string, boolean>;
  visibleColumnsInit: Record<string, boolean>;
  canPrev: boolean;
  canNext: boolean;
  goPrev: () => void;
  goNext: () => void;
  walletLabels?: Record<string, { label: string; color?: string }>;
  loadedRowsAll: TxRow[];
}

export function TransactionTable({
  address,
  rows,
  page,
  loading,
  error,
  visibleColumns,
  visibleColumnsInit,
  canPrev,
  canNext,
  goPrev,
  goNext,
  walletLabels,
  loadedRowsAll,
}: TransactionTableProps) {
  if (!address) {
    return (
      <div className="p-6 text-sm text-slate-500">
        Select at least one wallet to load transactions.
      </div>
    );
  }

  if (loading && rows.length === 0) {
    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
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
                <TableCell>
                  <Skeleton className="h-4 w-8" />
                </TableCell>
                {Object.keys(visibleColumns).map((k) =>
                  visibleColumns[k as keyof typeof visibleColumnsInit] ? (
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
    );
  }

  if (error) {
    return <div className="p-6 text-sm text-red-600">{error}</div>;
  }

  if (rows.length === 0 && !loading) {
    // Check if there are transactions in cache but none match the current filter
    const hasTransactionsInCache = loadedRowsAll.length > 0;

    if (hasTransactionsInCache) {
      // Transactions exist in cache but none match the current filter
      return (
        <div className="p-12 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="text-slate-400 text-4xl">🔍</div>
            <div className="text-slate-600 font-medium">
              No transactions match the current filters
            </div>
            <div className="text-sm text-slate-500">
              Try adjusting your filters to see more transactions. There are{" "}
              {loadedRowsAll.length} transaction
              {loadedRowsAll.length !== 1 ? "s" : ""} available with different
              filters.
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={goPrev} disabled={!canPrev}>
                Load previous page
              </Button>
              <Button variant="outline" size="sm" onClick={goNext} disabled={!canNext}>
                Load next page
              </Button>
            </div>
          </div>
        </div>
      );
    } else {
      // No transactions in the wallet at all
      return (
        <div className="p-12 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="text-slate-400 text-4xl">📭</div>
            <div className="text-slate-600 font-medium">
              No transactions found
            </div>
            <div className="text-sm text-slate-500">
              No transactions match the current filters. Try adjusting your
              filters or date range.
            </div>
            <Button variant="outline" size="sm" onClick={goPrev} disabled={!canPrev}>
              Reset / previous page
            </Button>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="overflow-x-auto relative">
      <Table>
        <TableHeader className="sticky top-0 bg-white z-10 shadow-[0_1px_0_rgba(15,23,42,0.06)]">
          <TableRow>
            <TableHead className="w-12 text-slate-500">#</TableHead>
            {visibleColumns.type && <TableHead>Type</TableHead>}
            {visibleColumns.date && <TableHead>Date</TableHead>}
            {visibleColumns.network && <TableHead>Network</TableHead>}
            {visibleColumns.asset && <TableHead>Asset</TableHead>}
            {visibleColumns.qty && <TableHead className="text-right">Qty</TableHead>}
            {visibleColumns.usd && <TableHead className="text-right">USD @ time</TableHead>}
            {visibleColumns.fee && <TableHead className="text-right">Gas (USD)</TableHead>}
            {visibleColumns.counterparty && <TableHead>Counterparty</TableHead>}
            {visibleColumns.tx && <TableHead>Tx</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((tx, idx) => {
            const rowNumber = (page - 1) * PAGE_SIZE + idx + 1;
            return (
              <TableRow
                key={`${tx.hash}-${idx}`}
                className="hover:bg-slate-50/80 transition-colors"
              >
                <TableCell className="text-slate-500 font-medium">
                  {rowNumber}
                </TableCell>
                {visibleColumns.type && (
                  <TableCell>
                    <div
                      className={`flex items-center gap-2 ${typeColor(tx.type)}`}
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
                      (tx.asset?.contract ? shortAddr(tx.asset.contract) : "—")
                    )}
                    {tx.walletAddress && (
                      <span className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full"
                          style={{
                            backgroundColor:
                              walletLabels?.[tx.walletAddress.toLowerCase()]
                                ?.color ?? "#94a3b8",
                          }}
                        />
                        {walletLabels?.[tx.walletAddress.toLowerCase()]?.label ??
                          shortAddr(tx.walletAddress)}
                      </span>
                    )}
                  </TableCell>
                )}
                {visibleColumns.qty && (
                  <TableCell
                    className={`font-mono text-right ${
                      tx.direction === "in" ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {fmtQty(tx.qty, tx.direction)}
                  </TableCell>
                )}
                {visibleColumns.usd && (
                  <TableCell className="font-mono text-right">
                    {fmtUSD(tx.usdAtTs)}
                  </TableCell>
                )}
                {visibleColumns.fee && (
                  <TableCell className="font-mono text-right">
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
                      className="inline-flex items-center gap-1 text-xs font-mono text-slate-700 hover:text-slate-900 px-2 py-1 rounded-full bg-slate-100"
                      href={etherscanTxUrl(tx.hash, tx.network)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {shortAddr(tx.hash)} <ExternalLink className="w-3 h-3" />
                    </a>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white to-transparent" />
    </div>
  );
}
