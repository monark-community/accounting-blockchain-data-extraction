/**
 * Export Controller
 */
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import prisma from '../config/database';
import exportService from '../services/export.service';

export const exportData = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { format = 'csv', walletId, startDate, endDate } = req.query;

    const wallets = await prisma.wallet.findMany({
      where: { userId: req.userId },
      select: { id: true }
    });

    const where: any = {
      walletId: walletId ? walletId : { in: wallets.map(w => w.id) }
    };

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate as string);
      if (endDate) where.timestamp.lte = new Date(endDate as string);
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: { wallet: true },
      orderBy: { timestamp: 'desc' }
    });

    let content: string;
    let contentType: string;
    let filename: string;

    if (format === 'json') {
      content = await exportService.exportToJSON(transactions);
      contentType = 'application/json';
      filename = `ledgerlift-export-${Date.now()}.json`;
    } else {
      content = await exportService.exportToCSV(transactions);
      contentType = 'text/csv';
      filename = `ledgerlift-export-${Date.now()}.csv`;
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  } catch (error) {
    next(error);
  }
};