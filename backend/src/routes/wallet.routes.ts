import { Router } from "express";
import { requireAuth } from "../middleware/session";
import {
  getUserWallets,
  addWalletToUser,
  removeWalletFromUser,
} from "../services/wallet.service";

const router = Router();

// All routes require authentication
router.use(requireAuth);

/**
 * GET /api/wallets
 * Get all wallets for the authenticated user
 */
router.get("/", async (req, res) => {
  try {
    const mainAddress = (req as any).user.wallet_address;
    const wallets = await getUserWallets(mainAddress);
    
    return res.json({ wallets });
  } catch (error: any) {
    console.error("[/wallets] error:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/wallets
 * Add a new wallet to the user's account
 * Body: { address, name, chainId }
 */
router.post("/", async (req, res) => {
  try {
    const mainAddress = (req as any).user.wallet_address;
    const { address, name, chainId } = req.body;

    if (!address || !name) {
      return res.status(400).json({ error: "address and name are required" });
    }

    const wallet = await addWalletToUser({
      mainWalletAddress: mainAddress,
      address,
      name,
      chainId: chainId || 1,
    });

    return res.json({ wallet });
  } catch (error: any) {
    console.error("[/wallets POST] error:", error);
    return res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/wallets/:address
 * Remove a wallet from the user's account
 */
router.delete("/:address", async (req, res) => {
  try {
    const mainAddress = (req as any).user.wallet_address;
    const { address } = req.params;

    if (!address) {
      return res.status(400).json({ error: "address is required" });
    }

    await removeWalletFromUser(mainAddress, address);

    return res.json({ success: true, message: "Wallet removed successfully" });
  } catch (error: any) {
    console.error("[/wallets DELETE] error:", error);
    return res.status(400).json({ error: error.message });
  }
});

export default router;

