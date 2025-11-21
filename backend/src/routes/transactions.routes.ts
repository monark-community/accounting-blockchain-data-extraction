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
import { getPricingWarnings } from "../services/pricing.service";
import { getTokenApiWarnings } from "../services/tokenApiStatus";

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
  const routeStartHrTime = process.hrtime.bigint();
  
  try {
    const raw = String(req.params.address ?? "");
    const ok = /^0x[0-9a-f]{40}$/i.test(raw); // <-- case-insensitive

    if (!ok) {
      return res.status(400).json({ error: "Invalid address" });
    }

    const addr = raw.toLowerCase() as `0x${string}`;
    const { page, limit } = parsePagination(req.query as Record<string, any>);

    // Check if class filter is applied (expenses, incomes, etc.)
    const classParam = (req.query.class as string | undefined)?.trim();
    const hasClassFilter = !!classParam;

    const cursorParamRaw = req.query.cursor;
    const cursorParam =
      typeof cursorParamRaw === "string"
        ? cursorParamRaw
        : Array.isArray(cursorParamRaw)
        ? cursorParamRaw[0]
        : undefined;
    const cursor = decodeCursor(
      cursorParam && typeof cursorParam === "string" ? cursorParam : undefined
    );

    const serviceStartTime = process.hrtime.bigint();

    const networksParam = req.query.networks;
    const networksValue = Array.isArray(networksParam)
      ? networksParam.map(String)
      : networksParam
      ? String(networksParam)
      : undefined;

    const legsRaw = await listTransactionLegs({
      address: addr,
      networks: networksValue,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      page,
      limit,
      cursor,
    });

    const serviceTime = Number(process.hrtime.bigint() - serviceStartTime) / 1_000_000;

    const gasMeta = (legsRaw as any)._gasUsdByTx as
      | Record<string, number>
      | undefined;
    if (gasMeta) delete (legsRaw as any)._gasUsdByTx;

    const filterStartTime = process.hrtime.bigint();
    
    // apply filters from query
    const minUsd = req.query.minUsd ? Number(req.query.minUsd) : 0;
    const spamFilter =
      ((req.query.spamFilter as "off" | "soft" | "hard") ??
      process.env.SPAM_FILTER_MODE ??
      "hard") as any;
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
    // Slice to exact limit requested (total across all networks)
    const pagedLegs = legsAfterCursor.slice(0, limit);

    // Cursor rule: Always create cursor from last sent transaction to ensure progression.
    // hasNext: true if we got at least the requested limit, suggesting more may be available
    const hasNext = pagedLegs.length >= limit;
    // Always create cursor from last sent transaction to allow progression
    const nextCursor =
      pagedLegs.length === 0
        ? null
        : encodeCursorFromLeg(pagedLegs[pagedLegs.length - 1]);

    const filterTime = Number(process.hrtime.bigint() - filterStartTime) / 1_000_000;
    const totalTime = Number(process.hrtime.bigint() - routeStartHrTime) / 1_000_000;

    res.json({
      data: pagedLegs,
      meta: { gasUsdByTx: gasMeta ?? {} },
      page,
      limit,
      hasNext,
      nextCursor,
      warnings: {
        ...getPricingWarnings(),
        ...getTokenApiWarnings(),
      },
    });
    
    // Single summary log with key metrics
    console.log(
      `[Backend] ✅ ${addr.slice(0, 6)}...${addr.slice(-4)} | Page ${page} | return-all ${pagedLegs.length}/${legsRaw.length} legs | hasNext=${hasNext ? "yes" : "no"} | Service: ${(serviceTime / 1000).toFixed(1)}s | Total: ${(totalTime / 1000).toFixed(1)}s`
    );
    
    // Log all transaction hashes from the legs
    const txHashes = Array.from(new Set(pagedLegs.map((leg) => leg.txHash)));
    console.log(
      `[Backend] 📋 Transaction hashes (${txHashes.length} unique):`,
      //txHashes.join(", ")
    );
  } catch (err: any) {
    const errorTime = Number(process.hrtime.bigint() - routeStartHrTime) / 1_000_000;
    console.error(`[Backend] ❌ Error (${(errorTime / 1000).toFixed(1)}s):`, err?.message || String(err));
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
      ((req.query.spamFilter as "off" | "soft" | "hard") ??
      process.env.SPAM_FILTER_MODE ??
      "hard") as any;

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
