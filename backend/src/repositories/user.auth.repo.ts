import { pool } from "../db/pool";

export type UserAuthRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
};

export async function findUserAuthByEmail(
  email: string
): Promise<UserAuthRow | null> {
  const { rows } = await pool.query<UserAuthRow>(
    `SELECT id, name, email, password_hash, created_at, updated_at
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [email.toLowerCase()]
  );
  return rows[0] ?? null;
}
