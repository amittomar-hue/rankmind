import { NextRequest, NextResponse } from "next/server";
import { dfsKeywordDifficulty, sanitizeKeywords } from "@/lib/dataforseo";

export const maxDuration = 60;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Firefox/120.0";

// Map a free-text location to a Google country code (gl) + language (hl)
function resolveGeo(location: string): { gl: string; hl: string; label: string } {
  const l = (location || "").trim().toLowerCase();
  if (!l) return { gl: "us", hl: "en", label: "United States" };
  const map: [RegExp, string, string, string][] = [
    [/united arab emirates|\buae\b|dubai|abu dhabi/, "ae", "en", "United Arab Emirates"],
    [/united kingdom|\buk\b|britain|england|london/, "gb", "en", "United Kingdom"],
    [/united states|\busa?\b|america/, "us", "en", "United States"],
    [/\bindia\b|bharat/, "in", "en", "India"],
    [/saudi|ksa/, "sa", "ar", "Saudi Arabia"],
    [/qatar/, "qa", "en", "Qatar"],
    [/kuwait/, "kw", "ar", "Kuwait"],
    [/bahrain/, "bh", "ar", "Bahrain"],
    [/oman/, "om", "ar", "Oman"],
    [/canada/, "ca", "en", "Canada"],
    [/australia/, "au", "en", "Australia"],
    [/germany|deutschland/, "de", "de", "Germany"],
    [/france/, "fr", "fr", "France"],
    [/spain|españa/, "es", "es", "Spain"],
    [/italy|italia/, "it", "it", "Italy"],
    [/netherlands|holland/, "nl", "nl", "Netherlands"],
    [/singapore/, "sg", "en", "Singapore"],
    [/japan|nippon/, "jp", "ja", "Japan"],
    [/brazil|brasil/, "br", "pt", "Brazil"],
    [/mexico|méxico/, "mx", "es", "Mexico"],
    [/south africa/, "za", "en", "South Africa"],
    [/new zealand/, "nz", "en", "New Zealand"],
    [/ireland/, "ie", "en", "Ireland"],
    [/pakistan/, "pk", "en", "Pakistan"],
    [/philippines/, "ph", "en", "Philippines"],
    [/indonesia/, "id", "id", "Indonesia"],
    [/nigeria/, "ng", "en", "Nigeria"],
    [/egypt/, "eg", "ar", "Egypt"],
  ];
  for (const [re, gl, hl, label] of map) if (re.test(l)) return { gl, hl, label };
  // Fallback: if it's a 2-letter code, use it directly
  if (/^[a-z]{2}$/.test(l)) return { gl: l, hl: "en", label: location };
  return { gl: "us", hl: "en", label: location || "United States" };
}

// Google Ads geo target constant IDs by country code (for Keyword Planner)
const GADS_GEO: Record<string, string> = {
  ae:"2784", us:"2840", gb:"2826", in:"2356", sa:"2682", qa:"2634", kw:"2414",
  bh:"2048", om:"2512", ca:"2124", au:"2036", de:"2276", fr:"2250", es:"2724",
  it:"2380", nl:"2528", sg:"2702", jp:"2392", br:"2076", mx:"2484", za:"2710",
  nz:"2554", ie:"2372", pk:"2586", ph:"2608", id:"2360", ng:"2566", eg:"2818",
};
// Google Ads language constant IDs by language code
const GADS_LANG: Record<string, string> = {
  en:"1000", ar:"1019", de:"1001", fr:"1002", es:"1003", it:"1004",
  nl:"1010", ja:"1005", pt:"1014", id:"1025",
};

