import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { verifySession } from "@/lib/auth";
import { logActivity, detectTool } from "@/lib/activity";
import { getRedis } from "@/lib/db";

export const maxDuration = 120;

const DAILY_QUOTA = 50;

function stripNonce(prompt: string): string {
  return prompt.replace(/\n\n\[IMPORTANT: produce output[\s\S]*?req:[a-z0-9]+\]$/m, "").trimEnd();
}

function cacheKey(prompt: string): string {
  const clean = stripNonce(prompt);
  return "ai_cache:" + createHash("sha256").update(clean).digest("hex").slice(0, 32);
}

function quotaKey(userId: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `quota:${userId}:${date}`;
}

// ── DuckDuckGo AI Chat (free, no key, GPT-4o-mini) ───────────────────────────
async function callDDGChat(prompt: string): Promise<string> {
  const statusRes = await fetch("https://duckduckgo.com/duckchat/v1/status", {
    headers: { "x-vqd-accept": "1", "User-Agent": "Mozilla/5.0 Chrome/120" },
    signal: AbortSignal.timeout(10000),
  });
  const vqd = statusRes.headers.get("x-vqd-4");
  if (!vqd) throw new Error("DDG: no VQD token");

  const chatRes = await fetch("https://duckduckgo.com/duckchat/v1/chat", {
    method: "POST",
    headers: {
      "x-vqd-4": vqd, "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 Chrome/120", "Accept": "text/event-stream",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt.slice(0, 4000) }],
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!chatRes.ok) throw new Error(`DDG error ${chatRes.status}`);

  const text = await chatRes.text();
  let result = "";
  for (const line of text.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const d = line.slice(6).trim();
    if (d === "[DONE]") break;
    try { const p = JSON.parse(d) as { message?: string }; if (p.message) result += p.message; } catch { /* skip */ }
  }
  if (!result) throw new Error("DDG: empty response");
  return result.trim();
}

// ── Groq (free) — per-model daily limits, so fall back across models ──────────
const GROQ_MODELS = ["llama-3.3-70b-versatile", "openai/gpt-oss-120b", "meta-llama/llama-4-scout-17b-16e-instruct", "qwen/qwen3-32b", "openai/gpt-oss-20b", "llama-3.1-8b-instant"];

async function callGroqModel(apiKey: string, model: string, prompt: string, maxTokens: number, format: string): Promise<string> {
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content: prompt }],
    max_tokens: Math.min(Math.max(Number(maxTokens) || 4096, 1024), 32768),
    temperature: 0.7,
  };
  if (format === "json") body.response_format = { type: "json_object" };
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90000),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error((err.error as Record<string, unknown>)?.message as string || `Groq error ${r.status}`);
  }
  const data = await r.json() as { choices: { message: { content: string } }[] };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

async function callGroq(prompt: string, maxTokens: number, format: string): Promise<string> {
  const apiKey = (process.env.GROQ_API_KEY || "").trim();
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");
  let lastErr = "";
  for (const model of GROQ_MODELS) {
    try {
      return await callGroqModel(apiKey, model, prompt, maxTokens, format);
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      if (!isRateLimit(lastErr) && !/model.*(not found|decommission|unavailable)|does not exist|400/i.test(lastErr)) throw e;
    }
  }
  throw new Error(lastErr || "Groq: all models exhausted");
}

// ── Claude (supports multiple API keys) ──────────────────────────────────────
async function callClaudeKey(apiKey: string, prompt: string, maxTokens: number): Promise<string> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: Math.min(Math.max(Number(maxTokens) || 4096, 1024), 8192),
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(90000),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error((err.error as Record<string, unknown>)?.message as string || `Claude error ${r.status}`);
  }
  const data = await r.json() as { content: { type: string; text: string }[] };
  return data.content.map(b => b.type === "text" ? b.text : "").join("").trim();
}

function isRateLimit(msg: string): boolean {
  return /rate.?limit|token.*per.*(day|minute)|tpd|tpm|quota|overloaded|529|capacity|credit.*balance|insufficient.*credit|billing|balance.*too.*low|out of credit/i.test(msg);
}

// ~24K chars ≈ ~6K tokens — keeps every provider comfortably within free limits
const MAX_PROMPT_CHARS = 24000;

function trimPrompt(prompt: string): string {
  if (prompt.length <= MAX_PROMPT_CHARS) return prompt;
  // Keep the tail (instructions) and truncate the middle content section
  const head = prompt.slice(0, Math.floor(MAX_PROMPT_CHARS * 0.6));
  const tail = prompt.slice(-Math.floor(MAX_PROMPT_CHARS * 0.4));
  return head + "\n\n[...content trimmed to fit token limit...]\n\n" + tail;
}

