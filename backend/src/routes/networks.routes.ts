import { Router } from "express";
import { parseNetworks } from "../config/networks";
import { getNetworkActivitySummary } from "../services/networkActivity.service";

const router = Router();

/**
 * @openapi
 * /networks/activity/{address}:
 *   get:
 *     summary: Suggest active networks for a wallet
 *     tags: [Networks]
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *           pattern: "^0x[0-9a-fA-F]{40}$"
 *         description: Wallet address (0x...).
 *       - in: query
 *         name: networks
 *         schema:
 *           type: string
 *         description: Comma-separated network ids to check (default = all supported).
 *     responses:
 *       200:
 *         description: Network activity suggestions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 suggestions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       network:
 *                         type: string
 *                       lastActivityTs:
 *                         type: integer
 *                         nullable: true
 *                       direction:
 *                         type: string
 *                         enum: [in, out, unknown]
 *                       walletAddress:
 *                         type: string
 *                       walletLabel:
 *                         type: string
 *       400:
 *         description: Invalid parameters or unable to fetch activity
 */
router.get("/activity/:address", async (req, res) => {
  try {
    const { address } = req.params;
    const networks = parseNetworks(req.query.networks as string | undefined);
    const suggestions = await getNetworkActivitySummary(address, networks);
    res.json({ suggestions });
  } catch (err: any) {
    console.error("[GET /api/networks/activity/:address] error:", err);
    res
      .status(400)
      .json({
        ok: false,
        error: err?.message ?? "Unable to fetch network activity",
      });
  }
});

export default router;
