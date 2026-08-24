# SEO Platform — Complete Build Document
**Version 2.0 | June 2026**

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Feature Set (26 Tools)](#2-feature-set)
3. [Technical Architecture](#3-technical-architecture)
4. [Database & Auth](#4-database--auth)
5. [AI Provider Strategy](#5-ai-provider-strategy)
6. [API Routes — Full Spec](#6-api-routes)
7. [Tool Implementation Guide](#7-tool-implementation-guide)
8. [Data Sources & Free APIs](#8-data-sources--free-apis)
9. [UI Design System](#9-ui-design-system)
10. [Real vs Estimated Data Strategy](#10-real-vs-estimated-data-strategy)
11. [Deployment](#11-deployment)
12. [Environment Variables](#12-environment-variables)
13. [Known Limits & Workarounds](#13-known-limits--workarounds)

---

## 1. Product Overview

### What It Is
A full-stack SEO/AEO/GEO platform that gives users real crawl data, AI-generated analysis, and actionable recommendations across 26 tools — covering technical SEO, content, backlinks, rank tracking, AI visibility (GEO), schema markup, competitor analysis, and more.

### Core Philosophy
- **Real data first**: Call actual APIs and crawl real pages. Only use AI to interpret/score, never to invent numbers.
- **No paid APIs required**: Use free tiers (Groq, Freepik, Open Link Profiler, Wayback, Tranco, Pexels, Pollinations) with paid APIs as optional upgrades.
- **Single-page app**: All UI in one React component file (`RankMind.tsx`) with inline styles — no CSS framework dependency.
- **Vercel-native**: Next.js App Router + Python serverless functions for scraping.

### Target Stack
| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript (UI + API routes), Python (scraping) |
| AI Primary | Anthropic Claude claude-sonnet-4-6 |
| AI Fallback | Groq Llama 3.3 70B (free, 100K tokens/day) |
| Cache/DB | Upstash Redis (free tier: 10K requests/day) |
| Auth | Custom JWT (7-day sessions, bcrypt passwords) |
| Hosting | Vercel (free tier sufficient for launch) |
| Image Gen | Freepik → ModelsLab → Pollinations (free cascade) |

---

## 2. Feature Set

### Navigation Structure (6 Sections)

```
OVERVIEW
  ├── Dashboard          — GSC + GA4 combined analytics
  ├── My Sites           — Project folders + competitor monitoring
  ├── Project Overview   — Per-site overview (real crawl metrics)
  └── History            — All tool runs grouped by date

KEYWORD RESEARCH
  ├── Keyword Research   — Clusters, questions, related terms
  └── Sitemap Generator  — AI-powered XML sitemap

CONTENT
  ├── Content Writer     — AI blog/landing page writer
  ├── SEO Writer         — Content analysis & optimization
  ├── Topic Clusters     — Topical authority mapping
  └── Schema Markup      — 17 schema types generator

LINK BUILDING
  ├── Link Building      — Prospect finder & outreach copy
  └── Link Intersect     — Shared backlink gap analysis

COMPETITORS
  ├── Market Explorer    — Market share & competitive landscape
  └── Ad Research        — Competitor PPC & ad copy analysis

MORE
  ├── Local SEO          — GBP optimization, local citations
  ├── SEO Audit Report   — 6-pillar executive dashboard
  └── Brand Monitor      — Mention tracking & sentiment

ANALYTICS (sidebar data sources)
  ├── Google Search Console  — Real clicks, impressions, CTR
  └── Google Analytics 4     — Real sessions, users, conversions

TECHNICAL TOOLS
  ├── Site Crawl (Technical SEO)  — 12-page crawl, metadata check
  ├── On-Page SEO                 — Single URL analysis
  ├── Broken Links                — HEAD-check 35 URLs
  ├── SERP Analyzer               — Live top-10 results
  ├── AI Visibility (AEO)         — Sitemap + AI scoring
  ├── Backlink Profile            — DR, referring domains, anchors
  ├── Rank Tracker                — Multi-keyword position tracking
  ├── Content Audit               — Thin/duplicate content
  ├── Internal Links              — Orphan pages & opportunities
  └── Traffic Analytics           — Multi-domain traffic estimate
```

---

## 3. Technical Architecture

### Directory Structure
```
rankmind/
├── src/
│   ├── app/
│   │   ├── page.tsx              ← mounts <RankMind /> component
│   │   ├── layout.tsx
│   │   └── api/
│   │       ├── ai/route.ts       ← Claude + Groq proxy, quota, cache
│   │       ├── gsc/route.ts      ← Google Search Console
│   │       ├── gsc/sites/route.ts
│   │       ├── ga4/route.ts      ← Google Analytics 4
│   │       ├── auth/
│   │       │   ├── signin/route.ts
│   │       │   ├── signup/route.ts
│   │       │   ├── me/route.ts
│   │       │   ├── signout/route.ts
│   │       │   ├── forgot/route.ts
│   │       │   └── reset/route.ts
│   │       ├── scrape/route.ts   ← robots.txt + sitemap crawler
│   │       ├── robotstxt/route.ts
│   │       ├── onpage/route.ts   ← single-page SEO parser
│   │       ├── techaudit/route.ts← multi-page crawl
│   │       ├── checklinks/route.ts← broken link checker
│   │       ├── serpcheck/route.ts← DuckDuckGo/Bing scrape
│   │       ├── kwsuggest/route.ts← Google + Bing suggest
│   │       ├── kwresearch/route.ts← algorithmic keyword intel
│   │       ├── brandmention/route.ts← RSS news + Reddit
│   │       ├── imagegen/route.ts ← Freepik → ModelsLab → Pollinations
│   │       ├── dataforseo/route.ts
│   │       ├── parsedocx/route.ts
│   │       ├── seoagent/route.ts
│   │       └── admin/route.ts
│   ├── components/
│   │   └── RankMind.tsx          ← ALL UI (7500+ lines, single file)
│   └── lib/
│       ├── db.ts                 ← Upstash Redis abstraction
│       ├── auth.ts               ← JWT sessions + bcrypt
│       ├── activity.ts           ← event logging
│       └── page-parser.ts        ← HTML parsing utilities
├── api/
│   └── py/                       ← Python serverless functions
│       ├── backlinks.py          ← OLP + Wayback + Tranco + OPR
│       ├── techaudit.py
│       ├── onpage.py
│       ├── checklinks.py
│       ├── scrape.py
│       ├── serpcheck.py
│       ├── adresearch.py
│       └── trafficana.py
├── vercel.json
├── requirements.txt              ← Python deps (requests, bs4, lxml)
└── .env.local
```

### Request Flow
```
Browser → Next.js page → RankMind.tsx component
                              │
                    User runs a tool
                              │
              ┌───────────────┴───────────────┐
              │                               │
    /api/* (TypeScript)           /api/py/* (Python)
    - AI calls                    - Web scraping
    - GSC/GA4 OAuth               - HTML parsing
    - Auth / session              - External API calls
    - Redis cache                 - Backlink data
              │                               │
         Upstash Redis              External services
         (cache + sessions)         (Google, Wayback,
                                     Tranco, OLP, etc.)
```

### Component Architecture (`RankMind.tsx`)
```typescript
// Design tokens
const S = { text, muted, accent, accentBg, accentText, green, greenBg, 
            greenText, amber, amberBg, amberText, red, redBg, redText,
            blue, blueBg, blueText, card, border, subtle, sidebar,
            shadow, shadowMd }

// Shared UI primitives
pill()       // colored badge chip
Field        // label + children wrapper  
TI           // text input (rows= for textarea)
Btn          // button (variant="secondary", small, disabled)
Card         // white card box
SH           // section heading with optional action
Bar          // horizontal percentage bar
Divider      // <hr>
TH / TD      // styled table cells
Metric       // stat tile (label + value + color + trend)
CopyBtn      // clipboard copy
Toggle       // radio group
Tabs         // tab bar
ScoreRing    // SVG circular progress ring
LoadingBar   // animated loading dots with phase text
IssueRow     // issue row (severity, category, detail, fix)
CheckItem    // pass/fail check row

// SVG chart components (no Chart.js — pure SVG)
SvgRadar     // hexagonal radar chart
SvgGroupedBar// grouped bar chart
SvgHBar      // horizontal bar chart
SvgDonut     // donut/pie chart
SvgLine      // line chart with fill

// AI helpers
ai(prompt, maxTokens?)    // → JSON object
aiText(prompt)            // → string
withNonce(prompt)         // appends random token to bust cache

// Tool history
useToolHistory(toolId)    // localStorage, 20 entries max

// Multi-site state pattern
gscDataMap   // Record<domain, gscData>  ← localStorage
ga4DataMap   // Record<propId, ga4Data>  ← localStorage
upsertGsc()  // write to both state + localStorage
upsertGa4()  // write to both state + localStorage

// Page registry
const PAGES = {
  dashboard, gsc, ga4, keywords, content, backlinks, technical,
  sitemap, competitors, rank, aeo, seowriter, topics, onpage,
  serp, audit, intlinks, brokenlinks, schemagen, localseo,
  linkbuilding, linkinter, brandmon, market, adresearch,
  trafficana, execaudit, "project-overview", projects, history, admin
}
```

---

## 4. Database & Auth

### Upstash Redis Key Schema
```
user:{id}                    → DbUser object (JSON)
email_to_id:{email}          → userId string
users:all                    → Set of all userIds
reset:{token}                → { userId, expiresAt }  (TTL 15min)
activity:all                 → List of ActivityEvent (cap 10K)
activity:user:{userId}       → List per-user (cap 500)
quota:{userId}:{YYYY-MM-DD}  → daily AI call count (TTL 24h)
ai_cache:{sha256-32}         → cached AI response (TTL 1h)
gsc_tokens:{domain}          → OAuth token object
```

### DbUser Type
```typescript
type DbUser = {
  id: string;               // nanoid
  email: string;
  name: string;
  passwordHash: string;     // bcrypt, 12 rounds
  createdAt: string;        // ISO date
  lastActiveAt: string;
  queryCount: number;       // lifetime AI calls
  plan: "free" | "pro";
}
```

### Auth Flow
```
POST /api/auth/signup
  → validate email + password
  → hash password (bcrypt 12)
  → dbCreateUser()
  → createSession() → JWT (7-day, RS256)
  → set rm_session cookie (httpOnly, sameSite=lax)
  → return { user }

POST /api/auth/signin
  → dbGetUserByEmail()
  → bcrypt.compare()
  → createSession() → JWT
  → set rm_session cookie
  → return { user }

GET /api/auth/me
  → verifySession(cookie)
  → return { user }

POST /api/auth/signout
  → clear rm_session cookie

POST /api/auth/forgot
  → generate 6-char alphanumeric token
  → dbSetResetToken(token, userId, TTL=900s)
  → return { token } ← no email; token shown directly
  
POST /api/auth/reset
  → dbGetResetToken(token)
  → check TTL
  → hashPassword(newPassword)
  → dbUpdatePassword(userId, hash)
  → dbDeleteResetToken(token)
```

### Google OAuth (GSC + GA4)
```
GET /api/auth
  → build Google OAuth URL with scopes:
    - https://www.googleapis.com/auth/webmasters.readonly
    - https://www.googleapis.com/auth/analytics.readonly
    - https://www.googleapis.com/auth/userinfo.email
  → redirect to Google

GET /api/auth/callback?code=
  → exchange code for tokens
  → store in gsc_tokens:{domain} Redis key
  → also set in cookie: gsc_tokens (JSON of all domains)
  → redirect to /?connected=true

GET /api/gsc?site=&days=
  → read token from cookie
  → call Google Search Console API
  → auto-refresh expired tokens
  → return { summary, queries, pages, daily }

GET /api/ga4?property=
  → GA4 Data API (numeric property ID only)
  → return { summary, sources, pages, daily }
```

---

## 5. AI Provider Strategy

### Provider Chain
```
Request arrives at /api/ai
    │
    ├── ANTHROPIC_API_KEY set?
    │     Yes → callClaude() [claude-sonnet-4-6, 8192 max tokens]
    │              ↓ fails (quota/error)?
    │              callGroq() [llama-3.3-70b-versatile]
    │     No  → callGroq() directly
    │
    └── Both fail? → detect rate-limit pattern → return 429 friendly msg
```

### Prompt Caching
```typescript
// Cache key = SHA256 of prompt (with nonce stripped)
function cacheKey(prompt: string): string {
  const clean = stripNonce(prompt);
  return "ai_cache:" + sha256(clean).slice(0, 32);
}

// Cache read before AI call
// Cache write after successful response (TTL 1hr)
// Format=text: cache raw string
// Format=json: cache extracted JSON object
```

### Per-User Daily Quota
```typescript
const DAILY_QUOTA = 50; // AI calls per user per day
// Key: quota:{userId}:{YYYY-MM-DD}  TTL: 86400s
// Unauthenticated requests: no quota check (guest access)
```

### Prompt Length Cap
```typescript
const MAX_PROMPT_CHARS = 24000; // ~6K tokens
// Trim strategy: keep head 60% + tail 40%
// Prevents single scan from exhausting Groq 100K/day limit
```

### JSON Response Parsing
```typescript
// Groq json_object mode returns pure JSON
// Claude returns JSON wrapped in markdown text
// Parser tries JSON.parse() first, then regex /\{[\s\S]*\}/
```

---

## 6. API Routes

### `/api/ai` — AI Proxy
```typescript
POST { prompt: string, format: "json"|"text", maxTokens?: number }
→ { result: object|string, cached?: true }
→ 429 { error: "Daily limit reached..." }  // quota or rate limit
→ 500 { error: string }
```

### `/api/techaudit` — Site Crawler
```typescript
GET ?domain=example.com
→ {
    scraped: boolean,
    summary: {
      total: number, ok: number, redirects: number, errors: number,
      missing_title: number, short_title: number, long_title: number,
      missing_meta: number, missing_h1: number, multiple_h1: number,
      imgs_no_alt: number, noindex_pages: number,
      no_canonical: number, thin_content: number
    },
    pages: [{
      url, status, title, title_length, meta_desc, meta_length,
      h1, h1Count, h2s[], wordCount, imgCount, imgNoAlt,
      hasCanonical, canonical, isNoindex, schemaTypes[], links[]
    }],
    urls_checked: number
  }

Implementation:
1. Fetch robots.txt → parse Disallow rules
2. Fetch sitemap.xml (handles sitemap indexes)
3. Crawl up to 12 pages with HEAD + GET
4. Parse each page HTML for all metadata
5. Build summary stats
```

### `/api/checklinks` — Broken Link Checker
```typescript
GET ?domain=example.com
→ {
    scraped: boolean,
    summary: { total, ok, redirected, broken, server_error },
    results: [{ url, status, redirectTo? }],
    broken: [{ url, status }],
    redirected: [{ url, status, redirectTo }]
  }

Implementation:
1. Get URLs from sitemap (up to 35)
2. HEAD request each URL (timeout 8s)
3. Follow redirects, record final status
4. Classify: 2xx=ok, 3xx=redirect, 4xx/5xx=broken
```

### `/api/onpage` — On-Page SEO Parser
```typescript
GET ?url=https://example.com/page&keyword=target+kw
→ {
    url, title, title_length, meta_desc, meta_length,
    h1, h1_count, h2s[], h3s[], word_count, reading_time,
    images: { total, missing_alt, with_alt },
    links: { internal, external, total },
    schema_types[], canonical, is_noindex,
    keyword_in_title, keyword_in_meta, keyword_in_h1,
    keyword_density, keyword_count,
    page_size_kb, load_hints[],
    _scraped: boolean
  }
```

### `/api/serpcheck` — SERP Scraper
```typescript
GET ?keyword=seo+tool&location=US
→ {
    keyword, location,
    results: [{
      position, title, url, domain,
      is_featured_snippet, has_schema, description
    }],
    total_results: number,
    _scraped: boolean,
    source: "duckduckgo"|"bing"|"ai-estimated"
  }

Implementation:
1. Try DuckDuckGo HTML scrape (no API key needed)
2. Fallback: Bing HTML scrape
3. Fallback: AI-estimated results (labeled clearly)
```

### `/api/kwsuggest` — Keyword Suggestions
```typescript
GET ?seed=keyword&industry=SaaS
→ {
    suggestions: string[],  // 20 items
    source: "google+bing"|"google"|"bing"|"ai"
  }

Implementation:
1. Fetch Google Suggest API (autocomplete endpoint)
2. Fetch Bing Suggest API in parallel
3. Deduplicate + merge (20 total)
```

### `/api/kwresearch` — Keyword Intelligence
```typescript
GET ?seed=keyword&industry=tech
→ {
    clusters: [{ label, keywords: string[] }],
    questions: string[],
    related: string[],
    intent: "informational"|"commercial"|"transactional"|"navigational",
    difficulty_estimate: number,
    opportunity_score: number
  }

Implementation: Pure algorithmic (no external API)
- Expand seed with common modifiers (best, how to, vs, review...)
- Cluster by intent signals
- Score by word count, commercial modifiers
```

### `/api/scrape` — Sitemap Crawler
```typescript
GET ?domain=example.com
→ {
    urls: string[],     // up to 60 URLs
    found: boolean,
    source: "sitemap"|"robots.txt->sitemap"|"crawl",
    sitemap_url: string
  }

Implementation:
1. Fetch /robots.txt → find Sitemap: directive
2. Fetch sitemap.xml → parse <loc> tags
3. Handle sitemap indexes (nested sitemaps)
4. Fallback: crawl homepage links
```

### `/api/robotstxt` — Robots.txt Fetcher
```typescript
GET ?domain=example.com
→ {
    found: boolean,
    content: string,    // raw text
    url: string,
    directives: { userAgent, disallow, allow, sitemap }[]
  }
```

### `/api/brandmention` — Brand Monitoring
```typescript
GET ?brand=BrandName&competitors=comp1,comp2
→ {
    summary: {
      total_mentions, sentiment_positive, sentiment_neutral,
      sentiment_negative, reach, share_of_voice
    },
    sources: [{ source, mentions, sentiment }],
    recent_mentions: [{
      title, url, source, date, sentiment, snippet
    }],
    competitors: [{ name, mentions }],
    alerts: string[],
    opportunities: string[]
  }

Implementation:
1. Google News RSS: news.google.com/rss/search?q=BrandName
2. Yahoo News RSS
3. Reddit RSS: reddit.com/search.json?q=BrandName
4. Rule-based sentiment (positive/negative keyword lists)
```

### `/api/imagegen` — Image Generation
```typescript
POST { prompt: string, negative_prompt?: string, seed?: number }
→ { url: string (base64 data URL), provider: string }

Provider cascade:
1. Freepik text-to-image API (async polling, up to 60s)
2. ModelsLab realtime (100 free/day)
3. Pollinations.ai (unlimited free, flux model)

All results proxied as base64 to avoid browser CORS issues.
```

### `/api/py/backlinks` — Backlink Data
```python
GET ?domain=example.com
→ {
    domain: str,
    overview: { dr, total_links, referring_domains, dofollow,
                nofollow, edu, gov, links_change, domains_change },
    link_types: { editorial, guest, resource, directory, forum },
    dr_distribution: [{ range, count }],
    anchors: [{ type, pct, count }],
    velocity: [{ month, links }],
    top_links: [{ domain, dr, anchor, type, traffic }],
    opportunities: [{ domain, dr, type, note }],
    meta: { data_quality, tranco_rank, site_age_years, 
            archived_pages, openpagerank }
  }

Data sources (in order of priority):
1. Open Link Profiler (public scrape, no key)
2. Tranco rank list API (free)
3. Wayback Machine CDX API (free)
4. OpenPageRank API (free)
5. Heuristic DR formula when above unavailable
```

### `/api/admin` — Admin Panel
```typescript
GET  /api/admin  (Bearer: ADMIN_SECRET)
  → { users: DbUser[], activity: ActivityEvent[], stats: {...} }

DELETE /api/admin?userId=xxx
  → deletes user + all their data
```

---

## 7. Tool Implementation Guide

### Dashboard
```
Data sources:
- GSC: gscDataMap[activeDomain] (real OAuth data)
- GA4: ga4DataMap[activeProp] (real OAuth data)
- Both show "Connect" banner when not linked

Key sections:
1. GSC summary bar (clicks, impressions, CTR, position + 28-day trend)
2. GA4 summary bar (sessions, users, bounce, conversions)
3. Quick access grid (links to all tools, pre-loaded with active site)
4. AEO score card (runs AI Visibility on demand)
5. Multi-site selector (pills for each connected domain)

State pattern:
- gscDataMap: Record<domain, gscData> in localStorage
- ga4DataMap: Record<propId, ga4Data> in localStorage
- Derived: gscData = gscDataMap[activeDomain]
```

### Technical SEO (Site Crawl)
```
API: GET /api/techaudit?domain=

Real data shown:
- Summary: total pages, ok, redirects, errors
- Per-page table: URL, status, title, H1, word count, schema types
- Issues: missing titles, metas, H1s, noindex pages, thin content

AI overlay:
- Scoring (0-100) for each issue category
- Priority-ordered fix list
- Architecture recommendations

_scraped flag: green "✓ Real crawl" vs amber "⚠ Estimated data" banner
```

### On-Page SEO
```
API: GET /api/onpage?url=&keyword=

Real data shown:
- Title tag (length, keyword presence)
- Meta description (length, keyword presence)  
- H1, H2s, H3s
- Word count, reading time
- Image count + missing alt text
- Internal / external link count
- Schema types detected
- Canonical URL, noindex flag

AI overlay:
- Keyword gap analysis
- Content structure recommendations
- NLP term suggestions

_scraped: true when page was successfully fetched
```

### SERP Analyzer
```
APIs: GET /api/serpcheck?keyword=&location=
      GET /api/gsc?keyword= (for your position)

Real data shown:
- Top 10 organic results (DuckDuckGo/Bing scrape)
- Your position in SERP (from GSC if connected)
- Featured snippet indicator
- Schema markup detection per result

AI overlay:
- Content gap analysis vs top 3 results
- Featured snippet opportunity assessment
- SERP feature recommendations
```

### Broken Links
```
API: GET /api/checklinks?domain=

Real data shown (all real, no AI):
- Table of all URLs: status code, redirect destination
- Broken links highlighted in red
- Redirect chains
- Summary stats

No AI needed — purely mechanical HEAD checks.
```

### AI Visibility (AEO)
```
API: GET /api/scrape?domain=
     POST /api/ai (analysis)

Flow:
1. Scrape sitemap → get up to 60 real URLs
2. Pass URLs + robots.txt to AI
3. AI scores: featured snippet rate, PAA, FAQ pages,
   HowTo schema, answer blocks, schema coverage
4. AI scores GEO: ChatGPT, Perplexity, Gemini, Copilot, Claude citation %

Real data:
- Actual page URLs from sitemap (labeled "Real pages, AI-modelled visibility")
- robots.txt bot access (real, parsed)

AI-estimated:
- Citation percentages (no live LLM telemetry available for free)
```

### Backlink Profile
```
API: POST /api/py/backlinks

Real data (when available):
- Total backlinks, referring domains (Open Link Profiler)
- Domain rating (heuristic from Tranco + Wayback)
- Top linking domains (Wayback CDX)
- OpenPageRank score

Estimated (from signals when OLP unavailable):
- DR distribution chart
- Anchor type breakdown
- Link velocity trend

Data quality badge: "● Live data — Open Link Profiler" OR "● Signal-based estimate"
```

### SEO Audit Report (Executive Dashboard)
```
APIs called in parallel:
1. /api/techaudit — real crawl data
2. /api/robotstxt — real bot access rules
3. /api/checklinks — real broken links
4. /api/py/backlinks — real DR + backlink signals
5. /api/ai — scoring + recommendations

6 scoring pillars:
- Technical: crawlability, indexability, CWV (est), mobile (est), HTTPS, architecture
- On-Page: titles, meta, headers, keyword alignment, internal linking, image opt
- Authority: domain rating, backlinks, referring domains, high-auth %, toxic %, growth
- AEO: featured snippet rate, PAA, FAQ pages, HowTo pages, answer blocks, schema
- GEO/AI: AI Overview, ChatGPT, Perplexity, Gemini, Copilot, Claude citation rates
- Content: avg words, thin pages %, freshness, E-E-A-T, topical authority, duplicate

Real data flags:
- Technical tab: real crawl + real bot access + real broken links ● Live
- Authority tab: real backlink signals from OLP/Tranco/Wayback ● Source badge
- All other tabs: AI-estimated with explicit labeling
```

### Keyword Research
```
APIs: GET /api/kwsuggest?seed=
      GET /api/kwresearch?seed=&industry=
      POST /api/ai (clustering + intent)

Flow:
1. kwsuggest → 20 autocomplete suggestions (Google + Bing)
2. kwresearch → algorithmic difficulty/opportunity scoring
3. AI → cluster by topic, identify intent, build content brief

Output tabs:
- Clusters: grouped keyword families
- Questions: PAA-style question variants
- Related: semantic neighbors
- Opportunities: low-competition targets
```

### Content Writer
```
API: POST /api/ai (two-step)

Step 1 — Research:
  Input: topic, industry, audience, tone, target word count
  AI call 1: generate outline + keyword research + competitor analysis
  
Step 2 — Write:
  Input: research + outline
  AI call 2: write full article (HTML output)
  
Features:
- Preview (rendered HTML) + source toggle
- Inline edit (contentEditable)
- Copy to clipboard
- Word count live tracker
- History (last 20 articles)
```

### Schema Markup Generator
```
API: POST /api/ai (format=text, returns JSON-LD string)

17 supported types:
Article, NewsArticle, FAQ, Product, LocalBusiness, HowTo,
BreadcrumbList, Organization, Event, Recipe, Review,
VideoObject, JobPosting, Person, Service, SoftwareApplication, Course

Implementation:
- Generate template from user description (extract author, URL, price, 
  phone, address via regex)
- AI fills in schema-specific fields
- Copy button for JSON-LD output
- Syntax-highlighted preview
```

### Brand Monitor
```
API: GET /api/brandmention?brand=&competitors=

Real data: Google News + Yahoo News + Reddit RSS feeds
Rule-based sentiment scoring:
  Positive: great, amazing, excellent, love, best, helpful...
  Negative: terrible, awful, bad, scam, worst, hate...

Output:
- Mention count by source
- Sentiment breakdown (positive/neutral/negative %)
- Recent mentions table with sentiment badges
- Competitor share of voice comparison
- Automated alerts (e.g., "3 negative mentions detected")
```

---

## 8. Data Sources & Free APIs

### Tier 1 — No Key Required
| Source | Data | Rate Limit |
|---|---|---|
| Google Autocomplete | Keyword suggestions | ~100/hr per IP |
| Bing Autocomplete | Keyword suggestions | ~100/hr per IP |
| DuckDuckGo HTML | SERP top 10 | Best effort (scrape) |
| Wayback Machine CDX | Domain history, inlinks | 1req/s |
| Tranco List API | Domain rank (top 1M) | Generous |
| Google News RSS | Brand mentions | Unlimited |
| Yahoo News RSS | Brand mentions | Unlimited |
| Reddit RSS | Brand mentions | 1req/s |
| Pollinations.ai | Image generation (flux) | Unlimited |
| Open Link Profiler | Backlinks (scrape) | Best effort |

### Tier 2 — Free API Key
| Service | Data | Free Tier |
|---|---|---|
| Groq | LLM (Llama 3.3 70B) | 100K tokens/day |
| Freepik | Stock photos + AI gen | 100 AI gens/month |
| ModelsLab | AI image generation | 100/day |
| OpenPageRank | Domain page rank | 100 lookups/day |
| Pexels | Stock photos | 200/hr |

### Tier 3 — Paid (Optional Upgrades)
| Service | Data | Cost |
|---|---|---|
| Anthropic Claude | Primary LLM | ~$3/M tokens (claude-sonnet-4-6) |
| DataForSEO | Keyword CPC, volume, SERP | ~$0.0006/result |
| Ahrefs/Semrush | Real DR/backlinks | $99+/mo |
| Google Search Console API | Real rankings | Free (OAuth) |
| Google Analytics 4 API | Real traffic | Free (OAuth) |

### Google OAuth Setup
```
Google Cloud Console → New Project
APIs to enable:
  - Google Search Console API
  - Google Analytics Data API
  - Google People API (for email)

OAuth 2.0 Credentials:
  - Type: Web application
  - Authorized redirect URIs:
    https://yourdomain.vercel.app/api/auth/callback
    http://localhost:3000/api/auth/callback

Scopes:
  https://www.googleapis.com/auth/webmasters.readonly
  https://www.googleapis.com/auth/analytics.readonly
  https://www.googleapis.com/auth/userinfo.email
```

---

## 9. UI Design System

### Color Tokens (`S` object)
```typescript
const S = {
  // Base
  text:        "#111827",
  muted:       "#6b7280",
  card:        "#ffffff",
  border:      "#e5e7eb",
  subtle:      "#f9fafb",
  sidebar:     "#1e1b4b",
  sidebarText: "#c7d2fe",

  // Accent (purple/indigo)
  accent:      "#6366f1",
  accentBg:    "#eef2ff",
  accentText:  "#4338ca",

  // Status colors
  green:       "#16a34a",  greenBg:  "#f0fdf4",  greenText:  "#15803d",
  amber:       "#d97706",  amberBg:  "#fffbeb",  amberText:  "#92400e",
  red:         "#dc2626",  redBg:    "#fef2f2",  redText:    "#b91c1c",
  blue:        "#2563eb",  blueBg:   "#eff6ff",  blueText:   "#1d4ed8",

  // Shadows
  shadow:      "0 1px 3px rgba(0,0,0,0.1)",
  shadowMd:    "0 4px 6px -1px rgba(0,0,0,0.1)",
}
```

### Layout
```
Full viewport: flex row
Left sidebar: 220px fixed, dark purple (#1e1b4b)
Main content: flex-1, max-width 1100px, padding 28px 32px
Top bar: 56px, white, shows active project domain

Responsive: sidebar collapses to overlay on mobile
Breakpoint: 768px
```

### Data Quality Convention
```
Real data banner (green):
  background: S.greenBg
  border: 1px solid #86efac
  text: "✓ Real crawl data — N pages checked"

Estimated data banner (amber):
  background: S.amberBg  
  border: 1px solid #fcd34d
  text: "⚠ Estimated data — enter a live domain for real metrics"

AI analysis label (inline):
  <span style={{ fontSize:11, color:S.muted, fontWeight:400 }}>(AI analysis)</span>
```

### Score Color Convention
```typescript
const scoreColor = (n: number) =>
  n >= 70 ? "#16a34a" :   // green — good
  n >= 50 ? "#d97706" :   // amber — needs work
             "#dc2626";   // red — critical
```

### Typography
```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
body: 13-14px, color: #111827
headings: 700 weight
labels: 10-11px, uppercase, letter-spacing 0.05em
metrics: 20-24px, 700-800 weight
muted text: #6b7280
```

---

## 10. Real vs Estimated Data Strategy

### Guiding Principle
> "Show real data when we have it. Label AI estimates clearly. Never show a fake number as if it's real."

### Decision Matrix
| Data Type | Source | Label |
|---|---|---|
| Page titles, H1s, word count | Live crawl | ● Live |
| HTTP status codes | HEAD requests | ● Live |
| Organic clicks, CTR, position | Google Search Console OAuth | ● GSC |
| Sessions, bounce rate | Google Analytics 4 OAuth | ● GA4 |
| SERP top 10 results | DuckDuckGo/Bing scrape | ● Live SERP |
| Brand mentions | News RSS scrape | ● Live mentions |
| Domain rating, backlinks | OLP + Tranco + Wayback signals | ● Signal-based / ● Live |
| Keyword search volume | Not available free | Not shown / AI est. |
| AI citation rates (GEO) | Not available | AI-modelled estimate |
| Authority scores | Heuristic DR | Estimated DR |
| Traffic estimates | AI inference | AI estimated |
| Competitor metrics | AI inference | AI estimated |

### The `_scraped` Pattern
```typescript
// After any API call that may or may not return real data:
setData({ ...aiResult, _scraped: realDataWasAvailable });

// In render:
<div style={{
  background: data._scraped ? S.greenBg : S.amberBg,
  border: `1px solid ${data._scraped ? "#86efac" : "#fcd34d"}`,
}}>
  {data._scraped
    ? `✓ Real data — ${data._crawlData?.urls_checked} pages`
    : "⚠ Estimated — enter a live public URL for real data"}
</div>
```

---

## 11. Deployment

### Vercel Configuration (`vercel.json`)
```json
{
  "functions": {
    "api/py/*.py": {
      "runtime": "python3.12",
      "maxDuration": 60
    },
    "src/app/api/ai/route.ts": {
      "maxDuration": 120
    },
    "src/app/api/techaudit/route.ts": {
      "maxDuration": 60
    }
  },
  "rewrites": [
    { "source": "/api/py/:path*", "destination": "/api/py/:path*.py" }
  ]
}
```

### Python Requirements (`requirements.txt`)
```
requests==2.31.0
beautifulsoup4==4.12.3
lxml==5.2.1
```

### `next.config.ts`
```typescript
const nextConfig: NextConfig = {
  images: { unoptimized: true },
  experimental: { serverActions: { allowedOrigins: ["*"] } },
};
```

### Deploy Command
```bash
vercel --prod --yes
```

### Build Steps Vercel Performs
1. `npm run build` → Next.js TypeScript + Turbopack
2. Install Python deps from `requirements.txt`
3. Deploy each `api/py/*.py` as separate serverless function
4. Assign `rankmind-seven.vercel.app` production alias

---

## 12. Environment Variables

### Required
```bash
# AI Providers
ANTHROPIC_API_KEY=sk-ant-...          # Claude (primary LLM)
GROQ_API_KEY=gsk_...                  # Groq Llama 3.3 70B (fallback, free)

# Google OAuth (for GSC + GA4)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://yourdomain.vercel.app/api/auth/callback

# Auth
NEXTAUTH_SECRET=<32-char random string>
NEXTAUTH_URL=https://yourdomain.vercel.app

# Database
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Admin
ADMIN_SECRET=<strong-random-string>
```

### Optional (Image Generation)
```bash
FREEPIK_API_KEY=FPSX...              # Primary image gen
MODELSLAB_API_KEY=...                # Fallback image gen (100/day)
PEXELS_API_KEY=...                   # Stock photo fallback
```

### Optional (Data Enrichment)
```bash
DATAFORSEO_LOGIN=...                 # Keyword CPC + volume
DATAFORSEO_PASSWORD=...
```

### Local Development (`.env.local`)
```bash
# Same keys as above
# GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback
# NEXTAUTH_URL=http://localhost:3000
```

---

## 13. Known Limits & Workarounds

### Groq 100K Token/Day Limit
**Problem**: Large prompts (e.g., AEO with 60 scraped pages) can exhaust the daily budget.
**Fix**: Cap all prompts at 24K characters in `/api/ai` before sending. Trim middle section, keep head + tail.

### Anthropic Rate Limits / No Credits
**Problem**: Claude fails silently and falls through to Groq.
**Fix**: Anthropic is tried first. Groq is the fallback. If both fail, return 429 with friendly message. Check Anthropic billing at console.anthropic.com.

### DuckDuckGo SERP Scraping Blocks
**Problem**: DDG occasionally returns CAPTCHA or blocks server IPs.
**Fix**: Cascade DDG → Bing HTML → AI-estimated SERP results. Always label the source.

### Open Link Profiler Rate Limiting
**Problem**: OLP HTML scrape returns empty on some domains.
**Fix**: If OLP returns nothing, fall through to Tranco + Wayback signals. Label data quality accordingly ("Signal-based estimate" vs "Live data").

### Vercel 10s Edge Limit
**Problem**: Some tools (techaudit, AI gen, backlinks) take >10s.
**Fix**: All heavy routes have `maxDuration: 60` or `maxDuration: 120` in vercel.json. Python functions also use 60s.

### Google OAuth in Testing Mode
**Problem**: Only verified test users can authorize until app is published.
**Fix**: Add test user emails in Google Cloud Console → OAuth consent screen → Test users. For production, submit app for verification.

### Redis Deserialization
**Problem**: Upstash auto-deserializes JSON on read. `typeof cached` may be `object` not `string`.
**Fix**: Always check `typeof cached === "string"` before calling `JSON.parse(cached)`.

```typescript
const cached = await redis.get<unknown>(ck);
const result = typeof cached === "object" && cached !== null
  ? cached
  : typeof cached === "string"
    ? JSON.parse(cached)
    : cached;
```

### GA4 Property ID Format
**Problem**: GA4 requires numeric property ID. Users paste "G-XXXXXXXX" (Measurement ID, wrong).
**Fix**: Reject any property ID starting with "G-" with a clear error: "Use the numeric Property ID from GA4 Admin, not the G- Measurement ID."

### Multi-Site OAuth Tokens
**Problem**: Each connected GSC domain needs its own OAuth token.
**Fix**: Store tokens in Redis keyed by domain: `gsc_tokens:{domain}`. Also store all tokens in a cookie (JSON map) so they persist across sessions without Redis calls.

---

## Appendix A — SVG Chart Components

All charts are pure SVG — no Chart.js or Recharts dependency.

### SvgRadar (Hexagonal Radar Chart)
```typescript
// labels: string[], datasets: { data: number[], color, fill? }[]
// Renders hexagonal grid + polygon per dataset
// Used in: SEO Audit Report overview tab
```

### SvgGroupedBar (Grouped Bar Chart)
```typescript
// labels: string[], datasets: { data: number[], color }[]
// height?: number (default 180)
// Used in: SEO Audit Report (pillar vs benchmark)
```

### SvgHBar (Horizontal Bar Chart)
```typescript
// labels: string[], data: number[], colors: string[]
// height?: number
// Used in: GEO/AI tab citation rates
```

### SvgDonut (Donut/Pie Chart)
```typescript
// segments: { label, value, color }[]
// size?: number (default 100)
// Used in: Authority tab backlink quality breakdown
```

### SvgLine (Line Chart with Fill)
```typescript
// datasets: { data, color, fill?, dash? }[]
// Used in: Dashboard GSC/GA4 trend lines
```

---

## Appendix B — Tool History System

```typescript
function useToolHistory(toolId: string) {
  // localStorage key: rm_hist_{toolId}
  // Stores up to 20 entries per tool
  // Each entry: { id, timestamp, inputLabel, data }
  
  return {
    entries: HistoryEntry[],
    add: (label: string, data: any) => void,
    remove: (id: string) => void,
    clear: () => void,
  };
}

// Global history (HistoryPage component):
// Reads all rm_hist_* keys from localStorage
// Groups entries by date
// Shows tool name, input, timestamp
// Click to reload any previous result
```

---

## Appendix C — Admin Panel

```typescript
// Auth: Bearer token in Authorization header
// localStorage key: rm_admin_token (set from UI)

GET /api/admin → {
  users: DbUser[],
  activity: ActivityEvent[],
  stats: {
    total_users, active_today, active_week,
    total_queries, queries_today, plan_breakdown
  }
}

DELETE /api/admin?userId=xxx → { deleted: true }

// UI shows:
// - User table: email, name, plan, queryCount, lastActive
// - Activity feed: tool_run events with tool name + timestamp
// - Stats tiles
// - Delete button per user (with confirmation)
```

---

*Document generated June 2026 — covers RankMind v2 full feature set*
*Live platform: rankmind-seven.vercel.app*
