import "dotenv/config";
import express from "express";
import cors from "cors";
import mfaRoutes from "./routes/mfa.routes";
import cookieParser from "cookie-parser";
import healthRouter from "./routes/health.routes";
import portfolioRoutes from "./routes/portfolio.routes";
import txsRouter from "./routes/txs.routes";

const app = express();
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser(process.env.SESSION_SECRET!));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "backend", time: new Date().toISOString() });
});

app.use("/api/health", healthRouter);

app.use("/api/mfa", mfaRoutes);

app.use("/api/portfolio", portfolioRoutes);

app.use("/api/portfolio", txsRouter);

const PORT = process.env.PORT ?? "8080";
app.listen(PORT, () => {
  console.log(`[backend] listening on :${PORT}`);
});
