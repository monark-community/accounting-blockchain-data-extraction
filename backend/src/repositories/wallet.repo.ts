import { pool } from "../db/pool";

export type UserWalletRow = {
  id: string;
  user_id: string;
  name: string;
  address: string;
  chain_id: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

// Trouver tous les portefeuilles actifs d'un utilisateur
export async function findUserWalletsByUserId(
  userId: string
): Promise<UserWalletRow[]> {
  const { rows } = await pool.query<UserWalletRow>(
    `SELECT id, user_id, name, address, chain_id, is_active, created_at, updated_at 
     FROM user_wallets 
     WHERE user_id = $1 AND is_active = TRUE 
     ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

// Trouver un portefeuille par son ID
export async function findWalletById(
  walletId: string
): Promise<UserWalletRow | null> {
  const { rows } = await pool.query<UserWalletRow>(
    `SELECT id, user_id, name, address, chain_id, is_active, created_at, updated_at 
     FROM user_wallets 
     WHERE id = $1 LIMIT 1`,
    [walletId]
  );
  return rows[0] ?? null;
}

// Trouver un portefeuille par son adresse et user_id
export async function findWalletByAddressAndUser(
  address: string,
  userId: string
): Promise<UserWalletRow | null> {
  const { rows } = await pool.query<UserWalletRow>(
    `SELECT id, user_id, name, address, chain_id, is_active, created_at, updated_at 
     FROM user_wallets 
     WHERE address = $1 AND user_id = $2 LIMIT 1`,
    [address.toLowerCase(), userId]
  );
  return rows[0] ?? null;
}

// Ajouter un nouveau portefeuille pour un utilisateur
export async function createUserWallet(data: {
  userId: string;
  name: string;
  address: string;
  chainId: number;
}): Promise<UserWalletRow> {
  const { rows } = await pool.query<UserWalletRow>(
    `INSERT INTO user_wallets (user_id, name, address, chain_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id, user_id, name, address, chain_id, is_active, created_at, updated_at`,
    [data.userId, data.name, data.address.toLowerCase(), data.chainId]
  );
  return rows[0];
}

// Désactiver un portefeuille (soft delete)
export async function deactivateUserWallet(walletId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE user_wallets 
     SET is_active = FALSE, updated_at = NOW() 
     WHERE id = $1`,
    [walletId]
  );
  return rowCount > 0;
}

// Supprimer définitivement un portefeuille
export async function deleteUserWallet(walletId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM user_wallets WHERE id = $1`,
    [walletId]
  );
  return rowCount > 0;
}

