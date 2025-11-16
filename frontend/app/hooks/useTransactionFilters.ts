import { useEffect, useMemo, useState } from "react";
import {
  NETWORK_OPTIONS,
  NETWORK_IDS,
  networkLabel,
  normalizeNetworkList,
  serializeNetworks,
} from "@/lib/networks";
import type { TxType } from "@/lib/types/transactions";
import {
  DEFAULT_NETWORKS,
  parseNetworkQuery,
  startOfYearIso,
  endOfYearIso,
  isoFromDateInput,
  toDateInputValue,
} from "@/utils/transactionHelpers";

export type DatePreset = "all" | "current" | "previous" | "custom";

export function useTransactionFilters(
  propNetworks?: string
) {
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

  // Date range state
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

  useEffect(() => {
    if (datePreset !== "custom") return;
    if (customFrom || customTo) return;
    const start = toDateInputValue(new Date(Date.UTC(currentYear, 0, 1)));
    const today = toDateInputValue(new Date());
    setCustomFrom(start);
    setCustomTo(today);
  }, [datePreset, customFrom, customTo, currentYear]);

  // Derived params for API/cache keys
  const networksParam = useMemo(
    () => (networks?.length ? serializeNetworks(networks) : undefined),
    [networks]
  );
  const dateRangeKey = useMemo(
    () => `${dateRange.from ?? ""}|${dateRange.to ?? ""}`,
    [dateRange.from, dateRange.to]
  );

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

  // Check if "all" is the only filter selected
  const isOnlyAllSelected = useMemo(
    () =>
      Array.isArray(selectedTypes) &&
      (selectedTypes as any)[0] === "all" &&
      selectedTypes.length === 1,
    [selectedTypes]
  );

  // Filters UI helpers
  const toggleType = (t: TxType | "all", checked: boolean) => {
    if (t === "all") {
      // Prevent unchecking "all" if it's the only filter selected
      if (!checked && isOnlyAllSelected) {
        return; // Don't allow unchecking if "all" is the only filter
      }
      return setSelectedTypes(checked ? (["all"] as any) : ([] as any));
    }
    setSelectedTypes((prev: any) => {
      const arr: TxType[] =
        Array.isArray(prev) && prev[0] !== "all" ? prev : [];
      const next = checked ? [...arr, t] : arr.filter((x) => x !== t);
      return next.length ? next : (["all"] as any);
    });
  };

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

  const typeLabelForExport =
    (selectedTypes as any)[0] === "all"
      ? "all"
      : (selectedTypes as TxType[]).join("-");

  const hasActiveFilter = useMemo(() => {
    return !Array.isArray(selectedTypes) || (selectedTypes as any)[0] !== "all";
  }, [selectedTypes]);

  const filterIsAll = !Array.isArray(selectedTypes) || (selectedTypes as any)[0] === "all";

  return {
    // Networks
    networks,
    setNetworks,
    networksButtonLabel,
    networksParam,
    toggleNetworkSelection,
    selectAllNetworks,
    resetToDefaultNetworks,
    // Date
    currentYear,
    datePreset,
    setDatePreset,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    dateRange,
    dateRangeKey,
    // Types
    selectedTypes,
    setSelectedTypes,
    selectedTypesKey,
    toggleType,
    isOnlyAllSelected,
    typeLabelForExport,
    hasActiveFilter,
    filterIsAll,
    // Columns
    visibleColumns,
    setVisibleColumns,
    visibleColumnsInit,
  };
}

