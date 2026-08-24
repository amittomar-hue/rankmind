import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const domain = (req.nextUrl.searchParams.get("domain") || "").trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!domain) return NextResponse.json({ error: "No domain" }, { status: 400 });
  // Optional path (e.g. "llms.txt") so the same route can verify other root files.
  const path = (req.nextUrl.searchParams.get("path") || "robots.txt").replace(/^\/+/, "");

  try {
    const r = await fetch(`https://${domain}/${path}`, {
      headers: { "User-Agent": "RankMindBot/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    const raw = r.ok ? await r.text() : "";
    // Guard against sites that serve their HTML 200 page for missing files.
    const looksHtml = /^\s*<(?:!doctype|html)/i.test(raw);
    const content = r.ok && !looksHtml ? raw : "";
    return NextResponse.json({ domain, path, content, status: r.status, found: r.ok && !looksHtml });
  } catch (e) {
    return NextResponse.json({ domain, content: "", found: false, error: e instanceof Error ? e.message : "Failed to fetch" });
  }
}
