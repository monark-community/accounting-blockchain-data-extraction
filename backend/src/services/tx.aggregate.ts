// backend/src/services/tx.aggregate.ts
import type { NormalizedLegRow, TxClass } from "../types/transactions";

export type Summary = {
  kpi: {
    totalUsdIn: number;
    totalUsdOut: number;
    netUsd: number;
    count: number;
  };
  byClass: Record<TxClass, { count: number; usdIn: number; usdOut: number }>;
  byNetwork: Record<string, { count: number; usdIn: number; usdOut: number }>;
  topCounterparties: Array<{ address: string; usd: number; count: number }>;
  gasUsdTotal: number;
};

export function buildSummary(
  legs: NormalizedLegRow[],
  gasUsdByTx: Record<string, number>
): Summary {
  const byClass = {} as Summary["byClass"];
  const byNetwork = {} as Summary["byNetwork"];
  const cpMap = new Map<string, { usd: number; count: number }>();

  let totalIn = 0,
    totalOut = 0;

  for (const l of legs) {
    const usd = l.amountUsdAtTx ?? 0;
    if (l.direction === "in") totalIn += usd;
    else totalOut += usd;

    const c = (l.class ?? "expense") as TxClass;
    if (!byClass[c]) byClass[c] = { count: 0, usdIn: 0, usdOut: 0 };
    byClass[c].count += 1;
    if (l.direction === "in") byClass[c].usdIn += usd;
    else byClass[c].usdOut += usd;

    const netKey = l.network;
    if (!byNetwork[netKey])
      byNetwork[netKey] = { count: 0, usdIn: 0, usdOut: 0 };
    byNetwork[netKey].count += 1;
    if (l.direction === "in") byNetwork[netKey].usdIn += usd;
    else byNetwork[netKey].usdOut += usd;

    // counterparties: pick "the other side" of the leg
    const cp = l.direction === "in" ? l.from : l.to;
    if (cp) {
      const prev = cpMap.get(cp) ?? { usd: 0, count: 0 };
      prev.usd += usd;
      prev.count += 1;
      cpMap.set(cp, prev);
    }
  }

  // top counterparties by USD
  const topCounterparties = Array.from(cpMap.entries())
    .map(([address, v]) => ({ address, ...v }))
    .sort((a, b) => b.usd - a.usd)
    .slice(0, 20);

  const gasUsdTotal = Object.values(gasUsdByTx ?? {}).reduce(
    (s, v) => s + (v ?? 0),
    0
  );

  return {
    kpi: {
      totalUsdIn: totalIn,
      totalUsdOut: totalOut,
      netUsd: totalIn - totalOut - gasUsdTotal, // net after gas
      count: legs.length,
    },
    byClass,
    byNetwork,
    topCounterparties,
    gasUsdTotal,
  };
}
