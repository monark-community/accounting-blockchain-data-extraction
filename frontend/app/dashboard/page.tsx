"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import Navbar from "@/components/Navbar";
import IncomeTab from "@/components/dashboard/IncomeTab";
import ExpensesTab from "@/components/dashboard/ExpensesTab";
import CapitalGainsTab from "@/components/dashboard/CapitalGainsTab";
import AllTransactionsTab from "@/components/dashboard/AllTransactionsTab";
import OverviewTab from "@/components/dashboard/OverviewTab";
import GraphsTab from "@/components/dashboard/GraphsTab";
import { TransactionsWorkspaceProvider } from "@/components/dashboard/TransactionsWorkspaceProvider";
import {
  CapitalGainsCalculator,
  type CapitalGainEntry,
  type AccountingMethod,
} from "@/utils/capitalGains";
import { fetchTransactions } from "@/lib/api/transactions";
import { useRouter } from "next/navigation";
import { useWallets } from "@/hooks/use-wallets";
import { OverviewResponse } from "@/lib/types/portfolio";
import {
  CHAIN_LABEL,
  computeHHI,
  isStable,
  classifyRiskBucket,
  type RiskBucketId,
} from "@/lib/portfolioUtils";
import {
  fetchHistoricalData,
  type HistoricalPoint,
  type HistoricalResponse,
} from "@/lib/api/analytics";
import type { TxRow } from "@/lib/types/transactions";
import { Crown } from "lucide-react";
import {
  NETWORK_OPTIONS,
  NETWORK_IDS,
  networkLabel,
  normalizeNetworkList,
  normalizeNetworkListFromString,
  serializeNetworks,
} from "@/lib/networks";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Plus, X, Sparkles } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const DASHBOARD_NETWORK_STORAGE_KEY = "dashboard.networks";
const DASHBOARD_NETWORK_HINTS_KEY = "dashboard.networkSuggestions";
const HISTORICAL_FALLBACK_PREFERENCE_KEY = "dashboard.historicalUseFallback";
const DASHBOARD_WALLET_SELECTION_KEY = "dashboard.selectedWallets";
const RAW_DEFAULT_DASHBOARD_NETWORKS =
  process.env.NEXT_PUBLIC_DASHBOARD_DEFAULT_NETWORKS ??
  process.env.NEXT_PUBLIC_DEFAULT_NETWORKS ??
  "mainnet";

const DASHBOARD_DEFAULT_NETWORKS = normalizeNetworkListFromString(
  RAW_DEFAULT_DASHBOARD_NETWORKS
);

const isTokenApiRateLimit = (message?: string | null) => {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("tokenapi") &&
    (lower.includes("rate limited") ||
      lower.includes("too_many_requests") ||
      lower.includes("429"))
  );
};

type NetworkSuggestion = {
  network: string;
  lastActivityTs: number | null;
  direction: "in" | "out" | "unknown";
};

const RISK_BUCKET_META: Record<
  RiskBucketId,
  {
    label: string;
    description: string;
    criteria: string;
    accent: string;
    barColor: string;
  }
> = {
  stable: {
    label: "Stablecoins",
    description: "Capital parked in USD-pegged assets.",
    criteria: "Symbols matching USDT, USDC, DAI, FRAX, LUSD, PYUSD, etc.",
    accent: "bg-emerald-100 text-emerald-800",
    barColor: "#10b981",
  },
  bluechip: {
    label: "Blue Chip",
    description: "ETH, BTC, and liquid staking derivatives.",
    criteria: "ETH/WETH, BTC/WBTC, and LSDs like stETH, rETH, cbETH.",
    accent: "bg-blue-100 text-blue-800",
    barColor: "#3b82f6",
  },
  longtail: {
    label: "Long Tail",
    description: "Higher-beta tokens and niche assets.",
    criteria: "All other ERC20 / token holdings outside the above buckets.",
    accent: "bg-amber-100 text-amber-800",
    barColor: "#f97316",
  },
};

const CHAIN_STACK_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f97316",
  "#a855f7",
  "#06b6d4",
  "#e11d48",
  "#facc15",
  "#0ea5e9",
];

const WALLET_COLOR_PALETTE = [
  "#6366f1",
  "#f97316",
  "#0ea5e9",
  "#14b8a6",
  "#ec4899",
  "#84cc16",
];

const MAX_MULTI_WALLETS = Number(
  process.env.NEXT_PUBLIC_DASHBOARD_MULTI_LIMIT ?? 3
);

const shortAddress = (address?: string | null) =>
  address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "—";

type WalletStat = {
  address: string;
  totalValueUsd: number;
  delta24hUsd: number;
};

type OverviewMergeResult = {
  overview: OverviewResponse;
  walletStats: WalletStat[];
};

type OverviewEntry = {
  address: string;
  overview: OverviewResponse;
};

type HoldingWithWallet = OverviewResponse["holdings"][number] & {
  walletAddress?: string;
};

function mergeOverviewResponses(entries: OverviewEntry[]): OverviewMergeResult {
  if (!entries.length) {
    const empty: OverviewResponse = {
      address: "",
      asOf: new Date().toISOString(),
      currency: "USD",
      kpis: { totalValueUsd: 0, delta24hUsd: 0, delta24hPct: 0 },
      holdings: [],
      allocation: [],
      topHoldings: [],
    };
    return { overview: empty, walletStats: [] };
  }

  if (entries.length === 1) {
    const only = entries[0];
    const holdings = only.overview.holdings.map((holding) => ({
      ...holding,
      walletAddress: only.address,
    })) as HoldingWithWallet[];
    const singleOverview: OverviewResponse = {
      ...only.overview,
      holdings,
    };
    return {
      overview: singleOverview,
      walletStats: [
        {
          address: only.address,
          totalValueUsd: only.overview.kpis.totalValueUsd ?? 0,
          delta24hUsd: only.overview.kpis.delta24hUsd ?? 0,
        },
      ],
    };
  }

  let totalValue = 0;
  let delta24h = 0;
  const holdings: HoldingWithWallet[] = [];
  const allocationMap = new Map<
    string,
    {
      symbol: string;
      chain: OverviewResponse["holdings"][number]["chain"];
      valueUsd: number;
    }
  >();

  const walletStats: WalletStat[] = [];

  for (const entry of entries) {
    const value = entry.overview.kpis.totalValueUsd ?? 0;
    const delta = entry.overview.kpis.delta24hUsd ?? 0;
    totalValue += value;
    delta24h += delta;
    walletStats.push({
      address: entry.address,
      totalValueUsd: value,
      delta24hUsd: delta,
    });

    for (const holding of entry.overview.holdings) {
      const enriched: HoldingWithWallet = {
        ...holding,
        walletAddress: entry.address,
      };
      holdings.push(enriched);
      const key = `${holding.symbol}-${holding.chain}-${
        holding.contract ?? ""
      }`;
      const existing = allocationMap.get(key);
      if (existing) {
        existing.valueUsd += holding.valueUsd ?? 0;
      } else {
        allocationMap.set(key, {
          symbol: holding.symbol,
          chain: holding.chain,
          valueUsd: holding.valueUsd ?? 0,
        });
      }
    }
  }

  const allocation = Array.from(allocationMap.values())
    .filter((item) => item.valueUsd > 0)
    .sort((a, b) => b.valueUsd - a.valueUsd)
    .map((item) => ({
      symbol: item.symbol,
      valueUsd: item.valueUsd,
      weightPct: totalValue > 0 ? (item.valueUsd / totalValue) * 100 : 0,
      chain: item.chain,
    }));

  const topHoldings = allocation.slice(0, 5).map((item) => ({
    symbol: item.symbol,
    valueUsd: item.valueUsd,
    weightPct: item.weightPct,
    chain: item.chain,
  }));

  const previousTotal = totalValue - delta24h;
  const delta24hPct =
    previousTotal !== 0 ? (delta24h / previousTotal) * 100 : 0;

  const merged: OverviewResponse = {
    address: entries.map((entry) => entry.address).join(","),
    asOf: new Date().toISOString(),
    currency: "USD",
    kpis: {
      totalValueUsd: totalValue,
      delta24hUsd: delta24h,
      delta24hPct,
    },
    holdings,
    allocation,
    topHoldings,
  };

  return { overview: merged, walletStats };
}

