// backend/src/routes/transactions.routes.ts

import { Router } from "express";
import { listTransactionLegs } from "../services/transactions.service";
import { parseNetworks } from "../config/networks";
import { applyLegFilters } from "../utils/tx.filters";
import { buildSummary } from "../services/tx.aggregate";

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
    const raw = String(req.params.address ?? "");
    const ok = /^0x[0-9a-f]{40}$/i.test(raw); // <-- case-insensitive
    // TEMP LOG: remove later
    // console.log(
    //   "[/transactions] addr raw='%s' len=%d regexOk=%s",
    //   raw,
    //   raw.length,
    //   ok
    // );

    if (!ok) return res.status(400).json({ error: "Invalid address" });

    const addr = raw.toLowerCase() as `0x${string}`;

    const legsRaw = await listTransactionLegs({
      address: addr,
      networks: req.query.networks as string | string[] | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });

    const gasMeta = (legsRaw as any)._gasUsdByTx as
      | Record<string, number>
      | undefined;
    if (gasMeta) delete (legsRaw as any)._gasUsdByTx;

    // apply filters from query
    const minUsd = req.query.minUsd ? Number(req.query.minUsd) : 0;
    const spamFilter =
      (req.query.spamFilter as "off" | "soft" | "hard") ??
      process.env.SPAM_FILTER_MODE ??
      "soft";
    const legs = applyLegFilters(legsRaw, { minUsd, spamFilter });

    const classParam = (req.query.class as string | undefined)?.trim();
    const classSet = classParam
      ? new Set(classParam.split(",").map((s) => s.trim()))
      : null;
    const legsFilteredByClass = classSet
      ? legs.filter((l) => l.class && classSet.has(l.class))
      : legs;

    res.json({
      data: legsFilteredByClass,
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

router.get("/summary/:address", async (req, res) => {
  try {
    const raw = String(req.params.address ?? "");
    const ok = /^0x[0-9a-f]{40}$/i.test(raw); // <-- case-insensitive
    // TEMP LOG: remove later
    // console.log(
    //   "[/transactions] addr raw='%s' len=%d regexOk=%s",
    //   raw,
    //   raw.length,
    //   ok
    // );

    if (!ok) return res.status(400).json({ error: "Invalid address" });

    const addr = raw.toLowerCase() as `0x${string}`;

    const legsRaw = await listTransactionLegs({
      address: addr,
      networks: req.query.networks as string | string[] | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });

    const gasMeta = (legsRaw as any)._gasUsdByTx as
      | Record<string, number>
      | undefined;
    if (gasMeta) delete (legsRaw as any)._gasUsdByTx;

    const minUsd = req.query.minUsd ? Number(req.query.minUsd) : 0;
    const spamFilter =
      (req.query.spamFilter as "off" | "soft" | "hard") ??
      process.env.SPAM_FILTER_MODE ??
      "soft";

    const legs = applyLegFilters(legsRaw, { minUsd, spamFilter });
    const summary = buildSummary(legs, gasMeta ?? {});

    res.json({
      data: summary,
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