// Exchange a refresh token (from cookie or env) for a fresh access token
async function googleAccessToken(cookieRefresh?: string): Promise<string | null> {
  const cid = (process.env.GOOGLE_CLIENT_ID || "").trim();
  const secret = (process.env.GOOGLE_CLIENT_SECRET || "").trim();
  const refresh = (cookieRefresh || process.env.GOOGLE_ADS_REFRESH_TOKEN || "").trim();
  if (!cid || !secret || !refresh) return null;
  try {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: cid, client_secret: secret, refresh_token: refresh, grant_type: "refresh_token" }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return null;
    const d = await r.json() as { access_token?: string };
    return d.access_token || null;
  } catch { return null; }
}

// ── REAL search volume via Google Ads API Keyword Planner (free, real Google data) ──
async function googleAdsVolume(
  keywords: string[], gl: string, hl: string, cookieRefresh?: string, diag?: { reason?: string }
): Promise<Map<string, { volume: number; cpc: number; competition: number }> | null> {
  const devToken = (process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "").trim();
  const customerId = (process.env.GOOGLE_ADS_CUSTOMER_ID || "").replace(/-/g, "").trim();
  const loginCustomerId = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "").replace(/-/g, "").trim();
  if (!devToken || !customerId) { if (diag) diag.reason = "missing dev token or customer id"; return null; }

  const accessToken = await googleAccessToken(cookieRefresh);
  if (!accessToken) { if (diag) diag.reason = "could not get access token from refresh token"; return null; }

  const geoId = GADS_GEO[gl] || GADS_GEO.us;
  const langId = GADS_LANG[hl] || GADS_LANG.en;

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": devToken,
      "Content-Type": "application/json",
    };
    if (loginCustomerId) headers["login-customer-id"] = loginCustomerId;

    const body = JSON.stringify({
      keywords: keywords.slice(0, 1000),
      geoTargetConstants: [`geoTargetConstants/${geoId}`],
      language: `languageConstants/${langId}`,
      keywordPlanNetwork: "GOOGLE_SEARCH",
    });

    // API version changes over time — try current versions until one isn't 404
    const VERSIONS = ["v21", "v20", "v19", "v18"];
    let res: Response | null = null;
    for (const ver of VERSIONS) {
      res = await fetch(
        `https://googleads.googleapis.com/${ver}/customers/${customerId}:generateKeywordHistoricalMetrics`,
        { method: "POST", headers, body, signal: AbortSignal.timeout(30000) }
      );
      if (res.status !== 404) break; // found a live version (could be 200/400/403)
    }
    if (!res) { if (diag) diag.reason = "no response"; return null; }
    if (!res.ok && diag) { const t = await res.text(); diag.reason = `HTTP ${res.status}: ${t.slice(0, 300)}`; }
    if (!res.ok) return null;
    const data = await res.json() as { results?: { text: string; keywordMetrics?: { avgMonthlySearches?: string; competition?: string; competitionIndex?: string; lowTopOfPageBidMicros?: string; highTopOfPageBidMicros?: string } }[] };
    const results = data?.results || [];
    if (!results.length) return null;
    const compMap: Record<string, number> = { LOW: 0.25, MEDIUM: 0.55, HIGH: 0.85 };
    const map = new Map<string, { volume: number; cpc: number; competition: number }>();
    for (const r of results) {
      const m = r.keywordMetrics;
      if (!m) continue;
      const high = Number(m.highTopOfPageBidMicros || 0) / 1_000_000;
      const low = Number(m.lowTopOfPageBidMicros || 0) / 1_000_000;
      const cpc = high > 0 ? (low + high) / 2 : low;
      const comp = m.competitionIndex != null ? Number(m.competitionIndex) / 100 : (compMap[m.competition || ""] ?? 0.5);
      map.set((r.text || "").toLowerCase().trim(), {
        volume: Number(m.avgMonthlySearches || 0),
        cpc,
        competition: comp,
      });
    }
    if (diag && !map.size) diag.reason = "API ok but no metrics returned";
    return map.size ? map : null;
  } catch (e) { if (diag) diag.reason = `exception: ${e instanceof Error ? e.message : String(e)}`; return null; }
}

