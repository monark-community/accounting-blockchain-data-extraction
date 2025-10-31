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

/**
 * Find or create user by wallet address (for Web3Auth and MetaMask login)
 * This function will:
 * 1. Check if user exists by wallet_address
 * 2. If not found, create a new user
 * 3. Return the user (existing or newly created)
 * Note: After account deletion, this will create a new user with the same wallet address
 */
export async function findOrCreateUserByWallet(
  address: string,
  userInfo?: { name?: string }
): Promise<UserRow> {
  // Normalize address to lowercase for consistent lookups
  const normalizedAddress = address.toLowerCase();
  
  // Try to find existing user by wallet_address
  const existing = await findUserByWalletAddress(normalizedAddress);
  if (existing) {
    return existing;
  }

  // User doesn't exist, create new user
  const name = userInfo?.name || `User ${normalizedAddress.slice(0, 6)}`;
  
  try {
    const { rows } = await pool.query<UserRow>(
      `INSERT INTO users (wallet_address, name)
       VALUES ($1, $2)
       RETURNING wallet_address, name, created_at, updated_at`,
      [normalizedAddress, name]
    );
    
    if (rows.length === 0) {
      throw new Error('Failed to create user');
    }
    
    return rows[0];
  } catch (error: any) {
    // If insertion fails due to primary key constraint (shouldn't happen after deletion),
    // try to fetch again in case another process created the user
    if (error.code === '23505') { // PostgreSQL unique violation
      const retryExisting = await findUserByWalletAddress(normalizedAddress);
      if (retryExisting) {
        return retryExisting;
      }
    }
    throw error;
  }
}

/**
 * Update user name
 * @param walletAddress - The wallet address of the user
 * @param name - The new name for the user
 * @returns Updated user or null if user not found
 */
export async function updateUserName(walletAddress: string, name: string): Promise<UserRow | null> {
  if (!name || name.trim().length === 0) {
    throw new Error('Name cannot be empty');
  }

  const { rows } = await pool.query<UserRow>(
    `UPDATE users 
     SET name = $1, updated_at = NOW()
     WHERE wallet_address = $2
     RETURNING wallet_address, name, created_at, updated_at`,
    [name.trim(), walletAddress.toLowerCase()]
  );
  
  return rows[0] ?? null;
}

/**
 * Delete user account and all related data
 * This will also delete all related wallets in user_wallets table due to CASCADE constraint
 * @param walletAddress - The main wallet address of the user to delete
 * @returns true if user was deleted, false if user not found
 */
export async function deleteUserAccount(walletAddress: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM users WHERE wallet_address = $1`,
    [walletAddress.toLowerCase()]
  );
  
  // Note: user_wallets will be automatically deleted due to ON DELETE CASCADE
  return rowCount > 0;
}

