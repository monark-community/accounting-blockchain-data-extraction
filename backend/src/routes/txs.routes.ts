import { Router } from "express";
import { getLast20Transfers } from "../services/txs.service";

const router = Router();

// GET /api/portfolio/txs/:address?kind=all|transactions|tokens&type=income|expense|swap|gas&cursor=...&limit=20
router.get("/txs/:address", async (req, res) => {
  const address = String(req.params.address || "").trim();
  if (!address) {
    return res.status(400).json({
      error: { code: "BadRequest", message: "Address is required" },
    });
  }

  const kind =
    (req.query.kind as "all" | "transactions" | "tokens" | undefined) || "all";

  const type =
    (req.query.type as "income" | "expense" | "swap" | "gas" | undefined) ||
    undefined;

  const cursor = (req.query.cursor as string) || null;
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));

  try {
    // make sure your service signature matches: (address, type, kind, cursor, limit)
    const data = await getLast20Transfers(address, type, kind, cursor, limit);
    return res.json(data);
  } catch (e: any) {
    return res.status(502).json({
      error: {
        code: "UpstreamError",
        message: e?.message || "Failed to fetch transfers",
      },
    });
  }
});

export default router;
