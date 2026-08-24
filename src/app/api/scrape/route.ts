import { NextRequest, NextResponse } from "next/server";

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RankMind/1.0; +https://rankmind-seven.vercel.app)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("text/html") || ct.includes("xml") || ct.includes("text/plain")) {
      return await res.text();
    }
    return null;
  } catch {
    return null;
  }
}

function extractLocs(xml: string): string[] {
  const matches = [...xml.matchAll(/<loc>\s*(.*?)\s*<\/loc>/gi)];
  return matches.map(m => m[1].trim()).filter(Boolean);
}

function sameHost(url: string, base: string): boolean {
  try {
    return new URL(url).hostname === new URL(base).hostname;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("domain");
  if (!raw) return NextResponse.json({ error: "No domain param" }, { status: 400 });

  const base = raw.startsWith("http") ? raw.replace(/\/$/, "") : `https://${raw.replace(/\/$/, "")}`;

  const urls: string[] = [];

  // 1. Discover sitemap URL from robots.txt
  let sitemapUrls: string[] = [];
  const robots = await fetchText(`${base}/robots.txt`);
  if (robots) {
    const found = [...robots.matchAll(/^Sitemap:\s*(.+)$/gim)].map(m => m[1].trim());
    sitemapUrls.push(...found);
  }

  // 2. Add fallback candidates
  sitemapUrls.push(
    `${base}/sitemap.xml`,
    `${base}/sitemap_index.xml`,
    `${base}/sitemap-index.xml`,
    `${base}/wp-sitemap.xml`,
    `${base}/post-sitemap.xml`,
    `${base}/page-sitemap.xml`,
  );

  // Deduplicate
  sitemapUrls = [...new Set(sitemapUrls)];

  for (const sitemapUrl of sitemapUrls) {
    const xml = await fetchText(sitemapUrl);
    if (!xml || !xml.includes("<loc>")) continue;

    const locs = extractLocs(xml);
    if (locs.length === 0) continue;

    // Sitemap index — fetch first 3 child sitemaps
    if (xml.includes("<sitemapindex") || xml.includes("sitemap-index")) {
      for (const child of locs.slice(0, 3)) {
        const childXml = await fetchText(child);
        if (childXml) {
          urls.push(...extractLocs(childXml).filter(u => sameHost(u, base)));
          if (urls.length >= 100) break;
        }
      }
    } else {
      urls.push(...locs.filter(u => sameHost(u, base)));
    }

    if (urls.length > 0) break;
  }

  // 3. Fallback — scrape homepage for internal links
  if (urls.length === 0) {
    const html = await fetchText(base);
    if (html) {
      for (const m of html.matchAll(/href=["']([^"'#?][^"']*?)["']/gi)) {
        const href = m[1];
        if (href.startsWith("/") && href.length > 1) {
          urls.push(`${base}${href.split("?")[0].split("#")[0]}`);
        } else if (sameHost(href, base)) {
          urls.push(href.split("?")[0].split("#")[0]);
        }
      }
    }
  }

  // Deduplicate, filter to same host, clean, limit to 60
  const seen = new Set<string>();
  const result = urls
    .map(u => u.replace(/\/$/, "") || base)
    .filter(u => {
      if (!sameHost(u, base)) return false;
      if (seen.has(u)) return false;
      seen.add(u);
      return true;
    })
    .slice(0, 60);

  return NextResponse.json({ urls: result, count: result.length });
}
