// backend/src/routes/health.routes.ts

import { Router } from "express";
import { currentNetwork } from "../utils/alchemy";

const router = Router();
router.get("/", (_req, res) => {
  res.json({
    ok: true,
    network: currentNetwork,
    env: process.env.ALCHEMY_NETWORK,
  });
});
export default router;
