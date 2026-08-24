// Shared HTML-parsing utilities used by multiple API routes

export function cleanText(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ").trim();
}

export async function fetchHtml(url: string): Promise<{ html: string | null; status: number; finalUrl: string }> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
      },
      signal: AbortSignal.timeout(12000),
      redirect: "follow",
    });
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("html") && !ct.includes("text")) return { html: null, status: res.status, finalUrl: res.url };
    const html = await res.text();
    return { html, status: res.status, finalUrl: res.url };
  } catch {
    return { html: null, status: 0, finalUrl: url };
  }
}

export async function checkStatus(url: string): Promise<{ url: string; status: number; redirectTo: string | null }> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RankMind/1.0)" },
      signal: AbortSignal.timeout(8000),
      redirect: "manual",
    });
    const redirectTo = res.status >= 300 && res.status < 400 ? (res.headers.get("location") || null) : null;
    return { url, status: res.status, redirectTo };
  } catch {
    return { url, status: 0, redirectTo: null };
  }
}

export function extractMeta(head: string, name: string): string {
  return (
    head.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["']`, "i"))?.[1] ||
    head.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${name}["']`, "i"))?.[1] ||
    ""
  );
}

export function extractLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*(.*?)\s*<\/loc>/gi)].map(m => m[1].trim()).filter(Boolean);
}

export async function fetchText(url: string): Promise<string | null> {
  try {
    // Full browser UA — a bot-like UA (e.g. "RankMind/1.0") gets intermittently challenged by
    // Cloudflare/WAFs, which was causing sitemap fetches to fail and the crawl to see 1 URL.
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function getSitemapUrls(base: string, limit = 30): Promise<string[]> {
  // Fetch robots.txt and default sitemap paths in parallel
  const candidates = [
    `${base}/sitemap.xml`,
    `${base}/sitemap_index.xml`,
    `${base}/sitemap-index.xml`,
  ];

  const [robotsText, ...sitemapResults] = await Promise.allSettled([
    fetchText(`${base}/robots.txt`),
    ...candidates.map(u => fetchText(u)),
  ]);

  // Collect any extra sitemap URLs from robots.txt
  let extraSitemaps: string[] = [];
  if (robotsText.status === "fulfilled" && robotsText.value) {
    extraSitemaps = [...robotsText.value.matchAll(/^Sitemap:\s*(.+)$/gim)].map(m => m[1].trim());
  }

  // Build map of url → xml for sitemap candidates we already have
  const xmlMap = new Map<string, string>();
  sitemapResults.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value?.includes("<loc>")) {
      xmlMap.set(candidates[i], r.value);
    }
  });

  // Fetch any extra sitemaps from robots.txt that weren't already fetched
  const newExtras = extraSitemaps.filter(u => !xmlMap.has(u));
  if (newExtras.length > 0) {
    const extraResults = await Promise.allSettled(newExtras.map(u => fetchText(u)));
    extraResults.forEach((r, i) => {
      if (r.status === "fulfilled" && r.value?.includes("<loc>")) {
        xmlMap.set(newExtras[i], r.value);
      }
    });
  }

  const urls: string[] = [];

  // Process valid sitemaps — prioritise robots.txt-listed ones first
  const orderedUrls = [...extraSitemaps, ...candidates].filter(u => xmlMap.has(u));
  for (const smUrl of orderedUrls) {
    const xml = xmlMap.get(smUrl)!;
    const locs = extractLocs(xml);
    if (locs.length === 0) continue;

    if (xml.includes("<sitemapindex")) {
      // Fetch child sitemaps in parallel (prefer page/post sitemaps over image/category ones)
      const ordered = [...locs].sort((a, b) => (/(post|page|blog|product)/i.test(b) ? 1 : 0) - (/(post|page|blog|product)/i.test(a) ? 1 : 0));
      const childResults = await Promise.allSettled(ordered.slice(0, 6).map(c => fetchText(c)));
      for (const cr of childResults) {
        if (cr.status === "fulfilled" && cr.value) {
          urls.push(...extractLocs(cr.value).filter(u => sameHost(u, base)));
        }
        if (urls.length >= limit) break;
      }
    } else {
      urls.push(...locs.filter(u => sameHost(u, base)));
    }
    if (urls.length > 0) break;
  }

  // Fallback: scrape homepage hrefs
  if (urls.length === 0) {
    const html = await fetchText(base);
    if (html) {
      for (const m of html.matchAll(/href=["']([^"'#?][^"']*?)["']/gi)) {
        const href = m[1];
        if (href.startsWith("/") && href.length > 1) urls.push(`${base}${href.split("?")[0].split("#")[0]}`);
        else if (sameHost(href, base)) urls.push(href.split("?")[0].split("#")[0]);
      }
    }
  }

  const seen = new Set<string>();
  return urls
    .map(u => u.replace(/\/$/, "") || base)
    .filter(u => { if (!sameHost(u, base) || seen.has(u)) return false; seen.add(u); return true; })
    .slice(0, limit);
}

