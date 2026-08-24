import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { dbGetUserState, dbSaveUserState, isDbReady } from "@/lib/db";

// Per-user workspace state so connected sites/projects/settings follow the account
// across browsers. Authorized via the rm_session cookie (same as /api/auth/me).

async function userId(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get("rm_session")?.value;
  if (!token) return null;
  const user = await verifySession(token);
  return (user as { id?: string } | null)?.id || null;
}

// Upstash caps request size (~1MB). If the snapshot is too big, drop the heaviest,
// re-fetchable analytics maps first so projects/history/settings still sync.
const MAX_BYTES = 900_000;
const HEAVY_FIRST = ["rm_gsc_map", "rm_ga4_map"];
function fitToLimit(state: Record<string, string>): { state: Record<string, string>; dropped: string[] } {
  const dropped: string[] = [];
  const out = { ...state };
  let size = JSON.stringify(out).length;
  for (const k of HEAVY_FIRST) {
    if (size <= MAX_BYTES) break;
    if (out[k]) { size -= out[k].length; delete out[k]; dropped.push(k); }
  }
  // Still too big → drop the single largest remaining values until it fits.
  while (size > MAX_BYTES) {
    const largest = Object.keys(out).sort((a, b) => (out[b]?.length || 0) - (out[a]?.length || 0))[0];
    if (!largest) break;
    size -= (out[largest]?.length || 0); delete out[largest]; dropped.push(largest);
  }
  return { state: out, dropped };
}

export async function GET(req: NextRequest) {
  const id = await userId(req);
  if (!id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isDbReady()) return NextResponse.json({ state: null, ready: false });
  try {
    const state = await dbGetUserState(id);
    return NextResponse.json({ state, ready: true });
  } catch (e) {
    return NextResponse.json({ state: null, error: e instanceof Error ? e.message : "load failed" }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  const id = await userId(req);
  if (!id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isDbReady()) return NextResponse.json({ ok: false, ready: false });
  try {
    const body = await req.json().catch(() => ({}));
    const incoming = (body?.state && typeof body.state === "object") ? body.state as Record<string, string> : {};
    // Keep only string values (localStorage entries are strings).
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(incoming)) if (typeof v === "string") clean[k] = v;
    const { state, dropped } = fitToLimit(clean);
    await dbSaveUserState(id, state);
    return NextResponse.json({ ok: true, saved: Object.keys(state).length, dropped });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "save failed" }, { status: 500 });
  }
}
