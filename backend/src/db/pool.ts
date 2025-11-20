// backend/src/db/pool.ts

import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Log connection info (without password) for debugging
try {
  const url = new URL(connectionString);
  console.log(`[db] Connecting to database: ${url.hostname}:${url.port || 5432}/${url.pathname.slice(1)}`);
} catch (e) {
  console.warn("[db] Could not parse DATABASE_URL for logging");
}

export const pool = new Pool({
  connectionString,
});

// Handle pool errors
pool.on("error", (err) => {
  console.error("[db] Unexpected error on idle client:", err);
});

// Test connection on startup
pool.query("SELECT NOW()")
  .then(() => {
    console.log("[db] Database connection successful");
  })
  .catch((err) => {
    console.error("[db] Database connection failed:", err.message);
    console.error("[db] Connection string hostname:", connectionString ? new URL(connectionString).hostname : "N/A");
  });
