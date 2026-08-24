// Shared SERP fetcher — tries multiple sources so it works from Vercel datacenter IPs
// where DuckDuckGo HTML is often blocked. Order: Serper (if key) → Bing → DDG Lite → DDG HTML

import { cleanText } from "./page-parser";
import { dfsSerp } from "./dataforseo";

export interface SerpResult {
  pos: number;
  url: string;
  domain: string;
  title: string;
  snippet: string;
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

// ── DataForSEO (live Google organic — real positions, most reliable) ──────────
async function fetchDataForSeo(keyword: string): Promise<SerpResult[]> {
  const rows = await dfsSerp(keyword, "United States", "en", 10);
  if (!rows) return [];
  return rows.map(r => ({ pos: r.pos, url: r.url, domain: domainOf(r.url || r.domain), title: r.title, snippet: r.snippet || "" }));
}

// ── Serper.dev (Google SERP API — reliable from datacenters) ──────────────────
async function fetchSerper(keyword: string): Promise<SerpResult[]> {
  const key = (process.env.SERPER_API_KEY || "").trim();
  if (!key) return [];
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({ q: keyword, gl: "us", hl: "en", num: 10 }),
    signal: AbortSignal.timeout(7000),
  });
  if (!res.ok) return [];
  const json = await res.json() as { organic?: { position: number; link: string; title: string; snippet: string }[] };
  return (json.organic || []).slice(0, 10).map(r => ({
    pos: r.position, url: r.link, domain: domainOf(r.link), title: r.title, snippet: r.snippet || "",
  }));
}

// ── Bing HTML scrape (usually works from datacenters) ─────────────────────────
async function fetchBing(keyword: string): Promise<SerpResult[]> {
  const res = await fetch(`https://www.bing.com/search?q=${encodeURIComponent(keyword)}&count=10&setlang=en-US`, {
    headers: { "User-Agent": UA, "Accept": "text/html", "Accept-Language": "en-US,en;q=0.9" },
    signal: AbortSignal.timeout(7000),
  });
  if (!res.ok) return [];
  const html = await res.text();
  const results: SerpResult[] = [];
  // Bing organic results: <li class="b_algo"> ... <h2><a href="URL">TITLE</a></h2> ... <p>SNIPPET</p>
  const blockRe = /<li class="b_algo"[^>]*>([\s\S]*?)<\/li>/gi;
  let pos = 1;
  for (const m of [...html.matchAll(blockRe)]) {
    if (results.length >= 10) break;
    const block = m[1];
    const linkM = block.match(/<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkM) continue;
    const url = linkM[1];
    if (!url.startsWith("http") || url.includes("bing.com") || url.includes("microsoft.com/")) continue;
    const title = cleanText(linkM[2]);
    if (!title) continue;
    const snipM = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const snippet = snipM ? cleanText(snipM[1]) : "";
    results.push({ pos: pos++, url, domain: domainOf(url), title, snippet });
  }
  return results;
}

// ── DuckDuckGo Lite (POST form — different infra than html.duckduckgo.com) ─────
async function fetchDDGLite(keyword: string): Promise<SerpResult[]> {
  const res = await fetch("https://lite.duckduckgo.com/lite/", {
    method: "POST",
    headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded", "Accept": "text/html" },
    body: `q=${encodeURIComponent(keyword)}&kl=us-en`,
    signal: AbortSignal.timeout(7000),
  });
  if (!res.ok) return [];
  const html = await res.text();
  const results: SerpResult[] = [];
  // DDG Lite: result links in <a class="result-link" href="URL">TITLE</a>
  const linkRe = /<a[^>]+class="result-link"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let pos = 1;
  for (const m of [...html.matchAll(linkRe)]) {
    if (results.length >= 10) break;
    let url = m[1];
    // DDG Lite may wrap in redirect
    const uddg = url.match(/uddg=([^&]+)/);
    if (uddg) url = decodeURIComponent(uddg[1]);
    if (!url.startsWith("http") || url.includes("duckduckgo.com")) continue;
    const title = cleanText(m[2]);
    if (!title) continue;
    results.push({ pos: pos++, url, domain: domainOf(url), title, snippet: "" });
  }
  return results;
}

