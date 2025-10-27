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
 * GET /api/mfa/status-by-address
 * Check if MFA is enabled for a wallet address (no auth required)
 */
router.get("/status-by-address", async (req, res) => {
  try {
    const { address } = req.query;
    
    if (!address || typeof address !== 'string') {
      return res.status(400).json({ error: "Wallet address is required" });
    }

    // Find user by wallet address
    const { rows } = await pool.query(
      `SELECT id, mfa_enabled FROM users WHERE wallet_address = $1`,
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
 * POST /api/mfa/verify-by-address
 * Verify MFA code for a wallet address (no auth required - used during login)
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
 * GET /api/mfa/status
 * Check if MFA is enabled for the current user
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
 * POST /api/mfa/setup
 * Generate MFA secret and QR code for setup
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
 * POST /api/mfa/verify
 * Verify a TOTP code during setup (before enabling MFA)
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
 * POST /api/mfa/enable
 * Enable MFA for the user (after successful verification)
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
 * POST /api/mfa/disable
 * Disable MFA for the user
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
 * GET /api/mfa/backup-codes
 * Get remaining backup codes
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
 * POST /api/mfa/regenerate-backup-codes
 * Generate new backup codes (invalidates old ones)
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

