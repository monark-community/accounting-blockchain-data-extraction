-- Table pour stocker les portefeuilles liés aux utilisateurs
CREATE TABLE IF NOT EXISTS user_wallets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  address       TEXT NOT NULL,
  chain_id      INTEGER NOT NULL DEFAULT 1,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_address UNIQUE (user_id, address)
);

-- Index pour recherche rapide par utilisateur
CREATE INDEX IF NOT EXISTS idx_user_wallets_user_id ON user_wallets(user_id);

-- Index pour recherche rapide par adresse
CREATE INDEX IF NOT EXISTS idx_user_wallets_address ON user_wallets(address);

