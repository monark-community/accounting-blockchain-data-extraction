import bcrypt from "bcryptjs";
import {
  findUserByEmail,
  insertUser,
  UserRow,
} from "../repositories/user.repo";

export async function registerUser(
  name: string,
  email: string,
  password: string
): Promise<UserRow> {
  const existing = await findUserByEmail(email.toLowerCase());
  if (existing) {
    const err = new Error("Email already in use");
    (err as any).status = 409;
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await insertUser({ name, email, passwordHash });
  return user;
}
