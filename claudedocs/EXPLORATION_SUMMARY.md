# Codebase Exploration Summary

## What Was Explored

This exploration systematically mapped the AutoBB SaaS application's architecture, focusing on creative generation, database schema, Google Ads integration, and keyword handling.

### Documents Generated

1. **CODEBASE_ARCHITECTURE.md** (2,500+ lines)
   - Complete system overview with detailed explanations
   - All database schemas with SQL definitions
   - Google Ads integration architecture
   - Current gaps and limitations
   - Next steps for enhancement

2. **CREATIVE_GENERATION_QUICK_REFERENCE.md** (400+ lines)
   - Quick lookup guide for developers
   - File dependency maps
   - Scoring algorithms with pseudocode
   - Common tasks and troubleshooting
   - API response formats

---

## Key Findings

### 1. Creative Generation Pipeline
- Fully implemented: AI-powered generation using Vertex AI or Gemini
- Keywords are generated alongside creatives (stored in JSON array)
- 5-dimensional scoring system (relevance, quality, engagement, diversity, clarity)
- Batch generation support for up to 3 creatives in parallel

### 2. Database Schema
- **Core tables:** offers, ad_creatives, keywords, ad_groups, campaigns
- **AI config:** system_settings table with user-specific and global settings
- **Google Ads integration:** google_ads_accounts, google_ads_credentials tables
- All properly indexed for performance

### 3. AI Configuration
- Smart priority chain: database config → env vars → defaults
- Supports both Vertex AI and Gemini API with automatic fallback
- User-specific config overrides global settings

### 4. Keyword Generation
- Fully implemented in src/lib/keyword-generator.ts
- 5 categories: brand, product, solution, competitor, long-tail
- 3 match types: BROAD, PHRASE, EXACT with strategic assignment
- Keywords stored in ad_creatives table as JSON array

### 5. Current Limitations
- Keywords generated but NOT automatically synced to Google Ads
- No automatic keyword-to-AdGroup assignment
- Creative sync to Google Ads only tracked in DB (not actively implemented)
- No keyword performance tracking from Google Ads API
- No negative keyword management

---

## Critical Code Locations

### Generation Logic
```
src/lib/ad-creative-generator.ts:383       generateAdCreative()
src/lib/ad-creative-generator.ts:473       generateAdCreativesBatch()
src/lib/ad-creative.ts:97                  createAdCreative()
src/lib/ad-creative.ts:249                 calculateAdCreativeScore()
```

### API Endpoints
```
src/app/api/offers/[id]/generate-ad-creative/route.ts:12      POST generation
src/app/api/offers/[id]/generate-creatives/route.ts           Legacy endpoint
src/app/api/creatives/[id]/assign-adgroup/route.ts            Assign to AdGroup
```

### Configuration
```
src/lib/ad-creative-generator.ts:27        getAIConfig() - AI config loading
scripts/init-database.ts                   Initial DB setup
scripts/migrate-add-ad-creative-tables.ts  Schema creation
```

### Database
```
.env                                       Environment variables
system_settings table                      Stores AI config
ad_creatives table                         Generated creatives with keywords
```

---

## Data Flow Insights

### From URL to Google Ads
```
User Input URL
  ↓
Web Scraper → Brand, USPs, Highlights, Audience extracted
  ↓
offers table populated
  ↓
generateAdCreative() called
  ↓
AI generates: headlines (15), descriptions (4), keywords (10-15)
  ↓
Score calculated (0-100)
  ↓
ad_creatives table entry
  ↓
User selects creative
  ↓
Assigned to AdGroup
  ↓
[MISSING] → Sync to Google Ads API
```

### AI Model Selection
```
User wants to generate creative
  ↓
getAIConfig(userId) called
  ↓
Check system_settings for user config
  ↓
Check system_settings for global config
  ↓
Check environment variables
  ↓
If use_vertex_ai=true → Vertex AI (Google Cloud)
Else if GEMINI_API_KEY → Gemini API
Else → Error
```

---

## Integration Points

### Google Ads API
- OAuth 2.0 flow implemented (not fully documented here)
- Customer account management
- Campaign/AdGroup/Keyword/Creative sync (partially)
- Performance reporting endpoints

