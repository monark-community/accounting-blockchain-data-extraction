"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { shortAddr } from "@/utils/transactionHelpers";
import { useTransactionFilters } from "@/hooks/useTransactionFilters";
import { useTransactionCache } from "@/hooks/useTransactionCache";
import { useTransactionStats } from "@/hooks/useTransactionStats";

const DEFAULT_MULTI_WALLET_LIMIT = Number(
  process.env.NEXT_PUBLIC_DASHBOARD_MULTI_LIMIT ?? 3
);

const WALLET_COLOR_PALETTE = [
  "#6366f1",
  "#f97316",
  "#0ea5e9",
  "#14b8a6",
  "#ec4899",
  "#84cc16",
];

export interface WalletOption {
  address: string;
  label: string;
  color?: string;
}

interface TransactionsWorkspaceProviderProps {
  children: ReactNode;
  address?: string;
  networks?: string;
  walletOptions?: WalletOption[];
  walletLimit?: number;
  onPricingWarningChange?: (flag: boolean) => void;
}

interface TransactionsWorkspaceValue {
  address: string;
  activeWallets: string[];
  walletOptionList: WalletOption[];
  selectedWallets: string[];
  walletDropdownVisible: boolean;
  walletButtonLabel: string;
  walletLimitReached: boolean;
  walletLimit: number;
  walletLabelLookup: Record<string, { label: string; color?: string }>;
  toggleWalletSelection: (addr: string, checked: boolean) => void;
  selectAllWallets: () => void;
  resetWalletSelection: () => void;
  exportLabel: string;
  filters: ReturnType<typeof useTransactionFilters>;
  cache: ReturnType<typeof useTransactionCache>;
  stats: ReturnType<typeof useTransactionStats>;
  totalCount: number | null;
  canPrev: boolean;
  canNext: boolean;
  goPrev: () => void;
  goNext: () => void;
  refreshKey: number;
  setRefreshKey: React.Dispatch<React.SetStateAction<number>>;
  pricingWarnings: ReturnType<typeof useTransactionCache>["warnings"] | null;
}

const TransactionsWorkspaceContext =
  createContext<TransactionsWorkspaceValue | null>(null);

