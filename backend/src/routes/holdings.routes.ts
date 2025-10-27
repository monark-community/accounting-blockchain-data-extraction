// src/routes/holdings.routes.ts
import { Router } from "express";
import { getHoldingsOverview } from "../services/holdings.service";
import { parseNetworks } from "../config/networks";

const router = Router();

/**
 * GET /api/holdings/:address?networks=mainnet,polygon,...
 * Example:
 *   /api/holdings/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045?networks=mainnet,polygon,base
 */
router.get("/:address", async (req, res) => {
  try {
    const { address } = req.params;
    const networks = parseNetworks(req.query.networks as string | undefined);
    const withDelta24h = (req.query.withDelta24h ?? "true") !== "false";

    const payload = await getHoldingsOverview(address, networks, withDelta24h);
    res.json(payload);
  } catch (err: any) {
    console.error("[GET /api/holdings/:address] error:", err);
    res.status(400).json({ ok: false, error: err?.message ?? "Bad Request" });
  }
});

export default router;