function mergeHistoricalResponses(
  responses: HistoricalResponse[]
): HistoricalPoint[] {
  const map = new Map<number, HistoricalPoint>();

  for (const response of responses) {
    for (const point of response.data ?? []) {
      const existing = map.get(point.timestamp);
      if (existing) {
        existing.totalValueUsd += point.totalValueUsd;
        for (const [chain, usd] of Object.entries(point.byChain ?? {})) {
          existing.byChain[chain] = (existing.byChain[chain] ?? 0) + usd;
        }
        for (const [asset, usd] of Object.entries(point.byAsset ?? {})) {
          existing.byAsset[asset] = (existing.byAsset[asset] ?? 0) + usd;
        }
      } else {
        map.set(point.timestamp, {
          date: point.date,
          timestamp: point.timestamp,
          totalValueUsd: point.totalValueUsd,
          byChain: { ...(point.byChain ?? {}) },
          byAsset: { ...(point.byAsset ?? {}) },
        });
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
}

const Dashboard = () => {
  const {
    connectedWallets,
    getWalletName,
    userPreferences,
    chainId,
    userWallet,
    isConnected,
  } = useWallet();
  const { wallets: userWallets } = useWallets();
  const router = useRouter();
  const [accountingMethod, setAccountingMethod] =
    useState<AccountingMethod>("FIFO");

  const [urlAddress, setUrlAddress] = useState<string>("");
  const [urlReady, setUrlReady] = useState(false);
  const [ov, setOv] = useState<OverviewResponse | null>(null);
  const [loadingOv, setLoadingOv] = useState(false);
  const [errorOv, setErrorOv] = useState<string | null>(null);
  const [showChange, setShowChange] = useState(false);
  const [selectedWallets, setSelectedWallets] = useState<string[]>([]);
  const [appliedWallets, setAppliedWallets] = useState<string[]>([]);
  const pricingWarningSourcesRef = useRef<Set<string>>(new Set());
  const [pricingWarningActive, setPricingWarningActive] = useState(false);
  const setPricingWarningFor = useCallback((source: string, flag: boolean) => {
    setPricingWarningActive((prev) => {
      const nextSet = new Set(pricingWarningSourcesRef.current);
      if (flag) {
        nextSet.add(source);
      } else {
        nextSet.delete(source);
      }
      pricingWarningSourcesRef.current = nextSet;
      const next = nextSet.size > 0;
      return next === prev ? prev : next;
    });
  }, []);

  const tokenApiWarningSourcesRef = useRef<Set<string>>(new Set());
  const [tokenApiWarningActive, setTokenApiWarningActive] = useState(false);
  const setTokenApiWarningFor = useCallback((source: string, flag: boolean) => {
    setTokenApiWarningActive((prev) => {
      const nextSet = new Set(tokenApiWarningSourcesRef.current);
      if (flag) {
        nextSet.add(source);
      } else {
        nextSet.delete(source);
      }
      tokenApiWarningSourcesRef.current = nextSet;
      const next = nextSet.size > 0;
      return next === prev ? prev : next;
    });
  }, []);
  const [walletSelectionDirty, setWalletSelectionDirty] = useState(false);
  const [minUsdFilter, setMinUsdFilter] = useState(5);
  const [hideStables, setHideStables] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [historicalData, setHistoricalData] = useState<HistoricalPoint[]>([]);
  const [loadingHistorical, setLoadingHistorical] = useState(false);
  const [isHistoricalEstimated, setIsHistoricalEstimated] = useState(false);
  const [walletLabelMode, setWalletLabelMode] = useState<"name" | "address">(
    "name"
  );
  const [walletStats, setWalletStats] = useState<WalletStat[]>([]);
  const [loadedFromStorage, setLoadedFromStorage] = useState(false);
  const handleToggleWallet = (walletAddress: string, checked: boolean) => {
    setSelectedWallets((prev) => {
      if (checked) {
        if (prev.includes(walletAddress)) return prev;
        if (prev.length >= MAX_MULTI_WALLETS) return prev;
        setWalletSelectionDirty(true);
        return [...prev, walletAddress];
      }
      const next = prev.filter((addr) => addr !== walletAddress);
      setWalletSelectionDirty(true);
      return next;
    });
  };

  const handleApplyWallets = () => {
    if (!selectedWallets.length) return;
    setAppliedWallets(selectedWallets);
    setWalletSelectionDirty(false);
  };

  const handleClearSelection = () => {
    setSelectedWallets([]);
    setWalletSelectionDirty(true);
  };

  const walletLimitReached =
    selectedWallets.length >= MAX_MULTI_WALLETS && !urlAddress;

  const handleSelectMainWallet = () => {
    if (urlAddress) return;
    const main = allWallets.find((wallet) => wallet.isMain);
    if (main) {
      setSelectedWallets([main.address]);
      setWalletSelectionDirty(true);
    }
  };

  const handleSelectAllWallets = () => {
    if (urlAddress) return;
    const next = allWallets
      .slice(0, MAX_MULTI_WALLETS)
      .map((wallet) => wallet.address);
    setSelectedWallets(next);
    setWalletSelectionDirty(true);
  };
  const [useFallbackEstimation, setUseFallbackEstimation] = useState(false);
  const overviewReady = !!ov && !loadingOv;
  const [capitalGainsData, setCapitalGainsData] = useState<{
    realized: CapitalGainEntry[];
    unrealized: CapitalGainEntry[];
    totalRealizedGains: number;
    totalUnrealizedGains: number;
    shortTermGains: number;
    longTermGains: number;
  }>({
    realized: [],
    unrealized: [],
    totalRealizedGains: 0,
    totalUnrealizedGains: 0,
    shortTermGains: 0,
    longTermGains: 0,
  });
  const [loadingCapitalGains, setLoadingCapitalGains] = useState(false);

  // Callback to handle historical fallback preference change
  const handleFallbackPreferenceChange = (useFallback: boolean) => {
    setUseFallbackEstimation(useFallback);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        HISTORICAL_FALLBACK_PREFERENCE_KEY,
        String(useFallback)
      );
    }
  };

  // Get address from URL params on client side to avoid hydration issues
  // Read ?address=... exactly once after mount
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setUrlAddress(sp.get("address") || "");
    setUrlReady(true);
  }, []);

  useEffect(() => {
    setMounted(true);
    // Load historical fallback preference from localStorage
    if (typeof window !== "undefined") {
      const storedPref = window.localStorage.getItem(
        HISTORICAL_FALLBACK_PREFERENCE_KEY
      );
      if (storedPref !== null) {
        setUseFallbackEstimation(storedPref === "true");
      }
    }
  }, []);

  // Get all wallets from backend (main wallet + linked wallets)
  const allWallets = useMemo(() => {
    return userWallets.map((w) => ({
      ...w,
      isMain: w.address.toLowerCase() === userWallet?.toLowerCase(),
    }));
  }, [userWallet, userWallets]);

  // Use URL address if available, otherwise use connected wallet address
  const walletMetaMap = useMemo(() => {
    const map = new Map<
      string,
      { address: string; name: string; isMain: boolean; color: string }
    >();
    allWallets.forEach((wallet, idx) => {
      map.set(wallet.address.toLowerCase(), {
        address: wallet.address,
        name: wallet.name,
        isMain: wallet.isMain,
        color: WALLET_COLOR_PALETTE[idx % WALLET_COLOR_PALETTE.length],
      });
    });
    return map;
  }, [allWallets]);

  const activeWallets = useMemo(() => {
    if (urlAddress) {
      return urlAddress ? [urlAddress] : [];
    }
    if (appliedWallets.length) {
      return appliedWallets;
    }
    if (selectedWallets.length) {
      return selectedWallets;
    }
    if (isConnected && userWallet) {
      return [userWallet];
    }
    return [];
  }, [urlAddress, appliedWallets, selectedWallets, isConnected, userWallet]);

  const address = activeWallets[0] ?? "";
  const isMultiWalletView = activeWallets.length > 1;

  // Auto-select first wallet (main wallet) when wallets are loaded
  useEffect(() => {
    if (urlAddress) return;
    if (allWallets.length > 0 && selectedWallets.length === 0) {
      const first = [allWallets[0].address];
      setSelectedWallets(first);
      setAppliedWallets(first);
      setWalletSelectionDirty(false);
    }
  }, [allWallets, selectedWallets.length, urlAddress]);

  // Reset selections when user disconnects
  useEffect(() => {
    if (!isConnected && !urlAddress) {
      setSelectedWallets([]);
      setAppliedWallets([]);
      setWalletStats([]);
      setWalletSelectionDirty(false);
    }
  }, [isConnected, urlAddress]);

  // Redirect to home ONLY after URL is parsed and truly no address is available
  useEffect(() => {
    if (!urlReady) return;
    if (!address && !isConnected) {
      router.push("/");
    }
  }, [urlReady, address, isConnected, router]);

  const [networks, setNetworks] = useState<string[]>(() => {
    if (typeof window === "undefined") {
      return [...DASHBOARD_DEFAULT_NETWORKS];
    }
    const sp = new URLSearchParams(window.location.search);
    const urlNetworks = sp.get("networks");
    if (urlNetworks) {
      return normalizeNetworkListFromString(urlNetworks);
    }
    const stored = window.localStorage.getItem(DASHBOARD_NETWORK_STORAGE_KEY);
    if (stored) {
      return normalizeNetworkListFromString(stored);
    }
    return [...DASHBOARD_DEFAULT_NETWORKS];
  });

  const networksParam = useMemo(() => serializeNetworks(networks), [networks]);

  const sameNetworks = (a: string[], b: string[]) =>
    a.length === b.length && a.every((value, idx) => value === b[idx]);

  const [networkSuggestions, setNetworkSuggestions] = useState<
    NetworkSuggestion[]
  >([]);
  const [loadingNetworkHints, setLoadingNetworkHints] = useState(false);
  const [enableNetworkSuggestions, setEnableNetworkSuggestions] =
    useState<boolean>(() => {
      if (typeof window === "undefined") return true;
      const stored = window.localStorage.getItem(DASHBOARD_NETWORK_HINTS_KEY);
      return stored === "false" ? false : true;
    });

  useEffect(() => {
    if (!urlReady) return;
    const sp = new URLSearchParams(window.location.search);
    const urlNetworks = sp.get("networks");
    if (!urlNetworks) return;
    const normalized = normalizeNetworkListFromString(urlNetworks);
    setNetworks((prev) => (sameNetworks(prev, normalized) ? prev : normalized));
  }, [urlReady]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      DASHBOARD_NETWORK_STORAGE_KEY,
      serializeNetworks(networks)
    );
  }, [networks]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      DASHBOARD_NETWORK_HINTS_KEY,
      enableNetworkSuggestions ? "true" : "false"
    );
  }, [enableNetworkSuggestions]);

  useEffect(() => {
    if (typeof window === "undefined" || urlAddress || loadedFromStorage)
      return;
    if (!allWallets.length) return;
    const stored = window.localStorage.getItem(DASHBOARD_WALLET_SELECTION_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as string[];
        const valid = parsed.filter((addr) =>
          allWallets.some(
            (wallet) => wallet.address.toLowerCase() === addr.toLowerCase()
          )
        );
        if (valid.length) {
          const limited = valid.slice(0, MAX_MULTI_WALLETS);
          setSelectedWallets(limited);
          setAppliedWallets(limited);
          setWalletSelectionDirty(false);
        }
      } catch {
        // ignore parse errors
      }
    }
    setLoadedFromStorage(true);
  }, [allWallets, urlAddress, loadedFromStorage]);

  useEffect(() => {
    if (typeof window === "undefined" || urlAddress) return;
    if (!appliedWallets.length) {
      window.localStorage.removeItem(DASHBOARD_WALLET_SELECTION_KEY);
      return;
    }
    window.localStorage.setItem(
      DASHBOARD_WALLET_SELECTION_KEY,
      JSON.stringify(appliedWallets)
    );
  }, [appliedWallets, urlAddress]);

  useEffect(() => {
    if (!enableNetworkSuggestions) {
      setNetworkSuggestions([]);
      setLoadingNetworkHints(false);
      return;
    }
    if (!address) {
      setNetworkSuggestions([]);
      return;
    }
    const remaining = NETWORK_IDS.filter((id) => !networks.includes(id));
    if (!remaining.length) {
      setNetworkSuggestions([]);
      return;
    }
    const controller = new AbortController();
    setLoadingNetworkHints(true);
    const query = serializeNetworks(remaining);
    fetch(
      `/api/networks/activity/${encodeURIComponent(
        address
      )}?networks=${encodeURIComponent(query)}&_ts=${Date.now()}`,
      { signal: controller.signal }
    )
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || "Failed to load network activity");
        }
        return res.json();
      })
      .then((payload) => {
        const list = Array.isArray(payload?.suggestions)
          ? payload.suggestions
          : Array.isArray(payload?.summaries)
          ? payload.summaries
          : [];
        setNetworkSuggestions(
          list.map((item: any) => ({
            network: item?.network,
            lastActivityTs:
              typeof item?.lastActivityTs === "number"
                ? item.lastActivityTs
                : null,
            direction:
              item?.direction === "in" || item?.direction === "out"
                ? item.direction
                : "unknown",
          }))
        );
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        console.error("[Dashboard] Failed to load network suggestions:", err);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingNetworkHints(false);
        }
      });
    return () => controller.abort();
  }, [address, networks, enableNetworkSuggestions]);

  const fetchOverviewSnapshot = useCallback(
    async (targetAddress: string) => {
      const url = `/api/holdings/${encodeURIComponent(
        targetAddress
      )}?networks=${encodeURIComponent(
        networksParam
      )}&withDelta24h=true&minUsd=0&includeZero=true&spamFilter=hard&_ts=${Date.now()}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        let message = "Failed to load overview";
        try {
          const detail = await res.json();
          message =
            detail?.error ??
            detail?.message ??
            (typeof detail === "string" ? detail : JSON.stringify(detail));
        } catch {
          message = await res.text();
        }
        setTokenApiWarningFor("overview", isTokenApiRateLimit(message));
        throw new Error(message || "Failed to load overview");
      }
      const data = (await res.json()) as OverviewResponse;
      setTokenApiWarningFor(
        `overview:${targetAddress}`,
        !!data?.warnings?.tokenApiRateLimited
      );
      setPricingWarningFor(
        `overview:${targetAddress}`,
        !!data?.warnings?.defiLlamaRateLimited
      );
      return data;
    },
    [networksParam, setTokenApiWarningFor, setPricingWarningFor]
  );

  useEffect(() => {
    if (!activeWallets.length) return;
    let cancelled = false;
    setLoadingOv(true);
    setErrorOv(null);

    Promise.all(
      activeWallets.map((walletAddress) =>
        fetchOverviewSnapshot(walletAddress).then((overview) => ({
          address: walletAddress,
          overview,
        }))
      )
    )
      .then((entries) => {
        if (cancelled) return;
        const merged = mergeOverviewResponses(entries);
        setOv(merged.overview);
        setWalletStats(merged.walletStats);
        setTokenApiWarningFor("overview", false);
        const warn = entries.some(
          (entry) => entry.overview.warnings?.defiLlamaRateLimited
        );
        setPricingWarningFor("overview", warn);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error("[Dashboard] Failed to load overview:", e);
        setOv(null);
        setWalletStats([]);
        setErrorOv(
          typeof e?.message === "string"
            ? e.message
            : e?.error ?? "Failed to load overview"
        );
        setTokenApiWarningFor("overview", isTokenApiRateLimit(e?.message));
        setPricingWarningFor("overview", false);
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingOv(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeWallets, fetchOverviewSnapshot, setPricingWarningFor]);

  const addNetwork = (networkId: string) =>
    setNetworks((prev) => {
      if (prev.includes(networkId)) return prev;
      return normalizeNetworkList([...prev, networkId]);
    });

  const removeNetwork = (networkId: string) =>
    setNetworks((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((id) => id !== networkId);
      return next.length ? next : prev;
    });

  const toggleNetwork = (networkId: string, checked: boolean) =>
    setNetworks((prev) => {
      if (checked) {
        if (prev.includes(networkId)) return prev;
        return normalizeNetworkList([...prev, networkId]);
      }
      if (prev.length <= 1) return prev;
      return prev.filter((id) => id !== networkId);
    });

  const resetNetworks = () => setNetworks([...DASHBOARD_DEFAULT_NETWORKS]);
  const selectAllNetworks = () => setNetworks([...NETWORK_IDS]);

  // Fetch historical data for 6-month graph
  useEffect(() => {
    if (!activeWallets.length || !overviewReady) {
      console.log(
        "[Dashboard] Historical data fetch postponed until overview is ready"
      );
      return;
    }
    let cancelled = false;
    setLoadingHistorical(true);
    Promise.all(
      activeWallets.map((walletAddress) =>
        fetchHistoricalData(walletAddress, {
          networks: networksParam,
          days: 180,
          useFallback: useFallbackEstimation,
        })
      )
    )
      .then((responses) => {
        if (cancelled) return;
        const merged = mergeHistoricalResponses(responses);
        setHistoricalData(merged);
        setIsHistoricalEstimated(responses.some((resp) => resp.isEstimated));
        const priceWarn = responses.some(
          (resp) => resp.warnings?.defiLlamaRateLimited
        );
        const tokenWarn = responses.some(
          (resp) => resp.warnings?.tokenApiRateLimited
        );
        setPricingWarningFor("historical", priceWarn);
        setTokenApiWarningFor("historical", tokenWarn);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error("[Dashboard] Failed to load historical data:", e);
        setTokenApiWarningFor("historical", isTokenApiRateLimit(e?.message));
        setPricingWarningFor("historical", false);
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingHistorical(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeWallets,
    networksParam,
    overviewReady,
    useFallbackEstimation,
    setPricingWarningFor,
    setTokenApiWarningFor,
  ]);

  useEffect(() => {
    if (!activeWallets.length || !overviewReady) {
      return;
    }
    let cancelled = false;
    async function loadCapitalGains() {
      setLoadingCapitalGains(true);
      try {
        const calculator = new CapitalGainsCalculator(accountingMethod);
        const rows: TxRow[] = [];
        const MAX_PAGES = 3;
        for (const walletAddress of activeWallets) {
          for (let page = 1; page <= MAX_PAGES; page++) {
            const resp = await fetchTransactions(walletAddress, {
              networks: networksParam,
              page,
              limit: 40,
              minUsd: 0,
              spamFilter: "hard",
            });
            rows.push(...resp.rows);
            if (!resp.hasNext) break;
          }
        }
        rows.sort(
          (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
        );
        const assetLabels = new Map<string, string>();
        const getAssetKey = (row: TxRow) =>
          row.asset.contract?.toLowerCase() ??
          row.asset.symbol?.toUpperCase() ??
          "UNKNOWN";
        const formatLabel = (row: TxRow, key: string) =>
          row.asset.symbol ||
          (row.asset.contract
            ? `${row.asset.contract.slice(0, 6)}…${row.asset.contract.slice(
                -4
              )}`
            : key);

        const realizedEntries: CapitalGainEntry[] = [];

        rows.forEach((row, idx) => {
          const totalValue = row.usdAtTs ?? null;
          const qty = Math.abs(parseFloat(row.qty || "0"));
          if (!totalValue || !Number.isFinite(totalValue) || !qty) return;
          const unitPrice = totalValue / qty;
          if (!Number.isFinite(unitPrice) || unitPrice === 0) return;

          const assetKey = getAssetKey(row);
          const label = formatLabel(row, assetKey);
          assetLabels.set(assetKey, label);
          const day = row.ts.split("T")[0];

          if (row.direction === "in") {
            calculator.addToCostBasis({
              id: `${row.hash}-${idx}`,
              asset: assetKey,
              quantity: qty,
              costBasis: totalValue,
              purchaseDate: day,
              purchasePrice: unitPrice,
            });
          } else {
            const gains = calculator.calculateGains(
              assetKey,
              qty,
              unitPrice,
              day,
              row.hash
            );
            if (gains.length === 0) {
              realizedEntries.push({
                id: `${row.hash}-${idx}`,
                asset: label,
                quantity: qty,
                salePrice: unitPrice,
                costBasis: 0,
                gain: totalValue,
                gainPercent: 100,
                holdingPeriod: 0,
                isLongTerm: false,
                saleDate: day,
                purchaseDate: day,
                transactionId: row.hash,
              });
              return;
            }
            gains.forEach((g) =>
              realizedEntries.push({
                ...g,
                asset: assetLabels.get(g.asset) ?? label,
              })
            );
          }
        });

        const currentPriceMap = new Map<string, number>();
        (ov?.holdings ?? []).forEach((holding) => {
          const key =
            holding.contract?.toLowerCase() ?? holding.symbol?.toUpperCase();
          if (!key) return;
          currentPriceMap.set(key, holding.priceUsd ?? 0);
          if (!assetLabels.has(key)) assetLabels.set(key, holding.symbol);
        });

        const unrealizedEntries = calculator
          .getUnrealizedGains(currentPriceMap)
          .map((entry) => ({
            ...entry,
            asset: assetLabels.get(entry.asset) ?? entry.asset,
          }));

        const totalRealizedGains = realizedEntries.reduce(
          (sum, item) => sum + (item.gain ?? 0),
          0
        );
        const totalUnrealizedGains = unrealizedEntries.reduce(
          (sum, item) => sum + (item.gain ?? 0),
          0
        );
        const shortTermGains = realizedEntries
          .filter((item) => !item.isLongTerm)
          .reduce((sum, item) => sum + item.gain, 0);
        const longTermGains = realizedEntries
          .filter((item) => item.isLongTerm)
          .reduce((sum, item) => sum + item.gain, 0);

        if (!cancelled) {
          setCapitalGainsData({
            realized: realizedEntries,
            unrealized: unrealizedEntries,
            totalRealizedGains,
            totalUnrealizedGains,
            shortTermGains,
            longTermGains,
          });
          setTokenApiWarningFor("capitalGains", false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[Dashboard] Failed to compute capital gains:", err);
          setCapitalGainsData((prev) => ({
            ...prev,
            realized: [],
            unrealized: [],
            totalRealizedGains: 0,
            totalUnrealizedGains: 0,
            shortTermGains: 0,
            longTermGains: 0,
          }));
          setTokenApiWarningFor(
            "capitalGains",
            isTokenApiRateLimit((err as Error)?.message)
          );
        }
      } finally {
        if (!cancelled) setLoadingCapitalGains(false);
      }
    }
    loadCapitalGains();
    return () => {
      cancelled = true;
    };
  }, [
    activeWallets,
    networksParam,
    accountingMethod,
    overviewReady,
    ov,
    setTokenApiWarningFor,
  ]);

  const historicalChartData = useMemo(() => {
    console.log(
      `[Dashboard] Processing historical data: ${historicalData.length} points`
    );
    if (historicalData.length === 0) {
      console.log("[Dashboard] No historical data to process");
      return [];
    }
    const processed = historicalData
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((point) => ({
        date: new Date(point.date).toLocaleDateString("fr-FR", {
          month: "short",
          day: "numeric",
        }),
        value: point.totalValueUsd,
        timestamp: point.timestamp,
      }));
    console.log(`[Dashboard] Processed chart data: ${processed.length} points`);
    return processed;
  }, [historicalData]);

  const netFlowData = useMemo(() => {
    if (historicalData.length < 2) return [];
    const sorted = [...historicalData].sort(
      (a, b) => a.timestamp - b.timestamp
    );
    const flows: Array<{ date: string; delta: number }> = [];
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const current = sorted[i];
      const delta = current.totalValueUsd - prev.totalValueUsd;
      flows.push({
        date: new Date(current.date).toLocaleDateString("fr-FR", {
          month: "short",
          day: "numeric",
        }),
        delta,
      });
    }
    return flows;
  }, [historicalData]);

  const chainHistory = useMemo(() => {
    if (historicalData.length === 0) {
      return {
        data: [] as Record<string, number | string>[],
        series: [] as Array<{ key: string; label: string; color: string }>,
      };
    }
    const sorted = [...historicalData].sort(
      (a, b) => a.timestamp - b.timestamp
    );
    const chainSet = new Set<string>();
    for (const point of sorted) {
      Object.keys(point.byChain ?? {}).forEach((chain) => chainSet.add(chain));
    }
    const seriesKeys = Array.from(chainSet);
    if (!seriesKeys.length) {
      return { data: [], series: [] };
    }
    const data = sorted.map((point) => {
      const row: Record<string, number | string> = {
        date: new Date(point.date).toLocaleDateString("fr-FR", {
          month: "short",
          day: "numeric",
        }),
      };
      const total = point.totalValueUsd || 0;
      seriesKeys.forEach((chain) => {
        const usd = point.byChain?.[chain] ?? 0;
        row[chain] = total > 0 ? (usd / total) * 100 : 0;
      });
      return row;
    });
    const series = seriesKeys.map((chain, idx) => ({
      key: chain,
      label: CHAIN_LABEL[chain] ?? chain,
      color: CHAIN_STACK_COLORS[idx % CHAIN_STACK_COLORS.length],
    }));
    return { data, series };
  }, [historicalData]);

  const allocationData = useMemo(() => {
    if (!ov) return [];
    // keep only priced tokens (value > 0)
    const items = ov.allocation
      .filter((a) => (a.valueUsd ?? 0) > 0)
      .sort((a, b) => b.valueUsd - a.valueUsd);

    // top N, group the rest as "Other"
    const TOP_N = 8;
    const top = items.slice(0, TOP_N);
    const otherVal = items.slice(TOP_N).reduce((s, x) => s + x.valueUsd, 0);
    const total = top.reduce((s, x) => s + x.valueUsd, 0) + otherVal || 1;

    const rows = top.map((a) => ({
      name: a.symbol || "(unknown)",
      pct: (a.valueUsd / total) * 100,
      usd: a.valueUsd,
    }));
    if (otherVal > 0) {
      rows.push({
        name: "Other",
        pct: (otherVal / total) * 100,
        usd: otherVal,
      });
    }
    return rows;
  }, [ov]);

  // --- Overview state ---
  const topHoldingsLive = useMemo(() => {
    const rows = (ov?.holdings ?? []).slice();
    rows.sort((a, b) => {
      const va = a.valueUsd ?? 0;
      const vb = b.valueUsd ?? 0;
      if (vb !== va) return vb - va; // prefer priced when available
      // fallback by qty if both 0
      const qa = parseFloat(a.qty || "0");
      const qb = parseFloat(b.qty || "0");
      return qb - qa;
    });
    return rows.slice(0, 5);
  }, [ov]);

  // Chain-level breakdown (sum of values per chain)
  const chainBreakdown = useMemo(() => {
    if (!ov) return [];
    const byChain = new Map<string, number>();
    for (const h of ov.holdings) {
      byChain.set(h.chain, (byChain.get(h.chain) ?? 0) + (h.valueUsd || 0));
    }
    const total = Array.from(byChain.values()).reduce((s, v) => s + v, 0) || 1;
    return Array.from(byChain.entries())
      .map(([chain, usd]) => ({
        chain,
        label: CHAIN_LABEL[chain] ?? chain,
        usd,
        pct: (usd / total) * 100,
      }))
      .sort((a, b) => b.usd - a.usd);
  }, [ov]);

  // Top movers (24h) — requires deltas present
  const movers = useMemo(() => {
    const rows = (ov?.holdings ?? []).filter(
      (h) => typeof h.delta24hUsd === "number"
    );
    const gainers = rows
      .slice()
      .sort((a, b) => b.delta24hUsd! - a.delta24hUsd!)
      .slice(0, 5);
    const losers = rows
      .slice()
      .sort((a, b) => a.delta24hUsd! - b.delta24hUsd!)
      .slice(0, 5);
    return { gainers, losers };
  }, [ov]);

  // Concentration metrics & stablecoin share (quick badges)
  const concentration = useMemo(() => {
    const w = (ov?.allocation ?? []).map((a) => a.weightPct);
    const hhi = computeHHI(w);
    const label =
      hhi > 25
        ? "Highly concentrated"
        : hhi > 15
        ? "Moderately concentrated"
        : "Well diversified";
    const stablesUSD = (ov?.holdings ?? [])
      .filter((h) => isStable(h.symbol))
      .reduce((s, h) => s + (h.valueUsd || 0), 0);
    const stableSharePct =
      (ov?.kpis.totalValueUsd ?? 0) > 0
        ? (stablesUSD / ov!.kpis.totalValueUsd) * 100
        : 0;
    return { hhi, label, stableSharePct };
  }, [ov]);

  const stableVsRisk = useMemo(() => {
    if (!ov) return { stable: 0, nonStable: 0 };
    const stable = (ov.holdings ?? [])
      .filter((h) => isStable(h.symbol))
      .reduce((s, h) => s + (h.valueUsd || 0), 0);
    const total = ov.kpis.totalValueUsd || 0;
    return { stable, nonStable: Math.max(total - stable, 0) };
  }, [ov]);

  const riskBuckets = useMemo(() => {
    const totals: Record<RiskBucketId, number> = {
      stable: 0,
      bluechip: 0,
      longtail: 0,
    };
    const counts: Record<RiskBucketId, number> = {
      stable: 0,
      bluechip: 0,
      longtail: 0,
    };
    for (const holding of ov?.holdings ?? []) {
      const bucket = classifyRiskBucket(holding.symbol);
      const value = holding.valueUsd || 0;
      totals[bucket] += value;
      if (value > 0) counts[bucket] += 1;
    }
    const totalValue = ov?.kpis.totalValueUsd || 0;
    return (
      Object.entries(RISK_BUCKET_META) as Array<
        [RiskBucketId, (typeof RISK_BUCKET_META)[RiskBucketId]]
      >
    ).map(([id, meta]) => ({
      id,
      label: meta.label,
      description: meta.description,
      criteria: meta.criteria,
      accent: meta.accent,
      barColor: meta.barColor,
      usd: totals[id],
      pct: totalValue > 0 ? (totals[id] / totalValue) * 100 : 0,
      assetCount: counts[id],
    }));
  }, [ov]);
  const stableBucketUsd =
    riskBuckets.find((bucket) => bucket.id === "stable")?.usd ?? 0;

  const appliedWalletDisplay = useMemo(() => {
    const list = urlAddress
      ? [urlAddress]
      : appliedWallets.length
      ? appliedWallets
      : [];
    return list.map((addr, idx) => {
      const meta = walletMetaMap.get(addr.toLowerCase());
      const label =
        walletLabelMode === "address" || urlAddress
          ? shortAddress(addr)
          : meta?.name ?? shortAddress(addr);
      const color =
        meta?.color ?? WALLET_COLOR_PALETTE[idx % WALLET_COLOR_PALETTE.length];
      return { address: addr, label, color };
    });
  }, [urlAddress, appliedWallets, walletLabelMode, walletMetaMap]);

  const walletDisplayItems = useMemo(() => {
    if (!walletStats.length) return [];
    return walletStats.map((stat, idx) => {
      const meta = walletMetaMap.get(stat.address.toLowerCase());
      const label =
        walletLabelMode === "address" || !meta
          ? shortAddress(stat.address)
          : meta.name;
      const color =
        meta?.color ?? WALLET_COLOR_PALETTE[idx % WALLET_COLOR_PALETTE.length];
      return { ...stat, label, color };
    });
  }, [walletStats, walletLabelMode, walletMetaMap]);

  const walletLabelLookup = useMemo(() => {
    const lookup: Record<string, { label: string; color: string }> = {};
    walletDisplayItems.forEach((item) => {
      lookup[item.address.toLowerCase()] = {
        label: item.label,
        color: item.color,
      };
    });
    return lookup;
  }, [walletDisplayItems]);

  const appliedWalletSummary = appliedWalletDisplay
    .map((wallet) => wallet.label)
    .join(" + ");
  const aggregatedWalletCount = urlAddress
    ? 1
    : appliedWalletDisplay.length || selectedWallets.length || 0;

  const effectiveN = (weightsPct: number[]) => {
    const w = weightsPct.map((p) => p / 100);
    const sumSq = w.reduce((s, x) => s + x * x, 0) || 1;
    return 1 / sumSq;
  };

  const concentrationExtras = useMemo(() => {
    const ws = (ov?.allocation ?? []).map((a) => a.weightPct);
    const effN = effectiveN(ws);
    const sorted = [...(ov?.allocation ?? [])].sort(
      (a, b) => b.weightPct - a.weightPct
    );
    const top1 = sorted[0]?.weightPct ?? 0;
    const top3 = sorted.slice(0, 3).reduce((s, a) => s + a.weightPct, 0);
    return { effN, top1, top3 };
  }, [ov]);

  const pnlByChain = useMemo(() => {
    const map = new Map<
      string,
      { label: string; pnl: number; value: number }
    >();
    for (const h of ov?.holdings ?? []) {
      const cur = map.get(h.chain) ?? {
        label: CHAIN_LABEL[h.chain] ?? h.chain,
        pnl: 0,
        value: 0,
      };
      cur.pnl += h.delta24hUsd ?? 0;
      cur.value += h.valueUsd ?? 0;
      map.set(h.chain, cur);
    }
    return [...map.values()].sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));
  }, [ov]);

  const filteredHoldings = useMemo(() => {
    return (ov?.holdings ?? [])
      .filter((h) => (h.valueUsd ?? 0) >= minUsdFilter)
      .filter((h) => (hideStables ? !isStable(h.symbol) : true))
      .sort((a, b) => (b.valueUsd || 0) - (a.valueUsd || 0));
  }, [ov, minUsdFilter, hideStables]);

  const quality = useMemo(() => {
    if (!ov) return null;
    const tvl = ov.kpis.totalValueUsd || 1;
    const volProxy = (Math.abs(ov.kpis.delta24hUsd || 0) / tvl) * 100;
    const bluechipShare =
      ((ov.holdings ?? [])
        .filter((h) =>
          ["ETH", "WETH", "WBTC", "BTC"].includes(
            (h.symbol || "").toUpperCase()
          )
        )
        .reduce((s, h) => s + (h.valueUsd || 0), 0) /
        tvl) *
      100;
    const chainSpread = chainBreakdown.filter((c) => c.pct >= 2).length;
    return { volProxy, bluechipShare, chainSpread };
  }, [ov, chainBreakdown]);

  const formatLastActivity = (timestamp: number | null) => {
    if (!timestamp) return "No recent activity";
    const diffSeconds = Math.max(0, Math.floor(Date.now() / 1000) - timestamp);
    if (diffSeconds < 60) return "Just now";
    if (diffSeconds < 3600) {
      const mins = Math.floor(diffSeconds / 60);
      return `${mins} min${mins === 1 ? "" : "s"} ago`;
    }
    if (diffSeconds < 86400) {
      const hours = Math.floor(diffSeconds / 3600);
      return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    }
    const days = Math.floor(diffSeconds / 86400);
    if (days < 30) {
      return `${days} day${days === 1 ? "" : "s"} ago`;
    }
    const months = Math.floor(days / 30);
    return `${months} mo${months === 1 ? "" : "s"} ago`;
  };

  const suggestionCandidates = useMemo(
    () =>
      networkSuggestions
        .filter(
          (hint) =>
            hint.network &&
            !networks.includes(hint.network) &&
            typeof hint.lastActivityTs === "number"
        )
        .sort((a, b) => (b.lastActivityTs ?? 0) - (a.lastActivityTs ?? 0))
        .slice(0, 3),
    [networkSuggestions, networks]
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-800 mb-2">
                Portfolio Dashboard
              </h1>
              <p className="text-slate-600">
                Track your crypto assets and tax obligations
              </p>
            </div>
            {urlAddress ? (
              <div className="text-sm text-slate-500 border border-slate-200 rounded-full px-4 py-2 bg-white shadow-sm">
                Viewing shared address {shortAddress(urlAddress)}
              </div>
            ) : isConnected && allWallets.length > 0 ? (
              <div className="flex flex-col items-end gap-3">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="border-2 border-slate-200"
                      >
                        Select wallets ({selectedWallets.length}/
                        {MAX_MULTI_WALLETS})
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-72">
                      <DropdownMenuLabel>
                        Wallets (max {MAX_MULTI_WALLETS})
                      </DropdownMenuLabel>
                      {allWallets.map((wallet) => {
                        const checked = selectedWallets.includes(
                          wallet.address
                        );
                        const disabled =
                          !checked &&
                          selectedWallets.length >= MAX_MULTI_WALLETS;
                        return (
                          <DropdownMenuCheckboxItem
                            key={wallet.address}
                            checked={checked}
                            disabled={disabled}
                            onCheckedChange={(value) =>
                              handleToggleWallet(wallet.address, !!value)
                            }
                          >
                            <div className="flex items-center gap-2">
                              {wallet.isMain && (
                                <Crown className="w-3.5 h-3.5 text-amber-500" />
                              )}
                              <div className="flex flex-col">
                                <span className="text-sm font-medium text-slate-800">
                                  {wallet.name}
                                </span>
                                <span className="text-[11px] text-slate-500 font-mono">
                                  {shortAddress(wallet.address)}
                                </span>
                              </div>
                            </div>
                          </DropdownMenuCheckboxItem>
                        );
                      })}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        disabled={!selectedWallets.length}
                        onSelect={(event) => {
                          event.preventDefault();
                          handleClearSelection();
                        }}
                      >
                        Clear selection
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant="outline"
                    size="icon"
                    className="border-2 border-slate-200"
                    onClick={handleSelectMainWallet}
                    disabled={!!urlAddress || !allWallets.length}
                    title="Select main wallet"
                  >
                    <Crown className="h-4 w-4 text-amber-500" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-2 border-slate-200"
                    onClick={handleSelectAllWallets}
                    disabled={!!urlAddress || !allWallets.length}
                  >
                    Select {Math.min(MAX_MULTI_WALLETS, allWallets.length)}
                  </Button>
                  <Button
                    onClick={handleApplyWallets}
                    disabled={!selectedWallets.length || !walletSelectionDirty}
                  >
                    Update selection
                    {walletSelectionDirty && selectedWallets.length ? (
                      <span className="ml-2 text-xs text-amber-200">
                        pending
                      </span>
                    ) : null}
                  </Button>
                </div>
                <div className="flex flex-col items-end text-xs text-slate-500 gap-1">
                  <span>
                    Aggregating {aggregatedWalletCount} / {MAX_MULTI_WALLETS}{" "}
                    wallets
                  </span>
                  {walletSelectionDirty &&
                    selectedWallets.length > 0 &&
                    !urlAddress && (
                      <span className="inline-flex items-center gap-1 text-amber-600">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Apply the new selection to refresh data
                      </span>
                    )}
                </div>
                {walletLimitReached && (
                  <p className="text-xs text-amber-600">
                    Free tier limited to {MAX_MULTI_WALLETS} wallets. Manage
                    additional wallets from the Manage Wallets tab.
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {appliedWalletDisplay.length ? (
                    appliedWalletDisplay.map((wallet) => (
                      <Badge
                        key={wallet.address}
                        variant="secondary"
                        className="flex items-center gap-2 rounded-full bg-white text-slate-700 border border-slate-200"
                      >
                        <span
                          className="inline-block w-2 h-2 rounded-full"
                          style={{ backgroundColor: wallet.color }}
                        />
                        {wallet.label}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500">
                      Select up to {MAX_MULTI_WALLETS} wallets to aggregate.
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Label style:</span>
                  <Button
                    size="sm"
                    variant={walletLabelMode === "name" ? "default" : "outline"}
                    onClick={() => setWalletLabelMode("name")}
                  >
                    Nicknames
                  </Button>
                  <Button
                    size="sm"
                    variant={
                      walletLabelMode === "address" ? "default" : "outline"
                    }
                    onClick={() => setWalletLabelMode("address")}
                  >
                    Addresses
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <Card className="mb-8 shadow-sm border border-slate-200">
          <div className="flex flex-col gap-4 p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">
                  Chains in Overview & Graphs
                </h2>
                <p className="text-sm text-slate-500">
                  Only the selected chains are fetched for balances, KPIs, and
                  visualizations.
                </p>
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Switch
                    checked={enableNetworkSuggestions}
                    onCheckedChange={setEnableNetworkSuggestions}
                    id="suggestion-switch"
                  />
                  <label htmlFor="suggestion-switch">
                    Suggest chains automatically
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetNetworks}
                    disabled={sameNetworks(
                      networks,
                      DASHBOARD_DEFAULT_NETWORKS
                    )}
                  >
                    Reset
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Plus className="h-4 w-4" />
                        Manage Chains
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-60">
                      <DropdownMenuLabel>Select chains</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {NETWORK_OPTIONS.map((net) => (
                        <DropdownMenuCheckboxItem
                          key={net.id}
                          checked={networks.includes(net.id)}
                          onCheckedChange={(checked) =>
                            toggleNetwork(net.id, Boolean(checked))
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
                          resetNetworks();
                        }}
                      >
                        Reset to default
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {networks.map((networkId) => (
                <Badge
                  key={networkId}
                  variant="secondary"
                  className="flex items-center gap-2 rounded-full px-3 py-1 text-sm"
                >
                  {networkLabel(networkId)}
                  {networks.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Remove ${networkLabel(networkId)}`}
                      className="text-slate-500 hover:text-slate-700 transition-colors"
                      onClick={() => removeNetwork(networkId)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              ))}
            </div>
            {!enableNetworkSuggestions ? (
              <p className="text-xs text-slate-500">Suggestions disabled.</p>
            ) : loadingNetworkHints ? (
              <p className="text-xs text-slate-500">
                Scanning other chains for recent activity…
              </p>
            ) : suggestionCandidates.length > 0 ? (
              <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/70 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-blue-900">
                  <Sparkles className="h-4 w-4" />
                  Recently active chains
                </div>
                <div className="space-y-3">
                  {suggestionCandidates.map((hint) => (
                    <div
                      key={hint.network}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-white p-3 shadow-sm"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {networkLabel(hint.network)}
                        </p>
                        <p className="text-xs text-slate-500">
                          Last tx {formatLastActivity(hint.lastActivityTs)}
                          {hint.direction !== "unknown"
                            ? ` • ${
                                hint.direction === "in" ? "Inbound" : "Outbound"
                              }`
                            : ""}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addNetwork(hint.network)}
                      >
                        Add
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </Card>

        {pricingWarningActive && (
          <Alert variant="warning" className="border-amber-200 bg-amber-50">
            <AlertTitle>Price data temporarily limited</AlertTitle>
            <AlertDescription>
              DeFiLlama rate limits prevented fresh USD prices. 24h changes,
              charts, and transaction values may appear as zero until pricing
              resumes.
            </AlertDescription>
          </Alert>
        )}
        {tokenApiWarningActive && (
          <Alert variant="destructive" className="border-rose-200 bg-rose-50">
            <AlertTitle>Token API rate limit reached</AlertTitle>
            <AlertDescription>
              The upstream balance API temporarily blocked requests (429). Some
              holdings or transactions may be missing data until the limit
              resets. Please try again in a few minutes.
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="flex w-full gap-2">
            <TabsTrigger className="flex-1" value="overview">
              Overview
            </TabsTrigger>
            <TabsTrigger className="flex-1" value="graphs">
              Graphs
            </TabsTrigger>
            {/* <TabsTrigger className="flex-1" value="capital-gains">
              Capital Gains
            </TabsTrigger> */}
            <TabsTrigger className="flex-1" value="all-transactions">
              All Transactions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <OverviewTab
              loadingOv={loadingOv}
              ov={ov}
              userCurrency={userPreferences.currency}
              mounted={mounted}
              quality={quality}
              concentration={concentration}
              concentrationExtras={concentrationExtras}
              topHoldingsLive={topHoldingsLive}
              errorOv={errorOv}
              showChange={showChange}
              setShowChange={setShowChange}
              movers={movers}
              minUsdFilter={minUsdFilter}
              setMinUsdFilter={setMinUsdFilter}
              hideStables={hideStables}
              setHideStables={setHideStables}
              filteredHoldings={filteredHoldings}
              riskBuckets={riskBuckets}
              walletBreakdown={walletDisplayItems}
              walletLabels={walletLabelLookup}
              isMultiWalletView={isMultiWalletView}
            />
          </TabsContent>

          <TabsContent value="graphs" className="space-y-6">
            <GraphsTab
              address={address}
              networks={networksParam}
              loadingHistorical={loadingHistorical}
              historicalChartData={historicalChartData}
              historicalData={historicalData}
              isHistoricalEstimated={isHistoricalEstimated}
              useFallbackEstimation={useFallbackEstimation}
              onFallbackPreferenceChange={handleFallbackPreferenceChange}
              loadingOv={loadingOv}
              ov={ov}
              chainBreakdown={chainBreakdown}
              pnlByChain={pnlByChain}
              allocationData={allocationData}
              stableVsRisk={stableVsRisk}
              movers={movers}
              netFlowData={netFlowData}
              chainHistory={chainHistory}
              walletBreakdown={walletDisplayItems}
              walletSummary={appliedWalletSummary}
            />
          </TabsContent>

          {/* <TabsContent value="capital-gains" className="space-y-6">
            <CapitalGainsTab
              loading={loadingCapitalGains}
              capitalGainsData={capitalGainsData}
              accountingMethod={accountingMethod}
              setAccountingMethod={setAccountingMethod}
              currency={userPreferences.currency}
            />
          </TabsContent> */}
          <TabsContent value="all-transactions" forceMount>
            <TransactionsWorkspaceProvider
              address={address}
              walletOptions={appliedWalletDisplay}
              walletLimit={MAX_MULTI_WALLETS}
              onPricingWarningChange={(flag) =>
                setPricingWarningFor("transactions", flag)
              }
              onTokenApiWarningChange={(flag) =>
                setTokenApiWarningFor("transactions", flag)
              }
            >
              <AllTransactionsTab
                totalAssetsUsd={ov?.kpis.totalValueUsd ?? null}
                stableHoldingsUsd={stableBucketUsd}
              />
            </TransactionsWorkspaceProvider>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;
