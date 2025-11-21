# AutoBB Codebase Exploration - Complete Documentation

## Overview

This directory contains comprehensive documentation of the AutoBB SaaS application's architecture, with special focus on creative generation, keyword handling, database schema, and Google Ads integration.

Generated: 2025-11-21

---

## Documentation Files

### 1. CODEBASE_ARCHITECTURE.md (761 lines)
**Purpose:** Complete technical reference guide

**Contents:**
- Executive summary with tech stack
- Creative generation data flow (§1)
- Database schema with SQL (§2)
- Google Ads integration architecture (§3)
- Keyword generation flow (§4)
- Creative scoring system (§5)
- Offer data enrichment (§6)
- Current limitations & gaps (§7)
- Environment configuration (§8)
- API endpoints reference (§9)
- Data flow diagrams (§10)
- File structure summary (§11)
- Next steps for enhancement (§12)

**Best For:**
- Understanding the complete system architecture
- Learning how creative generation works end-to-end
- Understanding database relationships
- Identifying what needs to be built next

**Key Sections:**
- Section 7: Current Limitations (critical for development)
- Section 2.1: Database Schema (reference for queries)
- Section 1: Creative Generation Flow (understand the pipeline)

---

### 2. CREATIVE_GENERATION_QUICK_REFERENCE.md (443 lines)
**Purpose:** Quick lookup guide for developers

**Contents:**
- Core files map with line numbers (§1)
- AI configuration priority chain (§2)
- Creative scoring breakdown with formulas (§3)
- Keyword generation process (§4)
- Response format examples (§5)
- Generation workflow steps (§6)
- Generation quota system (§7)
- File dependencies (§8)
- Common tasks with code samples (§9)
- Troubleshooting guide (§10)

**Best For:**
- Quick reference during development
- Understanding scoring algorithms
- Finding specific functions and their locations
- Debugging common issues
- API response format examples

**Quick Links:**
- Line 20: AI config priority chain
- Line 95: Scoring formulas
- Line 260: Common tasks
- Line 340: Troubleshooting

---

### 3. EXPLORATION_SUMMARY.md (284 lines)
**Purpose:** High-level summary of exploration and key findings

**Contents:**
- What was explored (documents generated)
- Key findings (5 major areas)
- Critical code locations
- Data flow insights
- Integration points
- Next steps for development
- File statistics
- Exploration methodology
- Quick stats (tables, files, endpoints)
- How to use these documents
- Document access guide

**Best For:**
- Getting oriented with the exploration results
- Quick reference to key file locations
- Understanding what was analyzed
- Planning next development steps
- Finding the right document for your need

**Key Findings Section:**
Critical information about the creative generation system and what's implemented vs. missing

---

## How to Use These Documents

### Scenario 1: Understanding the System
1. Start with EXPLORATION_SUMMARY.md (5 min read)
2. Read CODEBASE_ARCHITECTURE.md sections 1-6 (20 min)
3. Review the data flow diagram (§10)

### Scenario 2: Adding a New Feature
1. Check Section 7 of CODEBASE_ARCHITECTURE.md (Limitations)
2. Review Section 12 for related features
3. Find code locations in EXPLORATION_SUMMARY.md
4. Use CREATIVE_GENERATION_QUICK_REFERENCE.md for implementation patterns

### Scenario 3: Debugging Issues
1. Check Troubleshooting section in QUICK_REFERENCE.md
2. Look up file dependencies (§8 in QUICK_REFERENCE.md)
3. Review scoring algorithm if score-related (§3)
4. Check configuration priority if AI-related (§2)

### Scenario 4: Development Task
1. Find the function in EXPLORATION_SUMMARY.md "Critical Code Locations"
2. Use CREATIVE_GENERATION_QUICK_REFERENCE.md for the detailed flow
3. Reference CODEBASE_ARCHITECTURE.md for context
4. Check database schema (§2) if data-related

### Scenario 5: Code Review
1. Use QUICK_REFERENCE.md Section 1 (Core Files Map)
2. Follow dependencies in Section 8 (File Dependencies)
3. Check scoring logic in Section 3
4. Validate against API response format in Section 5

---

## Key Discoveries

### What's Implemented
- ✅ AI-powered creative generation (Vertex AI + Gemini)
- ✅ Keywords generated with creatives
- ✅ 5-dimensional creative scoring system
- ✅ Batch generation of 1-3 creatives in parallel
- ✅ AI configuration with database + env var fallback
- ✅ Offer data enrichment via web scraping
- ✅ Database schema with proper foreign keys & indexes
- ✅ Google Ads OAuth integration

