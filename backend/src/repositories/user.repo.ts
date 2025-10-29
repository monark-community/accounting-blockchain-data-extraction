import { pool } from "../db/pool";

export type UserRow = {
  wallet_address: string;
  name: string;
  created_at: string;
  updated_at: string;
};

// Find user by wallet address
export async function findUserByWalletAddress(address: string): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>(
    `SELECT wallet_address, name, created_at, updated_at 
     FROM users WHERE wallet_address = $1 LIMIT 1`,
    [address.toLowerCase()]
  );
  return rows[0] ?? null;
}

// Find or create user by wallet address (for Web3Auth and MetaMask login)
export async function findOrCreateUserByWallet(
  address: string,
  userInfo?: { name?: string }
): Promise<UserRow> {
  // Try to find existing user by wallet_address
  const existing = await findUserByWalletAddress(address);
  if (existing) {
    return existing;
  }

  // Create new user
  const name = userInfo?.name || `User ${address.slice(0, 6)}`;
  
  const { rows } = await pool.query<UserRow>(
    `INSERT INTO users (wallet_address, name)
     VALUES ($1, $2)
     RETURNING wallet_address, name, created_at, updated_at`,
    [address.toLowerCase(), name]
  );
  
  return rows[0];
}