// ── Google HTML scrape (best results, but aggressively blocks datacenters) ────
async function fetchGoogle(keyword: string): Promise<SerpResult[]> {
  const res = await fetch(`https://www.google.com/search?q=${encodeURIComponent(keyword)}&num=10&hl=en&gl=us`, {
    headers: {
      "User-Agent": UA,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(7000),
  });
  if (!res.ok) return [];
  const html = await res.text();
  // Google blocks → sorry/captcha page has no real results
  if (html.includes("/sorry/") || html.includes("unusual traffic")) return [];
  const results: SerpResult[] = [];
  // Google organic: <a href="/url?q=URL&..."> with an <h3> title inside
  const blockRe = /<a href="\/url\?q=([^&"]+)[^"]*"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  let pos = 1;
  for (const m of [...html.matchAll(blockRe)]) {
    if (results.length >= 10) break;
    const url = decodeURIComponent(m[1]);
    if (!url.startsWith("http") || /google\.com|youtube\.com\/redirect/.test(url)) continue;
    const title = cleanText(m[2]);
    if (!title) continue;
    if (results.some(r => r.url === url)) continue;
    results.push({ pos: pos++, url, domain: domainOf(url), title, snippet: "" });
  }
  // Fallback parse for newer Google markup: href="URL" directly inside result containers
  if (results.length === 0) {
    const altRe = /<a href="(https?:\/\/[^"]+)"[^>]*><br><h3[^>]*>([\s\S]*?)<\/h3>/gi;
    for (const m of [...html.matchAll(altRe)]) {
      if (results.length >= 10) break;
      const url = m[1];
      if (/google\.com/.test(url)) continue;
      const title = cleanText(m[2]);
      if (!title || results.some(r => r.url === url)) continue;
      results.push({ pos: pos++, url, domain: domainOf(url), title, snippet: "" });
    }
  }
  return results;
}

// ── DuckDuckGo HTML (original — often blocked on datacenters) ──────────────────
async function fetchDDGHtml(keyword: string): Promise<SerpResult[]> {
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(keyword)}&kl=us-en`, {
    headers: { "User-Agent": UA, "Accept": "text/html" },
    signal: AbortSignal.timeout(7000),
  });
  if (!res.ok) return [];
  const html = await res.text();
  const results: SerpResult[] = [];
  const linkRe = /href="\/l\/\?[^"]*uddg=([^"&]+)[^"]*"[^>]*>\s*([\s\S]*?)<\/a>/gi;
  const snippetRe = /class="result__snippet"[^>]*>\s*([\s\S]*?)<\/(?:a|span)>/gi;
  const linkMatches = [...html.matchAll(linkRe)];
  const snippetMatches = [...html.matchAll(snippetRe)];
  let pos = 1;
  for (let i = 0; i < linkMatches.length && results.length < 10; i++) {
    const url = decodeURIComponent(linkMatches[i][1]);
    if (!url.startsWith("http") || url.includes("duckduckgo.com")) continue;
    const title = cleanText(linkMatches[i][2]);
    if (!title) continue;
    results.push({ pos: pos++, url, domain: domainOf(url), title, snippet: snippetMatches[i] ? cleanText(snippetMatches[i][1]) : "" });
  }
  return results;
}

// ── Main: try sources in order until one returns results ──────────────────────
export async function fetchSERP(keyword: string): Promise<{ results: SerpResult[]; source: string }> {
  const sources: [string, () => Promise<SerpResult[]>][] = [
    ["dataforseo", () => fetchDataForSeo(keyword)], // real Google organic via DataForSEO (most reliable)
    ["serper", () => fetchSerper(keyword)],   // Google data via API (most reliable)
    ["google", () => fetchGoogle(keyword)],   // Google direct scrape
    ["bing", () => fetchBing(keyword)],       // Bing scrape
    ["ddg-lite", () => fetchDDGLite(keyword)],
    ["ddg-html", () => fetchDDGHtml(keyword)],
  ];
  for (const [name, fn] of sources) {
    try {
      const results = await fn();
      if (results.length > 0) return { results, source: name };
    } catch (e) {
      console.error(`SERP source ${name} failed:`, e instanceof Error ? e.message : e);
    }
  }
  return { results: [], source: "none" };
}
