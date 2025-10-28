import { pool } from "../db/pool";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  created_at: string;
  updated_at: string;
};

// Only keep findUserById for MFA functionality
export async function findUserById(id: string): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>(
    `SELECT id, name, email, created_at, updated_at FROM users WHERE id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

