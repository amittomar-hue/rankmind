import { NextRequest, NextResponse } from "next/server";
import { fetchSERP } from "@/lib/serp";

export async function GET(req: NextRequest) {
  const keyword = req.nextUrl.searchParams.get("keyword");
  if (!keyword) return NextResponse.json({ error: "No keyword" }, { status: 400 });

  try {
    const { results, source } = await fetchSERP(keyword);
    return NextResponse.json({ scraped: results.length > 0, results, source });
  } catch {
    return NextResponse.json({ scraped: false, results: [], source: "none" });
  }
}
