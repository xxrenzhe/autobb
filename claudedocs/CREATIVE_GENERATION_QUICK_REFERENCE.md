# Creative Generation - Quick Reference Guide

## 1. Core Files Map

### Generation Logic
```
generateAdCreative()
  └─ src/lib/ad-creative-generator.ts:383
     ├─ getAIConfig() - Get AI model config (Vertex AI vs Gemini)
     ├─ buildAdCreativePrompt() - Build AI prompt with offer data
     ├─ generateWithVertexAI() - Call Vertex AI API
     ├─ generateWithGeminiAPI() - Call Gemini API
     └─ parseAIResponse() - Parse & validate JSON response

createAdCreative()
  └─ src/lib/ad-creative.ts:97
     ├─ calculateAdCreativeScore() - 5-dimensional scoring
     └─ INSERT to ad_creatives table
```

### API Endpoints
```
POST /api/offers/:id/generate-ad-creative
  └─ src/app/api/offers/[id]/generate-ad-creative/route.ts:12
     ├─ Validates user & offer
     ├─ Checks 3-generation quota
     └─ Calls generateAdCreative() or generateAdCreativesBatch()
```

### Database Schema
```
ad_creatives
  ├─ headlines (JSON array, 15 max)
  ├─ descriptions (JSON array, 4 max)
  ├─ keywords (JSON array)
  ├─ score (0-100)
  ├─ score_breakdown (JSON)
  ├─ generation_round (1-3)
  ├─ theme
  ├─ ai_model ('vertex-ai:...' or 'gemini-api:...')
  └─ creation_status ('draft' → 'pending' → 'synced')
```

---

## 2. AI Configuration Priority Chain

### Database First (Highest Priority)
```sql
-- User-specific config (user_id IS NOT NULL)
SELECT * FROM system_settings
WHERE user_id = ? AND config_key IN (
  'use_vertex_ai',
  'vertex_ai_model',
  'gcp_project_id',
  'gcp_location',
  'gemini_api_key',
  'gemini_model'
)

-- Then global config (user_id IS NULL)
SELECT * FROM system_settings
WHERE user_id IS NULL AND config_key IN (
  'VERTEX_AI_PROJECT_ID',
  'VERTEX_AI_LOCATION',
  'VERTEX_AI_MODEL',
  'GEMINI_API_KEY',
  'GEMINI_MODEL'
)
```

### Environment Variables (Fallback)
```
GOOGLE_APPLICATION_CREDENTIALS=...  (for Vertex AI)
GEMINI_API_KEY=...                   (for Gemini)
VERTEX_AI_PROJECT_ID=...
VERTEX_AI_LOCATION=...
VERTEX_AI_MODEL=...
```

### Selection Logic
```
if (useVertexAI && projectId && location && model) → VERTEX AI
else if (geminiApiKey && model) → GEMINI API
else → Error: AI not configured
```

---

## 3. Creative Scoring Breakdown

### Score Components (100 points total)

| Dimension | Points | Key Metrics |
|-----------|--------|------------|
| **Relevance** | 30 | Keywords from offer appear in creative text |
| **Quality** | 25 | Headline/desc length compliance, CTA presence |
| **Engagement** | 25 | Urgency words, promotions, questions |
| **Diversity** | 10 | % unique headlines/descriptions |
| **Clarity** | 10 | No violations, reasonable keyword count |

### Scoring Algorithm

```typescript
// 1. Relevance (30 points)
matchCount = count of offer keywords found in creative
relevanceScore = (matchCount / totalOfferKeywords) * 30

// 2. Quality (25 points)
headlineQuality = avg(per_headline_score) where:
  - Base: 5 points
  - Length 15-30 chars: +2 points
  - Has numbers/special: +1 point each
  
descQuality = avg(per_desc_score) where:
  - Base: 5 points
  - Length 60-90 chars: +3 points
  - Has CTA words: +2 points

qualityScore = (headlineQuality + descQuality) / 2 * 2.5

// 3. Engagement (25 points)
engagementScore = 15 + modifiers:
  - Questions/exclamations: +3
  - Promotion words: +3
  - Urgency words: +4

// 4. Diversity (10 points)
diversityScore = (uniqueHeadlines / totalHeadlines) * 5 +
                 (uniqueDescs / totalDescs) * 5

// 5. Clarity (10 points)
clarityScore = 10
  - Over-length headlines: -2
  - Over-length descriptions: -2
  - Too many keywords (>20): -2
```

