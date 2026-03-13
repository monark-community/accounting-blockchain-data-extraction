/**
 * Auth Controller
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ethers } from 'ethers';
import prisma from '../config/database';
import { ValidationError } from '../utils/errors';
import logger from '../utils/logger';

export const connectWallet = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { address, signature, message } = req.body;

    const recoveredAddress = ethers.verifyMessage(message, signature);

    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      throw new ValidationError('Invalid signature');
    }

    let user = await prisma.user.findFirst({
      where: {
        wallets: { some: { address: address.toLowerCase() } }
      }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          wallets: {
            create: {
              address: address.toLowerCase(),
              chain: 'ethereum',
              isPrimary: true
            }
          }
        }
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    logger.info('User authenticated', { userId: user.id });

    res.json({
      token,
      user: { id: user.id, createdAt: user.createdAt }
    });
  } catch (error) {
    next(error);
  }
};

export const logout = (req: Request, res: Response) => {
  res.json({ message: 'Logged out' });
};