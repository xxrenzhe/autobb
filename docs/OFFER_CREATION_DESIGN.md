# Offer创建设计 - 轻量级快速创建

**文档版本**: v3.0（修正版）
**更新日期**: 2025-01-18
**设计原则**: KISS（Keep It Simple, Stupid）- 快速创建 + 延迟处理

---

## 📋 设计概述

### 核心理念

**Offer创建阶段只做最基本的数据录入，AI处理延迟到"一键上广告"阶段**

- ✅ **快速创建**：< 1秒完成Offer创建
- ✅ **最少输入**：仅4个必填字段
- ✅ **批量友好**：支持快速批量创建数百个Offer
- ✅ **延迟处理**：AI抓取、关键词生成、预算设置等重量级操作推迟到上广告时执行
- ✅ **统一命名**：Offer ID自动生成（品牌_国家_序号）

### 业务流程分离

**阶段1：创建Offer（本文档）** - 轻量级、快速
- 用户输入4个字段
- 系统生成Offer ID和推广语言
- Offer创建完成，广告状态为`not_launched`（未上广告）
- **不执行**：❌ AI抓取、❌ 关键词生成、❌ 预算设置、❌ Google Ads API调用

**阶段2：一键上广告（见ONE_CLICK_LAUNCH.md）** - 重量级、AI驱动
- AI抓取产品信息
- AI生成关键词和广告创意
- 自动设置预算
- 调用Google Ads API创建Campaign

---

## 一、手动创建Offer

### 1.1 用户输入字段（4个）

| 字段名称 | 英文字段 | 必填 | 数据类型 | 示例值 | 用途 |
|---------|---------|------|---------|-------|------|
| 推广链接 | `affiliate_link` | ✅ | URL | https://pboost.me/UKTs4I6 | Affiliate跟踪链接 |
| 品牌名称 | `brand_name` | ✅ | TEXT (≤25字符) | Reolink | 品牌识别、Offer ID生成 |
| 推广国家 | `target_country` | ✅ | 下拉选择 | US | 地理定位、语言推导 |
| 店铺或商品落地页 | `shop_url` | ✅ | URL | https://www.amazon.com/stores/... | 供"一键上广告"时AI抓取 |

### 1.2 创建表单UI设计

```
┌───────────────────────────────────────────────────────────────┐
│  创建新Offer                                                   │
├───────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 推广链接 *                                               │ │
│  │ [_________________________________________________]       │ │
│  │ 示例: https://pboost.me/UKTs4I6                         │ │
│  │ 说明: 您的Affiliate跟踪链接                              │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 品牌名称 * (最多25个字符)                                │ │
│  │ [_________________________________________________]       │ │
│  │ 示例: Reolink                                            │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 推广国家 *                                               │ │
│  │ [美国 US ▼]                                              │ │
│  │ 可选: 美国US, 德国GE, 法国FR, 英国UK, 加拿大CA...       │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 店铺或商品落地页 *                                       │ │
│  │ [_________________________________________________]       │ │
│  │ 示例: https://www.amazon.com/stores/page/201E3A4F...    │ │
│  │ 说明: 用于"一键上广告"时AI抓取产品信息                  │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 💡 系统将自动生成                                        │ │
│  │ • Offer ID: Reolink_US_01                               │ │
│  │ • 推广语言: English                                      │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  [取消]                                             [创建 →]   │
└───────────────────────────────────────────────────────────────┘
```

---

## 二、自动生成字段（仅2个）

创建Offer时**仅自动生成2个字段**，其他字段在"一键上广告"时处理。

### 2.1 字段1: `offer_name`（Offer ID）

**生成规则**: `[品牌名称]_[国家代号]_[序号]`

**序号生成逻辑**:
```typescript
async function generateOfferName(
  userId: number,
  brandName: string,
  countryCode: string
): Promise<string> {
  // 1. 查询同一用户、同一品牌、同一国家的现有Offer数量
  const count = db.prepare(`
    SELECT COUNT(*) as count
    FROM offers
    WHERE user_id = ?
      AND brand_name = ?
      AND target_country = ?
  `).get(userId, brandName, countryCode).count;

  // 2. 生成序号（补零到2位）
  const sequence = (count + 1).toString().padStart(2, '0');

  // 3. 拼接Offer名称
  return `${brandName}_${countryCode}_${sequence}`;
}
```

**示例**:
| 用户 | 品牌名称 | 推广国家 | 序号 | 生成的offer_name |
|------|---------|---------|------|-----------------|
| User1 | Reolink | US | 1 | Reolink_US_01 |
| User1 | Reolink | US | 2 | Reolink_US_02 |
| User1 | Reolink | GE | 1 | Reolink_GE_01 |
| User1 | Anker | US | 1 | Anker_US_01 |

**唯一性保证**:
- 数据库唯一索引: `CREATE UNIQUE INDEX idx_offers_unique_name ON offers(user_id, offer_name);`

---

### 2.2 字段2: `target_language`（推广语言）

**生成规则**: 根据 `target_country` 自动映射

