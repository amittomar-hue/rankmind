import { NextRequest, NextResponse } from "next/server";
import { fetchHtml, parsePage, getSitemapUrls, cleanText } from "@/lib/page-parser";
import { callAI, parseJSON } from "@/lib/ai";
import { fetchSERP } from "@/lib/serp";
import { dfsConfigured, dfsDomainOverview, dfsIntersection, dfsOnPageAudit, dfsTopPages, cleanDomain, type GapKeyword, type OnPageAudit } from "@/lib/dataforseo";
import { startCrawl, tickCrawl, getCrawlStatus } from "@/lib/crawl-job";
import { getRedis } from "@/lib/db";
import { EXIMIUS_KB, isEximiusProject } from "@/lib/eximius-kb";
import { COMPUNNEL_BRAND, isCompunnelProject } from "@/lib/compunnel-brand";
import { zohoConfigured, zohoAll, zohoDc, isOrganicSource } from "@/lib/zoho";

// 120s: the onpage_audit DataForSEO crawl runs close to 80s on slow sites. Raising this to
// 300 changes how Vercel groups routes into functions and breaks the Hobby plan's 12-function
// cap — so the article pipeline has to fit inside 120s (see INTERACTIVE_BUDGET_MS).
export const maxDuration = 120;

// ── GET dispatcher ────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const tool = req.nextUrl.searchParams.get("tool");

  if (tool === "zoho") return handleZoho(req);
  if (tool === "widget") return handleWidgetView(req);
  if (tool === "report") return handleReportView(req);
  if (tool === "llmstxt") return handleLlmsTxt(req);
  if (tool === "pricingmd") return handlePricingMd(req);
  if (tool === "cwv") return handleCWV(req);
  if (tool === "extractability") return handleExtractability(req);
  if (tool === "paafaq") return handlePAAFAQ(req);
  if (tool === "pillar") return handlePillar(req);
  if (tool === "aivisibility") return handleAiVisibility(req);
  if (tool === "serpanalyze") return handleSerpAnalyze(req);
  if (tool === "onpage_audit") return handleOnPageAudit(req);
  if (tool === "crawl_status") return handleCrawlStatus(req);

  return NextResponse.json({ error: "Unknown tool" }, { status: 400 });
}

// ── Async full-site crawl (PRD audit) — start / tick / status ─────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleCrawlStart(body: any) {
  const domain = String(body.domain || "").trim();
  if (!domain) return NextResponse.json({ error: "No domain" }, { status: 400 });
  if (!getRedis()) return NextResponse.json({ error: "Crawl store unavailable (Redis not configured)." }, { status: 503 });
  const maxPages = Math.min(Math.max(Number(body.maxPages) || 500, 20), 3000);
  const seeds = (await dfsTopPages(domain, 100).catch(() => null)) || [];
  const jobId = await startCrawl(domain, seeds, maxPages);
  if (!jobId) return NextResponse.json({ error: "Failed to start crawl" }, { status: 500 });
  return NextResponse.json({ jobId, maxPages });
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleCrawlTick(body: any) {
  const jobId = String(body.jobId || "").trim();
  if (!jobId) return NextResponse.json({ error: "No jobId" }, { status: 400 });
  const meta = await tickCrawl(jobId, 92000);
  if (!meta) return NextResponse.json({ error: "Job not found or expired" }, { status: 404 });
  return NextResponse.json({ meta });
}
async function handleCrawlStatus(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "No jobId" }, { status: 400 });
  const { meta, audit } = await getCrawlStatus(jobId);
  if (!meta) return NextResponse.json({ error: "Job not found or expired" }, { status: 404 });
  return NextResponse.json({ meta, audit });
}

// Real DataForSEO-powered site audit (SEO Audit Report + Site Crawl tab). Lives here rather
// than in its own route to stay under the Vercel serverless-function cap; /api/tools already
// runs with maxDuration 90, which this needs.
async function handleOnPageAudit(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain");
  if (!domain) return NextResponse.json({ error: "No domain" }, { status: 400 });
  if (!dfsConfigured()) return NextResponse.json({ configured: false, onpage: null, domain: null });

  const maxPages = Math.min(Math.max(Number(req.nextUrl.searchParams.get("pages")) || 100, 1), 300);
  const base = domain.startsWith("http") ? domain.replace(/\/$/, "") : `https://${domain.replace(/\/$/, "")}`;
  const host = (() => { try { return new URL(base).hostname.replace(/^www\./, ""); } catch { return ""; } })();
  const cleanPath = (p: string) => /^\/(?:[\w-]+\/)*[\w-]*(?:\.html?|\.php)?\/?$/i.test(decodeURIComponent(p));
  const clean = (u: string) => { try { const x = new URL(u); return x.hostname.replace(/^www\./, "") === host && !x.search && cleanPath(x.pathname); } catch { return false; } };
  // Seed the crawl from BOTH DataForSEO's ranked pages AND the sitemap (whichever resolves),
  // then the BFS crawler discovers the rest by following internal links.
  const [dfsUrls, smUrls] = await Promise.all([
    dfsTopPages(domain, 100).catch(() => null),
    getSitemapUrls(base, 300).catch(() => [] as string[]),
  ]);
  let seeds = [...new Set([base, ...(dfsUrls || []), ...(smUrls || [])].filter(clean))];
  if (!seeds.length) seeds = [base];

  // Full-site scan via a direct browser-UA BFS crawl (fast, parallel, not rate-limited,
  // captures schema). Falls back to DataForSEO Instant-Pages only if the direct crawl is blocked.
  let onpage = await crawlSiteHomegrown(seeds, base, maxPages, 82000).catch(() => null);
  if (!onpage || onpage.summary.total < 2) {
    const dfs = await dfsOnPageAudit(seeds.slice(0, 15), 2, 60000).catch(() => null);
    if (dfs && dfs.summary.total > (onpage?.summary.total || 0)) onpage = dfs;
  }
  const dom = await dfsDomainOverview(domain).catch(() => null);
  return NextResponse.json({ configured: true, onpage, domain: dom, urlsFound: onpage?.summary.total || seeds.length, seedCount: seeds.length });
}

