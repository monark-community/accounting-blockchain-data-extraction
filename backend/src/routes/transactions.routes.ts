// backend/src/routes/transactions.routes.ts

import { Router } from "express";
import { listTransactionLegs } from "../services/transactions.service";
import { parseNetworks } from "../config/networks";
import { applyLegFilters } from "../utils/tx.filters";
import { buildSummary } from "../services/tx.aggregate";
import {
  decodeCursor,
  encodeCursorFromLeg,
  isLegOlderThanCursor,
} from "../utils/tx.cursor";

const router = Router();

const TX_DEFAULT_LIMIT = Number(process.env.TX_DEFAULT_LIMIT ?? 20);
const TX_MAX_LIMIT = Number(process.env.TX_MAX_LIMIT ?? 40);
// const LOGS_DEBUG =
//   String(process.env.LOGS_DEBUG ?? "false").toLowerCase() === "false";
const LOGS_DEBUG = false;

const logDebug = (...args: any[]) => {
  if (LOGS_DEBUG) {
    console.log("[transactions]", ...args);
  }
};
const logError = (...args: any[]) => {
  if (LOGS_DEBUG) {
    console.error("[transactions]", ...args);
  }
};

function firstQueryValue(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePagination(query: Record<string, any>) {
  const rawPage = Number(firstQueryValue(query.page));
  const page =
    Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;

  const rawLimit = Number(firstQueryValue(query.limit));
  const limitCandidate =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.floor(rawLimit)
      : TX_DEFAULT_LIMIT;
  const limit = Math.max(1, Math.min(limitCandidate, TX_MAX_LIMIT));

  return { page, limit };
}

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
    const { page, limit } = parsePagination(req.query as Record<string, any>);
    logDebug("list:start", {
      address: addr,
      networks: req.query.networks ?? "(default)",
      page,
      limit,
      minUsd: req.query.minUsd,
      spamFilter: req.query.spamFilter,
      class: req.query.class,
    });

    // Check if class filter is applied (expenses, incomes, etc.)
    const classParam = (req.query.class as string | undefined)?.trim();
    const hasClassFilter = !!classParam;

    const cursor = decodeCursor(firstQueryValue(req.query.cursor));

    const legsRaw = await listTransactionLegs({
      address: addr,
      networks: req.query.networks as string | string[] | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      page,
      limit,
      cursor,
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
      "hard";
    const legs = applyLegFilters(legsRaw, { minUsd, spamFilter });

    const classSet = classParam
      ? new Set(classParam.split(",").map((s) => s.trim()))
      : null;
    const legsFilteredByClass = classSet
      ? legs.filter((l) => l.class && classSet.has(l.class))
      : legs;
    const legsAfterCursor = cursor
      ? legsFilteredByClass.filter((leg) => isLegOlderThanCursor(leg, cursor))
      : legsFilteredByClass;
    const start = cursor ? 0 : (page - 1) * limit;
    const pagedLegs = legsAfterCursor.slice(start, start + limit);
    const hasNext = cursor
      ? legsAfterCursor.length > pagedLegs.length
      : pagedLegs.length === limit;
    const nextCursorLeg = hasNext
      ? pagedLegs[pagedLegs.length - 1]
      : undefined;
    const nextCursor = nextCursorLeg
      ? encodeCursorFromLeg(nextCursorLeg)
      : null;

    res.json({
      data: pagedLegs,
      meta: { gasUsdByTx: gasMeta ?? {} },
      page,
      limit,
      hasNext,
      nextCursor,
    });
    logDebug("list:success", {
      address: addr,
      page,
      limit,
      cursor: cursor ? "yes" : "no",
      totalLegs: legs.length,
      filteredCount: legsAfterCursor.length,
      returnedCount: pagedLegs.length,
      hasNext,
    });
  } catch (err: any) {
    logError("list:error", err?.stack || err);
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
    const { page, limit } = parsePagination(req.query as Record<string, any>);
    logDebug("summary:start", {
      address: addr,
      networks: req.query.networks ?? "(default)",
      page,
      limit,
      minUsd: req.query.minUsd,
      spamFilter: req.query.spamFilter,
    });

    const legsRaw = await listTransactionLegs({
      address: addr,
      networks: req.query.networks as string | string[] | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      page,
      limit,
    });

    const gasMeta = (legsRaw as any)._gasUsdByTx as
      | Record<string, number>
      | undefined;
    if (gasMeta) delete (legsRaw as any)._gasUsdByTx;

    const minUsd = req.query.minUsd ? Number(req.query.minUsd) : 0;
    const spamFilter =
      (req.query.spamFilter as "off" | "soft" | "hard") ??
      process.env.SPAM_FILTER_MODE ??
      "hard";

    const legs = applyLegFilters(legsRaw, { minUsd, spamFilter });
    const summary = buildSummary(legs, gasMeta ?? {});

    res.json({
      data: summary,
      page,
      limit,
    });
    logDebug("summary:success", {
      address: addr,
      page,
      limit,
      kpi: summary.kpi,
    });
  } catch (err: any) {
    logError("summary:error", err?.stack || err);
    res
      .status(500)
      .json({ error: "Internal error", detail: err?.message ?? String(err) });
  }
});

export default router;
