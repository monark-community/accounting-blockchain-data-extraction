import bcrypt from "bcryptjs";
import { findUserAuthByEmail } from "../repositories/user.auth.repo";

export type SafeUser = { id: string; name: string; email: string };

export async function authenticateUser(
  email: string,
  password: string
): Promise<SafeUser> {
  const user = await findUserAuthByEmail(email.toLowerCase());

  // Use a generic error so we don't leak which field failed
  const err = new Error("Invalid email or password");
  (err as any).status = 401;

  if (!user) throw err;

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw err;

  return { id: user.id, name: user.name, email: user.email };
}
