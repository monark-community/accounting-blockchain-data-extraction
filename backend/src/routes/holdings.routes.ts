// backend/src/routes/holdings.routes.ts

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
    const minUsd = Number(req.query.minUsd ?? "0");
    const includeZero = (req.query.includeZero ?? "false") === "true";

    // NEW: spamFilter mode
    const spamFilter = String(
      req.query.spamFilter ?? process.env.SPAM_FILTER_MODE ?? "soft"
    ).toLowerCase() as "off" | "soft" | "hard";

    const payload = await getHoldingsOverview(address, networks, withDelta24h, {
      minUsd,
      includeZero,
      spamFilter,
    });
    res.json(payload);
  } catch (err: any) {
    console.error("[GET /api/holdings/:address] error:", err);
    res.status(400).json({ ok: false, error: err?.message ?? "Bad Request" });
  }
});

export default router;
