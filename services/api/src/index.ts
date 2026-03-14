import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.routes";
import walletRoutes from "./routes/wallet.routes";
import transactionRoutes from "./routes/transaction.routes";
import reportRoutes from "./routes/report.routes";
import exportRoutes from "./routes/export.routes";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

/*
Health check
*/
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    message: "LedgerLift API is healthy"
  });
});

/*
Root route
*/
app.get("/", (req, res) => {
  res.json({
    message: "LedgerLift API is running"
  });
});

/*
API Routes
*/
app.use("/api/auth", authRoutes);
app.use("/api/wallets", walletRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/export", exportRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});