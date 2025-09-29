import { Router } from "express";
import { getLast20Transfers } from "../services/txs.service";

const router = Router();

// GET /api/portfolio/txs/:address?type=income|expense|swap
router.get("/txs/:address", async (req, res) => {
  const address = String(req.params.address || "").trim();
  if (!address) {
    return res.status(400).json({
      error: { code: "BadRequest", message: "Address is required" },
    });
  }

  const type =
    (req.query.type as "income" | "expense" | "swap" | undefined) || undefined;
  const kind =
    (req.query.kind as "all" | "transactions" | "tokens" | undefined) ||
    undefined;

  try {
    const data = await getLast20Transfers(address, type, kind);
    return res.json(data);
  } catch (e) {
    return res.status(502).json({
      error: { code: "UpstreamError", message: "Failed to fetch transfers" },
    });
  }
});

export default router;
