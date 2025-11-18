# AutoAds 技术规格文档

**创建日期**: 2025-01-17
**负责人**: Engineering Team
**状态**: ✅ Design Approved

---

## 1. 技术架构概览

### 1.1 架构选择

**核心决策**: **Backend SQLite + Frontend Cache 混合架构**

**架构优势**：
- ✅ **数据安全性**：后端持久化，不会因清除浏览器缓存丢失
- ✅ **跨设备同步**：登录即可在任何设备访问数据
- ✅ **数据备份**：自动每日备份，数据安全有保障
- ✅ **技术支持**：管理员可查看用户数据进行问题排查
- ✅ **低复杂度**：前端逻辑简化，状态管理更清晰
- ⚠️ **部署成本**：中等（需SQLite文件存储）

**架构类型**: JAMstack + Backend Database（SQLite）

---

### 1.2 技术栈

#### 前端技术栈

| 层级 | 技术选型 | 版本 | 说明 |
|------|---------|------|------|
| **前端框架** | Next.js | 14+ | React SSR框架，App Router |
| **UI组件库** | Shadcn/ui | Latest | 基于Radix UI的组件系统 |
| **样式方案** | Tailwind CSS | 3.x | Utility-first CSS框架 |
| **本地缓存** | IndexedDB (idb) | 8.x | 浏览器数据库（缓存+离线缓冲） |
| **状态管理** | Zustand | 4.x | 轻量级状态管理 |
| **数据请求** | TanStack Query | 5.x | 数据同步和缓存 |
| **表单管理** | React Hook Form | 7.x | 高性能表单库 |
| **图表可视化** | Recharts | 2.x | React图表库 |
| **日期处理** | date-fns | 3.x | 轻量级日期库 |

#### 后端技术栈（新增）

| 层级 | 技术选型 | 版本 | 说明 |
|------|---------|------|------|
| **后端框架** | Next.js API Routes | 14+ | 与前端统一框架 |
| **数据库** | SQLite | 3.x | 零配置、高性能嵌入式数据库 |
| **ORM** | better-sqlite3 | 9.x | 同步API、高性能 |
| **认证** | JWT (jsonwebtoken) | 9.x | 无状态token认证 |
| **密码加密** | bcrypt | 5.x | 行业标准密码哈希 |
| **定时任务** | node-cron | 3.x | 数据库自动备份 |
| **数据加密** | crypto (Node.js) | - | AES-256-GCM加密OAuth token |

#### 外部API（与v1.0一致）

| API | 技术选型 | 版本 | 说明 |
|-----|---------|------|------|
| **Google Ads API** | google-ads-api | Latest | 官方Node.js SDK |
| **AI API (主)** | Gemini 2.5 | Latest | 创意生成、质量评分 |
| **AI API (备)** | Claude 4.5 | Latest | Gemini失败时降级 |

---

### 1.3 系统架构图

```
┌───────────────────────────────────────────────────────────────────┐
│                       浏览器（用户设备）                           │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                    Next.js Frontend                           │ │
│  │  ┌────────┬────────┬────────┬────────┬──────────┐           │ │
│  │  │Login   │Dashboard│Offers │Campaigns│Settings │ (Pages)   │ │
│  │  └────────┴────────┴────────┴────────┴──────────┘           │ │
│  │  ┌───────────────────────────────────────────────┐           │ │
│  │  │    React Components (Shadcn/ui)              │           │ │
│  │  └───────────────────────────────────────────────┘           │ │
│  │  ┌───────────────────────────────────────────────┐           │ │
│  │  │    State Management (Zustand)                │           │ │
│  │  └───────────────────────────────────────────────┘           │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                            ↓ ↑                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │              IndexedDB（缓存+离线缓冲）                       │ │
│  │  ┌──────────┬──────────┬──────────┬──────────┐              │ │
│  │  │pending_  │perf_cache│ui_prefs  │drafts    │ (4个表)      │ │
│  │  │offers    │          │          │          │              │ │
│  │  └──────────┴──────────┴──────────┴──────────┘              │ │
│  │              本地缓存（10MB+）                                 │ │
│  └──────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────┘
                             ↓ ↑ HTTP + JWT
┌───────────────────────────────────────────────────────────────────┐
│                   Next.js Backend (API Routes)                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  /api/auth/*        (登录、修改密码、验证token)            │  │
│  │  /api/offers/*      (Offer CRUD)                           │  │
│  │  /api/campaigns/*   (Campaign CRUD)                        │  │
│  │  /api/launch-score/* (Launch Score生成)                    │  │
│  │  /api/data/export   (数据导出)                             │  │
│  │  /api/admin/*       (管理员功能)                           │  │
│  └────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
                             ↓ ↑
┌───────────────────────────────────────────────────────────────────┐
│                    SQLite Database (autoads.db)                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  users, google_ads_accounts, offers, campaigns,            │  │
│  │  launch_scores, creatives, weekly_recommendations,         │  │
│  │  campaign_performance, search_term_reports, rate_limits    │  │
│  │                       (10个表)                              │  │
│  │  🆕 数据库连接单例 + 乐观锁并发控制                          │  │
│  └────────────────────────────────────────────────────────────┘  │
│              持久化存储（50MB+，每日备份）                        │
└───────────────────────────────────────────────────────────────────┘
                             ↓ ↑
           ┌─────────────────────────────────────────────┐
           │           External APIs                     │
           ├─────────────────────────────────────────────┤
           │  Google Ads API                             │
           │  - OAuth认证                                │
           │  - Campaign CRUD                            │
           │  - Performance Data Query                   │
           │  - Keyword Planner                          │
           ├─────────────────────────────────────────────┤
           │  AI API (Gemini 2.5 + Claude 4.5)          │
           │  - Creative Generation (主:Gemini)          │
           │  - Launch Score Analysis (主:Gemini)        │
           │  - Quality Scoring (备用:Claude)            │
           └─────────────────────────────────────────────┘
```

---

### 1.4 数据分层策略

#### 后端SQLite（主数据存储）

**存储内容**：所有核心业务数据

| 表名 | 说明 | 特点 |
|------|------|------|
| **users** | 用户账号、套餐、有效期 | 认证核心 |
| **google_ads_accounts** | Google Ads账号 + OAuth token | 敏感数据 |
| **offers** | Offer核心数据 | 业务核心 |
| **campaigns** | Campaign元数据 | 业务核心 |
| **launch_scores** | 投放评估结果 | AI计算成本高，缓存复用 |
| **creatives** | AI生成的创意 | 避免重复调用AI |
| 🆕 **weekly_recommendations** | 每周优化建议 | 数据驱动优化核心 |
| 🆕 **campaign_performance** | 每日性能数据 | 优化算法数据源 |
| 🆕 **search_term_reports** | 搜索词报告 | Rule 5关键词优化 |
| 🆕 **rate_limits** | API限流记录 | 防止滥用，替代内存Map |

**特点**：
- 数据量小（每个用户< 10MB）
- 更新频率低（创建后很少修改）
- 价值高（丢失后用户损失大）
- 需要跨设备同步
- 自动每日备份

---

#### 前端IndexedDB（缓存层）

**存储内容**：临时缓存（可丢弃重建）

| 表名 | 说明 | 特点 |
|------|------|------|
| **campaign_performance_cache** | 性能数据缓存（7天过期） | 大数据量缓存 |
| **ui_preferences** | UI偏好设置 | 纯前端状态 |
| **draft_edits** | 未保存的临时编辑 | 纯前端状态 |

**特点**：
- 可重新拉取或丢弃，无持久化需求
- 大数据量（性能数据可达几十MB）
- 高更新频率（每日同步）
- 丢失后影响小

---

### 1.5 数据流向

#### 在线创建Offer流程

```
用户登录（JWT认证）
  ↓
用户创建Offer
  ↓
【在线】直接POST /api/offers
  ↓
后端验证JWT → 提取userId
  ↓
保存到SQLite (offers表, user_id=userId)
  ↓
返回Offer对象给前端
  ↓
前端更新UI显示
```

