/**
 * Export Service
 */
export class ExportService {
  async exportToCSV(transactions: any[]): Promise<string> {
    const header = 'Date,Hash,From,To,Amount,Token,Category,USD\n';
    const rows = transactions.map(t => {
      const date = new Date(t.timestamp).toISOString().split('T')[0];
      const amount = parseFloat(t.amount).toFixed(4);
      const usd = t.amountFiat ? t.amountFiat.toFixed(2) : '';
      return [date, t.hash, t.fromAddress, t.toAddress, amount, t.tokenSymbol, t.category || '', usd].join(',');
    }).join('\n');
    return header + rows;
  }

  async exportToJSON(transactions: any[]): Promise<string> {
    const formatted = transactions.map(t => ({
      date: new Date(t.timestamp).toISOString(),
      hash: t.hash,
      from: t.fromAddress,
      to: t.toAddress,
      amount: parseFloat(t.amount),
      token: t.tokenSymbol,
      category: t.category || null,
      valueUsd: t.amountFiat ? parseFloat(t.amountFiat) : null
    }));
    return JSON.stringify(formatted, null, 2);
  }
}

export default new ExportService();