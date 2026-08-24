import { NextRequest, NextResponse } from "next/server";
import { dbGetAllUsers, dbGetActivity, dbGetUserActivity, dbDeleteUser, isDbReady } from "@/lib/db";

function checkAuth(req: NextRequest): boolean {
  const secret = (process.env.ADMIN_SECRET || "").trim();
  if (!secret) return false;
  const auth = (req.headers.get("authorization") || "").trim();
  return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const view = searchParams.get("view") || "overview";
  const userId = searchParams.get("userId");

  if (!isDbReady()) {
    return NextResponse.json({ error: "Database not configured. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to environment variables." }, { status: 503 });
  }

  try {
    if (view === "user_activity" && userId) {
      const activity = await dbGetUserActivity(userId, 100);
      return NextResponse.json({ activity });
    }

    const [users, activity] = await Promise.all([
      dbGetAllUsers(),
      dbGetActivity(200),
    ]);

    // Sort users newest first
    users.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Stats
    const now = Date.now();
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const activeToday = users.filter(u => u.lastActiveAt && new Date(u.lastActiveAt) >= todayStart).length;
    const totalQueries = users.reduce((s, u) => s + (u.queryCount || 0), 0);

    const toolCounts: Record<string, number> = {};
    for (const ev of activity) {
      if (ev.action === "tool_run" && ev.tool) {
        toolCounts[ev.tool] = (toolCounts[ev.tool] || 0) + 1;
      }
    }
    const topTool = Object.entries(toolCounts).sort((a, b) => b[1] - a[1])[0];
    const signupsToday = activity.filter(e => e.action === "signup" && new Date(e.timestamp) >= todayStart).length;

    return NextResponse.json({
      stats: {
        totalUsers: users.length,
        activeToday,
        totalQueries,
        topTool: topTool ? topTool[0] : "—",
        topToolCount: topTool ? topTool[1] : 0,
        signupsToday,
        toolCounts,
      },
      users: users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        plan: u.plan || "free",
        createdAt: u.createdAt,
        lastActiveAt: u.lastActiveAt,
        queryCount: u.queryCount || 0,
      })),
      activity: activity.slice(0, 100),
      dbReady: true,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isDbReady()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: "No userId" }, { status: 400 });
  try {
    await dbDeleteUser(userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
