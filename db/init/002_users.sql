-- Enable UUID generation (required for gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- users table for account creation
CREATE TABLE IF NOT EXISTS users (
  wallet_address TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