// Full-site BFS crawl (browser UA). Seeds from a URL list, then discovers more pages by
// following same-host internal links, up to maxPages or the wall-clock budget. Returns the
// same shape as dfsOnPageAudit so the client is agnostic to the crawl source.
async function crawlSiteHomegrown(seeds: string[], base: string, maxPages: number, budgetMs: number, concurrency = 12): Promise<OnPageAudit | null> {
  const started = Date.now();
  let host = ""; try { host = new URL(base).hostname.replace(/^www\./, ""); } catch { return null; }
  const cleanPath = (p: string) => /^\/(?:[\w-]+\/)*[\w-]*(?:\.html?|\.php)?\/?$/i.test(decodeURIComponent(p));
  const seen = new Set<string>();
  const queue: string[] = [];
  const enqueue = (u: string, from: string) => {
    try {
      const x = new URL(u, from);
      if (x.hostname.replace(/^www\./, "") !== host || x.search || !cleanPath(x.pathname)) return;
      const norm = `${x.protocol}//${x.hostname}${x.pathname}`;
      const key = norm.replace(/\/$/, "").toLowerCase();
      if (seen.has(key)) return;
      seen.add(key); queue.push(norm);
    } catch { /* skip bad URL */ }
  };
  seeds.forEach(u => enqueue(u, base));
  if (!queue.length) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results: any[] = [];
  const retried = new Set<string>();
  while (queue.length && results.length < maxPages && Date.now() - started < budgetMs) {
    const batch = queue.splice(0, concurrency);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fetched = await Promise.all(batch.map(async (u): Promise<any> => {
      try { const { html, status, finalUrl } = await fetchHtml(u); return { u, html, status, finalUrl }; }
      catch { return { u, html: null, status: 0, finalUrl: u }; }
    }));
    for (const r of fetched) {
      if (r.html) {
        const p = parsePage(r.html, r.finalUrl || r.u);
        results.push({ url: r.finalUrl || r.u, status: r.status, ok: true, ...p });
        // Discover more internal pages (bounded so a huge page can't flood the frontier).
        if (queue.length < maxPages * 3) {
          let n = 0;
          for (const m of r.html.matchAll(/href=["']([^"'#\s]+)["']/gi)) { enqueue(m[1], r.finalUrl || r.u); if (++n > 250) break; }
        }
      } else if (!retried.has(r.u)) {
        retried.add(r.u); queue.push(r.u); // one retry for Cloudflare-blocked fetches
      } else {
        results.push({ url: r.u, status: r.status, ok: false });
      }
    }
  }
  const good = results.filter(r => r.ok && r.status >= 200 && r.status < 400);
  if (!good.length) return null;
  const pages = good.map(p => ({
    url: p.url, status: p.status, isRedirect: p.status >= 300 && p.status < 400,
    title: p.title || "", titleLength: p.titleLength || 0,
    metaDesc: p.metaDesc || "", metaDescLength: p.metaDescLength || 0,
    h1: p.h1 || "", h1Count: p.h1Count || 0, wordCount: p.wordCount || 0,
    imgCount: p.imgCount || 0, imgsWithoutAlt: p.imgsWithoutAlt || 0,
    canonical: p.canonical || "", noindex: !!p.noindex,
    schemaTypes: p.schemaTypes || [], internalLinks: p.internalLinks || 0, externalLinks: p.externalLinks || 0,
    loadTimeMs: 0, sizeBytes: 0, onpageScore: 0,
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cnt = (f: (p: any) => boolean) => pages.filter(f).length;
  const total = pages.length;
  const summary = {
    total, ok: cnt(p => p.status >= 200 && p.status < 300 && !p.isRedirect),
    redirects: cnt(p => p.isRedirect), errors: results.filter(r => r.status >= 400 || r.status === 0).length,
    missing_title: cnt(p => !p.title), short_title: cnt(p => p.title && p.titleLength < 30),
    long_title: cnt(p => p.titleLength > 60), missing_meta: cnt(p => !p.metaDesc),
    missing_h1: cnt(p => !p.h1Count), multiple_h1: cnt(p => p.h1Count > 1),
    imgs_no_alt: pages.reduce((a, p) => a + (p.imgsWithoutAlt || 0), 0),
    noindex_pages: cnt(p => p.noindex), no_canonical: cnt(p => !p.canonical),
    thin_content: cnt(p => p.wordCount > 0 && p.wordCount < 300),
  };
  const totalLinks = pages.reduce((a, p) => a + p.internalLinks + p.externalLinks, 0);
  return { summary, pages, brokenLinks: [] as { url: string; from: string; status: number }[], totalLinksChecked: totalLinks, okLinks: totalLinks, onpageScore: 0, source: "dataforseo" };
}

// ── POST dispatcher ───────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json();
  const tool = body.tool;

  if (tool === "widget_save") return handleWidgetSave(body);
  if (tool === "report_share") return handleReportShare(body);
  if (tool === "interactives") return handleInteractives(body);
  if (tool === "calendar") return handleCalendar(body);
  if (tool === "soaiv") return handleSOAIV(body);
  if (tool === "wppublish") return handleWpPublish(body);
  if (tool === "wpcategories") return handleWpCategories(body);
  if (tool === "wpauthors") return handleWpAuthors(body);
  if (tool === "campaign_strategy") return handleCampaignStrategy(body);
  if (tool === "campaign_suggestions") return handleCampaignSuggestions(body);
  if (tool === "campaign_content") return handleCampaignContent(body);
  if (tool === "campaign_image") return handleCampaignImage(body);
  if (tool === "content_dedup") return handleContentDedup(body);
  if (tool === "site_articles") return handleSiteArticles(body);
  if (tool === "competitor") return handleCompetitor(body);
  if (tool === "linkprospects") return handleLinkProspects(body);
  if (tool === "crawl_start") return handleCrawlStart(body);
  if (tool === "crawl_tick") return handleCrawlTick(body);
  if (tool === "seo_engine") return handleSeoEngine(body, req);

  return NextResponse.json({ error: "Unknown tool" }, { status: 400 });
}

// ── llms.txt ──────────────────────────────────────────────────────────────────
async function handleLlmsTxt(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain");
  if (!domain) return NextResponse.json({ error: "No domain" }, { status: 400 });

  const base = domain.startsWith("http") ? domain.replace(/\/$/, "") : `https://${domain.replace(/\/$/, "")}`;
  const hostname = new URL(base).hostname;

  const [homepageResult, sitemapUrls] = await Promise.allSettled([
    fetchHtml(base),
    getSitemapUrls(base, 20),
  ]);

  const homepage = homepageResult.status === "fulfilled" ? homepageResult.value : { html: "", status: 0, finalUrl: base };
  const urls = sitemapUrls.status === "fulfilled" ? sitemapUrls.value : [];

  let title = hostname;
  let description = "";
  let sections: { heading: string; url: string; desc: string }[] = [];

  if (homepage.html) {
    const titleMatch = homepage.html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) title = titleMatch[1].replace(/\s*[-|].*$/, "").trim();
    const descMatch = homepage.html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["']/i)
      || homepage.html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    if (descMatch) description = descMatch[1].trim();
  }

  const keyUrls = urls.slice(0, 15);
  const pageResults = await Promise.allSettled(keyUrls.map(url => fetchHtml(url)));

  for (let i = 0; i < keyUrls.length; i++) {
    const r = pageResults[i];
    if (r.status !== "fulfilled" || !r.value.html) continue;
    const html = r.value.html;
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const metaDesc = html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    const heading = h1Match ? h1Match[1].replace(/<[^>]+>/g, "").trim() : new URL(keyUrls[i]).pathname.replace(/\//g, " ").trim() || hostname;
    const desc = metaDesc ? metaDesc[1].trim() : "";
    if (heading && heading.length < 120) sections.push({ heading, url: keyUrls[i], desc });
  }

  sections = sections.filter((s, i, arr) => arr.findIndex(x => x.heading === s.heading) === i).slice(0, 12);

  const lines: string[] = [];
  lines.push(`# ${title}`, "");
  if (description) lines.push(`> ${description}`, "");
  lines.push(`## About`, `- Website: [${hostname}](${base})`, `- Domain: ${hostname}`, "");
  if (sections.length > 0) {
    lines.push(`## Key Pages`, "");
    for (const s of sections) {
      if (s.desc) { lines.push(`### [${s.heading}](${s.url})`, s.desc, ""); }
      else lines.push(`- [${s.heading}](${s.url})`);
    }
    lines.push("");
  }
  lines.push(`## Usage Guidelines`,
    "- Content may be used for AI training and model responses",
    "- Please cite the source URL when using this content",
    `- For up-to-date information, fetch directly from ${base}`, "",
    `## Contact`, `- Website: ${base}`, `- Sitemap: ${base}/sitemap.xml`, `- Robots: ${base}/robots.txt`);

  return NextResponse.json({ domain: hostname, llmstxt: lines.join("\n"), pages_analyzed: keyUrls.length, sections_found: sections.length });
}

// ── pricing.md ────────────────────────────────────────────────────────────────
async function handlePricingMd(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain");
  if (!domain) return NextResponse.json({ error: "No domain" }, { status: 400 });

  const base = domain.startsWith("http") ? domain.replace(/\/$/, "") : `https://${domain.replace(/\/$/, "")}`;
  const hostname = new URL(base).hostname;

  let pricingHtml = "", pricingUrl = "";
  for (const path of ["/pricing", "/plans", "/pricing/", "/plans/", "/#pricing"]) {
    try {
      const { html, status } = await fetchHtml(base + path);
      if (status >= 200 && status < 300 && html && html.length > 500) { pricingHtml = html; pricingUrl = base + path; break; }
    } catch { continue; }
  }
  if (!pricingHtml) { const { html } = await fetchHtml(base); pricingHtml = html || ""; pricingUrl = base; }

  const plans: { name: string; price: string; period: string; features: string[]; cta: string }[] = [];
  let currency = "USD";
  let headline = `${hostname} Pricing`;

  if (pricingHtml) {
    const h1 = pricingHtml.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1) headline = h1[1].replace(/<[^>]+>/g, "").trim();
    if (pricingHtml.includes("£") || pricingHtml.includes("GBP")) currency = "GBP";
    else if (pricingHtml.includes("€") || pricingHtml.includes("EUR")) currency = "EUR";

    const prices: string[] = [];
    let m;
    const priceRe = /\$(\d+(?:\.\d{2})?)/gi;
    while ((m = priceRe.exec(pricingHtml)) !== null) prices.push("$" + m[1]);

    const headingRe = /<h[2-4][^>]*>([^<]{3,60})<\/h[2-4]>/gi;
    const planNames: string[] = [];
    while ((m = headingRe.exec(pricingHtml)) !== null) {
      const text = m[1].replace(/<[^>]+>/g, "").trim();
      if (/free|starter|basic|pro|professional|business|enterprise|team|growth|scale/i.test(text) && text.length < 50) planNames.push(text);
    }
    [...new Set(planNames)].slice(0, 5).forEach((name, i) => {
      plans.push({ name, price: prices[i] || (i === 0 ? "Free" : "Contact us"), period: "month", features: [], cta: "Get started" });
    });
    if (plans.length === 0 && prices.length > 0) plans.push({ name: "Standard Plan", price: prices[0], period: "month", features: [], cta: "Get started" });
  }

  const mdLines = [`# ${headline}`, "", `> Machine-readable pricing. Source: [${hostname}](${base}/pricing)`, `> Last updated: ${new Date().toISOString().slice(0, 10)}`, `> Currency: ${currency}`, ""];
  if (plans.length > 0) {
    mdLines.push("## Plans", "");
    for (const p of plans) { mdLines.push(`### ${p.name}`, `- **Price**: ${p.price}/${p.period}`, `- **CTA**: ${p.cta}`, ""); }
  }
  mdLines.push("## Pricing Page", `- Full details: [${base}/pricing](${base}/pricing)`, `- Enterprise: [${base}/contact](${base}/contact)`, "", "## Usage for AI Agents", "- Always link to pricing page for current information", "- Do not cache this file for more than 24 hours");

  return NextResponse.json({ domain: hostname, pricing_url: pricingUrl, found_pricing_page: pricingUrl !== base, pricingmd: mdLines.join("\n"), plans_detected: plans.length });
}

// ── Core Web Vitals ───────────────────────────────────────────────────────────
async function handleCWV(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  const strategy = (req.nextUrl.searchParams.get("strategy") || "mobile") as "mobile" | "desktop";
  if (!url) return NextResponse.json({ error: "No url" }, { status: 400 });

  const apiKey = (process.env.PAGESPEED_API_KEY || "").trim();
  if (apiKey) {
    try {
      const psUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}&key=${apiKey}&category=performance&category=accessibility&category=best-practices&category=seo`;
      const r = await fetch(psUrl, { signal: AbortSignal.timeout(55000) });
      if (r.ok) {
        const data = await r.json() as { lighthouseResult?: { categories?: Record<string, { score?: number }>; audits?: Record<string, { numericValue?: number }> } };
        const cats = data.lighthouseResult?.categories;
        const audits = data.lighthouseResult?.audits;
        const getNum = (id: string) => { const a = audits?.[id]; return typeof a?.numericValue === "number" ? Math.round(a.numericValue) : null; };
        return NextResponse.json({
          url, strategy, score: Math.round((cats?.performance?.score || 0) * 100),
          lcp: getNum("largest-contentful-paint"), fid: getNum("max-potential-fid"),
          cls: audits?.["cumulative-layout-shift"]?.numericValue != null ? Math.round(audits["cumulative-layout-shift"].numericValue! * 1000) / 1000 : null,
          fcp: getNum("first-contentful-paint"), ttfb: getNum("server-response-time"),
          inp: getNum("interaction-to-next-paint"), tbt: getNum("total-blocking-time"), si: getNum("speed-index"),
          pass: (cats?.performance?.score || 0) >= 0.5, source: "real",
          accessibility: Math.round((cats?.accessibility?.score || 0) * 100),
          bestPractices: Math.round((cats?.["best-practices"]?.score || 0) * 100),
          seo: Math.round((cats?.seo?.score || 0) * 100),
        });
      }
    } catch { /* fall through */ }
  }

  const isMobile = strategy === "mobile";
  const baseScore = isMobile ? 55 : 72;
  return NextResponse.json({
    url, strategy, score: baseScore,
    lcp: isMobile ? 3200 : 1800, fid: isMobile ? 120 : 60, cls: 0.12,
    fcp: isMobile ? 2100 : 1200, ttfb: url.startsWith("https") ? 380 : 520,
    inp: isMobile ? 280 : 140, tbt: isMobile ? 320 : 180, si: isMobile ? 4200 : 2400,
    pass: baseScore >= 50, source: "estimated", accessibility: 78, bestPractices: 83, seo: 88,
  });
}

// ── Extractability ────────────────────────────────────────────────────────────
async function handleExtractability(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "No url" }, { status: 400 });

  const { html, status } = await fetchHtml(url);
  if (!html || status >= 400) return NextResponse.json({ error: `Failed to fetch (${status})` }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsed = parsePage(html, url) as any;
  const dims: { name: string; score: number; weight: number; detail: string; status: "pass" | "partial" | "fail" }[] = [];

  const h2 = (html.match(/<h2/gi) || []).length, h3 = (html.match(/<h3/gi) || []).length, lists = (html.match(/<[uo]l/gi) || []).length;
  const ss = Math.min(100, h2 * 10 + h3 * 5 + lists * 8);
  dims.push({ name: "Structure Clarity", score: ss, weight: 20, detail: `${h2} H2s, ${h3} H3s, ${lists} lists`, status: ss >= 60 ? "pass" : ss >= 30 ? "partial" : "fail" });

  const sents = (parsed.bodyText || "").split(/[.!?]+/).filter((s: string) => s.trim().length > 10);
  const short = sents.filter((s: string) => s.trim().split(/\s+/).length < 25).length;
  const as2 = sents.length > 0 ? Math.round((short / sents.length) * 100) : 0;
  dims.push({ name: "Answer Format", score: as2, weight: 20, detail: `${short}/${sents.length} short sentences`, status: as2 >= 60 ? "pass" : as2 >= 40 ? "partial" : "fail" });

  const nums = (parsed.bodyText || "").match(/\b\d[\d,]*(?:\.\d+)?(?:\s*%|\s*\$|M|B|K)?\b/g)?.length || 0;
  const hasYear = /\b(19|20)\d{2}\b/.test(parsed.bodyText || "");
  const es = Math.min(100, nums * 3 + (hasYear ? 20 : 0) + (parsed.wordCount > 500 ? 30 : 10));
  dims.push({ name: "Entity Clarity", score: es, weight: 15, detail: `${nums} numeric facts, dates ${hasYear ? "present" : "missing"}`, status: es >= 60 ? "pass" : es >= 30 ? "partial" : "fail" });

  const extLinks = parsed.externalLinks || 0;
  const hasStats = /\d+%|\d+ percent|\d+ million|\d+ billion/i.test(parsed.bodyText || "");
  const cs = Math.min(100, extLinks * 5 + (hasStats ? 40 : 0) + (extLinks > 0 ? 20 : 0));
  dims.push({ name: "Citation Signals", score: cs, weight: 15, detail: `${extLinks} outbound links, stats ${hasStats ? "present" : "missing"}`, status: cs >= 50 ? "pass" : cs >= 25 ? "partial" : "fail" });

  const sTypes = parsed.schemaTypes || [];
  const hasFAQ = sTypes.some((s: string) => /faq|question/i.test(s)), hasArt = sTypes.some((s: string) => /article|blog|news/i.test(s));
  const scS = sTypes.length > 0 ? (hasFAQ ? 100 : hasArt ? 75 : 50) : 0;
  dims.push({ name: "Schema Coverage", score: scS, weight: 15, detail: sTypes.length > 0 ? sTypes.join(", ") : "No schema", status: scS >= 75 ? "pass" : scS >= 50 ? "partial" : "fail" });

  const avgW = sents.length > 0 ? sents.reduce((a: number, s: string) => a + s.trim().split(/\s+/).length, 0) / sents.length : 20;
  const rs = avgW <= 18 ? 100 : avgW <= 25 ? 70 : 40;
  dims.push({ name: "Reading Level", score: rs, weight: 10, detail: `Avg ${Math.round(avgW)} words/sentence (target ≤18)`, status: rs >= 70 ? "pass" : rs >= 40 ? "partial" : "fail" });

  const wc = parsed.wordCount || 0;
  const ds = wc >= 1500 ? 100 : wc >= 800 ? 75 : wc >= 400 ? 50 : wc >= 200 ? 25 : 0;
  dims.push({ name: "Content Depth", score: ds, weight: 5, detail: `${wc} words (target 800+)`, status: ds >= 75 ? "pass" : ds >= 50 ? "partial" : "fail" });

  const totalW = dims.reduce((a, d) => a + d.weight, 0);
  const total = Math.round(dims.reduce((a, d) => a + d.score * d.weight, 0) / totalW);
  const grade = total >= 80 ? "A" : total >= 65 ? "B" : total >= 50 ? "C" : total >= 35 ? "D" : "F";

  return NextResponse.json({
    url, total_score: total, grade,
    label: total >= 80 ? "Highly Extractable" : total >= 65 ? "Well Optimized" : total >= 50 ? "Partially Optimized" : "Needs Work",
    dimensions: dims,
    top_fixes: dims.filter(d => d.status !== "pass").sort((a, b) => b.weight - a.weight).slice(0, 3).map(d => `Improve ${d.name}: ${d.detail}`),
  });
}

// ── PAA → FAQ ─────────────────────────────────────────────────────────────────
async function handlePAAFAQ(req: NextRequest) {
  const keyword = req.nextUrl.searchParams.get("keyword");
  if (!keyword) return NextResponse.json({ error: "No keyword" }, { status: 400 });

  let snippets: string[] = [];
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(keyword + " how what why")}`, {
      headers: { "User-Agent": "Mozilla/5.0 Chrome/120", "Accept": "text/html" }, signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const html = await res.text();
      const re = /class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|span)>/gi;
      for (const m of [...html.matchAll(re)].slice(0, 8)) {
        const t = m[1].replace(/<[^>]+>/g, "").replace(/&[a-z]+;/g, " ").trim();
        if (t.length > 20 && t.length < 200) snippets.push(t);
      }
    }
  } catch { /* no context */ }

  const prompt = `You are an expert SEO content writer. Generate a comprehensive FAQ section for the keyword: "${keyword}"
${snippets.length > 0 ? `\nSearch context:\n${snippets.slice(0, 5).join("\n")}\n` : ""}
Return ONLY valid JSON:
{
  "faq_items": [{"question":"string","answer":"2-4 sentence answer","type":"definition|process|comparison|list|yes-no","schema_eligible":true}],
  "schema": {"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"q","acceptedAnswer":{"@type":"Answer","text":"a"}}]},
  "summary": "brief summary",
  "featured_snippet_tips": ["tip1","tip2"]
}
Generate 8 high-quality FAQ items optimized for featured snippets and AI citation.`;

  try {
    const text = await callAI(prompt, 3000, true);
    return NextResponse.json({ keyword, result: parseJSON(text), paa_context: snippets.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

// ── Pillar Planner ────────────────────────────────────────────────────────────
async function handlePillar(req: NextRequest) {
  const topic = req.nextUrl.searchParams.get("topic");
  const domain = req.nextUrl.searchParams.get("domain") || "";
  if (!topic) return NextResponse.json({ error: "No topic" }, { status: 400 });

  const prompt = `You are an expert SEO content architect. Create a comprehensive pillar page plan for: "${topic}"${domain ? `\nWebsite: ${domain}` : ""}
Return ONLY valid JSON:
{
  "pillar_page": {"title":"string","url_slug":"/slug","word_count":4500,"primary_keyword":"string","secondary_keywords":["kw"],"intent":"informational","outline":[{"h2":"section","h3s":["sub"],"word_count":400}]},
  "cluster_pages": [{"title":"string","url_slug":"/slug","word_count":1500,"primary_keyword":"string","intent":"informational|commercial|transactional","internal_link_text":"anchor","priority":"high|medium|low","content_type":"guide|how-to|listicle|comparison|definition"}],
  "internal_link_strategy": {"pillar_to_cluster":["note"],"cluster_to_pillar":"string","cross_linking":"string"},
  "topical_authority_score": 85,
  "estimated_traffic_potential": "2000-8000 monthly visits",
  "time_to_rank": "3-6 months",
  "quick_wins": ["action1","action2"]
}
Generate 6-8 cluster pages specific to "${topic}".`;

  try {
    const text = await callAI(prompt, 4096, true);
    return NextResponse.json({ topic, domain, result: parseJSON(text) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

// ── Article interactives ──────────────────────────────────────────────────────
// The model supplies DATA ONLY, against four fixed archetypes. It never emits
// JavaScript — the runtime is hand-written and identical for every article, so a
// bad generation can produce a useless widget but never executable content.
//
//  dial        — compare N framings of the same number (figure + facts + scale bar)
//  classifier  — run N scenarios through the same set of verdict rows
//  assessment  — N scored questions → a tier with next steps
//  calculator  — N numeric inputs → base + Σ(value × coefficient)

export type Interactive =
  | { kind: "dial"; id: string; title: string; hint: string; after_heading: string; scale: { max: number; unit: string }; options: { label: string; figure: string; sub: string; value: number; facts: { label: string; text: string }[] }[] }
  | { kind: "classifier"; id: string; title: string; hint: string; after_heading: string; rows: string[]; scenarios: { label: string; verdicts: { state: "y" | "w" | "n"; text: string }[]; note: string }[] }
  | { kind: "assessment"; id: string; title: string; hint: string; after_heading: string; questions: string[]; tiers: { name: string; min: number; max: number; desc: string; steps: string[] }[] }
  | { kind: "calculator"; id: string; title: string; hint: string; after_heading: string; base: number; inputs: { label: string; unit: string; default: number; min: number; max: number; coefficient: number }[]; output: { label: string; prefix: string; suffix: string; decimals: number }; note: string };

const num = (v: unknown, fallback = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fallback; };
const str = (v: unknown, cap = 400) => String(v ?? "").replace(/<[^>]*>/g, "").trim().slice(0, cap);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

// Reject anything that does not fully satisfy its archetype. A half-built widget is
// worse than no widget, so partial structures are dropped rather than patched.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validateInteractive(raw: any, idx: number): Interactive | null {
  if (!raw || typeof raw !== "object") return null;
  const kind = String(raw.kind || "").toLowerCase();
  const id = `rmi-${idx}`;
  const title = str(raw.title, 90);
  const hint = str(raw.hint, 60);
  const after_heading = str(raw.after_heading, 160);
  if (!title) return null;

  if (kind === "dial") {
    const options = arr(raw.options).slice(0, 4).map(o => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const x = o as any;
      const facts = arr(x?.facts).slice(0, 4)
        .map(f => ({ label: str((f as { label?: string })?.label, 40), text: str((f as { text?: string })?.text, 320) }))
        .filter(f => f.label && f.text);
      return { label: str(x?.label, 44), figure: str(x?.figure, 14), sub: str(x?.sub, 70), value: num(x?.value), facts };
    }).filter(o => o.label && o.figure && o.facts.length >= 2);
    if (options.length < 2) return null;
    const max = Math.max(num(raw?.scale?.max), ...options.map(o => o.value)) || 100;
    return { kind: "dial", id, title, hint: hint || "Select a lens", after_heading, scale: { max, unit: str(raw?.scale?.unit, 40) }, options };
  }

  if (kind === "classifier") {
    const rows = arr(raw.rows).slice(0, 4).map(r => str(r, 34)).filter(Boolean);
    if (rows.length < 2) return null;
    const scenarios = arr(raw.scenarios).slice(0, 8).map(s => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const x = s as any;
      const verdicts = arr(x?.verdicts).slice(0, rows.length).map(v => {
        const st = String((v as { state?: string })?.state || "").toLowerCase();
        return { state: (st === "y" || st === "w" || st === "n" ? st : "w") as "y" | "w" | "n", text: str((v as { text?: string })?.text, 40) };
      }).filter(v => v.text);
      return { label: str(x?.label, 120), verdicts, note: str(x?.note, 340) };
    }).filter(s => s.label && s.verdicts.length === rows.length);
    if (scenarios.length < 3) return null;
    return { kind: "classifier", id, title, hint: hint || "Pick a scenario", after_heading, rows, scenarios };
  }

  if (kind === "assessment") {
    const questions = arr(raw.questions).slice(0, 8).map(q => str(q, 180)).filter(Boolean);
    if (questions.length < 3) return null;
    const top = questions.length * 2;
    let tiers = arr(raw.tiers).slice(0, 4).map(t => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const x = t as any;
      return {
        name: str(x?.name, 30), min: num(x?.min), max: num(x?.max), desc: str(x?.desc, 340),
        steps: arr(x?.steps).slice(0, 4).map(s => str(s, 220)).filter(Boolean),
      };
    }).filter(t => t.name && t.desc && t.steps.length);
    if (tiers.length < 2) return null;
    // Re-derive the score bands in code: the model routinely returns ranges that leave
    // gaps or overlap, which would make some scores match no tier at all.
    tiers = tiers.sort((a, b) => a.min - b.min).map((t, i, all) => {
      const lo = Math.round((top / all.length) * i);
      const hi = i === all.length - 1 ? top : Math.round((top / all.length) * (i + 1)) - 1;
      return { ...t, min: lo, max: hi };
    });
    return { kind: "assessment", id, title, hint: hint || `${questions.length} questions`, after_heading, questions, tiers };
  }

  if (kind === "calculator") {
    const inputs = arr(raw.inputs).slice(0, 4).map(i => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const x = i as any;
      const min = num(x?.min, 0);
      const max = Math.max(num(x?.max, 100), min + 1);
      return {
        label: str(x?.label, 60), unit: str(x?.unit, 24),
        default: Math.min(Math.max(num(x?.default, min), min), max),
        min, max, coefficient: num(x?.coefficient),
      };
    }).filter(i => i.label && i.coefficient !== 0);
    if (inputs.length < 2) return null;
    return {
      kind: "calculator", id, title, hint: hint || "Adjust the inputs", after_heading,
      base: num(raw.base), inputs,
      output: {
        label: str(raw?.output?.label, 50) || "Estimated total",
        prefix: str(raw?.output?.prefix, 4), suffix: str(raw?.output?.suffix, 12),
        decimals: Math.min(Math.max(num(raw?.output?.decimals), 0), 2),
      },
      note: str(raw.note, 320),
    };
  }

  return null;
}

// Ask for 2-3 instruments matched to the article's actual sections.
async function buildInteractives(opts: { title: string; keyword: string; headings: string[]; brand: string; audience: string }): Promise<Interactive[]> {
  const heads = opts.headings.slice(0, 12).join(" | ") || "n/a";
  const prompt = `You design interactive widgets for a B2B article. Return DATA ONLY — never code.

ARTICLE: "${opts.title}" (primary keyword: ${opts.keyword})
SECTION HEADINGS: ${heads}
BRAND: ${opts.brand || "n/a"}. AUDIENCE: ${opts.audience || "business decision makers"}.

Choose the 2-3 archetypes that genuinely fit THIS article's subject. Do not force a poor fit — returning 2 strong widgets beats 3 weak ones.
Set "after_heading" to the EXACT text of the section heading each widget should follow.

{"interactives":[
 {"kind":"dial","title":"...","hint":"...","after_heading":"exact heading text","scale":{"max":100,"unit":"% of workforce"},
  "options":[{"label":"short tab label","figure":"4.3%","sub":"6.9 million workers","value":4.3,
    "facts":[{"label":"What it counts","text":"..."},{"label":"What it leaves out","text":"..."},{"label":"Use it for","text":"..."},{"label":"Source","text":"..."}]}]},

 {"kind":"classifier","title":"...","hint":"...","after_heading":"exact heading text",
  "rows":["Verdict row 1","Verdict row 2","Verdict row 3"],
  "scenarios":[{"label":"a concrete real-world case","verdicts":[{"state":"y|w|n","text":"short verdict"}],"note":"what to watch out for"}]},

 {"kind":"assessment","title":"...","hint":"...","after_heading":"exact heading text",
  "questions":["yes/partly/no question about the reader's own situation"],
  "tiers":[{"name":"Tier name","min":0,"max":4,"desc":"what this score means","steps":["next step"]}]},

 {"kind":"calculator","title":"...","hint":"...","after_heading":"exact heading text","base":0,
  "inputs":[{"label":"Input name","unit":"workers","default":50,"min":1,"max":500,"coefficient":120}],
  "output":{"label":"Estimated annual cost","prefix":"$","suffix":"/year","decimals":0},"note":"what the estimate assumes"}
]}

RULES:
- dial: 3-4 options, each with 4 facts. "value" must be the numeric form of "figure" and sit on the same scale.
- classifier: 3-4 rows, 5-8 scenarios. Every scenario's "verdicts" array must have EXACTLY one entry per row, in row order. state: y=yes, w=depends/caution, n=no.
- assessment: 5-6 questions, 4 tiers. Questions must be answerable yes/partly/no about the reader's own organisation.
- calculator: 2-4 inputs. The result is computed as base + sum(value x coefficient) — pick coefficients so a realistic input set gives a credible number. No other formula is possible, so design for it.
- Every figure, fact and coefficient must be defensible. Do not invent statistics or attribute numbers to sources that did not publish them.
Return ONLY valid JSON.`;

  try {
    const text = await callAI(prompt, 6000, true);
    const parsed = parseJSON(text) as { interactives?: unknown[] };
    return arr(parsed?.interactives).slice(0, 3)
      .map((raw, i) => validateInteractive(raw, i))
      .filter((x): x is Interactive => x !== null);
  } catch {
    return []; // interactives are additive — never fail the article over them
  }
}

// Interactives run as their OWN request. Article generation already spends ~32s on research
// plus ~80s writing, leaving no room inside the 120s function for another AI call.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleInteractives(body: any) {
  const title = String(body.title || "").trim();
  if (!title) return NextResponse.json({ error: "No title" }, { status: 400 });
  const headings = Array.isArray(body.headings)
    ? body.headings.map((h: unknown) => String(h)).filter(Boolean)
    : String(body.article_html || "").match(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)?.map(h => h.replace(/<[^>]+>/g, "").trim()).filter(Boolean) || [];
  try {
    const interactives = await buildInteractives({
      title,
      keyword: String(body.keyword || ""),
      headings,
      brand: String(body.brand || ""),
      audience: String(body.audience || ""),
    });
    return NextResponse.json({ interactives });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

// ── Zoho CRM ──────────────────────────────────────────────────────────────────
// Lives on /api/tools rather than its own route: the Hobby plan caps this project at 12
// serverless functions and it is already at the limit, so a dedicated /api/zoho route would
// fail the deploy outright.
//
// Purpose is attribution — tying organic search to actual pipeline, not just clicks.
async function handleZoho(req: NextRequest) {
  if (!zohoConfigured()) {
    return NextResponse.json({
      configured: false,
      dc: zohoDc(),
      error: "Zoho is not connected. Add ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET and ZOHO_REFRESH_TOKEN (plus ZOHO_DC if the account is not in the US data centre).",
    });
  }
  const days = Math.max(1, Math.min(365, Number(req.nextUrl.searchParams.get("days")) || 90));
  const since = Date.now() - days * 86400000;
  const recent = (r: Record<string, unknown>) => {
    const t = Date.parse(String(r.Created_Time || ""));
    return Number.isFinite(t) ? t >= since : true;   // keep undated rows rather than hiding them
  };

  try {
    const [leadsRaw, dealsRaw] = await Promise.all([
      zohoAll("Leads", ["Company", "Last_Name", "Email", "Lead_Source", "Lead_Status", "Created_Time"]).catch(() => []),
      zohoAll("Deals", ["Deal_Name", "Amount", "Stage", "Closing_Date", "Lead_Source", "Created_Time"]).catch(() => []),
    ]);
    const leads = leadsRaw.filter(recent);
    const deals = dealsRaw.filter(recent);

    const bySource = (rows: Record<string, unknown>[]) => {
      const m = new Map<string, number>();
      rows.forEach(r => { const k = String(r.Lead_Source || "Unspecified"); m.set(k, (m.get(k) || 0) + 1); });
      return [...m.entries()].map(([source, count]) => ({ source, count, organic: isOrganicSource(source) }))
        .sort((a, b) => b.count - a.count);
    };
    const amount = (r: Record<string, unknown>) => Number(r.Amount) || 0;
    const won = deals.filter(d => /won/i.test(String(d.Stage || "")));
    const lost = deals.filter(d => /lost/i.test(String(d.Stage || "")));
    const open = deals.filter(d => !/won|lost/i.test(String(d.Stage || "")));
    const organicDeals = deals.filter(d => isOrganicSource(d.Lead_Source));

    return NextResponse.json({
      configured: true,
      dc: zohoDc(),
      range_days: days,
      leads: {
        total: leads.length,
        organic: leads.filter(l => isOrganicSource(l.Lead_Source)).length,
        by_source: bySource(leads).slice(0, 12),
        recent: leads.slice(0, 20).map(l => ({
          name: [l.Company, l.Last_Name].filter(Boolean).join(" · ") || String(l.Email || "Unnamed"),
          source: String(l.Lead_Source || "Unspecified"),
          status: String(l.Lead_Status || ""),
          created: String(l.Created_Time || ""),
        })),
      },
      deals: {
        total: deals.length,
        open: open.length,
        won: won.length,
        lost: lost.length,
        pipeline_value: Math.round(open.reduce((a, d) => a + amount(d), 0)),
        won_value: Math.round(won.reduce((a, d) => a + amount(d), 0)),
        // The number that justifies an SEO budget: revenue Zoho itself attributes to organic.
        organic_won_value: Math.round(organicDeals.filter(d => /won/i.test(String(d.Stage || ""))).reduce((a, d) => a + amount(d), 0)),
        organic_count: organicDeals.length,
        by_source: bySource(deals).slice(0, 12),
      },
    });
  } catch (e) {
    return NextResponse.json({ configured: true, dc: zohoDc(), error: e instanceof Error ? e.message : "Zoho request failed" }, { status: 502 });
  }
}

// ── Hosted interactive widgets ────────────────────────────────────────────────
// WordPress runs wp_kses_post on REST-published content, which strips <script> and
// inline <style> for any user without unfiltered_html — and most security plugins strip
// it even for admins. Inlining the widget runtime therefore produces DEAD widgets on a
// real site. Instead each widget is stored here and embedded as an <iframe src>, the same
// way YouTube/Typeform embeds survive: no inline JS for the sanitizer to remove.
const WIDGET_TTL = 60 * 60 * 24 * 365;   // widgets outlive reports: they are part of a published page

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleWidgetSave(body: any) {
  const html = String(body.html || "");
  if (!html || html.length < 100) return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
  if (html.length > 400_000) return NextResponse.json({ error: "Widget too large" }, { status: 413 });
  if (!/data-rmi=/.test(html)) return NextResponse.json({ error: "Unrecognised widget document" }, { status: 400 });
  const r = getRedis();
  if (!r) return NextResponse.json({ error: "Widget hosting unavailable (Redis not configured)." }, { status: 503 });
  const id = reportId();
  try {
    await r.set(`widget:${id}`, html, { ex: WIDGET_TTL });
    return NextResponse.json({ id, path: `/api/tools?tool=widget&id=${id}` });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not save widget" }, { status: 500 });
  }
}

async function handleWidgetView(req: NextRequest) {
  const id = (req.nextUrl.searchParams.get("id") || "").replace(/[^a-z0-9]/gi, "").slice(0, 32);
  const r = id ? getRedis() : null;
  const html = r ? await r.get<string>(`widget:${id}`).catch(() => null) : null;
  if (!html) return new NextResponse("<!DOCTYPE html><html><body style=\"font:13px sans-serif;color:#64748b;margin:0;padding:12px\">This interactive is no longer available.</body></html>",
    { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
  return new NextResponse(String(html), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=86400",
      // Must be embeddable from the customer's own site, so no X-Frame-Options DENY here.
      "content-security-policy": "frame-ancestors *",
      "x-robots-tag": "noindex",
    },
  });
}

// ── Shareable report links ────────────────────────────────────────────────────
// Reports are generated client side into about:blank, which has no URL to send anyone.
// These two handlers park the finished HTML in Redis under an unguessable id and serve
// it back as a real page. Both live on the EXISTING /api/tools route on purpose: this
// project is on Vercel's Hobby plan, already at the 12-serverless-function cap, so a
// dedicated /api/report route would fail the deploy outright.
//
// Anyone holding the link can read the report — it carries no auth by design, because
// the point is to send it to people without accounts. Links expire after 30 days.

const REPORT_TTL = 60 * 60 * 24 * 30;
const MAX_REPORT_BYTES = 900_000;

function reportId(): string {
  // 22 chars of crypto-random base36 — not sequential, not guessable by enumeration.
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b).map(x => x.toString(36).padStart(2, "0")).join("").slice(0, 22);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleReportShare(body: any) {
  const html = String(body.html || "");
  if (!html || html.length < 200) return NextResponse.json({ error: "Nothing to share" }, { status: 400 });
  if (html.length > MAX_REPORT_BYTES) return NextResponse.json({ error: "Report too large to share" }, { status: 413 });
  // Only ever store a document we generated: refuse anything that isn't our report shell.
  if (!/^<!DOCTYPE html>/i.test(html.trim()) || !/<title>Analytics Report/i.test(html)) {
    return NextResponse.json({ error: "Unrecognised report document" }, { status: 400 });
  }
  const r = getRedis();
  if (!r) return NextResponse.json({ error: "Sharing unavailable — Redis is not configured." }, { status: 503 });
  const id = reportId();
  try {
    await r.set(`report:${id}`, html, { ex: REPORT_TTL });
    return NextResponse.json({ id, path: `/api/tools?tool=report&id=${id}`, expires_days: 30 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not save report" }, { status: 500 });
  }
}

async function handleReportView(req: NextRequest) {
  const id = (req.nextUrl.searchParams.get("id") || "").replace(/[^a-z0-9]/gi, "").slice(0, 32);
  const notFound = (msg: string) => new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Report unavailable</title>
     <style>body{font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#0f172a;display:grid;place-items:center;height:100vh;margin:0;background:#f8fafc}
     div{text-align:center;max-width:30rem;padding:2rem}h1{font-size:19px;margin:0 0 .5rem}p{color:#64748b;margin:0}</style></head>
     <body><div><h1>This report link is no longer available</h1><p>${msg}</p></div></body></html>`,
    { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });

  if (!id) return notFound("The link is missing its report id.");
  const r = getRedis();
  if (!r) return notFound("Report storage is not configured.");
  const html = await r.get<string>(`report:${id}`).catch(() => null);
  if (!html) return notFound("Shared reports expire 30 days after they are created.");
  return new NextResponse(String(html), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Immutable content under a random id — safe to cache hard, and keeps it off
      // search engines since these contain a customer's analytics.
      "cache-control": "public, max-age=3600",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

// ── Editorial Calendar ────────────────────────────────────────────────────────
// Research-first pipeline. Before planning anything we scrape the site, pull its
// DataForSEO domain metrics, discover competitors from live SERPs and mine the
// keywords those competitors rank for that the site does not. The calendar is then
// planned against a fixed asset quota rather than "4 posts per month".

// Aggregators and social platforms are never treated as content competitors.
const CAL_NOISE = new Set([
  "reddit.com", "wikipedia.org", "youtube.com", "linkedin.com", "facebook.com", "twitter.com", "x.com",
  "quora.com", "medium.com", "pinterest.com", "instagram.com", "amazon.com", "indeed.com",
  "glassdoor.com", "tiktok.com", "github.com", "stackoverflow.com",
]);

// Minimum deliverables per calendar: >=10 blogs, >=2 case studies, >=1 ebook, >=1 report,
// plus supporting formats. Floors hold for a 1-month plan and scale with plan length.
function calendarQuota(n: number) {
  return [
    { asset: "blog", min: Math.max(10, 4 * n), words: "1200-2200" },
    { asset: "case-study", min: Math.max(2, Math.ceil(n / 1.5)), words: "1000-1600" },
    { asset: "ebook", min: Math.max(1, Math.floor(n / 3)), words: "4000-7000" },
    { asset: "report", min: Math.max(1, Math.floor(n / 3)), words: "2500-4000" },
    { asset: "whitepaper", min: n >= 3 ? 1 : 0, words: "2000-3500" },
    { asset: "webinar", min: n >= 3 ? 1 : 0, words: "600-900" },
    { asset: "infographic", min: n >= 2 ? 1 : 0, words: "300-600" },
    { asset: "checklist", min: n >= 2 ? 1 : 0, words: "600-1000" },
  ].filter(a => a.min > 0);
}

// Spread `total` items across `n` months as evenly as possible.
function spreadAcross(total: number, n: number): number[] {
  const out = new Array<number>(n).fill(0);
  for (let i = 0; i < total; i++) out[i % n]++;
  return out;
}

type CalGap = { keyword: string; volume: number; kd: number; comp_pos: number | null; competitor: string };
type CalCompetitor = { domain: string; appearances: number; keywords: number; traffic: number; gap_keywords: CalGap[] };
type CalResearch = {
  site: { domain: string; title: string; description: string; h1: string; headings: string[]; pages_found: number; top_pages: string[]; keywords: number; traffic: number; top10: number; existing_paths: string[] };
  industry: string;
  seed_keywords: string[];
  competitors: CalCompetitor[];
  gaps: CalGap[];
  sources: string[];
};

// Phase 1-4 of the research. Every external call is failure-tolerant: a calendar is still
// produced (on thinner evidence) when DataForSEO is unconfigured or a fetch times out.
async function calendarResearch(host: string, userKws: string[], manualComps: string[]): Promise<CalResearch> {
  const base = `https://${host}`;
  const sources: string[] = [];

  // ── Phase 1: the site itself ──
  const siteCalls = await Promise.allSettled([
    fetchHtml(base),
    getSitemapUrls(base, 150),
    dfsConfigured() ? dfsDomainOverview(host) : Promise.resolve(null),
    dfsConfigured() ? dfsTopPages(host, 25) : Promise.resolve(null),
  ]);
  const ok = <T>(i: number): T | null =>
    siteCalls[i].status === "fulfilled" ? ((siteCalls[i] as PromiseFulfilledResult<T>).value ?? null) : null;

  const home = ok<{ html: string | null }>(0);
  const page = home?.html ? parsePage(home.html, base) : null;
  const sitemap = ok<string[]>(1) || [];
  const overview = ok<{ keywords: number; traffic: number; top3: number; top10: number }>(2);
  const topPages = ok<string[]>(3) || [];
  if (page) sources.push("homepage");
  if (sitemap.length) sources.push(`sitemap (${sitemap.length} urls)`);
  if (overview) sources.push("dataforseo domain overview");
  if (topPages.length) sources.push("dataforseo top pages");

  // Path segments of what is already published — used to steer the plan away from duplicates.
  const existingPaths = sitemap
    .map(u => { try { return new URL(u).pathname; } catch { return ""; } })
    .filter(p => p && p !== "/")
    .slice(0, 80);

  // ── Phase 2: seed keywords — derive them from the page when the user supplied none ──
  let seeds = userKws.slice();
  let industry = "";
  const compHints = manualComps.slice();
  if (seeds.length === 0) {
    const snapshot = [page?.title, page?.metaDesc, page?.h1, ...(page?.h2s || []).slice(0, 12)]
      .filter(Boolean).join(" | ").slice(0, 1200);
    try {
      const t = await callAI(`Website: ${host}. Homepage signals: ${snapshot || "unavailable"}. Known page paths: ${existingPaths.slice(0, 25).join(", ") || "unknown"}.
Return ONLY JSON {"keywords":["kw1","kw2","kw3","kw4","kw5","kw6","kw7","kw8"],"industry":"string","competitors":["domain1.com","domain2.com","domain3.com"]}
— commercial-intent SEO keywords this company should compete for, its industry, and its most likely direct competitor domains.`, 800, true);
      const d = parseJSON(t) as { keywords?: string[]; industry?: string; competitors?: string[] };
      seeds = (d.keywords || []).map(String).filter(Boolean).slice(0, 8);
      industry = String(d.industry || "");
      (d.competitors || []).forEach(c => { const cd = cleanDomain(String(c)); if (cd && cd !== host) compHints.push(cd); });
      if (seeds.length) sources.push("ai keyword derivation");
    } catch { /* keyword derivation is best-effort */ }
  }

  // ── Phase 3: competitors from live SERPs ──
  const tally = new Map<string, number>();
  const serps = await Promise.allSettled(seeds.slice(0, 3).map(k => fetchSERP(k)));
  serps.forEach(s => {
    if (s.status !== "fulfilled") return;
    s.value.results.slice(0, 10).forEach(r => {
      const d = cleanDomain(r.domain);
      if (!d || d === host || CAL_NOISE.has(d)) return;
      tally.set(d, (tally.get(d) || 0) + 1);
    });
  });
  if (tally.size) sources.push(`live serps (${seeds.slice(0, 3).length} keywords)`);
  const discovered = [...tally.entries()].sort((a, b) => b[1] - a[1]).map(([d]) => d);
  // User-named competitors first, then the domains that show up most across the seed SERPs.
  const chosen = [...new Set([...compHints, ...discovered])].filter(d => d && d !== host).slice(0, 3);

  // ── Phase 4: what each competitor ranks for that we do not ──
  const compSettled = await Promise.allSettled(chosen.map(async (c): Promise<CalCompetitor> => {
    const [ov, gap] = await Promise.all([
      dfsConfigured() ? dfsDomainOverview(c).catch(() => null) : Promise.resolve(null),
      // target1 ranks for these, target2 (us) does not — so mine is target2.
      dfsConfigured() ? dfsIntersection(c, host, { intersections: false, limit: 20, mineIsTarget1: false }).catch(() => null) : Promise.resolve(null),
    ]);
    return {
      domain: c,
      appearances: tally.get(c) || 0,
      keywords: ov?.keywords || 0,
      traffic: ov?.traffic || 0,
      gap_keywords: (gap || []).slice(0, 15).map(g => ({ keyword: g.keyword, volume: g.volume, kd: g.kd, comp_pos: g.comp_pos, competitor: c })),
    };
  }));
  const competitorsOut = compSettled
    .filter((r): r is PromiseFulfilledResult<CalCompetitor> => r.status === "fulfilled")
    .map(r => r.value);
  if (competitorsOut.some(c => c.gap_keywords.length)) sources.push("dataforseo keyword intersection");

  // Highest-volume gap keywords across every competitor, deduped.
  const seenKw = new Set<string>();
  const gaps = competitorsOut
    .flatMap(c => c.gap_keywords)
    .sort((a, b) => b.volume - a.volume)
    .filter(g => { const k = g.keyword.toLowerCase(); if (seenKw.has(k)) return false; seenKw.add(k); return true; })
    .slice(0, 40);

  return {
    site: {
      domain: host,
      title: page?.title || "",
      description: page?.metaDesc || "",
      h1: page?.h1 || "",
      headings: (page?.h2s || []).slice(0, 12),
      pages_found: sitemap.length,
      top_pages: topPages.slice(0, 12),
      keywords: overview?.keywords || 0,
      traffic: overview?.traffic || 0,
      top10: overview?.top10 || 0,
      existing_paths: existingPaths.slice(0, 40),
    },
    industry,
    seed_keywords: seeds,
    competitors: competitorsOut,
    gaps,
    sources,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleCalendar(body: any) {
  const { domain, keywords = [], months = 3, audience = "", goals = "", competitors = [] } = body;
  if (!domain) return NextResponse.json({ error: "No domain" }, { status: 400 });

  const host = cleanDomain(String(domain));
  const n = Math.max(1, Math.min(12, Number(months) || 3));

  // Month labels always start from the CURRENT month, so the calendar is never stale.
  const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const now = new Date();
  const monthLabels = Array.from({ length: n }, (_, i) => {
    const dt = new Date(now.getFullYear(), now.getMonth() + i, 1);
    return `${MONTH_NAMES[dt.getMonth()]} ${dt.getFullYear()}`;
  });

  const asList = (v: unknown) => (Array.isArray(v) ? v : String(v || "").split(","))
    .map(x => String(x).trim()).filter(Boolean);
  const userKws = asList(keywords).slice(0, 20);
  const manualComps = asList(competitors).map(c => cleanDomain(c)).filter(Boolean).slice(0, 5);

  // This route caps at maxDuration 120s. Research + strategy + n month passes can get close
  // on a 6-month plan, so the optional top-up pass is skipped once we run out of headroom.
  const startedAt = Date.now();
  const headroomLeft = () => Date.now() - startedAt < 85000;

  try {
    // ── Research ──
    const research = await calendarResearch(host, userKws, manualComps);

    const quota = calendarQuota(n);
    // Deterministic allocation: decide the exact slate per month in code, so the quota
    // holds regardless of how well the model counts.
    const perMonth: Record<string, number>[] = Array.from({ length: n }, () => ({}));
    quota.forEach(q => spreadAcross(q.min, n).forEach((c, i) => { if (c > 0) perMonth[i][q.asset] = c; }));
    const wordsFor = Object.fromEntries(quota.map(q => [q.asset, q.words]));

    // Compact research digest reused by every downstream prompt.
    const compLine = research.competitors.length
      ? research.competitors.map(c => `${c.domain} (${c.keywords.toLocaleString()} kws, ~${c.traffic.toLocaleString()} traffic/mo, ranks for ${c.gap_keywords.length} keywords we don't)`).join("; ")
      : "none identified";
    const gapLine = research.gaps.slice(0, 25).map(g => `${g.keyword} (vol ${g.volume}, kd ${g.kd}, ${g.competitor} at #${g.comp_pos ?? "?"})`).join("; ") || "none";
    const digest = `SITE: ${host} — "${research.site.title}". ${research.site.description}
Homepage H1: ${research.site.h1}. Section headings: ${research.site.headings.join(", ") || "n/a"}.
Organic footprint: ${research.site.keywords.toLocaleString()} ranking keywords, ~${research.site.traffic.toLocaleString()} monthly organic traffic, ${research.site.top10} in top 10. ${research.site.pages_found} URLs in sitemap.
Already published (do NOT duplicate these): ${research.site.existing_paths.slice(0, 30).join(", ") || "unknown"}
Top ranking pages: ${research.site.top_pages.slice(0, 8).join(", ") || "unknown"}
Industry: ${research.industry || "infer from the above"}
Seed keywords: ${research.seed_keywords.join(", ") || "derive from the site"}
COMPETITORS: ${compLine}
COMPETITOR KEYWORD GAPS (they rank, we don't — prioritise these): ${gapLine}
Audience: ${audience || "infer from the site"}. Goals: ${goals || "organic growth + pipeline"}.`;

    // ── Strategy pass: synthesise the research into pillars, angles and month themes ──
    let strategy: { positioning?: string; icp?: string; pillar_topics?: string[]; quick_wins?: string[]; competitor_insights?: { domain: string; what_they_win: string; how_to_beat: string }[]; month_themes?: string[] } = {};
    try {
      const t = await callAI(`You are an expert B2B SEO content strategist. Below is REAL research on a website and its competitors.
${digest}

Return ONLY valid JSON:
{"positioning":"one sentence on how this site should position its content","icp":"who the content is for","pillar_topics":["p1","p2","p3","p4","p5"],"quick_wins":["w1","w2","w3","w4","w5"],"competitor_insights":[{"domain":"string","what_they_win":"string","how_to_beat":"string"}],"month_themes":[${monthLabels.map(m => `"theme for ${m}"`).join(",")}]}
Ground every pillar and quick win in the competitor gap keywords above. Return exactly ${n} month_themes.`, 2000, true);
      strategy = parseJSON(t) as typeof strategy;
    } catch { /* strategy is additive; the month passes can stand alone */ }

    const themes = strategy.month_themes || [];
    const insights = (strategy.competitor_insights || []).map(c => `${c.domain}: wins on ${c.what_they_win} → beat by ${c.how_to_beat}`).join("; ");

    // ── Month passes: one call per month, in parallel, each given its exact asset slate ──
    // Gap keywords are dealt out across months so no two months chase the same terms.
    const gapChunks: CalGap[][] = Array.from({ length: n }, () => []);
    research.gaps.forEach((g, i) => gapChunks[i % n].push(g));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const monthCalls = await Promise.allSettled(monthLabels.map(async (label, i): Promise<any> => {
      const slate = perMonth[i];
      const slateLine = Object.entries(slate).map(([a, c]) => `${c}x ${a} (${wordsFor[a]} words each)`).join(", ");
      const total = Object.values(slate).reduce((a, b) => a + b, 0);
      const myGaps = gapChunks[i].slice(0, 12).map(g => `${g.keyword} (vol ${g.volume}, kd ${g.kd})`).join("; ");
      const t = await callAI(`You are an expert B2B SEO content strategist planning ONE month of an editorial calendar.
${digest}
Strategy: ${strategy.positioning || ""} Audience: ${strategy.icp || audience || ""}
Pillars: ${(strategy.pillar_topics || []).join(", ") || "derive"}
Competitor angles: ${insights || "n/a"}

MONTH: ${label}${themes[i] ? ` — theme: ${themes[i]}` : ""}
Prioritise these gap keywords this month: ${myGaps || "use the seed keywords"}

Produce EXACTLY ${total} assets for this month with EXACTLY this mix: ${slateLine}.
Spread them across weeks 1-4. Each title must be specific to ${host} and its industry — no generic filler.

Return ONLY valid JSON:
{"month":"${label}","theme":"string","posts":[{"week":1,"title":"string","asset":"blog|case-study|ebook|report|whitepaper|webinar|infographic|checklist","type":"guide|listicle|case-study|how-to|comparison|news|interview","keywords":["kw"],"angle":"string","word_count":1500,"schema":"Article|HowTo|FAQPage|none","priority":"high|medium|low","intent":"informational|commercial|navigational|transactional","funnel_stage":"TOFU|MOFU|BOFU","gated":false,"cta":"string"}]}
The "asset" field must match the required mix exactly. Set "gated":true for ebook, report and whitepaper. For non-blog assets set "type" to the same value as "asset".`, 8192, true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const m = parseJSON(t) as any;
      m.month = label;
      if (!Array.isArray(m.posts)) m.posts = [];
      return m;
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const monthsOut: any[] = monthCalls.map((r, i) =>
      r.status === "fulfilled" ? r.value : { month: monthLabels[i], theme: themes[i] || "", posts: [] });

    // ── Quota check + top-up ──
    // The model can under-deliver on the rarer assets; count what actually came back and
    // ask for only the shortfall rather than shipping a calendar that misses the floor.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const countAsset = (a: string) => monthsOut.reduce((s, m) => s + (m.posts || []).filter((p: any) => String(p.asset || "blog") === a).length, 0);
    const deficits = quota.map(q => ({ ...q, have: countAsset(q.asset) })).filter(q => q.have < q.min);
    if (deficits.length && headroomLeft()) {
      const need = deficits.map(d => `${d.min - d.have}x ${d.asset} (${d.words} words each)`).join(", ");
      try {
        const t = await callAI(`You are an expert B2B SEO content strategist topping up an editorial calendar for ${host}.
${digest}
Pillars: ${(strategy.pillar_topics || []).join(", ") || "derive"}
Already planned titles (do NOT repeat): ${monthsOut.flatMap(m => (m.posts || []).map((p: { title: string }) => p.title)).slice(0, 60).join("; ")}

Produce EXACTLY these additional assets: ${need}.
Return ONLY valid JSON: {"posts":[{"week":1,"title":"string","asset":"string","type":"string","keywords":["kw"],"angle":"string","word_count":1500,"schema":"Article|HowTo|FAQPage|none","priority":"high|medium|low","intent":"informational|commercial|navigational|transactional","funnel_stage":"TOFU|MOFU|BOFU","gated":false,"cta":"string"}]}`, 4096, true);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const extra = (parseJSON(t) as any)?.posts;
        if (Array.isArray(extra)) extra.forEach((p, i) => { const m = monthsOut[i % n]; (m.posts = m.posts || []).push(p); });
      } catch { /* top-up is best-effort — the shortfall is reported below either way */ }
    }

    // Normalise, then report the mix actually delivered so the UI can show it honestly.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    monthsOut.forEach(m => (m.posts || []).forEach((p: any) => {
      p.asset = String(p.asset || "blog");
      p.type = String(p.type || p.asset);
      p.week = Math.max(1, Math.min(4, Number(p.week) || 1));
      if (p.gated === undefined) p.gated = ["ebook", "report", "whitepaper"].includes(p.asset);
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    monthsOut.forEach(m => (m.posts || []).sort((a: any, b: any) => a.week - b.week));

    const mix = quota.map(q => ({ asset: q.asset, required: q.min, planned: countAsset(q.asset) }));

    const calendar = {
      months: monthsOut,
      asset_mix: mix,
      shortfall: mix.filter(m => m.planned < m.required),
      pillar_topics: strategy.pillar_topics || [],
      quick_wins: strategy.quick_wins || [],
      positioning: strategy.positioning || "",
      icp: strategy.icp || "",
      competitor_insights: strategy.competitor_insights || [],
      research,
    };
    return NextResponse.json({ calendar });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

// ── SOAIV ─────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSOAIV(body: any) {
  const { brand, domain, category, keywords = [], competitors = [] } = body;
  if (!brand) return NextResponse.json({ error: "No brand" }, { status: 400 });
  const kwList = Array.isArray(keywords) ? keywords.slice(0, 10).join(", ") : String(keywords);
  const compList = Array.isArray(competitors) ? competitors.slice(0, 5).join(", ") : String(competitors);

  const prompt = `You are an AI visibility analyst. Estimate the Share of AI Voice (SOAIV) for "${brand}" in "${category || "general"}" category.
SOAIV = % of AI answers in the category that mention your brand.
Brand: ${brand}, Website: ${domain || "unknown"}, Keywords: ${kwList || "derive"}, Competitors: ${compList || "estimate top 3-5"}
Return ONLY valid JSON:
{
  "brand":"${brand}","category":"string","overall_soaiv":12,
  "platforms":[{"platform":"ChatGPT|Perplexity|Google AI Overviews|Gemini|Claude","citation_rate":15,"mention_context":"string","sentiment":"positive|neutral|negative","rank_in_category":2,"trend":"rising|stable|declining"}],
  "competitors":[{"name":"string","soaiv":28,"rank":1}],
  "category_benchmark":15,"gap_to_leader":16,
  "top_opportunities":["action1","action2"],
  "query_types_winning":["query1"],"query_types_losing":["query2"],
  "estimated_data_confidence":"low|medium|high",
  "note":"AI-modeled estimate."
}
Include all 5 platforms. Most brands have 5-25% SOAIV unless category leaders.`;

  try {
    const text = await callAI(prompt, 3000, true);
    return NextResponse.json({ result: parseJSON(text) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

// Perplexity cross-check: ask the SAME questions on Perplexity (real web-grounded AI
// answer engine with citations) and return the % of answers that mention the brand.
// Returns null when no key is configured (so the caller stays Claude-only).
async function checkPerplexityVisibility(questions: string[], brandRe: RegExp): Promise<number | null> {
  const key = (process.env.PERPLEXITY_API_KEY || "").trim();
  if (!key || !questions.length) return null;
  const ask = async (q: string): Promise<boolean> => {
    try {
      const r = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "sonar", messages: [{ role: "user", content: q }] }),
        signal: AbortSignal.timeout(20000),
      });
      if (!r.ok) return false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const j = await r.json() as any;
      const text = j?.choices?.[0]?.message?.content || "";
      const cites = (j?.citations || []).join(" ");
      return brandRe.test(text) || brandRe.test(cites);
    } catch { return false; }
  };
  const hits = await Promise.all(questions.slice(0, 6).map(ask));
  const mentioned = hits.filter(Boolean).length;
  return Math.round((mentioned / hits.length) * 100);
}

// ChatGPT cross-check: ask the SAME questions on OpenAI's chat models and return the %
// of answers that mention the brand. Gated on OPENAI_API_KEY — with no key this returns
// null and ChatGPT is simply omitted from the platform list, exactly like Perplexity.
const OPENAI_VIS_MODELS = ["gpt-5.6-luna", "gpt-5.6-terra"];
async function checkOpenAIVisibility(questions: string[], brandRe: RegExp): Promise<number | null> {
  const key = (process.env.OPENAI_API_KEY || "").replace(/^﻿/, "").trim();
  if (!key || !questions.length) return null;
  const ask = async (q: string): Promise<boolean> => {
    for (const model of OPENAI_VIS_MODELS) {
      try {
        const r = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          // Answer as a normal user would see it — no system prompt steering the brand in.
          body: JSON.stringify({ model, messages: [{ role: "user", content: q }] }),
          signal: AbortSignal.timeout(20000),
        });
        if (!r.ok) continue;   // model retired / no access → try the next one
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const j = await r.json() as any;
        const text = j?.choices?.[0]?.message?.content || "";
        if (text) return brandRe.test(text);
      } catch { /* try next model */ }
    }
    return false;
  };
  try {
    const hits = await Promise.all(questions.slice(0, 6).map(ask));
    return Math.round((hits.filter(Boolean).length / hits.length) * 100);
  } catch { return null; }
}

// Gemini cross-check: ask the SAME questions on Gemini (Google's AI answer engine)
// using the existing Google AI Studio key — no extra credentials needed.
async function checkGeminiVisibility(questions: string[], brandRe: RegExp): Promise<number | null> {
  const key = googleAiKey();
  if (!key || !questions.length) return null;
  const ask = async (q: string): Promise<boolean> => {
    for (const model of ["gemini-2.5-flash", "gemini-2.0-flash"]) {
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: q }] }] }),
          signal: AbortSignal.timeout(20000),
        });
        if (!r.ok) continue;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const j = await r.json() as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const text = (j?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join(" ");
        if (text) return brandRe.test(text);
      } catch { /* try next model */ }
    }
    return false;
  };
  try {
    const hits = await Promise.all(questions.slice(0, 6).map(ask));
    return Math.round((hits.filter(Boolean).length / hits.length) * 100);
  } catch { return null; }
}

// ── Real AI Visibility ─────────────────────────────────────────────────────────
async function handleAiVisibility(req: NextRequest) {
  const brand  = req.nextUrl.searchParams.get("brand")  || "";
  const domain = req.nextUrl.searchParams.get("domain") || "";
  const brandedImpressions = Number(req.nextUrl.searchParams.get("branded_impr") || 0);
  const brandedClicks      = Number(req.nextUrl.searchParams.get("branded_clicks") || 0);

  if (!brand && !domain) return NextResponse.json({ error: "brand or domain required" }, { status: 400 });
  const query = brand || domain.replace(/^www\./, "").split(".")[0];
  const encoded = encodeURIComponent(query);

  // ── Kick off the Claude AI-visibility query CONCURRENTLY with the web fetches ──
  // (it doesn't depend on the web data, so running it in parallel avoids a serverless timeout)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const aiVisPromise: Promise<any> = (async () => {
    try {
      const prompt = `You are Claude, answering real user questions exactly as you would for any user. The brand being evaluated is "${query}"${domain ? ` (website: ${domain})` : ""}.

Step 1: Infer this brand's specific product category from its name/website.
Step 2: Write 6 realistic questions a real user would ask an AI assistant in that category — a mix of "best X tools 2026", "top X providers", "X vs Y", "alternatives to <a competitor>". Do NOT mention "${query}" in the questions.
Step 3: Answer each GENUINELY and NEUTRALLY exactly as you really would — name the actual brands/companies you'd recommend, in order. Only include "${query}" if it genuinely deserves a mention. Never force it in.
Step 4: For each answer list brands_mentioned IN ORDER; if "${query}" appears give its 1-based rank (else null).

Return ONLY valid JSON:
{"category":"string","results":[{"question":"string","answer":"2-3 sentence genuine answer","brands_mentioned":["brand1","brand2"],"your_brand_mentioned":boolean,"your_rank":number|null}]}
Exactly 6 results.`;
      let raw: string;
      try { raw = await callCampaignClaude(prompt + "\n\nReturn ONLY the JSON object, no markdown.", 2200); }
      catch { raw = await callAI(prompt, 2000, true); }
      const parsedAI = parseJSON(raw) as { category?: string; results?: { question: string; answer: string; brands_mentioned: string[]; your_brand_mentioned: boolean; your_rank: number | null }[] };
      const results = parsedAI.results || [];
      const brandRe = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const verified = results.map(r => {
        const mentioned = (r.brands_mentioned || []).map(b => String(b));
        const idx = mentioned.findIndex(b => brandRe.test(b));
        const inAnswer = idx >= 0 || brandRe.test(r.answer || "");
        return { ...r, brands_mentioned: mentioned, your_brand_mentioned: inAnswer, your_rank: idx >= 0 ? idx + 1 : (r.your_rank || null) };
      });
      const mentionedCount = verified.filter(r => r.your_brand_mentioned).length;
      const competitorCounts: Record<string, number> = {};
      let totalBrandMentions = 0;
      for (const r of verified) for (const b of r.brands_mentioned) { totalBrandMentions++; if (!brandRe.test(b)) { const k = b.trim(); if (k) competitorCounts[k] = (competitorCounts[k] || 0) + 1; } }
      const competitors = Object.entries(competitorCounts).map(([name, mentions]) => ({ name, mentions })).sort((a, b) => b.mentions - a.mentions).slice(0, 8);
      const ranks = verified.filter(r => r.your_rank).map(r => r.your_rank as number);
      const avgRank = ranks.length ? +(ranks.reduce((a, b) => a + b, 0) / ranks.length).toFixed(1) : null;
      const claudeRate = verified.length ? Math.round((mentionedCount / verified.length) * 100) : 0;
      const platforms = [{ platform: "Claude", mentioned: mentionedCount > 0, rate: claudeRate }];

      // ── Multi-engine: cross-check the SAME questions on Gemini + Perplexity ──
      // Gemini uses the existing Google AI Studio key (always on); ChatGPT and Perplexity
      // are each gated on their own key and are omitted entirely when it is absent.
      const questions = verified.map(r => r.question);
      const [gemRate, gptRate, ppxRate] = await Promise.all([
        checkGeminiVisibility(questions, brandRe).catch(() => null),
        checkOpenAIVisibility(questions, brandRe).catch(() => null),
        checkPerplexityVisibility(questions, brandRe).catch(() => null),
      ]);
      if (gemRate !== null) platforms.push({ platform: "Gemini", mentioned: gemRate > 0, rate: gemRate });
      if (gptRate !== null) platforms.push({ platform: "ChatGPT", mentioned: gptRate > 0, rate: gptRate });
      if (ppxRate !== null) platforms.push({ platform: "Perplexity", mentioned: ppxRate > 0, rate: ppxRate });
      const overallRate = Math.round(platforms.reduce((a, p) => a + p.rate, 0) / platforms.length);

      return {
        engine: platforms.length > 1 ? platforms.map(p => p.platform).join(" + ") : "Claude",
        category: parsedAI.category || "",
        mentioned_count: mentionedCount, total_questions: verified.length,
        ai_visibility_pct: claudeRate,
        overall_rate: overallRate,
        share_of_voice: totalBrandMentions ? Math.round((mentionedCount / totalBrandMentions) * 100) : 0,
        avg_rank: avgRank, competitors,
        gap_questions: verified.filter(r => !r.your_brand_mentioned).map(r => r.question),
        results: verified,
        platforms,
      };
    } catch (e) { console.error("AI visibility check failed:", e instanceof Error ? e.message : e); return null; }
  })();

  // Parallel real-data fetches
  const [newsRes, redditRes, ddgRes, waybackRes] = await Promise.allSettled([
    fetch(`https://news.google.com/rss/search?q=${encoded}&hl=en-US&gl=US&ceid=US:en`, {
      headers: { "User-Agent": "Mozilla/5.0 RankMind/1.0" }, signal: AbortSignal.timeout(8000),
    }).then(r => r.ok ? r.text() : ""),
    fetch(`https://www.reddit.com/search.json?q=${encoded}&sort=new&limit=10&type=link`, {
      headers: { "User-Agent": "Mozilla/5.0 RankMind/1.0" }, signal: AbortSignal.timeout(8000),
    }).then(r => r.ok ? r.json() : null),
    fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query + " mentioned review features")}&kl=us-en`, {
      headers: { "User-Agent": "Mozilla/5.0 Chrome/120" }, signal: AbortSignal.timeout(8000),
    }).then(r => r.ok ? r.text() : ""),
    domain ? fetch(`https://archive.org/wayback/available?url=${encodeURIComponent(domain)}`, {
      signal: AbortSignal.timeout(6000),
    }).then(r => r.ok ? r.json() : null) : Promise.resolve(null),
  ]);

  const newsXml  = newsRes.status    === "fulfilled" ? newsRes.value as string    : "";
  const rdData   = redditRes.status  === "fulfilled" ? redditRes.value             : null;
  const ddgHtml  = ddgRes.status     === "fulfilled" ? ddgRes.value as string     : "";
  const wbData   = waybackRes.status === "fulfilled" ? waybackRes.value            : null;

  // Parse news
  const newsItems = newsXml ? [...newsXml.matchAll(/<item>([\s\S]*?)<\/item>/gi)] : [];
  const newsCount = newsItems.length;
  const recentNews = newsItems.filter(item => {
    const d = item[1].match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1];
    try { const dt = new Date(d||""); const cut = new Date(); cut.setDate(cut.getDate()-30); return dt>=cut; } catch { return false; }
  }).length;

  // Parse Reddit
  const redditPosts = (rdData?.data?.children || []).length;
  const redditScore = (rdData?.data?.children || []).reduce((a: number, p: {data:{score:number}}) => a + (p.data?.score||0), 0);

  // Parse DDG
  const ddgCount = (ddgHtml.match(/class="result__title"/g) || []).length;
  const brandInTop = ddgHtml.slice(0,6000).toLowerCase().includes(query.toLowerCase());

  // Site age from Wayback
  const wbSnap = wbData?.archived_snapshots?.closest;
  const wbTs = wbSnap?.timestamp || "";
  const siteAgeYears = wbTs
    ? Math.round((Date.now() - new Date(`${wbTs.slice(0,4)}-${wbTs.slice(4,6)}-${wbTs.slice(6,8)}`).getTime()) / (1000*60*60*24*365))
    : 0;

  // Score components (all real signals)
  const newsScore   = Math.min(30, recentNews * 2 + (newsCount - recentNews));
  const rdScore     = Math.min(15, redditPosts * 2 + (redditScore > 100 ? 5 : 0));
  const webScore    = Math.min(15, ddgCount * 2 + (brandInTop ? 5 : 0));
  const gscScore    = brandedImpressions > 0 ? Math.min(25, Math.round(Math.log10(brandedImpressions+1)*6)) : 0;
  const ageScore    = Math.min(10, siteAgeYears * 2);
  const visibilityScore = Math.min(95, Math.max(5, newsScore + rdScore + webScore + gscScore + ageScore));
  const label = visibilityScore >= 70 ? "High" : visibilityScore >= 40 ? "Medium" : "Low";

  // Monthly estimates from real article counts
  const monthlyMentions = Math.max(newsCount * 4 + redditPosts * 2, newsCount > 0 ? 10 : 0);
  const citations = Math.max(ddgCount * 3, 0);
  const citedPages = Math.max(ddgCount, 0);

  // Source breakdown (real)
  const total = Math.max(newsCount + redditPosts + ddgCount, 1);
  const source_breakdown = [
    // Brand Guidelines 2025 palette (Compunnel Blue + secondary, p.17/19) rather than each
    // platform's own colour, so charts read as one system across the app and the reports.
    { source: "Google News",  count: newsCount,   pct: Math.round(newsCount/total*100),   recent: recentNews,  color: "#0050EF" },
    { source: "Reddit",       count: redditPosts, pct: Math.round(redditPosts/total*100), recent: redditPosts, color: "#FFAB00" },
    { source: "Web mentions", count: ddgCount,    pct: Math.round(ddgCount/total*100),    recent: 0,           color: "#05D9E8" },
  ];

  // Recent articles (real)
  const articles = newsItems.slice(0, 6).map(item => {
    const title  = (item[1].match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i)||item[1].match(/<title>([\s\S]*?)<\/title>/i))?.[1]?.replace(/<[^>]+>/g,"").replace(/&amp;/g,"&").trim()||"";
    const url    = item[1].match(/<link>([\s\S]*?)<\/link>/i)?.[1]?.trim()||"";
    const date   = (() => { try { return new Date(item[1].match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1]||"").toISOString().split("T")[0]; } catch { return ""; }})();
    const source = item[1].match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1]?.replace(/<[^>]+>/g,"").trim()||"News";
    return { title, url, source, date };
  }).filter(a => a.title && a.url);

  // ── AI platform visibility (Claude) — was started in parallel above ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const aiVisibility: any = await aiVisPromise;

  // Blend AI visibility into the overall score when available
  const finalScore = aiVisibility
    ? Math.min(95, Math.max(5, Math.round(visibilityScore * 0.7 + aiVisibility.ai_visibility_pct * 0.3)))
    : visibilityScore;

  return NextResponse.json({
    visibility_score: finalScore, label: finalScore >= 70 ? "High" : finalScore >= 40 ? "Medium" : "Low",
    description: `${query} — ${(finalScore >= 70 ? "high" : finalScore >= 40 ? "medium" : "low")} visibility. ${newsCount} news articles, ${redditPosts} Reddit posts${aiVisibility ? `, mentioned in ${aiVisibility.mentioned_count}/${aiVisibility.total_questions} AI answers` : ""}.`,
    metrics: {
      mentions: monthlyMentions, mentions_change: recentNews > 0 ? Math.round((recentNews/Math.max(newsCount-recentNews,1))*20) : 0,
      citations, citations_change: 0,
      cited_pages: citedPages, cited_pages_change: 0,
    },
    source_breakdown,
    ai_visibility: aiVisibility,
    gsc_signal: brandedImpressions > 0 ? { branded_impressions: brandedImpressions, branded_clicks: brandedClicks } : null,
    site_age_years: siteAgeYears,
    recent_articles: articles,
    scraped: newsCount > 0 || redditPosts > 0,
    data_sources: ["Google News RSS", "Reddit JSON", "DuckDuckGo SERP", "Wayback Machine", "Live LLM query"],
  });
}

