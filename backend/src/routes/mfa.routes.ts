import { Router } from "express";
import { requireAuth } from "../middleware/session";
import {
  setupMFA,
  verifyMFA,
  enableMFA,
  disableMFA,
  isMFAEnabled,
  getBackupCodes,
  regenerateBackupCodes,
} from "../services/mfa.service";
import { findUserByWalletAddress } from "../repositories/user.repo";
import { pool } from "../db/pool";

const router = Router();

/**
 * @openapi
 * /mfa/status-by-address:
 *   get:
 *     summary: Check if MFA is enabled for a wallet (public)
 *     tags: [MFA]
 *     parameters:
 *       - in: query
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: Wallet address (0x...).
 *     responses:
 *       200:
 *         description: MFA status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 enabled:
 *                   type: boolean
 *       400:
 *         description: Missing wallet address
 */
router.get("/status-by-address", async (req, res) => {
  try {
    const { address } = req.query;
    
    if (!address || typeof address !== 'string') {
      return res.status(400).json({ error: "Wallet address is required" });
    }

    // Find user by wallet address
    const { rows } = await pool.query(
      `SELECT mfa_enabled FROM users WHERE wallet_address = $1`,
      [address]
    );

    if (rows.length === 0) {
      return res.json({ enabled: false });
    }

    return res.json({ enabled: rows[0].mfa_enabled === true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /mfa/verify-by-address:
 *   post:
 *     summary: Verify an MFA code for a wallet (public, login flow)
 *     tags: [MFA]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [address, code]
 *             properties:
 *               address:
 *                 type: string
 *               code:
 *                 type: string
 *     responses:
 *       200:
 *         description: Code verified
 *       400:
 *         description: Invalid input or code
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post("/verify-by-address", async (req, res) => {
  try {
    const { address, code } = req.body;
    
    if (!address || typeof address !== 'string') {
      return res.status(400).json({ error: "Wallet address is required" });
    }

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: "Code is required" });
    }

    // Find user by wallet address
    const { rows } = await pool.query(
      `SELECT wallet_address FROM users WHERE wallet_address = $1`,
      [address]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const walletAddress = rows[0].wallet_address;
    const result = await verifyMFA(walletAddress, code);

    if (!result.success) {
      return res.status(400).json({ error: "Invalid code" });
    }

    return res.json({ success: true, backupCodeUsed: result.backupCodeUsed });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// All other MFA routes require authentication
router.use(requireAuth);

/**
 * @openapi
 * /mfa/status:
 *   get:
 *     summary: Check MFA status for the authenticated user
 *     tags: [MFA]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: MFA status
 *       401:
 *         description: Not authenticated
 */
router.get("/status", async (req, res) => {
  try {
    const walletAddress = (req as any).user.wallet_address;
    const enabled = await isMFAEnabled(walletAddress);
    return res.json({ enabled });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /mfa/setup:
 *   post:
 *     summary: Generate MFA secret, QR code, and backup codes
 *     tags: [MFA]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Setup payload with secret, QR, and backup codes
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: User not found
 */
router.post("/setup", async (req, res) => {
  try {
    const walletAddress = (req as any).user.wallet_address;
    const user = await findUserByWalletAddress(walletAddress);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const result = await setupMFA(walletAddress, user.name);

    return res.json({
      secret: result.secret,
      qrCode: result.qrCode,
      backupCodes: result.backupCodes,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /mfa/verify:
 *   post:
 *     summary: Verify a TOTP code during setup
 *     tags: [MFA]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code:
 *                 type: string
 *     responses:
 *       200:
 *         description: Code verified
 *       400:
 *         description: Invalid code
 *       401:
 *         description: Not authenticated
 */
router.post("/verify", async (req, res) => {
  try {
    const walletAddress = (req as any).user.wallet_address;
    const { code } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: "Code is required" });
    }

    const result = await verifyMFA(walletAddress, code);

    if (!result.success) {
      return res.status(400).json({ error: "Invalid code" });
    }

    return res.json({ success: true, backupCodeUsed: result.backupCodeUsed });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /mfa/enable:
 *   post:
 *     summary: Enable MFA after successful verification
 *     tags: [MFA]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: MFA enabled
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.post("/enable", async (req, res) => {
  try {
    const walletAddress = (req as any).user.wallet_address;
    await enableMFA(walletAddress);
    return res.json({ success: true, message: "MFA enabled successfully" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /mfa/disable:
 *   post:
 *     summary: Disable MFA
 *     tags: [MFA]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: MFA disabled
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.post("/disable", async (req, res) => {
  try {
    const walletAddress = (req as any).user.wallet_address;
    await disableMFA(walletAddress);
    return res.json({ success: true, message: "MFA disabled successfully" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /mfa/backup-codes:
 *   get:
 *     summary: Get remaining backup codes
 *     tags: [MFA]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Backup codes returned
 *       401:
 *         description: Not authenticated
 */
router.get("/backup-codes", async (req, res) => {
  try {
    const walletAddress = (req as any).user.wallet_address;
    const codes = await getBackupCodes(walletAddress);
    return res.json({ backupCodes: codes });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /mfa/regenerate-backup-codes:
 *   post:
 *     summary: Regenerate backup codes (invalidates previous set)
 *     tags: [MFA]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: New backup codes generated
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.post("/regenerate-backup-codes", async (req, res) => {
  try {
    const walletAddress = (req as any).user.wallet_address;
    const codes = await regenerateBackupCodes(walletAddress);
    return res.json({ backupCodes: codes });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;

