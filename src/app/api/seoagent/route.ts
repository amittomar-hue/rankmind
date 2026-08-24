import { NextRequest } from "next/server";
import { fetchHtml, parsePage } from "@/lib/page-parser";
import { callAI as libCallAI } from "@/lib/ai";
import { fetchSERP } from "@/lib/serp";

export const runtime = "nodejs";
export const maxDuration = 120;

// AI + SERP are centralized in lib/ai + lib/serp. Thin wrappers keep existing call sites working.
const callGroq = (prompt: string, maxTokens = 1200, json = true) => libCallAI(prompt, maxTokens, json);
const callAI = (prompt: string, maxTokens = 8000, jsonMode = false) => libCallAI(prompt, maxTokens, jsonMode);

// ── Pipeline steps ───────────────────────────────────────────────

interface GTMContext {
  keyword: string;
  audience: string;
  icp: string;
  valueProp: string;
  channels: string[];
  contentAngle: string;
}

async function analyzeGTMContext(docText: string, topic?: string, audience?: string, icp?: string, valueProp?: string, channels?: string[]): Promise<GTMContext> {
  const hasGTM = icp || valueProp || (channels && channels.length > 0);
  const gtmHint = hasGTM
    ? `\nGTM context provided: ICP="${icp||""}", Value prop="${valueProp||""}", Channels="${(channels||[]).join(", ")}"`
    : "";

  const raw = await callGroq(
    `SEO strategist. Extract the primary keyword, target audience, and recommended content angle from this document and GTM context.\nReturn ONLY valid JSON:\n{"keyword":"string (main keyword, max 8 words)","audience":"string (target reader, max 12 words)","contentAngle":"string (unique differentiating angle for the content, max 20 words)"}\n\nDOCUMENT:\n${docText.slice(0, 2000)}${gtmHint}`,
    400, true
  );
  try {
    const p = JSON.parse(raw);
    return {
      keyword: topic || p.keyword || "seo content",
      audience: audience || p.audience || "marketing professionals",
      icp: icp || "",
      valueProp: valueProp || "",
      channels: channels || ["organic search"],
      contentAngle: p.contentAngle || "comprehensive guide",
    };
  } catch {
    return { keyword: topic || "seo content", audience: audience || "marketing professionals", icp: icp || "", valueProp: valueProp || "", channels: channels || ["organic search"], contentAngle: "comprehensive guide" };
  }
}

interface KeywordCluster {
  intent: string;
  keywords: string[];
  pillar: string;
  cluster_topics: string[];
}

interface ContentBrief {
  primary_kw: string;
  secondary_kws: string[];
  nlp_terms: string[];
  target_word_count: number;
  key_topics: string[];
  content_gaps: string[];
  content_outline: { h2: string; h3s: string[] }[];
  keyword_clusters: KeywordCluster[];
  aeo_questions: { q: string; format: string; snippet_tip: string }[];
  eeat_signals: { signal: string; implementation: string }[];
}

