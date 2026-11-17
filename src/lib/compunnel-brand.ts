// Compunnel brand system — transcribed from the Compunnel Brand Guidelines 2025 brand book.
// Single source of truth for two separate concerns:
//   1. DESIGN TOKENS (COMPUNNEL_TOKENS) — colours and typefaces applied to generated
//      articles, published WordPress bodies, interactive widgets and analytics reports.
//   2. WRITER KB (COMPUNNEL_BRAND) — voice, positioning and verified company facts injected
//      into the content writer, in the same way EXIMIUS_KB is.
// Keeping both here means a brand-book revision is a one-file change.

export function isCompunnelProject(ctx: string): boolean {
  return /compunnel/i.test(ctx || "");
}

export const COMPUNNEL_TOKENS = {
  // ── Primary (brand book p.17) ──
  blue: "#0050EF",          // Compunnel Blue — PANTONE 2728 C
  graphite: "#292929",      // Graphite Gray — PANTONE BLACK 7 C
  // ── Monochromatic blue (p.18) ──
  blueDark: "#0038AA",
  blueDeep: "#00287D",
  blueTint: "#E6F2FF",      // lightest tint — surfaces
  blueTint2: "#CCE6FF",
  // ── Neutrals (p.19) ──
  ink: "#292929",
  slate: "#404649",
  muted: "#74767C",
  rule: "#DFE3E5",
  surface: "#F5F5F5",
  white: "#FFFFFF",
  // ── Secondary / line-of-business (p.19-20) ──
  talent: "#05D9E8",
  digital: "#08B76C",
  cyber: "#EA1C35",
  amber: "#FFAB00",
  violet: "#6646D8",
  // ── Typography (p.26-28). Lato is the primary web typeface; Arial for email. ──
  sans: "Lato,'Helvetica Neue',Helvetica,Arial,sans-serif",
  sansAlt: "Inter,Lato,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif",
  email: "Arial,Helvetica,sans-serif",
  googleFonts: "https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,300;0,400;0,700;0,900;1,400&display=swap",
} as const;

export const COMPUNNEL_BRAND = `COMPUNNEL BRAND KNOWLEDGE BASE (MANDATORY — source of truth for voice, positioning and company facts. Where it conflicts with any other instruction, this KB wins on facts, claims and tone):

WHO COMPUNNEL IS: Compunnel, Inc. is an enterprise services firm operating across three lines of business: Talent (workforce and staffing solutions), Digital (digital transformation, cloud, data, AI/ML), and Cybersecurity. Positioning: an AI-native orchestrator of enterprise outcomes, not a staffing vendor and not a generic IT services company.

POSITIONING (use this framing, do not invent a different one):
- Compunnel moves "beyond execution into orchestration" — intelligence drives outcomes, speed is engineered by design, and trust is embedded at the core.
- Brand promise: embedding AI, compliance, and velocity into the fabric of execution; engineering foresight and orchestrating precision so clients lead change rather than react to it.
- Mission: orchestrate intelligent, AI-native outcomes that accelerate enterprise transformation across workforce, digital, and cybersecurity.
- Vision: become the most trusted AI-native orchestration platform for regulated, high-performance industries.

TONE OF VOICE (brand book p.08) — confident, intelligent, and purpose-driven:
- Lead with clarity and conviction. Write with the authority of a leader and the foresight of a visionary.
- Concise yet powerful. Simplify complexity WITHOUT diluting meaning. Never pad.
- Blend precision with empathy. Enterprise-grade authority, never stiff or bureaucratic.
- "We don't just inform, we influence." Every passage should move the reader toward a decision.
- Brand personality: Visionary, Confident, Transformative. Archetype: Hero (turn pressure into performance) crossed with Magician (align minds, tech and timing to spark transformation).

WRITING RULES:
- Take a clear point of view. Do not hedge into vendor-neutral mush.
- Favour orchestration/intelligence/velocity/precision/trust framing over generic "solutions" and "synergy" language.
- Do NOT claim Compunnel follows market trends — the brand explicitly sets the pace rather than following.
- Never fabricate client names, contract values, headcounts, certifications or case-study metrics.

VERIFIED COMPANY FACTS (safe to state; anything beyond these must not be invented):
- Headquarters: 4390 Route 1 North, Suite 302, Princeton, NJ 08540. Phone: +1 (609) 606-9010. Email: contactus@compunnel.com. Website: www.compunnel.com.
- Global service coverage: USA, Canada, India.
- Impact to date: operations excellence improved for over 2.5 million users; 1000+ modernized applications delivered.
- Industry partnerships: Microsoft Gold Partner, Automation Anywhere, UiPath, AWS Partner Network (Technology Partner), Adobe Bronze Solution Partner.
- Quality badges: ISO certified (as shown in the brand book).

BRAND COLOURS (reference only — never describe hex codes in article copy): Compunnel Blue #0050EF, Graphite Gray #292929. Line of business: Talent #05D9E8, Digital #08B76C, Cybersecurity #EA1C35.`;
