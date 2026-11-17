// Shared AI call helper
// Priority chain: Groq → Claude key1 → Claude key2 → Gemini → DuckDuckGo AI (keyless) → scrape

const isRateLimit = (msg: string) =>
  /rate.?limit|token.*per.*(day|minute)|tpd|tpm|quota|overloaded|529|capacity|credit.*balance|insufficient.*credit|billing|balance.*too.*low|out of credit/i.test(msg);

// ── Claude ────────────────────────────────────────────────────────────────────
async function callClaudeWithKey(key: string, prompt: string, maxTokens: number): Promise<string> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: Math.min(Math.max(Number(maxTokens) || 4096, 512), 8192),
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(85000),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error((err.error as Record<string, unknown>)?.message as string || `Claude error ${r.status}`);
  }
  const data = await r.json() as { content: { type: string; text: string }[] };
  return data.content.map(b => b.type === "text" ? b.text : "").join("").trim();
}

// ── Groq ──────────────────────────────────────────────────────────────────────
// Groq rate limits are PER-MODEL — when one model's daily quota is exhausted,
// fall back to another model with its own separate quota.
// Groq decommissioned llama-3.3-70b-versatile and llama-3.1-8b-instant on 2026-08-16, and
// qwen3-32b and llama-4-scout on 2026-07-17. Keeping dead ids in the chain wasted a request
// each AND masked the real failure, because callGroq only ever reported the LAST error.
const GROQ_MODELS = ["openai/gpt-oss-120b", "qwen/qwen3.6-27b", "openai/gpt-oss-20b"];

async function callGroqModel(key: string, model: string, prompt: string, maxTokens: number, jsonMode: boolean): Promise<string> {
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content: prompt }],
    max_tokens: Math.min(Math.max(Number(maxTokens) || 4096, 512), 32768),
    temperature: 0.7,
  };
  if (jsonMode) body.response_format = { type: "json_object" };
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(85000),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error((err.error as Record<string, unknown>)?.message as string || `Groq error ${r.status}`);
  }
  const data = await r.json() as { choices: { message: { content: string } }[] };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

async function callGroq(prompt: string, maxTokens: number, jsonMode: boolean): Promise<string> {
  const key = (process.env.GROQ_API_KEY || "").trim();
  if (!key) throw new Error("GROQ_API_KEY not configured");
  // Report EVERY model's failure, not just the last one. Reporting only the last error hid
  // the real cause whenever a trailing model in the chain failed for a different reason.
  const errs: string[] = [];
  for (const model of GROQ_MODELS) {
    try {
      return await callGroqModel(key, model, prompt, maxTokens, jsonMode);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errs.push(`${model}: ${msg.slice(0, 90)}`);
      // Roll to next model on rate-limit/capacity/model errors; otherwise bubble up
      if (!isRateLimit(msg) && !/model.*(not found|decommission|unavailable)|does not exist|400/i.test(msg)) throw e;
    }
  }
  throw new Error(errs.join(" ; ") || "Groq: all models exhausted");
}

// ── Google AI Studio / Gemini ────────────────────────────────────────────────
// The GOOGLE_AI_STUDIO_KEY was already configured for image generation but was never
// wired into the text chain, so an outage at Groq + Anthropic fell straight through to
// DuckDuckGo. Gemini now sits between them as a real, keyed provider.
const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];

function geminiKey(): string {
  return (process.env.GOOGLE_AI_STUDIO_KEY || process.env.GEMINI_API_KEY || "").replace(/^﻿/, "").trim();
}

async function callGeminiModel(key: string, model: string, prompt: string, maxTokens: number, jsonMode: boolean): Promise<string> {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: Math.min(Math.max(Number(maxTokens) || 4096, 512), 32768),
        temperature: 0.7,
        ...(jsonMode ? { responseMimeType: "application/json" } : {}),
      },
    }),
    signal: AbortSignal.timeout(85000),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error((err.error as Record<string, unknown>)?.message as string || `Gemini error ${r.status}`);
  }
  const data = await r.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const out = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("").trim();
  if (!out) throw new Error("Gemini: empty response");
  return out;
}

async function callGemini(prompt: string, maxTokens: number, jsonMode: boolean): Promise<string> {
  const key = geminiKey();
  if (!key) throw new Error("GOOGLE_AI_STUDIO_KEY not configured");
  const errs: string[] = [];
  for (const model of GEMINI_MODELS) {
    try {
      return await callGeminiModel(key, model, prompt, maxTokens, jsonMode);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errs.push(`${model}: ${msg.slice(0, 90)}`);
      if (!isRateLimit(msg) && !/not found|unavailable|does not exist|400|404/i.test(msg)) throw e;
    }
  }
  throw new Error(errs.join(" ; ") || "Gemini: all models exhausted");
}

