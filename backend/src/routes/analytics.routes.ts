import { Router } from "express";
import { getMultiNetworkHistoricalPortfolio } from "../services/historical.service";
import { parseNetworks } from "../config/networks";

// Toggle verbose analytics/debug logs. When false only concise errors are printed.
const LOGS_DEBUG = (process.env.LOGS_DEBUG ?? "false") === "true";
function dbg(...args: any[]) {
  if (LOGS_DEBUG) console.log(...args);
}

const router = Router();

/**
 * GET /api/analytics/historical/:address?networks=mainnet,polygon,...&days=180
 */
router.get("/historical/:address", async (req, res) => {
  try {
    const { address } = req.params;
    const networks = parseNetworks(req.query.networks as string | undefined);
    const days = Math.min(365, Math.max(7, Number(req.query.days ?? "180")));

    dbg(`[Analytics Route] GET /api/analytics/historical/${address}`);
    dbg(
      `[Analytics Route] Params: networks=${networks.join(",")}, days=${days}`
    );

    const data = await getMultiNetworkHistoricalPortfolio(
      networks,
      address,
      days
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
    });
  } catch (err: any) {
    dbg("[GET /api/analytics/historical/:address] error:", err);
    dbg("[Analytics Route] Error stack:", err.stack);
    res.status(400).json({ ok: false, error: err?.message ?? "Bad Request" });
  }
});

export default router;
