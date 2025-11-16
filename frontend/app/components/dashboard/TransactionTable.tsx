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
} from "@/utils/transactionHelpers";

interface TransactionTableProps {
  address: string | null;
  rows: TxRow[];
  loading: boolean;
  error: string | null;
  visibleColumns: Record<string, boolean>;
  visibleColumnsInit: Record<string, boolean>;
  canPrev: boolean;
  canNext: boolean;
  goPrev: () => void;
  goNext: () => void;
}

export function TransactionTable({
  address,
  rows,
  loading,
  error,
  visibleColumns,
  visibleColumnsInit,
  canPrev,
  canNext,
  goPrev,
  goNext,
}: TransactionTableProps) {
  if (!address) {
    return (
      <div className="p-6 text-sm text-slate-500">
        Enter an address on the Overview tab to load transactions.
      </div>
    );
  }

  if (loading && rows.length === 0) {
    return (
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
              {visibleColumns.counterparty && <TableHead>Counterparty</TableHead>}
              {visibleColumns.tx && <TableHead>Tx</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(6)].map((_, i) => (
              <TableRow key={i}>
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

  if (rows.length === 0) {
    return null;
  }

  return (
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
            {visibleColumns.counterparty && <TableHead>Counterparty</TableHead>}
            {visibleColumns.tx && <TableHead>Tx</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((tx, idx) => (
            <TableRow key={`${tx.hash}-${idx}`}>
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
                    {shortAddr(tx.hash)} <ExternalLink className="w-3 h-3" />
                  </a>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Pager footer (mobile) */}
      <div className="flex sm:hidden justify-end gap-2 p-3">
        <Button variant="outline" size="sm" onClick={goPrev} disabled={!canPrev}>
          Prev
        </Button>
        <Button variant="outline" size="sm" onClick={goNext} disabled={!canNext}>
          Next
        </Button>
      </div>
    </div>
  );
}