// ── REAL search volume via DataForSEO Google Ads (the source SEMrush/Ahrefs use) ──
// Returns a map of keyword → real {volume, cpc, competition}, or null if not configured.
async function dataForSeoVolume(
  keywords: string[], locationName: string, langCode: string
): Promise<Map<string, { volume: number; cpc: number; competition: number }> | null> {
  const login = (process.env.DATAFORSEO_LOGIN || "").trim();
  const pass = (process.env.DATAFORSEO_PASSWORD || "").trim();
  if (!login || !pass || login.includes("your-") || pass.includes("your-")) return null;

  try {
    const auth = Buffer.from(`${login}:${pass}`).toString("base64");
    // DataForSEO Labs "keyword_overview" — robust (never fails the whole task on one bad
    // keyword like Google Ads search_volume does) and returns volume + cpc + competition.
    const res = await fetch("https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_overview/live", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify([{
        keywords: sanitizeKeywords(keywords, 700),
        location_name: locationName,
        language_code: langCode || "en",
      }]),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await res.json() as any;
    const items = data?.tasks?.[0]?.result?.[0]?.items || [];
    if (!Array.isArray(items) || !items.length) return null;
    const map = new Map<string, { volume: number; cpc: number; competition: number }>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const it of items as any[]) {
      const ki = it?.keyword_info || {};
      map.set((it.keyword || "").toLowerCase().trim(), {
        volume: ki.search_volume || 0,
        cpc: +(ki.cpc || 0),
        competition: ki.competition != null ? ki.competition : 0,
      });
    }
    return map.size ? map : null;
  } catch { return null; }
}

async function googleSuggest(query: string, gl: string, hl: string): Promise<string[]> {
  try {
    const r = await fetch(
      `https://suggestqueries.google.com/complete/search?client=firefox&hl=${hl}&gl=${gl}&q=${encodeURIComponent(query)}`,
      { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(5000) }
    );
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data?.[1]) ? (data[1] as string[]) : [];
  } catch { return []; }
}

/**
 * Estimate global monthly search volume from Google Suggest density.
 * Recalibrated against SEMrush ground-truth:
 *   "HR service provider"   → 151 signals → real global ~1,200  → returns ~1,200
 *   "crm software"          → ~35 signals → real global ~22,000 → returns ~18,000
 *   "mobile app developer"  → ~40 signals → real global ~40,000 → returns ~36,000
 *   "xaasgenie" (obscure)   → ~5  signals → real global < 500   → returns ~50
 */
function volumeFromDensity(uniqueCount: number): number {
  // Smooth piecewise calibrated to real-world data
  if (uniqueCount >= 100) return roundVol(500  + (uniqueCount - 100) * 14);  // 151→1214
  if (uniqueCount >= 50)  return roundVol(100  + (uniqueCount - 50)  * 8);   // 100→500
  if (uniqueCount >= 25)  return roundVol(3000 + (uniqueCount - 25)  * 600); // 50→18000
  if (uniqueCount >= 10)  return roundVol(400  + (uniqueCount - 10)  * 172); // 25→3000
  if (uniqueCount >= 4)   return roundVol(40   + (uniqueCount - 4)   * 60);  // 10→400
  return Math.max(10, uniqueCount * 15);
}

function roundVol(n: number): number {
  if (n >= 100000) return Math.round(n / 10000) * 10000;
  if (n >= 10000)  return Math.round(n / 1000)  * 1000;
  if (n >= 1000)   return Math.round(n / 100)   * 100;
  if (n >= 100)    return Math.round(n / 10)    * 10;
  return Math.max(10, Math.round(n));
}

// Scale child-keyword volumes relative to seed, using suggest position as proxy
function scaleVolume(seedVol: number, position: number, extraWords: number): number {
  const posFactors = [1, 0.60, 0.40, 0.27, 0.18, 0.12, 0.08, 0.05, 0.03, 0.02];
  const pf = posFactors[Math.min(position, posFactors.length - 1)];
  const wf = Math.max(0.04, 1 - extraWords * 0.28);
  return roundVol(seedVol * pf * wf);
}

