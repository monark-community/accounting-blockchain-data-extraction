-- Table pour stocker les portefeuilles supplémentaires des utilisateurs
CREATE TABLE IF NOT EXISTS user_wallets (
  main_wallet_address        TEXT NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  address                    TEXT NOT NULL,
  name                       TEXT NOT NULL,
  chain_id                   INTEGER NOT NULL DEFAULT 1,
  is_active                  BOOLEAN DEFAULT TRUE,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (main_wallet_address, address)
);

-- Index pour recherche rapide par wallet principal
CREATE INDEX IF NOT EXISTS idx_user_wallets_main_address ON user_wallets(main_wallet_address);

-- Index pour recherche rapide par adresse
CREATE INDEX IF NOT EXISTS idx_user_wallets_address ON user_wallets(address);


