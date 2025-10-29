import "dotenv/config";
import express from "express";
import cors from "cors";
import mfaRoutes from "./routes/mfa.routes";
import authRoutes from "./routes/auth.routes";
import walletRoutes from "./routes/wallet.routes";
import cookieParser from "cookie-parser";
import healthRouter from "./routes/health.routes";
import holdingsRouter from "./routes/holdings.routes";
import portfolioRoutes from "./routes/portfolio.routes";
import transactionsRouter from "./routes/transactions.routes";
const app = express();
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser(process.env.SESSION_SECRET!));

app.use("/api/health", healthRouter); // → /api/health/ping
app.use("/api/auth", authRoutes);
app.use("/api/wallets", walletRoutes);
app.use("/api/mfa", mfaRoutes);
app.use("/api/portfolio", portfolioRoutes);
app.use("/api/holdings", holdingsRouter); // → /api/holdings/:address
app.use("/api/transactions", transactionsRouter); // → /api/transactions/:address

const PORT = process.env.PORT ?? "8080";
app.listen(PORT, () => {
  console.log(`[backend] listening on :${PORT}`);
});
