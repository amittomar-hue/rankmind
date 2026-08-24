# APP BUILDER DOCUMENT: SEO/AEO/GEO INTELLIGENCE PLATFORM
## Technical Specification & Development Blueprint v1.0

---

**Document Type:** Technical Specification / Product Requirements Document (PRD)  
**Based On:** Complete SEO, AEO & GEO Master Document 2026  
**Target Platform:** Web Application (SaaS) + Browser Extension + API  
**Date:** May 2026  
**Status:** Draft for Development Team Review  
**Note:** All paid third-party APIs removed. Only free/open-source tools used.

---

# TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [Module 1: Technical SEO Auditor](#3-module-1-technical-seo-auditor)
4. [Module 2: Content Intelligence Engine](#4-module-2-content-intelligence-engine)
5. [Module 3: AEO Optimization Suite](#5-module-3-aeo-optimization-suite)
6. [Module 4: GEO Intelligence Platform](#6-module-4-geo-intelligence-platform)
7. [Module 5: E-E-A-T Authority Builder](#7-module-5-ee-at-authority-builder)
8. [Module 6: Local SEO Manager](#8-module-6-local-seo-manager)
9. [Module 7: Schema Markup Generator](#9-module-7-schema-markup-generator)
10. [Module 8: Analytics & Reporting Dashboard](#10-module-8-analytics--reporting-dashboard)
11. [Module 9: AI Content Assistant](#11-module-9-ai-content-assistant)
12. [Module 10: Competitive Intelligence](#12-module-10-competitive-intelligence)
13. [Database Schema](#13-database-schema)
14. [API Specifications](#14-api-specifications)
15. [Frontend Architecture](#15-frontend-architecture)
16. [Integration Ecosystem](#16-integration-ecosystem)
17. [Security & Compliance](#17-security--compliance)
18. [Development Roadmap](#18-development-roadmap)
19. [Infrastructure & DevOps](#19-infrastructure--devops)
20. [Appendix: Data Models & Entity Diagrams](#20-appendix)

---

# 1. EXECUTIVE SUMMARY

## 1.1 Product Vision

Build an all-in-one **Search Intelligence Platform** that unifies traditional SEO, Answer Engine Optimization (AEO), and Generative Engine Optimization (GEO) into a single, actionable dashboard. The platform will automate audits, provide real-time optimization recommendations, track AI citations, and generate AI-ready content structures.

## 1.2 Target Users

- **SEO Managers & Strategists:** Need unified visibility across SEO/AEO/GEO
- **Content Teams:** Need AI-optimized content briefs and real-time scoring
- **Developers:** Need technical audit reports with actionable fixes
- **Marketing Executives:** Need executive dashboards showing Share of Synthesis and brand AI presence
- **Local Business Owners:** Need simplified local SEO + AEO management

## 1.3 Core Value Propositions

1. **Unified Visibility Score:** One metric combining SEO rankings, AEO snippet captures, and GEO citation rates
2. **Atomic Answer Generator:** AI-powered tool that extracts/generates 40-60 word answers from any content
3. **Share of Synthesis Tracker:** Monitoring of brand citations across ChatGPT, Perplexity, Gemini, Copilot
4. **Schema Auto-Generator:** One-click JSON-LD generation for all Schema.org types
5. **AI Crawler Monitor:** Track which AI bots visit your site and what they index

## 1.4 Platform Components

- **Web Application:** Primary dashboard and tool suite
- **Browser Extension:** Real-time SEO/AEO/GEO scoring while browsing
- **REST API:** Third-party integrations
- **WordPress Plugin:** Direct CMS integration

---

# 2. SYSTEM ARCHITECTURE OVERVIEW

## 2.1 High-Level Architecture

```
Client Layer
  Web App (Next.js) → Browser Extension → WordPress Plugin → API Clients

API Gateway (self-hosted nginx / Traefik)
  Rate limiting, Auth/AuthZ

Application Services (Node.js / Next.js API routes)
  Audit Svc · Content Svc · Schema Svc · Report Svc · User Svc

AI/ML Services
  Claude API (primary) · Groq Llama 3.3 70B (free fallback)

Data Layer
  PostgreSQL (primary) · Redis/Upstash (cache + sessions) · Elasticsearch (content indexing)

Crawler / Indexer
  Site Crawler · AI Bot Monitor · SERP Scraper · Content Fetcher · Broken Link Checker

External Free Integrations
  Google Search Console API · Google Analytics 4 API · DuckDuckGo (SERP) · Google Suggest
  Bing Suggest · Google News RSS · Yahoo News RSS · Reddit RSS · Freepik API (image gen)
  Pollinations.ai (free image fallback)

Notification Services
  Email (SMTP) · Webhooks
```

## 2.2 Technology Stack

### Backend
- **Primary API:** Node.js (Next.js API routes) + TypeScript
- **AI Services:** Claude API (Anthropic) + Groq Llama 3.3 70B (free fallback, 500K tokens/day)
- **Database:** PostgreSQL 15 (primary), Redis / Upstash (cache/sessions)
- **Search:** Elasticsearch 8.x (open source, content indexing)
- **Task Processing:** BullMQ (Node.js queues, open source)

### Frontend
- **Web App:** Next.js 16 (App Router) + React 19 + TypeScript
- **State Management:** Zustand + TanStack Query
- **UI:** Tailwind CSS + Radix UI + shadcn/ui
- **Charts:** Recharts + D3.js (open source)
- **Browser Extension:** Plasmo Framework (React-based, open source)

### Infrastructure
- **Cloud:** Vercel (frontend + API routes, free/hobby tier) + Railway/Render (background workers, free tier)
- **Containerization:** Docker (optional for self-hosted)
- **CI/CD:** GitHub Actions (free for public repos / 2000 min/month free)
- **Monitoring:** Grafana + Prometheus (open source) or Vercel Analytics (free tier)
- **CDN:** Cloudflare (free tier — WAF + DDoS + edge caching)

---

# 3. MODULE 1: TECHNICAL SEO AUDITOR

## 3.1 Feature: Comprehensive Site Crawler

### Requirements
- **Crawl Capacity:** Up to 100 URLs per project (free tier), expandable
- **Crawl Speed:** Sequential with rate limiting to avoid blocks
- **JavaScript Rendering:** Playwright/Puppeteer (open source, self-hosted)
- **Mobile Simulation:** Mobile-first viewport and user agent
- **AI Bot Simulation:** Simulate GPTBot, ClaudeBot, PerplexityBot user agents

### Data Points Collected Per URL
```typescript
interface CrawlData {
  url: string;
  statusCode: number;
  title: string;
  titleLength: number;
  metaDescription: string;
  metaDescriptionLength: number;
  h1: string[];
  h2: string[];
  h3: string[];
  headerHierarchyValid: boolean;
  canonicalUrl: string | null;
  canonicalSelfReferencing: boolean;
  robotsMeta: string | null;
  isIndexable: boolean;
  isFollowable: boolean;
  schemaMarkup: SchemaData[];
  schemaValid: boolean;
  schemaTypes: string[];
  wordCount: number;
  internalLinks: string[];
  externalLinks: string[];
  brokenLinks: string[];
  images: ImageData[];
  imagesWithoutAlt: number;
  pageSizeBytes: number;
  loadTimeMs: number;
  mobileFriendly: boolean;
  https: boolean;
  redirectChain: string[];
  redirectChainLength: number;
  isOrphan: boolean;
  crawlDepth: number;
  aiCrawlerAccessible: {
    gptBot: boolean;
    claudeBot: boolean;
    perplexityBot: boolean;
    googleExtended: boolean;
    bingbot: boolean;
  };
  contentInHtml: boolean;
}
```

### Audit Report Generation
- **Severity Levels:** Critical, Warning, Info
- **Issue Categories:** Indexability, Crawlability, Mobile Usability, Schema, Content Quality, Internal Linking, Security, AI Crawler Accessibility
- **Export Formats:** PDF, CSV, JSON

## 3.2 Feature: Core Web Vitals Monitor

### Real-Time Monitoring
- **Lighthouse CI Integration:** Automated testing via open-source lighthouse CLI
- **Alert Thresholds:** LCP > 2.5s, INP > 200ms, CLS > 0.15, TTFB > 800ms

### Historical Tracking
- 90-day rolling history, trend analysis, page-level and site-level aggregation

## 3.3 Feature: AI Crawler Monitor (GEO-Specific)

### Bot Detection & Analysis
- Detect GPTBot, ClaudeBot, PerplexityBot from server logs
- Robots.txt visual editor with AI bot allowance templates
- Warning system if AI crawlers are accidentally blocked
- Sitemap auto-generation

---

# 4. MODULE 2: CONTENT INTELLIGENCE ENGINE

## 4.1 Feature: Content Score & Optimization

### Real-Time Content Scoring Algorithm
```typescript
interface ContentScore {
  overall: number; // 0-100
  seo: number;
  aeo: number;
  geo: number;
  readability: number;
  keywordOptimization: number;
  titleOptimization: number;
  metaOptimization: number;
  headerStructure: number;
  internalLinking: number;
  imageOptimization: number;
  atomicAnswerPresence: number;
  questionBasedHeaders: number;
  snippetReadiness: number;
  faqSchemaPresence: number;
  semanticClarity: number;
  entityRecognition: number;
  citationWorthiness: number;
  authoritySignals: number;
  freshnessScore: number;
  comprehensiveness: number;
}
```

### Optimization Suggestions
- AI-generated specific fixes via Claude / Groq
- "Add an Atomic Answer under H2 'What is SEO?' — condense to 45-60 words"
- "H2 'Benefits' should be question-based: 'What are the benefits of SEO?'"

## 4.2 Feature: Atomic Answer Generator

### AI-Powered Extraction & Generation
- **Input:** URL, pasted text, or file upload (TXT, MD, CSV, JSON, DOCX)
- **Output:** Array of Atomic Answers (40-60 words, standalone, AI-generated via Claude/Groq)

```typescript
interface AtomicAnswer {
  question: string;
  answer: string; // 40-60 words
  confidence: number;
  suggestedHeader: string;
  wordCount: number;
  snippetProbability: number;
}
```

## 4.3 Feature: Content Brief Generator

### Automated Brief Creation
**Input:** Target keyword/topic + optional file upload  
**AI Provider:** Claude (primary) → Groq Llama 3.3 70B (free fallback)

```typescript
interface GeneratedContentBrief {
  title: string;
  contentType: 'pillar' | 'blog' | 'casestudy' | 'whitepaper' | 'ebook' | 'faq' | 'howto';
  targetWordCount: number;
  primaryKeyword: string;
  secondaryKeywords: string[];
  searchIntent: 'informational' | 'commercial' | 'transactional' | 'navigational';
  primaryQuestion: string;
  atomicAnswer: string;
  secondaryQuestions: string[];
  outline: {
    h1: string;
    sections: {
      h2: string;
      h3s: string[];
      contentGuidance: string;
      atomicAnswer?: string;
    }[];
  };
  recommendedSchema: string[];
  suggestedInternalLinks: { anchorText: string; targetUrl: string }[];
  primaryCTA: string;
}
```

### SERP Analysis Integration
- Scrape top 10 results via DuckDuckGo (free, no API key)
- Analyze structure, word count, schema usage
- Extract People Also Ask questions from real SERP

## 4.4 Feature: Content Refresh Optimizer

### Automated Refresh Recommendations
- Monitor content performance via Google Search Console API (free)
- Identify declining pages (traffic drop >20% over 90 days)
- Identify outdated statistics (regex date/year pattern matching)
- Identify broken external links via HEAD checks
- AI-generated refresh brief with specific update instructions

---

# 5. MODULE 3: AEO OPTIMIZATION SUITE

## 5.1 Feature: Featured Snippet Tracker

### SERP Feature Monitoring
```typescript
interface SnippetTracking {
  keyword: string;
  currentSnippetOwner: string | null;
  snippetType: 'paragraph' | 'list' | 'table' | null;
  snippetContent: string | null;
  yourPageRank: number | null;
  yourSnippetCapture: boolean;
  optimizationOpportunity: 'high' | 'medium' | 'low';
  recommendedFormat: 'paragraph' | 'list' | 'table';
}
```

**Data source:** DuckDuckGo scraper (free) + Google Search Console (free API)

## 5.2 Feature: People Also Ask (PAA) Explorer

### PAA Data Collection
- Scrape PAA from DuckDuckGo HTML results (free)
- Map PAA questions to your content coverage
- Auto-generate content suggestions for PAA gaps
- AI analysis via Claude / Groq

## 5.3 Feature: AI Overview Tracker

### Monitoring
- Detect AI Overview presence by scraping search results
- Identify which sources are cited
- Alert when brand appears/disappears
- AI-generated optimization recommendations

## 5.4 Feature: Voice Search Optimizer

### Voice Optimization Score
- Conversational keyword usage analysis (AI-powered)
- FAQ schema presence check
- Speakable schema implementation check

---

# 6. MODULE 4: GEO INTELLIGENCE PLATFORM

## 6.1 Feature: Share of Synthesis Tracker

### AI Platform Citation Monitoring
```typescript
interface GEOTracking {
  brandName: string;
  citations: {
    platform: 'chatgpt' | 'perplexity' | 'gemini' | 'copilot' | 'claude';
    totalQueries: number;
    brandMentions: number;
    citationRate: number;
    citationSentiment: 'positive' | 'neutral' | 'negative';
    citedUrls: string[];
    trend: 'improving' | 'stable' | 'declining';
  }[];
  overallShareOfSynthesis: number;
}
```

### Query Simulation System
- Automated querying of AI platforms with industry-relevant prompts
- Prompt categories: brand awareness, product comparisons, industry expertise, problem-solving
- Rule-based citation and brand mention extraction from responses
- AI-powered sentiment analysis via Claude / Groq

### Citation Alert System
- Weekly Share of Synthesis reports
- Competitor citation surge alerts
- Factual error detection in AI responses

## 6.2 Feature: AI Response Analyzer

### Brand Sentiment in AI
- Analyze what AI platforms say about your brand
- Sentiment scoring (positive, neutral, negative) via Claude / Groq
- Hallucination detection (factual accuracy check against your own content)
- Generate "AI Fact Sheet" — structured document optimized for AI consumption

## 6.3 Feature: Knowledge Graph Builder

### Entity Management
```typescript
interface EntityGraph {
  entities: {
    type: 'Organization' | 'Person' | 'Product' | 'Service' | 'Topic';
    name: string;
    description: string;
    schemaMarkup: object;
    sameAs: string[];
    relationships: { targetEntityId: string; relationship: string }[];
    aiVisibility: number;
    consistencyScore: number;
  }[];
  graphHealth: number;
}
```

## 6.4 Feature: GEO Content Optimizer

### Citation-Ready Content Analysis (AI-powered via Claude / Groq)
- Semantic clarity score
- Entity recognition
- Authority signals
- Comprehensiveness
- Freshness score

---

# 7. MODULE 5: E-E-A-T AUTHORITY BUILDER

## 7.1 Feature: Author Authority Manager

### Author Profile System
```typescript
interface AuthorProfile {
  name: string;
  bio: string;
  credentials: string[];
  expertiseAreas: string[];
  socialProfiles: { platform: string; url: string }[];
  schemaMarkup: PersonSchema;
  contentCount: number;
  aiMentions: number;
}
```

### Author Page Auto-Generator
- AI-generated optimized author pages (Claude / Groq)
- Person schema markup auto-generated
- E-E-A-T signals prominently displayed

## 7.2 Feature: Trust Signal Monitor

### Automated Trust Auditing (no paid APIs — scraping + AI analysis)
- Scan site for trust elements: About, Contact, Privacy Policy, Terms, Editorial Standards
- Trust score dashboard (0-100)
- Missing elements checklist with priority levels

## 7.3 Feature: Review & Reputation Manager

### Review Aggregation (free sources)
- Google Reviews via Google Business Profile API (free)
- Reddit brand mentions via Reddit RSS (free)
- Google News RSS (free)
- Sentiment analysis via Claude / Groq

---

# 8. MODULE 6: LOCAL SEO MANAGER

## 8.1 Feature: Google Business Profile (GBP) Manager

### Multi-Location GBP Dashboard (Google Business Profile API — free)
```typescript
interface GBPManager {
  locations: {
    businessName: string;
    address: string;
    profileCompletion: number;
    totalReviews: number;
    averageRating: number;
    reviewResponseRate: number;
    pendingResponses: Review[];
    unansweredQuestions: Question[];
    healthScore: number;
  }[];
}
```

### Review Response Automation
- AI-generated draft responses (Claude / Groq)
- Response templates by sentiment and category

## 8.2 Feature: Local Citation Builder

### Citation Monitoring (free sources)
- Track citations on major free directories
- NAP consistency checker (AI-powered)
- Missing citation opportunities

## 8.3 Feature: Local Rank Tracker

### Geo-Targeted Rank Tracking
- Track rankings by city, ZIP code using DuckDuckGo scraper
- Map pack tracking
- Local competitor analysis (AI-powered)

---

# 9. MODULE 7: SCHEMA MARKUP GENERATOR

## 9.1 Feature: Visual Schema Builder

### Drag-and-Drop Interface
- Visual node-based schema builder (no paid tools)
- Pre-built templates for all Schema.org types
- Real-time JSON-LD preview
- Schema validation (client-side against Schema.org spec)

### Supported Schema Types
**Priority 1 (Essential):** Organization, LocalBusiness, WebSite, Article/BlogPosting, BreadcrumbList, Person

**Priority 2 (AEO/GEO):** FAQPage, HowTo, QAPage, Speakable, VideoObject

**Priority 3 (E-Commerce):** Product, Offer, Review, AggregateRating

**Priority 4 (Advanced):** Event, Course, JobPosting, SoftwareApplication

### Auto-Implementation
- WordPress: Auto-inject via plugin
- Custom Sites: Copy-paste JSON-LD
- Google Tag Manager: Schema injection code snippet

## 9.2 Feature: Schema Health Monitor

### Automated Schema Auditing (no paid APIs)
- Crawl site and detect all schema markup
- Validate against Schema.org standards
- Detect conflicting schema on same page
- Monitor Search Console (free) for structured data errors

---

# 10. MODULE 8: ANALYTICS & REPORTING DASHBOARD

## 10.1 Feature: Unified Visibility Score

### The Master Metric
```typescript
interface UnifiedVisibilityScore {
  totalScore: number; // 0-1000

  seo: {
    score: number; // 0-400
    organicTraffic: number;    // from GSC (free)
    keywordRankings: number;   // from GSC (free)
    technicalHealth: number;   // from crawler
    contentQuality: number;    // from AI scoring
  };

  aeo: {
    score: number; // 0-300
    featuredSnippets: number;  // DuckDuckGo scraper
    paaCaptures: number;       // DuckDuckGo scraper
    aiOverviewCitations: number; // scraper
  };

  geo: {
    score: number; // 0-300
    shareOfSynthesis: number;  // AI platform simulation
    brandSentimentInAI: number; // Claude / Groq analysis
    citationConsistency: number; // NAP checker
    entityStrength: number;    // schema + external mentions
  };

  trend: 'improving' | 'stable' | 'declining';
}
```

### Score Visualization
- Radial chart showing three pillars (Recharts)
- Trend line over time
- Competitor comparison overlay

## 10.2 Feature: Executive Dashboard

### C-Suite View (all data from free sources)
- GSC: clicks, impressions, CTR, average position
- GA4: sessions, users, bounce rate, conversions
- AI Visibility: Share of Synthesis, brand mentions
- Traffic value estimate (clicks × estimated CPC from keyword research)

### Automated Reporting
- Monthly SEO Report: auto-generated PDF
- Weekly Alert Digest: critical issues, ranking changes
- Custom Report Builder: drag-and-drop widget builder

## 10.3 Feature: Alert & Notification System

### Alert Types
- Critical: Site down, massive traffic drop
- Warning: Ranking drop >10 positions, Core Web Vitals degradation
- Opportunity: New featured snippet available, competitor weakness
- Info: Content refresh due, schema update available

### Notification Channels
- In-app notifications
- Email (SMTP — free via Resend free tier or Nodemailer)
- Webhooks (custom integrations)

---

# 11. MODULE 9: AI CONTENT ASSISTANT

## 11.1 Feature: Smart Content Editor

### AI-Powered Writing Environment (Claude + Groq free fallback)
- Real-time SEO/AEO/GEO scoring as you type
- Atomic Answer auto-generation from draft text
- Header optimization suggestions
- Internal link suggestions
- Image alt-text suggestions
- Meta title/description auto-generation
- **File upload:** TXT, MD, CSV, JSON, DOCX → AI extracts topic and audience

### Content Templates Library
- Pillar page, Blog post, FAQ page, Comparison page, How-to guide
- Case Study, Whitepaper, Ebook
- Each pre-loaded with optimal structure for AEO/GEO

## 11.2 Feature: AI Content Generator (Human-in-the-Loop)

### Generation Capabilities (Claude / Groq Llama 3.3 70B — free fallback)
- **Expand:** Bullet points → full paragraphs
- **Summarize:** Long text → Atomic Answers
- **Rephrase:** Optimize existing content for keywords
- **Generate:** Draft sections based on brief outline
- **Convert:** Video transcripts → optimized articles

### Safety Controls
- Fact-Check Mode: Cross-reference against source material (AI-powered)
- Tone Consistency: Match brand voice guidelines
- E-E-A-T Guardrails: Flag content lacking experience signals
- Human Approval: All AI-generated content requires review before publishing

## 11.3 Feature: Content Calendar & Workflow

### Editorial Calendar
- Visual calendar view (drag-and-drop)
- Content status tracking: idea → brief → draft → review → scheduled → published
- Team assignment and deadline reminders

### Publish to CMS
- **WordPress:** REST API (`/wp-json/wp/v2/posts` for blog/case study, `/wp-json/wp/v2/pages` for whitepaper/ebook)
- **Webflow, Ghost:** Webhook-based publish

---

# 12. MODULE 10: COMPETITIVE INTELLIGENCE

## 12.1 Feature: Competitor Monitoring (all free sources)

```typescript
interface CompetitorProfile {
  domain: string;
  organicTrafficEstimate: number; // from AI analysis of GSC-equivalent data

  // SEO Metrics (via DuckDuckGo scraper + AI)
  topKeywords: KeywordRanking[];
  contentStrategy: ContentAnalysis;
  technicalHealth: number;

  // AEO Metrics (via SERP scraper)
  featuredSnippetsOwned: number;
  paaAppearances: number;
  schemaTypesUsed: string[];

  // GEO Metrics (via AI simulation)
  shareOfSynthesis: number;
  aiCitationRate: number;

  // Content gaps
  contentGaps: string[];
  yourAdvantages: string[];
}
```

### Data Sources (all free)
- DuckDuckGo SERP scraper: keyword rankings, featured snippets
- Google News RSS: brand mentions, PR activity
- Reddit RSS: community discussion, brand sentiment
- AI analysis (Claude / Groq): gap analysis, strategy insights
- Google Search Console (your own data): comparative metrics
- Keyword Research API (algorithmic, no external service)

## 12.2 Feature: Gap Analysis Engine

### Content Gap Finder
- Compare your content inventory to competitors via SERP scraping
- Priority scoring: search volume × competitor traffic × business relevance × AI citation potential
- Export to content brief generator

### Keyword Gap Analysis
- Keywords competitors rank for that you don't (from SERP scraper)
- AI-powered intent classification and prioritization

---

# 13. DATABASE SCHEMA

## 13.1 Core Entities

### Users & Organizations
```sql
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    plan_tier VARCHAR(50) DEFAULT 'free',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(200),
    role VARCHAR(50) DEFAULT 'member',
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    query_count INTEGER DEFAULT 0,
    plan VARCHAR(50) DEFAULT 'free'
);

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) NOT NULL,
    protocol VARCHAR(10) DEFAULT 'https',
    primary_language VARCHAR(10) DEFAULT 'en',
    industry VARCHAR(100),
    gsc_property TEXT,
    ga4_property_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_crawl TIMESTAMP
);
```

### Crawl & Technical Data
```sql
CREATE TABLE crawl_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id),
    status VARCHAR(50) DEFAULT 'pending',
    urls_crawled INTEGER DEFAULT 0,
    errors_found INTEGER DEFAULT 0,
    warnings_found INTEGER DEFAULT 0,
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE TABLE crawl_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES crawl_sessions(id),
    project_id UUID REFERENCES projects(id),
    url TEXT NOT NULL,
    status_code INTEGER,
    title TEXT,
    title_length INTEGER,
    meta_description TEXT,
    h1 TEXT[],
    h2 TEXT[],
    word_count INTEGER,
    is_indexable BOOLEAN,
    schema_markup JSONB,
    schema_types TEXT[],
    images_without_alt INTEGER,
    load_time_ms INTEGER,
    mobile_friendly BOOLEAN,
    https_enabled BOOLEAN,
    redirect_chain TEXT[],
    is_orphan BOOLEAN,
    ai_crawler_accessible JSONB,
    crawled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE technical_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id),
    url TEXT,
    issue_type VARCHAR(100) NOT NULL,
    category VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    recommendation TEXT,
    status VARCHAR(50) DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);
```

### Content & Keywords
```sql
CREATE TABLE keywords (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id),
    keyword TEXT NOT NULL,
    search_volume INTEGER,
    keyword_difficulty INTEGER,
    search_intent VARCHAR(50),
    target_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE keyword_rankings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keyword_id UUID REFERENCES keywords(id),
    project_id UUID REFERENCES projects(id),
    rank INTEGER,
    previous_rank INTEGER,
    rank_change INTEGER,
    url_ranking TEXT,
    checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE content_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id),
    url TEXT NOT NULL,
    title TEXT,
    content_type VARCHAR(50),
    word_count INTEGER,
    primary_keyword TEXT,
    content_score JSONB,
    atomic_answers JSONB[],
    schema_types TEXT[],
    status VARCHAR(50) DEFAULT 'published',
    published_at TIMESTAMP,
    last_updated TIMESTAMP,
    traffic_30d INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE content_briefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id),
    title TEXT NOT NULL,
    content_type VARCHAR(50),
    target_word_count INTEGER,
    primary_keyword TEXT,
    secondary_keywords TEXT[],
    search_intent VARCHAR(50),
    outline JSONB,
    recommended_schema TEXT[],
    status VARCHAR(50) DEFAULT 'draft',
    due_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### AEO & GEO Data
```sql
CREATE TABLE featured_snippets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id),
    keyword TEXT NOT NULL,
    snippet_type VARCHAR(50),
    current_owner TEXT,
    snippet_content TEXT,
    your_capture BOOLEAN DEFAULT FALSE,
    optimization_opportunity VARCHAR(20),
    checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE paa_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id),
    keyword TEXT NOT NULL,
    question TEXT NOT NULL,
    answer TEXT,
    source_url TEXT,
    your_content_covers BOOLEAN DEFAULT FALSE,
    appeared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE geo_citations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id),
    platform VARCHAR(50) NOT NULL,
    query TEXT NOT NULL,
    brand_mentioned BOOLEAN,
    citation_sentiment VARCHAR(20),
    cited_urls TEXT[],
    response_text TEXT,
    factual_accuracy_score INTEGER,
    hallucination_detected BOOLEAN,
    checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE share_of_synthesis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id),
    platform VARCHAR(50),
    total_queries INTEGER,
    brand_mentions INTEGER,
    citation_rate DECIMAL(5,4),
    trend VARCHAR(20),
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Local SEO
```sql
CREATE TABLE gbp_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id),
    business_name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    country TEXT,
    phone TEXT,
    website TEXT,
    categories TEXT[],
    hours JSONB,
    reviews_count INTEGER,
    average_rating DECIMAL(3,2),
    profile_completion INTEGER,
    health_score INTEGER,
    last_synced TIMESTAMP
);

CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID REFERENCES gbp_locations(id),
    platform VARCHAR(50) NOT NULL,
    reviewer_name TEXT,
    rating INTEGER,
    review_text TEXT,
    review_date TIMESTAMP,
    response_text TEXT,
    response_date TIMESTAMP,
    sentiment VARCHAR(20),
    status VARCHAR(50) DEFAULT 'new',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 13.2 Cache Layer (Redis / Upstash)

```
Key patterns:
  user:{id}             → DbUser JSON
  email_to_id:{email}   → userId string
  users:all             → Set of user IDs
  reset:{token}         → { userId, expiresAt }
  activity:all          → List of ActivityEvent JSON
  cache:ai:{hash}       → AI response (1h TTL)
  cache:gsc:{domain}    → GSC data (1h TTL)
  cache:serp:{keyword}  → SERP results (6h TTL)
```

---

# 14. API SPECIFICATIONS

## 14.1 REST API Endpoints

### Authentication
```
POST /api/auth/signup
POST /api/auth/signin
POST /api/auth/signout
POST /api/auth/forgot
POST /api/auth/reset
GET  /api/auth/me
GET  /api/auth              → Google OAuth initiation
GET  /api/auth/callback     → Google OAuth callback
```

### Projects
```
GET    /api/projects
POST   /api/projects
GET    /api/projects/:id
PUT    /api/projects/:id
DELETE /api/projects/:id
POST   /api/projects/:id/crawl
GET    /api/projects/:id/crawls
```

### Technical SEO
```
GET /api/techaudit?domain=   → crawl + issue detection
GET /api/onpage?url=&keyword= → single-page analysis
GET /api/checklinks?domain=  → broken link HEAD checks
GET /api/scrape?domain=      → sitemap URL discovery
```

### Content & AI
```
POST /api/ai                 → Claude/Groq proxy (JSON mode)
POST /api/imagegen           → Freepik → Pollinations fallback
GET  /api/kwsuggest?seed=    → Google + Bing Suggest
GET  /api/kwresearch?seed=   → Algorithmic keyword intelligence
```

### SERP & AEO
```
GET /api/serpcheck?keyword=  → DuckDuckGo top 10 organic
```

### Analytics (via Google OAuth)
```
GET /api/gsc?site=&days=     → Search Console Analytics
GET /api/gsc/sites           → List GSC properties
GET /api/ga4?property=       → GA4 Data API
```

### Brand & GEO
```
GET /api/brandmention?brand= → Google News + Yahoo + Reddit RSS
```

### Admin
```
GET    /api/admin            → users + activity (Bearer auth)
DELETE /api/admin            → delete user + data
```

## 14.2 Webhook Events

```typescript
interface WebhookPayload {
  event: string;
  timestamp: string;
  project_id: string;
  data: object;
}

// Available Events:
// crawl.completed · ranking.changed · snippet.captured · snippet.lost
// geo.citation.new · review.new · content.refresh_due · technical.issue.critical
```

---

# 15. FRONTEND ARCHITECTURE

## 15.1 Application Structure

```
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx                  # Main shell
│   └── api/                      # API routes
├── components/
│   ├── RankMind.tsx              # All tool UIs (single-file pattern)
│   ├── AuthPage.tsx              # Sign-in / sign-up / forgot / reset
│   └── ui/                       # Shared UI primitives
├── lib/
│   ├── auth.ts                   # JWT sessions, password reset
│   ├── db.ts                     # Redis abstraction (user CRUD)
│   ├── activity.ts               # Activity logging
│   └── page-parser.ts            # HTML scraping utilities
└── styles/                       # Global styles
```

## 15.2 Navigation Structure

```
OVERVIEW:         Dashboard · My Sites · History
KEYWORD RESEARCH: Keywords · Sitemap
CONTENT:          SEO Content Agent · SEO Writer · Topics · Schema Generator
LINK BUILDING:    Link Building · Link Intersect
COMPETITORS:      Market Explorer · Ad Research
MORE:             Local SEO · Brand Monitor
```

## 15.3 Key UI Primitives (inline-style pattern)

- `pill(text, color)` — colored badge chip
- `Field` — label + children wrapper
- `TI` — text input (accepts `rows` for textarea)
- `Btn` — button with variant/small/disabled props
- `Card` — white border-radius box
- `SH` — section heading with optional action
- `Bar` — horizontal percentage bar
- `Metric` — stat tile (label + value + color + trend)
- `CopyBtn` — clipboard copy button
- `Toggle` — radio-style button group
- `Tabs` — tab bar
- `ScoreRing` — SVG circular progress ring
- `LoadingBar` — animated dots + phase text
- `IssueRow` — issue row (severity, category, detail, fix)

## 15.4 Browser Extension Architecture

```
extension/
├── manifest.json               # v3 manifest
├── background/                 # Service worker
├── content/                    # Page score overlay
├── popup/                      # Extension popup UI
└── shared/                     # Utilities
```

### Extension Features
- Page Score Overlay (SEO/AEO/GEO score for any visited page)
- Schema Inspector (view all schema on current page)
- Header Analyzer (visual header hierarchy)
- Quick Audit (60-second audit on current page)

---

# 16. INTEGRATION ECOSYSTEM

## 16.1 Free Integrations (Phase 1)

### Google Search Console (free API)
- OAuth 2.0 authentication
- Query data: clicks, impressions, CTR, position
- URL inspection API
- Index coverage data
- Structured data report

### Google Analytics 4 (free API)
- OAuth authentication
- Organic traffic metrics, conversions, user behavior
- Custom dimension mapping

### Google Business Profile API (free)
- Location management
- Review data
- Post scheduling
- Q&A management

### Free Data Sources
- **DuckDuckGo:** SERP scraping (no API key needed)
- **Google Suggest + Bing Suggest:** Keyword suggestions (no API key)
- **Google News RSS:** Brand mention tracking (free)
- **Yahoo News RSS:** Brand mentions (free)
- **Reddit RSS:** Community discussion tracking (free)
- **Freepik API:** Image generation (free tier, 100/day)
- **Pollinations.ai:** Image generation fallback (unlimited free)
- **Groq API:** Llama 3.3 70B, 500K tokens/day free

### WordPress Plugin
- REST API communication with platform
- Auto-inject schema markup
- Real-time content scoring in Gutenberg
- Auto-generate meta tags, XML sitemap
- AI crawler robots.txt management
- Publish blog posts, pages, case studies via `/wp-json/wp/v2/`

## 16.2 Optional Paid Integrations (Phase 2 — user-provided keys)

The platform supports user-supplied API keys for enhanced data. No keys are required for core functionality.

- **Claude API (Anthropic):** Higher quality AI (user provides key; Groq free fallback always available)
- **Any custom WordPress site:** User provides URL + Application Password

## 16.3 Webhook & Zapier Integration

### Outbound Webhooks
- Configure custom webhook URLs per event type
- HMAC signature verification
- Retry logic with exponential backoff

---

# 17. SECURITY & COMPLIANCE

## 17.1 Authentication & Authorization

### Authentication
- **JWT Tokens:** Access token (7 days), signed with `NEXTAUTH_SECRET` via `jose`
- **Google OAuth 2.0:** webmasters.readonly + analytics.readonly scopes
- **Session Cookie:** `rm_session` httpOnly
- **Password Hashing:** bcrypt or SHA-256 with salt
- **Password Reset:** Token-based (6-char, 15-min TTL)

### Authorization (RBAC)
```typescript
type Role = 'owner' | 'admin' | 'editor' | 'viewer';
```

## 17.2 Data Security

### Encryption
- **In Transit:** TLS 1.3 (provided by Vercel / Cloudflare)
- **At Rest:** Upstash Redis encryption at rest (included)
- **Sensitive Fields:** API keys stored encrypted

### API Security
- Per-user daily quota (50 AI queries/day on free tier)
- Rate limiting per endpoint (middleware)
- Input validation and sanitization
- CORS restricted to own domain

### Application Security
- OWASP Top 10 protection
- SQL injection prevention (parameterized queries)
- XSS protection (input sanitization, CSP headers)
- CSRF tokens for state-changing operations

## 17.3 Free Security Tools

- **npm audit:** Dependency vulnerability scanning (built-in, free)
- **ESLint security plugins:** Static analysis (free)
- **GitHub Dependabot:** Automated dependency updates (free)
- **Cloudflare WAF:** Free tier WAF rules

---

# 18. DEVELOPMENT ROADMAP

## 18.1 Phase 1: MVP (Months 1-3) — All Free

### Sprint 1-2: Foundation
- [ ] Next.js project scaffolding
- [ ] Authentication system (JWT + Google OAuth)
- [ ] Upstash Redis integration
- [ ] Basic project management
- [ ] User roles and permissions

### Sprint 3-4: Technical SEO Core
- [ ] Site crawler (Node.js + page-parser utilities)
- [ ] Technical issue detection engine
- [ ] Broken link checker (HEAD requests)
- [ ] On-page SEO analysis
- [ ] AI crawler detection (robots.txt parser)

### Sprint 5-6: Content Intelligence
- [ ] Content scoring algorithm v1 (AI-powered via Claude/Groq)
- [ ] Atomic Answer generator
- [ ] Content brief generator with file upload
- [ ] WordPress publish integration

### Sprint 7-8: AEO & Rank Tracking
- [ ] Keyword management (Google Suggest + Bing Suggest)
- [ ] Rank tracking (DuckDuckGo scraper)
- [ ] SERP feature detection (snippets, PAA)
- [ ] GSC integration (real data)
- [ ] GA4 integration (real data)

### Sprint 9-10: GEO Foundation
- [ ] AI query simulation (Claude/Groq)
- [ ] Share of Synthesis calculation
- [ ] Brand mention monitoring (News/Reddit RSS)
- [ ] GEO scoring algorithm

### Sprint 11-12: Dashboard & Reporting
- [ ] Unified Visibility Score (SEO+AEO+GEO combined)
- [ ] Executive dashboard
- [ ] Alert system
- [ ] Email notifications (SMTP via Resend free tier)
- [ ] Browser extension v1

## 18.2 Phase 2: Scale (Months 4-6)

### Month 4: Advanced Features
- [ ] Schema markup generator (visual builder)
- [ ] Local SEO module (GBP API integration)
- [ ] E-E-A-T authority builder
- [ ] Review management (GBP API, RSS)
- [ ] Content refresh optimizer

### Month 5: Intelligence
- [ ] Competitor monitoring engine
- [ ] Gap analysis automation
- [ ] Market share calculations
- [ ] Advanced analytics

### Month 6: Ecosystem
- [ ] Webhook system
- [ ] WordPress plugin (full-featured)
- [ ] Mobile-responsive optimization
- [ ] History and audit trails

## 18.3 Phase 3: AI-Native (Months 7-9)

- [ ] Custom scoring models for snippet win prediction
- [ ] Entity extraction and knowledge graph
- [ ] Predictive ranking models
- [ ] Automated content refresh scheduling
- [ ] Smart alert thresholds

## 18.4 Phase 4: Platform (Months 10-12)

- [ ] Community templates sharing
- [ ] Multi-language support
- [ ] Mobile app (React Native)
- [ ] White-label capabilities
- [ ] Public benchmark API (industry averages)

---

# 19. INFRASTRUCTURE & DEVOPS

## 19.1 Deployment Architecture (Free/Low-Cost)

```
Cloudflare (free tier)
  Edge caching, DDoS protection, WAF

Vercel (free/hobby or pro)
  Next.js web app + API routes
  Automatic HTTPS, edge functions

Upstash Redis (free tier — 10K req/day)
  Cache, sessions, user data, activity logs

PostgreSQL (Railway free tier or Supabase free tier)
  Projects, crawl data, content, keywords

GitHub Actions (free — 2000 min/month)
  CI/CD pipeline

Object Storage: Cloudflare R2 (free tier — 10GB)
  Report PDFs, exported CSVs, user assets
```

## 19.2 CI/CD Pipeline (GitHub Actions — free)

```yaml
stages:
  - lint (ESLint + TypeScript check)
  - test (Jest unit tests)
  - security-scan (npm audit, github dependabot)
  - build (Next.js production build)
  - deploy-preview (Vercel preview URL)
  - deploy-production (Vercel production, on merge to main)
```

## 19.3 Monitoring & Observability (Free Tools)

### Metrics
- **Vercel Analytics:** Request rate, latency, error rate (free tier)
- **Upstash:** Redis usage metrics (built-in, free)
- **Cloudflare:** Traffic, DDoS, WAF events (free dashboard)

### Logging
- **Vercel Logs:** API route logs, function errors (free)
- **GitHub Issues:** Bug tracking (free)
- Structured JSON logging with correlation IDs

### Error Tracking
- **Vercel Error Tracking:** Built-in (free tier)
- Console error logging with alerting via webhook to Slack/Discord (free)

## 19.4 Backup & Disaster Recovery

### Database Backups
- **Supabase/Railway:** Automated daily backups (included in free tier)
- **Upstash Redis:** Point-in-time recovery (paid add-on) or daily export script
- **Cloudflare R2:** Versioned object storage

### Recovery Procedure
- RPO (Recovery Point Objective): 24 hours
- RTO (Recovery Time Objective): 2 hours
- Procedure: restore from latest backup, run smoke tests, notify users

---

# 20. APPENDIX: DATA MODELS & ENTITY DIAGRAMS

## 20.1 Entity Relationship (Core)

```
organizations ──< users
organizations ──< projects
projects ──< crawl_sessions ──< crawl_data
projects ──< keywords ──< keyword_rankings
projects ──< content_pages
projects ──< content_briefs
projects ──< featured_snippets
projects ──< paa_data
projects ──< geo_citations
projects ──< share_of_synthesis
projects ──< gbp_locations ──< reviews
```

## 20.2 API Rate Limits

| Endpoint Category | Free | Pro |
|---|---|---|
| AI queries (Claude/Groq) | 50/day | 500/day |
| SERP checks | 100/day | 1,000/day |
| Crawl triggers | 5/month | 50/month |
| Brand mentions | 50/day | 500/day |
| Image generation | 10/day (Freepik) | Unlimited (Pollinations) |
| Projects | 3 | Unlimited |
| Users | 1 | 10 |

## 20.3 Error Codes

```typescript
enum ErrorCode {
  AUTH_INVALID_CREDENTIALS = 'AUTH_001',
  AUTH_TOKEN_EXPIRED = 'AUTH_002',
  AUTH_UNAUTHORIZED = 'AUTH_003',
  PROJECT_NOT_FOUND = 'PROJ_001',
  PROJECT_LIMIT_REACHED = 'PROJ_002',
  CRAWL_IN_PROGRESS = 'CRAW_001',
  CONTENT_URL_UNREACHABLE = 'CONT_001',
  CONTENT_GENERATION_FAILED = 'CONT_003',
  AI_QUOTA_EXCEEDED = 'AI_001',
  RATE_LIMIT_EXCEEDED = 'RATE_001',
  INTERNAL_ERROR = 'GEN_001',
  VALIDATION_ERROR = 'GEN_002',
}
```

## 20.4 Environment Variables (All Free)

```bash
# Application
NODE_ENV=production
APP_URL=https://your-app.vercel.app

# AI (Claude is optional — Groq free fallback always works)
ANTHROPIC_API_KEY=sk-ant-...          # optional, paid
GROQ_API_KEY=gsk_...                  # free, 500K tokens/day

# Google OAuth (free)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://your-app.vercel.app/api/auth/callback

# Session
NEXTAUTH_SECRET=...

# Database (Upstash free tier)
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...

# Image Generation (free tiers)
FREEPIK_API_KEY=FPSX...               # free tier
# Pollinations.ai requires no key (always free fallback)

# Admin
ADMIN_SECRET=...

# Email (optional — Resend free: 3000 emails/month)
RESEND_API_KEY=re_...
```

---

# CONCLUSION

This App Builder Document is built **entirely on free and open-source tools**. No paid third-party SEO APIs (Ahrefs, Semrush, Moz) are required. All data comes from:

1. **Google's own free APIs** — Search Console, Analytics 4, Business Profile
2. **Free scraping** — DuckDuckGo SERP, Google/Bing Suggest, News RSS, Reddit RSS
3. **Free AI** — Groq Llama 3.3 70B (500K tokens/day free) as the always-on fallback
4. **Free infrastructure** — Vercel, Upstash, Cloudflare, GitHub Actions
5. **Free image generation** — Freepik free tier + Pollinations.ai (unlimited)

**Claude API (Anthropic)** is an optional enhancement — when provided, it delivers higher-quality AI responses, but all features work without it using Groq.

**Development Priority:** Unified Visibility Score (SEO+AEO+GEO combined metric) is the key differentiator and North Star throughout development.

**Success Metrics:**
- Content scores improve by average 25 points within 90 days
- 80% of users win at least 1 new featured snippet within 6 months
- GEO citation rate increases 50% for active users within 6 months
- NPS score >50, Monthly churn <5%

---

*This specification is designed to be handed directly to a development team. All paid API dependencies have been removed. Every data source, tool, and infrastructure component used is either free, open-source, or has a sufficient free tier for early-stage operation.*
