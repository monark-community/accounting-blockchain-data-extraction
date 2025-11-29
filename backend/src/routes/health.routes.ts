// backend/src/routes/health.routes.ts

import { Router } from "express";
import { currentNetwork } from "../utils/alchemy";

const router = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check for the API
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API is responsive
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 network:
 *                   type: string
 *                   nullable: true
 *                 env:
 *                   type: string
 *                   nullable: true
 */
router.get("/", (_req, res) => {
  res.json({
    ok: true,
    network: currentNetwork,
    env: process.env.ALCHEMY_NETWORK,
  });
});

export default router;
