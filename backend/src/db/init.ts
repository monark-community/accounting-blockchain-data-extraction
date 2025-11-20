// backend/src/db/init.ts
// Database initialization - runs SQL migration files on startup

import { pool } from "./pool";
import { readFileSync } from "fs";
import { join } from "path";

// Path to SQL files: from dist/db/init.js, go up to app root, then to db/init
const INIT_DIR = join(__dirname, "../../db/init");

// SQL files to run in order
const MIGRATION_FILES = [
  "001_schemaTest.sql",
  "002_users.sql",
  "003_wallets.sql",
  "004_mfa.sql",
  "005_add_wallet_address.sql",
];

/**
 * Initialize database schema by running all migration SQL files
 * This is idempotent - safe to run multiple times
 */
export async function initializeDatabase(): Promise<void> {
  console.log("[db/init] Starting database initialization...");

  try {
    // Test connection first
    await pool.query("SELECT NOW()");
    console.log("[db/init] Database connection verified");

    // Run each migration file in order
    for (const filename of MIGRATION_FILES) {
      const filePath = join(INIT_DIR, filename);
      
      try {
        console.log(`[db/init] Running migration: ${filename}`);
        const sql = readFileSync(filePath, "utf-8");
        
        // Execute the SQL (may contain multiple statements)
        await pool.query(sql);
        
        console.log(`[db/init] ✓ Completed: ${filename}`);
      } catch (error: any) {
        // Log error but continue - some errors are expected (e.g., column already exists)
        // PostgreSQL error codes: 42P07 = duplicate_table, 42701 = duplicate_column
        const isSafeError = 
          error?.code === "42P07" || // duplicate_table
          error?.code === "42701" || // duplicate_column
          error?.code === "42P16" || // invalid_table_definition (might occur with IF NOT EXISTS)
          (error instanceof Error && (
            error.message.toLowerCase().includes("already exists") ||
            error.message.toLowerCase().includes("duplicate") ||
            (error.message.toLowerCase().includes("column") && error.message.toLowerCase().includes("already"))
          ));

        if (isSafeError) {
          console.log(`[db/init] ⚠ Skipped ${filename} (already applied): ${error?.message || error}`);
        } else {
          // For other errors, log but don't fail completely
          console.warn(`[db/init] ⚠ Warning in ${filename}:`, error?.message || error);
        }
      }
    }

    console.log("[db/init] Database initialization completed");
  } catch (error) {
    console.error("[db/init] Database initialization failed:", error);
    // Don't throw - let the app start anyway (might be connection issues)
    // The app will fail later if tables are actually missing
  }
}

