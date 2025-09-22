import { pool } from "../db/pool";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  created_at: string;
  updated_at: string;
};

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>(
    `SELECT id, name, email, created_at, updated_at FROM users WHERE email = $1 LIMIT 1`,
    [email]
  );
  return rows[0] ?? null;
}

export async function insertUser(params: {
  name: string;
  email: string;
  passwordHash: string;
}): Promise<UserRow> {
  const { rows } = await pool.query<UserRow>(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, name, email, created_at, updated_at`,
    [params.name, params.email.toLowerCase(), params.passwordHash]
  );
  return rows[0];
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>(
    `SELECT id, name, email, created_at, updated_at FROM users WHERE id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}
