import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import healthRouter from "./routes/health.routes";
import holdingsRouter from "./routes/holdings.routes";
import transactionsRouter from "./routes/transactions.routes";
import analyticsRouter from "./routes/analytics.routes";

const app = express();
app.use(cors());
app.use(express.json());
app.use(cookieParser(process.env.SESSION_SECRET!));

app.use("/api/health", healthRouter); // → /api/health/ping
app.use("/api/holdings", holdingsRouter); // → /api/holdings/:address
app.use("/api/transactions", transactionsRouter); // → /api/transactions/:address
app.use("/api/analytics", analyticsRouter); // → /api/analytics/historical/:address

const PORT = process.env.PORT ?? "8080";
app.listen(PORT, () => {
  console.log(`[backend] listening on :${PORT}`);
});