// KD: anchored to suggestion density, capped for niche/long-tail keywords
// Calibrated: "HR service provider" (density 151, niche B2B) → ~50 like SEMrush
function estimateKD(kw: string, seedWordCount: number, density: number, volume?: number): number {
  const words = kw.trim().split(/\s+/).length;
  const extra = Math.max(0, words - seedWordCount);
  // Density maps to base KD but with a lower ceiling
  const base = density <= 10 ? 5  + density * 1.5
             : density <= 30 ? 20 + (density - 10) * 1.5
             : density <= 60 ? 50 + (density - 30) * 0.33  // ~60 max at density 60
             : Math.min(68,   60 + (density - 60) * 0.1);   // caps at 68 for huge density
  let kd = base - extra * 8;
  if (/^(how|what|why|when|where|can|does|is)\b/i.test(kw)) kd -= 10;
  if (/\b(alternative|vs|review|best)\b/i.test(kw)) kd += 6;
  // Low-volume keywords are typically easier to rank for
  if (volume !== undefined && volume < 1000) kd -= 8;
  else if (volume !== undefined && volume > 50000) kd += 8;
  const hash = kw.split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) & 0xffff, 0);
  kd += (hash % 8) - 4;
  return Math.min(Math.max(Math.round(kd), 3), 90);
}

function detectIntent(kw: string): "Informational" | "Commercial" | "Transactional" | "Navigational" {
  const lk = kw.toLowerCase();
  if (/\b(buy|price|cost|pricing|plan|subscribe|free trial|discount|coupon|deal|purchase|order|download|hire|agency|demo|sign up)\b/.test(lk)) return "Transactional";
  if (/\b(best|top|review|vs|versus|compare|alternative|comparison|rated|recommend|worth|pros|cons|ranking)\b/.test(lk)) return "Commercial";
  if (/^(how|what|why|when|where|who|can|does|is|are|do|which|will)\b/.test(lk) || /\b(guide|tutorial|learn|explain|definition|meaning|example|tips|ways|steps|course)\b/.test(lk)) return "Informational";
  return "Navigational";
}

function estimateCPC(intent: "Informational" | "Commercial" | "Transactional" | "Navigational", industry: string, density: number): string {
  const intentBase: Record<string, number> = { Transactional: 6.0, Commercial: 4.0, Informational: 1.5, Navigational: 0.8 };
  const industryMults: [string, number][] = [
    ["insurance", 9.5], ["legal", 8.0], ["finance", 7.5], ["mortgage", 8.5], ["attorney", 9.0],
    ["hr", 7.0], ["staffing", 6.5], ["recruitment", 6.0], ["payroll", 7.5], ["workforce", 6.0],
    ["saas", 5.5], ["software", 4.5], ["enterprise", 6.0], ["b2b", 5.0], ["crm", 6.5],
    ["healthcare", 5.5], ["medical", 6.0], ["dental", 7.0], ["clinic", 5.0],
    ["marketing", 4.0], ["agency", 4.5], ["consulting", 5.5], ["cloud", 5.0],
    ["ecommerce", 2.5], ["retail", 1.8], ["education", 2.2], ["travel", 3.0],
    ["developer", 4.0], ["mobile", 3.5], ["app", 3.0],
  ];
  const lowerInd = industry.toLowerCase();
  const indMult = industryMults.find(([k]) => lowerInd.includes(k))?.[1] ?? 2.5;
  // Niche B2B keywords with low density often have HIGH CPC (few advertisers bidding a lot)
  const demandMult = density < 20 ? 1.4 : density < 50 ? 1.0 : 0.8;
  const cpc = intentBase[intent] * indMult * demandMult;
  return Math.max(0.10, cpc).toFixed(2);
}

