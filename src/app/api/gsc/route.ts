import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  return res.json();
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  let site = req.nextUrl.searchParams.get("site");

  // ── Resolve domain from site param ───────────────────────────────────
  const domain = (site || "").replace(/^https?:\/\//, "").replace(/\/$/, "");

  // ── Look up per-domain token first, fall back to generic cookie ───────
  let tokenMap: Record<string, { access_token?: string; refresh_token?: string }> = {};
  try { tokenMap = JSON.parse(cookieStore.get("gsc_tokens")?.value || "{}"); } catch {}

  let accessToken = tokenMap[domain]?.access_token || cookieStore.get("gsc_access_token")?.value;
  const refreshToken = tokenMap[domain]?.refresh_token || cookieStore.get("gsc_refresh_token")?.value;

  if (!accessToken && refreshToken) {
    const refreshed = await refreshAccessToken(refreshToken);
    accessToken = refreshed.access_token;
    // Update the per-domain token map with the refreshed token
    if (domain && tokenMap[domain]) {
      tokenMap[domain].access_token = accessToken;
      cookieStore.set("gsc_tokens", JSON.stringify(tokenMap), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      });
    }
  }
  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const days = parseInt(req.nextUrl.searchParams.get("days") || "28");
  const keyword = req.nextUrl.searchParams.get("keyword");
  if (!site) return NextResponse.json({ error: "No site param" }, { status: 400 });

  // Resolve the exact verified property. A bare domain ("eximius.ai") isn't a valid
  // GSC property — it must be "sc-domain:eximius.ai" or "https://eximius.ai/". Look up
  // the user's verified sites and match by normalised domain.
  const normDom = (s: string) => s.replace(/^sc-domain:/, "").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "").toLowerCase();
  let resolvedSite = site;
  const looksResolved = /^sc-domain:/.test(site) || /^https?:\/\//.test(site);
  if (!looksResolved) {
    try {
      const listRes = await fetch("https://www.googleapis.com/webmasters/v3/sites", { headers: { Authorization: `Bearer ${accessToken}` } });
      const listData = await listRes.json();
      const entries = (listData.siteEntry || []) as { siteUrl: string; permissionLevel: string }[];
      const verified = entries.filter(e => e.permissionLevel !== "siteUnverifiedUser");
      const target = normDom(site);
      // Prefer an exact domain match; favour domain-properties (sc-domain:) over URL-prefix
      const matches = verified.filter(e => normDom(e.siteUrl) === target);
      const pick = matches.find(e => /^sc-domain:/.test(e.siteUrl)) || matches[0];
      if (pick) resolvedSite = pick.siteUrl;
    } catch { /* fall back to the given site */ }
  }
  site = resolvedSite;

  // Date range: explicit start/end (custom) takes precedence, else last N days
  const qsStart = req.nextUrl.searchParams.get("start");
  const qsEnd = req.nextUrl.searchParams.get("end");
  const endDate = qsEnd || new Date().toISOString().split("T")[0];
  const startDate = qsStart || new Date(Date.now() - days * 86400000).toISOString().split("T")[0];

  const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
  const endpoint = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`;

  // Keyword-specific ranking lookup — used by SERP Analyzer
  if (keyword) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        startDate,
        endDate,
        dimensions: ["query"],
        dimensionFilterGroups: [{ filters: [{ dimension: "query", operator: "equals", expression: keyword }] }],
        rowLimit: 1,
      }),
    });
    const data = await res.json();
    const row = data.rows?.[0];
    // Also resolve the top-ranking PAGE for this keyword (so tools can audit the right URL)
    let topPage = "";
    try {
      const pr = await fetch(endpoint, {
        method: "POST", headers,
        body: JSON.stringify({
          startDate, endDate,
          dimensions: ["page"],
          dimensionFilterGroups: [{ filters: [{ dimension: "query", operator: "equals", expression: keyword }] }],
          rowLimit: 1,
        }),
      });
      const pd = await pr.json();
      topPage = pd.rows?.[0]?.keys?.[0] || "";
    } catch { /* page lookup is best-effort */ }
    if (!row) return NextResponse.json({ found: false, keyword, site, page: topPage });
    return NextResponse.json({
      found: true,
      keyword,
      site,
      page: topPage,
      position: +(row.position.toFixed(1)),
      clicks: Math.round(row.clicks),
      impressions: Math.round(row.impressions),
      ctr: +((row.ctr * 100).toFixed(1)),
    });
  }

  // Previous comparison window = same length immediately before the start date
  const winDays = Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1);
  const startMs = new Date(startDate).getTime();
  const prevEnd = new Date(startMs - 86400000).toISOString().split("T")[0];
  const prevStart = new Date(startMs - winDays * 86400000).toISOString().split("T")[0];

  const [queryRes, pageRes, summaryRes, prevSummaryRes, dailyRes] = await Promise.all([
    fetch(endpoint, { method: "POST", headers, body: JSON.stringify({ startDate, endDate, rowLimit: 1000, dimensions: ["query"] }) }),
    fetch(endpoint, { method: "POST", headers, body: JSON.stringify({ startDate, endDate, rowLimit: 1000, dimensions: ["page"] }) }),
    fetch(endpoint, { method: "POST", headers, body: JSON.stringify({ startDate, endDate, dimensions: [] }) }),
    fetch(endpoint, { method: "POST", headers, body: JSON.stringify({ startDate: prevStart, endDate: prevEnd, dimensions: [] }) }),
    fetch(endpoint, { method: "POST", headers, body: JSON.stringify({ startDate, endDate, rowLimit: 100, dimensions: ["date"] }) }),
  ]);

  const [queryData, pageData, summaryData, prevSummaryData, dailyData] = await Promise.all([
    queryRes.json(), pageRes.json(), summaryRes.json(), prevSummaryRes.json(), dailyRes.json(),
  ]);

  // Google returns an error object when the property isn't accessible
  if (summaryData.error) {
    const code = summaryData.error.code;
    const msg = summaryData.error.message || "Site not accessible in Search Console";
    if (code === 403) return NextResponse.json({ error: `No access to this property. Make sure "${site}" is verified in Google Search Console under the authenticated account.` }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: code || 400 });
  }

  const row = summaryData.rows?.[0] || {};
  const prev = prevSummaryData.rows?.[0] || {};
  const pct = (cur: number, pre: number) => pre === 0 ? 0 : Math.round(((cur - pre) / pre) * 100);

  const curClicks = Math.round(row.clicks || 0);
  const curImpr = Math.round(row.impressions || 0);
  const curCtr = +((row.ctr || 0) * 100).toFixed(2);
  const curPos = +((row.position || 0)).toFixed(1);
  const prevClicks = Math.round(prev.clicks || 0);
  const prevImpr = Math.round(prev.impressions || 0);
  const prevCtr = +((prev.ctr || 0) * 100).toFixed(2);
  const prevPos = +((prev.position || 0)).toFixed(1);

  return NextResponse.json({
    domain: normDom(site),
    _site: site,
    _range: { start: startDate, end: endDate },
    summary: {
      clicks: curClicks,
      impressions: curImpr,
      ctr: curCtr,
      pos: curPos,
      clicks_change: pct(curClicks, prevClicks),
      impressions_change: pct(curImpr, prevImpr),
      ctr_change: +(curCtr - prevCtr).toFixed(1),
      pos_change: +(curPos - prevPos).toFixed(1),
    },
    queries: (queryData.rows || []).map((r: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }) => ({
      query: r.keys[0],
      clicks: Math.round(r.clicks),
      impressions: Math.round(r.impressions),
      ctr: +((r.ctr * 100).toFixed(1)),
      pos: +(r.position.toFixed(1)),
    })),
    pages: (pageData.rows || []).map((r: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }) => ({
      page: r.keys[0],
      clicks: Math.round(r.clicks),
      impressions: Math.round(r.impressions),
      ctr: +((r.ctr * 100).toFixed(1)),
      pos: +(r.position.toFixed(1)),
    })),
    daily: (dailyData.rows || []).map((r: { keys: string[]; clicks: number; impressions: number }) => {
      const parts = r.keys[0].split("-").map(Number);
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      return {
        date: d.toLocaleDateString("en", { month: "short", day: "numeric" }),
        clicks: Math.round(r.clicks),
        impressions: Math.round(r.impressions),
      };
    }),
  });
}
