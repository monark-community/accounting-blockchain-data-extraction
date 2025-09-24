import { Router } from "express";
import { getHoldings } from "../services/portfolio.service";
import { getOverview } from "../services/portfolio.service";

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
  if (!address) {
    return res
      .status(400)
      .json({ error: { code: "BadRequest", message: "Address is required" } });
  }
  try {
    const data = await getOverview(address);
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

export default router;
