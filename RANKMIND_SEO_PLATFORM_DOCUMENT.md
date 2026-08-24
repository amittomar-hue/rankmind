# RankMind SEO Platform — In-Depth Product & Competitive Document

**Version:** 1.0  
**Date:** May 2026  
**Platform URL:** https://rankmind-seven.vercel.app  
**Stack:** Next.js 16.2.4 · Anthropic Claude claude-sonnet-4-6 · Google OAuth (GSC + GA4)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [RankMind — Full Feature Breakdown](#2-rankmind--full-feature-breakdown)
3. [SEMrush — Platform Overview](#3-semrush--platform-overview)
4. [Ahrefs — Platform Overview](#4-ahrefs--platform-overview)
5. [Head-to-Head Feature Comparison Matrix](#5-head-to-head-feature-comparison-matrix)
6. [Tool-by-Tool Deep Comparison](#6-tool-by-tool-deep-comparison)
7. [Data Sources Comparison](#7-data-sources-comparison)
8. [AI & Automation Capabilities](#8-ai--automation-capabilities)
9. [Pricing & Access Model](#9-pricing--access-model)
10. [RankMind Gaps & Roadmap to Match SEMrush/Ahrefs](#10-rankmind-gaps--roadmap-to-match-semrushahrefs)
11. [RankMind Technical Architecture](#11-rankmind-technical-architecture)
12. [Recommended Build Priorities](#12-recommended-build-priorities)

---

## 1. Executive Summary

| | RankMind | SEMrush | Ahrefs |
|---|---|---|---|
| **Founded** | 2026 | 2008 | 2011 |
| **Data type** | AI-generated estimates + real GSC/GA4 | Proprietary crawl + clickstream | Proprietary crawl + clickstream |
| **Keyword DB** | AI-simulated | 26+ billion keywords | 20+ billion keywords |
| **Backlink DB** | AI-simulated | 43 trillion backlinks | 35+ trillion backlinks |
| **Price** | Free (demo) | $129–$499/mo | $99–$999/mo |
| **AI Integration** | Native (every tool) | Copilot add-on ($) | AI features (limited) |
| **Target user** | Startups / agencies / AI-first teams | Enterprise / agencies | Technical SEOs / link builders |
| **Unique angle** | AI-first, zero setup, GSC/GA4 real data | Deepest all-in-one data | Best backlink index |

**Key takeaway:** RankMind is a lean, AI-native SEO suite that delivers instant insights without the multi-hundred-dollar subscriptions. Its core differentiation is the integration of real GSC/GA4 data with Claude AI analysis — giving users the interpretation layer that raw data platforms like SEMrush and Ahrefs leave to the user. The gap to close is **proprietary crawl data at scale** and a handful of workflow features (PPC, social, CRM integrations).

---

## 2. RankMind — Full Feature Breakdown

### 2.1 Architecture Overview

```
User → AuthPage (sign in/up/forgot/reset)
     → RankMind Shell (session, sidebar, routing)
       ├── Dashboard (8 KPIs, sparklines, AI visibility, top keywords)
       ├── My Sites / Projects (folder tracking, domain monitoring)
       ├── GSC — Google Search Console (real OAuth, 7D/28D, queries/pages)
       ├── GA4 — Google Analytics 4 (real OAuth, sessions/users/conversions)
       ├── AI Search / AEO (sitemap scrape → Claude analysis)
       ├── 17 SEO tool pages (all Claude-powered)
       └── History (global per-tool log, localStorage, 20 entries/tool)
```

### 2.2 Core Platform Features

#### Analytics Dashboard
- **8 KPI cards** (2 rows × 4): Organic Clicks, Sessions, Conversions, Avg Position, Impressions, Users, Bounce Rate, Avg CTR — each with % change vs prior period
- **Dual sparklines**: GA4 sessions trend (green) + GSC search clicks trend (indigo), side-by-side SVG polyline charts
- **AI Search Visibility panel**: VisibilityGauge (SVG semicircle), Mentions, Citations, Cited Pages count, LLM distribution bars (ChatGPT / Gemini / Perplexity / Claude / Copilot)
- **Top 10 Keywords table**: keyword, clicks, impressions, CTR, position badge (green/amber/red), trend label (Top 3/Page 1/Page 2/Page 3+)
- **Traffic Sources**: GA4 channel breakdown with session bars
- **Quick access grid**: 8 tool shortcuts

#### My Sites (Projects)
- **Folder system**: Create named folders, add multiple sites per folder, collapse/expand
- **Per-site AI metrics** (AI-estimated on add): SEO Score, AI Visibility, Mentions, Site Health %, Visibility %, Organic Traffic, Organic Keywords, Backlinks
- **Domains monitoring table**: domain + country flag, Organic Keywords + area sparkline, Organic Traffic + area sparkline, Paid Keywords, Paid Traffic, Referring Domains, Authority Score donut gauge
- Persistent via localStorage (`rm_proj_folders`, `rm_proj_monitored`)

#### Google Search Console Integration
- Real OAuth 2.0 (webmasters.readonly scope)
- Auto-load on return from OAuth redirect
- 7-day / 28-day toggle
- 5 parallel API fetches for different date windows
- Tabs: Overview (summary KPIs + daily chart) / Queries (top keywords table) / Pages (top pages table)
- AI Insights: Claude analysis of GSC data patterns

#### Google Analytics 4 Integration
- Real OAuth 2.0 (analytics.readonly scope)
- Auto-load on return from OAuth redirect
- 5 parallel GA4 Data API fetches
- Tabs: Overview (sessions/users/conversions + daily chart) / Pages (top pages) / Sources (traffic channels)
- AI Insights: Claude analysis of GA4 data patterns

#### AI Search Visibility (AEO)
- Domain input → server-side sitemap scrape → Claude analysis
- **Scrape strategy**: robots.txt Sitemap directive → /sitemap.xml → /sitemap_index.xml → /sitemap-index.xml → /wp-sitemap.xml → /post-sitemap.xml → /page-sitemap.xml → homepage href scrape fallback
- Returns up to 60 real deduplicated same-host URLs
- Real URLs injected into Claude prompt for accurate page attribution
- **Output**: AI Visibility score (0–100), LLM presence distribution, key topics, opportunities
- **4 tabs**: Topics / Opportunities / Sources / Pages (with green "real URLs" or amber "estimated" banner)
- History stored per tool, 20 entries max

### 2.3 The 17 SEO Tools

#### 1. Site Crawl (Technical SEO)
**Inputs:** Site URL  
**Output:**
- Crawl summary: pages found, depth, response codes breakdown, crawl errors, blocked pages, noindex count
- Score cards: Health, Speed, Mobile, Security (0–100 each)
- Core Web Vitals: LCP, FCP, CLS, TTFB, INP — value + rating (Good/Needs Improvement/Poor)
- Issues table: title, severity (critical/warning/info), category, detail, fix, count, effort
- Issue category filter: All / Crawlability / HTML Tags / Content / Images / Links / Performance / Structured Data
- Schema found vs missing lists

**SEMrush equivalent:** Site Audit  
**Ahrefs equivalent:** Site Audit

---

#### 2. Response Codes (Broken Links)
**Inputs:** Domain  
**Output:**
- Summary: total links, broken count, redirects, healthy
- Broken links table: source URL, target URL, status code, type (internal/external), anchor text, fix suggestion
- Recommendations list

**SEMrush equivalent:** Site Audit > Crawled Pages (filter by status code)  
**Ahrefs equivalent:** Site Audit > All Issues > 4xx / 5xx

---

#### 3. Internal Links
**Inputs:** Domain  
**Output:**
- Internal link score (0–100)
- Orphan pages count, over-linked pages count
- Opportunities table: source page, target page, suggested anchor, reason, priority
- Recommendations list

**SEMrush equivalent:** Site Audit > Internal Linking  
**Ahrefs equivalent:** Site Audit > Internal pages > Orphan pages

---

#### 4. Sitemap Analyzer
**Inputs:** Sitemap URL  
**Output:**
- Total URLs, indexed, excluded, coverage %
- Issues table: type, severity, count, detail, fix suggestion
- Pages table: URL, priority, changefreq, lastmod, status
- Recommendations

**SEMrush equivalent:** Site Audit > Sitemap  
**Ahrefs equivalent:** Site Audit > Sitemaps

---

#### 5. Backlink Profile
**Inputs:** Domain  
**Output:**
- Overview: Domain Rating, total backlinks, referring domains, dofollow/nofollow, edu/gov links, month-over-month changes
- Link types breakdown: editorial, guest, resource, directory, forum
- DR distribution chart (ranges + counts)
- Anchor text analysis: branded/generic/exact-match/LSI/naked/other — % + count
- Link velocity: monthly trend (12 months)
- Top links table: referring domain, DR, anchor, type, traffic
- Lost links table: domain, DR, anchor, reason
- Link opportunities table: domain, DR, type, note
- Toxic links table: domain, issue, recommended action
- Tabs: Overview / Anchor Types / Velocity / Top Links / Lost / Toxic

**SEMrush equivalent:** Backlink Analytics + Backlink Audit  
**Ahrefs equivalent:** Site Explorer > Backlinks + Referring Domains

---

#### 6. Link Building
**Inputs:** Domain, Topic  
**Output:**
- Prospects table: site name, type (blog/news/directory/forum), DR, relevance score, outreach tactic, email, email template
- Strategies list (actionable link-building tactics)
- Quick wins list

**SEMrush equivalent:** Link Building Tool  
**Ahrefs equivalent:** Link Intersect + Content Explorer for prospecting

---

#### 7. Keyword Explorer
**Inputs:** Seed keyword, Industry (optional)  
**Output:**
- Seed keyword metrics: volume, KD (0–100), CPC, intent, competitive density, 12-month trend array, SERP features list
- Keyword clusters: cluster name, intent, keywords (each with volume, KD, CPC, comp, features, trend)
- Intent filter tabs: All / Informational / Commercial / Transactional / Navigational
- Questions list (People Also Ask style): question, volume, snippet eligibility
- Related keywords

**SEMrush equivalent:** Keyword Magic Tool  
**Ahrefs equivalent:** Keywords Explorer

---

#### 8. SERP Analyzer
**Inputs:** Keyword, Location (default: US)  
**Output:**
- Search intent + reasoning
- SERP features present
- Keyword difficulty score
- SERP results table: position, domain, title, result type, DA, backlinks, word count
- Opportunity assessment
- Content strategy recommendation

**SEMrush equivalent:** Keyword Overview > SERP Analysis  
**Ahrefs equivalent:** Keywords Explorer > SERP overview

---

#### 9. Rank Tracker
**Inputs:** Domain, Keywords (comma-separated, optional), Location  
**Output:**
- Summary: average position, visibility %, top-3 count, top-10 count
- Rankings table: keyword, current position, previous position, change, URL, SERP features, competitor positions
- Competitors table: domain, visibility %, keyword overlap
- Opportunities list

**SEMrush equivalent:** Position Tracking  
**Ahrefs equivalent:** Rank Tracker

---

#### 10. Competitor Analysis
**Inputs:** Your domain + up to 3 competitors  
**Output:**
- Overview table: domain, DR, estimated traffic, keywords, backlinks, content score
- Keyword gap tabs: Missing / Weak / Shared / Strong — each with keyword, volume, KD, your position
- Content gaps: topic, which competitor covers it, gap description, action
- Backlink gaps: referring domain, DR, links to competitor, opportunity description
- AI summary of competitive landscape

**SEMrush equivalent:** Competitive Research (Domain Overview + Keyword Gap + Backlink Gap)  
**Ahrefs equivalent:** Site Explorer + Content Gap + Link Intersect

---

#### 11. On-Page SEO
**Inputs:** Page URL, Target keyword  
**Output:**
- Overall score + Content / Readability scores, word count vs recommended
- Tag audit: title, meta description, H1 — value, length, status, recommendation
- Keyword placement checklist: title / meta / H1 / first 100 words / alt text / URL / headings (7 boolean checks)
- TF-IDF table: term, recommended count, current count, gap, status
- Semantic keywords: term, relevance, present (yes/no)
- Featured snippet eligibility: type, reason, action
- Actions table: priority, category, action, impact
- SERP benchmark: top competitors with position, word count, score

**SEMrush equivalent:** On Page SEO Checker  
**Ahrefs equivalent:** Site Audit > On-page issues

---

#### 12. Content Writer
**Inputs:** Target keyword, Audience, Tone (Professional/Conversational/Authoritative/Friendly), Word count (500–2000)  
**Output:**
- Content brief: meta title, meta description, secondary keywords, intent, outline (heading + type + supporting points), TF-IDF terms
- Full article: generated markdown text

**SEMrush equivalent:** SEO Content Template + SEO Writing Assistant  
**Ahrefs equivalent:** No direct equivalent

---

#### 13. Writing Assistant (SEO Writer)
**Inputs:** Target keyword, Paste your content (textarea, up to 800 chars analyzed)  
**Output:**
- SEO Score, Readability score, Tone detection, Originality %, Keyword density, Word count
- Issues: type, message, fix, severity (critical/warning/suggestion)
- Suggestions list
- Missing keywords list

**SEMrush equivalent:** SEO Writing Assistant  
**Ahrefs equivalent:** No direct equivalent

---

#### 14. Content Audit
**Inputs:** Domain, URLs to audit (optional multiline list)  
**Output:**
- Summary: total pages, thin content count, cannibalizing count, healthy count
- Thin content table: URL, issue, word count, action, priority
- Keyword cannibalization groups: keyword, competing URLs, winner URL, fix recommendation
- Quick wins list

**SEMrush equivalent:** Content Audit  
**Ahrefs equivalent:** Site Audit > Content issues

---

#### 15. Topic Research
**Inputs:** Seed keyword, Industry (optional)  
**Output:**
- Topic clusters: topic, content angle, format, estimated volume, trend, related questions
- Trending topics list
- People Also Ask questions
- Long-tail keyword suggestions

**SEMrush equivalent:** Topic Research  
**Ahrefs equivalent:** Keywords Explorer > Questions + Content Explorer

---

#### 16. Schema Generator
**Inputs:** Schema type (Article / FAQ / Product / LocalBusiness / HowTo / BreadcrumbList / Organization / Event / Recipe / Review), Description  
**Output:**
- Valid JSON-LD structured data markup (copy-ready)

**SEMrush equivalent:** No direct equivalent  
**Ahrefs equivalent:** No direct equivalent

---

#### 17. Local SEO
**Inputs:** Business name, Location, Category (optional)  
**Output:**
- Overall score, GMB score (0–100)
- Issues table: area, issue, fix, impact
- Local keyword suggestions: keyword, type (service/location/near me), priority
- Citation opportunities
- Local SEO tips list

**SEMrush equivalent:** Listing Management + Local SEO tools  
**Ahrefs equivalent:** No direct equivalent

---

## 3. SEMrush — Platform Overview

### 3.1 What SEMrush Is

SEMrush is the most comprehensive SEO + digital marketing platform available. It combines a proprietary keyword database (26+ billion keywords across 140+ countries), a 43-trillion-link backlink index, real clickstream data partnerships, and 55+ tools spanning SEO, PPC, content, social, and competitive intelligence.

### 3.2 SEMrush Tool Categories

#### SEO Toolkit
| Tool | What It Does |
|------|-------------|
| Domain Overview | Traffic estimates, keyword count, authority score, competitive positioning |
| Organic Research | Every keyword a domain ranks for, with position history |
| Keyword Gap | Side-by-side keyword overlap across up to 5 domains |
| Backlink Gap | Referring domains your competitors have that you don't |
| Backlink Analytics | Full backlink profile, anchor analysis, link history |
| Backlink Audit | Toxicity score, disavow file builder |
| Position Tracking | Daily rank tracking, SERP feature tracking, share of voice |
| Site Audit | 130+ technical checks, crawlability, Core Web Vitals, HTTPS |
| On Page SEO Checker | Semantic recommendations per page |
| Listing Management | GMB sync, citation management across 70+ directories |
| Log File Analyzer | Parse server logs to see how Googlebot crawls your site |

#### Keyword Research
| Tool | What It Does |
|------|-------------|
| Keyword Magic Tool | 26B+ keyword database, semantic clusters, intent, SERP features |
| Keyword Manager | Save/organize keyword lists |
| Keyword Overview | Volume, KD, CPC, trend, SERP analysis |
| Organic Traffic Insights | Connect GSC for "not provided" keyword recovery |

#### Content & PR
| Tool | What It Does |
|------|-------------|
| Topic Research | Mind-map style topic cluster discovery |
| SEO Content Template | Semantic requirements for a target keyword |
| SEO Writing Assistant | Real-time grading of content being written |
| ContentShake AI | Full AI article generation |
| Post Tracking | Track rankings + backlinks for individual articles |
| Brand Monitoring | Mentions across web, news, social |

#### Advertising
| Tool | What It Does |
|------|-------------|
| Advertising Research | Competitor PPC keywords, ad copies, budgets |
| Display Advertising | Banner ad research |
| PLA Research | Google Shopping competitor analysis |
| Keyword Planner integration | Import/export with Google Ads |

#### Competitive Research
| Tool | What It Does |
|------|-------------|
| Market Explorer | TAM, market players, audience demographics |
| Traffic Analytics | Estimated traffic, engagement, channel mix per domain |
| EyeOn | Scheduled competitor change monitoring |

#### Social Media
| Tool | What It Does |
|------|-------------|
| Social Media Toolkit | Schedule posts, analytics, competitor benchmarking |
| Social Media Tracker | Track competitor social metrics |
| Social Media Poster | Multi-platform publishing |

### 3.3 SEMrush Data Infrastructure
- **Keyword data:** 26B+ keywords, 140+ countries, updated monthly/weekly
- **Backlink data:** 43T links, 808M domains, updated daily
- **Traffic data:** Clickstream panels + proprietary modeling, ~200M domains
- **Crawl:** 10M pages/day
- **SERP snapshots:** Daily for tracked keywords
- **Local data:** Yext integration for 70+ directories

---

## 4. Ahrefs — Platform Overview

### 4.1 What Ahrefs Is

Ahrefs is the SEO tool of choice for technical SEOs and link-builders. Its core strength is the world's most active web crawler (second only to Google) and the most accurate backlink index. Ahrefs processes 8 billion pages per day and updates its link index every 15–30 minutes.

### 4.2 Ahrefs Tool Categories

#### Site Explorer (Flagship)
| View | What It Does |
|------|-------------|
| Overview | DR, UR, ahrefs rank, estimated traffic, referring domains |
| Organic Keywords | Every keyword a domain/page ranks for |
| Top Pages | Pages sorted by estimated organic traffic |
| Competing Domains | Domains with highest keyword overlap |
| Content Gap | Keywords competitors rank for that you don't |
| Backlinks | Every known backlink, full anchor/follow/lost analysis |
| Referring Domains | DR distribution of linking domains |
| Referring IPs/Subnets | IP diversity of backlink profile |
| Broken Backlinks | 404 pages that still have inbound links |
| Linked Domains | Internal/external link graph |
| Anchors | Full anchor text breakdown |
| Outgoing Links | External links from any page |
| Link Intersect | Domains linking to competitors but not you |

#### Keywords Explorer
| Feature | What It Does |
|---------|-------------|
| Keyword Overview | Volume, KD, clicks, CPC, SERP overview |
| Keyword Ideas | Similar, also rank for, also ask, search suggestions |
| SERP History | 2-year position history for top 10 |
| Traffic Share | Which domains capture traffic for keyword |
| Parent Topic | The broader keyword cluster |

#### Site Audit
| Feature | What It Does |
|---------|-------------|
| Crawl | Up to 5M pages/crawl |
| Health Score | Weighted issue scoring |
| All Issues | 100+ checks with priority |
| JavaScript rendering | Full JS crawl with Headless Chrome |
| Scheduled crawls | Automatic re-crawl on schedule |

#### Content Explorer
- Full-text search across 11B+ indexed pages
- Filter by DR, referring domains, traffic, date
- Content performance trends
- Competing content for any topic

#### Rank Tracker
- Daily rank updates
- SERP feature tracking
- Share of voice, visibility trends
- Competitor tracking, alerts

#### Web Explorer (New)
- Live search across their full crawl index
- Filter by page size, word count, technology

### 4.3 Ahrefs Data Infrastructure
- **Crawler:** 8B pages/day, 2nd largest after Google
- **Backlink index:** 35T+ links, updated every 15–30 min
- **Keyword data:** 20B+ keywords, 170+ countries
- **Referring domains:** 3.1B domains crawled
- **Historical data:** Position history back to 2015

---

## 5. Head-to-Head Feature Comparison Matrix

### 5.1 Core SEO Features

| Feature | RankMind | SEMrush | Ahrefs |
|---------|----------|---------|--------|
| **Keyword research** | ✓ AI-generated | ✓✓ 26B real DB | ✓✓ 20B real DB |
| **Keyword difficulty** | ✓ AI score | ✓✓ % based on top 10 backlinks | ✓✓ % based on referring domains |
| **Search volume** | ✓ AI-estimated | ✓✓ Clickstream-verified | ✓✓ Clickstream-verified |
| **Keyword clusters/groups** | ✓ AI-generated | ✓✓ Semantic clustering | ✓ Topic grouping |
| **SERP features tracking** | ✓ AI-listed | ✓✓ 30+ feature types, live | ✓✓ 15+ types, live |
| **Search intent** | ✓ AI classified | ✓✓ Labeled on every keyword | ✓✓ Labeled on every keyword |
| **Long-tail suggestions** | ✓ AI-generated | ✓✓ Millions per seed | ✓✓ Millions per seed |
| **People Also Ask** | ✓ AI-generated | ✓✓ Real Google PAA | ✓✓ Real Google PAA |
| **CPC data** | ✓ AI-estimated | ✓✓ Real Google Ads data | ✓✓ Real Google Ads data |

### 5.2 Backlink Features

| Feature | RankMind | SEMrush | Ahrefs |
|---------|----------|---------|--------|
| **Backlink index** | ✗ No real index | ✓✓ 43T links | ✓✓ 35T+ links |
| **Domain Rating/Authority** | ✓ AI-estimated | ✓✓ Authority Score (real) | ✓✓ DR (real) |
| **Referring domains** | ✓ AI-estimated | ✓✓ Real | ✓✓ Real |
| **Link velocity** | ✓ AI-simulated | ✓✓ Real time-series | ✓✓ Real time-series |
| **Anchor analysis** | ✓ AI categories | ✓✓ Every anchor | ✓✓ Every anchor |
| **Lost/gained links** | ✓ AI-simulated | ✓✓ Real (daily) | ✓✓ Real (every 15 min) |
| **Toxic link detection** | ✓ AI-suggested | ✓✓ Toxicity Score + disavow | ✓ DR-based filtering |
| **Link building prospects** | ✓ AI-generated | ✓✓ Link Building Tool | ✓ Content Explorer |
| **Link Intersect** | ✗ Not yet | ✓✓ Backlink Gap | ✓✓ Link Intersect |
| **Broken backlink finder** | ✗ Not yet | ✓ | ✓✓ |

### 5.3 Technical SEO

| Feature | RankMind | SEMrush | Ahrefs |
|---------|----------|---------|--------|
| **Site crawl** | ✓ AI-estimated | ✓✓ Real crawl (130+ checks) | ✓✓ Real crawl (100+ checks) |
| **Core Web Vitals** | ✓ AI-estimated | ✓✓ Via PageSpeed API | ✓✓ Via PageSpeed API |
| **Crawl budget analysis** | ✗ Not yet | ✓✓ Log file analyzer | ✗ |
| **JavaScript rendering** | ✗ Not yet | ✓ | ✓✓ |
| **Duplicate content** | ✓ AI-simulated | ✓✓ Real duplicate detection | ✓✓ |
| **HTTPS/security** | ✓ AI-checked | ✓✓ Real | ✓✓ Real |
| **Sitemap analysis** | ✓ AI + real URL fetch | ✓✓ Real | ✓✓ Real |
| **Internal linking** | ✓ AI analysis | ✓✓ Real crawl graph | ✓✓ Real crawl graph |
| **Broken links** | ✓ AI-simulated | ✓✓ Real | ✓✓ Real |
| **Schema validation** | ✓ Schema Generator | ✓ Structured data check | ✓ |
| **Hreflang audit** | ✗ Not yet | ✓✓ | ✓✓ |
| **Page speed scores** | ✓ AI-estimated | ✓✓ Via Lighthouse | ✓✓ Via Lighthouse |

### 5.4 Content & On-Page

| Feature | RankMind | SEMrush | Ahrefs |
|---------|----------|---------|--------|
| **On-page analysis** | ✓ AI-powered | ✓✓ Real semantic data | ✓✓ Real crawl data |
| **TF-IDF analysis** | ✓ AI-generated | ✓✓ Corpus-based | ✗ |
| **Content brief generation** | ✓ AI (full brief) | ✓ SEO Content Template | ✗ |
| **AI article writing** | ✓ Full article | ✓ ContentShake AI | ✗ |
| **Writing assistant** | ✓ Real-time scoring | ✓✓ Real-time (Google Docs plugin) | ✗ |
| **Content audit** | ✓ AI analysis | ✓✓ Real crawl + Analytics | ✓ |
| **Topic research** | ✓ AI clusters | ✓✓ Mind map + real data | ✓ Content Explorer |
| **Content Explorer** | ✗ Not yet | ✓✓ 1B+ pages indexed | ✓✓ 11B+ pages |
| **Post tracking** | ✗ Not yet | ✓ Post Tracking | ✓ |
| **Brand monitoring** | ✗ Not yet | ✓✓ Brand Monitoring | ✗ |

### 5.5 Rank Tracking

| Feature | RankMind | SEMrush | Ahrefs |
|---------|----------|---------|--------|
| **Rank tracking** | ✓ AI-estimated | ✓✓ Daily real positions | ✓✓ Daily real positions |
| **SERP feature tracking** | ✓ AI-listed | ✓✓ 30+ types | ✓✓ 15+ types |
| **Local rank tracking** | ✗ Not yet | ✓✓ Map pack tracking | ✓✓ |
| **Mobile vs desktop** | ✗ Not yet | ✓✓ | ✓✓ |
| **Share of voice** | ✗ Not yet | ✓✓ | ✓✓ |
| **Competitor rank tracking** | ✓ AI-estimated | ✓✓ Real | ✓✓ Real |
| **Visibility score** | ✓ AI-estimated | ✓✓ Real | ✓✓ Real |
| **Alerts/notifications** | ✗ Not yet | ✓✓ Email alerts | ✓✓ Email alerts |

### 5.6 Competitive Intelligence

| Feature | RankMind | SEMrush | Ahrefs |
|---------|----------|---------|--------|
| **Competitor overview** | ✓ AI analysis | ✓✓ Real domain overview | ✓✓ Real domain overview |
| **Traffic estimates** | ✓ AI-estimated | ✓✓ Clickstream + model | ✓✓ Click data model |
| **Keyword gap** | ✓ AI-generated | ✓✓ Real (up to 5 domains) | ✓✓ Real Content Gap |
| **Backlink gap** | ✓ AI-suggested | ✓✓ Backlink Gap tool | ✓✓ Link Intersect |
| **SERP overlap** | ✗ Not yet | ✓✓ | ✓✓ |
| **Market share** | ✗ Not yet | ✓✓ Market Explorer | ✗ |
| **Ad research (PPC)** | ✗ Not yet | ✓✓ Full PPC toolkit | ✗ |
| **Display ads research** | ✗ Not yet | ✓✓ | ✗ |

### 5.7 Data Integrations

| Integration | RankMind | SEMrush | Ahrefs |
|------------|----------|---------|--------|
| **Google Search Console** | ✓✓ Real OAuth | ✓✓ Real OAuth | ✓ (limited) |
| **Google Analytics 4** | ✓✓ Real OAuth | ✓✓ | ✗ |
| **Google Ads** | ✗ | ✓✓ | ✗ |
| **Google Business Profile** | ✗ | ✓✓ | ✗ |
| **Zapier/API** | ✗ | ✓✓ | ✓✓ |
| **Google Data Studio** | ✗ | ✓✓ | ✗ |
| **Slack notifications** | ✗ | ✓✓ | ✗ |
| **API access** | ✗ Not yet | ✓✓ Paid add-on | ✓✓ Paid add-on |

### 5.8 AI & Automation

| Feature | RankMind | SEMrush | Ahrefs |
|---------|----------|---------|--------|
| **AI insights on every tool** | ✓✓ Native Claude | ✓ Copilot (add-on $$$) | ✓ AI-generated overviews |
| **AI content generation** | ✓✓ Full articles | ✓✓ ContentShake AI | ✗ |
| **AI competitor summaries** | ✓✓ Auto-generated | ✓ | ✗ |
| **AI-powered AEO analysis** | ✓✓ LLM visibility scoring | ✗ | ✗ |
| **Automated reporting** | ✗ Not yet | ✓✓ PDF/white-label | ✓✓ PDF reports |
| **AI writing assistant** | ✓✓ | ✓✓ (Google Docs plugin) | ✗ |

### 5.9 Local SEO

| Feature | RankMind | SEMrush | Ahrefs |
|---------|----------|---------|--------|
| **Local keyword suggestions** | ✓ AI-generated | ✓✓ Real local data | ✓ |
| **GMB audit** | ✓ AI-scored | ✓✓ Real GMB sync | ✗ |
| **Citation management** | ✓ AI-suggested | ✓✓ 70+ directories | ✗ |
| **Local rank tracking** | ✗ | ✓✓ Map pack | ✓✓ |
| **Review management** | ✗ | ✓✓ | ✗ |

---

## 6. Tool-by-Tool Deep Comparison

### 6.1 Keyword Research

#### SEMrush Keyword Magic Tool
- Database: 26.1 billion keywords
- Filters: Volume, KD, CPC, intent, SERP features, include/exclude words, broad/phrase/exact match
- Groups: Smart clustering by topic — hundreds of subtopics per seed
- Export: CSV/XLSX, unlimited rows
- Trend: Monthly data from Google Keyword Planner
- Questions: Auto-extracted from People Also Ask and forums

#### Ahrefs Keywords Explorer
- Database: 20+ billion keywords, 170+ countries
- Unique metric: "Clicks" (not just volume — shows actual click-through traffic)
- Parent Topic: Shows the main keyword driving traffic to the top-ranking pages
- Traffic potential: Based on all keywords the top-ranking page ranks for
- SERP history: Up to 2 years of position data for the top 10
- Keyword ideas: Similar / Also rank for / Also talk about / Search suggestions / Newly discovered

#### RankMind Keyword Explorer
- Single seed input + industry context
- AI generates: search volume, KD (0–100), CPC, intent, competitive density, 12-month trend
- Keyword clusters with intent labeling
- Intent filter tabs (Informational / Commercial / Transactional / Navigational)
- Questions section (PAA-style)
- Related keywords

**Gap:** No real database. RankMind's numbers are AI-estimated and not clickstream-verified. The clustering is AI-generated rather than corpus-derived. No bulk keyword upload, no historical position data.

**Opportunity:** The intent classification and cluster grouping are actually excellent AI output — these are things SEMrush charges extra for (Copilot), and RankMind delivers them natively.

---

### 6.2 Backlink Analysis

#### Ahrefs Site Explorer (Backlinks)
- 35T+ link index updated every 15–30 minutes
- New/Lost backlinks visible within hours of gain/loss
- Link type detection (nofollow, UGC, sponsored)
- Full anchor text breakdown with context snippets
- Historical charts going back to 2015
- DR (Domain Rating) calculated from referring domain network
- IP diversity analysis
- Best-in-class broken backlinks finder (links pointing to your 404s)

#### SEMrush Backlink Analytics
- 43T link index (largest claimed)
- Authority Score (0–100) blending backlinks + traffic signals
- Backlink Audit: Toxicity Score (0–100 per link), auto-disavow file builder
- Link building tool with outreach CRM built in
- Moving trend (daily new/lost chart)
- Comparison across 5 domains simultaneously

#### RankMind Backlink Profile
- AI-generated domain rating, referring domain count, link counts
- DR distribution histogram (AI-generated ranges)
- Anchor type breakdown (branded/exact/generic etc.)
- Link velocity trend (AI-simulated 12 months)
- Top links table, lost links table, link opportunities
- Toxic link detection (AI-suggested issues)

**Gap:** No real backlink index. Every number is AI-estimated. Real-world use requires actual crawl data. However, the presentation layer (all the tabs, the toxicity concept, the DR distribution) is complete and ready for real data injection.

---

### 6.3 Site Audit / Technical SEO

#### SEMrush Site Audit
- Crawls up to 100K pages per project on Business plan
- 130+ technical checks
- Priority scoring (errors > warnings > notices)
- Weekly scheduled re-crawls
- CWV integration via Google PageSpeed API
- Log File Analyzer: uploads Apache/Nginx logs, shows Googlebot crawl distribution
- Crawl comparison: before/after to track improvements

#### Ahrefs Site Audit
- Up to 5M pages per crawl (unlimited on Enterprise)
- JavaScript rendering with headless Chrome — handles SPAs
- Health score: weighted issue calculation
- Scheduled crawls (hourly to monthly)
- Crawl progress map showing discovered internal link graph
- HTTP auth support — audits password-protected staging sites
- Comparison between crawls

#### RankMind Site Crawl
- Single URL input → AI analysis
- Crawl summary (pages, response codes, errors) — AI-estimated
- Core Web Vitals (AI-estimated LCP, FCP, CLS, TTFB, INP)
- Issue table with severity and fix suggestion
- 8 category filters
- Schema found/missing lists

**Gap:** No actual crawler. AI cannot know what's on a real website without fetching it. The `/api/scrape` route fetches real URLs from sitemaps, which could be extended to run actual page-level technical checks.

---

### 6.4 AI-Powered Features

This is where RankMind has a structural advantage over both competitors.

| Capability | RankMind | SEMrush | Ahrefs |
|-----------|----------|---------|--------|
| Every tool has AI insights | ✓✓ | ✗ (Copilot is $140+/mo add-on) | ✗ |
| AI content brief | ✓✓ Full brief | ✓ Template-based | ✗ |
| AI full article generation | ✓✓ | ✓ ContentShake ($60+/mo) | ✗ |
| AI writing assistant | ✓✓ | ✓✓ (browser plugin) | ✗ |
| AI competitor summary | ✓✓ Auto-generated | ✗ | ✗ |
| AI search visibility (AEO) | ✓✓ Unique feature | ✗ | ✗ |
| AI schema generation | ✓✓ 10 schema types | ✗ | ✗ |
| AI link building prospects | ✓✓ With email templates | Partially (manual outreach CRM) | ✗ |
| Natural language query | ✗ Not yet | ✓ Copilot (add-on) | ✗ |
| AI LLM visibility monitoring | ✓✓ Native | ✗ | ✗ |

**RankMind's AI advantage:** Claude claude-sonnet-4-6 is integrated at every layer. No competitor offers AI interpretation on every single tool at no extra cost. The AEO (AI Search Visibility) feature — tracking how often a brand appears in ChatGPT/Gemini/Perplexity answers — is a genuinely novel feature neither SEMrush nor Ahrefs offers at all.

---

## 7. Data Sources Comparison

| Data Type | RankMind | SEMrush | Ahrefs |
|-----------|----------|---------|--------|
| **Keyword volume** | Claude AI estimate | Google KW Planner + clickstream | Clickstream panels |
| **Backlink data** | Claude AI estimate | Proprietary crawler (43T links) | Proprietary crawler (35T links) |
| **Traffic estimates** | Claude AI estimate | SimilarWeb-style clickstream model | Click-through rate model |
| **SERP positions** | Claude AI estimate | Direct SERP scraping | Direct SERP scraping |
| **Domain authority** | Claude AI estimate | Authority Score algorithm | DR algorithm |
| **GSC data** | Real (OAuth) | Real (OAuth) | Limited |
| **GA4 data** | Real (OAuth) | Real (OAuth) | ✗ |
| **Page content** | Real (sitemap fetch + homepage scrape) | Real (full crawler) | Real (full crawler) |
| **CWV** | Claude AI estimate | Google PageSpeed API | Google PageSpeed API |
| **Local citations** | Claude AI estimate | Yext + directory partnerships | ✗ |

**RankMind's real data advantage:** While most metrics are AI-estimated, the GSC and GA4 integrations bring in genuine, user-authenticated data. For many users, their own GSC/GA4 data is more actionable than SEMrush/Ahrefs estimates of their site.

---

## 8. AI & Automation Capabilities

### 8.1 RankMind AI Architecture

```
User input (domain / keyword / URL)
    ↓
withNonce(prompt)           ← prevents duplicate Claude outputs
    ↓
POST /api/ai
    ↓
Claude claude-sonnet-4-6 (Anthropic)
    ├── format: "json" → ai() → extracts first {...} block
    └── format: "text" → aiText() → returns raw markdown
    ↓
Rendered in tool UI
```

**Every tool prompt is:**
1. Seeded with user inputs
2. Appended with a nonce (`Date.now().toString(36) + Math.random()`)
3. Instructed to return structured JSON with specific fields
4. For AEO: real URLs from `/api/scrape` are injected as context

### 8.2 SEMrush AI (Copilot)
- Launched 2024 as a paid add-on ($0 on Business plan, $140+/mo on lower plans)
- Analyzes your site data across tools and surfaces priority recommendations
- Natural language query ("why did my traffic drop last month?")
- Does NOT generate content itself — links out to ContentShake AI (separate subscription)
- Available inside Site Audit, Position Tracking, Organic Research

### 8.3 Ahrefs AI
- AI-generated content descriptions in Keywords Explorer
- "AI Suggestions" in Site Audit (explains what each issue means and how to fix it)
- No dedicated AI assistant or content generation
- Relies on Cloudflare Workers AI for some features

### 8.4 AI Opportunity Summary

| Use Case | Best Tool |
|---------|-----------|
| AI-explained SEO issues | RankMind (native) |
| AI content generation | RankMind (free) vs SEMrush ContentShake ($) |
| AI writing assistant | RankMind or SEMrush (Google Docs plugin) |
| AI LLM visibility tracking | RankMind only |
| AI competitive summary | RankMind |
| AI keyword intent | RankMind or SEMrush |
| AI schema generation | RankMind only (free) |

---

## 9. Pricing & Access Model

### 9.1 SEMrush Pricing (2026)
| Plan | Price/mo (annual) | Limits |
|------|-------------------|--------|
| Pro | $129.95 | 5 projects, 500 keywords tracked, 10K results/report |
| Guru | $249.95 | 15 projects, 1500 keywords, historical data, content tools |
| Business | $499.95 | 40 projects, 5000 keywords, API access, white-label |
| Enterprise | Custom | Custom limits, custom integrations |

**Add-ons:** Copilot (+$119), Agency Growth Kit, Trends (+$289), Local (+$20/location)

### 9.2 Ahrefs Pricing (2026)
| Plan | Price/mo (annual) | Limits |
|------|-------------------|--------|
| Lite | $99 | 5 projects, 750 tracked keywords, 6mo history |
| Standard | $199 | 20 projects, 2000 keywords, 2yr history |
| Advanced | $399 | 50 projects, 5000 keywords, full history |
| Enterprise | $999+ | Unlimited projects, API access, SSO |

### 9.3 RankMind Pricing (Current)
| Plan | Price | Limits |
|------|-------|--------|
| Demo (current) | Free | All 17+ tools, Claude API usage billed per request |
| Planned: Starter | TBD | ~$29/mo |
| Planned: Pro | TBD | ~$79/mo |

**Cost advantage:** At the same functionality tier, RankMind will cost 50–80% less than SEMrush/Ahrefs because:
1. No proprietary data infrastructure costs
2. Claude API cost per request is minimal for standard queries
3. GSC/GA4 data is free via OAuth

---

## 10. RankMind Gaps & Roadmap to Match SEMrush/Ahrefs

### 10.1 Critical Gaps (Must-Have for Competitive Parity)

#### Gap 1: Real Backlink Data
**Current state:** AI-estimated  
**What's needed:** Integration with a real backlink data API  
**Options:**
- **DataForSEO Backlinks API** — $0.0002 per backlink, comprehensive index
- **Majestic API** — Trust Flow + Citation Flow, good historical data
- **SpyFu API** — Good for competitive backlink overlap
- **Moz API** — Domain Authority, spam score

**Build approach:**
```
/api/backlinks?domain=example.com
  → DataForSEO Backlinks Summary endpoint
  → DataForSEO Referring Domains endpoint
  → DataForSEO Anchors endpoint
  → Merge + return shaped data matching current UI structure
```
**Impact:** High — transforms backlink tools from demo to production-ready  
**Effort:** Medium — API integration + reshaping existing UI data contracts

---

#### Gap 2: Real Keyword Data
**Current state:** AI-estimated  
**What's needed:** Keyword volume and difficulty API  
**Options:**
- **DataForSEO Keywords Data API** — Google Keyword Planner data, $0.0005/keyword
- **Semrush API** — Expensive but most accurate
- **Ahrefs API** — Expensive
- **Keywords Everywhere API** — Affordable, good volume data

**Build approach:**
```
/api/keywords?seed=seo+tool&country=US
  → DataForSEO Keyword Suggestions endpoint
  → DataForSEO Search Volume endpoint (batch)
  → Claude to cluster/classify intent
  → Return merged dataset
```
**Impact:** High — makes keyword tools credible for business use  
**Effort:** Medium

---

#### Gap 3: Real Site Crawl
**Current state:** AI-estimated technical issues  
**What's needed:** Actual page-level crawl  
**Options:**
- **Screaming Frog API** — Not available
- **DataForSEO On-Page API** — Full page audit per URL
- **ScrapingBee / Apify** — General crawl, needs custom processing
- **Ahrefs API** — Site audit via API (Enterprise)

**Build approach:**
```
/api/crawl?url=https://example.com
  → Fetch page with fetchText()
  → Parse HTML: title, meta, h1, canonical, robots meta, image alts, links
  → POST to /api/ai for interpretation + recommendations
  → DataForSEO PageSpeed endpoint for real CWV
  → Return issues[] shaped to match existing Technical UI
```
**Impact:** High — technical SEO goes from demo to real  
**Effort:** High

---

#### Gap 4: Real Rank Tracking
**Current state:** AI-estimated positions  
**What's needed:** Daily real SERP position data  
**Options:**
- **DataForSEO SERP API** — Live SERP results, $0.0006/request
- **SerpAPI** — $0.001/search
- **ValueSERP** — $0.0005/search

**Build approach:**
```
POST /api/ranktrack
  body: { domain, keywords[], location }
  → Batch SERP queries (one per keyword per day)
  → Extract position for domain in results
  → Store in Vercel KV or Postgres (persistent daily snapshots)
  → Return trend data matching existing Rank Tracker UI
```
**Impact:** High — position tracking is a core daily-use feature  
**Effort:** High (needs persistent storage for history)

---

#### Gap 5: Persistent Storage (Database)
**Current state:** localStorage only — data lost on device change, not shareable  
**What's needed:** Server-side persistence  
**Options:**
- **Vercel Postgres** — Serverless PostgreSQL, $20+/mo
- **PlanetScale** — MySQL, serverless, free tier
- **Supabase** — Postgres + Auth + Realtime, generous free tier
- **Vercel KV** — Redis, good for sessions and rank snapshots

**What to store:**
- User accounts (replace in-memory store)
- Project/folder data (replace localStorage)
- Rank tracking history (keyword positions over time)
- GSC/GA4 data cache (avoid re-fetching on every visit)
- Tool analysis results cache

---

### 10.2 High-Value Additions (Differentiation Features)

#### Addition 1: AI Search Visibility Monitoring (Expand AEO)
RankMind already has the only AEO feature in the market. Expand it:
- **Scheduled monitoring:** Check LLM mentions weekly/monthly
- **Competitor comparison:** Which competitors get cited more in AI answers
- **Topic tracking:** Track specific queries in ChatGPT/Perplexity
- **Citation trend chart:** Month-over-month AI visibility
- **Optimization recommendations:** What to add to content to get cited more

#### Addition 2: Content Gap Finder (Real Data)
Currently AI-estimated. With real keyword data:
- Upload your domain → pull all GSC keywords (already done!)
- Pull competitor top keywords via DataForSEO
- Show real "missing keywords" with volume and difficulty

#### Addition 3: PDF/White-Label Reporting
Both SEMrush and Ahrefs offer this. Key for agencies:
- Generate branded PDF report for any tool
- Agency name + logo on reports
- Schedule monthly report emails

#### Addition 4: Alerts & Notifications
- Traffic drop alert (compare GSC week-over-week)
- New competitor detected (weekly keyword overlap check)
- Backlink lost/gained alerts
- Rank position change alerts

#### Addition 5: Chrome Extension
- On-page SEO metrics overlay on any page
- SERP overlay showing competitor metrics
- Quick keyword lookup from highlighted text

#### Addition 6: API Access
- Public REST API for developers
- Webhook support for alerts
- Zapier integration

---

### 10.3 Priority Build Order

```
Phase 1 — Data Credibility (1–3 months)
├── Integrate DataForSEO for real keyword volume
├── Integrate DataForSEO for real backlink data
├── Integrate PageSpeed API for real CWV
└── Replace in-memory user store with Supabase

Phase 2 — Real Crawl & Rank Tracking (3–6 months)
├── Build real site crawler using fetch + HTML parser
├── Integrate SERP API for rank tracking
├── Persist rank history in Postgres/KV
└── Scheduled weekly re-crawls

Phase 3 — Workflow & Agency Features (6–9 months)
├── PDF export for all reports
├── White-label domain support
├── Email alerts for rank/traffic changes
├── Expand AEO to scheduled monitoring
└── Team/multi-user workspace support

Phase 4 — Platform Expansion (9–12 months)
├── Chrome extension (SERP overlay + on-page)
├── Public API + webhooks
├── Zapier integration
├── Google Ads / PPC analysis
└── Social media monitoring
```

---

## 11. RankMind Technical Architecture

### 11.1 File Structure

```
C:\Users\1001192\rankmind\
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Root — loads AuthPage or RankMind
│   │   ├── api/
│   │   │   ├── ai/route.ts             # Claude claude-sonnet-4-6 proxy (json + text modes)
│   │   │   ├── gsc/route.ts            # Real GSC Search Analytics (5 parallel fetches)
│   │   │   ├── ga4/route.ts            # Real GA4 Data API (5 parallel fetches)
│   │   │   ├── scrape/route.ts         # Sitemap scraper → real URLs
│   │   │   └── auth/
│   │   │       ├── route.ts            # Google OAuth redirect
│   │   │       ├── callback/route.ts   # Stores tokens as httpOnly cookies
│   │   │       ├── signin/route.ts     # JWT session creation
│   │   │       ├── signup/route.ts     # User registration
│   │   │       ├── signout/route.ts    # Cookie clear
│   │   │       ├── me/route.ts         # Session verification
│   │   │       ├── forgot/route.ts     # Reset token generation
│   │   │       └── reset/route.ts      # Password update
│   │   └── globals.css
│   ├── components/
│   │   ├── RankMind.tsx                # ~2700 lines — all 17 tools + shell
│   │   └── AuthPage.tsx                # Sign in / up / forgot / reset
│   └── lib/
│       └── auth.ts                     # In-memory store, JWT, password hashing
├── package.json
└── .env.local
```

### 11.2 Component Architecture

```
RankMind (default export)
├── State: page, gscData, setGscData, ga4Data, setGa4Data, aeoData, setAeoData
├── useEffect: ?connected=true → auto-navigate to GSC/GA4
├── Sidebar: NAV_CATEGORIES → dot indicators → setPage
└── View: PAGES[page] → renders active component with PageProps

PageProps = {
  setPage, gscData, setGscData, ga4Data, setGa4Data, aeoData, setAeoData
}

PAGES = {
  dashboard: Dashboard, projects: Projects, gsc: GSC, ga4: GA4,
  aeo: AEO, keywords: Keywords, content: Content, backlinks: Backlinks,
  technical: Technical, sitemap: Sitemap, competitors: Competitors,
  rank: Rank, seowriter: SEOWriter, topics: Topics, onpage: OnPage,
  serp: SERPAnalyzer, audit: ContentAudit, intlinks: InternalLinks,
  brokenlinks: BrokenLinks, schemagen: SchemaGen, localseo: LocalSEO,
  linkbuilding: LinkBuilding, history: HistoryPage
}
```

### 11.3 AI Call Pattern

```typescript
// JSON mode — for structured tool output
const ai = async (prompt: string): Promise<any> => {
  const r = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, format: "json" }),
  });
  const t = await r.text();
  const match = t.match(/\{[\s\S]*\}/);
  return match ? JSON.parse(match[0]) : {};
};

// Text mode — for content generation (articles, schema, etc.)
const aiText = async (prompt: string): Promise<string> => {
  const r = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, format: "text" }),
  });
  return r.text();
};

// Nonce prevents duplicate outputs
const withNonce = (p: string) =>
  p + `\n[nonce:${Date.now().toString(36)}${Math.random()}]`;
```

### 11.4 Auth Flow

```
Sign Up → POST /api/auth/signup → SHA-256(password + salt) → in-memory Map
Sign In → POST /api/auth/signin → verify hash → JWT (jose, 7d) → httpOnly cookie
Auth Check → GET /api/auth/me → verify JWT → return {id, email, name}
Sign Out → POST /api/auth/signout → clear cookie

Forgot PW → POST /api/auth/forgot → generateResetToken(email)
           → 6-char uppercase hex, 15min TTL → return token in response
Reset PW  → POST /api/auth/reset → resetPassword(email, token, password)
           → validate token + expiry → SHA-256 new password → update Map

Google OAuth:
  /api/auth → redirect to Google (scopes: webmasters.readonly + analytics.readonly)
  /api/auth/callback → exchange code → store gsc_access_token + gsc_refresh_token
                    → httpOnly cookies → redirect /?connected=true
  Shell useEffect: detects ?connected=true → reads localStorage → auto-navigate
```

### 11.5 GSC + GA4 Real Data Flow

```
GSC:
  User input: domain (e.g. "example.com")
  Fetch: /api/gsc?site=https://example.com&days=28
  API: Google Search Analytics API (5 parallel requests)
    - summary (total clicks/impressions/ctr/position)
    - queries (top keywords)
    - pages (top pages)
    - daily (last 28 days time series)
    - previous period (for % change calculation)
  Returns: { domain, summary, queries[], pages[], daily[] }

GA4:
  User input: numeric property ID (e.g. "123456789")
  Fetch: /api/ga4?property=123456789
  API: Google Analytics Data API v1 (5 parallel requests)
    - sessions/users/conversions summary
    - daily time series
    - traffic sources
    - top pages
    - previous period for changes
  Returns: { domain, summary, sources[], pages[], daily[] }
```

### 11.6 Sitemap Scraping for AEO

```
GET /api/scrape?domain=example.com

Strategy:
  1. robots.txt → extract "Sitemap:" directives
  2. Try: /sitemap.xml, /sitemap_index.xml, /sitemap-index.xml,
          /wp-sitemap.xml, /post-sitemap.xml, /page-sitemap.xml
  3. Handle sitemap index: fetch up to 3 child sitemaps
  4. Fallback: scrape homepage href attributes for internal links

Returns: { urls: string[], count: number }
  - Max 60 URLs
  - Same-host filter
  - Deduplicated

AEO prompt injection:
  "REAL PAGES from {domain} sitemap (use ONLY these for cited_pages):
   https://example.com/page1
   https://example.com/page2
   ..."
```

---

## 12. Recommended Build Priorities

### For a Production-Ready SEO Platform

Based on the gap analysis, here is the exact order of work to make RankMind viable against SEMrush Lite / Ahrefs Lite:

#### Sprint 1 (Week 1–2): Data Credibility
1. **DataForSEO account** — get API key, test backlinks + keywords endpoints
2. **`/api/backlinks`** — wrap DataForSEO backlink summary + referring domains
3. **`/api/keywords`** — wrap DataForSEO keyword suggestions + volume
4. **Backlink Profile tool** — replace AI call with real API data
5. **Keyword Explorer tool** — replace AI call with real volume + KD

#### Sprint 2 (Week 3–4): Persistence
6. **Supabase** — create project, set up `users` table, `projects` table, `rank_history` table
7. **Replace in-memory auth** — migrate `src/lib/auth.ts` to Supabase `users`
8. **Projects page** — persist to Supabase instead of localStorage
9. **Session tokens** — store refresh tokens in Supabase, not just cookies

#### Sprint 3 (Week 5–6): Rank Tracking (Real)
10. **DataForSEO SERP API** — wrap for keyword position lookup
11. **`/api/ranktrack`** — store daily positions in Supabase `rank_history`
12. **Rank Tracker tool** — pull real positions, show real trend chart
13. **Cron job** — Vercel Cron to re-track all keywords daily

#### Sprint 4 (Week 7–8): Reporting
14. **PDF export** — `react-pdf` or `puppeteer` to screenshot each tool result
15. **Email reports** — Resend or SendGrid → weekly digest with top metrics
16. **White-label** — custom logo/color theming per workspace

---

### Quick Wins (Can Do Now, No New APIs)

| Feature | Effort | Impact |
|---------|--------|--------|
| Export results as CSV | Low | High |
| Share result as public link | Medium | High |
| More schema types (VideoObject, JobPosting) | Low | Medium |
| Bulk keyword input for Rank Tracker | Low | High |
| Dashboard date range selector | Medium | High |
| Expand AEO to track monthly LLM visibility trend | Medium | High |
| Mobile-responsive sidebar | Medium | Medium |
| Dark mode | Low | Medium |

---

*Document generated by Claude claude-sonnet-4-6 · RankMind internal documentation · May 2026*
