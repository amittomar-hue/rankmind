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
  let tokenMap: Record<string, { access_token?: string; refresh_token?: string; ts?: number }> = {};
  try { tokenMap = JSON.parse(cookieStore.get("gsc_tokens")?.value || "{}"); } catch {}

  let accessToken = tokenMap[domain]?.access_token || cookieStore.get("gsc_access_token")?.value;
  const refreshToken = tokenMap[domain]?.refresh_token || cookieStore.get("gsc_refresh_token")?.value;

  // Google access tokens expire after ~1 hour, but gsc_tokens caches them for 30 days. The
  // old condition only refreshed when the token was ABSENT, so a stale-but-present token was
  // sent to Google, rejected, and the 401 forwarded to the client — which read it as "not
  // signed in" and bounced the user back through OAuth, forever. Refresh when the token is
  // missing OR old enough to have expired. Entries with no timestamp predate this and are
  // always refreshed, since their age is unknowable.
  // Search Console OAuth is scoped to the GOOGLE ACCOUNT, not to an individual property:
  // any valid token for the account can read every property it has verified. The per-domain
  // token map therefore only has to supply *a* working credential — so gather every refresh
  // token we hold and try them in turn, rather than failing because this one domain happens
  // to have no entry of its own.
  const candidateRefresh = [...new Set([
    tokenMap[domain]?.refresh_token,
    cookieStore.get("gsc_refresh_token")?.value,
    ...Object.values(tokenMap).map(t => t?.refresh_token),
  ].filter(Boolean) as string[])];

  const persistToken = (tok: string, rt?: string) => {
    if (domain) tokenMap[domain] = { ...(tokenMap[domain] || {}), access_token: tok, ...(rt ? { refresh_token: rt } : {}), ts: Date.now() };
    try {
      cookieStore.set("gsc_tokens", JSON.stringify(tokenMap), { httpOnly: true, secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 30, path: "/" });
      cookieStore.set("gsc_access_token", tok, { httpOnly: true, secure: process.env.NODE_ENV === "production", maxAge: 3600, path: "/" });
      if (rt) cookieStore.set("gsc_refresh_token", rt, { httpOnly: true, secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 30, path: "/" });
    } catch { /* oversized cookie — the in-memory token still serves this request */ }
  };

  // Mint a fresh access token from whichever refresh token still works.
  const renewErrors: string[] = [];
  const renew = async (): Promise<string | null> => {
    for (const rt of candidateRefresh) {
      try {
        const r = await refreshAccessToken(rt);
        if (r?.access_token) { persistToken(r.access_token, rt); return r.access_token; }
        renewErrors.push(r?.error || "no_access_token");
      } catch (e) { renewErrors.push(String(e)); }
    }
    return null;
  };

  const tokenAgeMs = tokenMap[domain]?.ts ? Date.now() - Number(tokenMap[domain].ts) : Infinity;
  const stale = tokenAgeMs > 55 * 60 * 1000;   // refresh a little before the 1h expiry
  if (!accessToken || stale) {
    const renewed = await renew();
    if (renewed) accessToken = renewed;
    else if (!accessToken) {
      return NextResponse.json({ error: `GSC auth failed. domain="${domain}", mapKeys=[${Object.keys(tokenMap).join(",")}], refreshCandidates=${candidateRefresh.length}, renewErrors=[${renewErrors.join(";")}], hasClientId=${!!process.env.GOOGLE_CLIENT_ID}, hasClientSecret=${!!process.env.GOOGLE_CLIENT_SECRET}` }, { status: 401 });
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
  // When a SUBDOMAIN is served by a parent domain-property, every figure would otherwise be
  // the parent's. This holds the host we must filter results down to.
  let subdomainFilter = "";
  const looksResolved = /^sc-domain:/.test(site) || /^https?:\/\//.test(site);
  if (!looksResolved) {
    try {
      let listRes = await fetch("https://www.googleapis.com/webmasters/v3/sites", { headers: { Authorization: `Bearer ${accessToken}` } });
      if (listRes.status === 401) {
        const renewed = await renew();
        if (renewed) { accessToken = renewed; listRes = await fetch("https://www.googleapis.com/webmasters/v3/sites", { headers: { Authorization: `Bearer ${accessToken}` } }); }
      }
      const listData = await listRes.json();
      const entries = (listData.siteEntry || []) as { siteUrl: string; permissionLevel: string }[];
      const verified = entries.filter(e => e.permissionLevel !== "siteUnverifiedUser");
      const target = normDom(site);
      // Prefer an exact domain match; favour domain-properties (sc-domain:) over URL-prefix
      const matches = verified.filter(e => normDom(e.siteUrl) === target);
      let pick = matches.find(e => /^sc-domain:/.test(e.siteUrl)) || matches[0];
      // No exact property? A domain property for a PARENT domain covers its subdomains, so
      // "digital.example.com" is reportable through "sc-domain:example.com". Without this a
      // subdomain with no property of its own simply cannot be connected at all.
      if (!pick) {
        const parents = verified
          .filter(e => /^sc-domain:/.test(e.siteUrl) && target.endsWith(`.${normDom(e.siteUrl)}`))
          .sort((a, b) => normDom(b.siteUrl).length - normDom(a.siteUrl).length); // closest parent first
        if (parents[0]) { pick = parents[0]; subdomainFilter = target; }
      }
      if (pick) resolvedSite = pick.siteUrl;
      else {
        // Nothing can serve this host — say so, and list what IS available, rather than
        // letting Google return an opaque 403 for a string that was never a property.
        const available = verified.map(e => e.siteUrl);
        return NextResponse.json({
          error: `No Search Console property covers "${target}". Verified properties on this Google account: ${available.join(", ") || "none"}. Add a property for ${target}, or a domain property for its parent domain.`,
          available,
        }, { status: 404 });
      }
    } catch { /* fall back to the given site */ }
  }
  site = resolvedSite;
  // Applied to every Search Analytics call below when reporting a subdomain through a parent
  // property, so the numbers describe the subdomain and not the whole domain.
  const subFilter = subdomainFilter
    ? { dimensionFilterGroups: [{ filters: [{ dimension: "page", operator: "contains", expression: `://${subdomainFilter}/` }] }] }
    : {};

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

  // ── SEO Engine mode — returns extended data for opportunity scoring ──
  const mode = req.nextUrl.searchParams.get("mode");
  if (mode === "seoengine") {
    const day = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
    const seFrom = day(-90), seTo = day(-3), sePrevFrom = day(-177), sePrevTo = day(-91);
    const runSE = async (tok: string) => {
      const hdr = { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" };
      const f = (b: object) => fetch(endpoint, { method: "POST", headers: hdr, body: JSON.stringify(b) }).then(r => r.json());
      return Promise.all([
        f({ startDate: seFrom, endDate: seTo, rowLimit: 5000, dimensions: ["query", "page"], ...subFilter }),
        f({ startDate: seFrom, endDate: seTo, rowLimit: 5000, dimensions: ["page"], ...subFilter }),
        f({ startDate: sePrevFrom, endDate: sePrevTo, rowLimit: 5000, dimensions: ["page"], ...subFilter }),
      ]);
    };
    let seBatch = await runSE(accessToken);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((seBatch[0] as any)?.error?.code === 401) {
      const renewed = await renew();
      if (renewed) { accessToken = renewed; seBatch = await runSE(renewed); }
      else return NextResponse.json({ error: `GSC auth expired (seoengine). domain="${domain}", site="${site}", mapKeys=[${Object.keys(tokenMap).join(",")}], refreshCandidates=${candidateRefresh.length}, renewErrors=[${renewErrors.join(";")}], tokenAge=${tokenAgeMs}ms` }, { status: 401 });
    }
    return NextResponse.json({
      mode: "seoengine",
      domain: subdomainFilter || normDom(site),
      _site: site,
      _subdomain_of: subdomainFilter || undefined,
      period: { from: seFrom, to: seTo, prev_from: sePrevFrom, prev_to: sePrevTo },
      queryPages: seBatch[0],
      pagesCurrent: seBatch[1],
      pagesPrior: seBatch[2],
    });
  }

  // Previous comparison window = same length immediately before the start date
  const winDays = Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1);
  const startMs = new Date(startDate).getTime();
  const prevEnd = new Date(startMs - 86400000).toISOString().split("T")[0];
  const prevStart = new Date(startMs - winDays * 86400000).toISOString().split("T")[0];

  // A token can be rejected even when it looked fresh (revoked, scope change, clock skew).
  // Rather than surfacing Google's "invalid authentication credentials" to the user — which
  // reads as a permissions problem and sends them hunting through Search Console — renew
  // once and replay the whole batch.
  const runBatch = async (tok: string) => {
    const hdr = { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" };
    const bodies = [
      { startDate, endDate, rowLimit: 1000, dimensions: ["query"], ...subFilter },
      { startDate, endDate, rowLimit: 1000, dimensions: ["page"], ...subFilter },
      { startDate, endDate, dimensions: [], ...subFilter },
      { startDate: prevStart, endDate: prevEnd, dimensions: [], ...subFilter },
      { startDate, endDate, rowLimit: 100, dimensions: ["date"], ...subFilter },
      { startDate: prevStart, endDate: prevEnd, rowLimit: 1000, dimensions: ["query"], ...subFilter },
    ];
    const res = await Promise.all(bodies.map(b => fetch(endpoint, { method: "POST", headers: hdr, body: JSON.stringify(b) })));
    return Promise.all(res.map(r => r.json()));
  };

  const wantMonthly = req.nextUrl.searchParams.get("monthly") === "1";

  let batch = await runBatch(accessToken);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((batch[2] as any)?.error?.code === 401 || (batch[0] as any)?.error?.code === 401) {
    const renewed = await renew();
    if (renewed) { accessToken = renewed; batch = await runBatch(renewed); }
  }
  const [queryData, pageData, summaryData, prevSummaryData, dailyData, prevQueryData] = batch;


  // ── Monthly series (trend charts) ──
  // Aggregated from a date-dimension query wide enough to cover the whole requested window;
  // the standard `daily` query caps at 100 rows and silently truncates longer ranges.
  let monthlySeries: { month: string; clicks: number; impressions: number; ctr: number; pos: number }[] = [];
  if (wantMonthly) {
    try {
      const mr = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate, rowLimit: 1000, dimensions: ["date"], ...subFilter }),
      });
      const md = await mr.json() as { rows?: { keys: string[]; clicks: number; impressions: number; position: number }[] };
      const acc = new Map<string, { clicks: number; impressions: number; posSum: number; n: number }>();
      for (const r of md.rows || []) {
        const month = String(r.keys?.[0] || "").slice(0, 7);   // YYYY-MM
        if (!month) continue;
        const a = acc.get(month) || { clicks: 0, impressions: 0, posSum: 0, n: 0 };
        a.clicks += r.clicks || 0; a.impressions += r.impressions || 0;
        a.posSum += r.position || 0; a.n += 1;
        acc.set(month, a);
      }
      monthlySeries = [...acc.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, a]) => ({
        month,
        clicks: Math.round(a.clicks),
        impressions: Math.round(a.impressions),
        ctr: a.impressions ? +((a.clicks / a.impressions) * 100).toFixed(1) : 0,
        pos: a.n ? +(a.posSum / a.n).toFixed(1) : 0,
      }));
    } catch { /* trend data is additive — never fail the main response over it */ }
  }

  // Previous-period keyword lookup, keyed lowercase so joins are case-insensitive.
  const prevByQuery = new Map<string, { query: string; clicks: number; impressions: number; ctr: number; pos: number }>();
  for (const r of (prevQueryData.rows || []) as { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }[]) {
    const q = String(r.keys?.[0] || "");
    if (!q) continue;
    prevByQuery.set(q.toLowerCase(), {
      query: q,
      clicks: Math.round(r.clicks),
      impressions: Math.round(r.impressions),
      ctr: +((r.ctr * 100).toFixed(1)),
      pos: +(r.position.toFixed(1)),
    });
  }
  const currentKeys = new Set(((queryData.rows || []) as { keys: string[] }[]).map(r => String(r.keys?.[0] || "").toLowerCase()));

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
    monthly: monthlySeries,
    // Key the data by the host the user ASKED for. Using the parent property here would
    // file digital.example.com's data under example.com and collide with the parent site.
    domain: subdomainFilter || normDom(site),
    _site: site,
    _subdomain_of: subdomainFilter ? normDom(site) : undefined,
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
    queries: (queryData.rows || []).map((r: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }) => {
      const p = prevByQuery.get(String(r.keys[0]).toLowerCase());
      return {
        query: r.keys[0],
        clicks: Math.round(r.clicks),
        impressions: Math.round(r.impressions),
        ctr: +((r.ctr * 100).toFixed(1)),
        pos: +(r.position.toFixed(1)),
        // null (not 0) when the keyword had no impressions last period — "new" is not "rank 0".
        prev_pos: p ? p.pos : null,
        prev_clicks: p ? p.clicks : null,
        prev_impressions: p ? p.impressions : null,
        prev_ctr: p ? p.ctr : null,
      };
    }),
    // Keywords that ranked last period but have no data this one. Without these a tracked
    // keyword that fell out of the index entirely would silently vanish from the report.
    prev_only: [...prevByQuery.entries()]
      .filter(([k]) => !currentKeys.has(k))
      .map(([, v]) => v)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 500),
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