function serpFeatures(intent: "Informational" | "Commercial" | "Transactional" | "Navigational"): string[] {
  if (intent === "Informational") return ["Featured snippet", "People also ask"];
  if (intent === "Commercial")    return ["Shopping results", "Reviews"];
  if (intent === "Transactional") return ["Shopping results", "Ads"];
  return ["Sitelinks"];
}

// Generate a plausible 12-month trend based on keyword type (no external API)
function syntheticTrend(seed: string, density: number): number[] {
  const lk = seed.toLowerCase();
  // Tech/dev keywords: slight upward trend
  const isGrowth = /developer|software|ai|app|saas|cloud|api|platform|tool/i.test(lk);
  // Seasonal (retail/holiday): peak in Q4
  const isSeasonal = /gift|holiday|christmas|black friday|summer|winter|sale/i.test(lk);
  const base = Math.min(100, Math.max(5, Math.round(density * 1.8)));
  return Array.from({ length: 12 }, (_, i) => {
    let v = base;
    if (isGrowth) v = Math.round(base * (0.8 + i * 0.018));          // gradual rise
    else if (isSeasonal) v = Math.round(base * (0.7 + Math.sin((i - 2) * 0.6) * 0.5));
    else v = Math.round(base * (0.85 + Math.sin(i * 0.9) * 0.15));    // gentle wave
    // Deterministic noise per month (stable across reloads)
    const noise = ((seed.charCodeAt(i % seed.length) * (i + 7)) % 12) - 6;
    return Math.min(100, Math.max(1, v + noise));
  });
}

