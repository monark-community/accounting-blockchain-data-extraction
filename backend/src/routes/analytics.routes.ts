import { Router } from "express";
import { getMultiNetworkHistoricalPortfolio } from "../services/historical.service";
import { parseNetworks } from "../config/networks";
import { getPricingWarnings } from "../services/pricing.service";
import { getTokenApiWarnings } from "../services/tokenApiStatus";

// Toggle verbose analytics/debug logs. When false only concise errors are printed.
const LOGS_DEBUG = (process.env.LOGS_DEBUG ?? "false") === "true";
function dbg(...args: any[]) {
  if (LOGS_DEBUG) console.log(...args);
}

const router = Router();

/**
 * @openapi
 * /analytics/historical/{address}:
 *   get:
 *     summary: Historical portfolio value across networks
 *     tags: [Analytics]
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
 *         description: Comma-separated network ids (default = all supported).
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           minimum: 7
 *           maximum: 365
 *           default: 180
 *         description: Lookback window for historical data.
 *       - in: query
 *         name: useFallback
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Use fallback estimation when primary data is unavailable.
 *     responses:
 *       200:
 *         description: Historical portfolio series
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 address:
 *                   type: string
 *                 networks:
 *                   type: array
 *                   items:
 *                     type: string
 *                 days:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     description: Historical point with timestamp/value fields
 *                 isEstimated:
 *                   type: boolean
 *                 warnings:
 *                   type: object
 *       400:
 *         description: Invalid parameters or failed fetch
 */
router.get("/historical/:address", async (req, res) => {
  try {
    const { address } = req.params;
    const networks = parseNetworks(req.query.networks as string | undefined);
    const days = Math.min(365, Math.max(7, Number(req.query.days ?? "180")));
    const useFallback = req.query.useFallback === "true";

    dbg(`[Analytics Route] GET /api/analytics/historical/${address}`);
    dbg(
      `[Analytics Route] Params: networks=${networks.join(",")}, days=${days}, useFallback=${useFallback}`
    );

    const data = await getMultiNetworkHistoricalPortfolio(
      networks,
      address,
      days,
      useFallback
    );

    dbg(`[Analytics Route] Response: ${data.length} points for ${address}`);

    // Check if data is estimated (from fallback)
    const isEstimated =
      data.length > 0 && (data[0] as any)._isEstimated === true;

    res.json({
      address,
      networks,
      days,
      data,
      isEstimated,
      warnings: {
        ...getPricingWarnings(),
        ...getTokenApiWarnings(),
      },
    });
  } catch (err: any) {
    dbg("[GET /api/analytics/historical/:address] error:", err);
    dbg("[Analytics Route] Error stack:", err.stack);
    res.status(400).json({ ok: false, error: err?.message ?? "Bad Request" });
  }
});

export default router;
