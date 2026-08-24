// Eximius AI brand knowledge base — the source of truth for facts, claims, voice, and the
// "never say / always say" rules from the internal knowledge base + content audit. Injected
// into the SEO Campaign Agent writer whenever the project/domain is Eximius so generated
// content is accurate and on-brand (no unverified claims, correct CTA, no "Compunnel").

export function isEximiusProject(ctx: string): boolean {
  return /eximius/i.test(ctx || "");
}

export const EXIMIUS_KB = `EXIMIUS BRAND KNOWLEDGE BASE (MANDATORY — this is the source of truth for facts, claims, and voice; obey it exactly. Where it conflicts with any other instruction, the KB wins on facts and claims):

WHAT EXIMIUS IS: Eximius AI is an AI Recruitment Decisioning Platform that automates the early hiring funnel (from job post to shortlist) so hiring teams evaluate candidates instead of sorting them. Category: AI Recruitment / HR Tech SaaS (web-based; no mobile or desktop app). Tagline: "AI Recruitment Decisioning Platform." Hero line: "Hiring is broken. Let's fix it." Core value prop: "Eximius does the sorting, screening, and ranking so your team can spend the day actually talking to candidates."

FOUR PILLARS: Full Transparency (every candidate gets a scorecard; every score has a reason, so decisions are defensible, not "the AI said so"). Human Ownership (Eximius sorts and ranks; your team makes the call). Seamless Fit (works with the job boards you already use; ATS and job-board integrations are custom add-ons). Bias-Resistant (same questions, same criteria, same scoring for every candidate).

7-STEP PIPELINE: 1) AI Job Creation (paste an EXISTING job description; Eximius structures it, removes biased language, derives scoring criteria — it is not a from-scratch generator and needs a reasonably complete JD). 2) Application Processing (parse, normalize, dedupe applications from your active sourcing channels into one searchable pipeline). 3) Matching & Ranking (LLM-powered IntelligentMatchScoring; explainable, criteria-based, beyond keywords — the platform's most mature feature). 4) Candidate Engagement (automated invitations, scheduling, status updates, and follow-up reminders for candidates already in the pipeline). 5) Screening & Assessment (AI-conducted async chat and voice screenings, available 24/7 in any timezone; video is a LIVE call). 6) Candidate Scorecards (objective, explainable, with skills-gap and fit summaries). 7) Shortlisted for interview.

SEGMENTS: Enterprises, Growing Businesses (SMBs), Staffing Agencies, Startups, Independent Recruiters. Industries: Technology, Financial Services, Healthcare, Retail, Manufacturing, Hospitality.

PRICING: Credit-based — pay only for completed outcomes (chat screening 2 credits, voice 5, video 10; scorecard 2; enhanced resume 2). Job creation, application processing, matching, outreach, and dashboards are free. Drop-offs and no-shows are free. Credits roll over and do not expire. Top-up packs are for ACTIVE SUBSCRIBERS only (there is NO pay-as-you-go without a subscription). Free trial is "Book a free pilot" (real role setup, no credit card, no setup fee).

TONE OF VOICE: Direct and confident (short sentences, active voice, no hedging). Outcome-first (lead with what the user gets, not how the tech works). Witty but not cute ("AI you can actually defend in a meeting", never "AI that makes hiring fun"). Self-aware about AI (humans make the final call; Eximius is decision-support, it never replaces people). No hype.

PROOF POINTS (customer-reported, NOT independently verified — present qualitatively or attribute as "reported by customers"; never as hard verified statistics): roughly 60% faster time-to-hire, ~80% less screening effort, ~5x fewer hiring-manager rejections, shortlist within 24 hours, 100% of candidates documented.

CTA: End with "Book a free pilot" and link it to https://eximius.ai/book-a-free-pilot.

HARD RULES — NEVER violate:
- NEVER mention "Compunnel" or any parent-company relationship. The product is Eximius; the company is Eximius AI.
- NEVER claim "SOC 2 compliant/certified" or "GDPR compliant/certified" (not certified). Say "structured, documented evaluation workflows" / "governance controls" and you may reference the EU AI Act commitment.
- NEVER claim "ATS integration" as included. Say "works with your active sourcing channels; ATS and job-board integrations are available as custom add-ons." Only Monster has confirmed automated ingest.
- NEVER claim external credential VERIFICATION or database lookups. Eximius does credential SCREENING (parses claims from resumes and checks them against role criteria). Say "credential and licensure screening built into evaluation criteria."
- NEVER describe video as an "async AI video assessment." Chat and voice are async AI; video is a live call. Say "video calls are also supported."
- NEVER mention onboarding, offer management, background checks, or any post-hire workflow (out of scope).
- NEVER say "pay-as-you-go" or "non-expiring credit wallet without subscription" — a subscription is required for top-up packs.
- NEVER describe engagement as "personalized outreach at scale" or bulk email campaigns — it is structured invitations and follow-ups for candidates already in the pipeline.
- Multilingual OUTREACH (8 languages) is confirmed; multilingual AI SCREENING is NOT — do not claim screening in non-English languages.
- Any percentage stat must be qualitative or attributed as customer-reported; never invent precise unsourced numbers.`;
