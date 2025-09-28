import { Router } from "express";
import {
  getHoldings,
  getOverview,
  getTokenForAddress,
} from "../services/portfolio.service";

const router = Router();

router.get("/holdings/:address", async (req, res) => {
  const address = String(req.params.address || "").trim();
  if (!address) {
    return res
      .status(400)
      .json({ error: { code: "BadRequest", message: "Address is required" } });
  }
  try {
    const data = await getHoldings(address);
    return res.json(data);
  } catch (e: any) {
    if (e?.code === "WalletNotFound") {
      return res
        .status(404)
        .json({ error: { code: "NotFound", message: "Wallet not found" } });
    }
    return res.status(500).json({
      error: { code: "InternalError", message: "Something went wrong" },
    });
  }
});

router.get("/overview/:address", async (req, res) => {
  const address = String(req.params.address || "").trim();
  if (!address)
    return res
      .status(400)
      .json({ error: { code: "BadRequest", message: "Address is required" } });

  try {
    const data = await getOverview(address);

    const minUsd = Math.max(0, Number(req.query.minUsd ?? 0) || 0);
    const holdings = (data.holdings || []).filter(
      (h) => (h.valueUsd ?? 0) >= minUsd
    );
    holdings.sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));

    const totalValueUsd = holdings.reduce((s, h) => s + (h.valueUsd ?? 0), 0);
    const allocation = holdings
      .map((h) => ({
        symbol: h.symbol || "(unknown)",
        valueUsd: h.valueUsd ?? 0,
        weightPct: totalValueUsd
          ? ((h.valueUsd ?? 0) / totalValueUsd) * 100
          : 0,
      }))
      .sort((a, b) => b.valueUsd - a.valueUsd);

    const topHoldings = allocation.slice(0, 10);

    return res.json({
      ...data,
      kpis: { ...data.kpis, totalValueUsd }, // keep 24h as-is for now
      holdings,
      allocation,
      topHoldings,
    });
  } catch (e: any) {
    if (e?.code === "WalletNotFound") {
      return res
        .status(404)
        .json({ error: { code: "NotFound", message: "Wallet not found" } });
    }
    return res.status(500).json({
      error: { code: "InternalError", message: "Something went wrong" },
    });
  }
});

router.get("/token/:address", async (req, res) => {
  const address = String(req.params.address || "").trim();
  const contract =
    typeof req.query.contract === "string" ? req.query.contract : undefined;
  const symbol =
    typeof req.query.symbol === "string" ? req.query.symbol : undefined;
  if (!address)
    return res
      .status(400)
      .json({ error: { code: "BadRequest", message: "Address is required" } });
  if (!contract && !symbol)
    return res.status(400).json({
      error: {
        code: "BadRequest",
        message: "Provide ?contract=0x... or ?symbol=...",
      },
    });

  try {
    const data = await getTokenForAddress({ address, contract, symbol });
    return res.json(data);
  } catch (e: any) {
    const msg = e?.message || "Something went wrong";
    const code = e?.code === "BadRequest" ? 400 : 500;
    return res
      .status(code)
      .json({ error: { code: e?.code || "InternalError", message: msg } });
  }
});

export default router;
