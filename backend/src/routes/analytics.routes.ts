import { Router } from "express";
import { getMultiNetworkHistoricalPortfolio } from "../services/historical.service";
import { parseNetworks } from "../config/networks";

const router = Router();

/**
 * GET /api/analytics/historical/:address?networks=mainnet,polygon,...&days=180
 */
router.get("/historical/:address", async (req, res) => {
  try {
    const { address } = req.params;
    const networks = parseNetworks(req.query.networks as string | undefined);
    const days = Math.min(365, Math.max(7, Number(req.query.days ?? "180")));

    console.log(`[Analytics Route] GET /api/analytics/historical/${address}`);
    console.log(`[Analytics Route] Params: networks=${networks.join(",")}, days=${days}`);

    const data = await getMultiNetworkHistoricalPortfolio(
      networks,
      address,
      days
    );

    console.log(`[Analytics Route] Response: ${data.length} points for ${address}`);
    
    // Check if data is estimated (from fallback)
    const isEstimated = data.length > 0 && (data[0] as any)._isEstimated === true;

    res.json({
      address,
      networks,
      days,
      data,
      isEstimated,
    });
  } catch (err: any) {
    console.error("[GET /api/analytics/historical/:address] error:", err);
    console.error("[Analytics Route] Error stack:", err.stack);
    res.status(400).json({ ok: false, error: err?.message ?? "Bad Request" });
  }
});

export default router;

