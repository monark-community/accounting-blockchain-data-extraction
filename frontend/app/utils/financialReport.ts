import type { TxRow } from "@/lib/types/transactions";
import type { useTransactionStats } from "@/hooks/useTransactionStats";
import { fmtUSD, shortAddr } from "./transactionHelpers";
import { nowStamp, shortForFile, downloadBlob } from "./transactionExport";

interface FinancialReportData {
  transactions: TxRow[];
  stats: ReturnType<typeof useTransactionStats>;
  dateRangeLabel: string;
  exportLabel: string;
  totalAssetsUsd: number | null;
  stableHoldingsUsd: number;
  totalCount: number | null;
  loadedTxCount: number;
  activeWallets: string[];
  walletLabelLookup: Record<string, { label: string; color?: string }>;
}

export type ReportFormat = "pdf" | "quickbooks";

// Generate wallet information string
function getWalletInfo(
  activeWallets: string[],
  walletLabelLookup: Record<string, { label: string; color?: string }>
): string {
  if (activeWallets.length === 0) return "No wallets";
  if (activeWallets.length === 1) {
    const wallet = activeWallets[0];
    const meta = walletLabelLookup[wallet.toLowerCase()];
    return meta?.label || shortAddr(wallet);
  }
  return activeWallets
    .map((addr) => {
      const meta = walletLabelLookup[addr.toLowerCase()];
      return meta?.label || shortAddr(addr);
    })
    .join(", ");
}

// Generate wallet addresses string
function getWalletAddresses(activeWallets: string[]): string {
  return activeWallets.join(", ");
}

