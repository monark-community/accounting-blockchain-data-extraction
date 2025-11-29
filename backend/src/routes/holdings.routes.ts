// backend/src/routes/holdings.routes.ts

import { Router } from "express";
import { getHoldingsOverview } from "../services/holdings.service";
import { parseNetworks } from "../config/networks";

const router = Router();

/**
 * @openapi
 * /holdings/{address}:
 *   get:
 *     summary: Current holdings and KPIs for a wallet across networks
 *     tags: [Holdings]
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
 *         name: withDelta24h
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include 24h delta metrics.
 *       - in: query
 *         name: minUsd
 *         schema:
 *           type: number
 *           default: 0
 *         description: Minimum USD value to include.
 *       - in: query
 *         name: includeZero
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include zero-balance holdings.
 *       - in: query
 *         name: spamFilter
 *         schema:
 *           type: string
 *           enum: [off, soft, hard]
 *           default: hard
 *         description: Apply spam filtering to holdings.
 *     responses:
 *       200:
 *         description: Holdings overview
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: Holdings, KPIs, and allocations
 *       400:
 *         description: Invalid parameters or fetch failure
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
      req.query.spamFilter ?? process.env.SPAM_FILTER_MODE ?? "hard"
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
