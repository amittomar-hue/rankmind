// Async, resumable full-site crawl for the SEO Audit (PRD model). A single Vercel function
// can't crawl thousands of URLs in 120s, so the crawl runs INCREMENTALLY: `startCrawl` seeds a
// Redis-backed job, the client polls `tickCrawl` (each tick crawls one time-boxed batch and
// persists progress), and when the frontier drains (or the page cap is hit) the finishing tick
// computes the deterministic audit. State lives entirely in Redis so any tick can resume it.
import { getRedis } from "@/lib/db";
import { fetchHtml, parsePage, getSitemapUrls, fetchText, cleanText } from "@/lib/page-parser";

const TTL = 7200; // job data lives 2h

// ── Compact per-page record (kept small — thousands are stored in Redis) ──────
export type CrawlPage = {
  u: string; s: number; d: number;        // url, status, click-depth
  t: string; tl: number;                  // title, title length
  md: string; ml: number;                 // meta desc (trunc), meta length
  h1: string; h1c: number; h2c: number;   // h1 (trunc), h1 count, h2 count
  wc: number; alt: number;                // word count, images-missing-alt
  can: string; ni: boolean;               // canonical (path), noindex
  sc: string[]; il: number; el: number;   // schema types, internal/external link counts
  hl: number; al: number; hq: boolean;    // hreflang count, answer-first length, has question heading
};

export type CrawlMeta = {
  id: string; domain: string; base: string; host: string;
  status: "running" | "done" | "error";
  complete: boolean; // true only when the whole frontier was crawled (not page-capped)
  maxPages: number; scanned: number; queued: number; discovered: number;
  startedAt: number; updatedAt: number;
  robotsFound: boolean; llmsTxt: boolean; sitemapCount: number;
  error?: string;
};

const k = {
  meta: (id: string) => `cj:${id}:meta`,
  queue: (id: string) => `cj:${id}:queue`,
  seen: (id: string) => `cj:${id}:seen`,
  pages: (id: string) => `cj:${id}:pages`,
  audit: (id: string) => `cj:${id}:audit`,
  robots: (id: string) => `cj:${id}:robots`,
  sitemap: (id: string) => `cj:${id}:sitemap`,
};

function cleanDomain(h: string) { return String(h || "").replace(/^www\./, "").toLowerCase(); }
const cleanPath = (p: string) => /^\/(?:[\w-]+\/)*[\w-]*(?:\.html?|\.php)?\/?$/i.test(p);

// Normalize a URL to a same-host page URL (or null to skip). Drops query/hash, resource paths.
function normUrl(u: string, resolveBase: string, host: string): string | null {
  try {
    const x = new URL(u, resolveBase);
    if (cleanDomain(x.hostname) !== host) return null;
    if (x.search || !cleanPath(decodeURIComponent(x.pathname))) return null;
    return `${x.protocol}//${x.hostname}${x.pathname}`;
  } catch { return null; }
}
const keyOf = (u: string) => u.replace(/\/$/, "").toLowerCase();

