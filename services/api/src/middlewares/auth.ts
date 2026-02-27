import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../types';
import { UnauthorizedError } from '../utils/errors';

/**
 * JWT Authentication Middleware
 * Verifies the JWT token from Authorization header
 * Adds userId to the request object if valid
 */
export const authenticateJWT = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }

    // Get token after "Bearer "
    const token = authHeader.substring(7);
    
    // Get JWT secret from environment
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }

    // Verify and decode token
    const decoded = jwt.verify(token, secret) as { userId: string };
    
    // Add userId to request object for use in controllers
    req.userId = decoded.userId;

    next();
  } catch (error) {
    // Handle JWT-specific errors
    if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid token'));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Token expired'));
    } else {
      next(error);
    }
  }
};
