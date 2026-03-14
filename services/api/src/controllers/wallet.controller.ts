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
    const { address, chain, label } = req.body;

    const existing = await prisma.wallet.findUnique({
      where: {
        address_chain: {
          address: address.toLowerCase(),
          chain
        }
      }
    });

    if (existing) {
      throw new ConflictError('Wallet already exists');
    }

    const wallet = await prisma.wallet.create({
      data: {
        userId: req.userId!,
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
    const { id } = req.params;

    const wallet = await prisma.wallet.findUnique({ where: { id } });

    if (!wallet || wallet.userId !== req.userId) {
      throw new NotFoundError('Wallet not found');
    }

    logger.info('Starting wallet sync', { walletId: wallet.id });

    const rawTransactions = await blockchainService.fetchTransactions(
      wallet.address,
      wallet.chain as any
    );

    let created = 0;

    for (const raw of rawTransactions) {
      const normalized = blockchainService.normalize(raw, wallet.chain as any);

      const existing = await prisma.transaction.findUnique({
        where: {
          hash_chain: {
            hash: normalized.hash,
            chain: normalized.chain
          }
        }
      });

      if (!existing) {
        await prisma.transaction.create({
          data: {
            walletId: wallet.id,
            hash: normalized.hash,
            chain: normalized.chain,
            timestamp: normalized.timestamp,
            fromAddress: normalized.fromAddress,
            toAddress: normalized.toAddress,
            tokenSymbol: normalized.tokenSymbol,
            tokenAddress: normalized.tokenAddress,
            amount: normalized.amount,
            gasUsed: normalized.gasUsed ? BigInt(normalized.gasUsed) : null,
            gasPrice: normalized.gasPrice,
            blockNumber: normalized.blockNumber ? BigInt(normalized.blockNumber) : null
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

    res.json({ message: 'Sync completed', transactionsAdded: created });
  } catch (error) {
    next(error);
  }
};