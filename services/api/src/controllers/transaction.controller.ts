/**
 * Transaction Controller
 */
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import prisma from '../config/database';
import classificationService from '../services/classification.service';
import { NotFoundError } from '../utils/errors';

export const listTransactions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      page = '1',
      limit = '50',
      walletId,
      chain,
      category
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    const wallets = await prisma.wallet.findMany({
      where: { userId: req.userId },
      select: { id: true }
    });

    const where: any = {
      walletId: walletId ? walletId : { in: wallets.map(w => w.id) }
    };

    if (chain) where.chain = chain;
    if (category) where.category = category;

    const skip = (pageNum - 1) * limitNum;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { timestamp: 'desc' },
        include: {
          tags: true,
          wallet: {
            select: { address: true, chain: true }
          }
        }
      }),
      prisma.transaction.count({ where })
    ]);

    res.json({
      transactions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    next(error);
  }
};

export const updateTransaction = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { category, isInternal, notes, tags } = req.body;

    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: { wallet: true }
    });

    if (!transaction || transaction.wallet.userId !== req.userId) {
      throw new NotFoundError('Transaction not found');
    }

    await classificationService.classifyTransaction(
      id,
      category,
      isInternal !== undefined ? isInternal : transaction.isInternal,
      notes,
      tags
    );

    res.json({ message: 'Transaction updated' });
  } catch (error) {
    next(error);
  }
};

export const bulkClassify = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { transactionIds, category } = req.body;

    const count = await classificationService.bulkClassify(
      transactionIds,
      category
    );

    res.json({ message: 'Bulk classification completed', count });
  } catch (error) {
    next(error);
  }
};