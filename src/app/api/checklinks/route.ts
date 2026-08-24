import { NextRequest, NextResponse } from "next/server";
import { checkStatus, getSitemapUrls } from "@/lib/page-parser";

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain");
  if (!domain) return NextResponse.json({ error: "No domain" }, { status: 400 });

  const base = domain.startsWith("http") ? domain.replace(/\/$/, "") : `https://${domain.replace(/\/$/, "")}`;

  let urls = await getSitemapUrls(base, 40);
  if (urls.length === 0) urls = [base];

  // HEAD-check all URLs in parallel (cap at 35)
  const results = await Promise.allSettled(
    urls.slice(0, 35).map(url => checkStatus(url))
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any[] = results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return { url: urls[i], status: 0, redirectTo: null };
  });

  const summary = {
    total: data.length,
    ok: data.filter(d => d.status >= 200 && d.status < 300 && !d.redirectTo).length,
    redirected: data.filter(d => d.redirectTo || (d.status >= 300 && d.status < 400)).length,
    broken: data.filter(d => d.status >= 400 || d.status === 0).length,
    server_error: data.filter(d => d.status >= 500).length,
  };

  const broken = data.filter(d => d.status >= 400 || d.status === 0);
  const redirected = data.filter(d => d.redirectTo || (d.status >= 300 && d.status < 400));

  return NextResponse.json({ scraped: true, summary, results: data, broken, redirected });
}
