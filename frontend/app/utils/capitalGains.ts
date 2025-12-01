
export interface CostBasisEntry {
  id: string;
  asset: string;
  quantity: number;
  costBasis: number;
  purchaseDate: string;
  purchasePrice: number;
}

export interface CapitalGainEntry {
  id: string;
  asset: string;
  quantity: number;
  salePrice: number;
  costBasis: number;
  gain: number;
  gainPercent: number;
  holdingPeriod: number;
  isLongTerm: boolean;
  saleDate: string;
  purchaseDate: string;
  transactionId: string;
}

export type AccountingMethod = 'FIFO' | 'LIFO' | 'SPECIFIC_ID';

export interface UnmatchedSale {
  asset: string;
  quantity: number;
  salePrice: number;
  saleDate: string;
  transactionId: string;
}

export class CapitalGainsCalculator {
  private costBasis: Map<string, CostBasisEntry[]> = new Map();
  private accountingMethod: AccountingMethod = 'FIFO';
  private unmatchedSales: UnmatchedSale[] = [];

  constructor(accountingMethod: AccountingMethod = 'FIFO') {
    this.accountingMethod = accountingMethod;
  }

  // Add a purchase/acquisition to cost basis
  addToCostBasis(entry: CostBasisEntry) {
    const assetEntries = this.costBasis.get(entry.asset) || [];
    assetEntries.push(entry);
    this.costBasis.set(entry.asset, assetEntries);
  }

  // Calculate capital gains for a sale/disposal
  calculateGains(
    asset: string,
    quantity: number,
    salePrice: number,
    saleDate: string,
    transactionId: string
  ): CapitalGainEntry[] {
    const assetEntries = this.costBasis.get(asset) || [];
    const gains: CapitalGainEntry[] = [];
    let remainingQuantity = quantity;

    // Sort entries based on accounting method
    const sortedEntries = this.sortEntriesByMethod(assetEntries);

    for (const entry of sortedEntries) {
      if (remainingQuantity <= 0) break;

      const quantityToSell = Math.min(remainingQuantity, entry.quantity);
      const proportionalCostBasis = (entry.costBasis / entry.quantity) * quantityToSell;
      const saleValue = salePrice * quantityToSell;
      const gain = saleValue - proportionalCostBasis;
      const gainPercent = ((gain / proportionalCostBasis) * 100);
      
      const holdingPeriod = this.calculateHoldingPeriod(entry.purchaseDate, saleDate);
      const isLongTerm = holdingPeriod >= 365;

      gains.push({
        id: `${transactionId}_${entry.id}_${Math.floor(Math.random() * 1000000)}`,
        asset,
        quantity: quantityToSell,
        salePrice,
        costBasis: proportionalCostBasis,
        gain,
        gainPercent,
        holdingPeriod,
        isLongTerm,
        saleDate,
        purchaseDate: entry.purchaseDate,
        transactionId
      });

      // Update the cost basis entry
      entry.quantity -= quantityToSell;
      entry.costBasis -= proportionalCostBasis;

      remainingQuantity -= quantityToSell;
    }

    if (remainingQuantity > 0) {
      this.unmatchedSales.push({
        asset,
        quantity: remainingQuantity,
        salePrice,
        saleDate,
        transactionId,
      });
    }

    // Remove entries with zero quantity
    this.costBasis.set(asset, assetEntries.filter(entry => entry.quantity > 0));

    return gains;
  }

  private sortEntriesByMethod(entries: CostBasisEntry[]): CostBasisEntry[] {
    switch (this.accountingMethod) {
      case 'FIFO':
        return entries.sort((a, b) => new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime());
      case 'LIFO':
        return entries.sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());
      case 'SPECIFIC_ID':
      default:
        return entries;
    }
  }

  private calculateHoldingPeriod(purchaseDate: string, saleDate: string): number {
    const purchase = new Date(purchaseDate);
    const sale = new Date(saleDate);
    return Math.floor((sale.getTime() - purchase.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Get unrealized gains for current holdings
  getUnrealizedGains(currentPrices: Map<string, number>): CapitalGainEntry[] {
    const unrealizedGains: CapitalGainEntry[] = [];

    for (const [asset, entries] of this.costBasis) {
      const currentPrice = currentPrices.get(asset) || 0;
      
      for (const entry of entries) {
        if (entry.quantity > 0) {
          const currentValue = currentPrice * entry.quantity;
          const gain = currentValue - entry.costBasis;
          const gainPercent = ((gain / entry.costBasis) * 100);
          const holdingPeriod = this.calculateHoldingPeriod(entry.purchaseDate, new Date().toISOString().split('T')[0]);

          unrealizedGains.push({
            id: `unrealized_${entry.id}`,
            asset,
            quantity: entry.quantity,
            salePrice: currentPrice,
            costBasis: entry.costBasis,
            gain,
            gainPercent,
            holdingPeriod,
            isLongTerm: holdingPeriod >= 365,
            saleDate: new Date().toISOString().split('T')[0],
            purchaseDate: entry.purchaseDate,
            transactionId: entry.id
          });
        }
      }
    }

    return unrealizedGains;
  }

  getOpenLots(): CostBasisEntry[] {
    const lots: CostBasisEntry[] = [];
    for (const entries of this.costBasis.values()) {
      entries.forEach((entry) =>
        lots.push({ ...entry })
      );
    }
    return lots;
  }

  getUnmatchedSales(): UnmatchedSale[] {
    return this.unmatchedSales.map((sale) => ({ ...sale }));
  }
}

// Parse asset from transaction amount string
export function parseAssetFromAmount(amount: string): { asset: string; quantity: number } {
  const parts = amount.replace(/[+-]/g, '').trim().split(' ');
  if (parts.length >= 2) {
    return {
      quantity: parseFloat(parts[0]),
      asset: parts[1]
    };
  }
  return { quantity: 0, asset: 'UNKNOWN' };
}

// Extract multiple assets from swap transactions
export function parseSwapTransaction(amount: string): { sold: { asset: string; quantity: number }; bought: { asset: string; quantity: number } } {
  const parts = amount.split(' / ');
  const soldPart = parts[0]?.trim() || '';
  const boughtPart = parts[1]?.trim() || '';

  return {
    sold: parseAssetFromAmount(soldPart),
    bought: parseAssetFromAmount(boughtPart)
  };
}