async function buildContentBrief(
  gtm: GTMContext,
  competitors: { pos: number; url: string; title: string; snippet: string }[],
  scrapedPages: CompetitorPage[],
  contentType: string
): Promise<ContentBrief> {
  const competitorTitles = competitors.slice(0, 6).map(c => `#${c.pos}: ${c.title}`).join("\n");
  const scrapedH2s = scrapedPages.filter(p => p.scraped && p.h2s.length > 0)
    .map(p => `${p.domain}: ${p.h2s.slice(0, 5).join(" | ")}`).join("\n");
  const snippets = competitors.slice(0, 8).map(c => `[#${c.pos}] ${c.snippet}`).join("\n");

  const typeLabel = { blog: "blog post", casestudy: "case study", whitepaper: "whitepaper", ebook: "ebook" }[contentType] || "blog post";

  const raw = await callGroq(
    `SEO + AEO content strategist. Build a complete content brief for a ${typeLabel}.

KEYWORD: "${gtm.keyword}"
AUDIENCE: ${gtm.audience}
ICP: ${gtm.icp || "not specified"}
VALUE PROP: ${gtm.valueProp || "not specified"}
CONTENT ANGLE: ${gtm.contentAngle}
CHANNELS: ${gtm.channels.join(", ")}

TOP SERP COMPETITORS:
${competitorTitles}

COMPETITOR H2 SECTIONS:
${scrapedH2s || "none available"}

SERP SNIPPETS:
${snippets.slice(0, 2000)}

Return ONLY valid JSON:
{
  "primary_kw": "string",
  "secondary_kws": ["string"],
  "nlp_terms": ["20-25 key phrases that must appear in a top-ranking article"],
  "target_word_count": number,
  "key_topics": ["string"],
  "content_gaps": ["string (topics competitors don't cover)"],
  "content_outline": [{"h2":"string","h3s":["string"]}],
  "keyword_clusters": [
    {"intent":"informational|commercial|transactional","keywords":["string"],"pillar":"string","cluster_topics":["string"]}
  ],
  "aeo_questions": [
    {"q":"string (PAA-style question)","format":"paragraph|list|table|steps","snippet_tip":"string (how to answer for featured snippet)"}
  ],
  "eeat_signals": [
    {"signal":"Experience|Expertise|Authoritativeness|Trustworthiness","implementation":"string (specific action for this piece)"}
  ]
}`,
    1800, true
  );

  try {
    const p = JSON.parse(raw);
    return {
      primary_kw: p.primary_kw || gtm.keyword,
      secondary_kws: p.secondary_kws || [],
      nlp_terms: p.nlp_terms || [],
      target_word_count: p.target_word_count || 1500,
      key_topics: p.key_topics || [],
      content_gaps: p.content_gaps || [],
      content_outline: p.content_outline || [],
      keyword_clusters: p.keyword_clusters || [],
      aeo_questions: p.aeo_questions || [],
      eeat_signals: p.eeat_signals || [],
    };
  } catch {
    return { primary_kw: gtm.keyword, secondary_kws: [], nlp_terms: [], target_word_count: 1500, key_topics: [], content_gaps: [], content_outline: [], keyword_clusters: [], aeo_questions: [], eeat_signals: [] };
  }
}

interface CompetitorPage {
  url: string;
  domain: string;
  title: string;
  h1: string;
  h2s: string[];
  wordCount: number;
  snippet: string;
  scraped: boolean;
  ogImage?: string;
  ogImageAlt?: string;
}

