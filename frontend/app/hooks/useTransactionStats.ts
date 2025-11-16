import { useMemo } from "react";
import type { TxRow } from "@/lib/types/transactions";
import {
  CapitalGainsCalculator,
  type AccountingMethod,
  type CapitalGainEntry,
  type CostBasisEntry,
  type UnmatchedSale,
} from "@/utils/capitalGains";
import { shortAddr, classifyIncomeCategory, STABLE_SYMBOLS, DAY_MS } from "@/utils/transactionHelpers";

type GainEntryWithKey = CapitalGainEntry & { assetKey: string };
type BuyEventsEntry = { assetKey: string; label: string; timestamps: number[] };
type OpenLotDisplay = CostBasisEntry & { label: string };
type UnmatchedSaleDisplay = UnmatchedSale & { label: string };

export function useTransactionStats(loadedRowsAll: TxRow[]) {
  const gainsMethod: AccountingMethod = "FIFO";
  const capitalGainsSummary = useMemo(() => {
    if (!loadedRowsAll.length) {
      return {
        realized: [] as CapitalGainEntry[],
        realizedRaw: [] as GainEntryWithKey[],
        totalRealized: 0,
        shortTerm: 0,
        longTerm: 0,
        timeline: [] as Array<{ date: string; short: number; long: number }>,
        topRealized: [] as CapitalGainEntry[],
        transactionsCount: 0,
        acquisitions: 0,
        disposals: 0,
        openLots: [] as OpenLotDisplay[],
        unmatchedSales: [] as UnmatchedSaleDisplay[],
        buyEvents: [] as BuyEventsEntry[],
      };
    }
    const sorted = [...loadedRowsAll].sort(
      (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
    );
    const calculator = new CapitalGainsCalculator(gainsMethod);
    const realizedDisplay: CapitalGainEntry[] = [];
    const realizedRaw: GainEntryWithKey[] = [];
    const assetLabels = new Map<string, string>();
    const buyEvents = new Map<string, number[]>();
    let acquisitions = 0;
    let disposals = 0;

    for (const row of sorted) {
      const qtyRaw = row.qty ? Number(row.qty) : 0;
      const quantity = Number.isFinite(qtyRaw) ? Math.abs(qtyRaw) : 0;
      if (!quantity) continue;
      const assetKey =
        row.asset?.contract?.toLowerCase() ??
        row.asset?.symbol?.toUpperCase() ??
        null;
      if (!assetKey) continue;
      const assetLabel =
        row.asset?.symbol ??
        (row.asset?.contract ? shortAddr(row.asset.contract) : assetKey);
      assetLabels.set(assetKey, assetLabel);
      const price =
        row.priceUsdAtTs ??
        (row.usdAtTs != null && quantity ? row.usdAtTs / quantity : null);
      if (price == null || !Number.isFinite(price)) continue;

      if (row.direction === "in") {
        acquisitions += 1;
        const tsMs = new Date(row.ts).getTime();
        if (!Number.isNaN(tsMs)) {
          if (!buyEvents.has(assetKey)) buyEvents.set(assetKey, []);
          buyEvents.get(assetKey)!.push(tsMs);
        }
        calculator.addToCostBasis({
          id: `${row.hash}:${row.ts}`,
          asset: assetKey,
          quantity,
          costBasis: price * quantity,
          purchaseDate: row.ts,
          purchasePrice: price,
        });
      } else {
        disposals += 1;
        const gains = calculator.calculateGains(
          assetKey,
          quantity,
          price,
          row.ts,
          row.hash
        );
        if (gains.length) {
          gains.forEach((g) => {
            realizedRaw.push({ ...g, assetKey });
            realizedDisplay.push({
              ...g,
              asset: assetLabels.get(assetKey) ?? assetLabel,
            });
          });
        }
      }
    }

    const totalRealized = realizedDisplay.reduce(
      (sum, entry) => sum + entry.gain,
      0
    );
    const shortTerm = realizedDisplay
      .filter((entry) => !entry.isLongTerm)
      .reduce((sum, entry) => sum + entry.gain, 0);
    const longTerm = realizedDisplay
      .filter((entry) => entry.isLongTerm)
      .reduce((sum, entry) => sum + entry.gain, 0);

    const timelineMap = new Map<
      string,
      { date: string; short: number; long: number }
    >();
    for (const entry of realizedDisplay) {
      if (!entry.saleDate) continue;
      const dateKey = entry.saleDate.slice(0, 10);
      if (!timelineMap.has(dateKey)) {
        timelineMap.set(dateKey, { date: dateKey, short: 0, long: 0 });
      }
      const bucket = timelineMap.get(dateKey)!;
      if (entry.isLongTerm) bucket.long += entry.gain;
      else bucket.short += entry.gain;
    }
    const timeline = Array.from(timelineMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    const topRealized = [...realizedDisplay]
      .sort((a, b) => Math.abs(b.gain) - Math.abs(a.gain))
      .slice(0, 5);
    const openLots: OpenLotDisplay[] = calculator.getOpenLots().map((lot) => ({
      ...lot,
      label: assetLabels.get(lot.asset) ?? lot.asset,
    }));
    const unmatchedSales: UnmatchedSaleDisplay[] = calculator
      .getUnmatchedSales()
      .map((sale) => ({
        ...sale,
        label: assetLabels.get(sale.asset) ?? sale.asset,
      }));
    const buyEventsList: BuyEventsEntry[] = Array.from(buyEvents.entries()).map(
      ([assetKey, timestamps]) => ({
        assetKey,
        label: assetLabels.get(assetKey) ?? assetKey,
        timestamps: [...timestamps].sort(),
      })
    );

    return {
      realized: realizedDisplay,
      realizedRaw,
      totalRealized,
      shortTerm,
      longTerm,
      timeline,
      topRealized,
      transactionsCount: loadedRowsAll.length,
      acquisitions,
      disposals,
      openLots,
      unmatchedSales,
      buyEvents: buyEventsList,
    };
  }, [loadedRowsAll, gainsMethod]);

  const incomeBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    let total = 0;
    loadedRowsAll.forEach((row) => {
      if (row.type !== "income" || row.direction !== "in") return;
      const usd = row.usdAtTs ?? 0;
      if (!usd) return;
      const category = classifyIncomeCategory(row);
      map.set(category, (map.get(category) ?? 0) + usd);
      total += usd;
    });
    const entries = Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([label, value]) => ({ label, value }));
    const topSum = entries.reduce((sum, entry) => sum + entry.value, 0);
    if (total - topSum > 0) {
      entries.push({ label: "Other income", value: total - topSum });
    }
    return { total, entries };
  }, [loadedRowsAll]);

  const counterpartyBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    loadedRowsAll.forEach((row) => {
      if (row.direction !== "out") return;
      const usd = row.usdAtTs ?? 0;
      if (!usd) return;
      const label =
        row.counterparty?.label ??
        (row.counterparty?.address
          ? shortAddr(row.counterparty.address)
          : "Unknown");
      map.set(label, (map.get(label) ?? 0) + usd);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, value]) => ({ label, value }));
  }, [loadedRowsAll]);

  const gasVsProceeds = useMemo(() => {
    let proceeds = 0;
    let gas = 0;
    loadedRowsAll.forEach((row) => {
      if (row.direction === "out") {
        proceeds += row.usdAtTs ?? 0;
      }
      gas += row.fee?.usdAtTs ?? 0;
    });
    return {
      proceeds,
      gas,
      net: proceeds - gas,
      gasPct: proceeds > 0 ? (gas / proceeds) * 100 : null,
    };
  }, [loadedRowsAll]);

  const stableBufferStats = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    loadedRowsAll.forEach((row) => {
      const symbol = (row.asset?.symbol ?? "").toUpperCase();
      if (!symbol || !STABLE_SYMBOLS.has(symbol)) return;
      const usd = row.usdAtTs ?? 0;
      if (!usd) return;
      if (row.direction === "in") inflow += usd;
      else outflow += usd;
    });
    return {
      inflow,
      outflow,
      net: inflow - outflow,
      retention:
        inflow > 0 ? Math.max(0, inflow - outflow) / inflow * 100 : null,
    };
  }, [loadedRowsAll]);

  const costBasisBuckets = useMemo(() => {
    const now = Date.now();
    const buckets = [
      { id: "0-30", label: "0-30 days", min: 0, max: 30, usd: 0, lots: 0 },
      { id: "31-90", label: "31-90 days", min: 31, max: 90, usd: 0, lots: 0 },
      {
        id: "91-365",
        label: "91-365 days",
        min: 91,
        max: 365,
        usd: 0,
        lots: 0,
      },
      {
        id: "1-2y",
        label: "1-2 years",
        min: 366,
        max: 730,
        usd: 0,
        lots: 0,
      },
      { id: "2y+", label: "2+ years", min: 731, max: Infinity, usd: 0, lots: 0 },
    ];
    capitalGainsSummary.openLots.forEach((lot) => {
      const purchaseMs = Date.parse(lot.purchaseDate);
      if (Number.isNaN(purchaseMs)) return;
      const ageDays = Math.max(0, Math.floor((now - purchaseMs) / DAY_MS));
      const bucket = buckets.find(
        (b) => ageDays >= b.min && ageDays <= b.max
      );
      if (!bucket) return;
      bucket.usd += lot.costBasis;
      bucket.lots += 1;
    });
    return buckets;
  }, [capitalGainsSummary.openLots]);

  const washSaleSignals = useMemo(() => {
    if (!capitalGainsSummary.realizedRaw.length) return [];
    const buyMap = new Map(
      capitalGainsSummary.buyEvents.map((entry) => [entry.assetKey, entry])
    );
    const windowMs = 30 * DAY_MS;
    const signals: Array<{
      asset: string;
      saleDate: string;
      repurchaseDate: string;
      lossUsd: number;
    }> = [];
    for (const entry of capitalGainsSummary.realizedRaw) {
      if (entry.gain >= 0) continue;
      const buyEntry = buyMap.get(entry.assetKey);
      if (!buyEntry) continue;
      const saleMs = Date.parse(entry.saleDate);
      if (Number.isNaN(saleMs)) continue;
      let chosenTs: number | null = null;
      for (const ts of buyEntry.timestamps) {
        if (ts >= saleMs && ts - saleMs <= windowMs) {
          chosenTs = ts;
          break;
        }
      }
      if (chosenTs == null) {
        for (let i = buyEntry.timestamps.length - 1; i >= 0; i--) {
          const ts = buyEntry.timestamps[i];
          if (saleMs - ts <= windowMs && saleMs - ts >= 0) {
            chosenTs = ts;
            break;
          }
        }
      }
      if (chosenTs != null) {
        signals.push({
          asset: buyEntry.label,
          saleDate: entry.saleDate,
          repurchaseDate: new Date(chosenTs).toISOString(),
          lossUsd: entry.gain,
        });
      }
      if (signals.length >= 4) break;
    }
    return signals;
  }, [capitalGainsSummary.realizedRaw, capitalGainsSummary.buyEvents]);

  return {
    capitalGainsSummary,
    incomeBreakdown,
    counterpartyBreakdown,
    gasVsProceeds,
    stableBufferStats,
    costBasisBuckets,
    washSaleSignals,
  };
}