### AI Models
- Vertex AI: Enterprise-grade, no proxy needed
- Gemini API: Requires proxy for China/Asia
- Fallback strategy: Vertex AI preferred, Gemini fallback

### Database
- SQLite with better-sqlite3 library
- Single-file database for portability
- Proper foreign keys and indexes

---

## Next Steps for Development

### High Priority
1. Implement keyword batch sync to Google Ads API
2. Add automatic keyword-to-AdGroup assignment
3. Implement creative batch sync to Google Ads API
4. Add keyword quality score tracking

### Medium Priority
1. A/B testing framework for creatives
2. Creative performance dashboard
3. Keyword performance optimization
4. Negative keyword management

### Lower Priority
1. ML-based creative scoring
2. Competitive keyword monitoring
3. Advanced bid optimization
4. Cross-campaign optimization

---

## File Statistics

### Core Generation (3 files, ~1,400 lines)
- ad-creative-generator.ts: 514 lines
- ad-creative.ts: 631 lines
- API route: 225 lines

### Database & Schema (Multiple files)
- 17+ database tables
- 8+ indices
- ~10 migration scripts

### Google Ads Integration
- 4 main integration files
- OAuth flow
- Account management
- API client wrapper

---

## Exploration Methodology

1. **File Pattern Search** → Found all creative-related files
2. **Schema Analysis** → Mapped database structure
3. **Code Flow Tracing** → Followed generation pipeline
4. **Configuration Audit** → Documented AI config priority
5. **Integration Review** → Mapped external system connections
6. **Gap Analysis** → Identified missing implementations
7. **Documentation** → Created comprehensive guides

---

## Quick Stats

- **Total Tables:** 17+ (users, offers, campaigns, ad_creatives, keywords, etc.)
- **Core Generation Files:** 3 main files
- **API Endpoints:** 10+ endpoints for creative management
- **Scoring Dimensions:** 5 (relevance, quality, engagement, diversity, clarity)
- **Max Creatives per Round:** 3
- **Max Creatives per Offer:** 9 (3 rounds × 3 creatives)
- **Keywords per Creative:** 10-15
- **AI Models Supported:** 2 (Vertex AI, Gemini API)

---

## How to Use These Documents

1. **For Architecture Understanding:**
   - Read CODEBASE_ARCHITECTURE.md Sections 1-6
   - Review data flow diagram (Section 10)

2. **For Development:**
   - Use CREATIVE_GENERATION_QUICK_REFERENCE.md
   - Reference critical file locations in this summary

3. **For Adding Features:**
   - Check "Current Limitations" section (Section 7)
   - Review "Next Steps" (Section 12 in main doc)

4. **For Debugging:**
   - See Troubleshooting section in quick reference
   - Check file dependencies and imports

---

## Document Access

All exploration documents saved to:
```
/Users/jason/Documents/Kiro/autobb/claudedocs/

├── CODEBASE_ARCHITECTURE.md              (Main comprehensive guide)
├── CREATIVE_GENERATION_QUICK_REFERENCE.md (Developer quick lookup)
└── EXPLORATION_SUMMARY.md                (This file)
```

---

**Exploration Date:** 2025-11-21
**Repository:** /Users/jason/Documents/Kiro/autobb
**Git Branch:** main
**Framework:** Next.js 14 (TypeScript)
**Database:** SQLite (better-sqlite3)

---

## References

### Key Files Analyzed
- /Users/jason/Documents/Kiro/autobb/src/lib/ad-creative-generator.ts
- /Users/jason/Documents/Kiro/autobb/src/lib/ad-creative.ts
- /Users/jason/Documents/Kiro/autobb/src/lib/keyword-generator.ts
- /Users/jason/Documents/Kiro/autobb/scripts/init-database.ts
- /Users/jason/Documents/Kiro/autobb/scripts/migrate-add-ad-creative-tables.ts
- /Users/jason/Documents/Kiro/autobb/src/app/api/offers/[id]/generate-ad-creative/route.ts

### Related Systems
- Google Ads API (v16)
- Vertex AI (Google Cloud)
- Gemini API 2.5 Pro
- SQLite Database (better-sqlite3)

---

**Document Type:** Exploration Summary
**Status:** Complete
**Version:** 1.0.0
