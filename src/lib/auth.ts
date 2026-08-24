import { SignJWT, jwtVerify } from "jose";
import crypto from "crypto";
import {
  dbCreateUser, dbGetUserByEmail, dbGetUserById,
  dbSetResetToken, dbGetResetToken, dbDeleteResetToken, dbUpdatePassword,
  isDbReady,
} from "./db";

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || "rankmind-dev-secret-change-in-production"
);

type User = { id: string; email: string; name: string; passwordHash: string };

// In-memory fallback (used when Redis is not configured)
const _users = new Map<string, User>();
const _resetTokens = new Map<string, { email: string; expires: number }>();

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(`${password}:rankmind_salt_v1`).digest("hex");
}

export async function createUser(email: string, name: string, password: string) {
  const passwordHash = hashPassword(password);
  if (isDbReady()) {
    const existing = await dbGetUserByEmail(email);
    if (existing) throw new Error("An account with this email already exists");
    const user = await dbCreateUser({ id: crypto.randomUUID(), email, name, passwordHash });
    return { id: user.id, email: user.email, name: user.name };
  }
  // in-memory fallback
  if (_users.has(email)) throw new Error("An account with this email already exists");
  const id = crypto.randomUUID();
  _users.set(email, { id, email, name, passwordHash });
  return { id, email, name };
}

export async function authenticateUser(email: string, password: string) {
  const hash = hashPassword(password);
  if (isDbReady()) {
    const user = await dbGetUserByEmail(email);
    if (!user || user.passwordHash !== hash) throw new Error("Invalid email or password");
    return { id: user.id, email: user.email, name: user.name };
  }
  // in-memory fallback
  const user = _users.get(email);
  if (!user || user.passwordHash !== hash) throw new Error("Invalid email or password");
  return { id: user.id, email: user.email, name: user.name };
}

export async function getUserById(id: string) {
  if (isDbReady()) return dbGetUserById(id);
  for (const u of _users.values()) { if (u.id === id) return u; }
  return null;
}

export async function generateResetToken(email: string): Promise<string> {
  if (isDbReady()) {
    const user = await dbGetUserByEmail(email);
    if (!user) throw new Error("No account found with this email address");
  } else {
    if (!_users.has(email)) throw new Error("No account found with this email address");
    for (const [t, d] of _resetTokens.entries()) {
      if (d.expires < Date.now()) _resetTokens.delete(t);
    }
  }
  const token = crypto.randomBytes(3).toString("hex").toUpperCase();
  const expires = Date.now() + 15 * 60 * 1000;
  if (isDbReady()) {
    await dbSetResetToken(token, email, expires);
  } else {
    _resetTokens.set(token, { email, expires });
  }
  return token;
}

export async function resetPassword(email: string, token: string, newPassword: string): Promise<void> {
  if (newPassword.length < 8) throw new Error("Password must be at least 8 characters");
  const key = token.toUpperCase().trim();
  if (isDbReady()) {
    const data = await dbGetResetToken(key);
    if (!data || data.email !== email || data.expires < Date.now()) {
      throw new Error("Invalid or expired reset code. Please request a new one.");
    }
    await dbUpdatePassword(email, hashPassword(newPassword));
    await dbDeleteResetToken(key);
  } else {
    const data = _resetTokens.get(key);
    if (!data || data.email !== email || data.expires < Date.now()) {
      throw new Error("Invalid or expired reset code. Please request a new one.");
    }
    const user = _users.get(email);
    if (!user) throw new Error("Account not found");
    user.passwordHash = hashPassword(newPassword);
    _resetTokens.delete(key);
  }
}

export async function createSession(payload: { id: string; email: string; name: string }) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifySession(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { id: string; email: string; name: string };
  } catch {
    return null;
  }
}