```typescript
const COUNTRY_LANGUAGE_MAP: Record<string, string> = {
  'US': 'English',
  'GE': 'German',
  'FR': 'French',
  'UK': 'English',
  'CA': 'English',
  'ES': 'Spanish',
  'IT': 'Italian',
  'AU': 'English',
  'JP': 'Japanese',
  'BR': 'Portuguese'
};

function getTargetLanguage(countryCode: string): string {
  return COUNTRY_LANGUAGE_MAP[countryCode] || 'English';
}
```

---

### 2.3 延迟生成的字段（在"一键上广告"时处理）

以下字段**不在创建Offer时生成**，而是在用户点击"一键上广告"时才处理：

❌ **product_name**（产品名称）- AI抓取
❌ **product_description**（产品描述）- AI抓取
❌ **category**（产品类目）- AI抓取
❌ **target_keywords**（目标关键词）- AI生成
❌ **budget_daily**（每日预算）- AI建议
❌ **target_cpc**（目标CPC）- AI建议

详见文档：`ONE_CLICK_LAUNCH.md`

---

## 三、Offer创建API实现

### 3.1 POST /api/offers/create

**功能**: 快速创建Offer，仅生成Offer ID和推广语言

**Request Body**:
```json
{
  "affiliate_link": "https://pboost.me/UKTs4I6",
  "brand_name": "Reolink",
  "target_country": "US",
  "shop_url": "https://www.amazon.com/stores/page/201E3A4F-C63F-48A6-87B7-524F985330DA"
}
```

**Response (Success)**:
```json
{
  "success": true,
  "data": {
    "offer_id": 1,
    "offer_name": "Reolink_US_01",
    "brand_name": "Reolink",
    "target_country": "US",
    "target_language": "English",
    "affiliate_link": "https://pboost.me/UKTs4I6",
    "shop_url": "https://www.amazon.com/stores/...",
    "ad_status": "not_launched",
    "created_at": "2025-01-18T10:30:00Z"
  }
}
```

**实现代码**:
```typescript
// app/api/offers/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/session';
import Database from 'better-sqlite3';

const db = new Database(process.env.DATABASE_PATH!);

export async function POST(request: NextRequest) {
  // 1. 验证用户身份
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: '未授权' },
      { status: 401 }
    );
  }

  const userId = session.user.id;

  // 2. 接收用户输入的4个字段
  const { affiliate_link, brand_name, target_country, shop_url } = await request.json();

  // 3. 验证必填字段
  if (!affiliate_link || !brand_name || !target_country || !shop_url) {
    return NextResponse.json(
      { success: false, error: '缺少必填字段' },
      { status: 400 }
    );
  }

  // 4. 验证URL格式
  const urlPattern = /^https?:\/\/.+/;
  if (!urlPattern.test(affiliate_link) || !urlPattern.test(shop_url)) {
    return NextResponse.json(
      { success: false, error: 'URL格式无效' },
      { status: 400 }
    );
  }

  // 5. 验证品牌名称长度
  if (brand_name.length > 25) {
    return NextResponse.json(
      { success: false, error: '品牌名称不能超过25个字符' },
      { status: 400 }
    );
  }

  // 6. 验证国家代码
  const validCountries = ['US', 'GE', 'FR', 'UK', 'CA', 'AU', 'ES', 'IT', 'JP', 'BR'];
  if (!validCountries.includes(target_country)) {
    return NextResponse.json(
      { success: false, error: '无效的国家代码' },
      { status: 400 }
    );
  }

  try {
    // 7. 生成 offer_name（Offer ID）
    const offerName = await generateOfferName(userId, brand_name, target_country);

    // 8. 生成 target_language
    const targetLanguage = getTargetLanguage(target_country);

    // 9. 插入数据库
    const stmt = db.prepare(`
      INSERT INTO offers (
        user_id,
        offer_name,
        brand_name,
        target_country,
        target_language,
        affiliate_link,
        shop_url,
        ad_status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'not_launched', datetime('now'), datetime('now'))
    `);

    const result = stmt.run(
      userId,
      offerName,
      brand_name,
      target_country,
      targetLanguage,
      affiliate_link,
      shop_url
    );

    // 10. 查询刚创建的Offer
    const offer = db.prepare(`
      SELECT * FROM offers WHERE id = ?
    `).get(result.lastInsertRowid);

    // 11. 返回成功结果
    return NextResponse.json({
      success: true,
      data: offer
    });

  } catch (error: any) {
    console.error('Offer创建失败:', error);

    // 处理唯一性冲突
    if (error.message?.includes('UNIQUE constraint failed')) {
      return NextResponse.json(
        { success: false, error: 'Offer名称已存在' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: '创建失败' },
      { status: 500 }
    );
  }
}

// 辅助函数：生成Offer名称
async function generateOfferName(
  userId: number,
  brandName: string,
  countryCode: string
): Promise<string> {
  const count = db.prepare(`
    SELECT COUNT(*) as count
    FROM offers
    WHERE user_id = ?
      AND brand_name = ?
      AND target_country = ?
  `).get(userId, brandName, countryCode).count;

  const sequence = (count + 1).toString().padStart(2, '0');
  return `${brandName}_${countryCode}_${sequence}`;
}

// 辅助函数：获取目标语言
function getTargetLanguage(countryCode: string): string {
  const map: Record<string, string> = {
    'US': 'English',
    'GE': 'German',
    'FR': 'French',
    'UK': 'English',
    'CA': 'English',
    'ES': 'Spanish',
    'IT': 'Italian',
    'AU': 'English',
    'JP': 'Japanese',
    'BR': 'Portuguese'
  };
  return map[countryCode] || 'English';
}
```

