import { dbLogActivity, dbIncrQueryCount } from "./db";

export type LogAction = "signup" | "signin" | "tool_run";

export async function logActivity(
  userId: string,
  email: string,
  name: string,
  action: LogAction,
  tool?: string,
  meta?: Record<string, unknown>
): Promise<void> {
  try {
    await dbLogActivity({ userId, email, name, action, tool, meta, timestamp: new Date().toISOString() });
    if (action === "tool_run") await dbIncrQueryCount(userId);
  } catch { /* never throw — logging must not block */ }
}

export function detectTool(prompt: string): string {
  const p = prompt.toLowerCase();
  if (p.includes("keyword researcher") || p.includes("keyword magic")) return "Keyword Explorer";
  if (p.includes("technical seo auditor") || p.includes("crawl data")) return "Site Crawl";
  if (p.includes("backlink analyst") || p.includes("backlink profile")) return "Backlink Profile";
  if (p.includes("serp analysis") || p.includes("serp analyzer")) return "SERP Analyzer";
  if (p.includes("on-page seo") || p.includes("on-page analyst")) return "On-Page SEO";
  if (p.includes("competitor analysis") || p.includes("competitive intelligence")) return "Competitor Analysis";
  if (p.includes("content audit") || p.includes("content auditor")) return "Content Audit";
  if (p.includes("rank track")) return "Rank Tracker";
  if (p.includes("local seo") || p.includes("google business")) return "Local SEO";
  if (p.includes("content idea") || p.includes("topic cluster")) return "Content Ideas";
  if (p.includes("brand mention")) return "Brand Monitor";
  if (p.includes("internal link")) return "Internal Links";
  if (p.includes("sitemap")) return "Sitemap";
  if (p.includes("link intersect")) return "Link Intersect";
  if (p.includes("schema mark")) return "Schema Generator";
  if (p.includes("cannibali")) return "Cannibalization";
  return "AI Query";
}
