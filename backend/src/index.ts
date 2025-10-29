import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import healthRouter from "./routes/health.routes";
import holdingsRouter from "./routes/holdings.routes";

const app = express();
app.use(cors());
app.use(express.json());
app.use(cookieParser(process.env.SESSION_SECRET!));

app.use("/api/health", healthRouter);

app.use("/api/holdings", holdingsRouter);

const PORT = process.env.PORT ?? "8080";
app.listen(PORT, () => {
  console.log(`[backend] listening on :${PORT}`);
});
