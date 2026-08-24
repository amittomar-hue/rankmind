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

  // Resolve a usable access token. GSC stores a per-domain token map plus a
  // refresh token; the bare gsc_access_token cookie is short-lived (~1h) and may
  // be absent even when GSC still works. Fall back to the refresh token so GA4
  // doesn't break the moment the generic access token expires.
  let accessToken = cookieStore.get("gsc_access_token")?.value;
  const refreshToken = cookieStore.get("gsc_refresh_token")?.value;
  if (!accessToken && refreshToken) {
    try {
      const refreshed = await refreshAccessToken(refreshToken);
      accessToken = refreshed.access_token;
    } catch { /* fall through to 401 below */ }
  }
  if (!accessToken) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const propertyId = req.nextUrl.searchParams.get("property");
  if (!propertyId) return NextResponse.json({ error: "No property param" }, { status: 400 });

  // Reject measurement IDs (G-XXXXXXXX) — the Data API needs the numeric property ID
  if (/^G-/i.test(propertyId)) {
    return NextResponse.json({
      error: "Please use the numeric Property ID (e.g. 329168258), not the Measurement ID (G-XXXXXXXX). Find it in GA4 → Admin → Property Settings.",
    }, { status: 400 });
  }

  // Date range: explicit start/end (custom) takes precedence, else last N days (default 28)
  const qsStart = req.nextUrl.searchParams.get("start");
  const qsEnd = req.nextUrl.searchParams.get("end");
  const iso = (d: Date) => d.toISOString().split("T")[0];
  let startDate: string, endDate: string, rangeDays: number;
  if (qsStart && qsEnd) {
    startDate = qsStart; endDate = qsEnd;
    rangeDays = Math.max(1, Math.round((new Date(qsEnd).getTime() - new Date(qsStart).getTime()) / 86400000) + 1);
  } else {
    rangeDays = Math.max(1, parseInt(req.nextUrl.searchParams.get("days") || "28"));
    endDate = iso(new Date());
    startDate = iso(new Date(Date.now() - rangeDays * 86400000));
  }
  // Previous comparison window = same length immediately before the start date
  const startMs = new Date(startDate).getTime();
  const prevEnd = iso(new Date(startMs - 86400000));
  const prevStart = iso(new Date(startMs - rangeDays * 86400000));

  try {
  const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
  const base = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;
  const metrics = [
    { name: "sessions" }, { name: "activeUsers" }, { name: "newUsers" },
    { name: "bounceRate" }, { name: "averageSessionDuration" }, { name: "conversions" },
  ];

  const [summaryRes, prevSummaryRes, sourceRes, pageRes, dailyRes, channelRes] = await Promise.all([
    fetch(base, { method: "POST", headers, body: JSON.stringify({ dateRanges: [{ startDate, endDate }], metrics }) }),
    fetch(base, { method: "POST", headers, body: JSON.stringify({ dateRanges: [{ startDate: prevStart, endDate: prevEnd }], metrics }) }),
    fetch(base, { method: "POST", headers, body: JSON.stringify({ dateRanges: [{ startDate, endDate }], dimensions: [{ name: "sessionSource" }], metrics: [{ name: "sessions" }], orderBys: [{ metric: { metricName: "sessions" }, desc: true }], limit: 25 }) }),
    fetch(base, { method: "POST", headers, body: JSON.stringify({ dateRanges: [{ startDate, endDate }], dimensions: [{ name: "pagePath" }], metrics: [
      { name: "screenPageViews" }, { name: "activeUsers" }, { name: "bounceRate" },
      { name: "averageSessionDuration" }, { name: "conversions" },
    ]}) }),
    fetch(base, { method: "POST", headers, body: JSON.stringify({ dateRanges: [{ startDate, endDate }], dimensions: [{ name: "date" }], metrics: [{ name: "sessions" }] }) }),
    // Channel grouping aggregates social referrers into "Organic Social" / "Paid Social"
    fetch(base, { method: "POST", headers, body: JSON.stringify({ dateRanges: [{ startDate, endDate }], dimensions: [{ name: "sessionDefaultChannelGroup" }], metrics: [{ name: "sessions" }], orderBys: [{ metric: { metricName: "sessions" }, desc: true }], limit: 25 }) }),
  ]);

  const safeJson = async (r: Response) => { try { return await r.json(); } catch { return {}; } };
  const [summaryData, prevSummaryData, sourceData, pageData, dailyData, channelData] = await Promise.all([
    safeJson(summaryRes), safeJson(prevSummaryRes), safeJson(sourceRes), safeJson(pageRes), safeJson(dailyRes), safeJson(channelRes),
  ]);

  // Expired/invalid token → tell the client to re-auth instead of throwing
  if (summaryRes.status === 401 || summaryData.error?.code === 401) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Surface API errors instead of silently returning zeros
  if (summaryData.error) {
    const msg = summaryData.error.message || "GA4 API error";
    const code = summaryData.error.code || summaryRes.status;
    if (code === 403) {
      return NextResponse.json({
        error: `Access denied (403): ${msg}. Make sure the Google Analytics Data API is enabled in Google Cloud Console and your account has Viewer access to this GA4 property.`,
      }, { status: 403 });
    }
    return NextResponse.json({ error: `GA4 API error ${code}: ${msg}` }, { status: 500 });
  }

  const row = summaryData.rows?.[0]?.metricValues || [];
  const prev = prevSummaryData.rows?.[0]?.metricValues || [];
  const pct = (cur: number, pre: number) => pre === 0 ? 0 : Math.round(((cur - pre) / pre) * 100);

  const curSessions = Math.round(+row[0]?.value || 0);
  const curUsers = Math.round(+row[1]?.value || 0);
  const curNewUsers = Math.round(+row[2]?.value || 0);
  const curBounce = +((+row[3]?.value || 0) * 100).toFixed(1);
  const curDuration = +row[4]?.value || 0;
  const curConversions = Math.round(+row[5]?.value || 0);
  const prevSessions = Math.round(+prev[0]?.value || 0);
  const prevUsers = Math.round(+prev[1]?.value || 0);
  const prevBounce = +((+prev[3]?.value || 0) * 100).toFixed(1);
  const prevConversions = Math.round(+prev[5]?.value || 0);

  const totalSourceSessions = (sourceData.rows || []).reduce(
    (s: number, r: { metricValues: { value: string }[] }) => s + Math.round(+r.metricValues[0].value), 0
  );

  // Channel grouping (Organic Search, Direct, Organic Social, Paid Social, Referral, Email, …)
  const channelRows = (channelData.rows || []) as { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[];
  const totalChannelSessions = channelRows.reduce((s, r) => s + Math.round(+r.metricValues[0].value), 0);
  const channels = channelRows.map(r => ({
    channel: r.dimensionValues[0].value,
    sessions: Math.round(+r.metricValues[0].value),
    pct: totalChannelSessions > 0 ? Math.round((+r.metricValues[0].value / totalChannelSessions) * 100) : 0,
  }));
  // All social channels combined (Organic + Paid Social)
  const social = channels.filter(c => /social/i.test(c.channel)).reduce((s, c) => s + c.sessions, 0);

  return NextResponse.json({
    domain: propertyId,
    _range: { start: startDate, end: endDate },
    _prevRange: { start: prevStart, end: prevEnd },
    summary: {
      sessions: curSessions,
      users: curUsers,
      new_users: curNewUsers,
      bounce_rate: curBounce,
      avg_duration: `${Math.floor(curDuration / 60)}m ${Math.round(curDuration % 60)}s`,
      conversions: curConversions,
      conv_rate: curSessions > 0 ? +((curConversions / curSessions) * 100).toFixed(2) : 0,
      sessions_change: pct(curSessions, prevSessions),
      users_change: pct(curUsers, prevUsers),
      bounce_change: +(curBounce - prevBounce).toFixed(1),
      conv_change: pct(curConversions, prevConversions),
    },
    sources: (sourceData.rows || []).slice(0, 20).map((r: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }) => ({
      source: r.dimensionValues[0].value,
      sessions: Math.round(+r.metricValues[0].value),
      pct: totalSourceSessions > 0 ? Math.round((+r.metricValues[0].value / totalSourceSessions) * 100) : 0,
    })),
    channels,
    social_sessions: social,
    pages: (pageData.rows || []).slice(0, 10).map((r: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }) => ({
      page: r.dimensionValues[0].value,
      views: Math.round(+r.metricValues[0].value),
      users: Math.round(+r.metricValues[1].value),
      bounce: +((+r.metricValues[2].value) * 100).toFixed(1),
      duration: `${Math.floor(+r.metricValues[3].value / 60)}m ${Math.round(+r.metricValues[3].value % 60)}s`,
      conv_rate: +r.metricValues[0].value > 0 ? +((+r.metricValues[4].value / +r.metricValues[0].value) * 100).toFixed(2) : 0,
    })),
    daily: (dailyData.rows || []).map((r: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }) => {
      const s = r.dimensionValues[0].value; // "20250101"
      const d = new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8));
      return {
        date: d.toLocaleDateString("en", { month: "short", day: "numeric" }),
        sessions: Math.round(+r.metricValues[0].value),
      };
    }),
  });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: `GA4 request failed: ${e instanceof Error ? e.message : "unknown error"}` },
      { status: 500 },
    );
  }
}