export function TransactionsWorkspaceProvider({
  children,
  address: propAddress,
  networks: propNetworks,
  walletOptions,
  walletLimit: walletLimitProp,
  onPricingWarningChange,
}: TransactionsWorkspaceProviderProps) {
  const walletLimit =
    typeof walletLimitProp === "number"
      ? walletLimitProp
      : DEFAULT_MULTI_WALLET_LIMIT;

  const [address, setAddress] = useState<string>(propAddress || "");
  useEffect(() => {
    if (propAddress) {
      setAddress(propAddress);
    } else {
      const params = new URLSearchParams(window.location.search);
      setAddress(params.get("address") || "");
    }
  }, [propAddress]);

  const walletOptionList = useMemo(() => {
    if (!walletOptions?.length) return [];
    return walletOptions.map((wallet, idx) => ({
      ...wallet,
      label: wallet.label || shortAddr(wallet.address),
      color:
        wallet.color ??
        WALLET_COLOR_PALETTE[idx % WALLET_COLOR_PALETTE.length],
    }));
  }, [walletOptions]);

  const [selectedWallets, setSelectedWallets] = useState<string[]>(() => {
    if (walletOptionList.length) {
      return walletOptionList
        .map((wallet) => wallet.address)
        .slice(0, walletLimit);
    }
    return propAddress ? [propAddress] : [];
  });

  useEffect(() => {
    if (walletOptionList.length) {
      setSelectedWallets((prev) => {
        const valid = prev.filter((addr) =>
          walletOptionList.some((wallet) => wallet.address === addr)
        );
        if (valid.length) return valid;
        return walletOptionList
          .map((wallet) => wallet.address)
          .slice(0, walletLimit);
      });
    } else if (propAddress) {
      setSelectedWallets([propAddress]);
    } else {
      setSelectedWallets([]);
    }
  }, [walletOptionList, walletLimit, propAddress]);

  const activeWallets = selectedWallets.length
    ? selectedWallets
    : address
    ? [address]
    : [];

  const walletDropdownVisible = walletOptionList.length > 1;
  const walletSelectionCount = selectedWallets.length;
  const walletLimitReached = walletSelectionCount >= walletLimit;

  const walletLabelLookup = useMemo(() => {
    const lookup: Record<string, { label: string; color?: string }> = {};
    walletOptionList.forEach((wallet) => {
      lookup[wallet.address.toLowerCase()] = {
        label: wallet.label,
        color: wallet.color,
      };
    });
    return lookup;
  }, [walletOptionList]);

  const walletButtonLabel = useMemo(() => {
    if (!walletDropdownVisible) {
      const single = activeWallets[0];
      const meta = single ? walletLabelLookup[single.toLowerCase()] : null;
      return meta?.label || (single ? shortAddr(single) : "Wallet");
    }
    if (!walletSelectionCount) {
      return "None selected";
    }
    if (walletSelectionCount === walletOptionList.length) {
      return "All wallets";
    }
    if (walletSelectionCount === 1) {
      const meta = walletLabelLookup[selectedWallets[0]?.toLowerCase() ?? ""];
      return meta?.label || shortAddr(selectedWallets[0]);
    }
    const first = selectedWallets[0];
    const meta = first ? walletLabelLookup[first.toLowerCase()] : null;
    const baseLabel = meta?.label || (first ? shortAddr(first) : "Wallets");
    return `${baseLabel} +${walletSelectionCount - 1}`;
  }, [
    walletDropdownVisible,
    activeWallets,
    walletLabelLookup,
    walletSelectionCount,
    walletOptionList.length,
    selectedWallets,
  ]);

  const toggleWalletSelection = useCallback(
    (addr: string, checked: boolean) => {
      setSelectedWallets((prev) => {
        if (checked) {
          if (prev.includes(addr)) return prev;
          if (walletLimitReached) return prev;
          return [...prev, addr];
        }
        return prev.filter((item) => item !== addr);
      });
    },
    [walletLimitReached]
  );

  const selectAllWallets = useCallback(() => {
    if (!walletOptionList.length) return;
    setSelectedWallets(
      walletOptionList.map((wallet) => wallet.address).slice(0, walletLimit)
    );
  }, [walletOptionList, walletLimit]);

  const resetWalletSelection = useCallback(() => {
    if (!walletOptionList.length) return;
    setSelectedWallets(
      walletOptionList.map((wallet) => wallet.address).slice(0, walletLimit)
    );
  }, [walletOptionList, walletLimit]);

  const exportLabel = useMemo(() => {
    if (activeWallets.length === 1) {
      return shortAddr(activeWallets[0]);
    }
    if (activeWallets.length > 1) {
      return `${activeWallets.length}-wallets`;
    }
    return "wallets";
  }, [activeWallets]);

  const filters = useTransactionFilters(propNetworks);
  const [refreshKey, setRefreshKey] = useState(0);
  const cache = useTransactionCache({
    addresses: activeWallets,
    selectedTypes: filters.selectedTypes,
    networksParam: filters.networksParam,
    dateRange: filters.dateRange,
    dateRangeKey: filters.dateRangeKey,
    selectedTypesKey: filters.selectedTypesKey,
    refreshKey,
  });
  const stats = useTransactionStats(cache.loadedRowsAll);

  useEffect(() => {
    if (!onPricingWarningChange) return;
    onPricingWarningChange(!!cache.warnings?.defiLlamaRateLimited);
  }, [cache.warnings, onPricingWarningChange]);

  useEffect(() => {
    if (!onPricingWarningChange) return;
    return () => {
      onPricingWarningChange(false);
    };
  }, [onPricingWarningChange]);

  const totalCount = useMemo(() => {
    if (cache.total !== null) return cache.total;
    if (cache.rows.length === 0) return null;
    if (cache.hasNext) {
      return cache.page * 20;
    }
    return (cache.page - 1) * 20 + cache.rows.length;
  }, [cache.total, cache.page, cache.hasNext, cache.rows.length]);

  const canPrev = cache.page > 1;
  const canNext =
    cache.hasNext && !(cache.loading && cache.page >= cache.maxLoadedPage);

  const goPrev = useCallback(() => {
    const p = Math.max(1, cache.page - 1);
    cache.setPage(p);
    cache.load(p);
  }, [cache]);

  const goNext = useCallback(() => {
    const p = cache.page + 1;
    cache.setPage(p);
    cache.load(p);
  }, [cache]);

  const value = useMemo<TransactionsWorkspaceValue>(
    () => ({
      address,
      activeWallets,
      walletOptionList,
      selectedWallets,
      walletDropdownVisible,
      walletButtonLabel,
      walletLimitReached,
      walletLimit,
      walletLabelLookup,
      toggleWalletSelection,
      selectAllWallets,
      resetWalletSelection,
      exportLabel,
      filters,
      cache,
      stats,
      totalCount,
      canPrev,
      canNext,
      goPrev,
      goNext,
      refreshKey,
      setRefreshKey,
      pricingWarnings: cache.warnings,
    }),
    [
      address,
      activeWallets,
      walletOptionList,
      selectedWallets,
      walletDropdownVisible,
      walletButtonLabel,
      walletLimitReached,
      walletLimit,
      walletLabelLookup,
      toggleWalletSelection,
      selectAllWallets,
      resetWalletSelection,
      exportLabel,
      filters,
      cache,
      stats,
      totalCount,
      canPrev,
      canNext,
      goPrev,
      goNext,
      refreshKey,
      setRefreshKey,
    ]
  );

  return (
    <TransactionsWorkspaceContext.Provider value={value}>
      {children}
    </TransactionsWorkspaceContext.Provider>
  );
}

export function useTransactionsWorkspace() {
  const ctx = useContext(TransactionsWorkspaceContext);
  if (!ctx) {
    throw new Error(
      "useTransactionsWorkspace must be used within TransactionsWorkspaceProvider"
    );
  }
  return ctx;
}
