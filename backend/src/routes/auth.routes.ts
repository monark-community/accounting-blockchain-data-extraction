import { Router } from "express";
import { registerSchema } from "../schemas/auth.schema";
import { registerUser } from "../services/user.service";
import { loginSchema } from "../schemas/login.schema";
import { authenticateUser } from "../services/auth.service";
import { optionalAuth } from "../middleware/session";
import { findUserById } from "../repositories/user.repo";
import { pool } from "../db/pool";
import cookieParser from "cookie-parser";

const router = Router();
const SESSION_NAME = process.env.SESSION_NAME || "ll_session";
const isProd = process.env.NODE_ENV === "production";
const ttlMs =
  Number(process.env.SESSION_TTL_SECONDS || 60 * 60 * 24 * 7) * 1000;

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "ValidationError",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { name, email, password } = parsed.data;
    const user = await registerUser(name, email, password);

    return res.status(201).json({ user });
  } catch (e: any) {
    const status = e?.status || 500;
    const message = e?.message || "Internal Server Error";
    return res.status(status).json({ error: message });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "ValidationError",
      details: parsed.error.flatten().fieldErrors,
    });
  }
  try {
    const { email, password } = parsed.data;
    const user = await authenticateUser(email, password);

    const token = require("../utils/jwt").signSession(user.id);

    res.cookie(SESSION_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      signed: true,
      path: "/",
      maxAge: ttlMs,
    });

    return res.status(200).json({ user });
  } catch (e: any) {
    return res
      .status(e?.status || 401)
      .json({ error: "Invalid email or password" });
  }
});

// GET /api/auth/me
router.get("/me", optionalAuth, async (req, res) => {
  const u = (req as any).user;
  if (!u) return res.json({ user: null });
  const user = await findUserById(u.id);
  return res.json({ user });
});

// POST /api/auth/logout
router.post("/logout", (_req, res) => {
  res.clearCookie(SESSION_NAME, { path: "/" });
  return res.status(204).end();
});

// POST /api/auth/web3auth-session
// Create a backend session for Web3Auth users
router.post("/web3auth-session", async (req, res) => {
  try {
    const { address, userInfo } = req.body;

    if (!address) {
      return res.status(400).json({ error: "Wallet address is required" });
    }

    // Check if user exists by wallet address
    let { rows: existingUsers } = await pool.query(
      `SELECT id, name, email, wallet_address FROM users WHERE wallet_address = $1`,
      [address]
    );
    
    let user = existingUsers[0];
    
    if (!user) {
      // Create a new user for this Web3Auth address
      const name = userInfo?.name || userInfo?.email || 'Web3Auth User';
      const email = userInfo?.email || `${address}@web3auth.local`;
      
      // Insert user with a dummy password (Web3Auth users don't use passwords)
      const bcrypt = require('bcryptjs');
      const dummyPassword = await bcrypt.hash(Math.random().toString(), 10);
      
      const { rows } = await pool.query(
        `INSERT INTO users (name, email, password_hash, wallet_address)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, email, wallet_address`,
        [name, email, dummyPassword, address]
      );
      
      user = rows[0];
    }

    if (!user) {
      return res.status(500).json({ error: "Failed to create user" });
    }

    // Create session token
    const token = require("../utils/jwt").signSession(user.id);

    res.cookie(SESSION_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      signed: true,
      path: "/",
      maxAge: ttlMs,
    });

    return res.status(200).json({ user });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
