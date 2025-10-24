import { Router } from "express";
import { getOverview, getHoldings } from "../services/portfolio.service";

const router = Router();

router.get("/holdings/:address", async (req, res) => {
  try {
    const { address } = req.params;
    const { chain, page, limit } = req.query;
    const data = await getHoldings(address, {
      chain: (chain as string) ?? "1",
      page: page ? parseInt(String(page), 10) : 1,
      limit: limit ? parseInt(String(limit), 10) : 20,
    });
    return res.json(data);
  } catch (e: any) {
    console.error("[/holdings] error:", e?.message || e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

router.get("/overview/:address", async (req, res) => {
  try {
    const { address } = req.params;
    const { chainId, minUsd } = req.query;
    const chainIdInput = (chainId as string) ?? "1"; // supports "1" or "0x1"
    const minUsdNum = minUsd ? parseFloat(String(minUsd)) : 0;

    const data = await getOverview(address, chainIdInput, minUsdNum);
    return res.json(data);
  } catch (e: any) {
    console.error("[/overview] error:", e?.message || e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

export default router;
