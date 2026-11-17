// Zoho CRM (v8) — read-only access via a self-client refresh token.
//
// Self-client is the right flow here: there is no user-facing OAuth, no redirect URL and no
// callback route to add — which matters because this project is on Vercel's Hobby plan and
// already at the 12-serverless-function cap. One refresh token lives in the environment and
// every request mints a short-lived access token from it.
//
// Required env vars:
//   ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN
//   ZOHO_DC — data centre: us | eu | in | au | jp | ca   (default: us)
//
// The data centre MUST match the one the account lives in. Tokens issued in one DC are
// rejected by another, which surfaces as INVALID_TOKEN rather than anything describing the
// real problem, so it is validated explicitly below.

type DC = "us" | "eu" | "in" | "au" | "jp" | "ca";

const DOMAINS: Record<DC, { accounts: string; api: string }> = {
  us: { accounts: "https://accounts.zoho.com",     api: "https://www.zohoapis.com" },
  eu: { accounts: "https://accounts.zoho.eu",      api: "https://www.zohoapis.eu" },
  in: { accounts: "https://accounts.zoho.in",      api: "https://www.zohoapis.in" },
  au: { accounts: "https://accounts.zoho.com.au",  api: "https://www.zohoapis.com.au" },
  jp: { accounts: "https://accounts.zoho.jp",      api: "https://www.zohoapis.jp" },
  ca: { accounts: "https://accounts.zohocloud.ca", api: "https://www.zohoapis.ca" },
};

const env = (k: string) => (process.env[k] || "").replace(/^﻿/, "").trim();

export function zohoDc(): DC {
  const raw = env("ZOHO_DC").toLowerCase() as DC;
  return (raw && DOMAINS[raw]) ? raw : "us";
}

export function zohoConfigured(): boolean {
  return !!(env("ZOHO_CLIENT_ID") && env("ZOHO_CLIENT_SECRET") && env("ZOHO_REFRESH_TOKEN"));
}

// Access tokens live 3600s. Cache in module scope so a warm lambda reuses one instead of
// burning a refresh call (and Zoho's refresh quota) on every request.
let cached: { token: string; expires: number } | null = null;

export async function zohoAccessToken(force = false): Promise<string> {
  if (!zohoConfigured()) throw new Error("Zoho is not configured. Set ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET and ZOHO_REFRESH_TOKEN.");
  if (!force && cached && Date.now() < cached.expires) return cached.token;

  const { accounts } = DOMAINS[zohoDc()];
  const body = new URLSearchParams({
    refresh_token: env("ZOHO_REFRESH_TOKEN"),
    client_id: env("ZOHO_CLIENT_ID"),
    client_secret: env("ZOHO_CLIENT_SECRET"),
    grant_type: "refresh_token",
  });
  const r = await fetch(`${accounts}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(20000),
  });
  const j = await r.json().catch(() => ({})) as { access_token?: string; error?: string; expires_in?: number };
  if (!j.access_token) {
    // Zoho returns 200 with an `error` field, so a status check alone is not enough.
    const hint = j.error === "invalid_client" ? ` — check ZOHO_CLIENT_ID/SECRET and that ZOHO_DC is correct (currently "${zohoDc()}")`
      : j.error === "invalid_code" ? " — the refresh token is invalid or was revoked; generate a new one in the Zoho API console"
      : "";
    throw new Error(`Zoho token refresh failed: ${j.error || `HTTP ${r.status}`}${hint}`);
  }
  // Expire a minute early so an in-flight request never races the real expiry.
  cached = { token: j.access_token, expires: Date.now() + ((j.expires_in || 3600) - 60) * 1000 };
  return cached.token;
}

export type ZohoRecord = Record<string, unknown>;

// GET one page of a module. Retries once on an auth failure with a forced token refresh,
// which covers a token revoked or expired between the cache write and the call.
export async function zohoRecords(
  moduleName: string,
  fields: string[],
  opts: { perPage?: number; page?: number; sortBy?: string; sortOrder?: "asc" | "desc" } = {},
): Promise<{ data: ZohoRecord[]; more: boolean }> {
  const { api } = DOMAINS[zohoDc()];
  const qs = new URLSearchParams({
    fields: fields.join(","),                                   // mandatory when listing records
    per_page: String(Math.min(Math.max(opts.perPage || 200, 1), 200)),
    page: String(Math.max(opts.page || 1, 1)),
    sort_by: opts.sortBy || "Created_Time",
    sort_order: opts.sortOrder || "desc",
  });

  const call = async (token: string) => fetch(`${api}/crm/v8/${encodeURIComponent(moduleName)}?${qs}`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
    signal: AbortSignal.timeout(25000),
  });

  let res = await call(await zohoAccessToken());
  if (res.status === 401) res = await call(await zohoAccessToken(true));

  // 204 = module exists but has no records in range. That is a valid empty result, not a fault.
  if (res.status === 204) return { data: [], more: false };
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Zoho ${moduleName} read failed (HTTP ${res.status}): ${t.slice(0, 200)}`);
  }
  const j = await res.json() as { data?: ZohoRecord[]; info?: { more_records?: boolean } };
  return { data: j.data || [], more: !!j.info?.more_records };
}

// Pull up to `max` records across pages. Capped because this runs inside a request.
export async function zohoAll(moduleName: string, fields: string[], max = 600): Promise<ZohoRecord[]> {
  const out: ZohoRecord[] = [];
  for (let page = 1; page <= Math.ceil(max / 200); page++) {
    const { data, more } = await zohoRecords(moduleName, fields, { page, perPage: 200 });
    out.push(...data);
    if (!more || out.length >= max) break;
  }
  return out.slice(0, max);
}

// A lead source counts as organic search when Zoho's own value says so. Paid and social are
// excluded deliberately — conflating them would overstate what SEO actually produced.
export function isOrganicSource(src: unknown): boolean {
  const s = String(src || "").toLowerCase();
  if (!s) return false;
  if (/paid|ppc|adwords|google ads|cpc|social|facebook|linkedin|referral|email/.test(s)) return false;
  return /organic|seo|search engine|google|bing|web search|website|web download|web form/.test(s);
}
