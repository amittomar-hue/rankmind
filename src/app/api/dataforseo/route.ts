import { NextRequest, NextResponse } from "next/server";
import { fetchSERP } from "@/lib/serp";
import { callAI, parseJSON } from "@/lib/ai";

// SERP-grounded NLP brief. SERP fetching + AI calling are centralized in lib/serp + lib/ai
// (no duplicated scrapers/providers here).

export async function POST(req: NextRequest) {
  const { keyword } = await req.json();
  if (!keyword) return NextResponse.json({ error: "No keyword" }, { status: 400 });

  try {
    const { results: competitors, source } = await fetchSERP(keyword);
    if (!competitors.length) {
      return NextResponse.json({ error: "No SERP results found. Try a different keyword." }, { status: 500 });
    }

    const snippets = competitors.map(c => `[#${c.pos}] ${c.title}. ${c.snippet}`).join("\n");
    let nlp = { nlp_terms: [] as string[], target_word_count: 1200, key_topics: [] as string[] };
    try {
      const raw = await callAI(
        `SEO content strategist. Analyze these top Google result snippets for the keyword "${keyword}" and identify NLP signals for a competing article.\nReturn ONLY valid JSON:\n{"nlp_terms":["20-25 key terms/phrases a top-ranking article must include"],"target_word_count":number,"key_topics":["6-8 main topics to cover"]}\n\nSnippets:\n${snippets.slice(0, 3500)}`,
        800, true
      );
      const parsed = parseJSON(raw) as { nlp_terms?: string[]; target_word_count?: number; key_topics?: string[] };
      nlp = {
        nlp_terms: parsed.nlp_terms || [],
        target_word_count: parsed.target_word_count || 1200,
        key_topics: parsed.key_topics || [],
      };
    } catch { /* keep defaults if AI unavailable */ }

    return NextResponse.json({
      keyword,
      source,
      competitors,
      nlp_terms: nlp.nlp_terms,
      target_word_count: nlp.target_word_count,
      key_topics: nlp.key_topics,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "SERP fetch failed" }, { status: 500 });
  }
}