export async function POST(req: NextRequest) {
  const { prompt: rawPrompt, format = "json", maxTokens = 4096, provider = "" } = await req.json();
  if (!rawPrompt) return NextResponse.json({ error: "No prompt" }, { status: 400 });
  // provider:"claude" → prefer the (funded) Claude keys before Groq. Used by the content
  // writers so article/long-form content is written by Claude, not the Groq fallback.
  const claudeFirst = provider === "claude";
  const prompt = trimPrompt(rawPrompt);

  const sessionToken = req.cookies.get("rm_session")?.value;
  const session = sessionToken ? await verifySession(sessionToken) : null;
  const redis = getRedis();

  // Per-user daily quota check
  if (session && redis) {
    const qKey = quotaKey(session.id);
    const used = await redis.get<number>(qKey) ?? 0;
    if (used >= DAILY_QUOTA) {
      return NextResponse.json(
        { error: `Daily limit of ${DAILY_QUOTA} AI calls reached. Resets at midnight UTC.` },
        { status: 429 }
      );
    }
  }

  // Cache lookup
  const ck = cacheKey(prompt);
  if (redis && prompt.length > 100) {
    const cached = await redis.get<unknown>(ck);
    if (cached !== null && cached !== undefined) {
      const result = format === "text"
        ? (typeof cached === "string" ? cached : JSON.stringify(cached))
        : (typeof cached === "object" && cached !== null ? cached : typeof cached === "string" ? JSON.parse(cached) : cached);
      return NextResponse.json({ result, cached: true });
    }
  }

  try {
    // Priority: Groq (primary) → Claude key1 → Claude key2 → Campaign Claude key → DuckDuckGo
    // The campaign key is funded for content generation; include it last among Claude keys so
    // other tools (e.g. Competitor Analysis) keep working when the general keys run dry, while
    // still preferring the general keys first to preserve campaign budget.
    const key1   = (process.env.ANTHROPIC_API_KEY   || "").replace(/^﻿/, "").trim();
    const key2   = (process.env.ANTHROPIC_API_KEY_2 || "").replace(/^﻿/, "").trim();
    const keyCamp = (process.env.CAMPAIGN_ANTHROPIC_KEY || "").replace(/^﻿/, "").trim();
    const hasGroq = !!(process.env.GROQ_API_KEY || "").trim();
    // For content writers (claudeFirst) prefer the funded campaign key first; otherwise keep
    // the campaign key last so general tools preserve its budget.
    const claudeKeys = claudeFirst
      ? [...new Set([keyCamp, key1, key2].filter(Boolean))]
      : [...new Set([key1, key2, keyCamp].filter(Boolean))];
    let text = "";
    let gotText = false;

    const tryGroq = async () => {
      if (gotText || !hasGroq) return;
      try { text = await callGroq(prompt, maxTokens, format); gotText = true; }
      catch (e) { console.error("Groq failed:", e instanceof Error ? e.message : e); }
    };
    const tryClaude = async () => {
      if (gotText) return;
      for (const k of claudeKeys) {
        try { text = await callClaudeKey(k, prompt, maxTokens); gotText = true; break; }
        catch (e) { console.error("Claude failed:", e instanceof Error ? e.message : e); }
      }
    };

    // Content writers → Claude first; everything else → Groq first.
    if (claudeFirst) { await tryClaude(); await tryGroq(); }
    else { await tryGroq(); await tryClaude(); }

    // DuckDuckGo AI (free, keyless) last resort
    if (!gotText) {
      try {
        text = await callDDGChat(prompt);
        gotText = true;
      } catch (e) {
        console.error("DDG failed:", e instanceof Error ? e.message : e);
      }
    }

    if (!gotText) {
      throw new Error("All AI providers are currently unavailable. Please try again shortly.");
    }

    // Increment quota
    if (session && redis) {
      const qKey = quotaKey(session.id);
      await redis.incr(qKey);
      await redis.expire(qKey, 86400);
    }

    // Store in cache
    if (redis && prompt.length > 100) {
      if (format === "text") {
        await redis.set(ck, text, { ex: 3600 });
      } else {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) await redis.set(ck, match[0], { ex: 3600 });
      }
    }

    if (session) {
      const tool = detectTool(prompt);
      logActivity(session.id, session.email, session.name, "tool_run", tool, { chars: prompt.length }).catch(() => {});
    }

    if (format === "text") {
      return NextResponse.json({ result: text });
    }

    // For json format: Groq json_object mode returns pure JSON; Claude returns JSON wrapped in text
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("No JSON in response");
      parsed = JSON.parse(match[0]);
    }
    return NextResponse.json({ result: parsed });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    // Detect Groq/provider rate-limit errors and surface as 429 with a friendly message
    const isRateLimit = /rate.?limit|token.*per.*(day|minute)|tpd|tpm|quota/i.test(message);
    if (isRateLimit) {
      return NextResponse.json(
        { error: "AI provider daily limit reached. Please try again in a few hours, or connect your own Anthropic API key." },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