#### ❌ 离线创建Offer（已移除）

**移除原因**：增加大量复杂度（pending_offers表、自动同步逻辑、失败重试），初期用户少，离线场景不多。

**替代方案**：用户在线时创建Offer，离线时提示"请连接网络后操作"。V2.0再考虑离线支持。

#### Launch Score + 创意生成流程

```
用户点击"📊 投放分析"
  ↓
POST /api/offers/[id]/launch-score
  ↓
后端收集数据：
  • Google Ads Keyword Planner API (搜索量、竞争度、CPC)
  • 产品页爬取 (评分、评论数、价格)
  • 着陆页分析 (内容、性能、SEO)
  • 品牌搜索量查询
  ↓
调用AI API (Gemini 2.5)生成营销洞察
  ↓
保存到SQLite (launch_scores表)
  ↓
更新Offer关联字段 (latestLaunchScoreId, lastLaunchScoreAt)
  ↓
返回Launch Score给前端
  ↓
═══════════════════════════════════════════
用户点击"一键上广告"
  ↓
前端准备CreativeInput：
  • 基础信息 (品牌、描述、关键词、URL)
  • 🆕 Launch Score洞察（从后端已保存的记录读取）
    - 核心优势卖点
    - 推荐营销角度
    - 高搜索量关键词
    - 产品评分数据
  ↓
POST /api/creatives/generate
  ↓
后端AI API生成创意（融入Launch Score洞察）
  ↓
保存创意到SQLite (creatives表)
  ↓
返回创意给前端
  ↓
用户确认创意
  ↓
POST /api/campaigns/create
  ↓
后端调用Google Ads API创建Campaign
  ↓
保存Campaign元数据到SQLite (campaigns表)
  ↓
返回Campaign给前端
```

#### 性能数据同步流程

```
用户每次打开Dashboard
  ↓
前端检查campaign_performance_cache
  ↓
如果缓存过期（> 7天） → GET /api/campaigns/[id]/performance
  ↓
后端查询Google Ads API
  ↓
返回最新性能数据
  ↓
前端保存到IndexedDB cache
  ↓
从缓存读取并可视化
```

---

## 2. 后端SQLite数据模型

### 2.1 数据库Schema

**数据库文件**: `/data/autoads.db`
**版本**: 1
**格式**: SQLite 3.x

### 2.1.1 users（用户账号表）

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- 账号信息
  username TEXT UNIQUE NOT NULL,              -- 用户名（4-20位）
  password_hash TEXT NOT NULL,                -- bcrypt加密密码
  display_name TEXT NOT NULL,                 -- 显示名称
  email TEXT,                                 -- 邮箱（可选）

  -- 角色和权限
  role TEXT NOT NULL DEFAULT 'user',          -- 角色：'admin' | 'user'

  -- 套餐信息
  package_type TEXT NOT NULL,                 -- 套餐类型：'annual' | 'lifetime' | 'private' | 'trial'
  valid_from TEXT NOT NULL,                   -- 有效期开始日期（ISO 8601）
  valid_until TEXT NOT NULL,                  -- 有效期结束日期（ISO 8601）

  -- 状态
  is_active INTEGER NOT NULL DEFAULT 1,       -- 是否启用：1=启用, 0=禁用
  must_change_password INTEGER NOT NULL DEFAULT 1,  -- 首次登录修改密码：1=必须, 0=不必须

  -- 并发控制
  version INTEGER NOT NULL DEFAULT 1,         -- 乐观锁版本号（并发更新控制）

  -- 时间戳
  last_login_at TEXT,                         -- 最后登录时间
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER,                         -- 创建者user_id（管理员）

  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_valid_until ON users(valid_until);
CREATE INDEX idx_users_role ON users(role);
```

**套餐类型说明**：

| package_type | 名称 | 价格 | 有效期 | 说明 |
|-------------|------|------|--------|------|
| `annual` | 年卡 | ¥5,999 | 365天 | 适合BB新人 |
| `lifetime` | 终身买断 | ¥10,999 | 100年 | 适合持续投入的个人 |
| `private` | 私有化部署 | ¥29,999 | 1年+续签 | 独立工作室，含技术支持 |
| `trial` | 试用套餐 | 免费 | 7/14/30天 | 市场推广活动 |

**默认管理员**：
```sql
INSERT INTO users (
  username, password_hash, display_name,
  role, package_type, valid_from, valid_until,
  must_change_password
) VALUES (
  'autoads',
  '$2b$10$...', -- bcrypt hash of 'K$j6z!9Tq@P2w#aR'
  'AutoAds管理员',
  'admin',
  'lifetime',
  '2025-01-17T00:00:00Z',
  '2099-12-31T23:59:59Z',
  0  -- 管理员无需修改密码
);
```

---

### 2.1.2 google_ads_accounts（Google Ads账号表）

```sql
CREATE TABLE google_ads_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,

  -- Google Ads账号信息
  customer_id TEXT NOT NULL,                    -- Google Ads客户ID（10位数字）
  account_name TEXT NOT NULL,                   -- 账号名称
  currency_code TEXT NOT NULL DEFAULT 'USD',    -- 货币代码
  timezone TEXT NOT NULL DEFAULT 'UTC',         -- 时区
  industry TEXT,                                -- 🆕 行业分类（用于行业基准对比）

  -- OAuth认证信息（加密存储）
  access_token TEXT,                            -- 访问令牌（AES-256-GCM加密）
  refresh_token TEXT,                           -- 刷新令牌（AES-256-GCM加密）
  token_expires_at TEXT,                        -- 令牌过期时间

  -- 账号状态
  is_manager_account INTEGER NOT NULL DEFAULT 0,  -- 是否MCC管理账号
  is_active INTEGER NOT NULL DEFAULT 1,           -- 是否启用
  last_synced_at TEXT,                            -- 最后同步时间

  -- 时间戳
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_google_ads_accounts_user_id ON google_ads_accounts(user_id);
CREATE INDEX idx_google_ads_accounts_customer_id ON google_ads_accounts(customer_id);
```

**OAuth Token加密**：
```typescript
// 加密：存储到数据库前
const encrypted = encryptToken(accessToken, ENCRYPTION_KEY);

// 解密：从数据库读取后
const decrypted = decryptToken(encrypted, ENCRYPTION_KEY);
```

---

### 2.1.3 offers（Offer表）

```sql
CREATE TABLE offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,

  -- 用户输入字段（4个必填）
  affiliate_link TEXT NOT NULL,                 -- 推广链接（Affiliate跟踪URL）
  brand_name TEXT NOT NULL,                     -- 品牌名称
  target_country TEXT NOT NULL,                 -- 推广国家（US, GE, FR等）
  shop_url TEXT NOT NULL,                       -- 店铺或商品落地页（用于AI抓取产品信息）

  -- 自动生成字段（2个）
  offer_name TEXT NOT NULL,                     -- Offer唯一标识：[品牌]_[国家]_[序号]，如：Reolink_US_01
  target_language TEXT NOT NULL,                -- 推广语言（根据国家自动映射：US→English, GE→German等）

  -- 延迟生成字段（在"一键上广告"时AI抓取/生成）
  product_name TEXT,                            -- 产品名称（AI从shop_url抓取）
  product_description TEXT,                     -- 产品描述（AI从shop_url抓取）
  category TEXT,                                -- 产品类目（AI从shop_url抓取）
  target_keywords TEXT,                         -- 目标关键词（AI生成后验证，JSON数组）
  budget_daily REAL,                            -- 每日预算（美元，根据target_cpc×30自动计算）
  target_cpc REAL,                              -- 目标CPC（美元，基于Keyword Planner API建议）

  -- Google Ads关联
  google_ads_account_id INTEGER,                -- 关联的Google Ads账号

  -- Launch Score关联
  latest_launch_score_id INTEGER,               -- 最新的Launch Score记录ID
  last_launch_score_at TEXT,                    -- 最后一次评分时间
  last_launch_score_value REAL,                 -- 最后一次评分值（0-100）
  last_launch_score_grade TEXT,                 -- 最后一次评分等级

  -- 广告投放状态
  ad_status TEXT NOT NULL DEFAULT 'not_launched', -- 广告投放状态：not_launched | launching | active | paused
  is_archived INTEGER NOT NULL DEFAULT 0,       -- 是否归档

  -- 并发控制
  version INTEGER NOT NULL DEFAULT 1,           -- 乐观锁版本号（并发更新控制）

  -- 时间戳
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (google_ads_account_id) REFERENCES google_ads_accounts(id) ON DELETE SET NULL,
  FOREIGN KEY (latest_launch_score_id) REFERENCES launch_scores(id) ON DELETE SET NULL
);

