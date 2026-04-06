/**
 * Wallet Controller
 */
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import prisma from '../config/database';
import blockchainService from '../services/blockchain.service';
import { NotFoundError, ConflictError } from '../utils/errors';
import logger from '../utils/logger';

export const listWallets = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const wallets = await prisma.wallet.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' }
    });

    res.json(wallets);
  } catch (error) {
    next(error);
  }
};

export const createWallet = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { address, chain, label } = req.body;

    const existing = await prisma.wallet.findFirst({
      where: {
        address: address.toLowerCase(),
        chain
      }
    });

    if (existing) {
      throw new ConflictError('Wallet already exists');
    }

    const wallet = await prisma.wallet.create({
      data: {
        userId: req.userId,
        address: address.toLowerCase(),
        chain,
        label
      }
    });

    res.status(201).json(wallet);

  } catch (error) {
    next(error);
  }
};

export const deleteWallet = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { id } = req.params;

    const wallet = await prisma.wallet.findUnique({ where: { id } });

    if (!wallet || wallet.userId !== req.userId) {
      throw new NotFoundError('Wallet not found');
    }

    await prisma.wallet.delete({ where: { id } });

    res.json({ message: 'Wallet deleted' });

  } catch (error) {
    next(error);
  }
};

export const syncWallet = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { id } = req.params;

    const wallet = await prisma.wallet.findUnique({ where: { id } });

    if (!wallet || wallet.userId !== req.userId) {
      throw new NotFoundError('Wallet not found');
    }

    logger.info('Starting wallet sync', { walletId: wallet.id });

    const transactions = await blockchainService.fetchTransactions(
      wallet.address,
      wallet.chain as any
    );

    let created = 0;

    for (const tx of transactions) {

      const existing = await prisma.transaction.findFirst({
        where: {
          hash: tx.hash,
          chain: tx.chain
        }
      });

      if (!existing) {
        await prisma.transaction.create({
          data: {
            walletId: wallet.id,
            hash: tx.hash,
            chain: tx.chain,
            timestamp: tx.timestamp,
            fromAddress: tx.fromAddress,
            toAddress: tx.toAddress,
            tokenSymbol: tx.tokenSymbol,
            tokenAddress: tx.tokenAddress,
            amount: tx.amount ? tx.amount.toString() : "0",
          }
        });

        created++;
      }
    }

    await prisma.wallet.update({
      where: { id },
      data: { lastSynced: new Date() }
    });

    logger.info('Sync completed', { transactionsAdded: created });

    res.json({
      message: 'Sync completed',
      transactionsAdded: created
    });

  } catch (error) {
    next(error);
  }
};