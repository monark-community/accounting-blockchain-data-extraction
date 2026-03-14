/**
 * Report Service
 */
import prisma from '../config/database';

export class ReportService {
  async calculateSummary(userId: string, startDate?: Date, endDate?: Date) {
    const wallets = await prisma.wallet.findMany({
      where: { userId },
      select: { id: true }
    });

    const where: any = {
      walletId: { in: wallets.map(w => w.id) }
    };

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = startDate;
      if (endDate) where.timestamp.lte = endDate;
    }

    const transactions = await prisma.transaction.findMany({
      where,
      select: { category: true, amountFiat: true }
    });

    let revenue = 0;
    let expense = 0;

    transactions.forEach(t => {
      const amount = t.amountFiat?.toNumber() || 0;
      if (t.category === 'revenue') revenue += amount;
      if (t.category === 'expense') expense += amount;
    });

    return {
      revenue,
      expense,
      net: revenue - expense,
      transactionCount: transactions.length
    };
  }

  async getByCategory(userId: string) {
    const wallets = await prisma.wallet.findMany({
      where: { userId },
      select: { id: true }
    });

    const grouped = await prisma.transaction.groupBy({
      by: ['category'],
      where: {
        walletId: { in: wallets.map(w => w.id) },
        category: { not: null }
      },
      _count: true,
      _sum: { amountFiat: true }
    });

    return grouped.map(g => ({
      category: g.category || 'other',
      count: g._count,
      total: g._sum.amountFiat?.toNumber() || 0
    }));
  }
}

export default new ReportService();