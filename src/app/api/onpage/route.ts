import { NextRequest, NextResponse } from "next/server";
import { fetchHtml, parsePage } from "@/lib/page-parser";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  const keyword = req.nextUrl.searchParams.get("keyword") || "";
  if (!url) return NextResponse.json({ error: "No url" }, { status: 400 });

  const { html, status, finalUrl } = await fetchHtml(url);
  if (!html) return NextResponse.json({ scraped: false, status });

  const parsed = parsePage(html, finalUrl || url, keyword);
  return NextResponse.json({ scraped: true, status, finalUrl, ...parsed });
}
