import type { Request, Response, NextFunction } from "express";
import { verifySession } from "../utils/jwt";

const SESSION_NAME = process.env.SESSION_NAME || "ll_session";

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token =
      (req as any).signedCookies?.[SESSION_NAME] || req.cookies?.[SESSION_NAME];
    if (token) {
      const { userId } = verifySession(token);
      (req as any).user = { id: userId };
    }
  } catch {
    /* ignore invalid token */
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token =
    (req as any).signedCookies?.[SESSION_NAME] || req.cookies?.[SESSION_NAME];
  
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const { userId } = verifySession(token);
    (req as any).user = { id: userId };
    next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}
