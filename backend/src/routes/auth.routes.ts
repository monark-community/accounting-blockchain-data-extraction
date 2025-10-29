import { Router } from "express";
import cookieParser from "cookie-parser";
import { findOrCreateUserByWallet, findUserByWalletAddress } from "../repositories/user.repo";
import { signSession } from "../utils/jwt";
import { requireAuth } from "../middleware/session";

const router = Router();

const SESSION_NAME = process.env.SESSION_NAME || "ll_session";
const SESSION_SECRET = process.env.SESSION_SECRET!;

/**
 * POST /api/auth/web3auth-session
 * Create or find user by wallet address and create JWT session
 */
router.post("/web3auth-session", async (req, res) => {
  try {
    const { address, userInfo } = req.body;
    
    if (!address) {
      return res.status(400).json({ error: "Wallet address is required" });
    }

    // Find or create user by wallet address
    const user = await findOrCreateUserByWallet(address, userInfo);
    
    // Create JWT session with wallet_address
    const token = signSession(user.wallet_address);
    
    // Set JWT as HTTP-only cookie
    res.cookie(SESSION_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      signed: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    
    return res.json({ 
      success: true,
      wallet_address: user.wallet_address,
      name: user.name
    });
  } catch (error: any) {
    console.error("[auth] web3auth-session error:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/auth/logout
 * Logout user by clearing JWT cookie
 */
router.post("/logout", async (req, res) => {
  res.clearCookie(SESSION_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    signed: true,
    sameSite: "lax",
  });
  
  return res.json({ success: true, message: "Logged out successfully" });
});

/**
 * GET /api/auth/me
 * Get current authenticated user info
 */
router.get("/me", requireAuth, async (req, res) => {
  try {
    const walletAddress = (req as any).user.wallet_address; // JWT contient wallet_address
    
    // Fetch user from DB
    const user = await findUserByWalletAddress(walletAddress);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    return res.json({ 
      wallet_address: user.wallet_address,
      name: user.name 
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;