export function generateFinancialReport(
  data: FinancialReportData,
  format: ReportFormat = "pdf"
): void {
  const {
    transactions,
    stats,
    dateRangeLabel,
    exportLabel,
    totalAssetsUsd,
    stableHoldingsUsd,
    totalCount,
    loadedTxCount,
    activeWallets,
    walletLabelLookup,
  } = data;

  const walletInfo = getWalletInfo(activeWallets, walletLabelLookup);
  const walletAddresses = getWalletAddresses(activeWallets);

  // Calculate totals by category
  const categoryTotals = {
    income: 0,
    expense: 0,
    swap: 0,
    gas: 0,
  };

  const categoryCounts = {
    income: 0,
    expense: 0,
    swap: 0,
    gas: 0,
  };

  transactions.forEach((tx) => {
    const amount = tx.usdAtTs ?? 0;
    if (tx.type === "income") {
      categoryTotals.income += amount;
      categoryCounts.income++;
    } else if (tx.type === "expense") {
      categoryTotals.expense += amount;
      categoryCounts.expense++;
    } else if (tx.type === "swap") {
      categoryTotals.swap += Math.abs(amount);
      categoryCounts.swap++;
    } else if (tx.type === "gas") {
      categoryTotals.gas += amount;
      categoryCounts.gas++;
    }
  });

  // Calculate totals by network
  const networkTotals: Record<string, { in: number; out: number; count: number }> = {};
  transactions.forEach((tx) => {
    if (!networkTotals[tx.network]) {
      networkTotals[tx.network] = { in: 0, out: 0, count: 0 };
    }
    const amount = tx.usdAtTs ?? 0;
    if (tx.direction === "in") {
      networkTotals[tx.network].in += amount;
    } else {
      networkTotals[tx.network].out += amount;
    }
    networkTotals[tx.network].count++;
  });

  // Monthly breakdown
  const monthlyData: Record<string, { income: number; expense: number; count: number }> = {};
  transactions.forEach((tx) => {
    const date = new Date(tx.ts);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { income: 0, expense: 0, count: 0 };
    }
    const amount = tx.usdAtTs ?? 0;
    if (tx.type === "income") {
      monthlyData[monthKey].income += amount;
    } else if (tx.type === "expense") {
      monthlyData[monthKey].expense += amount;
    }
    monthlyData[monthKey].count++;
  });

  const monthlyArray = Object.entries(monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      income: data.income,
      expense: data.expense,
      net: data.income - data.expense,
      count: data.count,
    }));

  // Prepare chart data
  const categoryChartData = [
    { name: "Income", value: categoryTotals.income, count: categoryCounts.income },
    { name: "Expense", value: categoryTotals.expense, count: categoryCounts.expense },
    { name: "Swap", value: categoryTotals.swap, count: categoryCounts.swap },
    { name: "Gas", value: categoryTotals.gas, count: categoryCounts.gas },
  ];

  const networkChartData = Object.entries(networkTotals)
    .map(([network, data]) => ({
      name: network,
      in: data.in,
      out: data.out,
      net: data.in - data.out,
      count: data.count,
    }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
    .slice(0, 10);

  // Generate HTML report
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Financial Report - ${exportLabel}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1e293b;
      background: #f8fafc;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    h1 {
      color: #0f172a;
      margin-bottom: 10px;
      font-size: 2rem;
    }
    h2 {
      color: #334155;
      margin-top: 40px;
      margin-bottom: 20px;
      font-size: 1.5rem;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 10px;
    }
    h3 {
      color: #475569;
      margin-top: 30px;
      margin-bottom: 15px;
      font-size: 1.25rem;
    }
    .header-info {
      background: #f1f5f9;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    .header-info p {
      margin: 5px 0;
      color: #64748b;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin: 30px 0;
    }
    .stat-card {
      background: #f8fafc;
      padding: 20px;
      border-radius: 8px;
      border-left: 4px solid #3b82f6;
    }
    .stat-card.income { border-left-color: #10b981; }
    .stat-card.expense { border-left-color: #ef4444; }
    .stat-card.swap { border-left-color: #8b5cf6; }
    .stat-card.gas { border-left-color: #06b6d4; }
    .stat-label {
      font-size: 0.875rem;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .stat-value {
      font-size: 1.5rem;
      font-weight: 600;
      color: #0f172a;
    }
    .stat-count {
      font-size: 0.875rem;
      color: #94a3b8;
      margin-top: 4px;
    }
    .chart-container {
      margin: 30px 0;
      padding: 20px;
      background: #f8fafc;
      border-radius: 8px;
    }
    .chart-wrapper {
      position: relative;
      height: 400px;
      margin: 20px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }
    th {
      background: #f1f5f9;
      font-weight: 600;
      color: #334155;
    }
    tr:hover {
      background: #f8fafc;
    }
    .positive { color: #10b981; font-weight: 600; }
    .negative { color: #ef4444; font-weight: 600; }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      color: #94a3b8;
      font-size: 0.875rem;
    }
    @media print {
      body {
        background: white;
        padding: 0;
      }
      .container {
        box-shadow: none;
        padding: 20px;
      }
      .chart-container {
        page-break-inside: avoid;
      }
      table {
        page-break-inside: avoid;
      }
      h2 {
        page-break-after: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Financial Report</h1>
    <div class="header-info">
      <p><strong>Wallet(s):</strong> ${walletInfo}</p>
      <p><strong>Wallet Address(es):</strong> ${walletAddresses}</p>
      <p><strong>Period:</strong> ${dateRangeLabel}</p>
      <p><strong>Report Generated:</strong> ${new Date().toLocaleString()}</p>
      <p><strong>Transactions Analyzed:</strong> ${loadedTxCount.toLocaleString()}${totalCount ? ` / ${totalCount.toLocaleString()} (${Math.round((loadedTxCount / totalCount) * 100)}%)` : ""}</p>
      ${totalAssetsUsd !== null ? `<p><strong>Total Assets:</strong> ${fmtUSD(totalAssetsUsd)}</p>` : ""}
      <p><strong>Stable Holdings:</strong> ${fmtUSD(stableHoldingsUsd)}</p>
    </div>

    <h2>Summary Statistics</h2>
    <div class="stats-grid">
      <div class="stat-card income">
        <div class="stat-label">Total Income</div>
        <div class="stat-value positive">${fmtUSD(categoryTotals.income)}</div>
        <div class="stat-count">${categoryCounts.income.toLocaleString()} transactions</div>
      </div>
      <div class="stat-card expense">
        <div class="stat-label">Total Expenses</div>
        <div class="stat-value negative">${fmtUSD(categoryTotals.expense)}</div>
        <div class="stat-count">${categoryCounts.expense.toLocaleString()} transactions</div>
      </div>
      <div class="stat-card swap">
        <div class="stat-label">Swap Volume</div>
        <div class="stat-value">${fmtUSD(categoryTotals.swap)}</div>
        <div class="stat-count">${categoryCounts.swap.toLocaleString()} transactions</div>
      </div>
      <div class="stat-card gas">
        <div class="stat-label">Gas Fees</div>
        <div class="stat-value negative">${fmtUSD(categoryTotals.gas)}</div>
        <div class="stat-count">${categoryCounts.gas.toLocaleString()} transactions</div>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Net Income</div>
        <div class="stat-value ${categoryTotals.income - categoryTotals.expense - categoryTotals.gas >= 0 ? 'positive' : 'negative'}">
          ${fmtUSD(categoryTotals.income - categoryTotals.expense - categoryTotals.gas)}
        </div>
        <div class="stat-count">Income - Expenses - Gas</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Capital Gains (Realized)</div>
        <div class="stat-value ${stats.capitalGainsSummary.totalRealized >= 0 ? 'positive' : 'negative'}">
          ${fmtUSD(stats.capitalGainsSummary.totalRealized)}
        </div>
        <div class="stat-count">Short: ${fmtUSD(stats.capitalGainsSummary.shortTerm)} | Long: ${fmtUSD(stats.capitalGainsSummary.longTerm)}</div>
      </div>
    </div>

    <h2>Category Breakdown</h2>
    <div class="chart-container">
      <div class="chart-wrapper">
        <canvas id="categoryChart"></canvas>
      </div>
    </div>

    <h2>Monthly Trends</h2>
    <div class="chart-container">
      <div class="chart-wrapper">
        <canvas id="monthlyChart"></canvas>
      </div>
    </div>

    <h2>Network Breakdown</h2>
    <div class="chart-container">
      <div class="chart-wrapper">
        <canvas id="networkChart"></canvas>
      </div>
    </div>

    <h2>Top Networks by Volume</h2>
    <table>
      <thead>
        <tr>
          <th>Network</th>
          <th>Inflow</th>
          <th>Outflow</th>
          <th>Net</th>
          <th>Transactions</th>
        </tr>
      </thead>
      <tbody>
        ${networkChartData.map(n => `
          <tr>
            <td>${n.name}</td>
            <td class="positive">${fmtUSD(n.in)}</td>
            <td class="negative">${fmtUSD(n.out)}</td>
            <td class="${n.net >= 0 ? 'positive' : 'negative'}">${fmtUSD(n.net)}</td>
            <td>${n.count.toLocaleString()}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>

    <h2>Monthly Breakdown</h2>
    <table>
      <thead>
        <tr>
          <th>Month</th>
          <th>Income</th>
          <th>Expenses</th>
          <th>Net</th>
          <th>Transactions</th>
        </tr>
      </thead>
      <tbody>
        ${monthlyArray.map(m => `
          <tr>
            <td>${m.month}</td>
            <td class="positive">${fmtUSD(m.income)}</td>
            <td class="negative">${fmtUSD(m.expense)}</td>
            <td class="${m.net >= 0 ? 'positive' : 'negative'}">${fmtUSD(m.net)}</td>
            <td>${m.count.toLocaleString()}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>

    <h2>Capital Gains Details</h2>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Short-term Gains</div>
        <div class="stat-value ${stats.capitalGainsSummary.shortTerm >= 0 ? 'positive' : 'negative'}">
          ${fmtUSD(stats.capitalGainsSummary.shortTerm)}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Long-term Gains</div>
        <div class="stat-value ${stats.capitalGainsSummary.longTerm >= 0 ? 'positive' : 'negative'}">
          ${fmtUSD(stats.capitalGainsSummary.longTerm)}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Acquisitions</div>
        <div class="stat-value">${stats.capitalGainsSummary.acquisitions.toLocaleString()}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Disposals</div>
        <div class="stat-value">${stats.capitalGainsSummary.disposals.toLocaleString()}</div>
      </div>
    </div>

    <div class="footer">
      <p>Generated by LedgerLift Financial Report Generator</p>
      <p>Report ID: ${nowStamp()}</p>
    </div>
  </div>

  <script>
    // Category Pie Chart
    const categoryCtx = document.getElementById('categoryChart').getContext('2d');
    new Chart(categoryCtx, {
      type: 'pie',
      data: {
        labels: ${JSON.stringify(categoryChartData.map(d => d.name))},
        datasets: [{
          data: ${JSON.stringify(categoryChartData.map(d => d.value))},
          backgroundColor: ['#10b981', '#ef4444', '#8b5cf6', '#06b6d4'],
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right' },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.parsed || 0;
                return label + ': ' + new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD'
                }).format(value);
              }
            }
          }
        }
      }
    });

    // Monthly Line Chart
    const monthlyCtx = document.getElementById('monthlyChart').getContext('2d');
    new Chart(monthlyCtx, {
      type: 'line',
      data: {
        labels: ${JSON.stringify(monthlyArray.map(m => m.month))},
        datasets: [{
          label: 'Income',
          data: ${JSON.stringify(monthlyArray.map(m => m.income))},
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4
        }, {
          label: 'Expenses',
          data: ${JSON.stringify(monthlyArray.map(m => m.expense))},
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          tension: 0.4
        }, {
          label: 'Net',
          data: ${JSON.stringify(monthlyArray.map(m => m.net))},
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: false,
            ticks: {
              callback: function(value) {
                return new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                  notation: 'compact'
                }).format(value);
              }
            }
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context) {
                return context.dataset.label + ': ' + new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD'
                }).format(context.parsed.y);
              }
            }
          }
        }
      }
    });

    // Network Bar Chart
    const networkCtx = document.getElementById('networkChart').getContext('2d');
    new Chart(networkCtx, {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(networkChartData.map(n => n.name))},
        datasets: [{
          label: 'Inflow',
          data: ${JSON.stringify(networkChartData.map(n => n.in))},
          backgroundColor: '#10b981'
        }, {
          label: 'Outflow',
          data: ${JSON.stringify(networkChartData.map(n => n.out))},
          backgroundColor: '#ef4444'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                  notation: 'compact'
                }).format(value);
              }
            }
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context) {
                return context.dataset.label + ': ' + new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD'
                }).format(context.parsed.y);
              }
            }
          }
        }
      }
    });
  </script>