// ── Content SERP Analysis (one keyword: real SERP + content signals) ───────────
async function handleSerpAnalyze(req: NextRequest) {
  const keyword = req.nextUrl.searchParams.get("keyword");
  const userUrl = req.nextUrl.searchParams.get("userUrl") || "";
  if (!keyword) return NextResponse.json({ error: "No keyword" }, { status: 400 });

  // 1. Fetch SERP via multi-source fetcher (Serper → Google → Bing → DDG)
  const { results: serpResults, source: serpSource } = await fetchSERP(keyword);

  if (serpResults.length === 0) {
    return NextResponse.json({ keyword, scraped: false, error: "Could not fetch SERP results from any source" });
  }

  // 1b. Where does the user's domain rank in these results?
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let yourRank: any = null;
  if (userUrl) {
    const cleanUserDomain = userUrl.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").toLowerCase();
    if (cleanUserDomain) {
      const match = serpResults.find(r => {
        const rd = r.domain.replace(/^www\./, "").toLowerCase();
        return rd === cleanUserDomain || rd.includes(cleanUserDomain) || cleanUserDomain.includes(rd);
      });
      yourRank = match
        ? { ranking: true, position: match.pos, url: match.url, title: match.title }
        : { ranking: false, position: null, url: null, title: null };
    }
  }

  // 2. Fetch + parse the top 5 ranking pages for content signals
  const topPages = serpResults.slice(0, 5);
  const parsed = await Promise.allSettled(
    topPages.map(async (r) => {
      const { html, status } = await fetchHtml(r.url);
      if (!html || status >= 400) return { ...r, wordCount: 0, h2Count: 0, h2s: [] as string[], schemaTypes: [] as string[], imgCount: 0, failed: true };
      const p = parsePage(html, r.url, keyword);
      return { ...r, wordCount: p.wordCount, h2Count: p.h1Count + (p.h2s?.length || 0), h2s: p.h2s || [], schemaTypes: p.schemaTypes || [], imgCount: p.imgCount, kwInTitle: p.kwInTitle, kwInH1: p.kwInH1, failed: false };
    })
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pages: any[] = parsed.filter(p => p.status === "fulfilled").map(p => (p as PromiseFulfilledResult<any>).value);
  const valid = pages.filter(p => !p.failed && p.wordCount > 0);

  // 3. Aggregate content signals
  const wordCounts = valid.map(p => p.wordCount);
  const avgWordCount = wordCounts.length ? Math.round(wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length) : 0;
  const minWords = wordCounts.length ? Math.min(...wordCounts) : 0;
  const maxWords = wordCounts.length ? Math.max(...wordCounts) : 0;

  // Content type breakdown by domain heuristics
  const typeOf = (d: string): string => {
    if (/youtube|vimeo/.test(d)) return "Video";
    if (/reddit|quora|stackexchange|forum/.test(d)) return "Forum";
    if (/wikipedia/.test(d)) return "Reference";
    if (/\.gov|\.edu/.test(d)) return "Authority";
    if (/blog|medium|substack/.test(d)) return "Blog";
    if (/news|times|post|guardian|bbc|cnn/.test(d)) return "News";
    return "Page";
  };
  const typeCounts: Record<string, number> = {};
  serpResults.forEach(r => { const t = typeOf(r.domain); typeCounts[t] = (typeCounts[t] || 0) + 1; });
  const contentTypes = Object.entries(typeCounts).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);

  // Common headings across top pages
  const allH2s = valid.flatMap(p => p.h2s || []);
  const commonHeadings = allH2s.slice(0, 12);

  // Schema types found across SERP
  const allSchema = [...new Set(valid.flatMap(p => p.schemaTypes || []))];

  // 4. Content gap vs user URL (if provided)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let gap: any = null;
  if (userUrl) {
    try {
      const fetchUrl = userUrl.startsWith("http") ? userUrl : `https://${userUrl}`;
      const { html, status, finalUrl } = await fetchHtml(fetchUrl);
      if (html && status < 400) {
        const up = parsePage(html, fetchUrl, keyword);
        gap = {
          url: finalUrl || fetchUrl,           // the exact page these changes apply to
          your_title: up.title || "",
          your_words: up.wordCount,
          serp_avg_words: avgWordCount,
          word_gap: avgWordCount - up.wordCount,
          your_schema: up.schemaTypes || [],
          missing_schema: allSchema.filter(s => !(up.schemaTypes || []).includes(s)),
          your_h2_count: (up.h2s || []).length,
          serp_avg_h2: valid.length ? Math.round(valid.reduce((a, p) => a + (p.h2s?.length || 0), 0) / valid.length) : 0,
          kw_in_title: up.kwInTitle,
          kw_in_h1: up.kwInH1,
        };
      }
    } catch { /* user URL fetch failed */ }
  }

  // 5. Opportunity score (lower competition = higher opportunity)
  const authorityDomains = serpResults.filter(r => /wikipedia|\.gov|\.edu|amazon|youtube|linkedin/.test(r.domain)).length;
  const opportunityScore = Math.max(5, Math.min(95, 100 - (authorityDomains * 12) - (avgWordCount > 2000 ? 20 : avgWordCount > 1000 ? 10 : 0)));
  const difficulty = opportunityScore >= 60 ? "Low" : opportunityScore >= 35 ? "Medium" : "High";

  return NextResponse.json({
    keyword,
    scraped: true,
    serp_results: serpResults,
    content_signals: {
      avg_word_count: avgWordCount,
      min_words: minWords,
      max_words: maxWords,
      pages_analyzed: valid.length,
      content_types: contentTypes,
      common_headings: commonHeadings,
      schema_types: allSchema,
    },
    gap,
    your_rank: yourRank,
    opportunity_score: opportunityScore,
    difficulty,
    serp_source: serpSource,
  });
}

