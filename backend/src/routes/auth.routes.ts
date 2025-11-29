import { Router } from "express";
import cookieParser from "cookie-parser";
import {
  findOrCreateUserByWallet,
  findUserByWalletAddress,
  deleteUserAccount,
  updateUserName,
} from "../repositories/user.repo";
import { signSession } from "../utils/jwt";
import { requireAuth } from "../middleware/session";

const router = Router();

const SESSION_NAME = process.env.SESSION_NAME || "ll_session";
const SESSION_SECRET = process.env.SESSION_SECRET!;
const COOKIE_DOMAIN =
  process.env.COOKIE_DOMAIN ||
  (process.env.FRONTEND_URL
    ? new URL(process.env.FRONTEND_URL).hostname
    : undefined);

const baseCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  signed: true,
  sameSite: "lax" as const,
  domain: COOKIE_DOMAIN,
};

/**
 * @openapi
 * /auth/web3auth-session:
 *   post:
 *     summary: Create or find user by wallet and set a session cookie
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [address]
 *             properties:
 *               address:
 *                 type: string
 *                 description: Wallet address (0x...).
 *               userInfo:
 *                 type: object
 *                 additionalProperties: true
 *                 description: Optional profile info from Web3Auth
 *     responses:
 *       200:
 *         description: Session created and cookie set
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 wallet_address:
 *                   type: string
 *                 name:
 *                   type: string
 *                   nullable: true
 *       400:
 *         description: Missing wallet address
 *       500:
 *         description: Server error
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
      ...baseCookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.json({
      success: true,
      wallet_address: user.wallet_address,
      name: user.name,
    });
  } catch (error: any) {
    console.error("[auth] web3auth-session error:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Logout by clearing the session cookie
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Session cleared
 *       500:
 *         description: Server error
 */
router.post("/logout", async (req, res) => {
  res.clearCookie(SESSION_NAME, baseCookieOptions);

  return res.json({ success: true, message: "Logged out successfully" });
});

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Get the current authenticated user
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Current user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 wallet_address:
 *                   type: string
 *                 name:
 *                   type: string
 *                   nullable: true
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: User not found
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
      name: user.name,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /auth/name:
 *   put:
 *     summary: Update the authenticated user's name
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Name updated
 *       400:
 *         description: Invalid name
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: User not found
 */
router.put("/name", requireAuth, async (req, res) => {
  try {
    const walletAddress = (req as any).user.wallet_address;
    const { name } = req.body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res
        .status(400)
        .json({ error: "Name is required and cannot be empty" });
    }

    // Update user name
    const updatedUser = await updateUserName(walletAddress, name);

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({
      success: true,
      name: updatedUser.name,
    });
  } catch (error: any) {
    console.error("[auth] update name error:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /auth/account:
 *   delete:
 *     summary: Delete the authenticated user's account
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Account deleted
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.delete("/account", requireAuth, async (req, res) => {
  try {
    const walletAddress = (req as any).user.wallet_address;

    // Delete user account (cascade will delete user_wallets)
    const deleted = await deleteUserAccount(walletAddress);

    if (!deleted) {
      return res.status(404).json({ error: "User not found" });
    }

    // Clear session cookie after successful deletion
    res.clearCookie(SESSION_NAME, {
      ...baseCookieOptions,
    });

    return res.json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error: any) {
    console.error("[auth] delete account error:", error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
