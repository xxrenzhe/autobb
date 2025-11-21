# AutoBB Codebase Architecture Analysis

## Executive Summary

This is a **Next.js/TypeScript SaaS application** for AI-powered Google Ads campaign management. The system integrates with Google Ads API and AI models (Vertex AI/Gemini) to automate creative generation and campaign optimization.

**Tech Stack:**
- Framework: Next.js 14 (App Router)
- Language: TypeScript
- Database: SQLite (better-sqlite3)
- APIs: Google Ads API, Gemini API, Vertex AI
- Deployment: Supports Docker, Vercel

---

## 1. CREATIVE GENERATION DATA FLOW

### 1.1 Core Generation Pipeline

```
User Request
    ↓
POST /api/offers/[id]/generate-ad-creative
    ↓
generateAdCreative() [ad-creative-generator.ts]
    ↓
AI Model (Vertex AI or Gemini API)
    ↓
parseAIResponse() - Extract & validate JSON
    ↓
createAdCreative() [ad-creative.ts]
    ↓
Database: ad_creatives table
```

### 1.2 Generation Logic Files

**Primary Files:**
1. **src/lib/ad-creative-generator.ts** (514 lines)
   - `generateAdCreative()` - Single creative generation with caching
   - `generateAdCreativesBatch()` - Parallel generation of 1-3 variants
   - `buildAdCreativePrompt()` - Constructs AI prompt
   - `parseAIResponse()` - Parses and validates AI JSON response
   - `getAIConfig()` - Fetches Vertex AI or Gemini config from database

2. **src/lib/ad-creative.ts** (631 lines)
   - Database models and scoring system
   - `createAdCreative()` - Saves creative to DB with scoring
   - `calculateAdCreativeScore()` - 5-dimensional scoring (relevance, quality, engagement, diversity, clarity)
   - CRUD operations for ad_creatives table

3. **src/app/api/offers/[id]/generate-ad-creative/route.ts** (225 lines)
   - REST endpoint for generation
   - Validates user auth and offer status
   - Implements 3-generation quota per offer per round
   - Batch mode support (up to 3 parallel creatives)

### 1.3 Generated Creative Components

**Headlines:** 15 headlines, each ≤30 chars
- Multi-type diversity (brand, features, urgency, CTAs)
- Must include ≥3 with numbers/percentages
- ≥2 with urgency signals (限时, 今日, etc.)

**Descriptions:** 4 descriptions, each ≤90 chars
- Detailed value proposition
- ≥2 with explicit CTAs
- Focus on benefits and user interests

**Keywords:** 10-15 keywords
- Brand words, product words, solution words
- Competitor words, long-tail keywords

**Optional:**
- Callouts: 4-6 elements (≤25 chars each)
- Sitelinks: 4 site links with text, URL, description

### 1.4 AI Configuration Flow

**Priority Order:**
1. User-specific settings in `system_settings` table (user_id IS NOT NULL)
2. Global settings in `system_settings` table (user_id IS NULL)

**Configuration Keys:**
```
User-specific (priority):
- use_vertex_ai (boolean)
- vertex_ai_model (model name)
- gcp_project_id
- gcp_location
- gemini_api_key
- gemini_model

Global fallback:
- VERTEX_AI_PROJECT_ID
- VERTEX_AI_LOCATION
- VERTEX_AI_MODEL
- GEMINI_API_KEY
- GEMINI_MODEL
```

---

## 2. DATABASE SCHEMA

### 2.1 Core Tables for Creative Management

