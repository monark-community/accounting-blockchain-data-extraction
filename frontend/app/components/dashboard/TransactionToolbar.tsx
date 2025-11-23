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
import { Eye, RefreshCw, FileText } from "lucide-react";
import { NETWORK_OPTIONS } from "@/lib/networks";
import type { DatePreset } from "@/hooks/useTransactionFilters";
import type { useTransactionStats } from "@/hooks/useTransactionStats";
import {
  exportCsv,
  exportJson,
  downloadBlob,
  nowStamp,
  shortForFile,
} from "@/utils/transactionExport";
import type { TxRow } from "@/lib/types/transactions";

interface WalletPickerOption {
  address: string;
  label: string;
  color?: string;
}

interface TransactionToolbarProps {
  exportLabel: string;
  loading: boolean;
  page: number;
  rows: TxRow[];
  loadedRowsAll: TxRow[];
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
  setVisibleColumns: (
    updater: (prev: Record<string, boolean>) => Record<string, boolean>
  ) => void;
  typeLabelForExport: string;
  canPrev: boolean;
  canNext: boolean;
  goPrev: () => void;
  goNext: () => void;
  refresh: () => void;
  setRefreshKey: (updater: (k: number) => number) => void;
  walletOptions?: WalletPickerOption[];
  selectedWallets?: string[];
  walletButtonLabel?: string;
  toggleWalletSelection?: (address: string, checked: boolean) => void;
  selectAllWallets?: () => void;
  resetWalletSelection?: () => void;
  walletLimitReached?: boolean;
  walletLimit?: number;
  hasNoTransactions: boolean;
  onExportReport?: (format: "pdf" | "quickbooks") => void;
  stats?: ReturnType<typeof useTransactionStats>;
  totalAssetsUsd?: number | null;
  stableHoldingsUsd?: number;
  totalCount?: number | null;
}

export function TransactionToolbar({
  exportLabel,
  loading,
  page,
  rows,
  loadedRowsAll,
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
  walletOptions,
  selectedWallets,
  walletButtonLabel,
  toggleWalletSelection,
  selectAllWallets,
  resetWalletSelection,
  walletLimitReached,
  walletLimit,
  hasNoTransactions,
  onExportReport,
  stats,
  totalAssetsUsd,
  stableHoldingsUsd,
  totalCount,
}: TransactionToolbarProps) {
  const hasLoadedRows = loadedRowsAll?.length > 0;

  const exportCapitalGains = () => {
    if (!stats || !hasLoadedRows) return;
    const payload = {
      dateRange: dateRangeLabel,
      coverage: { loaded: loadedRowsAll.length, total: totalCount ?? null },
      capitalGainsSummary: stats.capitalGainsSummary,
      costBasisBuckets: stats.costBasisBuckets,
      washSaleSignals: stats.washSaleSignals,
      unmatchedSales: stats.capitalGainsSummary.unmatchedSales,
    };
    downloadBlob(
      new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      }),
      `ledgerlift_${shortForFile(
        exportLabel
      )}_capital-gains_${nowStamp()}_loaded.json`
    );
  };

  const exportFinancialRatios = () => {
    if (!stats || !hasLoadedRows) return;
    const payload = {
      dateRange: dateRangeLabel,
      coverage: { loaded: loadedRowsAll.length, total: totalCount ?? null },
      totals: {
        totalAssetsUsd: totalAssetsUsd ?? null,
        stableHoldingsUsd: stableHoldingsUsd ?? null,
      },
      ratiosSource: {
        incomeBreakdown: stats.incomeBreakdown,
        gasVsProceeds: stats.gasVsProceeds,
        stableBufferStats: stats.stableBufferStats,
      },
    };
    downloadBlob(
      new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      }),
      `ledgerlift_${shortForFile(
        exportLabel
      )}_financial-ratios_${nowStamp()}_loaded.json`
    );
  };

  return (
    <div className="flex items-center gap-2">
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
      <div className="hidden sm:flex items-center text-xs text-slate-600 mr-2">
        {filterIsAll ? (
          <span className="font-medium">Page {page}</span>
        ) : (
          <span className="font-medium">
            {rows.length} transaction{rows.length !== 1 ? "s" : ""} (page {page}
            )
          </span>
        )}
      </div>

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
            <DropdownMenuRadioItem value="custom">
              Custom range
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {walletOptions && walletOptions.length > 1 && toggleWalletSelection && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={loading}>
              Wallets: {walletButtonLabel || "All"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Select wallets</DropdownMenuLabel>
            {walletOptions.map((wallet) => (
              <DropdownMenuCheckboxItem
                key={wallet.address}
                checked={selectedWallets?.includes(wallet.address)}
                onCheckedChange={(checked) =>
                  toggleWalletSelection(wallet.address, !!checked)
                }
                disabled={
                  !selectedWallets?.includes(wallet.address) &&
                  walletLimitReached &&
                  !loading
                }
              >
                <span className="inline-flex items-center gap-2">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ backgroundColor: wallet.color || "#94a3b8" }}
                  />
                  {wallet.label}
                </span>
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                selectAllWallets?.();
              }}
            >
              Select all
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                resetWalletSelection?.();
              }}
            >
              Reset
            </DropdownMenuItem>
            {walletLimitReached && walletLimit && (
              <div className="px-3 py-2 text-xs text-amber-600">
                Limit of {walletLimit} wallets reached
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

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
                {String(key).charAt(0).toUpperCase() + String(key).slice(1)}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {!hasNoTransactions && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={loading}>
              <FileText className="w-4 h-4 mr-2" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Transactions (loaded pages)</DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                exportCsv(
                  exportLabel,
                  loadedRowsAll,
                  "loaded",
                  typeLabelForExport
                );
              }}
              disabled={!hasLoadedRows}
            >
              CSV · loaded pages
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                exportJson(
                  exportLabel,
                  loadedRowsAll,
                  "loaded",
                  typeLabelForExport
                );
              }}
              disabled={!hasLoadedRows}
            >
              JSON · loaded pages
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuLabel>Reports & summaries</DropdownMenuLabel>
            {onExportReport && (
              <>
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    onExportReport("pdf");
                  }}
                >
                  Full report · PDF
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    onExportReport("quickbooks");
                  }}
                >
                  Full report · QuickBooks
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                exportCapitalGains();
              }}
              disabled={!hasLoadedRows || !stats}
            >
              Capital gains snapshot · JSON
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                exportFinancialRatios();
              }}
              disabled={!hasLoadedRows || !stats}
            >
              Financial ratios · JSON
            </DropdownMenuItem>

            <div className="border-t border-slate-200 mt-2 pt-2 px-2 text-[11px] text-slate-500">
              Exports use the currently loaded pages. Load more to expand
              coverage.
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setRefreshKey((k) => k + 1);
          refresh();
        }}
        disabled={loading}
      >
        <RefreshCw
          className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
        />
        Refresh
      </Button>
    </div>
  );
}
