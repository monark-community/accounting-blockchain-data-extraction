-- Add wallet_address column to users table for Web3Auth users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS wallet_address TEXT UNIQUE;

-- Create index for faster lookups by wallet address
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address) WHERE wallet_address IS NOT NULL;

