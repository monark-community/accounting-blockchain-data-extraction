"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { OverviewResponse, PricedHolding } from "@/lib/types/portfolio";
import { fmtUSD, fmtPct } from "@/lib/portfolioUtils";
import { useMemo, useEffect, useState } from "react";
import { fetchTransactions } from "@/lib/api/transactions";
import type { TxRow } from "@/lib/types/transactions";

interface RatiosTableProps {
  loadingOv: boolean;
  ov: OverviewResponse | null;
  address?: string;
  networks?: string;
}

interface RatioRow {
  label: string;
  value2025: string | number;
  variation?: string;
  value2026: string | number;
  variation2?: string;
  value2027: string | number;
  variation3?: string;
  value2028: string | number;
  isSectionHeader?: boolean;
  isSubRow?: boolean;
  isHighlighted?: boolean;
  isCombinedLeverageSubRow?: boolean;
}

const RatiosTable = ({ loadingOv, ov, address, networks }: RatiosTableProps) => {
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const currentYear = new Date().getFullYear();
  const [historicalTransactions, setHistoricalTransactions] = useState<Map<number, TxRow[]>>(new Map());

  // Fetch transactions for current year and previous years (2024, 2023, 2022) if available
  useEffect(() => {
    if (!address || !ov) return;
    
    const loadTransactions = async () => {
      setLoadingTransactions(true);
      try {
        const yearsToLoad = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];
        const allTransactionsByYear = new Map<number, TxRow[]>();
        
        // Load transactions for each year
        for (const year of yearsToLoad) {
          const yearStart = new Date(`${year}-01-01T00:00:00Z`).toISOString();
          const yearEnd = new Date(`${year}-12-31T23:59:59Z`).toISOString();
          
          let allRows: TxRow[] = [];
          let page = 1;
          let hasMore = true;
          const limit = 100;
          
          // Load up to 5 pages per year to avoid too many requests
          while (hasMore && page <= 5) {
            try {
              const result = await fetchTransactions(address, {
                networks,
                from: yearStart,
                to: yearEnd,
                page,
                limit,
                minUsd: 0,
                spamFilter: "hard",
              });
              
              allRows = [...allRows, ...result.rows];
              hasMore = result.hasNext && result.rows.length > 0;
              page++;
              
              // If no transactions found, break early
              if (result.rows.length === 0) break;
            } catch (err) {
              console.warn(`Failed to load transactions for year ${year}, page ${page}:`, err);
              break;
            }
          }
          
          if (allRows.length > 0) {
            allTransactionsByYear.set(year, allRows);
          }
        }
        
        // Set current year transactions
        setTransactions(allTransactionsByYear.get(currentYear) || []);
        setHistoricalTransactions(allTransactionsByYear);
      } catch (error) {
        console.error("Failed to load transactions for ratios:", error);
        setTransactions([]);
        setHistoricalTransactions(new Map());
      } finally {
        setLoadingTransactions(false);
      }
    };
    
    loadTransactions();
  }, [address, networks, currentYear, ov]);

  const ratios = useMemo(() => {
    if (!ov) return [];

    // ============================================
    // SOURCES DE DONNÉES
    // ============================================
    // 1. ov.kpis.totalValueUsd : Valeur totale du portfolio (depuis API /api/holdings)
    // 2. ov.holdings : Liste des tokens détenus avec leurs valeurs USD
    // 3. transactions : Transactions de l'année en cours (depuis API /api/transactions)
    //    - tx.type : "income", "expense", "swap", "gas"
    //    - tx.direction : "in" (entrant) ou "out" (sortant)
    //    - tx.usdAtTs : Valeur USD au moment de la transaction
    //    - tx.fee.usdAtTs : Frais de gas en USD

    const totalValueUsd = ov.kpis.totalValueUsd || 0;
    const delta24hUsd = ov.kpis.delta24hUsd || 0;

    // Helper function to calculate metrics for a specific year
    const calculateYearMetrics = (year: number) => {
      const yearTransactions = historicalTransactions.get(year) || 
        (year === currentYear ? transactions : []);
      
      // Calculate income
      const income = yearTransactions
        .filter(tx => {
          const txDate = new Date(tx.ts);
          return txDate.getFullYear() === year && 
                 tx.direction === "in" && 
                 (tx.type === "income" || (tx.type !== "swap" && tx.type !== "gas"));
        })
        .reduce((sum, tx) => sum + Math.abs(tx.usdAtTs || 0), 0);

      // Calculate expenses
      const expenses = yearTransactions
        .filter(tx => {
          const txDate = new Date(tx.ts);
          return txDate.getFullYear() === year && 
                 tx.direction === "out" && 
                 (tx.type === "expense" || (tx.type !== "swap" && tx.type !== "gas"));
        })
        .reduce((sum, tx) => sum + Math.abs(tx.usdAtTs || 0), 0);

      // Calculate gas fees
      const gasFees = yearTransactions
        .filter(tx => {
          const txDate = new Date(tx.ts);
          return txDate.getFullYear() === year && tx.fee && tx.fee.usdAtTs;
        })
        .reduce((sum, tx) => sum + Math.abs(tx.fee?.usdAtTs || 0), 0);

      // Calculate sales
      const sales = yearTransactions
        .filter(tx => {
          const txDate = new Date(tx.ts);
          return txDate.getFullYear() === year && tx.type === "swap" && tx.direction === "out";
        })
        .reduce((sum, tx) => sum + Math.abs(tx.usdAtTs || 0), 0);

      // Calculate cost of goods sold
      const cogs = yearTransactions
        .filter(tx => {
          const txDate = new Date(tx.ts);
          return txDate.getFullYear() === year && tx.type === "swap" && tx.direction === "in";
        })
        .reduce((sum, tx) => sum + Math.abs(tx.usdAtTs || 0), 0);

      const totalSales = sales > 0 ? sales : (income > 0 ? income : 0);
      const tradingProfit = totalSales - cogs;
      const netIncome = income + tradingProfit - expenses - gasFees;
      const grossProfit = totalSales > 0 ? (totalSales - cogs) : (income - expenses);
      const operatingIncome = grossProfit - expenses;
      
      const totalRevenue = totalSales + (income > 0 && totalSales === 0 ? income : 0);
      const revenue = totalRevenue > 0 ? totalRevenue : (income > 0 ? income : 1);

      return {
        income,
        expenses,
        gasFees,
        sales: totalSales,
        cogs,
        netIncome,
        grossProfit,
        operatingIncome,
        revenue,
        dailyExpenses: (expenses + gasFees) / 365,
        fixedCosts: gasFees + (expenses * 0.3),
        variableMargin: revenue > 0 ? grossProfit / revenue : 0,
      };
    };

    // Calculate metrics for each year
    const metrics2025 = calculateYearMetrics(2025);
    const metrics2024 = calculateYearMetrics(2024);
    const metrics2023 = calculateYearMetrics(2023);
    const metrics2022 = calculateYearMetrics(2022);

    // Use current year metrics as primary
    const currentYearTransactions = transactions.filter(tx => {
      const txDate = new Date(tx.ts);
      return txDate.getFullYear() === currentYear;
    });
    
    const totalIncome = metrics2025.income;
    const totalExpenses = metrics2025.expenses;
    const totalGasFees = metrics2025.gasFees;
    const totalSales = metrics2025.sales;
    const costOfGoodsSold = metrics2025.cogs;
    const netIncome = metrics2025.netIncome;
    const grossProfit = metrics2025.grossProfit;
    const operatingIncome = metrics2025.operatingIncome;
    const revenueForMargin = metrics2025.revenue;
    const dailyExpenses = metrics2025.dailyExpenses;
    const fixedCosts = metrics2025.fixedCosts;
    const variableMargin = metrics2025.variableMargin;

    // ============================================
    // CALCUL DES REVENUS ET DÉPENSES
    // ============================================
    

    // ============================================
    // CALCUL DES ACTIFS ET PASSIFS
    // Source: ov.holdings (données du portfolio)
    // ============================================
    
    // ACTIF TOTAL (totalAssets)
    // Source: ov.kpis.totalValueUsd (valeur totale du portfolio en USD)
    const totalAssets = totalValueUsd;
    
    // PASSIFS (totalLiabilities)
    // En crypto wallet standard: 0 (pas de dettes/emprunts trackés)
    // Note: Pourrait être calculé si on track les positions DeFi (emprunts)
    const totalLiabilities = 0;
    
    // ÉQUITÉ / AVOIR DES ACTIONNAIRES (equity)
    // Formule: Actif total - Passif total
    const equity = totalAssets - totalLiabilities;
    
    // INTÉRÊTS (interestExpense)
    // En DeFi: pourrait être les coûts d'emprunt, mais pas tracké actuellement
    const interestExpense = 0;
    
    // COMPTES CLIENTS (accountsReceivable)
    // En crypto: ne s'applique pas vraiment (pas de créances)
    const accountsReceivable = 0;
    
    // ACTIFS COURANTS (currentAssets)
    // Source: ov.holdings filtrés pour tokens liquides
    // Définition: Stablecoins + tokens majeurs (ETH, BTC, WETH, WBTC)
    const currentAssets = ov.holdings
      .filter((h) => {
        const symbol = h.symbol?.toUpperCase() || "";
        return symbol.includes("USD") || symbol.includes("USDT") || symbol.includes("USDC") || 
               symbol.includes("DAI") || symbol.includes("BUSD") || 
               symbol === "ETH" || symbol === "BTC" || symbol === "WETH" || symbol === "WBTC";
      })
      .reduce((sum, h) => sum + (h.valueUsd || 0), 0);
    
    // IMMOBILISATIONS (fixedAssets)
    // Formule: Actif total - Actifs courants
    // Définition: Tokens moins liquides (tous les autres tokens)
    const fixedAssets = totalAssets - currentAssets;
    
    // PASSIFS COURANTS (currentLiabilities)
    // En crypto wallet: 0 (sauf si on track les positions DeFi)
    const currentLiabilities = 0;
    
    // ENCAISSE / CASH (cash)
    // Source: ov.holdings filtrés pour stablecoins uniquement
    // Définition: Stablecoins (USDT, USDC, DAI, BUSD, etc.)
    const cash = ov.holdings
      .filter((h) => {
        const symbol = h.symbol?.toUpperCase() || "";
        return symbol.includes("USD") || symbol.includes("USDT") || symbol.includes("USDC") || 
               symbol.includes("DAI") || symbol.includes("BUSD");
      })
      .reduce((sum, h) => sum + (h.valueUsd || 0), 0);
    
    // COMPTES CLIENTS (accountsReceivableValue)
    // En crypto: 0 (ne s'applique pas)
    const accountsReceivableValue = 0;
    
    // PLACEMENTS À COURT TERME (shortTermInvestments)
    // Source: ov.holdings filtrés pour tokens majeurs non-stablecoins
    // Définition: ETH, BTC, WETH, WBTC (tokens liquides mais pas des stablecoins)
    const shortTermInvestments = ov.holdings
      .filter((h) => {
        const symbol = h.symbol?.toUpperCase() || "";
        const isStable = symbol.includes("USD") || symbol.includes("USDT") || symbol.includes("USDC") || 
                         symbol.includes("DAI") || symbol.includes("BUSD");
        const isMajor = symbol === "ETH" || symbol === "BTC" || symbol === "WETH" || symbol === "WBTC";
        return !isStable && isMajor;
      })
      .reduce((sum, h) => sum + (h.valueUsd || 0), 0);
    
    // ============================================
    // CALCUL DES MÉTRIQUES POUR LES RATIOS
    // ============================================
    
    
    // DETTE TOTALE (totalDebt)
    // En crypto wallet: 0 (pas d'emprunts trackés)
    // Utilisé pour: Levier financier
    const totalDebt = 0;
    
    const daysInYear = 365;

    const rows: RatioRow[] = [];

    // Section 1: Analyse de rentabilité (Profitability Analysis)
    rows.push({
      label: "Analyse de rentabilité",
      value2025: "",
      value2026: "",
      value2027: "",
      value2028: "",
      isSectionHeader: true,
    });

    // ============================================
    // SECTION 1: ANALYSE DE RENTABILITÉ
    // ============================================
    
    // ROE (Rendement de l'équité)
    // Formule: (Bénéfice net / Avoir des actionnaires) × 100
    // Source: netIncome (calculé ci-dessus), equity (totalAssets - totalLiabilities)
    const roe2025 = equity > 0 ? (metrics2025.netIncome / equity) * 100 : 0;
    const roe2024 = equity > 0 ? (metrics2024.netIncome / equity) * 100 : 0;
    const roe2023 = equity > 0 ? (metrics2023.netIncome / equity) * 100 : 0;
    const roe2022 = equity > 0 ? (metrics2022.netIncome / equity) * 100 : 0;
    rows.push({ 
      label: "Rendement de l'équité (ROE)", 
      value2025: roe2025.toFixed(2), 
      value2026: metrics2024.netIncome !== 0 ? roe2024.toFixed(2) : "", 
      value2027: metrics2023.netIncome !== 0 ? roe2023.toFixed(2) : "", 
      value2028: metrics2022.netIncome !== 0 ? roe2022.toFixed(2) : "" 
    });
    rows.push({ 
      label: "Bénéfice net", 
      value2025: netIncome, 
      value2026: metrics2024.netIncome !== 0 ? metrics2024.netIncome : "", 
      value2027: metrics2023.netIncome !== 0 ? metrics2023.netIncome : "", 
      value2028: metrics2022.netIncome !== 0 ? metrics2022.netIncome : "", 
      isSubRow: true 
    });
    rows.push({ 
      label: "Avoir des actionnaires", 
      value2025: equity, 
      value2026: equity, 
      value2027: equity, 
      value2028: equity, 
      isSubRow: true 
    });

    // MARGE NETTE
    // Formule: (Bénéfice net / Ventes totales) × 100
    // Source: netIncome, revenueForMargin
    const netMargin2025 = revenueForMargin > 0 ? (netIncome / revenueForMargin) * 100 : 0;
    const netMargin2024 = metrics2024.revenue > 0 ? (metrics2024.netIncome / metrics2024.revenue) * 100 : 0;
    const netMargin2023 = metrics2023.revenue > 0 ? (metrics2023.netIncome / metrics2023.revenue) * 100 : 0;
    const netMargin2022 = metrics2022.revenue > 0 ? (metrics2022.netIncome / metrics2022.revenue) * 100 : 0;
    rows.push({ 
      label: "Marge nette", 
      value2025: netMargin2025.toFixed(2), 
      value2026: metrics2024.revenue > 0 ? netMargin2024.toFixed(2) : "", 
      value2027: metrics2023.revenue > 0 ? netMargin2023.toFixed(2) : "", 
      value2028: metrics2022.revenue > 0 ? netMargin2022.toFixed(2) : "" 
    });
    rows.push({ 
      label: "Bénéfice net", 
      value2025: netIncome, 
      value2026: metrics2024.netIncome !== 0 ? metrics2024.netIncome : "", 
      value2027: metrics2023.netIncome !== 0 ? metrics2023.netIncome : "", 
      value2028: metrics2022.netIncome !== 0 ? metrics2022.netIncome : "", 
      isSubRow: true 
    });
    rows.push({ 
      label: "Ventes totales", 
      value2025: revenueForMargin, 
      value2026: metrics2024.revenue > 0 ? metrics2024.revenue : "", 
      value2027: metrics2023.revenue > 0 ? metrics2023.revenue : "", 
      value2028: metrics2022.revenue > 0 ? metrics2022.revenue : "", 
      isSubRow: true 
    });

    // ROTATION DE L'ACTIF
    // Formule: Ventes totales / Actif total
    // Source: revenueForMargin, totalAssets
    const assetTurnover2025 = totalAssets > 0 ? revenueForMargin / totalAssets : 0;
    const assetTurnover2024 = totalAssets > 0 ? metrics2024.revenue / totalAssets : 0;
    const assetTurnover2023 = totalAssets > 0 ? metrics2023.revenue / totalAssets : 0;
    const assetTurnover2022 = totalAssets > 0 ? metrics2022.revenue / totalAssets : 0;
    rows.push({ 
      label: "Rotation de l'actif", 
      value2025: assetTurnover2025.toFixed(2), 
      value2026: metrics2024.revenue > 0 ? assetTurnover2024.toFixed(2) : "", 
      value2027: metrics2023.revenue > 0 ? assetTurnover2023.toFixed(2) : "", 
      value2028: metrics2022.revenue > 0 ? assetTurnover2022.toFixed(2) : "" 
    });
    rows.push({ 
      label: "Ventes totales", 
      value2025: revenueForMargin, 
      value2026: metrics2024.revenue > 0 ? metrics2024.revenue : "", 
      value2027: metrics2023.revenue > 0 ? metrics2023.revenue : "", 
      value2028: metrics2022.revenue > 0 ? metrics2022.revenue : "", 
      isSubRow: true 
    });
    rows.push({ 
      label: "Actif total", 
      value2025: totalAssets, 
      value2026: totalAssets, 
      value2027: totalAssets, 
      value2028: totalAssets, 
      isSubRow: true 
    });

    // ENDETTEMENT (Debt Ratio)
    // Formule: (Passif long terme / Actif total) × 100
    // Source: totalLiabilities (0 en crypto), totalAssets
    // Note: En crypto wallet standard, dette = 0
    const debtRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;
    rows.push({ label: "Endettement", value2025: debtRatio.toFixed(2), value2026: "", value2027: "", value2028: "" });
    rows.push({ label: "Passif long terme", value2025: totalLiabilities, value2026: "", value2027: "", value2028: "", isSubRow: true });
    rows.push({ label: "Actif total", value2025: totalAssets, value2026: "", value2027: "", value2028: "", isSubRow: true });

    // ROTATION DES COMPTES CLIENTS
    // Formule: Ventes totales / Comptes clients
    // Source: revenueForMargin, accountsReceivable (0 en crypto)
    // Note: En crypto, comptes clients = 0 (ne s'applique pas)
    const arTurnover = accountsReceivable > 0 ? revenueForMargin / accountsReceivable : 0;
    rows.push({ label: "Rotation des comptes clients", value2025: arTurnover.toFixed(2), value2026: "", value2027: "", value2028: "" });
    rows.push({ label: "Ventes totales", value2025: revenueForMargin, value2026: "", value2027: "", value2028: "", isSubRow: true });
    rows.push({ label: "Comptes clients", value2025: accountsReceivable, value2026: "", value2027: "", value2028: "", isSubRow: true });

    // DÉLAI DE RECOUVREMENT (Days Sales Outstanding)
    // Formule: 365 / Rotation des comptes clients
    // Source: daysInYear (365), arTurnover
    const dso = arTurnover > 0 ? daysInYear / arTurnover : 0;
    rows.push({ label: "Délai de recouvrement", value2025: dso.toFixed(2), value2026: "", value2027: "", value2028: "" });
    rows.push({ label: "Nombre de jours dans 1 an", value2025: daysInYear, value2026: "", value2027: "", value2028: "", isSubRow: true });
    rows.push({ label: "Rotation des comptes clients", value2025: arTurnover.toFixed(2), value2026: "", value2027: "", value2028: "", isSubRow: true });

    // ROTATION DES IMMOBILISATIONS
    // Formule: Ventes totales / Immobilisations
    // Source: revenueForMargin, fixedAssets (totalAssets - currentAssets)
    const fixedAssetTurnover2025 = fixedAssets > 0 ? revenueForMargin / fixedAssets : 0;
    const fixedAssetTurnover2024 = fixedAssets > 0 ? metrics2024.revenue / fixedAssets : 0;
    const fixedAssetTurnover2023 = fixedAssets > 0 ? metrics2023.revenue / fixedAssets : 0;
    const fixedAssetTurnover2022 = fixedAssets > 0 ? metrics2022.revenue / fixedAssets : 0;
    rows.push({ 
      label: "Rotation des immobilisations", 
      value2025: fixedAssetTurnover2025.toFixed(2), 
      value2026: metrics2024.revenue > 0 ? fixedAssetTurnover2024.toFixed(2) : "", 
      value2027: metrics2023.revenue > 0 ? fixedAssetTurnover2023.toFixed(2) : "", 
      value2028: metrics2022.revenue > 0 ? fixedAssetTurnover2022.toFixed(2) : "" 
    });
    rows.push({ 
      label: "Ventes totales", 
      value2025: revenueForMargin, 
      value2026: metrics2024.revenue > 0 ? metrics2024.revenue : "", 
      value2027: metrics2023.revenue > 0 ? metrics2023.revenue : "", 
      value2028: metrics2022.revenue > 0 ? metrics2022.revenue : "", 
      isSubRow: true 
    });
    rows.push({ 
      label: "Immobilisations", 
      value2025: fixedAssets, 
      value2026: fixedAssets, 
      value2027: fixedAssets, 
      value2028: fixedAssets, 
      isSubRow: true 
    });

    // COUVERTURE DES INTÉRÊTS
    // Formule: BAII / Intérêts
    // Source: operatingIncome, interestExpense (0 en crypto)
    // Note: En crypto, intérêts = 0 (pas d'emprunts trackés)
    const interestCoverage2025 = interestExpense > 0 ? operatingIncome / interestExpense : 0;
    const interestCoverage2024 = interestExpense > 0 ? metrics2024.operatingIncome / interestExpense : 0;
    const interestCoverage2023 = interestExpense > 0 ? metrics2023.operatingIncome / interestExpense : 0;
    const interestCoverage2022 = interestExpense > 0 ? metrics2022.operatingIncome / interestExpense : 0;
    rows.push({ 
      label: "Couverture des intérêts", 
      value2025: interestCoverage2025.toFixed(2), 
      value2026: interestExpense > 0 ? interestCoverage2024.toFixed(2) : "", 
      value2027: interestExpense > 0 ? interestCoverage2023.toFixed(2) : "", 
      value2028: interestExpense > 0 ? interestCoverage2022.toFixed(2) : "" 
    });
    rows.push({ 
      label: "BAII", 
      value2025: operatingIncome, 
      value2026: metrics2024.operatingIncome !== 0 ? metrics2024.operatingIncome : "", 
      value2027: metrics2023.operatingIncome !== 0 ? metrics2023.operatingIncome : "", 
      value2028: metrics2022.operatingIncome !== 0 ? metrics2022.operatingIncome : "", 
      isSubRow: true 
    });
    rows.push({ 
      label: "Intérêts", 
      value2025: interestExpense, 
      value2026: interestExpense, 
      value2027: interestExpense, 
      value2028: interestExpense, 
      isSubRow: true 
    });

    // MARGE BRUTE
    // Formule: (Bénéfice brut / Ventes totales) × 100
    // Source: grossProfit, revenueForMargin
    const grossMargin2025 = revenueForMargin > 0 ? (grossProfit / revenueForMargin) * 100 : 0;
    const grossMargin2024 = metrics2024.revenue > 0 ? (metrics2024.grossProfit / metrics2024.revenue) * 100 : 0;
    const grossMargin2023 = metrics2023.revenue > 0 ? (metrics2023.grossProfit / metrics2023.revenue) * 100 : 0;
    const grossMargin2022 = metrics2022.revenue > 0 ? (metrics2022.grossProfit / metrics2022.revenue) * 100 : 0;
    rows.push({ 
      label: "Marge brute", 
      value2025: grossMargin2025.toFixed(2), 
      value2026: metrics2024.revenue > 0 ? grossMargin2024.toFixed(2) : "", 
      value2027: metrics2023.revenue > 0 ? grossMargin2023.toFixed(2) : "", 
      value2028: metrics2022.revenue > 0 ? grossMargin2022.toFixed(2) : "" 
    });
    rows.push({ 
      label: "Bénéfice brut", 
      value2025: grossProfit, 
      value2026: metrics2024.grossProfit !== 0 ? metrics2024.grossProfit : "", 
      value2027: metrics2023.grossProfit !== 0 ? metrics2023.grossProfit : "", 
      value2028: metrics2022.grossProfit !== 0 ? metrics2022.grossProfit : "", 
      isSubRow: true 
    });
    rows.push({ 
      label: "Ventes totales", 
      value2025: revenueForMargin, 
      value2026: metrics2024.revenue > 0 ? metrics2024.revenue : "", 
      value2027: metrics2023.revenue > 0 ? metrics2023.revenue : "", 
      value2028: metrics2022.revenue > 0 ? metrics2022.revenue : "", 
      isSubRow: true 
    });

    // MARGE OPÉRATIONNELLE
    // Formule: (BAII / Ventes totales) × 100
    // Source: operatingIncome, revenueForMargin
    const operatingMargin2025 = revenueForMargin > 0 ? (operatingIncome / revenueForMargin) * 100 : 0;
    const operatingMargin2024 = metrics2024.revenue > 0 ? (metrics2024.operatingIncome / metrics2024.revenue) * 100 : 0;
    const operatingMargin2023 = metrics2023.revenue > 0 ? (metrics2023.operatingIncome / metrics2023.revenue) * 100 : 0;
    const operatingMargin2022 = metrics2022.revenue > 0 ? (metrics2022.operatingIncome / metrics2022.revenue) * 100 : 0;
    rows.push({ 
      label: "Marge opérationnelle", 
      value2025: operatingMargin2025.toFixed(2), 
      value2026: metrics2024.revenue > 0 ? operatingMargin2024.toFixed(2) : "", 
      value2027: metrics2023.revenue > 0 ? operatingMargin2023.toFixed(2) : "", 
      value2028: metrics2022.revenue > 0 ? operatingMargin2022.toFixed(2) : "" 
    });
    rows.push({ 
      label: "BAII", 
      value2025: operatingIncome, 
      value2026: metrics2024.operatingIncome !== 0 ? metrics2024.operatingIncome : "", 
      value2027: metrics2023.operatingIncome !== 0 ? metrics2023.operatingIncome : "", 
      value2028: metrics2022.operatingIncome !== 0 ? metrics2022.operatingIncome : "", 
      isSubRow: true 
    });
    rows.push({ 
      label: "Ventes totales", 
      value2025: revenueForMargin, 
      value2026: metrics2024.revenue > 0 ? metrics2024.revenue : "", 
      value2027: metrics2023.revenue > 0 ? metrics2023.revenue : "", 
      value2028: metrics2022.revenue > 0 ? metrics2022.revenue : "", 
      isSubRow: true 
    });

    // ROA (Rendement de l'actif)
    // Formule: (Bénéfice net / Actif total) × 100
    // Source: netIncome, totalAssets
    const roa2025 = totalAssets > 0 ? (netIncome / totalAssets) * 100 : 0;
    const roa2024 = totalAssets > 0 ? (metrics2024.netIncome / totalAssets) * 100 : 0;
    const roa2023 = totalAssets > 0 ? (metrics2023.netIncome / totalAssets) * 100 : 0;
    const roa2022 = totalAssets > 0 ? (metrics2022.netIncome / totalAssets) * 100 : 0;
    rows.push({ 
      label: "Rendement de l'actif (ROA)", 
      value2025: roa2025.toFixed(2), 
      value2026: metrics2024.netIncome !== 0 ? roa2024.toFixed(2) : "", 
      value2027: metrics2023.netIncome !== 0 ? roa2023.toFixed(2) : "", 
      value2028: metrics2022.netIncome !== 0 ? roa2022.toFixed(2) : "" 
    });
    rows.push({ 
      label: "Bénéfice net", 
      value2025: netIncome, 
      value2026: metrics2024.netIncome !== 0 ? metrics2024.netIncome : "", 
      value2027: metrics2023.netIncome !== 0 ? metrics2023.netIncome : "", 
      value2028: metrics2022.netIncome !== 0 ? metrics2022.netIncome : "", 
      isSubRow: true 
    });
    rows.push({ 
      label: "Actif total", 
      value2025: totalAssets, 
      value2026: totalAssets, 
      value2027: totalAssets, 
      value2028: totalAssets, 
      isSubRow: true 
    });

    // ============================================
    // SECTION 2: ANALYSE DE LIQUIDITÉ
    // ============================================
    
    // RATIO DE FONDS DE ROULEMENT
    // Formule: Actif court terme / Passif court terme
    // Source: currentAssets (stablecoins + tokens majeurs), currentLiabilities (0 en crypto)
    // Note: En crypto, passif = 0, donc ratio = 0 ou infini
    const workingCapitalRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : 0;
    rows.push({ 
      label: "Ratio de fonds de roulement", 
      value2025: workingCapitalRatio.toFixed(2), 
      value2026: workingCapitalRatio.toFixed(2), 
      value2027: workingCapitalRatio.toFixed(2), 
      value2028: workingCapitalRatio.toFixed(2) 
    });
    rows.push({ 
      label: "Actif court terme", 
      value2025: currentAssets, 
      value2026: currentAssets, 
      value2027: currentAssets, 
      value2028: currentAssets, 
      isSubRow: true 
    });
    rows.push({ 
      label: "Passif court terme", 
      value2025: currentLiabilities, 
      value2026: currentLiabilities, 
      value2027: currentLiabilities, 
      value2028: currentLiabilities, 
      isSubRow: true 
    });

    // RATIO DE LIQUIDITÉ IMMÉDIATE (Quick Ratio)
    // Formule: (Encaisse + Comptes clients + Placements) / Passif court terme
    // Source: cash (stablecoins), accountsReceivableValue (0), shortTermInvestments, currentLiabilities (0)
    // Note: En crypto, passif = 0, donc ratio = 0
    const quickRatio = currentLiabilities > 0 ? (cash + accountsReceivableValue + shortTermInvestments) / currentLiabilities : 0;
    rows.push({ 
      label: "Ratio de liquidité immédiate", 
      value2025: quickRatio.toFixed(2), 
      value2026: quickRatio.toFixed(2), 
      value2027: quickRatio.toFixed(2), 
      value2028: quickRatio.toFixed(2), 
      isHighlighted: true 
    });
    rows.push({ 
      label: "Encaisse", 
      value2025: cash, 
      value2026: cash, 
      value2027: cash, 
      value2028: cash, 
      isSubRow: true 
    });
    rows.push({ 
      label: "Comptes clients", 
      value2025: accountsReceivableValue, 
      value2026: accountsReceivableValue, 
      value2027: accountsReceivableValue, 
      value2028: accountsReceivableValue, 
      isSubRow: true 
    });
    rows.push({ 
      label: "Placements termes", 
      value2025: shortTermInvestments, 
      value2026: shortTermInvestments, 
      value2027: shortTermInvestments, 
      value2028: shortTermInvestments, 
      isSubRow: true, 
      isHighlighted: true 
    });
    rows.push({ 
      label: "Passif court terme", 
      value2025: currentLiabilities, 
      value2026: currentLiabilities, 
      value2027: currentLiabilities, 
      value2028: currentLiabilities, 
      isSubRow: true 
    });

    // JOURS DE SUFFISANCE
    // Formule: (Encaisse + Comptes clients) / Dépenses quotidiennes
    // Source: cash, accountsReceivableValue (0), dailyExpenses (calculé par année)
    // Indique: Combien de jours on peut couvrir avec les actifs liquides
    const daysOfCash2025 = dailyExpenses > 0 ? (cash + accountsReceivableValue) / dailyExpenses : 0;
    const daysOfCash2024 = metrics2024.dailyExpenses > 0 ? (cash + accountsReceivableValue) / metrics2024.dailyExpenses : 0;
    const daysOfCash2023 = metrics2023.dailyExpenses > 0 ? (cash + accountsReceivableValue) / metrics2023.dailyExpenses : 0;
    const daysOfCash2022 = metrics2022.dailyExpenses > 0 ? (cash + accountsReceivableValue) / metrics2022.dailyExpenses : 0;
    rows.push({ 
      label: "Jours de suffisance", 
      value2025: daysOfCash2025.toFixed(2), 
      value2026: metrics2024.dailyExpenses > 0 ? daysOfCash2024.toFixed(2) : "", 
      value2027: metrics2023.dailyExpenses > 0 ? daysOfCash2023.toFixed(2) : "", 
      value2028: metrics2022.dailyExpenses > 0 ? daysOfCash2022.toFixed(2) : "", 
      isHighlighted: true 
    });
    rows.push({ 
      label: "Encaisse", 
      value2025: cash, 
      value2026: cash, 
      value2027: cash, 
      value2028: cash, 
      isSubRow: true 
    });
    rows.push({ 
      label: "Comptes clients", 
      value2025: accountsReceivableValue, 
      value2026: accountsReceivableValue, 
      value2027: accountsReceivableValue, 
      value2028: accountsReceivableValue, 
      isSubRow: true 
    });
    rows.push({ 
      label: "Dépenses quotidiennes", 
      value2025: dailyExpenses, 
      value2026: metrics2024.dailyExpenses > 0 ? metrics2024.dailyExpenses : "", 
      value2027: metrics2023.dailyExpenses > 0 ? metrics2023.dailyExpenses : "", 
      value2028: metrics2022.dailyExpenses > 0 ? metrics2022.dailyExpenses : "", 
      isSubRow: true, 
      isHighlighted: true 
    });

    // ============================================
    // SECTION 3: ANALYSE DU SEUIL DE RENTABILITÉ
    // ============================================
    
    // SEUIL DE RENTABILITÉ
    // Formule: Frais fixes / Marge sur coûts variables
    // Source: fixedCosts (gas fees + 30% dépenses), variableMargin (grossProfit / revenue)
    // Indique: Le niveau de revenus nécessaire pour couvrir tous les coûts
    const breakEven2025 = variableMargin > 0 ? fixedCosts / variableMargin : 0;
    const breakEven2024 = metrics2024.variableMargin > 0 ? metrics2024.fixedCosts / metrics2024.variableMargin : 0;
    const breakEven2023 = metrics2023.variableMargin > 0 ? metrics2023.fixedCosts / metrics2023.variableMargin : 0;
    const breakEven2022 = metrics2022.variableMargin > 0 ? metrics2022.fixedCosts / metrics2022.variableMargin : 0;
    rows.push({ 
      label: "Seuil de rentabilité", 
      value2025: breakEven2025, 
      value2026: metrics2024.fixedCosts > 0 ? breakEven2024 : "", 
      value2027: metrics2023.fixedCosts > 0 ? breakEven2023 : "", 
      value2028: metrics2022.fixedCosts > 0 ? breakEven2022 : "", 
      isHighlighted: true 
    });
    rows.push({ 
      label: "Frais fixes", 
      value2025: fixedCosts, 
      value2026: metrics2024.fixedCosts > 0 ? metrics2024.fixedCosts : "", 
      value2027: metrics2023.fixedCosts > 0 ? metrics2023.fixedCosts : "", 
      value2028: metrics2022.fixedCosts > 0 ? metrics2022.fixedCosts : "", 
      isSubRow: true, 
      isHighlighted: true 
    });
    rows.push({ 
      label: "Marge sur coûts variables", 
      value2025: variableMargin.toFixed(4), 
      value2026: metrics2024.variableMargin > 0 ? metrics2024.variableMargin.toFixed(4) : "", 
      value2027: metrics2023.variableMargin > 0 ? metrics2023.variableMargin.toFixed(4) : "", 
      value2028: metrics2022.variableMargin > 0 ? metrics2022.variableMargin.toFixed(4) : "", 
      isSubRow: true, 
      isHighlighted: true 
    });

    // LEVIER FINANCIER
    // Formule: Dette totale / Équité
    // Source: totalDebt (0 en crypto), equity
    // Note: En crypto wallet, dette = 0, donc levier = 0
    const financialLeverage = equity > 0 ? totalDebt / equity : 0;
    rows.push({ 
      label: "Levier financier", 
      value2025: financialLeverage.toFixed(2), 
      value2026: financialLeverage.toFixed(2), 
      value2027: financialLeverage.toFixed(2), 
      value2028: financialLeverage.toFixed(2) 
    });
    rows.push({ 
      label: "Dette totale", 
      value2025: totalDebt, 
      value2026: totalDebt, 
      value2027: totalDebt, 
      value2028: totalDebt, 
      isSubRow: true 
    });
    rows.push({ 
      label: "Équité (capital-actions)", 
      value2025: equity, 
      value2026: equity, 
      value2027: equity, 
      value2028: equity, 
      isSubRow: true 
    });

    // LEVIER D'OPÉRATION
    // Formule: Variation du BAII (%) / Variation des ventes (%)
    // Calcul: On peut calculer les variations si on a les données des années précédentes
    // Source: operatingIncome, netIncome, et données historiques
    const operatingLeverage2025 = netIncome !== 0 ? operatingIncome / netIncome : 0;
    
    // Calculer les variations si on a les données
    const ebitChange2024 = metrics2024.operatingIncome !== 0 && metrics2023.operatingIncome !== 0 
      ? ((metrics2024.operatingIncome - metrics2023.operatingIncome) / Math.abs(metrics2023.operatingIncome)) * 100 
      : null;
    const salesChange2024 = metrics2024.revenue > 0 && metrics2023.revenue > 0 
      ? ((metrics2024.revenue - metrics2023.revenue) / metrics2023.revenue) * 100 
      : null;
    const operatingLeverage2024 = salesChange2024 !== null && salesChange2024 !== 0 && ebitChange2024 !== null
      ? ebitChange2024 / salesChange2024
      : (metrics2024.netIncome !== 0 ? metrics2024.operatingIncome / metrics2024.netIncome : 0);
    
    const ebitChange2023 = metrics2023.operatingIncome !== 0 && metrics2022.operatingIncome !== 0 
      ? ((metrics2023.operatingIncome - metrics2022.operatingIncome) / Math.abs(metrics2022.operatingIncome)) * 100 
      : null;
    const salesChange2023 = metrics2023.revenue > 0 && metrics2022.revenue > 0 
      ? ((metrics2023.revenue - metrics2022.revenue) / metrics2022.revenue) * 100 
      : null;
    const operatingLeverage2023 = salesChange2023 !== null && salesChange2023 !== 0 && ebitChange2023 !== null
      ? ebitChange2023 / salesChange2023
      : (metrics2023.netIncome !== 0 ? metrics2023.operatingIncome / metrics2023.netIncome : 0);
    
    rows.push({ 
      label: "Levier d'opération", 
      value2025: operatingLeverage2025.toFixed(2), 
      value2026: metrics2024.netIncome !== 0 ? operatingLeverage2024.toFixed(2) : "", 
      value2027: metrics2023.netIncome !== 0 ? operatingLeverage2023.toFixed(2) : "", 
      value2028: "" 
    });
    rows.push({ 
      label: "Variation du BAII (%)", 
      value2025: "", 
      value2026: ebitChange2024 !== null ? ebitChange2024.toFixed(2) : "", 
      value2027: ebitChange2023 !== null ? ebitChange2023.toFixed(2) : "", 
      value2028: "", 
      isSubRow: true 
    });
    rows.push({ 
      label: "Variation des ventes (%)", 
      value2025: "", 
      value2026: salesChange2024 !== null ? salesChange2024.toFixed(2) : "", 
      value2027: salesChange2023 !== null ? salesChange2023.toFixed(2) : "", 
      value2028: "", 
      isSubRow: true 
    });

    // LEVIER COMBINÉ
    // Formule: Levier d'opération × Levier financier
    // Source: operatingLeverage, financialLeverage
    const combinedLeverage2025 = financialLeverage * operatingLeverage2025;
    const combinedLeverage2024 = financialLeverage * operatingLeverage2024;
    const combinedLeverage2023 = financialLeverage * operatingLeverage2023;
    rows.push({ 
      label: "Levier combiné", 
      value2025: combinedLeverage2025.toFixed(2), 
      value2026: metrics2024.netIncome !== 0 ? combinedLeverage2024.toFixed(2) : "", 
      value2027: metrics2023.netIncome !== 0 ? combinedLeverage2023.toFixed(2) : "", 
      value2028: "" 
    });
    rows.push({ 
      label: "Levier financier", 
      value2025: financialLeverage.toFixed(2), 
      value2026: financialLeverage.toFixed(2), 
      value2027: financialLeverage.toFixed(2), 
      value2028: financialLeverage.toFixed(2), 
      isSubRow: true, 
      isCombinedLeverageSubRow: true 
    });
    rows.push({ 
      label: "Levier d'opération", 
      value2025: operatingLeverage2025.toFixed(2), 
      value2026: metrics2024.netIncome !== 0 ? operatingLeverage2024.toFixed(2) : "", 
      value2027: metrics2023.netIncome !== 0 ? operatingLeverage2023.toFixed(2) : "", 
      value2028: "", 
      isSubRow: true, 
      isCombinedLeverageSubRow: true 
    });

    return rows;
  }, [ov, transactions, currentYear, historicalTransactions]);

  const formatValue = (value: string | number, isSubRow: boolean = false): string => {
    if (value === "") return "";
    if (typeof value === "number") {
      if (value === 0) {
        // For sub-rows with monetary values, show "- $", otherwise "0"
        return isSubRow ? "- $" : "0";
      }
      if (value < 0) return "- $";
      // For monetary sub-rows, format as currency
      if (isSubRow && (Math.abs(value) >= 0.01 || value === 0)) {
        return fmtUSD(value);
      }
      // For ratio values, show as decimal
      if (Math.abs(value) < 1000 && !isSubRow) {
        return value.toFixed(2);
      }
      return fmtUSD(value);
    }
    return value;
  };

  if (loadingOv || loadingTransactions) {
    return (
      <Card className="p-6 bg-white shadow-sm">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Ratios</h3>
        <Skeleton className="h-[600px] w-full" />
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-white shadow-sm">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">Ratios</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Ratios</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-700">2025</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-700">Variation</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-700">2026</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-700">Variation2</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-700">2027</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-700">Variation3</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-700">2028</th>
            </tr>
          </thead>
          <tbody>
            {ratios.map((row, index) => (
              <tr
                key={index}
                className={`border-b border-slate-100 ${
                  row.isSectionHeader
                    ? "bg-slate-50 font-bold"
                    : row.isCombinedLeverageSubRow
                    ? "bg-blue-50"
                    : row.isSubRow
                    ? "bg-slate-50/50"
                    : ""
                }`}
              >
                <td
                  className={`px-4 py-2 ${
                    row.isSectionHeader 
                      ? "font-bold text-slate-800" 
                      : row.isSubRow 
                      ? "pl-8 text-slate-600" 
                      : "text-slate-700"
                  } ${row.isHighlighted ? "text-red-600 font-medium" : ""}`}
                >
                  {row.label}
                </td>
                <td className={`px-4 py-2 text-center ${row.isHighlighted ? "text-red-600" : "text-slate-600"}`}>
                  {formatValue(row.value2025, row.isSubRow)}
                </td>
                <td className="px-4 py-2 text-center text-slate-400">{row.variation || ""}</td>
                <td className={`px-4 py-2 text-center ${row.isHighlighted ? "text-red-600" : "text-slate-600"}`}>
                  {formatValue(row.value2026, row.isSubRow)}
                </td>
                <td className="px-4 py-2 text-center text-slate-400">{row.variation2 || ""}</td>
                <td className={`px-4 py-2 text-center ${row.isHighlighted ? "text-red-600" : "text-slate-600"}`}>
                  {formatValue(row.value2027, row.isSubRow)}
                </td>
                <td className="px-4 py-2 text-center text-slate-400">{row.variation3 || ""}</td>
                <td className={`px-4 py-2 text-center ${row.isHighlighted ? "text-red-600" : "text-slate-600"}`}>
                  {formatValue(row.value2028, row.isSubRow)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default RatiosTable;