#### `ad_creatives` Table
```sql
CREATE TABLE ad_creatives (
  id INTEGER PRIMARY KEY,
  offer_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  
  -- Content (stored as JSON)
  headlines TEXT NOT NULL,        -- JSON array
  descriptions TEXT NOT NULL,     -- JSON array
  keywords TEXT,                  -- JSON array
  callouts TEXT,                  -- JSON array
  sitelinks TEXT,                 -- JSON array
  
  -- URL Configuration
  final_url TEXT NOT NULL,
  final_url_suffix TEXT,
  path_1 TEXT,
  path_2 TEXT,
  
  -- Scoring (5-dimensional)
  score REAL,
  score_breakdown TEXT,           -- JSON: {relevance, quality, engagement, diversity, clarity}
  score_explanation TEXT,
  
  -- Generation Metadata
  generation_round INTEGER DEFAULT 1,  -- 1-3
  theme TEXT,
  ai_model TEXT,                  -- 'vertex-ai:...' or 'gemini-api:...'
  is_selected INTEGER DEFAULT 0,
  
  -- Approval & Sync Status
  is_approved INTEGER DEFAULT 0,
  approved_by INTEGER,
  approved_at TEXT,
  ad_group_id INTEGER,
  ad_id TEXT,
  creation_status TEXT,           -- 'draft', 'pending', 'synced', 'failed'
  creation_error TEXT,
  last_sync_at TEXT,
  
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  
  FOREIGN KEY (offer_id) REFERENCES offers(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### `offers` Table
```sql
CREATE TABLE offers (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  
  url TEXT NOT NULL,
  brand TEXT NOT NULL,
  product_name TEXT,
  category TEXT,
  target_country TEXT NOT NULL,
  affiliate_link TEXT,
  
  -- Extracted Information
  brand_description TEXT,
  unique_selling_points TEXT,
  product_highlights TEXT,
  target_audience TEXT,
  
  -- Enhanced Data (JSON)
  pricing TEXT,                   -- JSON pricing info
  reviews TEXT,                   -- JSON review data
  promotions TEXT,                -- JSON promo data
  competitive_edges TEXT,         -- JSON competitive info
  
  -- Scraping Metadata
  scrape_status TEXT NOT NULL DEFAULT 'pending',
  scrape_error TEXT,
  scraped_at TEXT,
  
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### `keywords` Table
```sql
CREATE TABLE keywords (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  ad_group_id INTEGER NOT NULL,
  
  keyword_text TEXT NOT NULL,
  match_type TEXT,               -- 'BROAD', 'PHRASE', 'EXACT'
  status TEXT,                   -- 'PAUSED', 'ENABLED'
  
  cpc_bid_micros INTEGER,
  final_url TEXT,
  is_negative INTEGER,
  
  ai_generated INTEGER DEFAULT 0,
  generation_source TEXT,        -- References creative generation
  
  quality_score INTEGER,
  creation_status TEXT,
  creation_error TEXT,
  last_sync_at TEXT,
  
  keyword_id TEXT,               -- Google Ads keyword ID
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (ad_group_id) REFERENCES ad_groups(id)
);
```

#### `ad_groups` Table
```sql
CREATE TABLE ad_groups (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  campaign_id INTEGER NOT NULL,
  
  ad_group_name TEXT NOT NULL,
  status TEXT DEFAULT 'PAUSED',
  cpc_bid_micros INTEGER,
  
  ad_group_id TEXT,              -- Google Ads ad group ID
  creation_status TEXT,
  creation_error TEXT,
  last_sync_at TEXT,
  
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);
```

#### `campaigns` Table
```sql
CREATE TABLE campaigns (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  offer_id INTEGER NOT NULL,
  google_ads_account_id INTEGER NOT NULL,
  
  campaign_name TEXT NOT NULL,
  campaign_id TEXT UNIQUE,        -- Google Ads campaign ID
  
  budget_amount REAL NOT NULL,
  budget_type TEXT DEFAULT 'DAILY',
  target_cpa REAL,
  max_cpc REAL,
  
  status TEXT DEFAULT 'PAUSED',
  start_date TEXT,
  end_date TEXT,
  
  creation_status TEXT DEFAULT 'draft',
  creation_error TEXT,
  last_sync_at TEXT,
  
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (offer_id) REFERENCES offers(id),
  FOREIGN KEY (google_ads_account_id) REFERENCES google_ads_accounts(id)
);
```

#### `system_settings` Table (AI Configuration)
```sql
CREATE TABLE system_settings (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,                -- NULL for global settings
  
  category TEXT NOT NULL,         -- 'ai', 'google_ads', 'proxy', 'system'
  config_key TEXT NOT NULL,
  config_value TEXT,
  encrypted_value TEXT,
  
  data_type TEXT DEFAULT 'string',
  is_sensitive INTEGER DEFAULT 0,
  is_required INTEGER DEFAULT 0,
  
  default_value TEXT,
  description TEXT,
  
  validation_status TEXT,
  validation_message TEXT,
  last_validated_at TEXT,
  
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### 2.2 Index Strategy

**Key Indexes for Performance:**
```sql
CREATE INDEX idx_ad_creatives_offer_id ON ad_creatives(offer_id);
CREATE INDEX idx_ad_creatives_user_id ON ad_creatives(user_id);
CREATE INDEX idx_ad_creatives_is_selected ON ad_creatives(is_selected);
CREATE INDEX idx_keywords_ad_group_id ON keywords(ad_group_id);
CREATE INDEX idx_ad_groups_campaign_id ON ad_groups(campaign_id);
CREATE INDEX idx_campaigns_offer_id ON campaigns(offer_id);
CREATE INDEX idx_offers_user_id ON offers(user_id);
CREATE INDEX idx_system_settings_user_id ON system_settings(user_id);
```

---

## 3. GOOGLE ADS INTEGRATION

### 3.1 OAuth & Account Management

**Files:**
- `src/lib/google-ads-api.ts` - API client initialization
- `src/lib/google-ads-oauth.ts` - OAuth flow management
- `src/lib/google-ads-accounts.ts` - Account CRUD

**Configuration (Environment):**
```
GOOGLE_ADS_CLIENT_ID=...
GOOGLE_ADS_CLIENT_SECRET=...
GOOGLE_ADS_DEVELOPER_TOKEN=...
GOOGLE_ADS_LOGIN_CUSTOMER_ID=... (MCC Manager account ID)
GOOGLE_ADS_CUSTOMER_IDS=... (comma-separated customer IDs)
```

**Account Storage Table:**
```sql
CREATE TABLE google_ads_accounts (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE,
  customer_id TEXT NOT NULL,
  account_name TEXT,
  
  currency TEXT DEFAULT 'CNY',
  timezone TEXT DEFAULT 'Asia/Shanghai',
  
  is_manager_account INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TEXT,
  
  last_sync_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### 3.2 Campaign Sync Flow

**Creation Status Flow:**
```
draft → pending → synced
              → failed (with error message)
```

**Creative Sync Process:**
1. User selects ad creative from generated variants
2. Creative status: `draft` → `pending`
3. Creative assigned to ad_group_id
4. API call to Google Ads creates responsive search ad
5. On success: status = `synced`, ad_id = Google Ad ID
6. On failure: status = `failed`, creation_error = error message

---

## 4. KEYWORD GENERATION FLOW

### 4.1 Keyword Generation

**File:** `src/lib/keyword-generator.ts` (150+ lines)

**Process:**
```
Offer Data (brand, description, USPs, highlights, audience)
    ↓
generateKeywords() function
    ↓
Gemini 2.5 Pro API with detailed prompt
    ↓
JSON Response:
{
  "keywords": [
    {
      "keyword": "text",
      "matchType": "BROAD|PHRASE|EXACT",
      "priority": "HIGH|MEDIUM|LOW",
      "category": "brand|product|solution|competitor|longtail",
      "searchIntent": "informational|navigational|transactional",
      "reasoning": "why chosen"
    }
  ],
  "estimatedBudget": {...},
  "recommendations": [...]
}
```

**Keyword Categories:**
1. **Brand Words** (5-8): Include brand name
2. **Product Words** (10-15): Core product functionality
3. **Solution Words** (8-12): User pain points & solutions
4. **Competitor Words** (5-8): Competitor brands
5. **Long-tail** (10-15): Specific user search intent

**Match Type Strategy:**
- BROAD: Discovery, product/solution words
- PHRASE: Balanced coverage, brand/product words
- EXACT: High-converting keywords, brand + high-intent long-tail

### 4.2 Keyword-Creative Integration

**Current Status:**
- ✅ Keywords generated with creatives
- ✅ Keywords stored in ad_creatives table as JSON array
- ⚠️ No automatic ad_group_id assignment yet
- ⚠️ No bulk keyword sync to Google Ads

**Missing Pieces for Full Integration:**
1. Keyword-to-AdGroup assignment logic
2. Batch keyword creation in Google Ads API
3. Keyword performance tracking

---

## 5. CREATIVE SCORING SYSTEM

### 5.1 5-Dimensional Scoring

**Total: 100 points**

| Dimension | Points | Criteria |
|-----------|--------|----------|
| **Relevance** | 30 | Headline/description match to offer keywords |
| **Quality** | 25 | Headline length (15-30), description (60-90), CTA presence |
| **Engagement** | 25 | Urgency words, promotions, questions/exclamations |
| **Diversity** | 10 | Unique headline/description ratio |
| **Clarity** | 10 | Length compliance, keyword quantity reasonableness |

**Scoring Logic:**
```typescript
// Relevance: keyword match percentage
relevanceScore = (matchCount / totalOfferKeywords) * 30

// Quality: headline + description quality weighted average
qualityScore = (headlineQuality + descQuality) / 2 * 2.5

// Engagement: base 15 + modifiers for urgency, promos
engagementScore = 15 + urgency(4) + promos(3) + questions(3)

// Diversity: unique headlines/descriptions ratio
diversityScore = (unique/total) * 5 per dimension

// Clarity: deductions for violations
clarityScore = 10 - violations_penalties
```

### 5.2 Real-Time Scoring

**File:** `src/lib/scoring.ts`

**Function:** `calculateAdCreativeScore()`
- Called during creative creation
- Uses offer keywords for relevance matching
- Returns detailed breakdown with explanation

---

## 6. OFFER DATA ENRICHMENT

### 6.1 Web Scraping & Analysis

**Process:**
```
User provides Offer URL
    ↓
Web scraper extracts content
    ↓
AI analyzes page content
    ↓
Extracts to offers table:
- brand_description
- unique_selling_points
- product_highlights
- target_audience

Also extracts (optional):
- pricing (JSON)
- reviews (JSON with ratings, counts)
- promotions (JSON with deals)
- competitive_edges (JSON with badges)
```

**Analysis File:** `src/lib/ai.ts`

**Function:** `analyzeProductPage()`
- Supports product pages and store pages
- Extracts comprehensive product info
- Handles multiple languages
- Intelligent hot-selling product prioritization

---

## 7. CURRENT LIMITATIONS & GAPS

### 7.1 Keywords Integration

**Not Implemented:**
1. ❌ Automatic keyword-to-AdGroup assignment
2. ❌ Batch keyword creation in Google Ads API
3. ❌ Keyword bid management (CPC optimization)
4. ❌ Keyword quality score tracking from Google Ads
5. ❌ Negative keyword management

**Partially Implemented:**
- Keywords generated with creatives
- Keywords stored in ad_creatives table
- Manual creation in keywords table

### 7.2 Creative Launch Process

**Current Status:**
- ✅ Creative generation & scoring
- ✅ Creative approval workflow
- ✅ Creative-AdGroup assignment
- ❌ Bulk creative sync to Google Ads (only tracked in DB)
- ❌ A/B testing setup
- ❌ Creative performance monitoring

### 7.3 API Configuration

**Not Automated:**
- Redis connection (hardcoded in env)
- Google Ads API rate limiting
- Retry logic for API failures
- Batch operation coordination

---

## 8. ENVIRONMENT CONFIGURATION

### 8.1 Required Environment Variables

```bash
# AI Models
GEMINI_API_KEY=...
GOOGLE_APPLICATION_CREDENTIALS=... (for Vertex AI)

# Google Ads API
GOOGLE_ADS_CLIENT_ID=...
GOOGLE_ADS_CLIENT_SECRET=...
GOOGLE_ADS_DEVELOPER_TOKEN=...
GOOGLE_ADS_LOGIN_CUSTOMER_ID=...

# Database
DATABASE_PATH=./data/autoads.db

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
JWT_SECRET=...
```

### 8.2 Configuration Loading Priority

1. **Database** (system_settings table) - Highest
2. **Environment variables** - Fallback
3. **Default values** - Lowest

---

## 9. API ENDPOINTS FOR CREATIVES

### 9.1 Generation Endpoints

```
POST /api/offers/:id/generate-ad-creative
- Generate 1-3 creatives for an offer
- Request: { theme, count, batch }
- Response: { success, data: AdCreative[], count }

GET /api/offers/:id/generate-ad-creative
- List all creatives for an offer
- Query: ?generation_round=X&is_selected=true|false
- Response: { success, data: AdCreative[], total }

POST /api/offers/:id/generate-creatives (legacy)
- Alternative generation endpoint
- Request: { orientations: ['brand', 'product', 'promo'] }
- Response: Creative variants with quality scores
```

### 9.2 Creative Management Endpoints

```
GET /api/creatives/:id
- Get single creative details

PUT /api/creatives/:id
- Update creative content or status

POST /api/creatives/:id/approve
- Approve creative for use

POST /api/creatives/:id/assign-adgroup
- Assign creative to ad group

POST /api/creatives/:id/check-compliance
- Validate creative against policies

POST /api/creatives/:id/sync
- Sync creative to Google Ads

GET /api/creatives/performance
- Get creative performance metrics
```

---

## 10. DATA FLOW DIAGRAM

```
┌─────────────────────┐
│  User → Offer URL   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────┐
│  Web Scraper + AI Analysis  │
│  (brand, USPs, highlights)  │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────┐
│   offers table      │
│ with enriched data  │
└──────────┬──────────┘
           │
           ├─────────────────┬──────────────────┐
           │                 │                  │
           ▼                 ▼                  ▼
┌──────────────────┐ ┌──────────────┐ ┌────────────────┐
│ generateAdCreative│ │generateKeywords│ │ calculateScore│
│ (Vertex AI/Gemini)│ │(Gemini API)   │ │(5-dimensional)│
└──────┬───────────┘ └──────┬───────┘ └────────┬───────┘
       │                    │                   │
       └────────┬───────────┴───────────────────┘
                │
                ▼
       ┌─────────────────────┐
       │ ad_creatives table  │
       │ with keywords array │
       └──────────┬──────────┘
                  │
     ┌────────────┼────────────┐
     │            │            │
     ▼            ▼            ▼
┌──────────┐ ┌──────────┐ ┌────────────┐
│ Approve? │ │ Assign   │ │ Sync to GA │
│ Yes/No   │ │ AdGroup? │ │   API?     │
└────┬─────┘ └────┬─────┘ └─────┬──────┘
     │            │             │
     └────────────┴─────────────┘
              │
              ▼
       ┌─────────────────┐
       │ Google Ads      │
       │ Campaign        │
       └─────────────────┘
```

---

## 11. FILE STRUCTURE SUMMARY

**Core Creative Generation:**
```
src/lib/
├── ad-creative-generator.ts    (AI prompt & generation)
├── ad-creative.ts              (Database models & scoring)
├── ad-creative-scorer.ts       (Additional scoring logic)
├── scoring.ts                  (Launch score calculation)
└── keyword-generator.ts        (Keyword generation)

src/app/api/
├── offers/[id]/generate-ad-creative/route.ts    (Main endpoint)
├── offers/[id]/generate-creatives/route.ts      (Legacy endpoint)
├── offers/[id]/creatives/route.ts               (Creative CRUD)
└── creatives/*/route.ts                         (Creative management)
```

**Database & Configuration:**
```
src/lib/
├── db.ts                       (SQLite connection)
├── offers.ts                   (Offer models)
├── campaigns.ts                (Campaign models)
├── ad-groups.ts                (AdGroup models)
└── keywords.ts                 (Keyword models)

scripts/
├── init-database.ts            (Initial DB setup)
├── migrate-add-ad-creative-tables.ts  (Ad creative schema)
└── run-migrations.ts           (Migration runner)
```

**Google Ads Integration:**
```
src/lib/
├── google-ads-api.ts           (API client)
├── google-ads-oauth.ts         (OAuth flow)
├── google-ads-accounts.ts      (Account management)
└── google-ads-keyword-planner.ts (Keyword research)
```

---

## 12. NEXT STEPS FOR ENHANCEMENT

### Immediate (High Priority)
1. Implement keyword-to-AdGroup auto-assignment logic
2. Build batch keyword sync to Google Ads
3. Add keyword performance tracking

### Short Term (Medium Priority)
1. Implement bulk creative sync endpoint
2. Add creative A/B testing framework
3. Build creative performance dashboard

### Long Term (Low Priority)
1. Machine learning for creative optimization
2. Advanced keyword bid management
3. Competitive keyword monitoring

---

**Document Generated:** 2025-11-21
**Codebase Status:** Actively maintained
**Version:** 1.0.0
