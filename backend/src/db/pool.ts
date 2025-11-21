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
    console.error("[db] Full error:", err);
    // If hostname resolution fails, suggest checking region alignment
    if (err.code === 'ENOTFOUND' || err.message.includes('getaddrinfo')) {
      console.error("[db] DNS resolution failed. Check:");
      console.error("  1. Database and backend are in the same region");
      console.error("  2. Database is not paused");
      console.error("  3. Internal Database URL is correct in Render dashboard");
    }
  });