// ── DuckDuckGo AI Chat (free, no API key needed, GPT-4o-mini) ─────────────────
async function callDDGChat(prompt: string): Promise<string> {
  // Step 1: Get VQD token
  const statusRes = await fetch("https://duckduckgo.com/duckchat/v1/status", {
    headers: {
      "x-vqd-accept": "1",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    },
    signal: AbortSignal.timeout(10000),
  });
  const vqd = statusRes.headers.get("x-vqd-4");
  if (!vqd) throw new Error("DDG: could not get VQD token");

  // Step 2: Send message (returns SSE stream)
  const chatRes = await fetch("https://duckduckgo.com/duckchat/v1/chat", {
    method: "POST",
    headers: {
      "x-vqd-4": vqd,
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      "Accept": "text/event-stream",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt.slice(0, 4000) }], // DDG has ~4K char limit
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!chatRes.ok) throw new Error(`DDG chat error ${chatRes.status}`);

  // Parse SSE stream
  const text = await chatRes.text();
  const lines = text.split("\n");
  let result = "";
  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    const data = line.slice(6).trim();
    if (data === "[DONE]") break;
    try {
      const parsed = JSON.parse(data) as { message?: string };
      if (parsed.message) result += parsed.message;
    } catch { /* skip non-JSON lines */ }
  }
  if (!result) throw new Error("DDG: empty response");
  return result.trim();
}

// ── Perplexity web scrape (keyless, returns AI-generated snippets) ────────────
async function callPerplexityScrape(prompt: string): Promise<string> {
  // Extract the core question from the prompt for a search query
  const query = prompt.slice(0, 200).replace(/return only valid json.*$/i, "").trim();
  const res = await fetch(
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=us-en`,
    {
      headers: { "User-Agent": "Mozilla/5.0 Chrome/120", "Accept": "text/html" },
      signal: AbortSignal.timeout(10000),
    }
  );
  if (!res.ok) throw new Error("Scrape failed");
  const html = await res.text();
  const snippets: string[] = [];
  const re = /class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|span)>/gi;
  for (const m of [...html.matchAll(re)].slice(0, 5)) {
    const t = m[1].replace(/<[^>]+>/g, "").replace(/&[a-z]+;/g, " ").trim();
    if (t.length > 20) snippets.push(t);
  }
  if (!snippets.length) throw new Error("No snippets found");
  return snippets.join("\n\n");
}

const MAX_PROMPT = 22000;
function trimPrompt(p: string): string {
  if (p.length <= MAX_PROMPT) return p;
  return p.slice(0, Math.floor(MAX_PROMPT * 0.6)) + "\n\n[...trimmed...]\n\n" + p.slice(-Math.floor(MAX_PROMPT * 0.4));
}

export async function callAI(prompt: string, maxTokens = 4096, jsonMode = true): Promise<string> {
  const p = trimPrompt(prompt);
  const key1 = (process.env.ANTHROPIC_API_KEY   || "").replace(/^﻿/, "").trim();
  const key2 = (process.env.ANTHROPIC_API_KEY_2 || "").replace(/^﻿/, "").trim();
  const groqKey = (process.env.GROQ_API_KEY || "").trim();
  const claudeKeys = [key1, key2].filter(Boolean);
  const fails: string[] = [];

  // 1. Try Groq FIRST (primary) — across its model fallback chain
  if (groqKey) {
    try {
      return await callGroq(p, maxTokens, jsonMode);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Groq failed:", msg);
      fails.push(`Groq: ${msg.slice(0, 140)}`);
    }
  } else {
    fails.push("Groq: GROQ_API_KEY not set in environment");
  }

  // 2. Claude keys (fallback)
  for (const k of claudeKeys) {
    try {
      return await callClaudeWithKey(k, p, maxTokens);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      fails.push(`Claude: ${msg.slice(0, 120)}`);
      // continue to next key / DDG on any Claude error
    }
  }

  // 3. Gemini (Google AI Studio) — keyed provider, tried before the keyless scrapers
  if (geminiKey()) {
    try {
      return await callGemini(p, maxTokens, jsonMode);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Gemini failed:", msg);
      fails.push(`Gemini: ${msg.slice(0, 140)}`);
    }
  } else {
    fails.push("Gemini: GOOGLE_AI_STUDIO_KEY not set");
  }

  // 4. DuckDuckGo AI Chat — free, no key, GPT-4o-mini
  try {
    return await callDDGChat(p);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("DDG failed:", msg);
    fails.push(`DDG: ${msg.slice(0, 120)}`);
  }

  // 5. Web scrape fallback (text responses only)
  if (!jsonMode) {
    try {
      return await callPerplexityScrape(p);
    } catch { /* exhausted all options */ }
  }

  throw new Error(`All AI providers unavailable. ${fails.join(" | ")}`);
}

export function parseJSON(text: string): unknown {
  try { return JSON.parse(text); } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("No JSON in AI response");
    return JSON.parse(m[0]);
  }
}
