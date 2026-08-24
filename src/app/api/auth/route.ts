import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const site = req.nextUrl.searchParams.get("site") || "";
  const mode = req.nextUrl.searchParams.get("scope") || ""; // "ads" → Google Ads connect

  // Google Ads (Keyword Planner) connect flow vs default GSC/GA4 flow
  const scopes = mode === "ads"
    ? ["https://www.googleapis.com/auth/adwords", "https://www.googleapis.com/auth/userinfo.email"].join(" ")
    : [
        "https://www.googleapis.com/auth/webmasters.readonly",
        "https://www.googleapis.com/auth/analytics.readonly",
        "https://www.googleapis.com/auth/userinfo.email",
      ].join(" ");

  const params = new URLSearchParams({
    client_id: (process.env.GOOGLE_CLIENT_ID || "").trim(),
    redirect_uri: (process.env.GOOGLE_REDIRECT_URI || "").trim(),
    response_type: "code",
    scope: scopes,
    access_type: "offline",
    prompt: "select_account consent",
    state: mode === "ads" ? "ads:" + site : site, // prefix marks ads-connect so callback stores ads token
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  );
}
