import { Redis } from "@upstash/redis";
import crypto from "crypto";

export type DbUser = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
  lastActiveAt: string;
  queryCount: number;
  plan: string;
};

export type ActivityEvent = {
  id: string;
  userId: string;
  email: string;
  name: string;
  action: "signup" | "signin" | "tool_run";
  tool?: string;
  meta?: Record<string, unknown>;
  timestamp: string;
};

function createRedis(): Redis | null {
  const url = (process.env.UPSTASH_REDIS_REST_URL || "").trim().replace(/^["']|["']$/g, "");
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim().replace(/^["']|["']$/g, "");
  if (!url || !token) return null;
  return new Redis({ url, token });
}

let _redis: Redis | null | undefined;
export function getRedis(): Redis | null {
  if (_redis === undefined) _redis = createRedis();
  return _redis;
}

// ── Users ────────────────────────────────────────────────────────────────────

export async function dbCreateUser(user: Omit<DbUser, "createdAt" | "lastActiveAt" | "queryCount" | "plan">): Promise<DbUser> {
  const full: DbUser = { ...user, createdAt: new Date().toISOString(), lastActiveAt: new Date().toISOString(), queryCount: 0, plan: "free" };
  const r = getRedis();
  if (r) {
    await r.hset(`user:${full.id}`, full as unknown as Record<string, unknown>);
    await r.set(`email_to_id:${full.email}`, full.id);
    await r.sadd("users:all", full.id);
  }
  return full;
}

export async function dbGetUserByEmail(email: string): Promise<DbUser | null> {
  const r = getRedis();
  if (!r) return null;
  const userId = await r.get<string>(`email_to_id:${email}`);
  if (!userId) return null;
  const user = await r.hgetall(`user:${userId}`);
  if (!user) return null;
  return { ...user, queryCount: Number(user.queryCount ?? 0) } as DbUser;
}

export async function dbGetUserById(id: string): Promise<DbUser | null> {
  const r = getRedis();
  if (!r) return null;
  const user = await r.hgetall(`user:${id}`);
  if (!user) return null;
  return { ...user, queryCount: Number(user.queryCount ?? 0) } as DbUser;
}

export async function dbGetAllUsers(): Promise<DbUser[]> {
  const r = getRedis();
  if (!r) return [];
  const ids = await r.smembers("users:all") as string[];
  if (!ids.length) return [];
  const users = await Promise.all(ids.map(id => r.hgetall(`user:${id}`)));
  return users
    .filter(Boolean)
    .map(u => ({ ...u, queryCount: Number((u as Record<string, unknown>).queryCount ?? 0) })) as DbUser[];
}

export async function dbUpdateUser(id: string, patch: Partial<DbUser>): Promise<void> {
  const r = getRedis();
  if (!r) return;
  await r.hset(`user:${id}`, patch as unknown as Record<string, unknown>);
}

export async function dbIncrQueryCount(id: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  await r.hincrby(`user:${id}`, "queryCount", 1);
  await r.hset(`user:${id}`, { lastActiveAt: new Date().toISOString() } as unknown as Record<string, unknown>);
}

export async function dbDeleteUser(id: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  const user = await dbGetUserById(id);
  if (!user) return;
  await Promise.all([
    r.del(`user:${id}`),
    r.del(`email_to_id:${user.email}`),
    r.srem("users:all", id),
    r.del(`activity:user:${id}`),
  ]);
}

export async function dbUpdatePassword(email: string, passwordHash: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  const userId = await r.get<string>(`email_to_id:${email}`);
  if (userId) await r.hset(`user:${userId}`, { passwordHash } as unknown as Record<string, unknown>);
}

// ── Reset tokens ─────────────────────────────────────────────────────────────

export async function dbSetResetToken(token: string, email: string, expires: number): Promise<void> {
  const r = getRedis();
  if (!r) return;
  const ttl = Math.ceil((expires - Date.now()) / 1000);
  await r.setex(`reset:${token}`, ttl, JSON.stringify({ email, expires }));
}

export async function dbGetResetToken(token: string): Promise<{ email: string; expires: number } | null> {
  const r = getRedis();
  if (!r) return null;
  const raw = await r.get<unknown>(`reset:${token}`);
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : raw as { email: string; expires: number };
}

export async function dbDeleteResetToken(token: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  await r.del(`reset:${token}`);
}

// ── Activity ─────────────────────────────────────────────────────────────────

export async function dbLogActivity(event: Omit<ActivityEvent, "id">): Promise<void> {
  const r = getRedis();
  if (!r) return;
  const full: ActivityEvent = { ...event, id: crypto.randomUUID() };
  const json = JSON.stringify(full);
  await r.lpush("activity:all", json);
  await r.ltrim("activity:all", 0, 999);
  await r.lpush(`activity:user:${event.userId}`, json);
  await r.ltrim(`activity:user:${event.userId}`, 0, 99);
}

function parseEvent(raw: unknown): ActivityEvent | null {
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw as ActivityEvent;
  } catch { return null; }
}

export async function dbGetActivity(limit = 200): Promise<ActivityEvent[]> {
  const r = getRedis();
  if (!r) return [];
  const items = await r.lrange("activity:all", 0, limit - 1);
  return (items as unknown[]).map(parseEvent).filter(Boolean) as ActivityEvent[];
}

export async function dbGetUserActivity(userId: string, limit = 50): Promise<ActivityEvent[]> {
  const r = getRedis();
  if (!r) return [];
  const items = await r.lrange(`activity:user:${userId}`, 0, limit - 1);
  return (items as unknown[]).map(parseEvent).filter(Boolean) as ActivityEvent[];
}

export function isDbReady(): boolean {
  return getRedis() !== null;
}

// ── Per-user workspace state (so the view follows the account across browsers) ──
// Stores a flat map of synced localStorage keys (connected sites, projects, active
// site, tool history, WP settings) keyed by userId.
export async function dbGetUserState(userId: string): Promise<Record<string, string> | null> {
  const r = getRedis();
  if (!r) return null;
  const raw = await r.get<unknown>(`userstate:${userId}`);
  if (!raw) return null;
  try {
    const o = typeof raw === "string" ? JSON.parse(raw) : raw;
    return o && typeof o === "object" ? (o as Record<string, string>) : null;
  } catch { return null; }
}

export async function dbSaveUserState(userId: string, state: Record<string, string>): Promise<void> {
  const r = getRedis();
  if (!r) return;
  await r.set(`userstate:${userId}`, JSON.stringify(state));
}

// ── Article memory (shared per project, across all users) ──────────────────────
// Keyed by normalised domain so every user working on the same project sees the
// same remembered/published articles and dedups against them.

export type Article = { title: string; keyword?: string; slug?: string; date: string; published?: boolean };

function normDomain(d: string): string {
  return (d || "_").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export async function dbGetArticles(domain: string): Promise<Article[]> {
  const r = getRedis();
  if (!r) return [];
  const raw = await r.get<unknown>(`articles:${normDomain(domain)}`);
  if (!raw) return [];
  try {
    const arr = typeof raw === "string" ? JSON.parse(raw) : (raw as Article[]);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

export async function dbSaveArticles(
  domain: string,
  items: { title: string; keyword?: string; slug?: string }[],
  published = false,
): Promise<Article[]> {
  const r = getRedis();
  if (!r) return [];
  const key = `articles:${normDomain(domain)}`;
  const arr = await dbGetArticles(domain);
  const today = new Date().toISOString().slice(0, 10);
  for (const it of items) {
    if (!it?.title) continue;
    const ex = arr.find(a => a.title.toLowerCase() === it.title.toLowerCase());
    if (ex) { if (published) ex.published = true; if (it.slug && !ex.slug) ex.slug = it.slug; }
    else arr.push({ title: it.title, keyword: it.keyword || "", slug: it.slug, date: today, published });
  }
  const trimmed = arr.slice(-1000);
  await r.set(key, JSON.stringify(trimmed));
  return trimmed;
}

export async function dbClearArticles(domain: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  await r.del(`articles:${normDomain(domain)}`);
}
