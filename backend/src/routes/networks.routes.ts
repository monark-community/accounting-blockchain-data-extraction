import { Router } from "express";
import { parseNetworks } from "../config/networks";
import { getNetworkActivitySummary } from "../services/networkActivity.service";

const router = Router();

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