---

## 四、批量导入CSV

批量导入流程与手动创建完全相同，只是从CSV文件读取多行数据。

详见文档：`BATCH_IMPORT_DESIGN.md`

---

## 五、数据库Schema

### 5.1 offers表定义

```sql
CREATE TABLE offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,

  -- 用户输入字段（4个）
  affiliate_link TEXT NOT NULL,                  -- 推广链接
  brand_name TEXT NOT NULL,                      -- 品牌名称（≤25字符）
  target_country TEXT NOT NULL,                  -- 推广国家（ISO代码）
  shop_url TEXT NOT NULL,                        -- 店铺/商品落地页

  -- 自动生成字段（2个）
  offer_name TEXT NOT NULL UNIQUE,               -- Offer ID（品牌_国家_序号）
  target_language TEXT NOT NULL,                 -- 推广语言（自动推导）

  -- 延迟生成字段（在"一键上广告"时填充）
  product_name TEXT,                             -- 产品名称（AI抓取）
  product_description TEXT,                      -- 产品描述（AI抓取）
  category TEXT,                                 -- 产品类目（AI抓取）
  target_keywords TEXT,                          -- 目标关键词（AI生成，JSON数组）
  budget_daily REAL,                             -- 每日预算（AI建议）
  target_cpc REAL,                               -- 目标CPC（AI建议）

  -- Google Ads投放状态
  ad_status TEXT NOT NULL DEFAULT 'not_launched', -- 广告状态：not_launched | launching | active | paused

  -- 时间戳
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 唯一索引
CREATE UNIQUE INDEX idx_offers_unique_name ON offers(user_id, offer_name);

-- 查询索引
CREATE INDEX idx_offers_user_id ON offers(user_id);
CREATE INDEX idx_offers_status ON offers(status);
CREATE INDEX idx_offers_brand_country ON offers(user_id, brand_name, target_country);
```

### 5.2 广告投放状态流转

**状态含义**：
- `not_launched`: Offer已创建，但还未上广告（初始状态）
- `launching`: 正在执行"一键上广告"流程（AI抓取、生成创意、调用Google Ads API）
- `active`: 广告已在Google Ads上线运行
- `paused`: 广告已暂停

**状态流转**：
```
Offer创建成功
  ↓
not_launched (未上广告)
  ↓
  用户点击"一键上广告"
  ↓
launching (正在上广告)
  ↓
active (广告已上线)
  ⇄
paused (广告已暂停)
```

---

## 六、前端UI流程

### 6.1 创建成功

```
用户填写4个字段（20秒）
  ↓
点击"创建"
  ↓
< 1秒后显示成功
┌───────────────────────────────────────────────┐
│ ✅ Offer创建成功！                             │
├───────────────────────────────────────────────┤
│ Offer ID: Reolink_US_01                       │
│ 品牌名称: Reolink                              │
│ 推广国家: 美国 (US)                            │
│ 推广语言: English                              │
│ 推广链接: https://pboost.me/UKTs4I6          │
│ 广告状态: 未上广告                              │
│                                                │
│ [继续创建]  [查看Offer列表]  [一键上广告 →]   │
└───────────────────────────────────────────────┘
```

### 6.2 创建失败

```
┌───────────────────────────────────────────────┐
│ ❌ Offer创建失败                               │
├───────────────────────────────────────────────┤
│ 错误: Offer名称已存在                          │
│                                                │
│ 您已有相同品牌和国家的Offer:                   │
│ • Reolink_US_01                               │
│                                                │
│ 建议: 请检查是否重复创建                       │
│                                                │
│ [返回修改]  [查看现有Offer]                   │
└───────────────────────────────────────────────┘
```

---

## 七、总结

### 7.1 设计优势

| 优势 | 说明 |
|------|------|
| **极速创建** | < 1秒完成，支持快速批量创建 |
| **资源节省** | 不浪费代理流量和API配额 |
| **流程分离** | 创建和上广告解耦，灵活性高 |
| **用户友好** | 只需4个字段，无学习成本 |
| **可扩展性** | 易于添加新的自动化功能 |

### 7.2 与"一键上广告"的衔接

- **创建阶段**（本文档）：快速录入Offer基础信息
- **上广告阶段**（ONE_CLICK_LAUNCH.md）：AI处理、Google Ads API调用

### 7.3 实施计划

- [ ] 后端API开发：2-3小时
- [ ] 前端UI开发：2-3小时
- [ ] 数据库Schema更新：1小时
- [ ] 测试：1-2小时
- **总计**: 6-9小时

---

**下一步**: 创建 `ONE_CLICK_LAUNCH.md` 文档，设计"一键上广告"流程
