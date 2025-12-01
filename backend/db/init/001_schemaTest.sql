-- Minimal ledger-like table to unblock endpoints
CREATE TABLE IF NOT EXISTS transactions (
  id            SERIAL PRIMARY KEY,
  hash          TEXT NOT NULL UNIQUE,
  from_address  TEXT,
  to_address    TEXT,
  amount        NUMERIC(38, 18),
  fee           NUMERIC(38, 18),
  symbol        TEXT,
  chain         TEXT,
  block_number  BIGINT,
  ts            TIMESTAMPTZ DEFAULT now()
);

-- Tiny seed so you can test quickly
INSERT INTO transactions (hash, from_address, to_address, amount, fee, symbol, chain, block_number)
VALUES ('0xdeadbeef', '0xabc', '0xdef', 123.45, 0.01, 'ETH', 'ethereum', 123456789)
ON CONFLICT (hash) DO NOTHING;

