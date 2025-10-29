import { pool } from "../db/pool";

export type UserWalletRow = {
  main_wallet_address: string;
  address: string;
  name: string;
  chain_id: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

// Trouver tous les portefeuilles secondaires actifs d'un utilisateur
// Note: Le wallet principal n'est PAS dans cette table, il est dans users
// On exclut explicitement le wallet principal si jamais il y était par erreur
export async function findUserWalletsByMainAddress(
  mainAddress: string
): Promise<UserWalletRow[]> {
  const normalizedMainAddress = mainAddress.toLowerCase();
  const { rows } = await pool.query<UserWalletRow>(
    `SELECT main_wallet_address, address, name, chain_id, is_active, created_at, updated_at 
     FROM user_wallets 
     WHERE main_wallet_address = $1 
       AND is_active = TRUE 
       AND address != $1
     ORDER BY created_at ASC`,
    [normalizedMainAddress]
  );
  return rows;
}

// Trouver un portefeuille par son adresse et main_wallet_address
export async function findWalletByAddressAndMain(
  address: string,
  mainAddress: string
): Promise<UserWalletRow | null> {
  const { rows } = await pool.query<UserWalletRow>(
    `SELECT main_wallet_address, address, name, chain_id, is_active, created_at, updated_at 
     FROM user_wallets 
     WHERE address = $1 AND main_wallet_address = $2 LIMIT 1`,
    [address.toLowerCase(), mainAddress.toLowerCase()]
  );
  return rows[0] ?? null;
}

// Ajouter un nouveau portefeuille pour un utilisateur
export async function createUserWallet(data: {
  mainWalletAddress: string;
  name: string;
  address: string;
  chainId: number;
}): Promise<UserWalletRow> {
  const { rows } = await pool.query<UserWalletRow>(
    `INSERT INTO user_wallets (main_wallet_address, address, name, chain_id)
     VALUES ($1, $2, $3, $4)
     RETURNING main_wallet_address, address, name, chain_id, is_active, created_at, updated_at`,
    [data.mainWalletAddress.toLowerCase(), data.address.toLowerCase(), data.name, data.chainId]
  );
  return rows[0];
}

// Désactiver un portefeuille (soft delete)
export async function deactivateUserWallet(mainAddress: string, address: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE user_wallets 
     SET is_active = FALSE, updated_at = NOW() 
     WHERE main_wallet_address = $1 AND address = $2`,
    [mainAddress.toLowerCase(), address.toLowerCase()]
  );
  return rowCount > 0;
}

// Supprimer définitivement un portefeuille
export async function deleteUserWallet(mainAddress: string, address: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM user_wallets 
     WHERE main_wallet_address = $1 AND address = $2`,
    [mainAddress.toLowerCase(), address.toLowerCase()]
  );
  return rowCount > 0;
}

// Mettre à jour le nom d'un portefeuille
export async function updateUserWalletName(
  mainAddress: string,
  address: string,
  name: string
): Promise<UserWalletRow | null> {
  const { rows } = await pool.query<UserWalletRow>(
    `UPDATE user_wallets 
     SET name = $3, updated_at = NOW() 
     WHERE main_wallet_address = $1 AND address = $2
     RETURNING main_wallet_address, address, name, chain_id, is_active, created_at, updated_at`,
    [mainAddress.toLowerCase(), address.toLowerCase(), name]
  );
  return rows[0] ?? null;
}

