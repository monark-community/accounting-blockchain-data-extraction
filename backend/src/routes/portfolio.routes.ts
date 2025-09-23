import { Router } from "express";
const router = Router();

// Skeleton: just echoes the address so we can test mounting.
router.get("/holdings/:address", (req, res) => {
  const { address } = req.params;
  return res.json({ ok: true, address });
});

export default router;