function sameHost(url: string, base: string): boolean {
  // www-insensitive: sitemaps commonly list www.* URLs even when the site is entered without
  // www (or vice-versa). A strict compare silently dropped every child-sitemap URL → 1-URL crawls.
  try { return new URL(url).hostname.replace(/^www\./, "") === new URL(base).hostname.replace(/^www\./, ""); } catch { return false; }
}

export function parsePage(html: string, url: string, keyword = "") {
  const kw = keyword.toLowerCase().trim();
  const head = html.match(/<head[\s\S]*?<\/head>/i)?.[0] || "";
  const bodyRaw = html
    .replace(/<head[\s\S]*?<\/head>/i, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "");

  const title = cleanText(head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
  const metaDesc = extractMeta(head, "description");
  const metaRobots = extractMeta(head, "robots");
  const canonical =
    head.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i)?.[1] ||
    head.match(/<link[^>]+href=["']([^"']*)["'][^>]+rel=["']canonical["']/i)?.[1] || "";

  const h1s = [...bodyRaw.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => cleanText(m[1]));
  const h2s = [...bodyRaw.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map(m => cleanText(m[1])).slice(0, 8);

  const bodyText = cleanText(bodyRaw).toLowerCase();
  const words = bodyText.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  const imgTags = [...bodyRaw.matchAll(/<img[^>]+>/gi)];
  const imgsWithoutAlt = imgTags.filter(m => !/alt=["'][^"']+["']/i.test(m[0])).length;

  const baseHost = (() => { try { return new URL(url).hostname; } catch { return ""; } })();
  const allLinks = [...bodyRaw.matchAll(/href=["']([^"']+)["']/gi)].map(m => m[1]);
  const internalLinks = allLinks.filter(h => h.startsWith("/") || (() => { try { return new URL(h).hostname === baseHost; } catch { return false; } })()).length;
  const externalLinks = allLinks.filter(h => { if (!h.startsWith("http")) return false; try { return new URL(h).hostname !== baseHost; } catch { return false; } }).length;

  const schemaTypes = [...new Set([...html.matchAll(/"@type"\s*:\s*"([^"]+)"/gi)].map(m => m[1]))];

  const kwInTitle = !!kw && title.toLowerCase().includes(kw);
  const kwInMeta = !!kw && metaDesc.toLowerCase().includes(kw);
  const kwInH1 = !!kw && h1s.some(h => h.toLowerCase().includes(kw));
  const kwInUrl = !!kw && url.toLowerCase().includes(kw.replace(/\s+/g, "-"));
  const kwInBody = !!kw && bodyText.includes(kw);
  const kwInFirst100 = !!kw && words.slice(0, 100).join(" ").includes(kw);
  const kwCount = kw ? (bodyText.match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length : 0;
  const kwDensity = wordCount > 0 && kwCount > 0 ? ((kwCount / wordCount) * 100).toFixed(2) : "0.00";

  return {
    title, titleLength: title.length,
    metaDesc, metaDescLength: metaDesc.length,
    metaRobots, noindex: metaRobots.toLowerCase().includes("noindex"),
    canonical,
    h1: h1s[0] || "", h1Count: h1s.length, h2s,
    wordCount, imgCount: imgTags.length, imgsWithoutAlt,
    internalLinks, externalLinks,
    schemaTypes,
    kwInTitle, kwInMeta, kwInH1, kwInUrl, kwInBody, kwInFirst100,
    kwCount, kwDensity,
  };
}
