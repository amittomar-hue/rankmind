import { NextRequest, NextResponse } from "next/server";
import { fetchHtml, parsePage, getSitemapUrls } from "@/lib/page-parser";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain");
  if (!domain) return NextResponse.json({ error: "No domain" }, { status: 400 });

  const base = domain.startsWith("http") ? domain.replace(/\/$/, "") : `https://${domain.replace(/\/$/, "")}`;

  // Get real URLs from sitemap
  let urls = await getSitemapUrls(base, 15);
  if (urls.length === 0) urls = [base];

  // Fetch all pages in parallel
  const fetched = await Promise.allSettled(
    urls.slice(0, 12).map(async (url) => {
      const { html, status, finalUrl } = await fetchHtml(url);
      const isRedirect = finalUrl !== url && status >= 200 && status < 400;
      if (!html) return { url, status, isRedirect: status >= 300, title: "", metaDesc: "", h1: "", h1Count: 0, wordCount: 0, imgCount: 0, imgsWithoutAlt: 0, canonical: "", noindex: false, schemaTypes: [] as string[], internalLinks: 0, externalLinks: 0 };
      const p = parsePage(html, finalUrl || url);
      return { url, status, isRedirect, ...p };
    })
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pages: any[] = fetched
    .filter(r => r.status === "fulfilled")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map(r => (r as PromiseFulfilledResult<any>).value);

  const summary = {
    total: pages.length,
    ok: pages.filter(p => p.status >= 200 && p.status < 300 && !p.isRedirect).length,
    redirects: pages.filter(p => p.isRedirect || (p.status >= 300 && p.status < 400)).length,
    errors: pages.filter(p => p.status >= 400 || p.status === 0).length,
    missing_title: pages.filter(p => !p.title).length,
    short_title: pages.filter(p => p.title && p.titleLength < 30).length,
    long_title: pages.filter(p => p.titleLength > 60).length,
    missing_meta: pages.filter(p => !p.metaDesc).length,
    short_meta: pages.filter(p => p.metaDesc && p.metaDescLength < 70).length,
    missing_h1: pages.filter(p => p.h1Count === 0).length,
    multiple_h1: pages.filter(p => p.h1Count > 1).length,
    imgs_no_alt: pages.reduce((a, p) => a + (p.imgsWithoutAlt || 0), 0),
    noindex_pages: pages.filter(p => p.noindex).length,
    no_canonical: pages.filter(p => !p.canonical).length,
    thin_content: pages.filter(p => p.wordCount > 0 && p.wordCount < 300).length,
  };

  return NextResponse.json({ scraped: true, summary, pages, urls_checked: pages.length });
}
