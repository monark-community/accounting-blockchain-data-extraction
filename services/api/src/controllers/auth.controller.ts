/**
 * Auth Controller
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ethers } from 'ethers';
import prisma from '../config/database';
import { ValidationError } from '../utils/errors';
import logger from '../utils/logger';

/**
 * Erreur d'authentification
 */
export class UnauthorizedError extends Error {
  statusCode = 401;
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export const connectWallet = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { address, signature, message } = req.body;

    if (!address || !signature || !message) {
      throw new ValidationError('Missing required fields: address, signature, message');
    }

    // VÉRIFICATION RÉELLE DE LA SIGNATURE (CRITIQUE)
    logger.info('Verifying Web3 signature', { address });

    let recoveredAddress: string;
    try {
      recoveredAddress = ethers.verifyMessage(message, signature);
    } catch (error) {
      logger.warn('Invalid signature format', {
        address,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new UnauthorizedError('Invalid signature format');
    }

    // Comparer les adresses
    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      logger.warn('Signature verification failed - address mismatch', {
        provided: address,
        recovered: recoveredAddress
      });
      throw new UnauthorizedError('Invalid signature - address mismatch');
    }

    logger.info('Signature verified successfully', { address });

    // Détecter la chaîne depuis le format de l'adresse
    const chain = address.startsWith('0x') ? 'ethereum' : 'solana';

    // Chercher l'utilisateur
    let user = await prisma.user.findFirst({
      where: {
        wallets: { some: { address: address.toLowerCase() } }
      },
      include: {
        wallets: true
      }
    });

    if (!user) {
      logger.info('Creating new user', { address, chain });

      user = await prisma.user.create({
        data: {
          wallets: {
            create: {
              address: address.toLowerCase(),
              chain: chain
            }
          }
        },
        include: {
          wallets: true
        }
      });

      logger.info('New user created', {
        userId: user.id,
        address
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() }
      });

      logger.info('Existing user logged in', {
        userId: user.id,
        address
      });
    }
    
    // Générer JWT
const token = jwt.sign(
  { userId: user.id },
  process.env.JWT_SECRET!,
  { expiresIn: '24h' }
);

logger.info('JWT generated', { userId: user.id });

    logger.info('JWT generated', {
      userId: user.id,
      expiresIn: process.env.JWT_EXPIRATION || '24h'
    });

    res.json({
      token,
      user: {
        id: user.id,
        wallets: user.wallets,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

export const logout = (req: Request, res: Response) => {
  logger.info('User logged out (client-side token removal)');
  
  res.json({ 
    message: 'Logged out successfully',
    note: 'Please remove the JWT token from client storage'
  });
};

/**
 * Vérifie si le JWT est valide
 */
export const verifyToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        userId: string;
        address: string;
      };

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: {
          wallets: true
        }
      });

      if (!user) {
        throw new UnauthorizedError('User not found');
      }

      res.json({
        valid: true,
        user: {
          id: user.id,
          wallets: user.wallets,
          createdAt: user.createdAt
        }
      });
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Invalid token');
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
};