// backend/src/routes/transactions.routes.ts

import { Router } from "express";
import { listTransactionLegs } from "../services/transactions.service";
import { parseNetworks } from "../config/networks";
import { applyLegFilters } from "../utils/tx.filters";

const router = Router();

/**
 * GET /api/transactions/:address
 * Query:
 *  - networks: comma-separated (optional; defaults to all supported)
 *  - from, to: ISO datetime or epoch seconds (optional)
 *  - page, limit: pagination (default 1 / 100)
 */
router.get("/:address", async (req, res) => {
  try {
    const { address } = req.params;
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      return res.status(400).json({ error: "Invalid address" });
    }

    // Validate networks early to return nice errors
    try {
      parseNetworks(req.query.networks as string | string[] | undefined);
    } catch (e: any) {
      return res.status(400).json({ error: e.message ?? "Invalid networks" });
    }

    const legs = await listTransactionLegs({
      address: address as `0x${string}`,
      networks: req.query.networks as string | string[] | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });

    const gasMeta = (legs as any)._gasUsdByTx as
      | Record<string, number>
      | undefined;
    if (gasMeta) delete (legs as any)._gasUsdByTx;

    res.json({
      data: legs,
      meta: { gasUsdByTx: gasMeta ?? {} },
      page: Number(req.query.page ?? 1),
      limit: Number(req.query.limit ?? 100),
    });
  } catch (err: any) {
    res
      .status(500)
      .json({ error: "Internal error", detail: err?.message ?? String(err) });
  }
});

export default router;