function extractOgImage(html: string): { url: string; alt: string } {
  const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  const twitterMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
  const altMatch = html.match(/<meta[^>]+property=["']og:image:alt["'][^>]+content=["']([^"']+)["']/i);
  const url = ogMatch?.[1] || twitterMatch?.[1] || "";
  const alt = altMatch?.[1] || "";
  return { url: url.trim(), alt: alt.trim() };
}

async function scrapeCompetitors(
  competitors: { pos: number; url: string; domain: string; title: string; snippet: string }[],
  keyword: string
): Promise<CompetitorPage[]> {
  const top3 = competitors.slice(0, 3);
  const results = await Promise.allSettled(
    top3.map(async c => {
      const { html } = await fetchHtml(c.url);
      if (!html) return { url: c.url, domain: c.domain, title: c.title, h1: "", h2s: [], wordCount: 0, snippet: c.snippet, scraped: false, ogImage: "", ogImageAlt: "" };
      const parsed = parsePage(html, c.url, keyword);
      const og = extractOgImage(html);
      return {
        url: c.url,
        domain: c.domain,
        title: parsed.title || c.title,
        h1: parsed.h1,
        h2s: parsed.h2s,
        wordCount: parsed.wordCount,
        snippet: c.snippet,
        scraped: true,
        ogImage: og.url,
        ogImageAlt: og.alt,
      };
    })
  );
  return results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : { url: top3[i].url, domain: top3[i].domain, title: top3[i].title, h1: "", h2s: [], wordCount: 0, snippet: top3[i].snippet, scraped: false, ogImage: "", ogImageAlt: "" }
  );
}

async function writeArticle(
  gtm: GTMContext,
  contentType: string,
  docText: string,
  brief: ContentBrief
): Promise<string> {
  const typeLabel = { blog: "blog post", casestudy: "case study", whitepaper: "whitepaper", ebook: "ebook" }[contentType] || "blog post";
  const outline = brief.content_outline.map(s => `${s.h2}${s.h3s.length > 0 ? `: ${s.h3s.join(", ")}` : ""}`).join(" | ");
  const nlpTerms = brief.nlp_terms.slice(0, 20).join(", ");
  const aeoQ = brief.aeo_questions.slice(0, 4).map(q => `Q: ${q.q} → answer as ${q.format}`).join("\n");
  const eeatInstructions = brief.eeat_signals.map(e => `[${e.signal}] ${e.implementation}`).join("\n");

  const prompt = `You are an expert SEO + AEO content writer with deep E-E-A-T expertise. Write a complete, publication-ready ${typeLabel} in HTML format.

KEYWORD: ${brief.primary_kw}
SECONDARY KWS: ${brief.secondary_kws.slice(0, 6).join(", ")}
TARGET AUDIENCE: ${gtm.audience}
ICP: ${gtm.icp || "not specified"}
VALUE PROP: ${gtm.valueProp || "not specified"}
CONTENT ANGLE: ${gtm.contentAngle}
TARGET WORD COUNT: ~${brief.target_word_count} words
CHANNELS: ${gtm.channels.join(", ")}

DOCUMENT/BRIEF PROVIDED:
${docText.slice(0, 2500)}

OUTLINE TO FOLLOW:
${outline}

NLP TERMS TO INCLUDE (weave in naturally):
${nlpTerms}

KEY TOPICS TO COVER:
${brief.key_topics.join(", ")}

CONTENT GAPS TO EXPLOIT (cover these — competitors don't):
${brief.content_gaps.slice(0, 5).join(" | ")}

AEO: ANSWER THESE QUESTIONS CLEARLY IN THE ARTICLE (for featured snippets):
${aeoQ}

E-E-A-T SIGNALS TO INCLUDE:
${eeatInstructions}

INSTRUCTIONS:
1. Start directly with <h1> — no wrapper tags
2. One <h1> (compelling title with keyword), multiple <h2>/<h3> sections
3. Use <p>, <ul><li>, <ol><li>, <strong>, <blockquote> tags
4. Include primary keyword in first 100 words
5. For AEO: answer questions with a concise 40-60 word direct paragraph before expanding
6. For EEAT: add experience-based observations ("In our experience...", real-world examples, cite data)
7. Write at least ${brief.target_word_count} words
8. No markdown — only HTML`;

  return await callAI(prompt, 8000, false);
}

interface PostPublishStrategy {
  offpage: {
    backlink_targets: string[];
    pr_angles: string[];
    gbp_tips: string[];
    review_strategy: string[];
    link_building_tactics: string[];
  };
  ai_visibility: {
    llm_citation_tactics: string[];
    content_format_tips: string[];
    schema_recommendations: string[];
    ai_mention_monitoring: string[];
    aeo_optimizations: string[];
  };
  track_iterate: {
    kpi_targets: string[];
    refresh_triggers: string[];
    cluster_next_steps: string[];
  };
}

async function buildPostPublishStrategy(gtm: GTMContext, brief: ContentBrief, contentType: string): Promise<PostPublishStrategy> {
  const raw = await callGroq(
    `SEO strategist. Generate a post-publish strategy for this content.

KEYWORD: ${brief.primary_kw}
AUDIENCE: ${gtm.audience}
ICP: ${gtm.icp || "not specified"}
VALUE PROP: ${gtm.valueProp || "not specified"}
CHANNELS: ${gtm.channels.join(", ")}
CONTENT TYPE: ${contentType}
KEYWORD CLUSTERS: ${brief.keyword_clusters.map(c => c.pillar).join(", ")}

Return ONLY valid JSON:
{
  "offpage": {
    "backlink_targets": ["string (specific site types or publications to target)"],
    "pr_angles": ["string (newsworthy angles for outreach)"],
    "gbp_tips": ["string (Google Business Profile actions)"],
    "review_strategy": ["string"],
    "link_building_tactics": ["string"]
  },
  "ai_visibility": {
    "llm_citation_tactics": ["string (how to get cited by AI chatbots)"],
    "content_format_tips": ["string (format changes for AI answer engines)"],
    "schema_recommendations": ["string (specific schema types to add)"],
    "ai_mention_monitoring": ["string (tools/queries to monitor AI mentions)"],
    "aeo_optimizations": ["string (answer engine optimization actions)"]
  },
  "track_iterate": {
    "kpi_targets": ["string (specific metric targets)"],
    "refresh_triggers": ["string (when to refresh this content)"],
    "cluster_next_steps": ["string (next content pieces to create for topical authority)"]
  }
}`,
    1200, true
  );

  try {
    return JSON.parse(raw) as PostPublishStrategy;
  } catch {
    return {
      offpage: { backlink_targets: [], pr_angles: [], gbp_tips: [], review_strategy: [], link_building_tactics: [] },
      ai_visibility: { llm_citation_tactics: [], content_format_tips: [], schema_recommendations: [], ai_mention_monitoring: [], aeo_optimizations: [] },
      track_iterate: { kpi_targets: [], refresh_triggers: [], cluster_next_steps: [] },
    };
  }
}

// ── SSE streaming route ──────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { text, topic, audience, contentType = "blog", icp, valueProp, channels } = await req.json() as {
    text: string;
    topic?: string;
    audience?: string;
    contentType?: string;
    icp?: string;
    valueProp?: string;
    channels?: string[];
  };

  if (!text || text.trim().length < 20) {
    return new Response(JSON.stringify({ error: "No document text provided" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  function send(event: string, data: Record<string, unknown>) {
    const line = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    writer.write(encoder.encode(line)).catch(() => {});
  }

  (async () => {
    try {
      // Step 1: GTM strategy analysis
      send("progress", { step: "gtm", message: "Analyzing GTM strategy & topic…" });
      const gtm = await analyzeGTMContext(text, topic, audience, icp, valueProp, channels);
      send("progress", { step: "gtm_done", message: `Topic: "${gtm.keyword}" · Angle: "${gtm.contentAngle}"`, keyword: gtm.keyword, audience: gtm.audience, contentAngle: gtm.contentAngle });

      // Step 2: Parallel — SERP (competitor research) + keyword suggest
      send("progress", { step: "research", message: `Running 3-track research for "${gtm.keyword}"…` });
      let competitors: { pos: number; url: string; domain: string; title: string; snippet: string }[] = [];
      let serpSource = "none";
      try {
        const r = await fetchSERP(gtm.keyword);
        competitors = r.results; serpSource = r.source;
      } catch { competitors = []; }
      send("progress", { step: "competitors_done", message: `Found ${competitors.length} competitors`, count: competitors.length, competitors: competitors.slice(0, 10) });

      // Step 3: Scrape competitor pages (gap analysis)
      send("progress", { step: "scraping", message: "Scraping competitor pages for gap analysis…" });
      const competitorData = competitors.length > 0 ? await scrapeCompetitors(competitors, gtm.keyword) : [];
      const scrapedCount = competitorData.filter(c => c.scraped).length;
      send("progress", { step: "scraping_done", message: `Gap analysis complete — ${scrapedCount} pages analyzed`, count: scrapedCount, competitor_analysis: competitorData });

      // Step 4: Build content brief (SEO + AEO + keyword clusters + EEAT signals)
      send("progress", { step: "brief", message: "Building SEO + AEO content brief & keyword clusters…" });
      const brief = await buildContentBrief(gtm, competitors, competitorData, contentType);
      send("progress", {
        step: "brief_done",
        message: `Brief ready — ${brief.nlp_terms.length} NLP terms · ${brief.aeo_questions.length} AEO questions · ${brief.keyword_clusters.length} keyword clusters`,
        brief,
      });

      // Step 5: Write article with EEAT + AEO (long call) AND post-publish strategy in parallel
      send("progress", { step: "writing", message: `Writing ${contentType} with E-E-A-T signals (~${brief.target_word_count} words)…` });
      const [articleResult, strategyResult] = await Promise.allSettled([
        writeArticle(gtm, contentType, text, brief),
        buildPostPublishStrategy(gtm, brief, contentType),
      ]);

      const article = articleResult.status === "fulfilled" ? articleResult.value : "";
      const strategy = strategyResult.status === "fulfilled" ? strategyResult.value : null;

      send("progress", { step: "writing_done", message: "Article written with E-E-A-T + AEO signals!" });

      // Final result
      send("done", {
        keyword: gtm.keyword,
        audience: gtm.audience,
        contentAngle: gtm.contentAngle,
        icp: gtm.icp,
        valueProp: gtm.valueProp,
        channels: gtm.channels,
        source: serpSource,
        competitors: competitors.slice(0, 10),
        competitor_analysis: competitorData,
        brief,
        nlp_terms: brief.nlp_terms,
        key_topics: brief.key_topics,
        aeo_questions: brief.aeo_questions,
        keyword_clusters: brief.keyword_clusters,
        eeat_signals: brief.eeat_signals,
        content_gaps: brief.content_gaps,
        target_word_count: brief.target_word_count,
        article,
        offpage_strategy: strategy?.offpage || null,
        ai_visibility: strategy?.ai_visibility || null,
        track_iterate: strategy?.track_iterate || null,
      });
    } catch (e: unknown) {
      send("error", { message: e instanceof Error ? e.message : "Pipeline failed" });
    } finally {
      writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