-- 索引
CREATE INDEX idx_offers_user_id ON offers(user_id);
CREATE INDEX idx_offers_ad_status ON offers(ad_status);
CREATE INDEX idx_offers_google_ads_account_id ON offers(google_ads_account_id);
CREATE UNIQUE INDEX idx_offers_unique_name ON offers(user_id, offer_name);  -- 确保每个用户的Offer名称唯一
```

**数据隔离**：通过 `user_id` 外键，每个用户只能访问自己的Offer

**字段设计说明**：

1. **4+2字段设计** - 遵循KISS原则（Keep It Simple, Stupid）
   - **4个用户输入字段**：affiliate_link, brand_name, target_country, shop_url
   - **2个自动生成字段**：offer_name（Offer ID）, target_language（根据国家映射）
   - **其他字段延迟生成**：在"一键上广告"时通过AI抓取/生成

2. **ad_status状态流**
   - `not_launched`：Offer已创建，未执行"一键上广告"（初始状态）
   - `launching`：正在执行"一键上广告"（AI处理中）
   - `active`：Google Ads Campaign已创建（Campaign可能是PAUSED状态）
   - `paused`：Campaign已暂停（注：与Campaign.status区分）

3. **offer_name生成规则**
   - 格式：`[品牌名称]_[国家代号]_[序号]`
   - 示例：Reolink_US_01, Reolink_US_02, Anker_GE_01
   - 通过唯一索引确保每个用户的Offer名称不重复

4. **延迟生成字段** - 在"一键上广告"时填充
   - `product_name`, `product_description`, `category`：通过Playwright + 代理访问shop_url，使用GPT-4o提取
   - `target_keywords`：通过GPT-4o生成候选关键词，使用Keyword Planner API验证搜索量
   - `budget_daily`, `target_cpc`：基于Keyword Planner API的建议CPC自动计算（target_cpc × 30次点击）

**相关文档**：
- **OFFER_CREATION_DESIGN.md**：手动创建Offer的详细流程
- **BATCH_IMPORT_DESIGN.md**：批量导入Offer的CSV格式和流程
- **ONE_CLICK_LAUNCH.md**：延迟字段的生成流程（AI抓取、关键词生成、预算计算）

---

### 2.1.4 campaigns（Campaign表）

```sql
CREATE TABLE campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  offer_id INTEGER NOT NULL,

  -- Google Ads Campaign信息
  google_campaign_id TEXT NOT NULL,             -- Google Ads Campaign ID
  google_campaign_name TEXT NOT NULL,           -- Campaign名称
  campaign_type TEXT NOT NULL,                  -- Campaign类型：SEARCH | DISPLAY | VIDEO

  -- Campaign配置
  budget_daily REAL NOT NULL,                   -- 每日预算
  target_cpc REAL,                              -- 目标CPC
  target_languages TEXT,                        -- 目标语言（JSON数组）
  target_locations TEXT,                        -- 目标地区（JSON数组）

  -- Campaign状态
  status TEXT NOT NULL,                         -- 状态：ENABLED | PAUSED | REMOVED
  google_status TEXT,                           -- Google Ads同步的状态

  -- 统计信息（冗余，避免频繁查询Google Ads API）
  total_impressions INTEGER DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,
  total_cost REAL DEFAULT 0,
  average_cpc REAL,
  ctr REAL,                                     -- 点击率

  -- 并发控制
  version INTEGER NOT NULL DEFAULT 1,           -- 乐观锁版本号（并发更新控制）

  -- 时间戳
  last_synced_at TEXT,                          -- 最后同步时间
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE
);

CREATE INDEX idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX idx_campaigns_offer_id ON campaigns(offer_id);
CREATE INDEX idx_campaigns_google_campaign_id ON campaigns(google_campaign_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
```

---

### 2.1.5 launch_scores（投放评估表）

```sql
CREATE TABLE launch_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  offer_id INTEGER NOT NULL,

  -- 总分
  total_score REAL NOT NULL,                    -- 总分（0-100）
  grade TEXT NOT NULL,                          -- 等级：excellent | good | average | poor | very_poor

  -- 5维度评分
  keyword_quality_score REAL NOT NULL,          -- 关键词质量（30分）
  product_market_fit_score REAL NOT NULL,       -- 产品市场契合度（25分）
  landing_page_quality_score REAL NOT NULL,     -- 着陆页质量（20分）
  budget_competitiveness_score REAL NOT NULL,   -- 预算竞争力（15分）
  ad_content_potential_score REAL NOT NULL,     -- 广告内容潜力（10分）

  -- AI分析结果（JSON存储）
  ai_analysis_summary TEXT,                     -- 分析摘要
  ai_analysis_strengths TEXT,                   -- 核心优势（JSON数组）
  ai_analysis_weaknesses TEXT,                  -- 需要改进（JSON数组）
  ai_analysis_recommendations TEXT,             -- 改进建议（JSON数组）
  ai_analysis_marketing_angle TEXT,             -- 推荐营销角度

  -- 数据来源标记（JSON存储）
  data_sources TEXT,                            -- 数据来源标记

  -- 有效期
  calculated_at TEXT NOT NULL DEFAULT (datetime('now')),
  valid_until TEXT NOT NULL,                    -- 有效期（7天）
  is_expired INTEGER NOT NULL DEFAULT 0,        -- 是否过期

  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE
);

CREATE INDEX idx_launch_scores_user_id ON launch_scores(user_id);
CREATE INDEX idx_launch_scores_offer_id ON launch_scores(offer_id);
CREATE INDEX idx_launch_scores_valid_until ON launch_scores(valid_until);
```

**Launch Score等级**：

| Grade | 分数范围 | 含义 | 建议 |
|-------|---------|------|------|
| `excellent` | 80-100 | 优秀 | 立即上广告 |
| `good` | 65-79 | 良好 | 可适度投放 |
| `average` | 50-64 | 中等 | 优化后投放 |
| `poor` | 35-49 | 较差 | 需要改进 |
| `very_poor` | 0-34 | 很差 | 暂不建议投放 |

---

### 2.1.6 creatives（广告创意表）

```sql
CREATE TABLE creatives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  offer_id INTEGER NOT NULL,

  -- 生成输入（JSON存储）
  generation_inputs TEXT NOT NULL,              -- CreativeInput接口序列化

  -- 生成的创意内容（JSON存储）
  generated_headlines TEXT NOT NULL,            -- 标题列表（JSON数组）
  generated_descriptions TEXT NOT NULL,         -- 描述列表（JSON数组）
  generated_callouts TEXT,                      -- 附加信息（JSON数组）
  generated_sitelinks TEXT,                     -- 附加链接（JSON数组）

  -- 质量评分（JSON存储）
  quality_score_overall REAL,                   -- 总分（0-100）
  quality_score_breakdown TEXT,                 -- 维度评分（JSON对象）
  quality_score_grade TEXT,                     -- 等级
  quality_score_suggestions TEXT,               -- 改进建议（JSON数组）

  -- 用户编辑
  user_edited INTEGER NOT NULL DEFAULT 0,       -- 是否用户编辑过
  edited_headlines TEXT,                        -- 编辑后的标题
  edited_descriptions TEXT,                     -- 编辑后的描述
  edited_callouts TEXT,                         -- 编辑后的附加信息
  edited_sitelinks TEXT,                        -- 编辑后的附加链接

  -- 网站分析（JSON存储）
  website_analysis TEXT,                        -- 网站分析结果

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE
);

