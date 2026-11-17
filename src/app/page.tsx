"use client";
import { useState, useEffect } from "react";
import RankMind from "@/components/RankMind";
import AuthPage from "@/components/AuthPage";
import { isSyncKey } from "@/lib/syncKeys";

type User = { id: string; email: string; name: string };

export default function Home() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(d => setUser(d.user ?? null))
      .catch(() => setUser(null));
  }, []);

  // After login, pull the account's saved workspace into localStorage BEFORE rendering
  // the app (so its useState(()=>localStorage...) initializers see the synced data).
  useEffect(() => {
    if (!user) { setHydrated(false); return; }
    let cancelled = false;
    fetch("/api/userstate")
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        const state = d?.state as Record<string, string> | null;
        if (state && typeof state === "object" && Object.keys(state).length) {
          // Merge server state into localStorage WITHOUT deleting local-only keys (so tool
          // history that exists only in this browser isn't wiped). History is append-only →
          // merge by entry id; other keys take the server value.
          // A project switch writes rm_active_site then reloads. If that reload beats the
          // server save, hydrating the stale server value would silently revert the choice —
          // so a locally-stamped switch from the last 2 minutes always wins.
          const recentSwitch = (() => {
            try {
              const ts = Number(localStorage.getItem("rm_switch_ts") || 0);
              return ts > 0 && Date.now() - ts < 120000;
            } catch { return false; }
          })();
          try {
            for (const [k, v] of Object.entries(state)) {
              if (typeof v !== "string") continue;
              if (k === "rm_active_site" && recentSwitch) continue;   // keep the user's just-made choice
              if (k.startsWith("rm_hist_")) {
                try {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const local: any[] = JSON.parse(localStorage.getItem(k) || "[]");
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const server: any[] = JSON.parse(v || "[]");
                  const seen = new Set<string>();
                  const merged = [...(Array.isArray(server) ? server : []), ...(Array.isArray(local) ? local : [])]
                    .filter(e => { const id = e && e.id ? String(e.id) : JSON.stringify(e); if (seen.has(id)) return false; seen.add(id); return true; })
                    .sort((a, b) => (b?.timestamp || 0) - (a?.timestamp || 0))
                    .slice(0, 20);
                  localStorage.setItem(k, JSON.stringify(merged));
                } catch { localStorage.setItem(k, v); }
              } else {
                localStorage.setItem(k, v);
              }
            }
          } catch {}
        } else {
          // First time on the account → seed the server from this browser's current state.
          try {
            const snap: Record<string, string> = {};
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (k && isSyncKey(k)) { const v = localStorage.getItem(k); if (v != null) snap[k] = v; }
            }
            if (Object.keys(snap).length) fetch("/api/userstate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state: snap }) }).catch(() => {});
          } catch {}
        }
        setHydrated(true);
      })
      .catch(() => setHydrated(true));
    return () => { cancelled = true; };
  }, [user]);

  // Loading splash
  if (user === undefined || (user && !hydrated)) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fafafa", fontFamily: "system-ui,-apple-system,sans-serif" }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#fff", fontWeight: 700, opacity: 0.8 }}>R</div>
      </div>
    );
  }

  if (!user) return <AuthPage onAuth={setUser} />;

  return <RankMind user={user} onSignOut={() => setUser(null)} />;
}