---

## 4. Keyword Generation

### Process
```
offer data (brand, USPs, highlights, audience)
  ↓
generateKeywords() - calls Gemini 2.5 Pro
  ↓
Returns JSON:
{
  "keywords": [
    {
      "keyword": "text",
      "matchType": "BROAD|PHRASE|EXACT",
      "priority": "HIGH|MEDIUM|LOW",
      "category": "brand|product|solution|competitor|longtail"
    }
  ],
  "recommendations": [...]
}
  ↓
Stored in ad_creatives.keywords (JSON array)
```

### Keyword Categories
- **Brand** (5-8): Contains brand name
- **Product** (10-15): Core functionality
- **Solution** (8-12): Problem-solving oriented
- **Competitor** (5-8): Competitor brands
- **Long-tail** (10-15): Specific intent

### Match Type Strategy
- **BROAD**: Discovery words (product, solution)
- **PHRASE**: Balanced coverage (brand, product)
- **EXACT**: High-intent (brand + long-tail)

---

## 5. Response Format

### POST /api/offers/:id/generate-ad-creative

**Success Response (200)**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "offer_id": 45,
    "user_id": 1,
    "headlines": ["Headline 1", "Headline 2", ...],
    "descriptions": ["Desc 1", "Desc 2"],
    "keywords": ["keyword1", "keyword2"],
    "callouts": [...],
    "sitelinks": [...],
    "score": 85,
    "score_breakdown": {
      "relevance": 25,
      "quality": 22,
      "engagement": 20,
      "diversity": 9,
      "clarity": 9
    },
    "theme": "广告主题",
    "ai_model": "vertex-ai:gemini-2.0-flash",
    "generation_round": 1,
    "is_selected": 0,
    "creation_status": "draft",
    "created_at": "2025-11-21T10:30:00Z",
    "updated_at": "2025-11-21T10:30:00Z"
  },
  "message": "广告创意生成成功"
}
```

**Error Responses**
```json
{
  "error": "AI配置未设置",
  "redirect": "/settings",
  "suggestion": "请前往设置页面配置Vertex AI或Gemini API"
}
```

---

## 6. Generation Workflow

### Step 1: Fetch Offer
```typescript
const offer = findOfferById(offerId, userId)
if (!offer) → 404 Offer not found
if (offer.scrape_status !== 'completed') → 400 Not ready
```

### Step 2: Get AI Config
```typescript
const aiConfig = getAIConfig(userId)
// Checks system_settings first, then env vars
```

### Step 3: Build Prompt
```typescript
const prompt = buildAdCreativePrompt({
  brand: offer.brand,
  category: offer.category,
  usps: offer.unique_selling_points,
  highlights: offer.product_highlights,
  audience: offer.target_audience,
  theme: options?.theme,
  referencePerformance: options?.referencePerformance
})
```

### Step 4: Call AI
```typescript
if (aiConfig.type === 'vertex-ai') {
  result = await generateWithVertexAI(config, prompt)
} else if (aiConfig.type === 'gemini-api') {
  result = await generateWithGeminiAPI(config, prompt)
}
```

### Step 5: Parse Response
```typescript
// Remove markdown, fix smart quotes, extract JSON
const data = parseAIResponse(text)
// Validate: headlines >= 3, descriptions >= 2, keywords present
// Truncate over-length items
```

### Step 6: Score
```typescript
const scoreResult = calculateAdCreativeScore(data, offerId)
// Returns: score, breakdown, explanation
```

### Step 7: Save to DB
```typescript
const creative = db.prepare(`
  INSERT INTO ad_creatives (
    offer_id, user_id,
    headlines, descriptions, keywords, callouts, sitelinks,
    final_url, final_url_suffix,
    score, score_breakdown, score_explanation,
    generation_round, theme, ai_model
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(...)
```

---

## 7. Generation Quota System

### Per Offer Per Round
- Maximum: 3 creatives per generation round
- Rounds: 1, 2, 3 (can regenerate up to 3 times)

### Check Quota
```typescript
const existing = listAdCreativesByOffer(offerId, userId, {
  generation_round
})

const remainingQuota = 3 - existing.length
if (remainingQuota <= 0) → Error: quota exceeded
```

### Batch Mode
```typescript
if (batch && count > 1) {
  // Generate count (max 3) creatives in parallel
  const results = await generateAdCreativesBatch(
    offerId, userId, count, options
  )
}
```

---

## 8. File Dependencies

### ad-creative-generator.ts
```
Imports:
├─ getDatabase() - sqlite connection
├─ GeneratedAdCreativeData type - interface
├─ creativeCache - in-memory cache
└─ VertexAI / GoogleGenerativeAI - AI SDKs

Exports:
├─ generateAdCreative()
├─ generateAdCreativesBatch()
└─ Helper functions (private)
```

### ad-creative.ts
```
Imports:
├─ getDatabase() - sqlite connection
├─ db.ts - schemas

Exports:
├─ AdCreative interface
├─ createAdCreative()
├─ listAdCreativesByOffer()
├─ calculateAdCreativeScore()
├─ updateAdCreative()
├─ deleteAdCreative()
├─ approveAdCreative()
└─ comparativeAdCreatives()
```

### API Route
```
Imports:
├─ NextRequest, NextResponse
├─ verifyAuth() - authentication
├─ generateAdCreative() - core logic
├─ createAdCreative() - database
├─ listAdCreativesByOffer() - queries
└─ Error types

Exports:
├─ POST handler
└─ GET handler
```

---

## 9. Common Tasks

### Generate Creatives for Offer
```typescript
POST /api/offers/45/generate-ad-creative
{
  "theme": "促销活动",
  "count": 3,
  "batch": true
}
```

### Get All Creatives for Offer
```typescript
GET /api/offers/45/generate-ad-creative?generation_round=1&is_selected=false
```

### Approve Creative
```typescript
POST /api/creatives/123/approve
```

### Update Creative
```typescript
PUT /api/creatives/123
{
  "headlines": ["New headline 1", ...],
  "descriptions": ["New description 1", ...],
  "keywords": ["new keyword 1", ...]
}
```

### Check Generation Status
```typescript
const creative = await findAdCreativeById(123, userId)
console.log(creative.creation_status) // 'draft' | 'pending' | 'synced' | 'failed'
console.log(creative.creation_error) // null or error message
```

---

## 10. Troubleshooting

### AI Config Not Set
**Error:** "AI配置未设置"
**Solution:** 
1. Check system_settings table for user/global settings
2. Or set env vars: GEMINI_API_KEY + GEMINI_MODEL
3. Or set env vars: GOOGLE_APPLICATION_CREDENTIALS + VERTEX_AI_* 

### Offer Not Ready
**Error:** "Offer信息抓取失败"
**Solution:** 
1. Offer must have scrape_status = 'completed'
2. Run scraper first: POST /api/offers/:id/scrape

### Quota Exceeded
**Error:** "已达到此轮生成次数上限"
**Solution:**
1. User has already generated 3 creatives for this round
2. Can increment generation_round in request to start new round

### JSON Parse Error
**Error:** "AI响应解析失败"
**Solution:**
1. Check AI response isn't truncated (check token limit)
2. AI might be returning markdown code blocks
3. parseAIResponse() handles most cases, but may need prompt adjustment

---

**Last Updated:** 2025-11-21
**Version:** 1.0