CREATE INDEX idx_creatives_user_id ON creatives(user_id);
CREATE INDEX idx_creatives_offer_id ON creatives(offer_id);
```

**注**：每个Offer只保留一个最新创意（应用层控制）

---

### ❌ 2.1.7-2.1.8 已移除的表（简化MVP）

**移除的表**：
- ❌ **sync_logs** - 同步日志监控表
- ❌ **backup_logs** - 备份历史追踪表

**移除原因**：
- 监控功能在MVP阶段可通过`console.log`和日志文件解决
- 备份历史追踪属于运维功能，非核心业务
- 简化备份策略为简单cron任务即可

**替代方案**：
```bash
# 简单cron任务替代复杂的backup_logs表
0 2 * * * cp /data/autoads.db /data/backups/autoads_$(date +\%Y\%m\%d).db && find /data/backups -mtime +7 -delete
```

---

### 2.1.7 weekly_recommendations（每周优化建议表）

**说明**：系统每周自动生成的优化建议清单（KISS版本）

```sql
CREATE TABLE weekly_recommendations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,

  -- 建议内容
  priority TEXT NOT NULL,                -- high | medium | low
  type TEXT NOT NULL,                    -- pause | increase_budget | decrease_budget | optimize_creative | adjust_cpc
  campaign_id INTEGER NOT NULL,
  campaign_name TEXT NOT NULL,
  offer_name TEXT NOT NULL,

  reason TEXT NOT NULL,                  -- 建议原因（用户可读）
  action TEXT NOT NULL,                  -- 建议操作（用户可读）
  expected_impact TEXT NOT NULL,         -- 预期效果（用户可读）

  -- 性能数据快照（JSON）
  -- 示例：{"ctr": 0.032, "cpc": 1.2, "cost": 450, "conversions": 42, "cpa": 11.38, "roi": 2.4}
  metrics TEXT NOT NULL,

  -- 状态追踪
  status TEXT NOT NULL DEFAULT 'pending', -- pending | applied | ignored
  applied_at TEXT,                       -- 应用时间

  -- 元数据
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);

CREATE INDEX idx_weekly_rec_user_status ON weekly_recommendations(user_id, status);
CREATE INDEX idx_weekly_rec_created ON weekly_recommendations(created_at DESC);
CREATE INDEX idx_weekly_rec_priority ON weekly_recommendations(priority);
```

**建议类型说明**：
- `pause` - 暂停低效Campaign
- `increase_budget` - 增加高效Campaign预算
- `decrease_budget` - 降低低效Campaign预算
- `optimize_creative` - 重新生成创意
- `adjust_cpc` - 调整CPC出价
- 🆕 `add_keyword` - 添加高转化关键词（Rule 5）
- 🆕 `adjust_bid_by_hour` - 按小时调整出价（Rule 6）
- 🆕 `adjust_schedule` - 优化投放时段（Rule 7）
- 🆕 `device_optimization` - 设备定向优化（Rule 8）

**生成规则**：
- 每周一凌晨00:30自动运行分析
- 基于过去7天的性能数据
- 仅分析状态为ENABLED的Campaign
- 最小样本量：展示量 >= 1000

---

### 2.1.10 campaign_performance（Campaign每日性能表）

**说明**：存储Campaign每日的性能数据，用于优化算法计算趋势、ROI等指标

```sql
CREATE TABLE campaign_performance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  campaign_id INTEGER NOT NULL,

  -- 日期维度
  date TEXT NOT NULL,                        -- 日期（YYYY-MM-DD）
  hour_of_day INTEGER,                       -- 🆕 小时（0-23，用于Rule 6/7时段优化）
  device TEXT,                               -- 🆕 设备类型：MOBILE | DESKTOP | TABLET（用于Rule 8）

  -- 性能指标
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,

  -- 计算指标
  ctr REAL,                                  -- 点击率 = clicks / impressions
  cpc REAL,                                  -- 每次点击成本 = cost / clicks
  cpa REAL,                                  -- 每次转化成本 = cost / conversions
  conversion_rate REAL,                      -- 转化率 = conversions / clicks
  roi REAL,                                  -- ROI（需要结合Offer的revenue数据）

  -- 时间戳
  synced_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

CREATE INDEX idx_campaign_perf_user_id ON campaign_performance(user_id);
CREATE INDEX idx_campaign_perf_campaign_date ON campaign_performance(campaign_id, date);
CREATE INDEX idx_campaign_perf_date ON campaign_performance(date);
CREATE INDEX idx_campaign_perf_hour ON campaign_performance(hour_of_day);
CREATE INDEX idx_campaign_perf_device ON campaign_performance(device);
```

**数据来源**：
- 每日凌晨自动从Google Ads API同步前一天的性能数据
- 支持按小时、按设备维度拆分（用于时段和设备优化）

**数据保留**：
- 保留最近90天的数据
- 超过90天的数据自动归档或删除

---

### 2.1.11 search_term_reports（搜索词报告表）

**说明**：存储Google Ads Search Term报告数据，用于Rule 5关键词优化

```sql
CREATE TABLE search_term_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  campaign_id INTEGER NOT NULL,

  -- 搜索词信息
  search_term TEXT NOT NULL,                 -- 用户搜索词
  match_type TEXT NOT NULL,                  -- 匹配类型：EXACT | PHRASE | BROAD

  -- 性能数据（过去7天汇总）
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,

  -- 计算指标
  ctr REAL,                                  -- 点击率
  cpc REAL,                                  -- 每次点击成本
  conversion_rate REAL,                      -- 转化率

  -- 关键词状态
  is_keyword INTEGER NOT NULL DEFAULT 0,     -- 是否已添加为关键词（0=否, 1=是）
  added_as_keyword_at TEXT,                  -- 添加为关键词的时间

  -- 时间范围
  date_start TEXT NOT NULL,                  -- 数据开始日期
  date_end TEXT NOT NULL,                    -- 数据结束日期

  -- 时间戳
  synced_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

CREATE INDEX idx_search_terms_user_id ON search_term_reports(user_id);
CREATE INDEX idx_search_terms_campaign_id ON search_term_reports(campaign_id);
CREATE INDEX idx_search_terms_ctr ON search_term_reports(ctr DESC);
CREATE INDEX idx_search_terms_is_keyword ON search_term_reports(is_keyword);
```

**数据来源**：
- 每周一凌晨从Google Ads API同步Search Term Report
- 仅同步过去7天、展示量 >= 100的搜索词

**Rule 5使用场景**：
- 查询CTR高于Campaign平均CTR 20%以上的搜索词
- 推荐添加为关键词（短语匹配或精确匹配）

---

### 🆕 2.1.12 rate_limits（API限流表）

**说明**：记录API请求频率，防止滥用和暴力破解攻击（替代内存Map方案）

```sql
CREATE TABLE rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL,                  -- 限流标识（IP地址或user_id）
  action TEXT NOT NULL,                      -- 操作类型（login, api_request等）

  -- 限流计数
  request_count INTEGER NOT NULL DEFAULT 1,  -- 当前窗口请求次数
  window_start TEXT NOT NULL,                -- 窗口开始时间

  -- 封禁状态
  is_blocked INTEGER NOT NULL DEFAULT 0,     -- 是否被封禁（0=否, 1=是）
  blocked_until TEXT,                        -- 封禁解除时间

  -- 时间戳
  last_request_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_rate_limits_identifier_action ON rate_limits(identifier, action);