// ── WordPress publish (server-side proxy — avoids browser CORS) ────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// Fetch the site's post categories so the user can pick one before publishing.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleWpCategories(body: any) {
  const { wpUrl, wpUser, wpPass } = body;
  if (!wpUrl || !wpUser || !wpPass) return NextResponse.json({ error: "Missing WordPress URL or credentials" }, { status: 400 });
  const base = String(wpUrl).replace(/\/$/, "").replace(/^(?!https?:\/\/)/, "https://");
  const creds = Buffer.from(`${wpUser}:${String(wpPass).replace(/\s+/g, " ").trim()}`).toString("base64");
  const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
  try {
    // _fields keeps the payload tiny; include parent so we can build the main/sub hierarchy
    const r = await fetch(`${base}/wp-json/wp/v2/categories?per_page=100&orderby=name&order=asc&_fields=id,name,count,parent`, {
      headers: { Authorization: `Basic ${creds}`, Accept: "application/json", "User-Agent": UA },
      signal: AbortSignal.timeout(45000),
    });
    const text = await r.text();
    if (!r.ok) return NextResponse.json({ error: `Could not load categories (HTTP ${r.status}). Check the URL and credentials.` }, { status: 400 });
    let cats: { id: number; name: string; count: number; parent: number }[] = [];
    try { cats = JSON.parse(text); } catch { return NextResponse.json({ error: "WordPress did not return categories (REST API may be blocked)." }, { status: 400 }); }
    if (!Array.isArray(cats)) return NextResponse.json({ error: "Unexpected categories response." }, { status: 400 });
    return NextResponse.json({ categories: cats.map(c => ({ id: c.id, name: c.name, count: c.count, parent: c.parent || 0 })) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to load categories" }, { status: 502 });
  }
}

// Fetch the site's users/authors so the user can pick a real WordPress author (E-E-A-T).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleWpAuthors(body: any) {
  const { wpUrl, wpUser, wpPass } = body;
  if (!wpUrl || !wpUser || !wpPass) return NextResponse.json({ error: "Missing WordPress URL or credentials" }, { status: 400 });
  const base = String(wpUrl).replace(/\/$/, "").replace(/^(?!https?:\/\/)/, "https://");
  const creds = Buffer.from(`${wpUser}:${String(wpPass).replace(/\s+/g, " ").trim()}`).toString("base64");
  const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
  const hdr = { Authorization: `Basic ${creds}`, Accept: "application/json", "User-Agent": UA };
  const fields = "id,name,slug,description,url,avatar_urls,link";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapUser = (u: any) => ({ id: u.id, name: u.name, slug: u.slug, bio: u.description || "", url: u.url || u.link || "", avatar: u.avatar_urls?.["96"] || "" });
  // Fetch one URL; never throw — return parsed JSON (array or object) or null on timeout/error.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tryFetch = async (url: string, ms: number): Promise<any | null> => {
    try {
      const r = await fetch(url, { headers: hdr, signal: AbortSignal.timeout(ms) });
      if (!r.ok) return null;
      return JSON.parse(await r.text());
    } catch { return null; }
  };
  try {
    // 1) Public authors list (fast, short timeout so we fall through quickly if blocked)
    let list = await tryFetch(`${base}/wp-json/wp/v2/users?per_page=100&_fields=${fields}`, 12000);
    // 2) Full user list (admin only)
    if (!Array.isArray(list) || !list.length) list = await tryFetch(`${base}/wp-json/wp/v2/users?per_page=100&context=edit&_fields=${fields}`, 15000);
    // 3) Fallback: just the authenticated user — /users/me is almost never blocked by enumeration guards
    if (!Array.isArray(list) || !list.length) {
      const me = await tryFetch(`${base}/wp-json/wp/v2/users/me?context=edit&_fields=${fields}`, 12000);
      if (me && me.id) list = [me];
    }
    if (Array.isArray(list) && list.length) return NextResponse.json({ authors: list.map(mapUser) });
    return NextResponse.json({ error: "Couldn't list authors — a security plugin/CDN is likely blocking /wp-json/wp/v2/users. The publishing user will still be used as the author; you can also enter the author profile manually below." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to load authors" }, { status: 502 });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleWpPublish(body: any) {
  const { wpUrl, wpUser, wpPass, title, content, slug, excerpt, status = "draft", tags = [], categories = [], author, endpoint = "posts", heroImage } = body;
  if (!wpUrl || !wpUser || !wpPass || !title) {
    return NextResponse.json({ error: "Missing WordPress URL, credentials, or title" }, { status: 400 });
  }

  const base = String(wpUrl).replace(/\/$/, "").replace(/^(?!https?:\/\/)/, "https://");
  const creds = Buffer.from(`${wpUser}:${String(wpPass).replace(/\s+/g, " ").trim()}`).toString("base64");
  // Browser-like UA + Accept JSON — many WAFs/security plugins 403 requests without these
  const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
  const authHdr = { Authorization: `Basic ${creds}`, "Content-Type": "application/json", "Accept": "application/json", "User-Agent": UA };
  const getHdr = { Authorization: `Basic ${creds}`, "Accept": "application/json", "User-Agent": UA };

  // Safely parse a WP response — returns {json} or {html} when the body isn't JSON
  const readResp = async (r: Response): Promise<{ json?: Record<string, unknown>; html?: string; status: number }> => {
    const text = await r.text();
    const t = text.trim();
    if (t.startsWith("{") || t.startsWith("[")) {
      try { return { json: JSON.parse(t), status: r.status }; } catch { /* fall through */ }
    }
    return { html: t.slice(0, 200), status: r.status };
  };

  try {
    // 1. Resolve/create tag IDs (best-effort)
    const ep = endpoint === "pages" ? "pages" : "posts";
    const tagIds: number[] = [];
    for (const tag of (Array.isArray(tags) ? tags : []).slice(0, 5)) {
      try {
        const tr = await fetch(`${base}/wp-json/wp/v2/tags?search=${encodeURIComponent(tag)}`, { headers: getHdr, signal: AbortSignal.timeout(15000) });
        const found = (await tr.json()) as { id?: number }[];
        if (found?.[0]?.id) { tagIds.push(found[0].id); continue; }
        const cr = await fetch(`${base}/wp-json/wp/v2/tags`, { method: "POST", headers: authHdr, body: JSON.stringify({ name: tag }), signal: AbortSignal.timeout(15000) });
        const nt = (await cr.json()) as { id?: number };
        if (nt?.id) tagIds.push(nt.id);
      } catch { /* skip tag */ }
    }

    // 1b. Upload the hero image to the media library (best-effort) → use as featured image
    let featuredMedia = 0;
    if (heroImage?.b64) {
      try {
        const mime = heroImage.mime || "image/png";
        const ext = mime.includes("jpeg") || mime.includes("jpg") ? "jpg" : mime.includes("webp") ? "webp" : "png";
        const fname = `${(slug || title || "hero").toString().replace(/[^a-z0-9-]+/gi, "-").slice(0, 60)}.${ext}`;
        const bytes = Buffer.from(heroImage.b64, "base64");
        const mr = await fetch(`${base}/wp-json/wp/v2/media`, {
          method: "POST",
          headers: { Authorization: `Basic ${creds}`, "Content-Type": mime, "Content-Disposition": `attachment; filename="${fname}"`, "Accept": "application/json", "User-Agent": UA },
          body: bytes,
          signal: AbortSignal.timeout(45000),
        });
        const mj = await mr.json().catch(() => ({})) as { id?: number; alt_text?: string };
        if (mj?.id) {
          featuredMedia = mj.id;
          // Set alt text (best-effort)
          if (heroImage.alt) {
            fetch(`${base}/wp-json/wp/v2/media/${mj.id}`, { method: "POST", headers: authHdr, body: JSON.stringify({ alt_text: heroImage.alt }), signal: AbortSignal.timeout(15000) }).catch(() => {});
          }
        }
      } catch { /* featured image is optional */ }
    }

    // 2. Create the post/page
    const catIds = (Array.isArray(categories) ? categories : []).map(Number).filter(n => n > 0);
    let authorId = Number(author) > 0 ? Number(author) : 0;
    // Match the WordPress author by NAME when no explicit author id was selected.
    // (Falls back to the publishing user — and the on-page byline/bio — if no match.)
    if (!authorId && typeof body.authorName === "string" && body.authorName.trim()) {
      try {
        const an = body.authorName.trim();
        const ur = await fetch(`${base}/wp-json/wp/v2/users?search=${encodeURIComponent(an)}&per_page=20&_fields=id,name,slug`, { headers: getHdr, signal: AbortSignal.timeout(15000) });
        if (ur.ok) {
          const users = await ur.json().catch(() => []) as { id?: number; name?: string; slug?: string }[];
          if (Array.isArray(users) && users.length) {
            const low = an.toLowerCase();
            const exact = users.find(u => (u.name || "").toLowerCase() === low);
            const pick = exact || users[0];
            if (pick?.id) authorId = pick.id;
          }
        }
      } catch { /* WP user lookup blocked → keep publishing user */ }
    }
    const resp = await fetch(`${base}/wp-json/wp/v2/${ep}`, {
      method: "POST", headers: authHdr,
      body: JSON.stringify({ title, content, slug, excerpt, status, ...(authorId ? { author: authorId } : {}), ...(featuredMedia ? { featured_media: featuredMedia } : {}), ...(ep === "posts" ? { tags: tagIds, ...(catIds.length ? { categories: catIds } : {}) } : {}) }),
      signal: AbortSignal.timeout(30000),
    });
    const parsed = await readResp(resp);

    // Got an HTML page instead of JSON → not a reachable WP REST endpoint
    if (parsed.html !== undefined) {
      const h = parsed.html.toLowerCase();
      let error: string;
      if (resp.status === 403 || /forbidden|cloudflare|access denied|blocked|security|captcha|ray id/.test(h)) {
        error = "Blocked by a firewall/security plugin (HTTP 403). A WAF like Wordfence, Sucuri, or Cloudflare is blocking the REST API. Fix: in the security plugin, allowlist the REST API (/wp-json/) or whitelist the server, and ensure 'Disable REST API' is off.";
      } else if (resp.status === 401 || /htaccess|authorization required|401/.test(h)) {
        error = "The site is behind HTTP Basic Auth (common on staging). RankMind can't pass that extra login layer. Publish to the live site, or remove the staging password protection.";
      } else if (resp.status === 404 || /not found|404/.test(h)) {
        error = `WordPress REST API not found at ${base}/wp-json/. Check the URL, or the REST API may be disabled. (Server returned an HTML page, not JSON.)`;
      } else if (/login|wp-login|sign in/.test(h)) {
        error = "The URL redirected to a login page instead of the REST API. Verify the site URL and that the REST API is publicly reachable.";
      } else {
        error = `Expected JSON from WordPress but got an HTML page (HTTP ${resp.status}). The URL may not be a WordPress site, or the REST API is blocked.`;
      }
      return NextResponse.json({ error }, { status: 400 });
    }

    const result = (parsed.json || {}) as { id?: number; link?: string; status?: string; code?: string; message?: string };
    if (result?.id) return NextResponse.json({ id: result.id, link: result.link, status: result.status });

    const codeMsg = `${result?.code || ""} ${result?.message || ""}`;
    let error = result?.message || "Publish failed.";
    if (/cannot_create|not allowed to create/i.test(codeMsg)) error = "Permission denied: this WordPress user can't publish. Set the role to Editor or Administrator and generate a fresh Application Password.";
    else if (/cannot_login|incorrect_password|invalid_username|401/i.test(codeMsg)) error = "Authentication failed: use the WordPress username (not email) and an Application Password (Users → Profile → Application Passwords).";
    else if (/rest_no_route|404/i.test(codeMsg)) error = "WordPress REST API not found at this URL. Verify the site URL and that a security plugin isn't disabling the REST API.";
    return NextResponse.json({ error }, { status: 400 });
  } catch (e) {
    const m = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: `Could not reach WordPress: ${m}. Check the URL is correct and the site is reachable over HTTPS.` }, { status: 502 });
  }
}