</body>
</html>`;

  if (format === "quickbooks") {
    // Generate CSV file for QuickBooks
    generateQuickBooksCSV(data);
    // Also generate HTML report with charts as a separate file
    generatePDFReport(html, data, "quickbooks");
  } else {
    // Generate PDF using html2pdf approach
    generatePDFReport(html, data, "pdf");
  }
}

// Generate QuickBooks CSV format
function generateQuickBooksCSV(data: FinancialReportData): void {
  const { transactions, dateRangeLabel, exportLabel, activeWallets, walletLabelLookup } = data;
  const walletInfo = getWalletInfo(activeWallets, walletLabelLookup);

  // QuickBooks CSV format - comma-separated
  const lines: string[] = [];
  
  // CSV Headers for QuickBooks import
  lines.push("Date,Transaction Type,Account,Name,Amount,Memo,Reference Number");

  // Process transactions
  transactions.forEach((tx) => {
    // Format date as MM/DD/YYYY for QuickBooks
    const date = new Date(tx.ts);
    const formattedDate = `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
    
    const amount = tx.usdAtTs ?? 0;
    const absAmount = Math.abs(amount);
    
    // Determine account type based on transaction type
    let accountType = "Expense";
    let trnsType = "Journal Entry";
    
    if (tx.type === "income") {
      accountType = "Income";
      trnsType = "Deposit";
    } else if (tx.type === "expense") {
      accountType = "Expense";
      trnsType = "Check";
    } else if (tx.type === "gas") {
      accountType = "Gas Fees";
      trnsType = "Journal Entry";
    } else if (tx.type === "swap") {
      accountType = "Trading";
      trnsType = "Journal Entry";
    }

    // Create memo with transaction details
    const assetInfo = tx.asset?.symbol || "Unknown Asset";
    const memo = `${tx.type.toUpperCase()}: ${assetInfo} on ${tx.network}`;
    const name = tx.counterparty?.label || tx.counterparty?.address?.slice(0, 30) || walletInfo;
    const referenceNumber = tx.hash.slice(0, 16);

    // Escape CSV values
    const escapeCsv = (value: string | number): string => {
      const str = String(value);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Transaction amount - positive for income, negative for expenses
    const transactionAmount = tx.direction === "in" ? absAmount : -absAmount;

    // Add transaction line
    lines.push(
      [
        escapeCsv(formattedDate),
        escapeCsv(trnsType),
        escapeCsv(accountType),
        escapeCsv(name),
        escapeCsv(transactionAmount.toFixed(2)),
        escapeCsv(memo),
        escapeCsv(referenceNumber),
      ].join(",")
    );
  });

  const csvContent = lines.join("\n");
  // Add BOM for Excel compatibility
  const blob = new Blob(["\ufeff", csvContent], { type: "text/csv;charset=utf-8" });
  downloadBlob(
    blob,
    `quickbooks_${shortForFile(exportLabel)}_${dateRangeLabel.replace(/[^a-zA-Z0-9]/g, "_")}_${nowStamp()}.csv`
  );
}

// Generate PDF report or HTML report with charts
function generatePDFReport(html: string, data: FinancialReportData, format: "pdf" | "quickbooks" = "pdf"): void {
  const { exportLabel, dateRangeLabel } = data;
  
  if (format === "pdf") {
    // Create a new window with the HTML content for PDF printing
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      // Fallback: download as HTML
      const blob = new Blob([html], { type: "text/html" });
      downloadBlob(
        blob,
        `financial_report_${shortForFile(exportLabel)}_${dateRangeLabel.replace(/[^a-zA-Z0-9]/g, "_")}_${nowStamp()}.html`
      );
      return;
    }

    printWindow.document.write(html);
    printWindow.document.close();

    // Wait for content to load, then trigger print
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 250);
    };
  } else {
    // For QuickBooks format, download HTML file with charts
    const blob = new Blob([html], { type: "text/html" });
    downloadBlob(
      blob,
      `quickbooks_report_${shortForFile(exportLabel)}_${dateRangeLabel.replace(/[^a-zA-Z0-9]/g, "_")}_${nowStamp()}.html`
    );
  }
}

