import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import cookieParser from "cookie-parser";

const app = express();
app.use(cors());
app.use(express.json());
app.use(cookieParser(process.env.SESSION_SECRET!));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "backend", time: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);

// Exemple d’endpoint placeholder
app.get("/api/transactions", (_req, res) => {
  res.json({ items: [], total: 0 });
});

const PORT = process.env.PORT ?? "8080";
app.listen(PORT, () => {
  console.log(`[backend] listening on :${PORT}`);
});
