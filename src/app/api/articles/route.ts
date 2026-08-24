import { NextRequest, NextResponse } from "next/server";
import { dbGetArticles, dbSaveArticles, dbClearArticles, isDbReady } from "@/lib/db";

// Article memory is stored server-side (Upstash Redis), keyed by project domain,
// so it is shared across every user working on the same project.

export async function GET(req: NextRequest) {
  const domain = (req.nextUrl.searchParams.get("domain") || "").trim();
  if (!domain) return NextResponse.json({ error: "domain required" }, { status: 400 });
  try {
    const articles = await dbGetArticles(domain);
    return NextResponse.json({ articles, ready: isDbReady() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Load failed", articles: [], ready: isDbReady() }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const domain = String(body.domain || "").trim();
  if (!domain) return NextResponse.json({ error: "domain required" }, { status: 400 });
  if (!isDbReady()) return NextResponse.json({ ready: false, articles: [] }, { status: 200 });
  try {
    const items = Array.isArray(body.articles) ? body.articles : [];
    const merged = await dbSaveArticles(domain, items, !!body.published);
    return NextResponse.json({ articles: merged, ready: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Save failed", ready: true }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const domain = (req.nextUrl.searchParams.get("domain") || "").trim();
  if (!domain) return NextResponse.json({ error: "domain required" }, { status: 400 });
  try {
    await dbClearArticles(domain);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Clear failed" }, { status: 500 });
  }
}
