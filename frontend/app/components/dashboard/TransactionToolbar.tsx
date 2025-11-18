import { Button } from "@/components/ui/button";
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
import { Eye, RefreshCw } from "lucide-react";
import { NETWORK_OPTIONS } from "@/lib/networks";
import type { DatePreset } from "@/hooks/useTransactionFilters";
import { exportCsv, exportJson } from "@/utils/transactionExport";
import type { TxRow } from "@/lib/types/transactions";

interface TransactionToolbarProps {
  address: string;
  loading: boolean;
  page: number;
  rows: TxRow[];
  filterIsAll: boolean;
  loadIndicatorLabel: string | null;
  isOverloaded: boolean;
  datePreset: DatePreset;
  dateRangeLabel: string;
  currentYear: number;
  setDatePreset: (preset: DatePreset) => void;
  networks: string[];
  networksButtonLabel: string;
  toggleNetworkSelection: (id: string, checked: boolean) => void;
  selectAllNetworks: () => void;
  resetToDefaultNetworks: () => void;
  visibleColumns: Record<string, boolean>;
  visibleColumnsInit: Record<string, boolean>;
  setVisibleColumns: (updater: (prev: Record<string, boolean>) => Record<string, boolean>) => void;
  typeLabelForExport: string;
  canPrev: boolean;
  canNext: boolean;
  goPrev: () => void;
  goNext: () => void;
  refresh: () => void;
  setRefreshKey: (updater: (k: number) => number) => void;
  hasNoTransactions: boolean;
}

export function TransactionToolbar({
  address,
  loading,
  page,
  rows,
  filterIsAll,
  loadIndicatorLabel,
  isOverloaded,
  datePreset,
  dateRangeLabel,
  currentYear,
  setDatePreset,
  networks,
  networksButtonLabel,
  toggleNetworkSelection,
  selectAllNetworks,
  resetToDefaultNetworks,
  visibleColumns,
  visibleColumnsInit,
  setVisibleColumns,
  typeLabelForExport,
  canPrev,
  canNext,
  goPrev,
  goNext,
  refresh,
  setRefreshKey,
  hasNoTransactions,
}: TransactionToolbarProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="hidden sm:flex items-center text-xs text-slate-600 mr-2">
        {filterIsAll ? (
          <span className="font-medium">Page {page}</span>
        ) : (
          <span className="font-medium">
            {rows.length} transaction{rows.length !== 1 ? "s" : ""} (page {page})
          </span>
        )}
      </div>
      {loadIndicatorLabel && (
        <span
          className={`px-2 py-1 rounded text-xs font-medium ${
            isOverloaded
              ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
              : "bg-amber-100 text-amber-700 border border-amber-200"
          }`}
        >
          {loadIndicatorLabel}
        </span>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={loading}>
            Date: {dateRangeLabel}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Date range</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={datePreset}
            onValueChange={(value) => setDatePreset(value as DatePreset)}
          >
            <DropdownMenuRadioItem value="all">All time</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="current">
              Tax year {currentYear}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="previous">
              Tax year {currentYear - 1}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="custom">Custom range</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={loading}>
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

      {!hasNoTransactions && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Eye className="w-4 h-4 mr-2" /> Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {(Object.keys(visibleColumns) as Array<keyof typeof visibleColumnsInit>).map(
              (key) => (
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
                  {String(key).charAt(0).toUpperCase() + String(key).slice(1)}
                </DropdownMenuCheckboxItem>
              )
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {!hasNoTransactions && (
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
                exportCsv(address, rows, "visible", typeLabelForExport)
              }
            >
              CSV (visible)
            </button>
            <div className="h-px bg-slate-200 my-1" />
            <button
              className="w-full text-left px-2 py-1.5 hover:bg-slate-50"
              onClick={() =>
                exportJson(address, rows, "visible", typeLabelForExport)
              }
            >
              JSON (visible)
            </button>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <div className="hidden sm:flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={goPrev}
          disabled={!canPrev || loading || hasNoTransactions}
        >
          Prev
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={goNext}
          disabled={!canNext || loading || hasNoTransactions}
        >
          Next
        </Button>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setRefreshKey((k) => k + 1);
          refresh();
        }}
        disabled={loading}
      >
        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
        Refresh
      </Button>
    </div>
  );
}