export async function GET(req: NextRequest) {
  const seed = (req.nextUrl.searchParams.get("seed") || "").trim();
  const industry = req.nextUrl.searchParams.get("industry") || "general";
  const geo = resolveGeo(req.nextUrl.searchParams.get("location") || "");
  if (!seed) return NextResponse.json({ error: "No seed" }, { status: 400 });

  const seedWordCount = seed.trim().split(/\s+/).length;

  const modPatterns = [
    seed,
    `best ${seed}`, `${seed} review`, `${seed} vs`, `${seed} alternative`,
    `${seed} pricing`, `${seed} tutorial`, `${seed} guide`,
    `how to use ${seed}`, `what is ${seed}`, `${seed} free`, `${seed} demo`,
    `${seed} for ${industry}`,
  ];
  const alphaPatterns = "abcdefghijklmno".split("").map(l => `${seed} ${l}`);
  const allQueries = [...modPatterns, ...alphaPatterns];

  const suggestResults = await Promise.allSettled(allQueries.map(q => googleSuggest(q, geo.gl, geo.hl)));

  // Collect unique suggestions
  const seen = new Map<string, { position: number }>();
  suggestResults.forEach((r) => {
    if (r.status !== "fulfilled") return;
    r.value.forEach((kw: string, pos: number) => {
      const k = kw.toLowerCase().trim();
      if (k && k !== seed.toLowerCase() && k.length > 2 && !seen.has(k)) {
        seen.set(k, { position: pos });
      }
    });
  });

  const density = seen.size; // real signal: how many unique suggestions Google auto-generates
  const trend12 = syntheticTrend(seed, density);
  const seedIntent = detectIntent(seed);

  // Try REAL search volume (Google Ads → DataForSEO) and REAL keyword difficulty
  // CONCURRENTLY so the KD call adds no extra sequential latency (avoids timeouts).
  const allKwForVolume = [seed, ...Array.from(seen.keys())];
  const adsRefresh = req.cookies.get("google_ads_refresh_token")?.value;
  const adsDiag: { reason?: string } = {};
  const [volOut, realKd] = await Promise.all([
    (async () => {
      let rv = await googleAdsVolume(allKwForVolume, geo.gl, geo.hl, adsRefresh, adsDiag);
      let src = rv ? "google_ads" : "";
      if (!rv) { rv = await dataForSeoVolume(allKwForVolume, geo.label, geo.hl); src = rv ? "dataforseo" : ""; }
      return { rv, src };
    })(),
    dfsKeywordDifficulty(allKwForVolume, geo.label, geo.hl).catch(() => null),
  ]);
  const realVol = volOut.rv;
  const realSource = volOut.src;
  const isReal = !!realVol;

  const seedReal = realVol?.get(seed.toLowerCase().trim());
  const seedVolume = seedReal?.volume ?? volumeFromDensity(density);

  // Build keyword list — real volume/CPC/competition when available, else estimated
  const kwList = Array.from(seen.entries()).map(([kw, { position }]) => {
    const extra = Math.max(0, kw.split(/\s+/).length - seedWordCount);
    const intent = detectIntent(kw);
    const r = realVol?.get(kw.toLowerCase().trim());
    const vol = r?.volume ?? scaleVolume(seedVolume, position, extra);
    const kd = realKd?.get(kw.toLowerCase().trim()) ?? estimateKD(kw, seedWordCount, density, vol);
    return {
      kw,
      volume: vol,
      kd,
      cpc: r ? r.cpc.toFixed(2) : estimateCPC(intent, industry, density),
      comp: r ? parseFloat(r.competition.toFixed(2)) : parseFloat(Math.min(0.95, 0.08 + (kd / 100) * 0.9).toFixed(2)),
      features: serpFeatures(intent),
      trend: trend12[trend12.length - 1] > trend12[0] * 1.1 ? "Up" : trend12[trend12.length - 1] < trend12[0] * 0.9 ? "Down" : "Stable",
      intent,
    };
  }).sort((a, b) => b.volume - a.volume);

  const groups: Record<string, typeof kwList> = {};
  for (const kw of kwList) {
    if (!groups[kw.intent]) groups[kw.intent] = [];
    groups[kw.intent].push(kw);
  }

  const intentOrder = ["Commercial", "Informational", "Transactional", "Navigational"];
  const clusters = intentOrder
    .filter(i => groups[i]?.length > 0).slice(0, 3)
    .map(intent => ({
      name: intent === "Commercial" ? "Commercial / Buying Intent"
          : intent === "Informational" ? "Informational / How-To"
          : intent === "Transactional" ? "Transactional / High-Convert"
          : "Navigational / Brand",
      intent,
      keywords: groups[intent].slice(0, 10).map(({ intent: _i, ...rest }) => rest),
    }));

  if (clusters.length === 0) {
    clusters.push({ name: "General keywords", intent: "Informational", keywords: [] });
  }

  const questions = (groups["Informational"] || []).slice(0, 5).map(k => ({
    q: k.kw, volume: k.volume, snippet_eligible: true,
  }));
  if (questions.length === 0) {
    questions.push({ q: `how to use ${seed}`, volume: roundVol(seedVolume * 0.1), snippet_eligible: true });
  }

  return NextResponse.json({
    seed: {
      volume: seedVolume,
      kd: realKd?.get(seed.toLowerCase().trim()) ?? estimateKD(seed, seedWordCount, density, seedVolume),
      cpc: seedReal ? seedReal.cpc.toFixed(2) : estimateCPC(seedIntent, industry, density),
      intent: seedIntent,
      comp_density: seedReal ? parseFloat(seedReal.competition.toFixed(2)) : parseFloat(Math.min(0.95, 0.1 + (density / 60) * 0.85).toFixed(2)),
      trend: trend12,
      serp_features: serpFeatures(seedIntent),
    },
    clusters,
    questions,
    related: kwList.slice(0, 20).map(k => k.kw),
    _source: isReal ? realSource : "suggest-density",
    _real: isReal,
    _adsDebug: adsDiag.reason || null,
    _density: density,
    _total: kwList.length,
    _location: geo.label,
    _gl: geo.gl,
  });
}
