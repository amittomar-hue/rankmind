import { NextRequest, NextResponse } from "next/server";

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RankMind/1.0; +https://rankmind-seven.vercel.app)",
        "Accept": "application/rss+xml, application/xml, text/xml, application/json, */*",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function decodeHtml(str: string): string {
  return str
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'").replace(/&#x2F;/g, "/").replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)));
}

function stripTags(str: string): string {
  return str.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseRSS(xml: string, limit = 8) {
  const items: { title: string; url: string; source: string; date: string; snippet: string }[] = [];
  const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];

  for (const match of itemMatches.slice(0, limit)) {
    const content = match[1];

    const titleRaw =
      (content.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i) ||
       content.match(/<title>([\s\S]*?)<\/title>/i))?.[1]?.trim() ?? "";

    // Google News RSS wraps the real article URL in <link> after a CDATA comment
    const linkRaw =
      (content.match(/<link><!\[CDATA\[([\s\S]*?)\]\]><\/link>/i) ||
       content.match(/<link>([\s\S]*?)<\/link>/i))?.[1]?.trim() ?? "";

    const pubDate =
      (content.match(/<pubDate>([\s\S]*?)<\/pubDate>/i))?.[1]?.trim() ?? "";

    const sourceRaw =
      (content.match(/<source[^>]*>([\s\S]*?)<\/source>/i))?.[1]?.trim() ?? "News";

    const descRaw =
      (content.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i) ||
       content.match(/<description>([\s\S]*?)<\/description>/i))?.[1]?.trim() ?? "";

    const title = decodeHtml(stripTags(titleRaw));
    const url   = decodeHtml(linkRaw);
    const source = decodeHtml(stripTags(sourceRaw));
    const snippet = stripTags(decodeHtml(descRaw)).slice(0, 220);
    const date = pubDate
      ? (() => { try { return new Date(pubDate).toISOString().split("T")[0]; } catch { return ""; } })()
      : "";

    if (title && url) {
      items.push({ title, url, source, date, snippet });
    }
  }

  return items;
}

export async function GET(req: NextRequest) {
  const brand = req.nextUrl.searchParams.get("brand");
  if (!brand?.trim()) return NextResponse.json({ error: "No brand" }, { status: 400 });

  const encoded = encodeURIComponent(brand.trim());

  // Parallel fetch: Google News RSS + Bing News RSS (fallback) + Reddit
  const [googleXml, bingXml, redditText] = await Promise.all([
    fetchText(`https://news.google.com/rss/search?q=${encoded}&hl=en-US&gl=US&ceid=US:en`),
    fetchText(`https://feeds.news.yahoo.com/rss/search?p=${encoded}`),
    fetchText(`https://www.reddit.com/search.json?q=${encoded}&sort=new&limit=5&type=link`),
  ]);

  const mentions: { title: string; url: string; source: string; date: string; snippet: string }[] = [];

  // 1 — Google News (primary)
  if (googleXml?.includes("<item>")) {
    mentions.push(...parseRSS(googleXml, 7));
  }

  // 2 — Yahoo/Bing News (fallback if Google gave nothing)
  if (mentions.length === 0 && bingXml?.includes("<item>")) {
    mentions.push(...parseRSS(bingXml, 7));
  }

  // 3 — Reddit
  if (redditText) {
    try {
      const rd = JSON.parse(redditText);
      for (const post of (rd?.data?.children ?? []).slice(0, 4)) {
        const d = post.data;
        if (!d?.title) continue;
        mentions.push({
          title: decodeHtml(d.title),
          url: `https://reddit.com${d.permalink}`,
          source: `Reddit · r/${d.subreddit}`,
          date: d.created_utc
            ? new Date(d.created_utc * 1000).toISOString().split("T")[0]
            : "",
          snippet: (d.selftext || "").slice(0, 220),
        });
      }
    } catch { /* ignore */ }
  }

  return NextResponse.json({
    mentions,
    count: mentions.length,
    scraped: mentions.length > 0,
  });
}
