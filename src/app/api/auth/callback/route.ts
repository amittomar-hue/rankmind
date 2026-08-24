import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const code = req.nextUrl.searchParams.get("code");
  const rawState = (req.nextUrl.searchParams.get("state") || "").trim();
  const isAds = rawState.startsWith("ads:");
  const domain = isAds ? rawState.slice(4) : rawState; // site domain from state param

  if (!code) return NextResponse.redirect(`${origin}/?error=no_code`);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: (process.env.GOOGLE_CLIENT_ID || "").trim(),
      client_secret: (process.env.GOOGLE_CLIENT_SECRET || "").trim(),
      redirect_uri: (process.env.GOOGLE_REDIRECT_URI || "").trim(),
      grant_type: "authorization_code",
    }),
  });

  const tokens = await res.json();
  if (!tokens.access_token) return NextResponse.redirect(`${origin}/?error=token_failed`);

  const cookieStore = await cookies();

  // ── Google Ads connect: store the adwords refresh token for keyword volume ──
  if (isAds) {
    if (tokens.refresh_token) {
      cookieStore.set("google_ads_refresh_token", tokens.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 180, // 6 months
        path: "/",
      });
    }
    // One-time owner setup: show the refresh token so it can be set as a permanent
    // GOOGLE_ADS_REFRESH_TOKEN env var (makes real volume work app-wide by default).
    const rt = tokens.refresh_token || "(no refresh token returned — revoke app access at myaccount.google.com/permissions and retry)";
    return new NextResponse(
      `<!doctype html><html><body style="font-family:system-ui;max-width:680px;margin:60px auto;padding:0 20px">
        <h2 style="color:#10b981">✓ Google Ads connected</h2>
        <p>Keyword volume is now active for this browser. To enable it <b>app-wide by default</b>, set this as the <code>GOOGLE_ADS_REFRESH_TOKEN</code> environment variable in Vercel:</p>
        <textarea readonly style="width:100%;height:80px;font-family:monospace;font-size:13px;padding:10px;border:1px solid #ccc;border-radius:8px" onclick="this.select()">${rt}</textarea>
        <p style="color:#64748b;font-size:13px">Click the box to select, then copy. <a href="${origin}/">← Back to RankMind</a></p>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  // ── Per-domain token map ──────────────────────────────────────────────
  // Merge new tokens into existing map so each domain keeps its own creds
  if (domain) {
    let tokenMap: Record<string, { access_token: string; refresh_token?: string }> = {};
    try { tokenMap = JSON.parse(cookieStore.get("gsc_tokens")?.value || "{}"); } catch {}
    tokenMap[domain] = {
      access_token: tokens.access_token,
      ...(tokens.refresh_token ? { refresh_token: tokens.refresh_token } : {}),
      // If re-authing same domain with no new refresh_token, keep the old one
      ...(tokenMap[domain]?.refresh_token && !tokens.refresh_token
        ? { refresh_token: tokenMap[domain].refresh_token }
        : {}),
    };
    cookieStore.set("gsc_tokens", JSON.stringify(tokenMap), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
  }

  // ── Generic fallback tokens (backward compat) ─────────────────────────
  cookieStore.set("gsc_access_token", tokens.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 3600,
    path: "/",
  });
  if (tokens.refresh_token) {
    cookieStore.set("gsc_refresh_token", tokens.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
  }

  return NextResponse.redirect(`${origin}/?connected=true`);
}
