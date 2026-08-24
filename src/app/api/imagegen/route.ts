import { NextRequest, NextResponse } from "next/server";

const FREEPIK_SEARCH = "https://api.freepik.com/v1/resources";

// Search Freepik stock library
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q") || "";
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "12"), 24);
  const freepikKey = (process.env.FREEPIK_API_KEY || "").trim();

  if (!query) return NextResponse.json({ error: "No query" }, { status: 400 });

  if (!freepikKey) {
    return NextResponse.json({ results: [], source: "unavailable", error: "No Freepik API key" });
  }

  try {
    const url = new URL(FREEPIK_SEARCH);
    url.searchParams.set("term", query);
    url.searchParams.set("filters[content_type]", "photo");
    url.searchParams.set("filters[license]", "freemium");
    url.searchParams.set("locale", "en-US");
    url.searchParams.set("page", "1");
    url.searchParams.set("limit", String(limit));

    const r = await fetch(url.toString(), {
      headers: { "x-freepik-api-key": freepikKey, "Accept": "application/json" },
      signal: AbortSignal.timeout(12000),
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({})) as { message?: string };
      throw new Error(err.message || `Freepik search error ${r.status}`);
    }

    const data = await r.json() as {
      data?: {
        id: number;
        title: string;
        preview?: { url: string; width: number; height: number };
        image?: { source?: { url: string } };
        type?: string;
      }[];
      meta?: { total?: number };
    };

    const results = (data.data || []).map(item => ({
      id: item.id,
      title: item.title,
      thumb: item.preview?.url || "",
      type: item.type || "photo",
    }));

    return NextResponse.json({ results, total: data.meta?.total || results.length, source: "freepik_stock" });
  } catch (freepikErr) {
    console.error("Freepik search failed, trying Pexels:", freepikErr);
    // Fallback to Pexels
    const pexelsKey = (process.env.PEXELS_API_KEY || "").trim();
    if (pexelsKey) {
      try {
        const pr = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${limit}&orientation=landscape`, {
          headers: { Authorization: pexelsKey },
          signal: AbortSignal.timeout(12000),
        });
        const pd = await pr.json() as { photos?: { id: number; alt: string; src: { medium: string; original: string } }[]; total_results?: number };
        const results = (pd.photos || []).map(p => ({ id: p.id, title: p.alt || query, thumb: p.src.medium, type: "photo" }));
        return NextResponse.json({ results, total: pd.total_results || results.length, source: "pexels" });
      } catch { /* fall through */ }
    }
    return NextResponse.json({ results: [], source: "error", error: freepikErr instanceof Error ? freepikErr.message : "Search failed" });
  }
}

const MODELSLAB_REALTIME = "https://modelslab.com/api/v6/realtime/text2img";
const MODELSLAB_FETCH    = "https://modelslab.com/api/v6/images/fetch";
const FREEPIK_BASE       = "https://api.freepik.com/v1/ai/text-to-image";

// Fetch the image and return as base64 data URL to avoid browser CORS issues
async function toBase64DataUrl(imageUrl: string): Promise<string> {
  const r = await fetch(imageUrl, { signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`Failed to fetch image: ${r.status}`);
  const contentType = r.headers.get("content-type") || "image/jpeg";
  const buffer = await r.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  return `data:${contentType};base64,${base64}`;
}

async function generateWithFreepik(prompt: string, negative_prompt: string, key: string): Promise<string> {
  // Create generation task
  const r = await fetch(FREEPIK_BASE, {
    method: "POST",
    headers: { "x-freepik-api-key": key, "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({
      prompt,
      negative_prompt: negative_prompt || "text, words, letters, typography, watermark, signature, logo, human face, people, ugly, blurry, low quality, distorted, noise",
      num_images: 1,
      image: { size: "widescreen_16_9" },
      styling: { style: "photo", color: "none", lightning: "none", framing: "none" },
    }),
    signal: AbortSignal.timeout(30000),
  });

  const data = await r.json() as {
    data?: { task_id?: string; base64?: string; status?: string; generated?: { url: string; has_nsfw: boolean }[] };
    message?: string;
    errors?: Record<string, string[]>;
  };

  if (!r.ok) {
    const msg = data.message || Object.values(data.errors || {}).flat().join(", ") || `Freepik error ${r.status}`;
    throw new Error(msg);
  }

  // Some Freepik plans return base64 directly (synchronous)
  if (data.data?.base64) {
    return `data:image/jpeg;base64,${data.data.base64}`;
  }

  const taskId = data.data?.task_id;
  if (!taskId) throw new Error("No task ID from Freepik");

  // Poll until COMPLETED (up to ~60s)
  for (let i = 0; i < 12; i++) {
    await new Promise(res => setTimeout(res, 5000));
    const pr = await fetch(`${FREEPIK_BASE}/${taskId}`, {
      headers: { "x-freepik-api-key": key, "Accept": "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    const pd = await pr.json() as {
      data?: { status?: string; generated?: { url: string; has_nsfw: boolean }[] };
    };
    const status = pd.data?.status;
    if (status === "COMPLETED") {
      const url = pd.data?.generated?.[0]?.url;
      if (url) return url;
      throw new Error("Freepik returned no image URL");
    }
    if (status === "FAILED") throw new Error("Freepik generation failed");
  }
  throw new Error("Freepik timed out after 60s");
}

async function generateWithModelsLab(prompt: string, negative_prompt: string, seed: number | null, key: string): Promise<string> {
  const body = {
    key,
    prompt,
    negative_prompt: negative_prompt || "text, words, letters, typography, watermark, signature, logo, human face, people, ugly, blurry, low quality, distorted, noise",
    width: "1200",
    height: "630",
    samples: "1",
    num_inference_steps: "25",
    safety_checker: "no",
    enhance_prompt: "yes",
    seed: seed ?? null,
    guidance_scale: 7.5,
    multi_lingual: "no",
    upscale: "no",
    base64: "no",
  };

  const r = await fetch(MODELSLAB_REALTIME, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });

  const data = await r.json() as {
    status: string;
    output?: string[];
    proxy_links?: string[];
    eta?: number;
    id?: number;
    message?: string;
  };

  // Detect out-of-credits so caller can fall through to next provider
  if (data.message?.toLowerCase().includes("credit") || data.message?.toLowerCase().includes("wallet")) {
    throw new Error(`MODELSLAB_NO_CREDITS: ${data.message}`);
  }

  let imageUrl: string | null = null;

  if (data.status === "success") {
    imageUrl = data.proxy_links?.[0] || data.output?.[0] || null;
  }

  if (!imageUrl && data.status === "processing" && data.id) {
    const waitMs = Math.min((data.eta || 20), 45) * 1000;
    await new Promise(res => setTimeout(res, waitMs));
    const fetchR = await fetch(`${MODELSLAB_FETCH}/${data.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
      signal: AbortSignal.timeout(30000),
    });
    const fetchData = await fetchR.json() as { status: string; output?: string[]; proxy_links?: string[] };
    if (fetchData.status === "success") {
      imageUrl = fetchData.proxy_links?.[0] || fetchData.output?.[0] || null;
    }
  }

  if (!imageUrl) throw new Error(data.message || `ModelsLab returned: ${data.status}`);
  return imageUrl;
}

