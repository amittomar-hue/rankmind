"use client";
import { useState } from "react";

const S = {
  bg: "#fafafa",
  card: "#ffffff",
  border: "#e4e4e7",
  text: "#18181b",
  muted: "#71717a",
  subtle: "#f4f4f5",
  accent: "#6366f1",
  accentText: "#4338ca",
  red: "#dc2626",
  redBg: "#fef2f2",
};

type User = { id: string; email: string; name: string };

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: `1px solid ${S.border}`,
  borderRadius: 8,
  padding: "9px 12px",
  fontSize: 13,
  color: S.text,
  background: S.card,
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: S.muted,
  marginBottom: 5,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

export default function AuthPage({ onAuth }: { onAuth: (user: User) => void }) {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [name, setName] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const switchMode = (m: "signin" | "signup") => {
    setMode(m);
    setError("");
    setSuccess("");
  };

  const handleSubmit = async () => {
    setError("");
    if (mode === "forgot") {
      if (!email.trim()) { setError("Please enter your email"); return; }
      setLoading(true);
      try {
        const res = await fetch("/api/auth/forgot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim() }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || "Something went wrong"); return; }
        setGeneratedCode(data.token);
        setMode("reset");
      } catch {
        setError("Network error — please try again");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (mode === "reset") {
      if (!resetCode.trim() || !password || !confirm) { setError("Please fill in all fields"); return; }
      if (password !== confirm) { setError("Passwords do not match"); return; }
      if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
      setLoading(true);
      try {
        const res = await fetch("/api/auth/reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), token: resetCode.trim(), password }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || "Reset failed"); return; }
        setSuccess("Password reset successfully. You can now sign in.");
        setMode("signin");
        setPassword("");
        setResetCode("");
        setGeneratedCode("");
      } catch {
        setError("Network error — please try again");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!email.trim() || !password) { setError("Please fill in all fields"); return; }
    if (mode === "signup" && !name.trim()) { setError("Please enter your name"); return; }

    setLoading(true);
    try {
      const res = await fetch(`/api/auth/${mode === "signin" ? "signin" : "signup"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong"); return; }
      onAuth(data.user);
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: S.bg, fontFamily: "system-ui,-apple-system,sans-serif", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32, justifyContent: "center" }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: S.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#fff", fontWeight: 700, boxShadow: "0 4px 12px rgba(99,102,241,0.35)" }}>R</div>
          <div>
            <p style={{ fontSize: 18, fontWeight: 700, color: S.text, margin: 0 }}>RankMind</p>
            <p style={{ fontSize: 12, color: S.muted, margin: 0 }}>AI-powered SEO Platform</p>
          </div>
        </div>

        {/* Card */}
        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 16, padding: "32px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>

          {/* Mode tabs — only for signin/signup */}
          {(mode === "signin" || mode === "signup") && (
            <div style={{ display: "flex", background: S.subtle, borderRadius: 8, padding: 3, marginBottom: 28 }}>
              {(["signin", "signup"] as const).map(m => (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  style={{ flex: 1, padding: "7px 0", borderRadius: 6, border: "none", background: mode === m ? S.card : "transparent", color: mode === m ? S.text : S.muted, fontWeight: mode === m ? 600 : 400, fontSize: 13, cursor: "pointer", fontFamily: "inherit", boxShadow: mode === m ? "0 1px 2px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s" }}
                >
                  {m === "signin" ? "Sign in" : "Sign up"}
                </button>
              ))}
            </div>
          )}

          {/* Forgot / Reset headings */}
          {mode === "forgot" && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: S.text, margin: "0 0 4px" }}>Reset your password</p>
              <p style={{ fontSize: 13, color: S.muted, margin: 0 }}>Enter your account email to get a reset code.</p>
            </div>
          )}
          {mode === "reset" && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: S.text, margin: "0 0 4px" }}>Enter reset code</p>
              {generatedCode && (
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 12px", marginTop: 8 }}>
                  <p style={{ fontSize: 12, color: "#15803d", margin: "0 0 4px", fontWeight: 600 }}>Demo mode — your reset code:</p>
                  <p style={{ fontSize: 22, fontWeight: 700, color: "#15803d", letterSpacing: "0.15em", margin: 0 }}>{generatedCode}</p>
                  <p style={{ fontSize: 11, color: "#16a34a", margin: "4px 0 0" }}>Valid for 15 minutes</p>
                </div>
              )}
            </div>
          )}

          {/* Success banner */}
          {success && (
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "9px 12px", marginBottom: 16, fontSize: 13, color: "#15803d" }}>
              {success}
            </div>
          )}

          {/* Name field (signup only) */}
          {mode === "signup" && (
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Full name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Jane Smith"
                style={inputStyle}
              />
            </div>
          )}

          {/* Email — signin, signup, forgot, reset */}
          {(mode === "signin" || mode === "signup" || mode === "forgot" || mode === "reset") && (
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                readOnly={mode === "reset"}
                style={{ ...inputStyle, background: mode === "reset" ? S.subtle : S.card, color: mode === "reset" ? S.muted : S.text }}
              />
            </div>
          )}

          {/* Reset code field */}
          {mode === "reset" && (
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Reset code</label>
              <input
                value={resetCode}
                onChange={e => setResetCode(e.target.value.toUpperCase())}
                placeholder="A3F9C1"
                maxLength={6}
                style={{ ...inputStyle, letterSpacing: "0.15em", fontWeight: 600 }}
              />
            </div>
          )}

          {/* Password */}
          {(mode === "signin" || mode === "signup" || mode === "reset") && (
            <div style={{ marginBottom: mode === "reset" ? 14 : 20 }}>
              <label style={labelStyle}>{mode === "reset" ? "New password" : "Password"}</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === "signup" || mode === "reset" ? "Min. 8 characters" : "••••••••"}
                onKeyDown={e => mode === "signin" && e.key === "Enter" && handleSubmit()}
                style={inputStyle}
              />
            </div>
          )}

          {/* Confirm password (reset only) */}
          {mode === "reset" && (
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat new password"
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                style={inputStyle}
              />
            </div>
          )}

          {/* Forgot password link — signin only */}
          {mode === "signin" && (
            <div style={{ marginTop: -12, marginBottom: 20, textAlign: "right" }}>
              <button
                onClick={() => { setMode("forgot"); setError(""); setSuccess(""); }}
                style={{ background: "none", border: "none", color: S.accentText, fontSize: 12, cursor: "pointer", fontFamily: "inherit", padding: 0 }}
              >
                Forgot password?
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ background: S.redBg, border: "1px solid #fecaca", borderRadius: 8, padding: "9px 12px", marginBottom: 16, fontSize: 13, color: S.red }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{ width: "100%", padding: "10px 0", borderRadius: 8, border: "none", background: loading ? "#e2e8f0" : `linear-gradient(135deg, ${S.accent}, #818cf8)`, color: loading ? "#94a3b8" : "#fff", fontWeight: 600, fontSize: 14, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", letterSpacing: "0.01em" }}
          >
            {loading ? "Please wait…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset code" : "Reset password"}
          </button>

          {/* Back link for forgot/reset */}
          {(mode === "forgot" || mode === "reset") && (
            <p style={{ textAlign: "center", fontSize: 12, color: S.muted, marginTop: 16, marginBottom: 0 }}>
              <button
                onClick={() => { setMode("signin"); setError(""); setGeneratedCode(""); setResetCode(""); setPassword(""); setConfirm(""); }}
                style={{ background: "none", border: "none", color: S.accentText, fontWeight: 600, cursor: "pointer", fontSize: 12, fontFamily: "inherit", padding: 0 }}
              >
                ← Back to sign in
              </button>
            </p>
          )}
        </div>

        {/* Switch mode link — only for signin/signup */}
        {(mode === "signin" || mode === "signup") && (
          <p style={{ textAlign: "center", fontSize: 13, color: S.muted, marginTop: 20 }}>
            {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
              style={{ background: "none", border: "none", color: S.accentText, fontWeight: 600, cursor: "pointer", fontSize: 13, fontFamily: "inherit", padding: 0 }}
            >
              {mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
