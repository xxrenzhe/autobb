# Keyword Search Volume Feature Implementation

## Overview
实现了完整的关键词搜索量查询系统，包括Google Ads Keyword Planner集成、Redis缓存和全局关键词数据库。

## 实现的功能

### 1. 数据库扩展
- **global_keywords表**: 全局关键词搜索量缓存（不受user_id限制）
  - `keyword`, `country`, `language`, `search_volume`
  - 支持复用，减少API调用
- **ad_creatives.sitelinks列**: 存储站点链接数据（JSON格式）

### 2. Redis缓存 (`src/lib/redis.ts`)
- 新增关键词缓存函数：
  - `cacheKeywordVolume()` - 缓存单个关键词
  - `getCachedKeywordVolume()` - 获取缓存
  - `getBatchCachedVolumes()` - 批量获取
  - `batchCacheVolumes()` - 批量缓存
- 缓存键格式: `autoads:kw:{country}:{language}:{keyword}`
- 默认TTL: 7天

### 3. Keyword Planner服务 (`src/lib/keyword-planner.ts`)
- `getKeywordSearchVolumes()` - 批量获取搜索量
- `getKeywordVolume()` - 单个关键词查询
- `getKeywordSuggestions()` - 获取关键词建议
- 三层缓存策略：
  1. Redis缓存（优先）
  2. global_keywords数据库表
  3. Google Ads Keyword Planner API

### 4. API端点 (`src/app/api/keywords/volume/route.ts`)
```
GET /api/keywords/volume?keywords=kw1,kw2&country=US&language=en
```
返回：
```json
{
  "success": true,
  "country": "US",
  "language": "en",
  "keywords": [
    {
      "keyword": "security camera",
      "searchVolume": 74000,
      "competition": "HIGH",
      "competitionIndex": 85,
      "lowBid": 0.5,
      "highBid": 2.5
    }
  ]
}
```

### 5. 创意生成增强 (`src/lib/ad-creative-generator.ts`)
- 生成创意时自动获取关键词搜索量
- 返回`keywordsWithVolume`数组
- Prompt增强：要求生成sitelinks

### 6. 前端UI增强 (`src/app/(app)/creatives/page.tsx`)
- 广告预览卡片
- Headlines列表（带字符数）
- Descriptions列表（带字符数）
- Keywords标签（带搜索量显示）
- Callouts标签
- Sitelinks卡片网格

## 配置要求

### .env配置
```env
# Redis配置
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_KEY_PREFIX=autoads:

# Google Ads API（已有）
GOOGLE_ADS_CLIENT_ID=xxx
GOOGLE_ADS_CLIENT_SECRET=xxx
GOOGLE_ADS_DEVELOPER_TOKEN=xxx
GOOGLE_ADS_REFRESH_TOKEN=xxx
GOOGLE_ADS_LOGIN_CUSTOMER_ID=xxx
GOOGLE_ADS_CUSTOMER_IDS=xxx
```

### 数据库迁移
```bash
npx tsx scripts/add-keyword-sitelink-tables.ts
```

## 数据流

```
1. 创意生成请求
   ↓
2. AI生成headlines/descriptions/keywords/callouts/sitelinks
   ↓
3. 获取关键词搜索量
   ├── Redis缓存命中 → 返回
   ├── global_keywords表命中 → 返回+更新Redis
   └── Keyword Planner API → 返回+更新Redis+更新数据库
   ↓
4. 返回完整创意数据（含keywordsWithVolume）
   ↓
5. 前端展示完整广告预览
```

## 支持的国家和语言

### 国家代码
US, UK/GB, CA, AU, DE, FR, JP, CN, KR, BR, IN, MX, ES, IT

### 语言代码
en, zh, es, fr, de, ja, ko, pt, it, ru

## 文件清单

| 文件 | 说明 |
|------|------|
| `src/lib/redis.ts` | Redis客户端（新增关键词缓存函数） |
| `src/lib/keyword-planner.ts` | Keyword Planner服务（新建） |
| `src/lib/ad-creative-generator.ts` | 创意生成器（增强） |
| `src/app/api/keywords/volume/route.ts` | 关键词API（新建） |
| `src/app/(app)/creatives/page.tsx` | 创意页面UI（增强） |
| `scripts/add-keyword-sitelink-tables.ts` | 数据库迁移（新建） |
| `.env.example` | 环境变量模板（新增Redis配置） |
