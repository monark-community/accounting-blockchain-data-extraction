import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import cookieParser from "cookie-parser";
import healthRouter from "./routes/health.routes";
import portfolioRouter from "./routes/portfolio.routes";
import txsRouter from "./routes/txs.routes";

const app = express();
app.use(cors());
app.use(express.json());
app.use(cookieParser(process.env.SESSION_SECRET!));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "backend", time: new Date().toISOString() });
});

app.use("/api/health", healthRouter);

app.use("/api/auth", authRoutes);

app.use("/api/portfolio", portfolioRouter);

app.use("/api/portfolio", txsRouter);

const PORT = process.env.PORT ?? "8080";
app.listen(PORT, () => {
  console.log(`[backend] listening on :${PORT}`);
});
