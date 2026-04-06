import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

/**
 * JWT Authentication Middleware
 */

export interface AuthRequest extends Request {
  userId?: string;
}

export const authenticateJWT = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "Missing authorization header" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret") as any;

    req.userId = decoded.userId;

    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};