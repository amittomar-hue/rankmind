import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const seed = req.nextUrl.searchParams.get("seed");
  if (!seed) return NextResponse.json({ error: "No seed" }, { status: 400 });

  try {
    // Fire Google Suggest and Bing Suggest in parallel
    const [googleResult, bingResult] = await Promise.allSettled([
      fetch(
        `https://suggestqueries.google.com/complete/search?client=firefox&hl=en&q=${encodeURIComponent(seed)}`,
        {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/120" },
          signal: AbortSignal.timeout(5000),
        }
      ).then(r => { if (!r.ok) throw new Error("google suggest failed"); return r.json(); }),

      fetch(
        `https://api.bing.com/qsonhs.aspx?type=cb&q=${encodeURIComponent(seed)}`,
        { signal: AbortSignal.timeout(4000) }
      ).then(r => { if (!r.ok) throw new Error("bing suggest failed"); return r.text(); }),
    ]);

    const suggestions: string[] =
      googleResult.status === "fulfilled" && Array.isArray(googleResult.value?.[1])
        ? googleResult.value[1].slice(0, 20)
        : [];

    let bingSuggestions: string[] = [];
    if (bingResult.status === "fulfilled") {
      try {
        const match = bingResult.value.match(/\{[\s\S]*\}/);
        if (match) {
          const bingData = JSON.parse(match[0]);
          bingSuggestions = (bingData?.AS?.Results?.[0]?.Suggests || [])
            .map((s: { Txt: string }) => s.Txt)
            .slice(0, 10);
        }
      } catch { /* ignore */ }
    }

    const all = [...new Set([...suggestions, ...bingSuggestions])].filter(s => s !== seed);
    return NextResponse.json({ scraped: all.length > 0, suggestions: all });
  } catch {
    return NextResponse.json({ scraped: false, suggestions: [] });
  }
}