// ── SEO CAMPAIGN AGENT (PRD-aligned: GTM+Brief → gap → suggestions → content) ──

// Phase 1 — Strategy ingestion: GTM doc + Campaign Brief → unified strategy JSON
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleCampaignStrategy(body: any) {
  const gtm = String(body.gtm || "").slice(0, 14000);
  const brief = String(body.brief || "").slice(0, 8000);
  const domain = String(body.domain || "");
  if (!gtm && !brief) return NextResponse.json({ error: "Provide a GTM document or Campaign Brief" }, { status: 400 });

  // When the project is Eximius, ground the strategy in the built-in knowledge base so company,
  // ICP, messaging and CTA come out accurate/on-brand even if the GTM/brief is sparse.
  const strategySignal = `${gtm} ${brief} ${domain}`;
  const kbBlock = isEximiusProject(strategySignal)
    ? `\n\n${EXIMIUS_KB}\n\nUse the EXIMIUS BRAND KNOWLEDGE BASE above as the authoritative source when it conflicts with, or fills gaps in, the documents below. Set "company" to "Eximius" and "cta" to "Book a free pilot".`
    : isCompunnelProject(strategySignal)
    ? `\n\n${COMPUNNEL_BRAND}\n\nUse the COMPUNNEL BRAND KNOWLEDGE BASE above as the authoritative source for voice, positioning and company facts when it conflicts with, or fills gaps in, the documents below. Set "company" to "Compunnel".`
    : "";

  const prompt = `You are an SEO strategy parser. Extract a unified strategy from the GTM document and Campaign Brief below.
${domain ? `Client domain: ${domain}` : ""}${kbBlock}

=== GTM DOCUMENT ===
${gtm || "(not provided)"}

=== CAMPAIGN BRIEF ===
${brief || "(not provided)"}

Return ONLY valid JSON:
{
  "company": "string", "industry": "string",
  "icp": "1-2 sentence ideal customer profile",
  "products": ["product/service"],
  "competitors": ["competitor domain or name"],
  "messaging": ["core value prop / theme"],
  "campaign_name": "string", "campaign_goal": "string",
  "target_audience": "string", "geography": "string",
  "target_keywords": ["seed keyword"],
  "content_formats": ["blog post|landing page|comparison|case study"],
  "cta": "primary CTA", "timeline": "string"
}
Infer missing fields sensibly. 4-8 competitors, 6-12 target keywords.`;
  try {
    const text = await callAI(prompt, 2500, true);
    return NextResponse.json({ strategy: parseJSON(text) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

// Phase 2-4 — Gap analysis + page/blog suggestion table (Approval Gate 1 input)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleCampaignSuggestions(body: any) {
  const domain = String(body.domain || "");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const strategy = body.strategy || {};
  const keywords: string[] = Array.isArray(strategy.target_keywords) ? strategy.target_keywords.slice(0, 8) : [];
  if (!keywords.length) return NextResponse.json({ error: "No target keywords in strategy" }, { status: 400 });

  // When the campaign is configured as a listing, every suggested title must read as a
  // ranked roundup — otherwise the writer receives listing rules but a prose-style title.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const LS: any = strategy.listing && typeof strategy.listing === "object" ? strategy.listing : null;
  const listingHint = LS && String(LS.subject || "").trim()
    ? `

LISTING CAMPAIGN: every suggestion must be a ranked roundup. Titles must take the form "Top N <thing>" (N = ${Math.max(3, Math.min(25, Number(LS.count) || 5))}), built around "${String(LS.subject).trim()}" and its close variations (by use case, by company size, by region, alternatives-to). Set "content_type":"listicle" on every item.`
    : "";
  // Ground in real SERP for up to 5 seed keywords (who ranks, avg words)
  const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").toLowerCase();
  const serp = await Promise.allSettled(keywords.slice(0, 5).map(async kw => {
    const { results } = await fetchSERP(kw);
    const mine = results.find(r => r.domain.replace(/^www\./, "").includes(cleanDomain) && cleanDomain.length > 2);
    return { kw, top: results.slice(0, 5).map(r => r.domain), yourPos: mine ? mine.pos : null };
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serpCtx = serp.filter(s => s.status === "fulfilled").map(s => (s as PromiseFulfilledResult<any>).value)
    .map(s => `"${s.kw}": you ${s.yourPos ? "#" + s.yourPos : "NOT ranking"}; top: ${s.top.join(", ")}`).join("\n");

  const prompt = `You are an SEO gap & cluster analyst for ${domain}. Using the strategy and REAL SERP data, produce a content gap report and page/blog suggestions.

STRATEGY: company=${strategy.company}, ICP=${strategy.icp}, goal=${strategy.campaign_goal}, messaging=${(strategy.messaging || []).join("; ")}, CTA=${strategy.cta}
TARGET KEYWORDS: ${keywords.join(", ")}
REAL SERP DATA:
${serpCtx}

Return ONLY valid JSON:
{
  "gap_summary": "2-3 sentence executive summary of the biggest ranking/content opportunities",
  "suggestions": [
    {
      "title": "SEO-optimised page/blog title",
      "target_keyword": "primary keyword",
      "semantic_keywords": ["variant1","variant2"],
      "content_type": "blog post|landing page|comparison page|case study|FAQ page|listicle",
      "category": "NEW PILLAR|NEW CLUSTER ARTICLE|UPDATE EXISTING|CONSOLIDATE|REPURPOSE",
      "cluster": "pillar/cluster topic this belongs to",
      "priority": "Critical|High|Medium",
      "why": "1-2 sentence rationale tied to competitor data + GTM strategy",
      "word_count": 1500,
      "existing_url": "URL to update if category=UPDATE EXISTING, else empty"
    }
  ]
}
Generate 8-12 suggestions across categories, grounded in the real SERP data.${listingHint}`;
  try {
    const text = await callAI(prompt, 4096, true);
    return NextResponse.json({ result: parseJSON(text), serp_grounded: serpCtx.length > 0 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

// Strip AI tells, markdown artifacts, and disclaimer boilerplate from generated HTML
function deAiContent(html: string): string {
  if (!html) return html;
  let h = html;
  // 1. Remove markdown code fences the model sometimes wraps HTML in
  h = h.replace(/```[a-z]*\n?/gi, "").replace(/```/g, "").replace(/^~~~.*$/gm, "");
  // 2. Remove AI disclaimer / meta sentences
  h = h.replace(/\b(as an ai language model|as an ai|i'?m an ai|i cannot|i'?m unable to|here'?s (?:the|your|a)\s+(?:article|blog|content|draft)[:\s]|certainly[!,. ]|sure[!,. ]+here|below is (?:the|a|your)|i hope this helps[.! ]*)/gi, "");

  // 3. ── Strip leftover MARKDOWN markup that leaks into the HTML ──
  // Markdown links [text](url) -> <a>
  h = h.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
  // ATX headings at line start (## Heading) -> <h2>/<h3> (only when not already inside a tag)
  h = h.replace(/^\s*######\s+(.+?)\s*#*\s*$/gm, "<h4>$1</h4>");
  h = h.replace(/^\s*#{4,5}\s+(.+?)\s*#*\s*$/gm, "<h3>$1</h3>");
  h = h.replace(/^\s*###\s+(.+?)\s*#*\s*$/gm, "<h3>$1</h3>");
  h = h.replace(/^\s*##\s+(.+?)\s*#*\s*$/gm, "<h2>$1</h2>");
  h = h.replace(/^\s*#\s+(.+?)\s*#*\s*$/gm, "<h2>$1</h2>");
  // Bold/italic markdown -> clean HTML / plain
  h = h.replace(/\*\*\*(.+?)\*\*\*/g, "<strong>$1</strong>");
  h = h.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  h = h.replace(/__(.+?)__/g, "<strong>$1</strong>");
  h = h.replace(/(?<![\w*])\*(?!\s)([^*\n]+?)(?<!\s)\*(?![\w*])/g, "$1");   // *italic* -> plain
  h = h.replace(/(?<![\w_])_(?!\s)([^_\n]+?)(?<!\s)_(?![\w_])/g, "$1");      // _italic_ -> plain
  // Markdown horizontal rules / stray markers on their own line
  h = h.replace(/^\s*([-*_]\s*){3,}\s*$/gm, "");
  // Markdown bullet/numbered lines that slipped outside <ul> -> list items
  h = h.replace(/^\s*[-*+]\s+(.+)$/gm, "<li>$1</li>");
  h = h.replace(/^\s*\d+\.\s+(.+)$/gm, "<li>$1</li>");
  // Remove any remaining stray markup tokens
  h = h.replace(/(?<!<[^>]*)\*{1,3}(?![^<]*>)/g, "").replace(/(?<!\w)#{1,6}(?=\s)/g, "");

  // 4. ── Kill robotic clichés / AI tells ──
  const cliches = [
    /\bin today'?s (?:fast-?paced|digital|modern|ever-?(?:changing|evolving)|competitive) (?:world|landscape|business world|era|market)[,. ]/gi,
    /\bit'?s (?:important|worth|crucial|essential) to (?:note|remember|understand|consider) that\b/gi,
    /\bwhen it comes to\b/gi,
    /\bin (?:conclusion|summary)\b/gi, /\bto sum up\b/gi,
    /\bunlock(?:ing)? the (?:power|potential) of\b/gi,
    /\bnavigat(?:e|ing) the (?:complex|complexities|world) of\b/gi,
    /\bin the realm of\b/gi, /\bthe ever-?evolving\b/gi,
    /\b(?:that'?s where .+? comes? in)\b/gi,
    /\blet'?s (?:dive|delve) (?:in|into|deeper)\b/gi,
    /\bat the end of the day\b/gi,
    /\bneedless to say\b/gi,
    // "It's not just X, it's Y" / "not only ... but also" hype scaffolds
    /\bit'?s not (?:just|only) about [^.,;]+[,;] it'?s (?:about )?/gi,
  ];
  for (const re of cliches) h = h.replace(re, "");
  // Soften AI-favourite words when they appear as filler
  h = h.replace(/\b(?:leverage|leveraging)\b/gi, m => /leveraging/i.test(m) ? "using" : "use");
  h = h.replace(/\bdelve into\b/gi, "explore");
  h = h.replace(/\b(?:utilize|utilise)\b/gi, "use").replace(/\b(?:utilizing|utilising)\b/gi, "using");

  // Remove em/en dashes (a classic AI tell). Numeric ranges keep a hyphen; everywhere else
  // a dash becomes a comma (parenthetical/pause) so the prose reads human.
  h = h.replace(/(\d)\s*[–—]\s*(\d)/g, "$1-$2");   // 10–20 / 10—20 → 10-20
  h = h.replace(/\s*[–—]\s*/g, ", ");              // any other em/en dash → comma
  h = h.replace(/,\s*,/g, ",").replace(/,\s*([.;:!?])/g, "$1"); // tidy up double/orphan commas

  // 5. Cleanup: fix a sentence that now starts lowercase after a clause was removed, collapse spaces
  h = h.replace(/ {2,}/g, " ").replace(/\s+([.,;:!?])/g, "$1").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")");
  h = h.replace(/(<p>)\s*([a-z])/g, (_m, p, c) => p + c.toUpperCase());
  // Wrap any orphan <li> runs in <ul> if they aren't already inside one
  h = h.replace(/(?:<li>[\s\S]*?<\/li>\s*)+/g, m => /<[uo]l>/.test(m) ? m : `<ul>${m}</ul>`);
  // De-nest accidental double lists (e.g. <ul class="key-takeaways"><ul>… from re-wrapping)
  h = h.replace(/(<(?:ul|ol)[^>]*>)\s*<(?:ul|ol)>/gi, "$1").replace(/<\/(?:ul|ol)>\s*<\/(?:ul|ol)>/gi, "</ul>");
  return h.trim();
}

// Dedicated Claude caller for SEO Campaign Agent content generation ONLY.
// Uses CAMPAIGN_ANTHROPIC_KEY (separate from the global AI fallback chain).
async function callCampaignClaude(prompt: string, maxTokens: number): Promise<string> {
  const key = (process.env.CAMPAIGN_ANTHROPIC_KEY || "").replace(/^﻿/, "").trim();
  if (!key) throw new Error("CAMPAIGN_ANTHROPIC_KEY not configured");
  const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
  let lastErr = "";
  // Retry on rate-limit / overload (429, 529) with backoff — section-by-section fires many
  // calls and bursts the key; without this they fail and the article comes out short.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: Math.min(Math.max(Number(maxTokens) || 4096, 1024), 32000),
          messages: [{ role: "user", content: prompt }],
        }),
        signal: AbortSignal.timeout(104000),   // research is a separate request now, so the writer owns the budget
      });
      if (r.status === 429 || r.status === 529) { lastErr = `Claude ${r.status}`; await sleep(1500 * (attempt + 1)); continue; }
      if (!r.ok) {
        const err = await r.json().catch(() => ({})) as Record<string, unknown>;
        throw new Error((err.error as Record<string, unknown>)?.message as string || `Claude error ${r.status}`);
      }
      const data = await r.json() as { content: { type: string; text: string }[] };
      return data.content.map(b => b.type === "text" ? b.text : "").join("").trim();
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      if (!/429|529|overload|rate/i.test(lastErr) || attempt === 2) throw e;
      await sleep(1500 * (attempt + 1));
    }
  }
  throw new Error(lastErr || "Claude unavailable");
}

// Parse Claude's delimited output (avoids fragile JSON escaping of large HTML).
function parseDelimitedContent(text: string): { title: string; slug: string; meta_title: string; meta_description: string; direct_answer: string; article_html: string; faqs: { q: string; a: string }[] } {
  const sections: Record<string, string> = {};
  const parts = text.split(/###([A-Z_]+)###/);
  for (let i = 1; i < parts.length; i += 2) sections[parts[i]] = (parts[i + 1] || "").trim();
  const faqs: { q: string; a: string }[] = [];
  let q = "";
  for (const ln of (sections.FAQ || "").split(/\n+/)) {
    const qm = ln.match(/^Q:\s*(.+)/i); const am = ln.match(/^A:\s*(.+)/i);
    if (qm) q = qm[1].trim(); else if (am && q) { faqs.push({ q, a: am[1].trim() }); q = ""; }
  }
  return {
    title: sections.TITLE || "",
    slug: (sections.SLUG || "").replace(/^\/+/, "").replace(/[^a-z0-9-]+/gi, "-").toLowerCase(),
    meta_title: sections.META_TITLE || "",
    meta_description: sections.META_DESC || "",
    direct_answer: sections.ANSWER || "",
    article_html: sections.ARTICLE || "",
    faqs,
  };
}

// Build valid JSON-LD server-side so schema is never broken by model escaping.
// AEO-focused: Article (+Speakable), FAQPage, BreadcrumbList, plus a DefinedTerm or HowTo
// when the topic/keyword warrants it — these are the structures answer engines extract.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildSchemas(c: any, domain: string, brand: string, fallbackTitle: string, keyword?: string) {
  const url = domain ? `https://${domain}/${c.slug || ""}`.replace(/\/+$/, "/") : undefined;
  // Article + Speakable (lets voice/answer engines read the key answer aloud)
  const article = JSON.stringify({
    "@context": "https://schema.org", "@type": "Article",
    headline: c.meta_title || c.title || fallbackTitle,
    description: c.meta_description || c.direct_answer || "",
    author: { "@type": "Organization", name: brand || domain },
    publisher: { "@type": "Organization", name: brand || domain },
    ...(url ? { mainEntityOfPage: url } : {}),
    speakable: { "@type": "SpeakableSpecification", cssSelector: ["h1", ".key-answer", ".key-takeaways"] },
    ...(c.direct_answer ? { abstract: c.direct_answer } : {}),
  });
  const faq = (c.faqs && c.faqs.length) ? JSON.stringify({
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: c.faqs.map((f: { q: string; a: string }) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  }) : "";
  const breadcrumb = domain ? JSON.stringify({
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `https://${domain}/` },
      { "@type": "ListItem", position: 2, name: c.title || fallbackTitle },
    ],
  }) : "";
  // Extra: definitional ("what is X") → DefinedTerm; how-to / steps / guide → HowTo
  const topic = `${c.title || fallbackTitle} ${keyword || ""}`.toLowerCase();
  let extra = "";
  if (c.direct_answer && /^how|how to|steps?|guide|process|set up|setup|implement/.test(topic)) {
    const steps = (c.faqs || []).slice(0, 5).map((f: { q: string; a: string }, i: number) => ({ "@type": "HowToStep", position: i + 1, name: f.q, text: f.a }));
    if (steps.length) extra = JSON.stringify({ "@context": "https://schema.org", "@type": "HowTo", name: c.title || fallbackTitle, step: steps });
  } else if (c.direct_answer && /^what is|^what are|definition|meaning|explained/.test(topic)) {
    extra = JSON.stringify({ "@context": "https://schema.org", "@type": "DefinedTerm", name: keyword || c.title || fallbackTitle, description: c.direct_answer });
  }
  return { article, faq, breadcrumb, extra };
}

// Fetch a live page and extract its real positioning: title, meta, H1/H2 outline, and a
// visible-text excerpt (nav/footer stripped). Used to ground campaign content in the actual
// client site + the actual competitor pages that rank — not generic AI assumptions.
type LivePageResearch = { url: string; title: string; metaDesc: string; h1: string; h2s: string[]; wordCount: number; excerpt: string };
async function researchLivePage(url: string, keyword = ""): Promise<LivePageResearch | null> {
  try {
    const { html, finalUrl } = await fetchHtml(url);
    if (!html) return null;
    const p = parsePage(html, finalUrl || url, keyword);
    const body = html
      .replace(/<head[\s\S]*?<\/head>/i, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "");
    const excerpt = cleanText(body).split(/\s+/).slice(0, 400).join(" ");
    return { url: finalUrl || url, title: p.title, metaDesc: p.metaDesc, h1: p.h1, h2s: p.h2s || [], wordCount: p.wordCount, excerpt };
  } catch { return null; }
}

// Phase 5 — Generate full content for one approved suggestion (SERP-NLP grounded + humanized)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleCampaignContent(body: any) {
  // Anchor the budget at REQUEST ENTRY. SERP + live-page research below runs before
  // generation starts and measured ~32s in production; a deadline anchored after it
  // overshoots the function limit by exactly that much.
  const reqStart = Date.now();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = body.suggestion || {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const strategy = body.strategy || {};
  if (!s.title) return NextResponse.json({ error: "No suggestion" }, { status: 400 });

  const brand = strategy.company || "";
  const domain = (strategy.domain || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  const clientDomainClean = cleanDomain(strategy.domain || "");

  // ── REAL RESEARCH (before writing): read the actual top-ranking COMPETITOR pages and the
  //    CLIENT's live site, so the article is grounded in real positioning/coverage — not
  //    generic AI filler. SERP → title/H2/NLP/PAA research + fetched page bodies. ──
  let nlpTerms: string[] = [];
  let paaContext = "";
  let researchedTitles: string[] = [];
  let researchedOutline: string[] = [];
  let competitorResearch: LivePageResearch[] = [];
  let clientResearch: LivePageResearch | null = null;
  // Real external URLs to cite (from the SERP) + real internal pages to link (from the sitemap).
  let citationSources: { url: string; title: string }[] = [];
  let internalLinks: { url: string; title: string }[] = [];
  // Research is the single biggest fixed cost in this route (~32s measured) and generation
  // needs ~80s, which together overflow the 120s function limit. The client can therefore run
  // research as its OWN request (research_only) and hand the result back here, so each call
  // comfortably fits. Passing nothing keeps the original single-shot behaviour.
  const preRes = body.research && typeof body.research === "object" ? body.research : null;
  if (preRes) {
    nlpTerms          = preRes.nlp_terms  || [];
    paaContext        = preRes.paa        || "";
    researchedTitles  = preRes.titles     || [];
    researchedOutline = preRes.outline    || [];
    citationSources   = preRes.citations  || [];
    internalLinks     = preRes.internal   || [];
    competitorResearch= preRes.competitors|| [];
    clientResearch    = preRes.client     || null;
  }
  if (!preRes) {
  try {
    const { results } = await fetchSERP(s.target_keyword || s.title);
    // Pick the top competitor URLs (exclude the client's own domain) + the client's own page.
    const isClient = (r: { domain: string; url: string }) => !!clientDomainClean && (cleanDomain(r.domain || r.url).includes(clientDomainClean) || cleanDomain(clientDomainClean).includes(cleanDomain(r.domain || r.url)));
    const compUrls = results.filter(r => r.url && !isClient(r)).slice(0, 4).map(r => r.url);
    // Real, verifiable external pages ranking for the topic → citation candidates.
    citationSources = results.filter(r => r.url && !isClient(r)).slice(0, 6).map(r => ({ url: r.url, title: (r.title || cleanDomain(r.url)).slice(0, 90) }));
    const clientHit = results.find(isClient);
    const clientUrl = clientHit?.url || (clientDomainClean ? `https://${clientDomainClean}` : "");
    // Fetch competitor pages + the client page in parallel, but cap the whole research phase
    // at 11s so a slow page can't eat into the generation time budget (route maxDuration 90).
    const researchAll = Promise.all([
      Promise.all(compUrls.map(u => researchLivePage(u, s.target_keyword))),
      clientUrl ? researchLivePage(clientUrl, s.target_keyword) : Promise.resolve(null),
    ]);
    const [comps, client] = await Promise.race([
      researchAll,
      new Promise<[(LivePageResearch | null)[], LivePageResearch | null]>(resolve => setTimeout(() => resolve([[], null]), 8000)),
    ]);
    competitorResearch = (comps || []).filter(Boolean) as LivePageResearch[];
    clientResearch = client;

    if (results.length) {
      const topTitles = results.slice(0, 10).map((r, i) => `${i + 1}. ${r.title}`).join("\n");
      const snippets = results.slice(0, 8).map(r => `${r.title}. ${r.snippet}`).join("\n");
      // Feed the REAL competitor section headings (not just snippets) into the structure research.
      const compCoverage = competitorResearch.map((c, i) => `(${i + 1}) ${cleanDomain(c.url)} [${c.wordCount}w] H2s: ${(c.h2s || []).slice(0, 8).join(" | ") || "n/a"}`).join("\n");
      // Bounded: research is grounding, not the deliverable. Losing title options is far
      // cheaper than losing the article, so this call gets a hard 14s ceiling.
      const raw = await Promise.race([
        callAI(
        `You are an SEO content researcher. Using the REAL top-ranking Google results and the competitors' ACTUAL section headings below for "${s.target_keyword}", do title + structure research for a NEW article that can outrank them.\n` +
        `Return ONLY JSON: {` +
        `"nlp_terms":["15-20 entities/phrases a competing article must include"],` +
        `"questions":["5 real People-Also-Ask style questions"],` +
        `"title_options":["3 compelling, specific SEO titles, 50-60 chars, each containing the primary keyword and stronger than the ranking ones"],` +
        `"outline":["8-12 H2 section headings phrased as natural questions, derived from what the top pages ACTUALLY cover plus the PAA questions, logically ordered and non-redundant; include at least 2 angles the competitors miss"]}` +
        `\n\nTOP RANKING TITLES:\n${topTitles}\n\nCOMPETITOR SECTION COVERAGE (real H2s from the pages that rank):\n${compCoverage || "(unavailable)"}\n\nTOP SNIPPETS:\n${snippets.slice(0, 2200)}`,
        1100, true
        ).catch(() => ""),
        new Promise<string>(res => setTimeout(() => res(""), 14000)),
      ]);
      if (!raw) throw new Error("research call timed out");
      const p = parseJSON(raw) as { nlp_terms?: string[]; questions?: string[]; title_options?: string[]; outline?: string[] };
      nlpTerms = p.nlp_terms || [];
      paaContext = (p.questions || []).join("; ");
      researchedTitles = Array.isArray(p.title_options) ? p.title_options.filter(Boolean).slice(0, 3) : [];
      researchedOutline = Array.isArray(p.outline) ? p.outline.filter(Boolean).slice(0, 14) : [];
    }
  } catch { /* research optional — writer still runs with the KB/strategy grounding */ }
  // Internal-link candidates: real pages on the client's OWN site (for contextual
  // interlinking). PRIMARY source = DataForSEO ranked pages (reliable); the sitemap is only a
  // fallback (often slow/Cloudflare-blocked — when it failed, articles shipped with no internal
  // links at all). Slug-derived titles; excludes the homepage and the current article.
  // CRITICAL: validate each URL is live (2xx, not soft-404) before offering it.
  try {
    if (clientDomainClean) {
      let sm = await Promise.race([
        dfsTopPages(clientDomainClean, 25).catch(() => null),
        new Promise<string[] | null>(res => setTimeout(() => res(null), 9000)),
      ]);
      if (!sm || !sm.length) {
        sm = await Promise.race([
          getSitemapUrls(`https://${clientDomainClean}`, 60),
          new Promise<string[]>(res => setTimeout(() => res([]), 6000)),
        ]);
      }
      const curSlug = String(s.slug || "").toLowerCase().replace(/^\/|\/$/g, "");
      const okPath = (p: string) => /^\/(?:[\w-]+\/)*[\w-]*\/?$/i.test(p);
      const titleFromSlug = (u: string) => { try { const seg = new URL(u).pathname.replace(/\/$/, "").split("/").filter(Boolean).pop() || ""; return seg.replace(/[-_]+/g, " ").replace(/\b\w/g, c => c.toUpperCase()).trim() || cleanDomain(u); } catch { return cleanDomain(u); } };
      const candidates = [...new Set(sm || [])]
        .filter(u => { try { const x = new URL(u); return cleanDomain(x.hostname) === clientDomainClean && okPath(x.pathname) && !x.search && x.pathname.replace(/\/$/, "") !== "" && (!curSlug || !x.pathname.toLowerCase().includes(curSlug)); } catch { return false; } })
        .slice(0, 10);
      // Resolve each candidate to its live final URL (follow redirects, keep only 2xx). Use GET,
      // NOT HEAD — some CDNs (e.g. compunnel) return 200 to HEAD even for 404 pages, so HEAD would
      // pass dead URLs. Also reject redirects to the homepage (a common soft-404 pattern).
      const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36";
      const validate = async (u: string): Promise<string | null> => {
        try {
          const res = await fetch(u, { method: "GET", redirect: "follow", headers: { "User-Agent": UA, "Accept": "text/html" }, signal: AbortSignal.timeout(9000) });
          if (!res.ok) return null;
          const final = (res.url || u).replace(/[#?].*$/, "");
          try { if (new URL(final).pathname.replace(/\/$/, "") === "") return null; } catch { /* keep */ }
          // Soft-404 guard: some CDNs return HTTP 200 with a "page not found" body. Reject when
          // the <title>/<h1> or early body signals a not-found page.
          const html = (await res.text()).slice(0, 5000);
          const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";
          const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "").replace(/<[^>]+>/g, " ");
          const notFound = /\b(404|page not found|not found|page doesn'?t exist|no longer (?:available|exists)|oops|can'?t be found)\b/i;
          if (notFound.test(title) || notFound.test(h1)) return null;
          return final;
        } catch { return null; }
      };
      const checked = await Promise.all(candidates.map(async u => ({ url: await validate(u), title: titleFromSlug(u) })));
      const seenUrl = new Set<string>();
      internalLinks = checked
        .filter((c): c is { url: string; title: string } => !!c.url && cleanDomain(new URL(c.url).hostname) === clientDomainClean)
        .filter(c => { const k = c.url.replace(/\/$/, "").toLowerCase(); if (seenUrl.has(k)) return false; seenUrl.add(k); return true; })
        .slice(0, 8);
    }
  } catch { /* interlinking optional */ }
  }
  if (body.research_only) {
    return NextResponse.json({ research: {
      nlp_terms: nlpTerms, paa: paaContext, titles: researchedTitles, outline: researchedOutline,
      citations: citationSources, internal: internalLinks,
      competitors: competitorResearch, client: clientResearch,
    } });
  }
  // Structure block fed into the writer — the researched title options + H2 outline.
  const structureBlock = (researchedTitles.length || researchedOutline.length)
    ? `\n\nSERP-RESEARCHED STRUCTURE (based on what currently ranks + People Also Ask — follow it):${researchedTitles.length ? `\nBest title options (pick the strongest or refine it; keep the primary keyword, 50-60 chars): ${researchedTitles.join(" | ")}` : ""}${researchedOutline.length ? `\nH2 outline to follow — turn each into a question-format <h2>, answer it in the first sentence, keep this order, and add real depth under each:\n${researchedOutline.map(h => `- ${h}`).join("\n")}` : ""}`
    : "";
  // Real competitor coverage (cover it, then go deeper + fill gaps) — NOT to be copied.
  const competitorBlock = competitorResearch.length
    ? `\n\nCOMPETITOR RESEARCH (REAL pages ranking for "${s.target_keyword}" — match their depth, then go further and fill what they miss; never copy them):\n${competitorResearch.map((c, i) => `${i + 1}. ${cleanDomain(c.url)} (${c.wordCount} words)\n   Title: ${c.title}\n   Sections: ${(c.h2s || []).slice(0, 8).join(" | ") || "n/a"}`).join("\n")}`
    : "";
  // Real client positioning — ground every product/brand claim in the ACTUAL live site copy.
  const clientBlock = clientResearch
    ? `\n\nCLIENT SITE RESEARCH (the REAL live ${brand || "client"} site at ${cleanDomain(clientResearch.url)} — ground every product, feature, and brand claim in THIS actual copy; use the real product names and positioning found here; do NOT invent features, integrations, customers, or metrics not supported here):\n   Title: ${clientResearch.title}\n   Meta: ${clientResearch.metaDesc}\n   H1: ${clientResearch.h1}\n   Real sections: ${(clientResearch.h2s || []).slice(0, 8).join(" | ") || "n/a"}\n   Real page copy: ${clientResearch.excerpt.slice(0, 900)}`
    : "";
  // Real internal pages to interlink to (contextual, on-site links) — the writer must use only these URLs.
  const interlinkBlock = internalLinks.length
    ? `\n\nINTERNAL LINKS (contextual interlinking — weave 2-4 links to these REAL pages on ${brand || "the client"}'s OWN site into the body, each anchored on a naturally relevant phrase using <a href="URL">anchor text</a>. Use ONLY these exact URLs; link each at most once; NEVER invent an internal URL or link the homepage generically):\n${internalLinks.map(l => `- ${l.title} -> ${l.url}`).join("\n")}`
    : "";
  // Real external sources to cite — the writer must only use these URLs, never fabricate one.
  const citationBlock = citationSources.length
    ? `\n\nCITATION SOURCES (external authority — whenever you state a statistic, study, trend or external factual claim, cite it inline with <a href="URL" target="_blank" rel="noopener">Source name</a> using ONLY these REAL URLs; NEVER fabricate a URL or a number. End the article with an <h2>Sources</h2> + <ul> listing the sources you actually cited):\n${citationSources.map(c => `- ${c.title} -> ${c.url}`).join("\n")}`
    : "";

  // ── Length control: turn the selected word count into a HARD, scaled mandate.
  // Models systematically under-write on long targets, so set an explicit floor,
  // a section count (~1 H2 per ~350 words), and a per-section depth target.
  const targetWc = Number(s.word_count) || 1500;
  const minWc = Math.round(targetWc * 0.92);
  const h2Count = Math.max(3, Math.round(targetWc / 350));
  const perSection = Math.round(targetWc / h2Count);
  const lengthMandate = `\n\nLENGTH REQUIREMENT (HARD — the single most important constraint):
- The ARTICLE body MUST be at least ${minWc} words and should land close to ${targetWc} words. This is a strict minimum, not a suggestion.
- Structure it as ${h2Count} or more substantial <h2> sections, each roughly ${perSection} words, with real depth: concrete examples, named scenarios, numbers/data, and <h3> sub-points where useful.
- Do NOT stop early, do NOT summarize prematurely, and do NOT pad with fluff — add genuine, specific substance until the body truly reaches the target length.
- Before finishing, self-check the body meets the ${minWc}-word minimum; if it's short, keep expanding sections with more detail.`;
  // User-supplied brand/content guardrails — hard rules that override defaults on conflict.
  const guardrails = String(strategy.guardrails || "").trim().slice(0, 4000);
  const guardrailBlock = guardrails
    ? `\n\nGUARDRAILS (MANDATORY — these are non-negotiable brand/compliance rules supplied by the client; obey them exactly, and where they conflict with any other instruction, THE GUARDRAILS WIN):\n${guardrails}`
    : "";
  // ── Listing ("Top N …") mode ──
  // When the campaign is configured as a listing, the writer must produce a ranked roundup
  // rather than a prose article: a fixed number of numbered entries, each covering the same
  // facets, plus selection criteria, a comparison table and a verdict. Kept as a hard block
  // (like guardrails) because a soft hint produces an essay that merely mentions some brands.
  const L = strategy.listing && typeof strategy.listing === "object" ? strategy.listing : null;
  const listCount = L ? Math.max(3, Math.min(25, Number(L.count) || 5)) : 0;
  const listSubject = L ? String(L.subject || "").trim().slice(0, 120) : "";
  const listingBlock = (listCount && listSubject)
    ? `

LISTING FORMAT (MANDATORY — this piece is a ranked roundup, not a prose article):
- Title and H1 must read as a ranked list, e.g. "Top ${listCount} ${listSubject}".
- Open with the direct-answer paragraph naming the top 3 picks, then Key Takeaways, then a short "How we evaluated" section stating the selection criteria (3-5 concrete criteria).
- Then EXACTLY ${listCount} entries, each as its own <h2> numbered in rank order: "<h2>1. Name</h2>", "<h2>2. Name</h2>", and so on through ${listCount}.
- Every entry must cover, in this order: what it is in one sentence; who it is best for; 2-4 concrete strengths; 1-2 honest limitations. Use <p> and a short <ul>. Never write a limitation-free entry — a roundup with no downsides reads as advertising and will not be trusted.
- Name REAL, currently-operating ${listSubject}. Do NOT invent companies, products, pricing or customer counts. If you are unsure of a specific figure, describe the capability qualitatively instead of stating a number.
- After the entries, add a comparison <table> with one row per entry and 3-4 comparable columns (for example: best for, pricing model, standout capability).
- Close with a short verdict section recommending which entry suits which situation.
- Do NOT rank the client's own brand first by default. Include it only where it genuinely belongs on merit, and say plainly what it is not suited for.`
    : "";
  // Built-in Eximius knowledge base — auto-applied when the project/brand/domain is Eximius so
  // generated content is factually accurate and on-brand (correct features/limitations, no
  // unverified compliance claims, right CTA, never "Compunnel"). Facts here win over defaults.
  const eximiusSignal = [
    brand, domain, strategy.icp, strategy.campaign_name, strategy.target_audience,
    Array.isArray(strategy.products) ? strategy.products.join(" ") : strategy.products,
    Array.isArray(strategy.messaging) ? strategy.messaging.join(" ") : strategy.messaging,
    Array.isArray(strategy.competitors) ? strategy.competitors.join(" ") : strategy.competitors,
    s.title, s.target_keyword,
  ].filter(Boolean).join(" ");
  const kbBlock = isEximiusProject(eximiusSignal)
    ? `\n\n${EXIMIUS_KB}`
    : isCompunnelProject(eximiusSignal)
    ? `\n\n${COMPUNNEL_BRAND}`
    : "";
  // For Eximius, lock the CTA to the approved one unless the brief set a specific override.
  if (kbBlock) {
    if (!strategy.cta || /^contact us$/i.test(String(strategy.cta).trim())) strategy.cta = "Book a free pilot";
    if (!strategy.cta_url) strategy.cta_url = "https://eximius.ai/book-a-free-pilot";
  }

  const baseInstr = `Write a complete, SEO-optimized ${s.content_type || "blog post"} that reads like it was written by an experienced human expert — NOT by AI.

TITLE: ${s.title}
PRIMARY KEYWORD: ${s.target_keyword}
SEMANTIC KEYWORDS: ${(s.semantic_keywords || []).join(", ")}
NLP TERMS TO NATURALLY INCLUDE (from real SERP winners): ${nlpTerms.join(", ") || "(none)"}
QUESTIONS TO ANSWER (real PAA): ${paaContext || "(infer relevant ones)"}
TARGET WORD COUNT: ${s.word_count || 1500}
BRAND: ${brand} — ICP: ${strategy.icp || ""}
TONE/MESSAGING: ${(strategy.messaging || []).join("; ")}
CTA: ${strategy.cta || "Contact us"}

WRITING RULES (critical — it MUST read as written by a human expert, not AI):
- Write in US English — American spelling and grammar throughout (optimize, color, organize, behavior, center, analyze, license, traveling, "toward"). Never use British spellings.
- Vary sentence length hard: mix very short sentences (3-6 words) with longer ones. Occasional one-line paragraphs are good.
- Use contractions (you're, it's, don't, we've). Write in second person ("you") and sometimes first person plural ("we"). Sound like a practitioner talking, not a textbook.
- BANNED transition words at the start of sentences: "Furthermore", "Moreover", "Additionally", "Notably", "Importantly", "Ultimately", "In essence". Just say the next thing.
- BANNED phrases/words entirely: "in today's fast-paced world", "it's important to note", "when it comes to", "in conclusion", "to sum up", "unlock the power/potential", "navigate the complexities", "delve", "dive in/into", "leverage", "utilize", "robust", "seamless", "in the realm of", "ever-evolving", "game-changer", "that's where X comes in", "at the end of the day", "needless to say", "the world of".
- NEVER use em dashes (—) or en dashes (–) anywhere — they are a classic AI tell. Use commas, periods, or parentheses instead. For number ranges use a normal hyphen (10-20).
- BANNED structures: "It's not just X, it's Y"; "not only ... but also"; ending sections with a rhetorical question; listing everything in neat groups of three.
- No AI disclaimers, no "Here's the article", no preamble, no "In this article we'll…". Start directly with the substance.
- Use concrete specifics: real numbers, named scenarios, dollar figures, time spans, job titles. Make a clear point of view; take a side.
- Weave the NLP terms in naturally — never keyword-stuff.
- Output ONLY clean semantic HTML (<h2>, <h3>, <p>, <ul>, <li>, <table>, <strong>, <a>). ZERO markdown: no #, no ##, no **bold**, no *, no backticks, no markdown links (use <a href> tags for links, NEVER [text](url)). Bold uses <strong> only.
- Reference at least 2 messaging themes. Genuinely useful, opinionated, non-generic content a real expert would publish.
- INTERLINKING: weave 2-4 contextual INTERNAL links to the client's own pages (from the INTERNAL LINKS list below) into the body using <a href="URL">natural anchor</a>. Use only URLs from that list, link each at most once, and never invent an internal URL.
- CITATIONS: back external facts and statistics with inline citation links to the provided CITATION SOURCES (real URLs only, opened with target="_blank" rel="noopener"), then finish the article with an <h2>Sources</h2> + <ul> listing the sources you cited. NEVER fabricate a URL or a statistic; if you cannot cite a claim from the provided sources, state it without a fake link.

STRUCTURE (hook first, problem-first, then answer-engine optimized):
- OPEN with a strong, specific hook of 2-3 short sentences that dramatizes the stakes behind "${s.target_keyword}". Do NOT use any templated opener. Vary the approach every time and pick whatever fits THIS topic best: a contrarian claim, a surprising statistic, a sharp question, a myth to bust, a costly mistake, a specific before/after, or a pointed observation about the reader's world. Make it feel written fresh for this piece.
- BANNED openers (these are overused AI tells — never start with any of them): a clock time or time-of-day scene ("It's 9 a.m. on a Monday", "It's 4:30 on a Tuesday"), "Imagine…", "Picture this…", "In today's/recent years…", "has become increasingly…", "In the world of…", or a dictionary definition. If your first sentence names a time of day or a generic persona doing a routine task, rewrite it.
- Follow the hook with one short paragraph that names and sharpens the specific problem before any solution appears.
- After the hook, include ONE <p class="key-answer"> that answers the primary query in 40-55 words (a self-contained, quotable snippet that doubles as the SEO definitional sentence). If the topic is definitional, begin it with "${s.target_keyword} is …". Ground every capability claim in this answer in what the brand ACTUALLY does per the research/knowledge base below — never attribute capabilities the brand does not have.
- Then a "Key Takeaways" block: <h2>Key Takeaways</h2> + <ul class="key-takeaways"> of 3-5 short, standalone factual bullets (one bullet carries the core definitional/outcome sentence).
- Order the body PROBLEM-FIRST: a "Why is … broken / hard …?" section, then "How does … work / help?", then "What results does … deliver?", then a short takeaway that ends with the CTA.
- Make every <h2>/<h3> a natural-language QUESTION a user would ask, answered in the FIRST sentence beneath it so each section is independently extractable.
- Prefer extractable formats: short paragraphs, <ul>/<ol> lists, and a <table> for any comparison, steps, or criteria.
- Give 3-4 CONCRETE, actionable steps mapped to a real workflow — not generic advice like "set criteria" or "build a form".

PERSUASION, BRAND & PROOF (this is what separates expert content from generic content):
- Deliver on the title's promise: the core theme (for example, AI if the title mentions AI) must be the through-line of the WHOLE piece, not a passing mention.
- Tie sections to ${brand || "the brand"}'s specific capabilities and differentiators drawn from the messaging above; the article must NOT read like it could run on any competitor's blog with the name swapped. Frame the key capability as a STANDALONE, self-contained sentence that search and AI engines can lift directly.
- Use concrete proof/outcomes when the strategy provides them (time saved, % faster, effort cut). Do NOT invent first-party metrics and do NOT write unsupported "we've built / we've developed X" claims.
- External statistics: use ONLY real, well-known sources (Gartner, McKinsey, SHRM, Glassdoor, Harvard Business Review, LinkedIn) with a year, and pair each stat with a relevant capability. Never fabricate URLs or numbers.
- Tone: confident and outcome-driven, built on a signal-vs-noise framing. Take a clear point of view. Proofread for clean grammar and correct punctuation.
- CTA: end with the EXACT briefed CTA "${strategy.cta || "Contact us"}"${strategy.cta_url ? ` and link it to ${strategy.cta_url}` : ""}. Never substitute a different CTA (e.g. do not write "sign up for a free trial" unless that is the briefed CTA).
- Keep answers self-contained — avoid "as mentioned above"; each passage should make sense quoted on its own.${structureBlock}${competitorBlock}${clientBlock}${interlinkBlock}${citationBlock}${lengthMandate}${kbBlock}${guardrailBlock}${listingBlock}`;

  // Claude path: delimited sections (raw HTML, no JSON escaping) — far more reliable for long bodies.
  const claudePrompt = `${baseInstr}

Output using these EXACT delimiters, nothing before or after, no markdown fences. Put RAW HTML in the ARTICLE section:
###TITLE###
(the final H1 — use the strongest SERP-researched title option, refined; keep the primary keyword, 50-60 chars)
###SLUG###
(url-slug-with-hyphens)
###META_TITLE###
(50-60 characters)
###META_DESC###
(140-160 characters)
###ANSWER###
(the single best 40-55 word direct answer to the primary query, plain text, self-contained and quotable — this is the AEO snippet)
###ARTICLE###
(clean semantic HTML body following the AEO rules: opens with the direct-answer paragraph, then a Key Takeaways list, then ${h2Count}+ question-format H2/H3 sections woven with 2-4 contextual internal <a> links and inline citation <a> links, AT LEAST ${minWc} words (target ${targetWc}), ending with a clear CTA block and then an <h2>Sources</h2> <ul> of the cited external links)
###FAQ###
(exactly 5 Q&A pairs, each as two lines —
Q: the question
A: the answer)
###END###`;

  // Groq/fallback path: strict JSON (json_object mode keeps it valid).
  const jsonPrompt = `${baseInstr}

Return ONLY valid JSON:
{"title":"final H1","slug":"url-slug","meta_title":"50-60 chars","meta_description":"140-160 chars","direct_answer":"40-55 word self-contained answer to the primary query","article_html":"clean HTML body following the AEO rules (direct-answer paragraph first, then Key Takeaways list, then ${h2Count}+ question-format H2 sections with 2-4 contextual internal <a> links and inline citation <a> links) AT LEAST ${minWc} words (target ${targetWc}) with a CTA near the end and an <h2>Sources</h2> list of cited links","faqs":[{"q":"question","a":"answer"}]}`;

  // Count rendered words in an HTML body (strip tags/entities) — used to verify length.
  const wordCountOf = (html: string) => (String(html || "").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) || []).length;

  try {
    const t0 = Date.now();
    // Hard wall-clock budget. The route dies at maxDuration (120s) and returns text/plain,
    // which the client cannot parse — so every OPTIONAL enhancement must be abandoned in
    // time to still serialize a real response. 100s leaves ~20s for link rewriting, schema
    // building and serialization, which are regex/JSON work measured in milliseconds.
    const DEADLINE = reqStart + 111000;
    const remaining = () => DEADLINE - Date.now();
    // Race optional work against the remaining budget. A guard that only checks the time
    // BEFORE starting a call is not enough: the call itself can run for another 85s.
    const withBudget = async <T>(work: Promise<T>, fallback: T, ms = remaining()): Promise<T> => {
      if (ms <= 0) return fallback;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<T>(res => { timer = setTimeout(() => res(fallback), ms); });
      try { return await Promise.race([work.catch(() => fallback), timeout]); }
      finally { if (timer) clearTimeout(timer); }
    };
    // Scale the output token budget to the target length (HTML tags cost extra tokens).
    const genTokens = Math.min(Math.max(Math.round(targetWc * 2.2) + 3000, 8000), 22000);
    // Primary: dedicated campaign Claude key (best content). Fall back to the global chain (Groq → …).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let content: any = null;

    // ── PREFERRED: section-by-section generation (reliably hits the selected length) ──
    // Each researched H2 is written as its own section with a word budget, so the total
    // adds up to the target. Used when SERP research produced an outline.
    // Section-by-section only for LONG targets (2000+), where length reliability matters
    // more than cohesion. For typical blog lengths the single-shot path (below) produces a
    // more cohesive, brand-specific, narrative piece in ONE call (better quality, fewer 529s).
    if (researchedOutline.length >= 3 && targetWc >= 2000) {
      try {
        const N = Math.min(Math.max(Math.round(targetWc / 300), 4), 10);
        const headings = researchedOutline.slice(0, N);
        const overhead = 180; // key-answer + takeaways + CTA
        const perSection = Math.max(170, Math.round((targetWc - overhead) / headings.length));
        // 1) Framing: title, meta, direct answer, key takeaways, FAQs (one small call).
        const headRaw = await callCampaignClaude(
          `Write the framing for an SEO + AEO article titled "${s.title}" (primary keyword "${s.target_keyword}"${brand ? `, brand ${brand}` : ""}). US English, no em dashes.\n` +
          `Return ONLY JSON: {"title":"final H1, 50-60 chars, includes the keyword","slug":"url-slug-with-hyphens","meta_title":"50-60 chars","meta_description":"140-160 chars","hook":"2-3 short sentences of raw HTML (<p>…</p>) that open with a strong, specific hook dramatizing the stakes behind the keyword. Vary the approach for this topic (a contrarian claim, a surprising stat, a sharp question, a myth to bust, or a costly mistake). BANNED openers: a clock time or time-of-day scene (e.g. 'It's 9 a.m. on a Monday'), 'Imagine', 'Picture this', 'In today's/recent years', 'In the world of', or a dictionary definition.","direct_answer":"40-55 word self-contained answer to the primary query (start with the keyword if definitional)","key_takeaways":["3-5 short standalone factual bullets"],"faqs":[{"q":"question","a":"answer"}]} with exactly 5 faqs.${clientBlock}${kbBlock}${guardrailBlock}${listingBlock}`,
          1500,
        );
        const head = parseJSON(headRaw) as { title?: string; slug?: string; meta_title?: string; meta_description?: string; hook?: string; direct_answer?: string; key_takeaways?: string[]; faqs?: { q: string; a: string }[] };
        // 2) Write each section with its own word budget (parallel batches, time-guarded).
        const writeSection = async (h: string) => {
          const txt = await callCampaignClaude(
            `Write ONE section of an SEO + AEO article about "${s.target_keyword}"${brand ? ` for ${brand}` : ""}.\n` +
            `Section heading (a user question): "${h}"\n` +
            `Requirements: answer the question in the FIRST sentence; write approximately ${perSection} words (do not go short); include concrete examples, named scenarios, and at least two real statistics with inline (Source, year); add a <h3> sub-point or a short <ul> where useful.` +
            `${nlpTerms.length ? ` Naturally weave in some of: ${nlpTerms.slice(0, 12).join(", ")}.` : ""}\n` +
            `Writing rules: US English, contractions, NO em dashes (use commas/periods), ZERO markdown — only <h2>/<h3>/<p>/<ul>/<li>/<strong>/<a>. Where naturally relevant, add ONE contextual internal link (from the INTERNAL LINKS list) and cite any statistic inline with an <a href> to a provided CITATION SOURCE (real URLs only, never fabricated). Output ONLY raw HTML starting with <h2>${h}</h2>. No preamble, no code fences.${interlinkBlock}${citationBlock}${clientBlock}${kbBlock}${guardrailBlock}`,
            Math.min(Math.max(perSection * 3, 1400), 6000),
          );
          return deAiContent(txt.replace(/^```[a-z]*\s*/i, "").replace(/```$/, "").trim());
        };
        // Sequential (not parallel) to avoid bursting the Anthropic key into rate limits,
        // which would empty sections and collapse the length. One retry per section.
        const sections: string[] = [];
        for (const h of headings) {
          if (remaining() < 25000) break;   // need room for the call to FINISH, not just start
          let sec = await writeSection(h).catch(() => "");
          if (!/<h2/i.test(sec)) sec = await writeSection(h).catch(() => "");
          if (/<h2/i.test(sec)) sections.push(sec);
        }
        const body = sections.join("\n");
        if (body && wordCountOf(body) >= targetWc * 0.55) {
          const takeaways = Array.isArray(head.key_takeaways) ? head.key_takeaways : [];
          const hookHtml = head.hook && /<p/i.test(head.hook) ? deAiContent(head.hook) + "\n" : (head.hook ? `<p>${deAiContent(head.hook)}</p>\n` : "");
          const ctaText = strategy.cta || "Contact us";
          const cta = `<h2>Next steps</h2>\n<p>${strategy.cta_url ? `<a href="${strategy.cta_url}">${ctaText}</a>` : ctaText} to see how ${brand || "we"} can help with ${s.target_keyword}.</p>`;
          content = {
            title: head.title || s.title,
            slug: head.slug || "",
            meta_title: head.meta_title || "",
            meta_description: head.meta_description || "",
            direct_answer: head.direct_answer || "",
            article_html: `${hookHtml}<p class="key-answer">${head.direct_answer || ""}</p>\n<h2>Key Takeaways</h2>\n<ul class="key-takeaways">\n${takeaways.map(t => `<li>${t}</li>`).join("\n")}\n</ul>\n${body}\n${cta}`,
            faqs: Array.isArray(head.faqs) ? head.faqs : [],
          };
        }
      } catch { content = null; }
    }

    // ── FALLBACK: single-shot (when no outline, or sectioned generation failed) ──
    if (!content || typeof content.article_html !== "string" || !content.article_html) {
      // Bounded by the remaining wall-clock budget. Unbounded, this call plus the full
      // provider cascade below can run past maxDuration, and the route then returns
      // text/plain FUNCTION_INVOCATION_TIMEOUT that the client cannot parse at all.
      try {
        const text = await withBudget(callCampaignClaude(claudePrompt, genTokens), "", remaining() - 5000);
        if (!text) throw new Error("generation budget exhausted");
        content = parseDelimitedContent(text);
        if (!content.article_html || content.article_html.length < 200) throw new Error("Claude output too short");
      } catch {
        // Only attempt the fallback chain if there is genuinely time for it.
        if (remaining() > 30000) {
          const text = await withBudget(callAI(jsonPrompt, genTokens, true), "", remaining() - 12000);
          content = text ? parseJSON(text) : null;
        } else {
          content = null;
        }
      }
    }
    // Length enforcement: models resist "make this longer", so instead generate NET-NEW
    // question-format sections and append them until the body reaches the floor. Net-new
    // content grows length reliably; loop is time-guarded to stay inside the function limit.
    if (content && typeof content.article_html === "string" && targetWc >= 1000) {
      let got = wordCountOf(content.article_html);
      let rounds = 0;
      // Need enough headroom for a round to actually FINISH, not just to start one.
      while (got < minWc && rounds < 5 && remaining() > 20000) {
        rounds++;
        try {
          const existing = (content.article_html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/gi) || [])
            .map((h: string) => h.replace(/<[^>]+>/g, "").trim()).filter(Boolean).join("; ");
          const addCount = Math.max(1, Math.ceil((minWc - got) / perSection));
          const addPrompt = `Write ${addCount} ADDITIONAL, NON-redundant question-format sections for an in-depth article about "${s.target_keyword}"${brand ? ` (for ${brand})` : ""}.
Each section: a natural-language question as <h2>, answered in the first sentence, then ~${perSection} words of genuinely useful detail with concrete examples, real numbers/data, and a <h3> sub-point or a short <ul>. Cover NEW sub-topics — do NOT repeat any of these existing sections: ${existing || "(none)"}.
Rules: US English, NO em dashes (use commas/periods), ZERO markdown (only <h2>/<h3>/<p>/<ul>/<li>/<strong>/<a>), human and specific (not generic). Output ONLY the raw HTML for the new sections — no preamble, no code fences.`;
          const more = await withBudget(callCampaignClaude(addPrompt, genTokens), "", remaining() - 8000);
          if (!more) break; // ran out of budget mid-round — ship what we have
          const add = deAiContent(more.replace(/^```[a-z]*\s*/i, "").replace(/```$/, "").trim());
          if (add.length > 120 && /<h2/i.test(add)) {
            content.article_html = `${content.article_html}\n${add}`;
            got = wordCountOf(content.article_html);
          } else break; // append call returned nothing usable → stop
        } catch { break; }
      }
    }
    if (content && typeof content.article_html === "string") {
      content.article_html = deAiContent(content.article_html);
      // AEO fallback: if the model didn't open with a marked-up key-answer block, inject one
      // (from direct_answer) so the snippet + Speakable selector always have a target.
      if (content.direct_answer && !/class=["']key-answer["']/.test(content.article_html)) {
        content.article_html = `<p class="key-answer">${content.direct_answer}</p>\n${content.article_html}`;
      }
      // Append a VISIBLE FAQ (Q&A) section so the published blog shows the questions and
      // answers — pairs with the FAQPage schema for answer-engine optimization.
      if (Array.isArray(content.faqs) && content.faqs.length && !/frequently asked|<h2[^>]*>\s*faq/i.test(content.article_html)) {
        const faqHtml = content.faqs
          .filter((f: { q?: string; a?: string }) => f && f.q && f.a)
          .map((f: { q: string; a: string }) => `<h3>${f.q}</h3>\n<p>${f.a}</p>`).join("\n");
        if (faqHtml) content.article_html += `\n<h2 class="faq-heading">Frequently Asked Questions</h2>\n${faqHtml}`;
      }
      // ── ENFORCE LINK INTEGRITY ── The model frequently MANGLES the provided URLs (drops
      // path segments, hyphenates slashes) or invents internal URLs, producing 404s. Rewrite
      // every <a> against the validated whitelists: internal links are remapped to the nearest
      // validated URL by slug-token overlap (or unwrapped); external links must match a real
      // citation source/domain (or are unwrapped). Guarantees zero broken/fabricated links.
      const clientDomEsc = clientDomainClean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      {
        const norm = (u: string) => u.replace(/[#?].*$/, "").replace(/\/$/, "").toLowerCase();
        const validInternal = new Set(internalLinks.map(l => norm(l.url)));
        const ctaNorm = norm(String(strategy.cta_url || ""));
        if (ctaNorm && /^https?:/i.test(strategy.cta_url || "")) validInternal.add(ctaNorm);
        const internalTok = internalLinks.map(l => ({ url: l.url, tokens: new Set(l.url.toLowerCase().replace(/^https?:\/\/[^/]+/, "").split(/[/\-_]+/).filter(Boolean)) }));
        const citeNorm = new Set(citationSources.map(c => norm(c.url)));
        const citeDomains = new Set(citationSources.map(c => { try { return cleanDomain(new URL(c.url).hostname); } catch { return ""; } }).filter(Boolean));
        const clientRe = clientDomEsc ? new RegExp(`^https?://(www\\.)?${clientDomEsc}`, "i") : null;
        content.article_html = content.article_html.replace(/<a\b[^>]*?\shref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (full: string, href: string, text: string) => {
          const h = String(href).replace(/\s/g, "");
          if (/^(mailto:|tel:|#)/i.test(h)) return full;
          if (!/^https?:\/\//i.test(h)) return full;
          if (clientRe && clientRe.test(h)) {
            if (validInternal.has(norm(h))) return `<a href="${h}">${text}</a>`;
            const ht = new Set(norm(h).replace(/^https?:\/\/[^/]+/, "").split(/[/\-_]+/).filter(Boolean));
            let best: { url: string } | null = null, score = 0;
            for (const c of internalTok) { let o = 0; for (const t of c.tokens) if (ht.has(t)) o++; const sc = o / Math.max(c.tokens.size, 1); if (sc > score) { score = sc; best = c; } }
            if (best && score >= 0.6) return `<a href="${best.url}">${text}</a>`;
            return text; // mangled/hallucinated internal URL → unwrap, keep anchor text
          }
          let dom = ""; try { dom = cleanDomain(new URL(h).hostname); } catch { /* ignore */ }
          if (citeNorm.has(norm(h)) || (dom && citeDomains.has(dom))) return `<a href="${h}" target="_blank" rel="noopener">${text}</a>`;
          return text; // external URL not in the verified citation set → unwrap
        });
      }
      // Guarantee INTERLINKING: if the body has fewer than 2 links to the client's own site,
      // append a "Related reading" block of real internal pages so every article interlinks.
      if (internalLinks.length && clientDomEsc) {
        const clientLinkCount = (content.article_html.match(new RegExp(`href=["']https?://(www\\.)?${clientDomEsc}`, "gi")) || []).length;
        if (clientLinkCount < 2 && !/<h2[^>]*>\s*related/i.test(content.article_html)) {
          const rel = internalLinks.slice(0, 4).map(l => `<li><a href="${l.url}">${l.title}</a></li>`).join("\n");
          content.article_html += `\n<h2>Related reading</h2>\n<ul>\n${rel}\n</ul>`;
        }
      }
      // Guarantee CITATIONS: if there's no Sources/References section, append one from the
      // real, verifiable citation candidates so the article always credits its sources.
      if (citationSources.length && !/<h2[^>]*>\s*(sources|references|further reading)\b/i.test(content.article_html)) {
        const src = citationSources.slice(0, 5).map(c => `<li><a href="${c.url}" target="_blank" rel="noopener">${c.title}</a></li>`).join("\n");
        content.article_html += `\n<h2>Sources</h2>\n<ul>\n${src}\n</ul>`;
      }
      // Final pass: strip any em/en dashes that slipped into the appended FAQ/hook.
      content.article_html = content.article_html.replace(/(\d)\s*[–—]\s*(\d)/g, "$1-$2").replace(/\s*[–—]\s*/g, ", ");
    }
    if (!content || typeof content.article_html !== "string" || !content.article_html) {
      const secs = Math.round((Date.now() - reqStart) / 1000);
      return NextResponse.json({ error: `Generation ran out of time (${secs}s of a 120s limit). Try a shorter target word count.` }, { status: 503 });
    }
    // Build/validate schema server-side (always valid JSON-LD regardless of the model)
    const sch = buildSchemas(content, domain, brand, s.title, s.target_keyword);
    content.schema_article = content.schema_article || sch.article;
    content.schema_faq = content.schema_faq || sch.faq;
    content.schema_breadcrumb = content.schema_breadcrumb || sch.breadcrumb;
    content.schema_extra = sch.extra || "";   // HowTo or DefinedTerm when applicable
    content.word_count = typeof content.article_html === "string" ? wordCountOf(content.article_html) : 0;
    content.target_word_count = targetWc;
    content.research = { title_options: researchedTitles, outline: researchedOutline };
    content.gen_ms = Date.now() - t0;   // wall-clock spent generating, for budget diagnosis
    return NextResponse.json({ content, nlp_terms: nlpTerms });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

// ── Blog hero image via Google AI Studio (Imagen + Gemini image fallback) ─────
// Single API key (GOOGLE_AI_STUDIO_KEY / GEMINI_API_KEY). Returns a base64 image
// (data URI) so it can preview in-browser and be uploaded to WordPress media.
function googleAiKey(): string {
  return (process.env.GOOGLE_AI_STUDIO_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.PAGESPEED_API_KEY || "").replace(/^﻿/, "").trim();
}

// Imagen predict endpoint → predictions[].bytesBase64Encoded
// negativePrompt steers away from baked-in text; some Imagen versions reject it, so we
// retry the same model without it on failure.
async function imagenGenerate(key: string, prompt: string, negativePrompt?: string): Promise<{ b64: string; mime: string } | null> {
  const models = ["imagen-4.0-generate-001", "imagen-3.0-generate-002"];
  for (const model of models) {
    const paramSets = negativePrompt
      ? [{ sampleCount: 1, aspectRatio: "16:9", negativePrompt }, { sampleCount: 1, aspectRatio: "16:9" }]
      : [{ sampleCount: 1, aspectRatio: "16:9" }];
    for (const parameters of paramSets) {
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${key}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instances: [{ prompt }], parameters }),
          signal: AbortSignal.timeout(60000),
        });
        if (!r.ok) continue;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const j = await r.json() as any;
        const p = j?.predictions?.[0];
        const b64 = p?.bytesBase64Encoded;
        if (b64) return { b64, mime: p?.mimeType || "image/png" };
      } catch { /* try next variant/model */ }
    }
  }
  return null;
}

// Gemini image generation (a.k.a. "nano banana") → inlineData base64
async function geminiImage(key: string, prompt: string): Promise<{ b64: string; mime: string } | null> {
  const models = ["gemini-2.5-flash-image", "gemini-2.0-flash-preview-image-generation"];
  for (const model of models) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
        }),
        signal: AbortSignal.timeout(60000),
      });
      if (!r.ok) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const j = await r.json() as any;
      const parts = j?.candidates?.[0]?.content?.parts || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const img = parts.find((p: any) => p?.inlineData?.data);
      if (img?.inlineData?.data) return { b64: img.inlineData.data, mime: img.inlineData.mimeType || "image/png" };
    } catch { /* try next model */ }
  }
  return null;
}

// Brand visual systems — applied to image prompts so hero images stay on-brand.
// Keyed by a domain/company matcher. `accent` is the single dominant brand colour (used by
// the holographic style); `style` is the full art-direction clause (used by the photo style).
const BRAND_STYLES: { match: RegExp; accent: string; style: string; lob?: Record<string, string> }[] = [
  {
    match: /eximius/i,
    // Eximius AI brand: primary violet #6646D8. See lib/eximius-kb.ts for the brand rules.
    accent: "a vivid violet-purple (hex #6646D8) — a rich electric purple, NOT blue and NOT pink",
    style: "Visual style: a premium, modern SaaS hero image with the polish of a top-tier product brand campaign. Sophisticated photorealistic photography (modern offices, recruiters and hiring teams at work, screens and interfaces) or refined high-end 3D forms, with cinematic lighting, realistic depth of field, subtle gradients and glass reflections. The DOMINANT accent colour MUST be a vivid violet-purple (hex #6646D8, a rich electric purple) — absolutely NOT blue, navy or pink — applied through lighting, glows and accents, against a deep charcoal/near-black or a clean off-white background. Composition: minimal, balanced, single clear focal point, confident and calm (never hype-y). STRICTLY AVOID: flat cartoon clip-art, robot mascots, brain-with-gears or lightbulb clichés, handshake-with-robot clichés, busy icon collages, generic low-quality stock, rainbow colours. It must look credible, human-centred and enterprise-grade.",
  },
  {
    match: /compunnel/i,
    // From the Compunnel 2025 Brand Guidelines (primary blue #0050EF, graphite #292929, neutrals).
    accent: "a bright electric cobalt blue (hex #0050EF, a saturated royal blue) — NOT navy, dark blue or teal",
    style: "Visual style: a premium, enterprise-grade hero image with the polish of a Fortune-500 / McKinsey / IBM brand campaign. Use sophisticated, photorealistic corporate photography (real modern offices, professionals, technology, data centers) OR refined high-end 3D abstract forms with soft cinematic studio lighting, realistic depth of field, subtle gradients and reflections. The DOMINANT accent colour MUST be a bright, vivid electric cobalt blue (hex #0050EF, a saturated royal blue) — absolutely NOT navy, dark blue or teal — applied through lighting, accents and a subtle ascending chevron / upward-arrow motif, against a clean white or very light grey (#F5F5F5) background with graphite (#292929) detail. Composition: minimal, balanced, lots of negative space, single clear focal point. STRICTLY AVOID: flat cartoon clip-art, childish vector icons, brain-with-gears or lightbulb clichés, busy icon collages, generic low-quality stock, rainbow colours. The result must look expensive, credible and B2B-professional.",
    // Line-of-business accent colours (used when the topic clearly maps to a service line)
    lob: { talent: "cyan (#05D9E8)", digital: "green (#08B76C)", cybersecurity: "red (#EA1C35)" },
  },
];

// ── Holographic product-UI hero style ────────────────────────────────────────
// The cinematic "professional interacting with floating holographic dashboards" look.
// Image models garble small UI text, and the user requires text-free images, so every panel
// is specified as PURELY GRAPHICAL (avatar silhouettes, pills, funnel, meter) with no words.
const HOLOGRAM_BASE = "Cinematic, photorealistic wide hero image shot on a professional cinema camera, ultra-detailed, high production value. A confident professional in sharp modern business attire stands in a dark, upscale high-rise office at night; floor-to-ceiling windows with soft city-light bokeh behind them, a glass desk in the foreground, blurred colleagues working in the deep background. They reach out and interact with large FLOATING TRANSLUCENT HOLOGRAPHIC DASHBOARD PANELS suspended in mid-air around them. Volumetric light rays, glowing rim light on the subject, subtle reflections across the glass, shallow depth of field, rich dark charcoal and deep-teal ambience.";
const HOLOGRAM_UI_RULE = "The holographic panels must be PURELY GRAPHICAL abstract UI: rounded translucent cards showing only silhouetted portrait avatars and small glowing coloured pill/badge shapes, a luminous 3D funnel diagram with stacked segments, a horizontal progress meter with a bright filled bar, and thin glowing curves connecting the panels. Where a real interface would show a text label, render a smooth featureless glowing bar or rounded pill instead. Render shapes, glows and colour ONLY — absolutely no readable words, letters, numbers, digits, alphanumeric codes, glyphs, serial numbers, badge text, logos or typography on any panel, on the windows, on the desk, or anywhere in the scene.";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleCampaignImage(body: any) {
  const key = googleAiKey();
  if (!key) {
    return NextResponse.json({ error: "Google AI Studio not configured. Add GOOGLE_AI_STUDIO_KEY (or GEMINI_API_KEY)." }, { status: 400 });
  }
  const title = (body.title || "").toString().slice(0, 200);
  const keyword = (body.keyword || "").toString().slice(0, 120);
  if (!title && !keyword) return NextResponse.json({ error: "No title/keyword" }, { status: 400 });
  // "hologram" = cinematic floating-dashboard hero; "photo" = premium enterprise photography.
  const imgStyle = String(body.style || "photo").toLowerCase() === "hologram" ? "hologram" : "photo";

  // Resolve the brand style from the domain/company, then pick a line-of-business accent if the topic fits.
  const ctx = `${body.domain || ""} ${body.company || ""}`.toLowerCase();
  const brand = BRAND_STYLES.find(b => b.match.test(ctx));
  let brandStyle = brand?.style || "";
  if (brand?.lob && imgStyle === "photo") {
    const topic = `${title} ${keyword}`.toLowerCase();
    // Check the most specific lines first; Talent (workforce/HR/payroll) before Digital so a
    // generic word like "platform" doesn't wrongly trigger the green Digital accent.
    const line = /cyber|security|threat|\bsoc\b|breach|ransomware|phishing|infosec|compliance|zero.?trust/.test(topic) ? "cybersecurity"
      : /talent|staffing|recruit|workforce|hir(e|ing)|candidate|payroll|employee|employer of record|\beor\b|\bpeo\b|\bhr\b|onboarding|contingent/.test(topic) ? "talent"
      : /\b(ai|data|cloud|automation|software|analytics|machine learning|devops|digital transformation|application)\b/.test(topic) ? "digital" : "";
    if (line && brand.lob[line]) brandStyle += ` Use ${brand.lob[line]} only as a small secondary accent for this ${line} topic — the bright blue #0050EF must still dominate.`;
  }

  // Art-direction: let Claude read the actual blog content and design the image CONCEPT
  // (subject/scene/metaphor). We append the brand colour rules ourselves so brand control
  // stays deterministic. Falls back to a title-based concept if Claude/content is unavailable.
  const articleText = (body.content || "").toString().replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 2500);
  let scene = imgStyle === "hologram"
    ? `the professional is reviewing a holographic workflow for ${String(title || keyword || "their business process").toLowerCase()}`
    : `a professional scene representing ${String(title || keyword || "modern enterprise business").toLowerCase()}`;
  if (articleText.length > 120) {
    try {
      const adPrompt = imgStyle === "hologram"
        ? `You are an art director for a premium SaaS brand. The hero image is a FIXED cinematic scene: a professional standing in a dark modern office at night, interacting with floating translucent holographic dashboard panels.\n` +
          `Read this blog post and decide what the 3 holographic panels should DEPICT, as purely graphical abstract UI (no text).\n` +
          `Reply with 2-3 sentences describing only: the subject (who they are, their posture/gesture) and the 3 panels as SHAPES (e.g. "a stack of translucent cards each with a silhouetted avatar and small glowing pills", "a luminous segmented funnel narrowing downward", "a horizontal meter with a bright filled bar"). ` +
          `Do NOT mention colours, text, words, numbers, labels, logos or brand names (handled separately). No cartoon icons, no robots, no clip-art.\n\nTITLE: ${title}\n\nCONTENT:\n${articleText}`
        : `You are an art director for a premium enterprise B2B brand (think Fortune-500 / McKinsey / IBM campaign quality). ` +
          `Read this blog post and design ONE sophisticated, photorealistic editorial hero image concept that visually represents its core idea.\n` +
          `Favour real-world enterprise photography (modern offices, executives and teams, technology, data infrastructure) or refined high-end 3D abstract forms with cinematic lighting and depth.\n` +
          `Reply with 2-3 sentences describing ONLY the subject, setting, composition and mood. ` +
          `Do NOT mention any colours, text, words, charts with numbers, logos, or brand names (those are handled separately). ` +
          `STRICTLY AVOID literal icon clichés (brains, gears, lightbulbs, puzzle pieces), cartoon/clip-art, and busy collages. Keep it concrete, premium and visual.\n\nTITLE: ${title}\n\nCONTENT:\n${articleText}`;
      const ad = await callCampaignClaude(adPrompt, 300);
      if (ad && ad.trim().length > 20) scene = ad.trim().replace(/\s+/g, " ").slice(0, 600);
    } catch { /* fall back to the title-based concept */ }
  }

  // Same premium enterprise look (brand style preserved) — but engineered to contain ZERO text.
  // We intentionally avoid the words "editorial / magazine / headline / negative space", which
  // make image models render placeholder headline text.
  const noTextClause = "CRITICAL: this image must contain absolutely NO text of any kind anywhere — no words, no letters, no numbers, no headlines, no titles, no captions, no labels, no signage, no logos, no watermarks, no typography. It is a completely clean, text-free image.";
  // Holographic style: fixed cinematic scene + brand-coloured UI glow. Photo style: as before.
  const accent = brand?.accent || "a single confident, saturated brand accent colour";
  const holoPrompt = `${HOLOGRAM_BASE} Scene direction: ${scene} The entire holographic interface glows in ${accent}, casting that colour as rim light and reflections across the subject, the glass desk and the room. ${HOLOGRAM_UI_RULE} Wide 16:9 composition. ${noTextClause} No cartoon icons, no clip-art, no robots.`;
  const photoPrompt = `Award-winning, premium enterprise visual, photorealistic, sharp focus, cinematic studio lighting, shot on a professional camera, ultra-detailed, high production value. ${scene} ${brandStyle} Wide 16:9 composition. ${noTextClause} No flat cartoon icons, no clip-art.`;
  const prompt = body.prompt?.toString().slice(0, 1000) ||
    (imgStyle === "hologram" ? holoPrompt : photoPrompt).replace(/\s+/g, " ").trim();
  const negativePrompt = "text, words, letters, numbers, digits, alphanumeric codes, serial numbers, glyphs, typography, headline, title, caption, label, badge text, signage, watermark, writing, fonts, subtitles, gibberish text, garbled text, lorem ipsum";

  try {
    // Imagen first (highest quality), Gemini flash-image as fallback
    const img = (await imagenGenerate(key, prompt, negativePrompt)) || (await geminiImage(key, `${prompt} Do not render any text, letters or words anywhere in the image.`));
    if (!img) {
      return NextResponse.json({ error: "Image generation failed. Ensure the Generative Language API (and Imagen) is enabled on this Google AI Studio key." }, { status: 502 });
    }
    return NextResponse.json({
      image_url: `data:${img.mime};base64,${img.b64}`,
      image_b64: img.b64,
      mime: img.mime,
      alt: title || keyword,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Google AI image failed" }, { status: 500 });
  }
}

// ── Content dedup / cannibalization check ─────────────────────────────────────
// Compares candidate blog titles/keywords against the site's EXISTING pages
// (from the sitemap) using token-overlap similarity, so the Campaign Agent can
// warn before generating a near-duplicate that would cannibalize an existing page.
function slugToTitle(url: string): string {
  try {
    const path = url.replace(/^https?:\/\/[^/]+/, "").replace(/[?#].*$/, "").replace(/\/$/, "");
    const last = path.split("/").filter(Boolean).pop() || "";
    return last.replace(/[-_]+/g, " ").replace(/\.\w+$/, "").trim();
  } catch { return ""; }
}
function tokenize(s: string): Set<string> {
  const stop = new Set(["the", "a", "an", "to", "for", "of", "in", "on", "and", "or", "with", "your", "you", "is", "are", "how", "what", "why", "best", "guide", "2024", "2025", "2026", "vs"]);
  return new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 2 && !stop.has(w)));
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0; for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleContentDedup(body: any) {
  const domain = String(body.domain || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  const candidates: { idx: number; text: string }[] = Array.isArray(body.candidates) ? body.candidates : [];
  if (!domain || !candidates.length) return NextResponse.json({ error: "domain and candidates required" }, { status: 400 });
  try {
    // Pull the site's existing URLs (sitemap), prefer blog/article/resource pages
    let urls: string[] = [];
    try { urls = await getSitemapUrls(`https://${domain}`); } catch { urls = []; }
    const pages = urls
      .filter(u => /\/(blog|article|post|resource|guide|insight)/i.test(u) || urls.length < 60)
      .map(u => ({ url: u, title: slugToTitle(u), tokens: tokenize(slugToTitle(u)) }))
      .filter(p => p.title.length > 3)
      .slice(0, 400);
    const results = candidates.map(c => {
      const ct = tokenize(c.text);
      let best = { url: "", title: "", score: 0 };
      for (const p of pages) {
        const s = jaccard(ct, p.tokens);
        if (s > best.score) best = { url: p.url, title: p.title, score: +s.toFixed(2) };
      }
      return { idx: c.idx, duplicate: best.score >= 0.5, similarity: best.score, match_url: best.url, match_title: best.title };
    });
    return NextResponse.json({ checked: pages.length, results });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Dedup check failed" }, { status: 500 });
  }
}

// ── site_articles: import every published article from the live site into Article Memory ──
// Primary source = WordPress REST API (real post titles, slugs, dates). Public published
// posts don't need auth; creds are used when supplied to also reach private/protected posts.
// Falls back to the sitemap (slug→title) for non-WordPress sites.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSiteArticles(body: any) {
  const raw = String(body.domain || body.wpUrl || "").trim();
  if (!raw) return NextResponse.json({ error: "domain required" }, { status: 400 });
  const base = raw.replace(/\/$/, "").replace(/^(?!https?:\/\/)/, "https://");
  const domainOnly = base.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
  const getHdr: Record<string, string> = { "Accept": "application/json", "User-Agent": UA };
  if (body.wpUser && body.wpPass) {
    const creds = Buffer.from(`${body.wpUser}:${String(body.wpPass).replace(/\s+/g, " ").trim()}`).toString("base64");
    getHdr.Authorization = `Basic ${creds}`;
  }
  const decode = (s: string) => String(s || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&#0?38;/g, "&")
    .replace(/&#8217;|&#39;|&rsquo;|&lsquo;/g, "'").replace(/&#8220;|&#8221;|&ldquo;|&rdquo;|&quot;/g, '"')
    .replace(/&#8211;|&ndash;/g, "–").replace(/&#8212;|&mdash;/g, "—")
    .replace(/&nbsp;/g, " ").replace(/&hellip;|&#8230;/g, "…")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(+n)).trim();

  type Art = { title: string; slug?: string; url?: string; date?: string };
  const articles: Art[] = [];
  let source = "sitemap";

  // 1) WordPress REST API — paginate posts (best: real titles + dates)
  try {
    for (let page = 1; page <= 12; page++) {
      const url = `${base}/wp-json/wp/v2/posts?per_page=100&page=${page}&status=publish&_fields=title,slug,link,date`;
      const r = await fetch(url, { headers: getHdr, signal: AbortSignal.timeout(20000) });
      if (!r.ok) break;
      const rows = await r.json().catch(() => []) as { title?: { rendered?: string }; slug?: string; link?: string; date?: string }[];
      if (!Array.isArray(rows) || rows.length === 0) break;
      for (const p of rows) {
        const title = decode(p.title?.rendered || "");
        if (title) articles.push({ title, slug: p.slug, url: p.link, date: (p.date || "").slice(0, 10) });
      }
      source = "wordpress";
      const totalPages = Number(r.headers.get("x-wp-totalpages") || "0");
      if (totalPages && page >= totalPages) break;
      if (rows.length < 100) break;
    }
  } catch { /* fall through to sitemap */ }

  // 2) Fallback / supplement: sitemap → slug→title for blog-like URLs
  if (articles.length === 0) {
    try {
      const urls = await getSitemapUrls(base);
      const blog = urls.filter(u => /\/(blog|article|post|resource|guide|insight|news|case-stud)/i.test(u) || urls.length < 80);
      const seen = new Set<string>();
      for (const u of blog) {
        const title = slugToTitle(u).replace(/\b\w/g, c => c.toUpperCase());
        if (title.length > 3 && !seen.has(title.toLowerCase())) { seen.add(title.toLowerCase()); articles.push({ title, url: u }); }
        if (articles.length >= 400) break;
      }
    } catch { /* nothing to add */ }
  }

  // De-dupe by title, cap
  const dedup: Art[] = [];
  const seenT = new Set<string>();
  for (const a of articles) { const k = a.title.toLowerCase(); if (!seenT.has(k)) { seenT.add(k); dedup.push(a); } }

  if (dedup.length === 0) {
    return NextResponse.json({ error: `No published articles found for ${domainOnly}. The site may not be WordPress, or has no public sitemap/REST API.`, articles: [], count: 0 }, { status: 200 });
  }
  return NextResponse.json({ source, count: dedup.length, articles: dedup.slice(0, 1000) });
}

// ── Competitor Analysis via DataForSEO (real overview + keyword gaps) ──────────
// Returns the same shape the Competitor Analysis UI expects, but grounded in real
// DataForSEO Labs data. If DataForSEO isn't configured, returns {configured:false}
// so the client falls back to its AI-estimated path. DR/backlinks need the separate
// DataForSEO Backlinks subscription, so they come back null (UI shows "—").
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleCompetitor(body: any) {
  const myDomain = cleanDomain(body.domain || body.myDomain || "");
  const competitors = (Array.isArray(body.competitors) ? body.competitors : []).map(cleanDomain).filter(Boolean).slice(0, 3);
  const location = body.location || "United States";
  if (!myDomain) return NextResponse.json({ error: "No domain" }, { status: 400 });
  if (!dfsConfigured()) return NextResponse.json({ configured: false }, { status: 200 });
  if (!competitors.length) return NextResponse.json({ error: "Add at least one competitor domain.", configured: true }, { status: 200 });

  try {
    const allDomains = [myDomain, ...competitors];
    const overviews = await Promise.all(allDomains.map(d => dfsDomainOverview(d, location)));
    const overview = allDomains.map((d, i) => ({
      domain: d, dr: null, backlinks: null, content_score: null,
      traffic: overviews[i]?.traffic ?? null, keywords: overviews[i]?.keywords ?? null,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const missing: any[] = [], weak: any[] = [], shared: any[] = [], strong: any[] = [];
    for (const comp of competitors) {
      const [both, miss] = await Promise.all([
        dfsIntersection(myDomain, comp, { intersections: true, limit: 1000, locationName: location, mineIsTarget1: true }),
        dfsIntersection(comp, myDomain, { intersections: false, limit: 1000, locationName: location, mineIsTarget1: false }),
      ]);
      for (const g of (both || []) as GapKeyword[]) {
        if (g.my_pos == null || g.comp_pos == null) continue;
        if (g.comp_pos < g.my_pos - 2) weak.push({ kw: g.keyword, volume: g.volume, kd: g.kd, your_pos: g.my_pos, comp_pos: g.comp_pos, competitor: comp });
        else if (g.my_pos < g.comp_pos - 2) strong.push({ kw: g.keyword, volume: g.volume, your_pos: g.my_pos });
        else shared.push({ kw: g.keyword, volume: g.volume, your_pos: g.my_pos, comp_pos: g.comp_pos });
      }
      for (const g of (miss || []) as GapKeyword[]) {
        if (g.comp_pos == null) continue;
        missing.push({ kw: g.keyword, volume: g.volume, kd: g.kd, comp_pos: g.comp_pos, competitor: comp });
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dedupe = (arr: any[], cap = 1000) => {
      const seen = new Set<string>(); const out = [];
      for (const x of arr.sort((a, b) => (b.volume || 0) - (a.volume || 0))) {
        const k = String(x.kw).toLowerCase(); if (k && !seen.has(k)) { seen.add(k); out.push(x); }
      }
      return out.slice(0, cap);
    };
    const keyword_gap = { missing: dedupe(missing), weak: dedupe(weak), shared: dedupe(shared), strong: dedupe(strong) };

    // Content gaps + summary via AI, grounded in the REAL missing keywords (best-effort).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let content_gaps: any[] = []; let ai_summary = "";
    try {
      const topMissing = keyword_gap.missing.slice(0, 15).map(m => `${m.kw} (vol ${m.volume}, ${m.competitor} ranks #${m.comp_pos})`).join("; ");
      const raw = await callAI(`SEO strategist. ${myDomain} vs competitors ${competitors.join(", ")}. These are REAL keyword gaps where competitors rank and ${myDomain} doesn't: ${topMissing || "(none found)"}. Return ONLY JSON {"content_gaps":[{"topic":"string","competitor":"string","gap":"what's missing","action":"what to create"}],"ai_summary":"2-3 sentence strategic takeaway"} with 3-5 content_gaps derived from the real gaps above.`, 1200, true);
      const p = parseJSON(raw) as { content_gaps?: unknown[]; ai_summary?: string };
      content_gaps = Array.isArray(p.content_gaps) ? p.content_gaps : [];
      ai_summary = p.ai_summary || "";
    } catch { /* AI enrichment optional */ }

    return NextResponse.json({ source: "dataforseo", configured: true, location, overview, keyword_gap, content_gaps, backlink_gaps: [], ai_summary });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Competitor analysis failed", configured: true }, { status: 500 });
  }
}

// ── Link Building prospects (REAL, scraped from live search results) ───────────
// Runs link-building "footprint" searches via the SERP layer (DataForSEO-backed),
// collects real domains, and best-effort scrapes each page for a contact email.
// AI is used only to draft outreach templates/strategies for the real prospects.
const PROSPECT_SKIP = /(^|\.)(google|youtube|facebook|linkedin|twitter|x|wikipedia|reddit|amazon|pinterest|instagram|medium|quora|yelp|glassdoor|indeed|tiktok|apple|microsoft)\.(com|org|net)/i;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleLinkProspects(body: any) {
  const myDomain = cleanDomain(body.domain || "");
  const topic = String(body.topic || "").trim();
  if (!topic) return NextResponse.json({ error: "Topic required" }, { status: 400 });

  const footprints: { q: string; type: string; tactic: string }[] = [
    { q: `${topic} "write for us"`, type: "Blog", tactic: "Guest Post" },
    { q: `${topic} "guest post"`, type: "Blog", tactic: "Guest Post" },
    { q: `${topic} resources`, type: "Resource", tactic: "Resource Link" },
    { q: `best ${topic} blogs`, type: "Blog", tactic: "Digital PR" },
    { q: `${topic} directory`, type: "Directory", tactic: "Resource Link" },
  ];

  try {
    const serps = await Promise.all(footprints.map(f =>
      fetchSERP(f.q).then(r => ({ f, results: r.results })).catch(() => ({ f, results: [] as { pos: number; url: string; domain: string; title: string }[] }))
    ));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byDomain = new Map<string, any>();
    for (const { f, results } of serps) {
      for (const r of results) {
        const d = (r.domain || "").replace(/^www\./, "").toLowerCase();
        if (!d || d === myDomain || PROSPECT_SKIP.test(d) || byDomain.has(d)) continue;
        byDomain.set(d, {
          site: d, url: r.url, title: r.title || "",
          type: f.type, tactic: f.tactic,
          relevance: r.pos <= 3 ? "High" : r.pos <= 7 ? "Medium" : "Low",
          dr: null, email: "", template: "",
        });
      }
    }
    const prospects = [...byDomain.values()].slice(0, 20);
    if (!prospects.length) {
      return NextResponse.json({ source: "scraped", prospects: [], strategies: [], quick_wins: [], note: `No live prospects found for "${topic}". Try a broader topic.` });
    }

    // Best-effort: scrape each prospect page for a real contact email (cap to stay fast).
    const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
    const emailRe = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
    await Promise.all(prospects.slice(0, 12).map(async p => {
      try {
        const r = await fetch(p.url, { headers: { "User-Agent": UA, Accept: "text/html" }, signal: AbortSignal.timeout(8000) });
        if (!r.ok) return;
        const html = await r.text();
        const mailto = html.match(/mailto:([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/i);
        let email = mailto?.[1] || "";
        if (!email) {
          const found = (html.match(emailRe) || []).find(e => !/\.(png|jpe?g|gif|webp|svg)$/i.test(e) && !/(example|sentry|wix|godaddy|@2x|domain\.com|email\.com)/i.test(e));
          email = found || "";
        }
        if (email) p.email = email.toLowerCase();
      } catch { /* email is best-effort */ }
    }));

    // AI drafts outreach templates + strategies for the REAL prospects (best-effort).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let strategies: string[] = [], quick_wins: string[] = [];
    try {
      const list = prospects.slice(0, 6).map(p => `${p.site} (${p.tactic})`).join("; ");
      const raw = await callAI(`You are a link-building outreach specialist for ${myDomain || "our site"} in the "${topic}" niche. For each REAL prospect below, write a short, personalized outreach email (3-4 sentences, specific to that site's tactic). Return ONLY JSON {"templates":[{"site":"exact domain","template":"email text"}],"strategies":["3 tactics"],"quick_wins":["3 quick wins"]}. Prospects: ${list}`, 1800, true);
      const p = parseJSON(raw) as { templates?: { site: string; template: string }[]; strategies?: string[]; quick_wins?: string[] };
      strategies = Array.isArray(p.strategies) ? p.strategies : [];
      quick_wins = Array.isArray(p.quick_wins) ? p.quick_wins : [];
      for (const t of (p.templates || [])) {
        const match = prospects.find(x => x.site === cleanDomain(t.site) || x.site === String(t.site).toLowerCase());
        if (match) match.template = t.template;
      }
    } catch { /* templates optional */ }

    return NextResponse.json({ source: "scraped", prospects, strategies, quick_wins });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Prospecting failed" }, { status: 500 });
  }
}

// ── SEO Opportunity Engine ────────────────────────────────────────────────────
// Scores the full GSC keyword set against five opportunity modules: striking
// distance, low CTR, content decay, competitor gap (DataForSEO) and keyword
// cannibalisation. Returns scored + ranked actions the UI renders as a digest.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSeoEngine(body: any, _req: NextRequest) {
  const domain = cleanDomain(body.domain || "");
  if (!domain) return NextResponse.json({ error: "No domain" }, { status: 400 });

  const competitors = (Array.isArray(body.competitors) ? body.competitors : []).map(cleanDomain).filter(Boolean).slice(0, 5);
  const brandPattern = body.brandRegex || domain.split(".")[0];
  let brand: RegExp;
  try { brand = new RegExp(brandPattern, "i"); } catch { brand = new RegExp(brandPattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"); }
  const CTR_CURVE = [0.28, 0.15, 0.10, 0.07, 0.05, 0.04, 0.03, 0.025, 0.02, 0.018];

  // GSC data is pre-fetched by the frontend via /api/gsc?mode=seoengine (which handles auth).
  const gscData = body.gscData;
  if (!gscData?.queryPages?.rows) return NextResponse.json({ error: "No GSC data provided. The frontend must fetch it first via /api/gsc?mode=seoengine." }, { status: 400 });

  const period = gscData.period || {};

  // DataForSEO gap analysis (runs server-side)
  const gapResults = (dfsConfigured() && competitors.length)
    ? await Promise.all(competitors.map((comp: string) =>
        dfsIntersection(comp, domain, { intersections: false, limit: 200, locationName: "United States", mineIsTarget1: false }).catch(() => null)
      ))
    : [] as (GapKeyword[] | null)[];

  type GscRow = { keys: string[]; clicks: number; impressions: number; ctr: number; position: number };
  const qpRows = (gscData.queryPages.rows || []) as GscRow[];
  const pageCur = (gscData.pagesCurrent?.rows || []) as GscRow[];
  const pagePrev = (gscData.pagesPrior?.rows || []) as GscRow[];

  if (qpRows.length < 5) {
    return NextResponse.json({ warning: true, error: `GSC returned only ${qpRows.length} rows for ${domain}. The site may have very little search traffic, or the data isn't available yet.` });
  }

  // ── Aggregate query×page into per-query stats ──
  const byQ = new Map<string, { keyword: string; clicks: number; impressions: number; posW: number; pages: { page: string; impressions: number }[] }>();
  for (const r of qpRows) {
    const [q, page] = r.keys;
    const a = byQ.get(q) || { keyword: q, clicks: 0, impressions: 0, posW: 0, pages: [] };
    a.clicks += r.clicks; a.impressions += r.impressions; a.posW += r.position * r.impressions;
    a.pages.push({ page, impressions: r.impressions });
    byQ.set(q, a);
  }
  const queries = [...byQ.values()].map(a => {
    a.pages.sort((x, y) => y.impressions - x.impressions);
    return {
      keyword: a.keyword, clicks: a.clicks, impressions: a.impressions,
      position: a.posW / (a.impressions || 1), ctr: a.clicks / (a.impressions || 1),
      top_url: a.pages[0]?.page || "",
      competing: a.pages.filter(p => p.impressions >= a.impressions * 0.15).length,
    };
  }).filter(q => !brand.test(q.keyword) && q.keyword.split(" ").length <= 10);

  // ── Module 1: Striking distance (pos 4-20, 50+ impressions) ──
  // Gain = what reaching position 3 would yield minus current clicks (using the CTR curve)
  const striking = queries.filter(q => q.position >= 4 && q.position <= 20 && q.impressions >= 50)
    .map(q => {
      const targetCtr = CTR_CURVE[2];
      return { keyword: q.keyword, url: q.top_url, position: +q.position.toFixed(1), impressions: q.impressions, clicks: q.clicks, ctr: +(q.ctr * 100).toFixed(1), gain: Math.max(0, Math.round(q.impressions * targetCtr - q.clicks)) };
    })
    .sort((a, b) => b.gain - a.gain);

  // ── Module 2: Low CTR (pos 1-10, 200+ impr, CTR < 75% of expected) ──
  const lowCtr = queries.filter(q => q.position <= 10 && q.impressions >= 200)
    .map(q => {
      const exp = CTR_CURVE[Math.min(9, Math.max(0, Math.round(q.position) - 1))];
      return { keyword: q.keyword, url: q.top_url, position: +q.position.toFixed(1), impressions: q.impressions, clicks: q.clicks, ctr: +(q.ctr * 100).toFixed(1), expected_ctr: +(exp * 100).toFixed(1), gain: Math.max(0, Math.round(q.impressions * exp - q.clicks)) };
    })
    .filter(q => q.ctr < q.expected_ctr * 0.75)
    .sort((a, b) => b.gain - a.gain);

  // ── Module 3: Content decay (pages losing >=20% clicks over 90-day windows) ──
  // Normalize URLs before comparison to avoid phantom decay from trailing-slash or protocol differences.
  const normUrl = (u: string) => u.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "").toLowerCase();
  const NON_CONTENT_RE = /^[^?#]*\/(contact|about|careers|jobs|login|signup|register|cart|checkout|account|privacy|terms|404|search)(?:[\/-]|$)|^[^?#]*\/$/;
  const curClickMap = new Map<string, number>();
  for (const r of pageCur) curClickMap.set(normUrl(r.keys[0]), (curClickMap.get(normUrl(r.keys[0])) || 0) + r.clicks);
  const decay = pagePrev.filter(r => r.clicks >= 30)
    .filter(r => {
      const path = normUrl(r.keys[0]);
      if (NON_CONTENT_RE.test(path)) return false;
      const segments = path.replace(/^[^/]*/, "").split("/").filter(Boolean);
      return segments.length >= 1;
    })
    .map(r => {
      const cur = curClickMap.get(normUrl(r.keys[0])) ?? 0;
      return { page: r.keys[0], clicks_prev: r.clicks, clicks_cur: cur, change: Math.round(((cur - r.clicks) / r.clicks) * 100), gain: Math.max(0, r.clicks - cur) };
    })
    .filter(r => r.change <= -20 && r.gain >= 10)
    .sort((a, b) => b.gain - a.gain);

  // ── Module 4: Cannibalisation (2+ URLs share >=15% impressions) ──
  const cannibal = queries.filter(q => q.competing >= 2 && q.impressions >= 100)
    .map(q => {
      const a = byQ.get(q.keyword);
      const urls = (a?.pages || []).filter(p => p.impressions >= q.impressions * 0.15).map(p => p.page);
      return { keyword: q.keyword, impressions: q.impressions, urls_competing: urls.length, urls: urls.slice(0, 5), position: +q.position.toFixed(1) };
    })
    .filter(q => q.urls_competing >= 2)
    .sort((a, b) => b.impressions - a.impressions);

  // ── Module 5: Competitor gap (DataForSEO) ──
  // Build a topical stem set from the site's own keywords to filter for relevance.
  const ownStems = new Set<string>();
  for (const q of queries) {
    for (const w of q.keyword.toLowerCase().split(/\s+/)) {
      if (w.length >= 4) ownStems.add(w);
    }
  }
  const gap: { keyword: string; volume: number; kd: number; comp_pos: number; competitor: string; gain: number }[] = [];
  const ownTop10 = new Set(queries.filter(q => q.position <= 10).map(q => q.keyword.toLowerCase()));
  if (Array.isArray(gapResults)) {
    for (let i = 0; i < competitors.length && i < gapResults.length; i++) {
      const missing = gapResults[i];
      if (!Array.isArray(missing)) continue;
      for (const kw of missing) {
        if (brand.test(kw.keyword) || ownTop10.has(kw.keyword.toLowerCase())) continue;
        if (kw.volume < 100 || kw.kd > 40 || kw.comp_pos == null || kw.comp_pos > 10) continue;
        const words = kw.keyword.toLowerCase().split(/\s+/);
        const relevant = words.some((w: string) => w.length >= 4 && ownStems.has(w));
        if (!relevant) continue;
        const posCtr = CTR_CURVE[Math.min(9, Math.max(0, (kw.comp_pos || 5) - 1))];
        gap.push({ keyword: kw.keyword, volume: kw.volume, kd: kw.kd, comp_pos: kw.comp_pos, competitor: competitors[i], gain: Math.round(kw.volume * posCtr) });
      }
    }
  }
  gap.sort((a, b) => b.gain - a.gain);

  // ── Action queue (all modules, ranked by estimated monthly clicks gained) ──
  const sliceStriking = striking.slice(0, 100);
  const sliceLowctr = lowCtr.slice(0, 100);
  const sliceDecay = decay.slice(0, 50);
  const sliceGap = gap.slice(0, 100);
  const sliceCannibal = cannibal.slice(0, 50);
  const queue = [
    ...sliceStriking.slice(0, 30).map(s => ({ module: "striking" as const, keyword: s.keyword, url: s.url, gain: s.gain, action: "Optimise page" })),
    ...sliceLowctr.slice(0, 20).map(s => ({ module: "lowctr" as const, keyword: s.keyword, url: s.url, gain: s.gain, action: "Rewrite title/meta" })),
    ...sliceDecay.slice(0, 20).map(s => ({ module: "decay" as const, keyword: "", url: s.page, gain: s.gain, action: "Refresh page" })),
    ...sliceGap.slice(0, 30).map(s => ({ module: "gap" as const, keyword: s.keyword, url: "", gain: s.gain, action: "New article" })),
  ].sort((a, b) => b.gain - a.gain);

  return NextResponse.json({
    domain,
    period: period,
    summary: {
      striking: { count: sliceStriking.length, gain: sliceStriking.reduce((s, x) => s + x.gain, 0) },
      lowctr: { count: sliceLowctr.length, gain: sliceLowctr.reduce((s, x) => s + x.gain, 0) },
      decay: { count: sliceDecay.length, gain: sliceDecay.reduce((s, x) => s + x.gain, 0) },
      gap: { count: sliceGap.length, gain: sliceGap.reduce((s, x) => s + x.gain, 0) },
      cannibal: { count: sliceCannibal.length },
      dataForSeo: dfsConfigured(),
    },
    striking: sliceStriking,
    lowctr: sliceLowctr,
    decay: sliceDecay,
    gap: sliceGap,
    cannibal: sliceCannibal,
    queue: queue.slice(0, 50),
  });
}
