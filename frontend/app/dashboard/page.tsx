"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWallet } from "@/contexts/WalletContext";
import Navbar from "@/components/Navbar";
import IncomeTab from "@/components/dashboard/IncomeTab";
import ExpensesTab from "@/components/dashboard/ExpensesTab";
import CapitalGainsTab from "@/components/dashboard/CapitalGainsTab";
import AllTransactionsTab, {
  AllTransactionsTabPersistedState,
} from "@/components/dashboard/AllTransactionsTab";
import OverviewTab from "@/components/dashboard/OverviewTab";
import GraphsTab from "@/components/dashboard/GraphsTab";
import {
  CapitalGainsCalculator,
  type CapitalGainEntry,
  type AccountingMethod,
} from "@/utils/capitalGains";
import { fetchTransactions } from "@/lib/api/transactions";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo, useRef, useReducer } from "react";
import { useWallets } from "@/hooks/use-wallets";
import { OverviewResponse } from "@/lib/types/portfolio";
import {
  CHAIN_LABEL,
  computeHHI,
  isStable,
  classifyRiskBucket,
  type RiskBucketId,
} from "@/lib/portfolioUtils";
import { fetchHistoricalData, type HistoricalPoint } from "@/lib/api/analytics";
import type { TxRow } from "@/lib/types/transactions";
import { Crown } from "lucide-react";

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
  const [selectedWallet, setSelectedWallet] = useState<string>("");
  const [minUsdFilter, setMinUsdFilter] = useState(5);
  const [hideStables, setHideStables] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [historicalData, setHistoricalData] = useState<HistoricalPoint[]>([]);
  const [loadingHistorical, setLoadingHistorical] = useState(false);
  const [isHistoricalEstimated, setIsHistoricalEstimated] = useState(false);
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
  const transactionsPersistRef = useRef<
    Map<string, AllTransactionsTabPersistedState>
  >(new Map());
  const persistSignatureRef = useRef<Map<string, string>>(new Map());
  const [, forcePersistRender] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setUrlAddress(sp.get("address") || "");
    setUrlReady(true);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  const address = useMemo(
    () =>
      urlAddress
        ? urlAddress
        : selectedWallet || (isConnected && userWallet ? userWallet : ""),
    [urlAddress, selectedWallet, isConnected, userWallet]
  );

  const persistedTransactionsState = address
    ? transactionsPersistRef.current.get(address) ?? null
    : null;

  const allWallets = useMemo(() => {
    return userWallets.map((w) => ({
      ...w,
      isMain: w.address.toLowerCase() === userWallet?.toLowerCase(),
    }));
  }, [userWallet, userWallets]);

  const maxWalletWidth = useMemo(() => {
    if (allWallets.length === 0) return 280;
    const longestName = allWallets.reduce(
      (longest, wallet) =>
        wallet.name.length > longest.length ? wallet.name : longest,
      allWallets[0].name
    );
    const checkmarkSpace = 32;
    const iconSpace = 16 + 8;
    const addressChars = 28;
    const padding = 40 + 16;
    const arrowSpace = 32;
    const estimatedWidth =
      checkmarkSpace +
      iconSpace +
      longestName.length * 8 +
      addressChars * 6 +
      padding +
      arrowSpace;
    return Math.max(280, estimatedWidth);
  }, [allWallets]);

  useEffect(() => {
    if (allWallets.length > 0 && !selectedWallet && !urlAddress) {
      setSelectedWallet(allWallets[0].address);
    }
  }, [allWallets, selectedWallet, urlAddress]);

  useEffect(() => {
    if (!isConnected) {
      setSelectedWallet("");
    }
  }, [isConnected]);

  useEffect(() => {
    if (!urlReady) return;
    if (!address && !isConnected) {
      router.push("/");
    }
  }, [urlReady, address, isConnected, router]);

  const [networks, setNetworks] = useState<string>(
    "mainnet,polygon,base,optimism,arbitrum-one,bsc,avalanche,unichain"
  );

  useEffect(() => {
    if (!address) return;
    setLoadingOv(true);
    setErrorOv(null);

    const url = `/api/holdings/${encodeURIComponent(
      address
    )}?networks=${encodeURIComponent(
      networks
    )}&withDelta24h=true&minUsd=0&includeZero=true&spamFilter=hard&_ts=${Date.now()}`;

    fetch(url, { cache: "no-store" })
      .then(async (r) => (r.ok ? r.json() : Promise.reject(await r.json())))
      .then((data: OverviewResponse) => {
        setOv(data);
      })
      .catch((e) => setErrorOv(e?.error ?? "Failed to load overview"))
      .finally(() => setLoadingOv(false));
  }, [address, networks, userWallet, isConnected]);

  useEffect(() => {
    if (!address || !overviewReady) {
      console.log(
        "[Dashboard] Historical data fetch postponed until overview is ready"
      );
      return;
    }
    let cancelled = false;
    console.log(
      `[Dashboard] Fetching historical data for ${address}, networks: ${networks}`
    );
    setLoadingHistorical(true);
    fetchHistoricalData(address, {
      networks,
      days: 180,
    })
      .then((response) => {
        if (cancelled) return;
        console.log(
          `[Dashboard] Historical data received: ${response.data.length} points`
        );
        // Clean data by removing internal _isEstimated field
        const cleanData = response.data.map((point: any) => {
          const { _isEstimated, ...rest } = point;
          return rest;
        });
        setHistoricalData(cleanData);
        setIsHistoricalEstimated(response.isEstimated || false);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error("[Dashboard] Failed to load historical data:", e);
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingHistorical(false);
      });

    return () => {
      cancelled = true;
    };
  }, [address, networks, overviewReady]);

  useEffect(() => {
    if (!address || !overviewReady) {
      return;
    }
    let cancelled = false;
    async function loadCapitalGains() {
      setLoadingCapitalGains(true);
      try {
        const calculator = new CapitalGainsCalculator(accountingMethod);
        const rows: TxRow[] = [];
        const MAX_PAGES = 3;
        for (let page = 1; page <= MAX_PAGES; page++) {
          const resp = await fetchTransactions(address, {
            networks,
            page,
            limit: 40,
            minUsd: 0,
            spamFilter: "hard",
          });
          rows.push(...resp.rows);
          if (!resp.hasNext) break;
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
        }
      } finally {
        if (!cancelled) setLoadingCapitalGains(false);
      }
    }
    loadCapitalGains();
    return () => {
      cancelled = true;
    };
  }, [address, networks, accountingMethod, overviewReady, ov]);

  const historicalChartData = useMemo(() => {
    if (historicalData.length === 0) {
      return [];
    }
    return historicalData
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((point) => ({
        date: new Date(point.date).toLocaleDateString("fr-FR", {
          month: "short",
          day: "numeric",
        }),
        value: point.totalValueUsd,
        timestamp: point.timestamp,
      }));
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
    const items = ov.allocation
      .filter((a) => (a.valueUsd ?? 0) > 0)
      .sort((a, b) => b.valueUsd - a.valueUsd);

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

  const topHoldingsLive = useMemo(() => {
    const rows = (ov?.holdings ?? []).slice();
    rows.sort((a, b) => {
      const va = a.valueUsd ?? 0;
      const vb = b.valueUsd ?? 0;
      if (vb !== va) return vb - va;
      const qa = parseFloat(a.qty || "0");
      const qb = parseFloat(b.qty || "0");
      return qb - qa;
    });
    return rows.slice(0, 5);
  }, [ov]);

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
    return Array.from(map.values()).sort(
      (a, b) => Math.abs(b.pnl) - Math.abs(a.pnl)
    );
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
            {isConnected && allWallets.length > 1 && (
              <div className="relative inline-block">
                <Select
                  value={selectedWallet}
                  onValueChange={setSelectedWallet}
                >
                  <SelectTrigger
                    className="h-12 pl-10 pr-4 border-2 border-slate-200 rounded-xl bg-white shadow-md hover:border-blue-400 focus:ring-2 focus:ring-blue-500 transition-all duration-200 text-slate-800 font-medium"
                    style={{ width: `${maxWalletWidth}px` }}
                  >
                    <div className="flex items-center gap-2">
                      {(() => {
                        const selected = allWallets.find(
                          (w) => w.address === selectedWallet
                        );
                        if (!selected) return null;
                        return (
                          <>
                            {selected.isMain && (
                              <Crown className="w-4 h-4 text-amber-500 flex-shrink-0" />
                            )}
                            <span className="font-medium">{selected.name}</span>
                            <span className="text-slate-500 font-mono text-sm">
                              ({selected.address.slice(0, 10)}...
                              {selected.address.slice(-8)})
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-2 shadow-lg w-[var(--radix-select-trigger-width)]">
                    {allWallets.map((wallet) => (
                      <SelectItem
                        key={wallet.address}
                        value={wallet.address}
                        className="py-3 pl-10 pr-4 text-slate-800 font-medium cursor-pointer hover:bg-blue-50 focus:bg-blue-50"
                      >
                        <div className="flex items-center gap-2">
                          {wallet.isMain && (
                            <Crown className="w-4 h-4 text-amber-500 flex-shrink-0" />
                          )}
                          <span className="font-medium">{wallet.name}</span>
                          <span className="text-slate-500 font-mono text-sm">
                            ({wallet.address.slice(0, 10)}...
                            {wallet.address.slice(-8)})
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="flex w-full gap-2">
            <TabsTrigger className="flex-1" value="overview">
              Overview
            </TabsTrigger>
            <TabsTrigger className="flex-1" value="graphs">
              Graphs
            </TabsTrigger>
            <TabsTrigger className="flex-1" value="capital-gains">
              Capital Gains
            </TabsTrigger>
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
            />
          </TabsContent>

          <TabsContent value="graphs" className="space-y-6">
            <GraphsTab
              address={address}
              networks={networks}
              loadingHistorical={loadingHistorical}
              historicalChartData={historicalChartData}
              historicalData={historicalData}
              isHistoricalEstimated={isHistoricalEstimated}
              loadingOv={loadingOv}
              ov={ov}
              chainBreakdown={chainBreakdown}
              pnlByChain={pnlByChain}
              allocationData={allocationData}
              stableVsRisk={stableVsRisk}
              movers={movers}
              netFlowData={netFlowData}
              chainHistory={chainHistory}
            />
          </TabsContent>

          <TabsContent value="capital-gains" className="space-y-6">
            <CapitalGainsTab
              loading={loadingCapitalGains}
              capitalGainsData={capitalGainsData}
              accountingMethod={accountingMethod}
              setAccountingMethod={setAccountingMethod}
              currency={userPreferences.currency}
            />
          </TabsContent>

          <TabsContent value="all-transactions" forceMount>
            <AllTransactionsTab
              isReady={overviewReady}
              key={address || "__no_addr__"}
              address={address}
              persistedState={persistedTransactionsState}
              onPersist={(addr, state) => {
                if (!addr) return;
                const signature = JSON.stringify({
                  page: state.page,
                  hasNext: state.hasNext,
                  refreshKey: state.refreshKey,
                  error: state.error,
                  selectedTypes: state.selectedTypes,
                  visibleColumns: Object.entries(state.visibleColumns).sort(),
                  cacheFilteredKeys: (state.filteredCacheEntries ?? []).map(
                    ([key, value]) => [key, value.hasNext, value.rows.length]
                  ),
                  cacheRawKeys: (state.rawCacheEntries ?? []).map(
                    ([key, value]) => [key, value.hasNext, value.rows.length]
                  ),
                });
                if (persistSignatureRef.current.get(addr) === signature) {
                  return;
                }
                persistSignatureRef.current.set(addr, signature);
                transactionsPersistRef.current.set(addr, state);
                forcePersistRender();
              }}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;
