/**
 * Wallet Controller
 */
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import prisma from '../config/database';
import blockchainService from '../services/blockchain.service';
import priceService from '../services/price.service';
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

    logger.info('Sync started', {
      userId: req.userId,
      walletId: wallet.id,
      address: wallet.address,
      chain: wallet.chain
    });

    // 1. Récupérer les transactions (déjà normalisées par fetchTransactions)
    const normalizedTransactions = await blockchainService.fetchTransactions(
      wallet.address,
      wallet.chain as any
    );

    logger.info('Transactions fetched from blockchain', {
      walletId: wallet.id,
      count: normalizedTransactions.length
    });

    if (normalizedTransactions.length === 0) {
      await prisma.wallet.update({
        where: { id },
        data: { lastSynced: new Date() }
      });

      return res.json({
        message: 'No new transactions found',
        transactionsAdded: 0
      });
    }

    // 2. Filtrer les transactions déjà existantes
    const existingHashes = await prisma.transaction.findMany({
      where: {
        hash: { in: normalizedTransactions.map(tx => tx.hash) },
        chain: wallet.chain
      },
      select: { hash: true }
    });

    const existingHashSet = new Set(existingHashes.map(tx => tx.hash));
    const newTransactions = normalizedTransactions.filter(
      tx => !existingHashSet.has(tx.hash)
    );

    logger.info('Filtered new transactions', {
      walletId: wallet.id,
      total: normalizedTransactions.length,
      existing: existingHashes.length,
      new: newTransactions.length
    });

    if (newTransactions.length === 0) {
      await prisma.wallet.update({
        where: { id },
        data: { lastSynced: new Date() }
      });

      return res.json({
        message: 'All transactions already synced',
        transactionsAdded: 0
      });
    }

    // 3. Enrichir avec les prix (batch)
    const priceRequests = newTransactions.map(tx => ({
      tokenSymbol: tx.tokenSymbol,
      date: tx.timestamp
    }));

    logger.info('Fetching prices for transactions', {
      walletId: wallet.id,
      count: priceRequests.length
    });

    const prices = await priceService.getBatchPrices(priceRequests);

    // 4. Préparer les données pour insertion en bulk
    const transactionsToInsert = newTransactions.map(tx => {
      const priceKey = `${tx.tokenSymbol}_${tx.timestamp.toISOString().split('T')[0]}`;
      const priceData = prices.get(priceKey);

      let amountFiat = null;
      if (priceData && tx.amount) {
        try {
          const amountFloat = parseFloat(tx.amount);
          if (!isNaN(amountFloat)) {
            amountFiat = priceData.priceUsd * amountFloat;
          }
        } catch (error) {
          logger.warn('Error calculating fiat amount', {
            hash: tx.hash,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      return {
        walletId: wallet.id,
        hash: tx.hash,
        chain: tx.chain,
        timestamp: tx.timestamp,
        fromAddress: tx.fromAddress,
        toAddress: tx.toAddress,
        tokenSymbol: tx.tokenSymbol,
        tokenAddress: tx.tokenAddress || null,
        amount: tx.amount ? tx.amount.toString() : "0",
        amountFiat: amountFiat,
        category: null,
        isInternal: false,
        notes: null
      };
    });

    // 5. INSERTION EN BULK (20× PLUS RAPIDE)
    await prisma.transaction.createMany({
      data: transactionsToInsert,
      skipDuplicates: true
    });

    logger.info('Transactions inserted in bulk', {
      walletId: wallet.id,
      created: transactionsToInsert.length
    });

    // 6. Mettre à jour lastSynced
    await prisma.wallet.update({
      where: { id },
      data: { lastSynced: new Date() }
    });

    logger.info('Sync completed', {
      walletId: wallet.id,
      transactionsAdded: transactionsToInsert.length
    });

    res.json({
      message: 'Sync completed successfully',
      transactionsAdded: transactionsToInsert.length,
      totalFetched: normalizedTransactions.length
    });

  } catch (error) {
    logger.error('Sync error', {
      walletId: req.params.id,
      error: error instanceof Error ? error.message : String(error)
    });
    next(error);
  }
};