// ── Start: create the job, fetch robots/sitemap, seed the frontier ────────────
export async function startCrawl(rawDomain: string, seeds: string[], maxPages: number): Promise<string | null> {
  const r = getRedis();
  if (!r) return null;
  const domain = cleanDomain(rawDomain.replace(/^https?:\/\//, "").replace(/\/.*$/, ""));
  const base = `https://${domain}`;
  const host = domain;
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

  // robots.txt + llms.txt + sitemap (best-effort, seed the frontier from all three)
  const [robotsTxt, llms, sm] = await Promise.all([
    fetchText(`${base}/robots.txt`).catch(() => null),
    fetchText(`${base}/llms.txt`).catch(() => null),
    getSitemapUrls(base, 5000).catch(() => [] as string[]),
  ]);
  const sitemapUrls = [...new Set(sm.map(u => normUrl(u, base, host)).filter((u): u is string => !!u))];
  const allSeeds = [...new Set([base + "/", ...seeds, ...sitemapUrls].map(u => normUrl(u, base, host)).filter((u): u is string => !!u))].slice(0, maxPages * 2);

  const meta: CrawlMeta = {
    id, domain, base, host, status: "running", complete: false, maxPages,
    scanned: 0, queued: allSeeds.length, discovered: allSeeds.length,
    startedAt: Date.now(), updatedAt: Date.now(),
    robotsFound: !!robotsTxt, llmsTxt: !!llms, sitemapCount: sitemapUrls.length,
  };
  // NOTE: @upstash/redis auto-serializes objects and auto-parses JSON on read, so we store
  // native objects/arrays (never JSON.stringify — that would double-encode and break reads).
  const pipe = r.pipeline();
  pipe.set(k.meta(id), meta, { ex: TTL });
  pipe.set(k.robots(id), robotsTxt || "", { ex: TTL });
  pipe.set(k.sitemap(id), sitemapUrls.slice(0, 5000), { ex: TTL });
  pipe.set(k.seen(id), allSeeds.map(keyOf), { ex: TTL });
  if (allSeeds.length) pipe.rpush(k.queue(id), ...allSeeds.map(u => ({ u, d: 0 })));
  pipe.expire(k.queue(id), TTL);
  await pipe.exec();
  return id;
}

// ── Tick: crawl one time-boxed batch, persist progress, finish when drained ───
export async function tickCrawl(id: string, budgetMs = 78000, concurrency = 12): Promise<CrawlMeta | null> {
  const r = getRedis();
  if (!r) return null;
  const meta = await r.get<CrawlMeta>(k.meta(id));
  if (!meta) return null;
  if (meta.status !== "running") return meta;

  const started = Date.now();
  const seen = new Set((await r.get<string[]>(k.seen(id))) || []);
  let scanned = meta.scanned;
  let drained = false;

  while (Date.now() - started < budgetMs && scanned < meta.maxPages) {
    const popped = (await r.lpop<{ u: string; d: number }>(k.queue(id), concurrency)) as { u: string; d: number }[] | null;
    if (!popped || !popped.length) { drained = true; break; }
    const items = popped.filter(x => x && typeof x.u === "string");

    const fetched = await Promise.all(items.map(async it => {
      try { const { html, status, finalUrl } = await fetchHtml(it.u); return { it, html, status, finalUrl }; }
      catch { return { it, html: null as string | null, status: 0, finalUrl: it.u }; }
    }));

    const pageRecords: CrawlPage[] = [];
    const newQueue: { u: string; d: number }[] = [];
    for (const f of fetched) {
      scanned++;
      if (!f.html) { pageRecords.push(compact(f.it.u, f.status, f.it.d, null)); continue; }
      const p = parsePage(f.html, f.finalUrl || f.it.u);
      const extra = extraSignals(f.html);
      pageRecords.push(compact(f.finalUrl || f.it.u, f.status, f.it.d, p, extra));
      // Discover more internal pages (bounded frontier).
      if (seen.size < meta.maxPages * 3) {
        let n = 0;
        for (const m of f.html.matchAll(/href=["']([^"'#\s]+)["']/gi)) {
          const nu = normUrl(m[1], f.finalUrl || f.it.u, meta.host);
          if (!nu) continue;
          const key = keyOf(nu);
          if (seen.has(key)) continue;
          seen.add(key); newQueue.push({ u: nu, d: f.it.d + 1 });
          if (++n > 200) break;
        }
      }
    }
    const pipe = r.pipeline();
    if (pageRecords.length) pipe.rpush(k.pages(id), ...pageRecords);
    if (newQueue.length) pipe.rpush(k.queue(id), ...newQueue);
    pipe.expire(k.pages(id), TTL); pipe.expire(k.queue(id), TTL);
    // Persist live progress every batch so a concurrent status poll shows a moving counter.
    meta.scanned = scanned; meta.discovered = seen.size; meta.updatedAt = Date.now();
    pipe.set(k.meta(id), meta, { ex: TTL });
    await pipe.exec();
  }

  const queued = (await r.llen(k.queue(id))) || 0;
  meta.scanned = scanned;
  meta.queued = queued;
  meta.discovered = seen.size;
  meta.updatedAt = Date.now();
  if (drained || scanned >= meta.maxPages || queued === 0) meta.status = "done";
  meta.complete = drained || queued === 0; // false when we stopped at the page cap with URLs left

  const pipe = r.pipeline();
  pipe.set(k.seen(id), [...seen], { ex: TTL });
  pipe.set(k.meta(id), meta, { ex: TTL });
  await pipe.exec();

  // Recompute the deterministic audit from all pages so far at the END OF EVERY TICK — the
  // report builds live while crawling (orphan detection stays gated on meta.complete).
  try {
    const pages = await readAllPages(id);
    const robots = (await r.get<string>(k.robots(id))) || "";
    const sitemap = (await r.get<string[]>(k.sitemap(id))) || [];
    const audit = buildAuditReport(pages, robots, meta.llmsTxt, sitemap, meta);
    await r.set(k.audit(id), audit, { ex: TTL });
  } catch (e) { meta.error = e instanceof Error ? e.message : "audit build failed"; await r.set(k.meta(id), meta, { ex: TTL }); }
  return meta;
}

export async function getCrawlStatus(id: string): Promise<{ meta: CrawlMeta | null; audit: unknown | null }> {
  const r = getRedis();
  if (!r) return { meta: null, audit: null };
  const meta = await r.get<CrawlMeta>(k.meta(id));
  // Return the audit whenever it exists — it updates live during the crawl, not only at the end.
  const audit = meta ? await r.get<AuditReport>(k.audit(id)) : null;
  return { meta, audit: audit || null };
}

async function readAllPages(id: string): Promise<CrawlPage[]> {
  const r = getRedis();
  if (!r) return [];
  const len = (await r.llen(k.pages(id))) || 0;
  const out: CrawlPage[] = [];
  for (let i = 0; i < len; i += 500) {
    const chunk = (await r.lrange<CrawlPage>(k.pages(id), i, i + 499)) as CrawlPage[];
    for (const p of chunk) { if (p && typeof p === "object") out.push(p); }
  }
  return out;
}

// Extra signals not returned by parsePage: hreflang count, answer-first length, question heading.
function extraSignals(html: string): { hl: number; al: number; hq: boolean } {
  const hl = (html.match(/<link[^>]+hreflang=/gi) || []).length;
  const body = html.replace(/<head[\s\S]*?<\/head>/i, "").replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<nav[\s\S]*?<\/nav>/gi, "").replace(/<header[\s\S]*?<\/header>/gi, "");
  const firstP = body.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] || "";
  const al = cleanText(firstP).split(/\s+/).filter(Boolean).length;
  const h2s = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map(m => cleanText(m[1]));
  const hq = h2s.some(h => /\?$/.test(h.trim()) || /^(how|what|why|when|where|who|which|can|does|is|are|should)\b/i.test(h.trim()));
  return { hl, al, hq };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function compact(url: string, status: number, depth: number, p: any, extra?: { hl: number; al: number; hq: boolean }): CrawlPage {
  const canPath = (() => { try { return p?.canonical ? new URL(p.canonical).pathname : ""; } catch { return p?.canonical || ""; } })();
  return {
    u: url, s: status, d: depth,
    t: (p?.title || "").slice(0, 120), tl: p?.titleLength || 0,
    md: (p?.metaDesc || "").slice(0, 70), ml: p?.metaDescLength || 0,
    h1: (p?.h1 || "").slice(0, 100), h1c: p?.h1Count || 0, h2c: Array.isArray(p?.h2s) ? p.h2s.length : 0,
    wc: p?.wordCount || 0, alt: p?.imgsWithoutAlt || 0,
    can: canPath, ni: !!p?.noindex,
    sc: Array.isArray(p?.schemaTypes) ? p.schemaTypes : [], il: p?.internalLinks || 0, el: p?.externalLinks || 0,
    hl: extra?.hl || 0, al: extra?.al || 0, hq: !!extra?.hq,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// DETERMINISTIC 8-MODULE AUDIT (PRD model): checks → severity-weighted scores →
// prioritized remediation backlog. No AI scoring.
// ════════════════════════════════════════════════════════════════════════════
export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type Effort = "low" | "medium" | "high";
export type Finding = {
  id: string; module: string; name: string; severity: Severity; effort: Effort;
  count: number; sample: string[]; evidence: string; fix: string; priority: number;
};
export type ModuleScore = { id: string; title: string; weight: number; score: number; findings: Finding[] };
export type AuditReport = {
  overall: number; label: string;
  scannedPages: number; discovered: number; sitemapCount: number; complete: boolean;
  modules: ModuleScore[];
  backlog: Finding[];
  roadmap: string[];
  generatedAt: number;
};

const SEV_W: Record<Severity, number> = { critical: 0.40, high: 0.25, medium: 0.12, low: 0.05, info: 0 };
const EFFORT_W: Record<Effort, number> = { low: 1, medium: 3, high: 8 };

const MODULE_META = [
  { id: "M1", title: "Crawlability & Indexation", weight: 20 },
  { id: "M4", title: "Technical & Performance", weight: 18 },
  { id: "M3", title: "On-Page & Content", weight: 16 },
  { id: "M2", title: "Architecture & Internal Linking", weight: 14 },
  { id: "M7", title: "AEO / GEO Readiness", weight: 14 },
  { id: "M5", title: "Structured Data", weight: 10 },
  { id: "M6", title: "International & hreflang", weight: 4 },
  { id: "M8", title: "Performance & Opportunity", weight: 4 },
];

export function buildAuditReport(pages: CrawlPage[], robotsTxt: string, llmsTxt: boolean, sitemapUrls: string[], meta: CrawlMeta): AuditReport {
  const ok = pages.filter(p => p.s >= 200 && p.s < 400);
  const scored = Math.max(1, pages.length);
  const statusByKey = new Map(pages.map(p => [keyOf(p.u), p.s]));
  const sample = (arr: { u: string }[]) => arr.slice(0, 25).map(p => p.u);

  // duplicate helpers
  const dupBy = (get: (p: CrawlPage) => string) => {
    const m = new Map<string, CrawlPage[]>();
    for (const p of ok) { const key = get(p).trim().toLowerCase(); if (key) (m.get(key) || m.set(key, []).get(key)!).push(p); }
    return [...m.values()].filter(g => g.length > 1).flat();
  };

  // AI crawler access from robots.txt
  const AI_BOTS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "PerplexityBot", "Google-Extended", "CCBot", "Applebot-Extended", "Bytespider", "Amazonbot"];
  const blockedBots = AI_BOTS.filter(b => botBlocked(robotsTxt, b));

  // canonical target → non-200 (only when target is in the crawl)
  const canonNon200 = ok.filter(p => { if (!p.can) return false; const st = statusByKey.get(keyOf(`https://${meta.host}${p.can}`)); return st !== undefined && st !== 200; });
  // orphans: in sitemap but never crawled/discovered
  const crawledKeys = new Set(pages.map(p => keyOf(p.u)));
  const orphans = sitemapUrls.filter(u => !crawledKeys.has(keyOf(u))).map(u => ({ u }));
  const hasOrg = ok.some(p => p.sc.some(t => /organization/i.test(t)));

  const F: Finding[] = [];
  const add = (id: string, module: string, name: string, severity: Severity, effort: Effort, items: { u: string }[], evidence: string, fix: string) => {
    if (!items.length) return;
    F.push({ id, module, name, severity, effort, count: items.length, sample: sample(items), evidence, fix, priority: SEV_W[severity] * items.length / EFFORT_W[effort] });
  };

  // ── M1 Crawlability & indexation ──
  add("M1_4XX", "M1", "Pages returning 4xx errors", "critical", "medium", pages.filter(p => p.s >= 400 && p.s < 500), "URL returns a 4xx client error", "Fix or 301-redirect the URL to a live equivalent; remove internal links pointing to it.");
  add("M1_5XX", "M1", "Pages returning 5xx errors", "critical", "high", pages.filter(p => p.s >= 500), "URL returns a 5xx server error", "Investigate the server/application error; 5xx pages are dropped from the index.");
  add("M1_REDIR", "M1", "Redirecting URLs", "medium", "low", ok.filter(p => p.s >= 300 && p.s < 400), "URL responds with a 3xx redirect", "Update internal links to point directly at the final destination; keep redirects to one hop.");
  add("M1_NOINDEX", "M1", "Noindex on crawlable pages", "high", "low", ok.filter(p => p.ni), "Page carries a noindex directive", "Remove noindex if the page should rank; confirm it is intentional if not.");
  add("M1_NO_CANON", "M1", "Missing canonical tag", "medium", "low", ok.filter(p => !p.can), "No canonical URL declared", "Add a self-referencing canonical to consolidate signals and pre-empt duplicate-URL indexing.");
  add("M1_CANON_NON200", "M1", "Canonical points to a non-200 URL", "critical", "low", canonNon200, "Declared canonical target does not return 200", "Repoint the canonical to a live 200 URL, or make the page self-canonical.");
  if (!meta.robotsFound) F.push({ id: "M1_ROBOTS", module: "M1", name: "robots.txt not found", severity: "high", effort: "low", count: 1, sample: [`https://${meta.host}/robots.txt`], evidence: "No robots.txt served at the root", fix: "Add a robots.txt with sitemap declaration and explicit crawl guidance.", priority: SEV_W.high * 1 / EFFORT_W.low });
  if (!meta.sitemapCount) F.push({ id: "M1_SITEMAP", module: "M1", name: "XML sitemap missing", severity: "medium", effort: "low", count: 1, sample: [`https://${meta.host}/sitemap.xml`], evidence: "No XML sitemap discovered", fix: "Publish an XML sitemap and declare it in robots.txt.", priority: SEV_W.medium * 1 / EFFORT_W.low });
  // Orphan detection is only valid on a COMPLETE crawl — otherwise "not yet crawled" (page cap)
  // masquerades as "orphaned". Suppress when the crawl was capped.
  if (meta.complete) add("M1_ORPHAN", "M1", "Orphan URLs (in sitemap, not internally linked)", "medium", "medium", orphans, "URL is in the sitemap but was not reached by crawling internal links", "Add internal links from relevant pages so the URL accrues equity and is discoverable.");

  // ── M2 Architecture & internal linking ──
  add("M2_DEPTH", "M2", "Pages deeper than 3 clicks", "medium", "medium", ok.filter(p => p.d > 3), "Page sits more than 3 clicks from the homepage", "Flatten the architecture: add contextual/hub links so key pages sit within 3 clicks.");

  // ── M3 On-page & content ──
  add("M3_NO_TITLE", "M3", "Missing title tag", "critical", "low", ok.filter(p => !p.t), "Page has no <title>", "Write a unique, descriptive title with the primary keyword, 50-60 characters.");
  add("M3_DUP_TITLE", "M3", "Duplicate title tags", "high", "medium", dupBy(p => p.t), "Title is identical across multiple URLs", "Make each title unique to its page intent to avoid cannibalization.");
  add("M3_LONG_TITLE", "M3", "Title too long (>60 chars)", "medium", "low", ok.filter(p => p.tl > 60), "Title likely truncates in the SERP", "Trim to ~60 characters, front-loading the keyword.");
  add("M3_SHORT_TITLE", "M3", "Title too short (<30 chars)", "low", "low", ok.filter(p => p.t && p.tl < 30), "Title under-uses available SERP space", "Expand the title with intent-qualifying words.");
  add("M3_NO_META", "M3", "Missing meta description", "medium", "low", ok.filter(p => !p.md), "No meta description", "Add a 140-160 char description that earns the click; Google may still rewrite it.");
  add("M3_DUP_META", "M3", "Duplicate meta descriptions", "medium", "medium", dupBy(p => p.md), "Meta description is identical across URLs", "Write a distinct description per page.");
  add("M3_NO_H1", "M3", "Missing H1", "high", "low", ok.filter(p => !p.h1c), "Page has no H1", "Add a single descriptive H1 that states the page topic.");
  add("M3_MULTI_H1", "M3", "Multiple H1 tags", "low", "low", ok.filter(p => p.h1c > 1), "Page has more than one H1", "Use exactly one H1; demote the rest to H2/H3.");
  add("M3_THIN", "M3", "Thin content (<300 words)", "medium", "medium", ok.filter(p => p.wc > 0 && p.wc < 300), "Body content is very thin", "Expand with genuinely useful, specific content or consolidate/noindex if low value.");
  add("M3_ALT", "M3", "Images missing alt text", "low", "low", ok.filter(p => p.alt > 0), "Page has images without alt attributes", "Add descriptive alt text to informative images; empty alt for decorative ones.");

  // ── M4 Technical & performance (CWV field data + Lighthouse = roadmap) ──
  add("M4_HTTPS", "M4", "Non-HTTPS pages", "high", "medium", ok.filter(p => p.u.startsWith("http://")), "Page served over plain HTTP", "Serve all pages over HTTPS and 301-redirect HTTP to HTTPS.");

  // ── M5 Structured data ──
  add("M5_NO_SCHEMA", "M5", "Pages with no structured data", "medium", "medium", ok.filter(p => !p.sc.length), "No JSON-LD/microdata detected", "Add relevant schema (Article, Product, FAQPage, BreadcrumbList, Organization).");
  if (ok.length && !hasOrg) F.push({ id: "M5_NO_ORG", module: "M5", name: "No Organization schema site-wide", severity: "medium", effort: "low", count: 1, sample: [`https://${meta.host}/`], evidence: "No Organization structured data found on any crawled page", fix: "Add Organization schema (name, logo, sameAs, contact) to the homepage/global template.", priority: SEV_W.medium * 1 / EFFORT_W.low });

  // ── M6 International & hreflang (reciprocity validation = roadmap) ──
  // (No finding unless hreflang is present but malformed — deferred; module scores 100 when N/A.)

  // ── M7 AEO / GEO readiness ──
  if (blockedBots.length) F.push({ id: "M7_AIBOTS", module: "M7", name: "AI crawlers blocked in robots.txt", severity: "high", effort: "low", count: blockedBots.length, sample: blockedBots, evidence: `Blocked: ${blockedBots.join(", ")}`, fix: "Allow the AI crawlers you want cited (GPTBot, ClaudeBot, PerplexityBot, Google-Extended). They cannot cite pages they cannot fetch.", priority: SEV_W.high * blockedBots.length / EFFORT_W.low });
  if (!llmsTxt) F.push({ id: "M7_LLMS", module: "M7", name: "llms.txt not found", severity: "low", effort: "low", count: 1, sample: [`https://${meta.host}/llms.txt`], evidence: "No llms.txt served at the root", fix: "Publish an llms.txt summarizing key pages for AI assistants.", priority: SEV_W.low * 1 / EFFORT_W.low });
  add("M7_ANSWER", "M7", "No answer-first opening", "medium", "medium", ok.filter(p => p.wc > 150 && p.al < 15), "Opening paragraph does not contain a self-contained direct answer", "Open substantive pages with a 40-55 word direct answer to the page's core query.");
  add("M7_QHEAD", "M7", "No question-format headings", "low", "medium", ok.filter(p => p.wc > 300 && !p.hq), "No H2 phrased as a user question", "Add question-format headings answered in the first sentence for extractability.");

  // ── Module scores (PRD formula) ──
  const modules: ModuleScore[] = MODULE_META.map(m => {
    const findings = F.filter(f => f.module === m.id).sort((a, b) => b.priority - a.priority);
    const penalty = findings.reduce((sum, f) => sum + SEV_W[f.severity] * Math.min(f.count / scored, 1) * 100, 0);
    return { ...m, score: Math.max(0, Math.round(100 - penalty)), findings };
  });
  const overall = Math.round(modules.reduce((s, m) => s + m.score * m.weight, 0) / modules.reduce((s, m) => s + m.weight, 0));
  const label = overall >= 90 ? "Excellent" : overall >= 75 ? "Good" : overall >= 55 ? "Fair" : overall >= 35 ? "Needs Improvement" : "Poor";
  const backlog = [...F].sort((a, b) => b.priority - a.priority);

  const roadmap = [
    "CrUX field Core Web Vitals + Lighthouse per-template (M4)",
    "GSC URL Inspection: index status & Google-selected canonical (M1)",
    "JS render-gap analysis via headless browser (M4/M7)",
    "Internal PageRank + links-to-errors + anchor distribution (M2)",
    "Near-duplicate clustering (MinHash) (M3)",
    "hreflang reciprocity & return-tag validation (M6)",
    "GSC/GA4 opportunity: striking-distance, CTR gaps, cannibalization, decay (M8)",
    "Rich-result property validation per schema type (M5)",
  ];

  return { overall, label, scannedPages: pages.length, discovered: meta.discovered, sitemapCount: meta.sitemapCount, complete: meta.complete, modules, backlog, roadmap, generatedAt: Date.now() };
}

// Parse robots.txt for whether a named UA is disallowed from "/".
function botBlocked(robots: string, bot: string): boolean {
  if (!robots) return false;
  const lines = robots.split("\n").map(l => l.trim());
  let inBot = false, inAll = false, botDisallowRoot = false, botAllowRoot = false, allDisallowRoot = false, sawBot = false;
  const b = bot.toLowerCase();
  for (const line of lines) {
    const low = line.toLowerCase();
    if (low.startsWith("user-agent:")) { const a = low.replace("user-agent:", "").trim(); inBot = a === b; inAll = a === "*"; if (inBot) sawBot = true; }
    else if (low.startsWith("disallow:")) { const path = low.replace("disallow:", "").trim(); if (inBot && path === "/") botDisallowRoot = true; if (inAll && path === "/") allDisallowRoot = true; }
    else if (low.startsWith("allow:")) { const path = low.replace("allow:", "").trim(); if (inBot && path === "/") botAllowRoot = true; }
  }
  if (botDisallowRoot && !botAllowRoot) return true;
  if (!sawBot && allDisallowRoot) return true;
  return false;
}
