// backend/src/utils/jwt.ts
import jwt from "jsonwebtoken";

const SESSION_SECRET = process.env.SESSION_SECRET!;
const SESSION_TTL_SECONDS = Number(
  process.env.SESSION_TTL_SECONDS || 60 * 60 * 24 * 7
); // 7d default

type SessionPayload = { sub: string }; // sub = userId

export function signSession(userId: string): string {
  return jwt.sign({ sub: userId } satisfies SessionPayload, SESSION_SECRET, {
    expiresIn: SESSION_TTL_SECONDS,
  });
}

export function verifySession(token: string): { userId: string } {
  const decoded = jwt.verify(token, SESSION_SECRET) as jwt.JwtPayload;
  if (!decoded || typeof decoded.sub !== "string")
    throw new Error("Invalid session");
  return { userId: decoded.sub };
}
