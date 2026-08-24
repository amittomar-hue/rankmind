import { NextResponse } from "next/server";
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

export async function GET() {
  const cookieStore = await cookies();

  // Use the most recently stored generic token (freshest OAuth session)
  let accessToken = cookieStore.get("gsc_access_token")?.value;
  const refreshToken = cookieStore.get("gsc_refresh_token")?.value;

  if (!accessToken && refreshToken) {
    const refreshed = await refreshAccessToken(refreshToken);
    accessToken = refreshed.access_token;
  }
  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const res = await fetch("https://searchconsole.googleapis.com/webmasters/v3/sites", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();

  if (data.error) {
    return NextResponse.json({ error: data.error.message }, { status: data.error.code || 400 });
  }

  const sites = (data.siteEntry || []).map((s: { siteUrl: string; permissionLevel: string }) => ({
    url: s.siteUrl,
    permission: s.permissionLevel,
  }));

  return NextResponse.json({ sites });
}