export async function POST(req: NextRequest) {
  const { prompt, negative_prompt, seed } = await req.json();
  if (!prompt) return NextResponse.json({ error: "No prompt" }, { status: 400 });

  const freepikKey  = (process.env.FREEPIK_API_KEY    || "").trim();
  const modelsKey   = (process.env.MODELSLAB_API_KEY   || "").trim();

  // 1. Try Freepik
  if (freepikKey) {
    try {
      const result = await generateWithFreepik(prompt, negative_prompt, freepikKey);
      // If Freepik returned a URL (not base64), proxy it; if base64 data URL return directly
      const dataUrl = result.startsWith("data:") ? result : await toBase64DataUrl(result);
      return NextResponse.json({ url: dataUrl, provider: "freepik" });
    } catch (e) {
      console.error("Freepik failed, falling through:", e instanceof Error ? e.message : e);
    }
  }

  // 2. Try ModelsLab
  if (modelsKey) {
    try {
      const imageUrl = await generateWithModelsLab(prompt, negative_prompt, seed ?? null, modelsKey);
      const dataUrl = await toBase64DataUrl(imageUrl);
      return NextResponse.json({ url: dataUrl, provider: "modelslab" });
    } catch (e) {
      console.error("ModelsLab failed, falling through:", e instanceof Error ? e.message : e);
    }
  }

  // 3. Pollinations fallback (always free, no key)
  // Rewrite prompt for illustration style — Pollinations handles flat design much better than photorealism
  try {
    const illuPrompt = prompt.includes("illustration") || prompt.includes("vector") || prompt.includes("flat design")
      ? prompt
      : `${prompt}, flat design digital illustration style, clean minimal composition, professional blog cover art, no people, no faces, conceptual vector art`;
    const neg = encodeURIComponent((negative_prompt || "") + ",photorealistic,photograph,camera,DSLR,people,faces,human,person,ugly,blurry,low quality,watermark,text,words");
    const polUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(illuPrompt)}?width=1200&height=630&seed=${seed || Math.floor(Math.random() * 99999)}&nologo=true&model=flux&negative_prompt=${neg}`;
    const dataUrl = await toBase64DataUrl(polUrl);
    return NextResponse.json({ url: dataUrl, provider: "pollinations" });
  } catch (e) {
    return NextResponse.json(
      { error: `All image providers failed. Last error: ${e instanceof Error ? e.message : e}` },
      { status: 500 }
    );
  }
}
