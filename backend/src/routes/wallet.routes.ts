import { Router } from "express";
import { requireAuth } from "../middleware/session";
import {
  getUserWallets,
  addWalletToUser,
  removeWalletFromUser,
  updateWalletName,
} from "../services/wallet.service";

const router = Router();

// All routes require authentication
router.use(requireAuth);

/**
 * @openapi
 * /wallets:
 *   get:
 *     summary: List wallets for the authenticated user
 *     tags: [Wallets]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Wallet list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 wallets:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
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
 * @openapi
 * /wallets:
 *   post:
 *     summary: Add a wallet to the authenticated user
 *     tags: [Wallets]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [address, name]
 *             properties:
 *               address:
 *                 type: string
 *               name:
 *                 type: string
 *               chainId:
 *                 type: integer
 *                 default: 1
 *     responses:
 *       200:
 *         description: Wallet added
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Not authenticated
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
 * @openapi
 * /wallets/{address}:
 *   delete:
 *     summary: Remove a wallet from the authenticated user's account
 *     tags: [Wallets]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: Wallet address to remove
 *     responses:
 *       200:
 *         description: Wallet removed
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Not authenticated
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

/**
 * @openapi
 * /wallets/{address}:
 *   patch:
 *     summary: Update a wallet's name
 *     tags: [Wallets]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: Wallet address to update
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
 *         description: Wallet updated
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Not authenticated
 */
router.patch("/:address", async (req, res) => {
  try {
    const mainAddress = (req as any).user.wallet_address;
    const { address } = req.params;
    const { name } = req.body;

    if (!address) {
      return res.status(400).json({ error: "address is required" });
    }

    if (!name) {
      return res.status(400).json({ error: "name is required" });
    }

    const wallet = await updateWalletName(mainAddress, address, name);

    return res.json({ wallet });
  } catch (error: any) {
    console.error("[/wallets PATCH] error:", error);
    return res.status(400).json({ error: error.message });
  }
});

export default router;