CREATE INDEX idx_rate_limits_window ON rate_limits(window_start);
CREATE INDEX idx_rate_limits_blocked ON rate_limits(is_blocked, blocked_until);
```

**限流策略**：
- **登录限流**：同一IP 5分钟内最多5次失败，超过封禁5分钟
- **API限流**：同一用户1分钟内最多100次API请求
- **窗口管理**：每分钟自动重置计数器（window_start + 1分钟 < now）

**优势**：
- 替代内存Map方案，支持多实例部署（多进程/多服务器）
- 数据持久化，服务重启不丢失限流状态
- 可查询历史攻击记录，用于安全审计

---

### 🆕 2.1.13 system_settings（系统配置表）

**说明**：存储系统运行所需的所有配置项（Google Ads API、AI配置、代理配置等）

```sql
CREATE TABLE system_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,                           -- 用户ID（NULL表示全局配置）

  -- 配置项标识
  category TEXT NOT NULL,                    -- 配置分类：'google_ads' | 'ai' | 'proxy' | 'system'
  config_key TEXT NOT NULL,                  -- 配置键名
  config_value TEXT,                         -- 配置值（明文）
  encrypted_value TEXT,                      -- 加密配置值（敏感信息）

  -- 元数据
  data_type TEXT NOT NULL DEFAULT 'string',  -- 数据类型：'string' | 'number' | 'boolean' | 'json'
  is_sensitive INTEGER NOT NULL DEFAULT 0,   -- 是否敏感信息：1=是（使用encrypted_value）, 0=否
  is_required INTEGER NOT NULL DEFAULT 0,    -- 是否必填配置：1=是, 0=否

  -- 验证和状态
  validation_status TEXT,                    -- 验证状态：'valid' | 'invalid' | 'pending' | null
  validation_message TEXT,                   -- 验证结果消息
  last_validated_at TEXT,                    -- 最后验证时间

  -- 默认值
  default_value TEXT,                        -- 默认值
  description TEXT,                          -- 配置说明

  -- 时间戳
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_system_settings_user_category_key
  ON system_settings(user_id, category, config_key);
CREATE INDEX idx_system_settings_category ON system_settings(category);
CREATE INDEX idx_system_settings_required ON system_settings(is_required);
```

**核心配置项示例**：

**Google Ads API配置** (category='google_ads'):
- `developer_token` - Developer Token（敏感信息）
- `client_id` - Client ID
- `client_secret` - Client Secret（敏感信息）
- `refresh_token` - Refresh Token（敏感信息）
- `customer_id` - 默认Customer ID

**AI配置** (category='ai'):
- `gemini_api_key` - Gemini 2.5 API Key（敏感信息）
- `gemini_model` - Gemini模型名称（默认：gemini-2.5-flash）
- `claude_api_key` - Claude 4.5 API Key（敏感信息，备用）
- `claude_model` - Claude模型名称（默认：claude-sonnet-4.5）

**代理配置** (category='proxy'):
- `proxy_url` - 代理服务器URL
- `proxy_enabled` - 是否启用代理（boolean）

**系统配置** (category='system'):
- `default_currency` - 默认货币（默认：CNY）
- `default_language` - 默认语言（默认：zh-CN）
- `sync_interval_minutes` - 数据同步间隔（默认：5）

**安全措施**：
- 敏感信息使用AES-256-GCM加密存储在`encrypted_value`字段
- 加密密钥从环境变量读取（`ENCRYPTION_KEY`）
- 普通配置存储在`config_value`字段（明文）
- 支持用户级配置（user_id不为NULL）和全局配置（user_id为NULL）

**验证机制**：
- 配置项修改后自动触发验证（测试API连接、验证API key有效性）
- 验证结果存储在`validation_status`和`validation_message`字段
- 前端根据验证状态显示配置项状态（✅ 已配置/❌ 验证失败/⏳ 待验证）

---

### ❌ 2.1.14 top_performing_creatives（已移除 - 用聚合查询替代）

**移除原因**：
- AI学习功能属于高级特性，MVP阶段非核心需求
- 增加定时任务复杂度（每周分析创意性能）
- 数据可通过`campaign_performance`和`creatives`表临时聚合查询获得

**替代方案**：
```sql
-- MVP阶段使用SQL聚合查询获取Top创意（需要时执行）
SELECT
  c.id AS creative_id,
  c.headline,
  c.description,
  AVG(cp.ctr) AS avg_ctr,
  SUM(cp.impressions) AS total_impressions,
  SUM(cp.clicks) AS total_clicks
FROM creatives c
JOIN campaigns cam ON c.campaign_id = cam.id
JOIN campaign_performance cp ON cp.campaign_id = cam.id
WHERE c.user_id = ?
  AND cp.impressions >= 1000
  AND cp.ctr >= 3.0
  AND cp.date >= date('now', '-30 days')
GROUP BY c.id
ORDER BY avg_ctr DESC
LIMIT 10;
```

**V2.0考虑**：如果AI Prompt优化成为核心功能，再引入专用表存储

---

## 3. 前端IndexedDB数据模型

### 3.1 数据库Schema

**数据库名称**: `autoads-cache-db`
**版本**: 1

### ❌ 3.1.1 pending_offers（已移除 - 离线支持延后）

**移除原因**：离线Offer创建增加复杂度（同步逻辑、失败重试），MVP阶段用户量少，离线场景不多。

**替代方案**：用户离线时提示"请连接网络后操作"，V2.0再考虑PWA离线支持。

---

### 3.1.2 campaign_performance_cache（性能数据缓存表）

```typescript
interface CachedPerformance {
  cacheId: string;                // Primary Key（campaignId + date）
  userId: number;                 // 用户ID
  campaignId: string;             // Campaign ID
  date: string;                   // 日期（YYYY-MM-DD）

  // 性能指标
  metrics: {
    impressions: number;
    clicks: number;
    cost: number;
    conversions: number;
    ctr: number;
    averageCpc: number;
    conversionRate: number;
    costPerConversion: number;
  };

  // 缓存元数据
  cachedAt: string;               // 缓存时间
  expiresAt: string;              // 过期时间（7天后）
}

// 索引
- by-user: userId
- by-campaign: campaignId
- by-expires: expiresAt
```

**用途**：缓存从Google Ads API拉取的性能数据，避免频繁API调用

---

### 3.1.3 ui_preferences（UI偏好设置表）

```typescript
interface UIPreferences {
  userId: number;                 // Primary Key

  // Offer列表偏好
  offerListView: 'grid' | 'table';
  offerListSortBy: 'createdAt' | 'name' | 'status' | 'lastLaunchScore';
  offerListSortOrder: 'asc' | 'desc';
  offerListFilters: {
    status?: string[];
    googleAdsAccountId?: string;
    launchScoreGrade?: string[];
  };

  // Dashboard偏好
  dashboardLayout: string[];      // 组件顺序
  dashboardDateRange: string;     // 默认日期范围

  updatedAt: string;
}
```

**用途**：保存用户UI偏好设置

---

### 3.1.4 draft_edits（草稿编辑表）

```typescript
interface DraftEdit {
  draftId: string;                // Primary Key（UUID）
  userId: number;                 // 用户ID
  entityType: 'offer' | 'campaign' | 'creative';
  entityId?: string;              // 实体ID（编辑已有实体时）

  // 草稿数据
  draftData: any;                 // 实体数据

  // 元数据
  lastEditedAt: string;           // 最后编辑时间
  autoSavedAt: string;            // 自动保存时间
}

// 索引
- by-user: userId
- by-entity: entityType + entityId
- by-edited: lastEditedAt
```

**用途**：自动保存用户未提交的编辑（每30秒）

---

## 4. 用户认证设计

### 4.1 JWT Token结构

```typescript
interface JWTPayload {
  userId: number;
  username: string;
  role: 'admin' | 'user';
  packageType: string;
  validUntil: string;  // ISO 8601
  iat: number;         // Issued at
  exp: number;         // Expires at（token有效期：7天）
}
```

**Token生成**：
```typescript
const payload = {
  userId: user.id,
  username: user.username,
  role: user.role,
  packageType: user.package_type,
  validUntil: user.valid_until,
};

const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
```

---

### 4.2 安全措施

#### 密码加密

```typescript
import bcrypt from 'bcrypt';

// 注册/创建用户时
const hashedPassword = await bcrypt.hash(plainPassword, 10);

// 登录验证时
const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
```

#### OAuth Token加密

```typescript
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;  // 32字节

