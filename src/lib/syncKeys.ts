// localStorage keys whose values follow the user account across browsers
// (synced via /api/userstate). Shared by the hydrate (page.tsx) and save (RankMind) sides.
export const SYNC_PREFIXES = [
  "rm_gsc_map", "rm_ga4_map", "rm_active_site", "rm_page",
  "rm_proj_folders", "rm_proj_monitored",
  "rm_wp_url", "rm_wp_user", "rm_wp_pass", "rm_wp_auth_",
  "rm_wp_cats_", "rm_wp_selcats_", "rm_hist_", "rm_articles_",
  "rm_content_guideline", "rm_content_guideline_name",
];

export const isSyncKey = (k: string) => SYNC_PREFIXES.some(p => k === p || k.startsWith(p));

// Snapshot all synced keys from localStorage into a flat object.
export function snapshotSyncState(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && isSyncKey(k)) { const v = localStorage.getItem(k); if (v != null) out[k] = v; }
    }
  } catch { /* localStorage unavailable */ }
  return out;
}