### What's Missing (High Priority)
- ❌ Automatic keyword sync to Google Ads API
- ❌ Keyword-to-AdGroup auto-assignment
- ❌ Bulk creative sync to Google Ads
- ❌ Keyword performance tracking
- ❌ Negative keyword management
- ❌ Creative A/B testing framework

---

## Quick Statistics

```
Database Tables:        17+
Core Generation Files:  3 (1,370 lines total)
API Endpoints:          10+ for creatives
Scoring Dimensions:     5
Max Creatives/Round:    3
Keywords/Creative:      10-15
AI Models Supported:    2 (Vertex AI, Gemini)
Generation Rounds:      1-3 per offer
```

---

## Critical Code Locations

### Must-Know Functions
```
generateAdCreative()           src/lib/ad-creative-generator.ts:383
generateAdCreativesBatch()     src/lib/ad-creative-generator.ts:473
calculateAdCreativeScore()     src/lib/ad-creative.ts:249
createAdCreative()             src/lib/ad-creative.ts:97
getAIConfig()                  src/lib/ad-creative-generator.ts:27
```

### Key Tables
```
ad_creatives      - Generated creatives with keywords
offers            - Product/offer information
keywords          - Keyword management
ad_groups         - Ad group definitions
system_settings   - AI configuration
```

### Main Endpoints
```
POST /api/offers/:id/generate-ad-creative
GET /api/offers/:id/generate-ad-creative
POST /api/creatives/:id/assign-adgroup
POST /api/creatives/:id/approve
```

---

## Data Flow at a Glance

```
User URL
  ↓
[Scraper] → Brand, USPs, Highlights, Audience
  ↓
offers table
  ↓
[generateAdCreative]
  ├─ Get AI config (DB → Env vars → Defaults)
  ├─ Build prompt with offer data
  ├─ Call Vertex AI or Gemini
  ├─ Parse JSON response
  └─ Validate and truncate if needed
  ↓
[calculateAdCreativeScore]
  ├─ Relevance (30 pts) - keyword matching
  ├─ Quality (25 pts) - length & CTA
  ├─ Engagement (25 pts) - urgency & promos
  ├─ Diversity (10 pts) - uniqueness ratio
  └─ Clarity (10 pts) - compliance
  ↓
ad_creatives table
  ├─ Headlines (JSON)
  ├─ Descriptions (JSON)
  ├─ Keywords (JSON)
  ├─ Score & breakdown
  └─ Metadata (theme, model, round, status)
  ↓
User selects creative
  ↓
Assign to AdGroup
  ↓
[MISSING] → Sync to Google Ads
```

---

## Document Version Info

| Document | Lines | Size | Version | Date |
|----------|-------|------|---------|------|
| CODEBASE_ARCHITECTURE.md | 761 | 21 KB | 1.0 | 2025-11-21 |
| CREATIVE_GENERATION_QUICK_REFERENCE.md | 443 | 10 KB | 1.0 | 2025-11-21 |
| EXPLORATION_SUMMARY.md | 284 | 7.8 KB | 1.0 | 2025-11-21 |
| **TOTAL** | **1,488** | **38.8 KB** | **1.0** | **2025-11-21** |

---

## Related Documentation

This directory also contains other project documentation:
- USER_MANAGEMENT_* files (User authentication & profiles)
- FRONTEND_MIGRATION_COMPLETE.md (UI/UX updates)
- CREATIVE_SYSTEM_MIGRATION_COMPLETE.md (System migration)
- REQUIREMENTS_*_TEST_PLAN.md (Feature testing)

---

## Questions?

When reviewing these documents:
1. Check the table of contents in each document
2. Use Ctrl+F (Find) for specific terms
3. Follow cross-references between documents
4. Check the index/quick reference first
5. Go to detailed sections as needed

---

## Exploration Metadata

**Repository:** /Users/jason/Documents/Kiro/autobb
**Framework:** Next.js 14 (TypeScript)
**Database:** SQLite (better-sqlite3)
**AI Models:** Vertex AI, Gemini API
**Google Ads API:** v16

**Files Analyzed:**
- 20+ source files
- 5+ migration scripts
- 10+ API endpoints
- 17+ database tables

**Exploration Time:** ~2 hours
**Documentation Generated:** ~1,500 lines across 3 documents

---

**Last Updated:** 2025-11-21
**Document Status:** Complete
**Accuracy Level:** High (cross-referenced with actual code)