function encryptToken(token: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decryptToken(encryptedToken: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedToken.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);

  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

#### 有效期双重验证（防篡改）

```typescript
// ❌ 不安全：仅检查token payload
const { validUntil } = decodeToken(token);
if (new Date() > new Date(validUntil)) {
  throw new Error('账号已过期');
}

// ✅ 安全：从数据库重新查询
const { userId } = verifyToken(token);
const user = db.prepare('SELECT valid_until FROM users WHERE id = ?').get(userId);

if (new Date() > new Date(user.valid_until)) {
  throw new Error('账号已过期，请联系管理员续费');
}
```

#### 防暴力破解

```typescript
const loginAttempts = new Map<string, { count: number; lockedUntil?: Date }>();

function checkLoginAttempts(username: string): void {
  const attempts = loginAttempts.get(username);

  if (attempts?.lockedUntil && new Date() < attempts.lockedUntil) {
    throw new Error('账号已锁定，请5分钟后重试');
  }

  if (attempts && attempts.count >= 5) {
    attempts.lockedUntil = new Date(Date.now() + 5 * 60 * 1000);
    throw new Error('登录失败次数过多，账号已锁定5分钟');
  }
}
```

---

## ❌ 5. 离线同步机制（已移除 - MVP简化）

**移除原因**：
- 离线Offer创建功能增加复杂度（pending_offers表、自动同步逻辑、失败重试机制）
- MVP阶段用户量少，离线使用场景不多
- 维护成本高，边缘场景

**替代方案**：
```typescript
// 简单网络检测和提示
if (!navigator.onLine) {
  showNotification('请连接网络后操作', 'warning');
  return;
}

// 所有操作要求在线
await fetch('/api/offers', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${getToken()}` },
  body: JSON.stringify(offerData)
});
```

**V2.0考虑**：如果用户强烈需要离线支持，再引入PWA离线机制

---

## ❌ 6. 数据导出功能（延后至V2.0）

**延后原因**：
- 数据导出为高级功能，非MVP核心需求
- 用户可通过管理员导出数据库文件实现
- 避免增加API复杂度

**临时方案**：
```bash
# 管理员手动导出数据（运维操作）
sqlite3 /data/autoads.db ".dump" > backup.sql

# 或直接复制数据库文件
cp /data/autoads.db /backups/user_data_export.db
```

**V2.0考虑**：
- 提供Web界面导出功能（JSON/CSV格式）
- 支持按表导出、时间范围筛选
- 数据脱敏和隐私保护

---

## 7. 性能优化

### 7.1 数据库连接管理（单例模式）

**设计原则**：全局单例Database实例，避免重复连接开销

```typescript
// lib/database.ts
import Database from 'better-sqlite3';

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = process.env.DATABASE_PATH || './data/autoads.db';
    db = new Database(dbPath);

    // SQLite优化配置
    db.pragma('journal_mode = WAL');       // Write-Ahead Logging
    db.pragma('synchronous = NORMAL');     // 平衡性能和安全性
    db.pragma('cache_size = -64000');      // 64MB缓存
    db.pragma('temp_store = MEMORY');      // 临时表存储在内存
    db.pragma('foreign_keys = ON');        // 启用外键约束
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
```

**优势**：
- 避免每次请求创建新连接
- 复用SQLite连接和缓存
- 适合Next.js API Routes的无状态架构

---

### 7.2 并发控制（乐观锁）

**设计原则**：使用`version`字段实现乐观锁，防止并发更新冲突

**需要乐观锁的表**：
- `offers` - 同一用户在不同设备/浏览器上同时编辑同一个Offer
- `campaigns` - 同一用户在不同设备上同时更新Campaign状态
- `users` - 用户信息更新（如套餐升级时管理员和用户同时操作）

**数据隔离说明**：
- AutoAds通过`user_id`实现数据隔离，一个用户只能管理自己的Offer和Campaign
- 乐观锁主要用于防止同一用户在多设备并发编辑时的数据冲突

**字段定义**：
```sql
-- 所有需要并发控制的表添加version字段
ALTER TABLE offers ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE campaigns ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
```

**更新逻辑**：
```typescript
// 乐观锁更新示例
function updateOffer(offerId: number, data: Partial<Offer>, currentVersion: number) {
  const db = getDatabase();
  const result = db.prepare(`
    UPDATE offers
    SET offer_name = ?, version = version + 1, updated_at = datetime('now')
    WHERE id = ? AND version = ?
  `).run(data.offerName, offerId, currentVersion);

  if (result.changes === 0) {
    throw new Error('更新冲突：数据已被其他用户修改，请刷新后重试');
  }
  return result;
}
```

**冲突处理**：
- 前端：捕获冲突错误，提示用户刷新页面
- 后端：返回409 Conflict状态码，附带最新数据

---

### 7.3 API分页（必需）

**强制分页规则**：所有列表查询API必须支持分页，避免大数据量查询

**标准分页参数**：
```typescript
interface PaginationParams {
  page?: number;      // 页码（从1开始），默认1
  limit?: number;     // 每页数量，默认20，最大100
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

**实现示例**：
```typescript
// GET /api/offers?page=1&limit=20
function getOffers(userId: number, params: PaginationParams) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const offset = (page - 1) * limit;

  const db = getDatabase();
  const offers = db.prepare(`
    SELECT * FROM offers WHERE user_id = ? LIMIT ? OFFSET ?
  `).all(userId, limit, offset);

  const total = db.prepare(`
    SELECT COUNT(*) as count FROM offers WHERE user_id = ?
  `).get(userId).count;

  return {
    data: offers,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}
```

**必须分页的API**：
- `GET /api/offers` - Offer列表
- `GET /api/campaigns` - Campaign列表
- `GET /api/campaign_performance` - 性能数据列表
- `GET /api/weekly_recommendations` - 优化建议列表
- `GET /api/search_term_reports` - 搜索词报告列表

---

### 7.4 性能测试计划

⚠️ **重要**：以下性能目标需通过实际压测验证，详见`PERFORMANCE_TEST.md`

**性能目标**（待验证）：
- 单个API请求响应时间 < 200ms（P95）
- 并发10用户同时操作无明显延迟
- 数据库查询时间 < 50ms（带索引查询）
- 列表API支持100条/页无性能问题

**测试场景**：
1. **单用户性能测试** - 测试各API响应时间基线
2. **并发用户测试** - 10用户并发创建Offer/Campaign
3. **数据量测试** - 1000个Offers + 5000个Campaigns场景
4. **长时间运行测试** - 24小时稳定性测试

**工具**：k6压测工具（见PERFORMANCE_TEST.md）

**结论**：SQLite理论上可满足< 100用户、< 100MB数据的场景，但需实测验证

---

## 8. 部署架构

### 8.1 文件结构

```
/
├── data/
│   ├── autoads.db              # SQLite数据库
│   └── backups/                # 备份目录
│       ├── autoads_20250117_020000.db
│       └── ...
├── src/
│   ├── app/                    # Next.js App Router
│   ├── components/             # React组件
│   ├── lib/                    # 工具库
│   │   ├── database.ts         # SQLite访问层
│   │   ├── auth.ts             # JWT认证
│   │   └── encryption.ts       # 加密工具
│   └── pages/api/              # API Routes
├── scripts/
│   ├── init-database.ts        # 数据库初始化
│   └── backup-database.ts      # 备份脚本
└── .env.local                  # 环境变量
```

### 8.2 环境变量

```bash
# JWT配置
JWT_SECRET=<随机生成的64位hex密钥>
JWT_EXPIRES_IN=7d

# 加密配置
ENCRYPTION_KEY=<32字节hex密钥>

# 数据库配置
DATABASE_PATH=./data/autoads.db
BACKUP_DIR=./data/backups
MAX_BACKUP_DAYS=30

# 备份配置
BACKUP_CRON_SCHEDULE=0 2 * * *
ENABLE_AUTO_BACKUP=true
```

---

## 9. 一键调整CPC技术方案

### 9.1 功能概述

**目标**：用户在Offer列表页点击"调整CPC"按钮，批量调整该Offer关联的所有Campaign的CPC出价。

**核心特性**：
- 支持3种调整方式：按百分比增加、按百分比降低、设置固定值
- 批量调整（一次调整该Offer的所有Campaign）
- 实时预览调整结果
- 调整限制：单日最多3次，CPC范围¥0.10-¥100.00
- 调整记录持久化（用于限制和审计）

### 9.2 数据库设计

**新增表：cpc_adjustment_history**

```sql
CREATE TABLE cpc_adjustment_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  offer_id INTEGER NOT NULL,

  -- 调整参数
  adjustment_type TEXT NOT NULL,             -- 调整类型：'increase_percent' | 'decrease_percent' | 'fixed_value'
  adjustment_value REAL NOT NULL,            -- 调整数值（百分比或固定值）

  -- 影响范围
  affected_campaign_count INTEGER NOT NULL,  -- 影响的Campaign数量
  campaign_ids TEXT NOT NULL,                -- 影响的Campaign ID列表（JSON数组）

  -- 调整结果
  success_count INTEGER NOT NULL DEFAULT 0,  -- 成功调整的Campaign数量
  failure_count INTEGER NOT NULL DEFAULT 0,  -- 失败的Campaign数量
  error_message TEXT,                        -- 错误信息（如果有）

  -- 时间戳
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE
);

CREATE INDEX idx_cpc_history_user_offer ON cpc_adjustment_history(user_id, offer_id);
CREATE INDEX idx_cpc_history_created ON cpc_adjustment_history(created_at);
```

### 9.3 API设计

#### 9.3.1 预览CPC调整

**端点**: `POST /api/offers/:offerId/preview-cpc-adjustment`

**请求体**:
```json
{
  "adjustment_type": "increase_percent",
  "adjustment_value": 15
}
```

**响应**:
```json
{
  "preview": [
    {
      "campaign_id": 123,
      "campaign_name": "Nike跑鞋-品牌",
      "current_cpc": 5.20,
      "new_cpc": 5.98,
      "change_percent": 15,
      "is_valid": true
    },
    {
      "campaign_id": 124,
      "campaign_name": "Nike跑鞋-功能",
      "current_cpc": 4.80,
      "new_cpc": 5.52,
      "change_percent": 15,
      "is_valid": true
    }
  ],
  "total_campaigns": 2,
  "daily_adjustment_count": 0,
  "daily_limit": 3,
  "can_adjust": true
}
```

#### 9.3.2 执行CPC调整

**端点**: `POST /api/offers/:offerId/adjust-cpc`

**请求体**:
```json
{
  "adjustment_type": "increase_percent",
  "adjustment_value": 15
}
```

**响应**:
```json
{
  "success": true,
  "affected_campaigns": 2,
  "success_count": 2,
  "failure_count": 0,
  "results": [
    {
      "campaign_id": 123,
      "campaign_name": "Nike跑鞋-品牌",
      "old_cpc": 5.20,
      "new_cpc": 5.98,
      "success": true
    },
    {
      "campaign_id": 124,
      "campaign_name": "Nike跑鞋-功能",
      "old_cpc": 4.80,
      "new_cpc": 5.52,
      "success": true
    }
  ]
}
```

### 9.4 业务逻辑

**调整限制检查**：
```typescript
// 1. 检查单日调整次数
const todayAdjustments = await db.query(`
  SELECT COUNT(*) as count
  FROM cpc_adjustment_history
  WHERE user_id = ? AND offer_id = ?
    AND DATE(created_at) = DATE('now')
`, [userId, offerId]);

if (todayAdjustments.count >= 3) {
  throw new Error('今日调整次数已达上限（3次）');
}

// 2. 验证CPC范围
const newCpc = calculateNewCpc(currentCpc, adjustmentType, adjustmentValue);
if (newCpc < 0.10 || newCpc > 100.00) {
  throw new Error(`CPC必须在¥0.10-¥100.00范围内`);
}
```

**Google Ads API调用**：
```typescript
// 批量更新Campaign CPC
for (const campaign of campaigns) {
  const newCpc = calculateNewCpc(
    campaign.target_cpc,
    adjustmentType,
    adjustmentValue
  );

  await googleAdsClient.campaignService.mutate({
    customerId: campaign.customer_id,
    operations: [{
      update: {
        resourceName: campaign.resource_name,
        maximizeConversions: {
          targetCpa: newCpc * 1000000  // 转换为微单位（micros）
        }
      },
      updateMask: {
        paths: ['maximize_conversions.target_cpa']
      }
    }]
  });

  // 更新本地数据库
  await db.run(`
    UPDATE campaigns
    SET target_cpc = ?, updated_at = datetime('now')
    WHERE id = ?
  `, [newCpc, campaign.id]);
}
```

**调整记录持久化**：
```typescript
await db.run(`
  INSERT INTO cpc_adjustment_history
    (user_id, offer_id, adjustment_type, adjustment_value,
     affected_campaign_count, campaign_ids, success_count, failure_count)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`, [
  userId,
  offerId,
  adjustmentType,
  adjustmentValue,
  campaigns.length,
  JSON.stringify(campaigns.map(c => c.id)),
  successCount,
  failureCount
]);
```

### 9.5 前端UI设计

**弹窗组件** (参考 PRODUCT_DESIGN.md "CPC调整弹窗设计"):
- 调整方式选择（单选：提高/降低/固定值）
- 调整幅度输入（数字输入框 + 单位显示）
- 实时预览表格（Campaign名称、当前CPC、调整后CPC、变化）
- 注意事项提示（单日限制、CPC范围）
- 确认/取消按钮

**状态管理**:
```typescript
interface CpcAdjustmentState {
  adjustmentType: 'increase_percent' | 'decrease_percent' | 'fixed_value';
  adjustmentValue: number;
  preview: CampaignCpcPreview[];
  canAdjust: boolean;
  dailyAdjustmentCount: number;
  isLoading: boolean;
}
```

---

## 10. 风险提示技术方案

### 10.1 功能概述

**目标**：在Dashboard数据大盘增加"风险提示"板块，实时监控推广链接有效性和Google Ads账号状态。

**核心特性**：
- 每日自动检测推广链接有效性
- 每日检测Google Ads账号状态
- 真实环境测试（使用代理模拟目标国家访问）
- 智能验证（验证跳转页面是否包含正确品牌信息）
- 风险分级：critical（严重）/ warning（警告）/ info（提示）
- 历史记录保留

### 10.2 数据库设计

**新增表：risk_alerts**

```sql
CREATE TABLE risk_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,

  -- 风险基本信息
  risk_type TEXT NOT NULL,                   -- 风险类型：'link_failure' | 'account_suspended' | 'budget_low'
  severity TEXT NOT NULL,                    -- 严重程度：'critical' | 'warning' | 'info'
  title TEXT NOT NULL,                       -- 风险标题
  message TEXT NOT NULL,                     -- 详细说明

  -- 关联对象
  related_type TEXT,                         -- 关联对象类型：'offer' | 'campaign' | 'account'
  related_id INTEGER,                        -- 关联对象ID
  related_name TEXT,                         -- 关联对象名称

  -- 状态
  status TEXT NOT NULL DEFAULT 'active',     -- 状态：'active' | 'resolved' | 'ignored'
  resolved_at TEXT,                          -- 解决时间
  resolved_by INTEGER,                       -- 解决人user_id

  -- 时间戳
  detected_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (resolved_by) REFERENCES users(id)
);

CREATE INDEX idx_risk_alerts_user_status ON risk_alerts(user_id, status);
CREATE INDEX idx_risk_alerts_severity ON risk_alerts(severity);
CREATE INDEX idx_risk_alerts_detected ON risk_alerts(detected_at);
CREATE INDEX idx_risk_alerts_related ON risk_alerts(related_type, related_id);
```

**新增表：link_check_history**

```sql
CREATE TABLE link_check_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  offer_id INTEGER NOT NULL,

  -- 检测结果
  is_accessible INTEGER NOT NULL,            -- 是否可访问：1=是, 0=否
  http_status_code INTEGER,                  -- HTTP状态码
  response_time_ms INTEGER,                  -- 响应时间（毫秒）

  -- 内容验证
  brand_found INTEGER,                       -- 是否找到品牌信息：1=是, 0=否, NULL=未检测
  content_valid INTEGER,                     -- 内容是否有效：1=是, 0=否, NULL=未检测
  validation_message TEXT,                   -- 验证结果消息

  -- 代理信息
  proxy_used TEXT,                           -- 使用的代理URL
  target_country TEXT,                       -- 目标国家代码

  -- 错误信息
  error_message TEXT,                        -- 错误信息（如果有）

  -- 时间戳
  checked_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE
);

CREATE INDEX idx_link_check_user_offer ON link_check_history(user_id, offer_id);
CREATE INDEX idx_link_check_checked_at ON link_check_history(checked_at);
CREATE INDEX idx_link_check_accessible ON link_check_history(is_accessible);
```

### 10.3 API设计

#### 10.3.1 获取风险提示列表

**端点**: `GET /api/risk-alerts`

**查询参数**:
- `severity`: 过滤严重程度（可选）
- `status`: 过滤状态（默认：active）
- `limit`: 返回数量（默认：10）

**响应**:
```json
{
  "alerts": [
    {
      "id": 1,
      "risk_type": "link_failure",
      "severity": "critical",
      "title": "推广链接失效",
      "message": "Offer \"Nike跑鞋春季促销\" 的推广链接无法访问（HTTP 404）",
      "related_type": "offer",
      "related_id": 123,
      "related_name": "Nike跑鞋春季促销",
      "detected_at": "2025-01-18T02:15:00Z",
      "status": "active"
    }
  ],
  "total": 3,
  "critical_count": 1,
  "warning_count": 2,
  "info_count": 0
}
```

#### 10.3.2 标记风险为已解决

**端点**: `PATCH /api/risk-alerts/:alertId/resolve`

**响应**:
```json
{
  "success": true,
  "alert_id": 1,
  "status": "resolved",
  "resolved_at": "2025-01-18T10:30:00Z"
}
```

#### 10.3.3 手动触发链接检测

**端点**: `POST /api/offers/:offerId/check-link`

**响应**:
```json
{
  "success": true,
  "is_accessible": false,
  "http_status_code": 404,
  "error_message": "推广链接返回404错误",
  "checked_at": "2025-01-18T10:35:00Z"
}
```

### 10.4 业务逻辑

**定时任务：每日链接检测**

```typescript
// cron: 每天凌晨2点执行
async function dailyLinkCheck() {
  const offers = await db.query(`
    SELECT id, user_id, affiliate_link, brand_name, country_code
    FROM offers
    WHERE status = 'active'
  `);

  for (const offer of offers) {
    try {
      // 1. 使用代理模拟目标国家访问
      const proxyConfig = await getProxyForCountry(offer.country_code);

      // 2. 访问推广链接
      const response = await fetch(offer.affiliate_link, {
        ...proxyConfig,
        timeout: 10000,
        redirect: 'follow'
      });

      const isAccessible = response.status === 200;
      const htmlContent = await response.text();

      // 3. 验证品牌信息
      const brandFound = htmlContent.toLowerCase().includes(
        offer.brand_name.toLowerCase()
      );

      // 4. 记录检测历史
      await db.run(`
        INSERT INTO link_check_history
          (user_id, offer_id, is_accessible, http_status_code,
           response_time_ms, brand_found, content_valid, proxy_used, target_country)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        offer.user_id,
        offer.id,
        isAccessible ? 1 : 0,
        response.status,
        response.responseTime,
        brandFound ? 1 : 0,
        (isAccessible && brandFound) ? 1 : 0,
        proxyConfig.url,
        offer.country_code
      ]);

      // 5. 如果检测失败，创建风险提示
      if (!isAccessible || !brandFound) {
        await createRiskAlert({
          userId: offer.user_id,
          riskType: 'link_failure',
          severity: 'critical',
          title: '推广链接失效',
          message: !isAccessible
            ? `Offer "${offer.name}" 的推广链接无法访问（HTTP ${response.status}）`
            : `Offer "${offer.name}" 的推广链接可访问，但未找到品牌信息`,
          relatedType: 'offer',
          relatedId: offer.id,
          relatedName: offer.name
        });
      }

    } catch (error) {
      // 记录检测错误
      await db.run(`
        INSERT INTO link_check_history
          (user_id, offer_id, is_accessible, error_message, target_country)
        VALUES (?, ?, 0, ?, ?)
      `, [offer.user_id, offer.id, error.message, offer.country_code]);

      await createRiskAlert({
        userId: offer.user_id,
        riskType: 'link_failure',
        severity: 'critical',
        title: '推广链接检测失败',
        message: `Offer "${offer.name}" 链接检测失败：${error.message}`,
        relatedType: 'offer',
        relatedId: offer.id,
        relatedName: offer.name
      });
    }
  }
}
```

**Google Ads账号状态检测**:
```typescript
async function checkGoogleAdsAccountStatus(userId: number) {
  const accounts = await db.query(`
    SELECT * FROM google_ads_accounts
    WHERE user_id = ?
  `, [userId]);

  for (const account of accounts) {
    try {
      // 调用Google Ads API获取账号状态
      const accountInfo = await googleAdsClient.customerService.getCustomer({
        customerId: account.customer_id
      });

      // 检查账号是否被暂停
      if (accountInfo.status === 'SUSPENDED') {
        await createRiskAlert({
          userId,
          riskType: 'account_suspended',
          severity: 'critical',
          title: 'Google Ads账号被暂停',
          message: `账号 ${account.customer_id} 已被暂停投放`,
          relatedType: 'account',
          relatedId: account.id,
          relatedName: account.descriptive_name
        });
      }

      // 检查预算是否不足
      if (accountInfo.availableBudget < 100) {
        await createRiskAlert({
          userId,
          riskType: 'budget_low',
          severity: 'warning',
          title: 'Google Ads账号预算不足',
          message: `账号 ${account.customer_id} 剩余预算仅 ¥${accountInfo.availableBudget}`,
          relatedType: 'account',
          relatedId: account.id,
          relatedName: account.descriptive_name
        });
      }

    } catch (error) {
      await createRiskAlert({
        userId,
        riskType: 'account_suspended',
        severity: 'critical',
        title: 'Google Ads账号状态检测失败',
        message: `无法获取账号 ${account.customer_id} 的状态：${error.message}`,
        relatedType: 'account',
        relatedId: account.id,
        relatedName: account.descriptive_name
      });
    }
  }
}
```

### 10.5 前端UI设计

**Dashboard风险提示板块** (参考 RISK_ALERT_DESIGN.md):
- 风险提示卡片（红色=critical，黄色=warning，蓝色=info）
- 风险类型图标（链接失效、账号暂停、预算不足）
- 详细说明和相关对象链接
- 操作按钮（标记已解决、忽略、查看详情）
- 历史记录查看

**风险提示组件**:
```typescript
interface RiskAlertProps {
  alert: RiskAlert;
  onResolve: (alertId: number) => void;
  onIgnore: (alertId: number) => void;
}

const RiskAlertCard: React.FC<RiskAlertProps> = ({ alert, onResolve, onIgnore }) => {
  const severityColor = {
    critical: 'bg-red-50 border-red-500',
    warning: 'bg-yellow-50 border-yellow-500',
    info: 'bg-blue-50 border-blue-500'
  }[alert.severity];

  return (
    <div className={`border-l-4 p-4 ${severityColor}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="font-semibold">{alert.title}</h4>
          <p className="text-sm text-gray-600">{alert.message}</p>
          <div className="mt-2 text-xs text-gray-500">
            检测时间: {formatDate(alert.detected_at)}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onResolve(alert.id)}>标记已解决</button>
          <button onClick={() => onIgnore(alert.id)}>忽略</button>
        </div>
      </div>
    </div>
  );
};
```

---

**文档版本**: v2.0
**最后更新**: 2025-01-18
**作者**: AutoAds Engineering Team
**状态**: ✅ Ready for Implementation
