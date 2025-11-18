# 需求1-5完成度分析与优化方案

## 📊 总体评估

| 需求 | 完成度 | 状态 | 主要问题 |
|------|--------|------|----------|
| 需求1: Offer基本信息输入 | 40% | 🟡 部分实现 | 字段映射错误、缺少自动生成逻辑 |
| 需求2: Offer列表和操作按钮 | 50% | 🟡 部分实现 | 缺少核心操作按钮 |
| 需求3: 一键上广告弹窗 | 0% | 🔴 未实现 | 完全缺失 |
| 需求4: 一键上广告功能 | 25% | 🔴 严重不足 | 缺少真实数据获取和API调用 |
| 需求5: 语言自动映射 | 0% | 🔴 未实现 | 完全缺失 |

**总体完成度**: **23% (严重不足)**

---

## 🔍 需求1: Offer基本信息输入（完成度40%）

### 需求描述
用户弹窗输入Offer的4个基本字段：
1. **推广链接**（affiliate_link，如 https://pboost.me/UKTs4I6）
2. **品牌名称**（brand_name）
3. **推广国家**（target_country）
4. **店铺或商品落地页**（shop_url，即Final URL）

自动生成的字段：
- **offer_name**：格式 `[品牌名称]_[推广国家代号]_[序号]`（如：Reolink_US_01）
- **target_language**：根据国家自动映射（US→English, DE→German）
- **店铺/产品描述**：通过代理访问shop_url获取

### 现状分析

#### ✅ 已实现
1. 有Offer创建页面（`src/app/offers/new/page.tsx`）
2. 有Offer创建API（`src/app/api/offers/route.ts`）
3. 有基本的表单验证（zod schema）
4. 数据存储到SQLite数据库

#### ❌ 主要问题

**问题1: 字段命名混乱，与需求文档不一致**

| 需求文档 | 现有实现 | 差异说明 |
|---------|---------|----------|
| `affiliate_link` (推广链接) | `affiliate_link` | ✅ 一致，但在前端表单中位置和说明不清晰 |
| `shop_url` (Final URL) | `url` | ❌ **严重混淆**：现有的`url`字段被当作Final URL，但需求中应该是`shop_url` |
| `brand_name` | `brand` | ⚠️ 字段名不一致（brand vs brand_name） |
| `offer_name` (自动生成) | **缺失** | ❌ **完全缺失自动生成逻辑** |
| `target_language` (自动推导) | **缺失** | ❌ **完全缺失自动映射逻辑** |
| `final_url` (从shop_url解析) | **缺失** | ❌ **缺失URL解析逻辑**（需求9） |
| `final_url_suffix` (从shop_url解析) | **缺失** | ❌ **缺失URL suffix解析** |
| `product_price` (需求28) | **缺失** | ❌ **缺失价格字段** |
| `commission_payout` (需求28) | **缺失** | ❌ **缺失佣金比例字段** |

**问题2: 数据库Schema不符合需求**

```sql
-- 现有schema (scripts/init-database.ts)
CREATE TABLE offers (
  url TEXT NOT NULL,              -- ❌ 应该是shop_url
  brand TEXT NOT NULL,            -- ⚠️ 应该是brand_name
  affiliate_link TEXT,            -- ✅ 正确，但应该是必填
  -- ❌ 缺少: offer_name, target_language, final_url, final_url_suffix
  -- ❌ 缺少: product_price, commission_payout
  ...
)

-- 需求schema (根据RequirementsV1.md)
CREATE TABLE offers (
  affiliate_link TEXT NOT NULL,   -- 推广链接（必填）
  brand_name TEXT NOT NULL,       -- 品牌名称（必填）
  target_country TEXT NOT NULL,   -- 推广国家（必填）
  shop_url TEXT NOT NULL,         -- 店铺/商品落地页（必填）

  -- 自动生成字段
  offer_name TEXT NOT NULL UNIQUE,     -- 品牌_国家_序号（如 Reolink_US_01）
  target_language TEXT NOT NULL,       -- 根据国家映射（US→English）

  -- 延迟生成字段（"一键上广告"时填充）
  final_url TEXT,                      -- 从推广链接解析的Final URL
  final_url_suffix TEXT,               -- 从推广链接解析的URL参数
  product_name TEXT,                   -- AI抓取
  product_description TEXT,            -- AI抓取

  -- 可选字段（需求28）
  product_price TEXT,                  -- 产品价格（如 $699.00）
  commission_payout TEXT,              -- 佣金比例（如 6.75%）
  ...
)
```

**问题3: 前端表单字段不符合需求**

```typescript
// 现有实现 (src/app/offers/new/page.tsx:111-189)
<input id="url" label="商品/店铺URL" />  // ❌ 应该是"店铺或商品落地页"
<input id="brand" label="品牌名称" />     // ⚠️ 字段名应该是brand_name
<select id="targetCountry" />             // ✅ 正确
<input id="affiliateLink" label="联盟推广链接" />  // ⚠️ 说明文字不清晰，应该强调这是推广链接

// ❌ 缺少字段:
// - offer_name（应该自动生成，不需要用户输入，但应该显示）
// - target_language（应该根据国家自动显示）
// - product_price（可选）
// - commission_payout（可选）

// ❌ 不应该存在的字段（这些应该延迟生成，不在创建时填写）:
<textarea id="brandDescription" />     // ❌ 应该AI抓取，不需要用户手动输入
<textarea id="uniqueSellingPoints" />  // ❌ 应该AI抓取
<textarea id="productHighlights" />    // ❌ 应该AI抓取
<textarea id="targetAudience" />       // ❌ 应该AI抓取
```

**问题4: 缺少offer_name自动生成逻辑**

```typescript
// 需要实现的逻辑
function generateOfferName(brandName: string, countryCode: string, userId: number): string {
  // 1. 查询该用户下同品牌同国家的Offer数量
  const count = db.prepare(`
    SELECT COUNT(*) as count FROM offers
    WHERE user_id = ? AND brand_name = ? AND target_country = ?
  `).get(userId, brandName, countryCode).count

  // 2. 序号从01开始递增
  const sequence = String(count + 1).padStart(2, '0')

  // 3. 生成offer_name: 品牌_国家_序号
  return `${brandName}_${countryCode}_${sequence}`
  // 示例: Reolink_US_01
}
```

**问题5: 缺少target_language自动映射逻辑**

```typescript
// 需求5: 根据国家确定推广语言
const COUNTRY_TO_LANGUAGE: Record<string, string> = {
  'US': 'English',    // 美国 → 英语
  'GB': 'English',    // 英国 → 英语
  'CA': 'English',    // 加拿大 → 英语（默认）
  'AU': 'English',    // 澳大利亚 → 英语
  'DE': 'German',     // 德国 → 德语
  'FR': 'French',     // 法国 → 法语
  'ES': 'Spanish',    // 西班牙 → 西班牙语
  'IT': 'Italian',    // 意大利 → 意大利语
  'JP': 'Japanese',   // 日本 → 日语
  'CN': 'Chinese',    // 中国 → 中文
  // ... 更多国家
}

function getTargetLanguage(countryCode: string): string {
  return COUNTRY_TO_LANGUAGE[countryCode] || 'English' // 默认英语
}
```

**问题6: 缺少代理访问获取店铺描述的功能**

需求文档要求：
- 店铺/产品描述：通过**配置代理后真实访问**"店铺或商品落地页"获取相关数据
- 代理URL配置（需求10）：必须使用代理访问，不要降级为非代理直接访问

现有实现：
- ❌ 完全缺失代理访问逻辑
- ❌ 没有代理配置管理

### 🎯 优化方案（遵循KISS原则）

#### 方案1: 简化数据库Schema（必须执行）

**原则**: 只保留必填的4个字段 + 2个自动生成字段 + 2个可选字段，其他延迟到"一键上广告"时填充

```sql
-- 优化后的Schema
ALTER TABLE offers RENAME TO offers_old;

CREATE TABLE offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,

  -- ========== 用户输入字段（4个必填） ==========
  affiliate_link TEXT NOT NULL,        -- 推广链接（如 https://pboost.me/UKTs4I6）
  brand_name TEXT NOT NULL CHECK(length(brand_name) <= 25),  -- 品牌名称（≤25字符）
  target_country TEXT NOT NULL,        -- 推广国家（如 US, DE, GB）
  shop_url TEXT NOT NULL,              -- 店铺/商品落地页（Final URL）

  -- ========== 自动生成字段（2个） ==========
  offer_name TEXT NOT NULL UNIQUE,     -- Offer唯一标识: Reolink_US_01
  target_language TEXT NOT NULL,       -- 推广语言: English, German等

  -- ========== 可选字段（2个，需求28） ==========
  product_price TEXT,                  -- 产品价格: $699.00
  commission_payout TEXT,              -- 佣金比例: 6.75%

  -- ========== 延迟生成字段（"一键上广告"时填充） ==========
  final_url TEXT,                      -- 从推广链接解析的干净URL
  final_url_suffix TEXT,               -- 从推广链接解析的tracking参数
  product_name TEXT,                   -- AI抓取的产品名称
  product_description TEXT,            -- AI抓取的产品描述
  category TEXT,                       -- AI抓取的类目
  target_keywords TEXT,                -- AI生成的关键词（JSON数组）

  -- ========== 状态字段 ==========
  scrape_status TEXT DEFAULT 'pending', -- pending/in_progress/completed/failed
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 迁移数据（保留兼容）
INSERT INTO offers (id, user_id, affiliate_link, brand_name, target_country, shop_url, offer_name, target_language, is_active, created_at)
SELECT
  id,
  user_id,
  COALESCE(affiliate_link, url) as affiliate_link,  -- 优先使用affiliate_link，否则用url
  brand as brand_name,
  target_country,
  url as shop_url,
  brand || '_' || target_country || '_01' as offer_name,  -- 临时生成
  'English' as target_language,  -- 临时默认值
  is_active,
  created_at
FROM offers_old;

DROP TABLE offers_old;
```

#### 方案2: 简化前端表单（必须执行）

**原则**: 只保留4个必填字段 + 2个可选字段，移除AI应该自动抓取的字段

```tsx
// src/app/offers/new/page.tsx (优化后)
export default function NewOfferPage() {
  // ========== 只保留必填的4个字段 ==========
  const [affiliateLink, setAffiliateLink] = useState('')  // 推广链接
  const [brandName, setBrandName] = useState('')          // 品牌名称
  const [targetCountry, setTargetCountry] = useState('US') // 推广国家
  const [shopUrl, setShopUrl] = useState('')              // 店铺/商品落地页

  // ========== 可选字段（需求28） ==========
  const [productPrice, setProductPrice] = useState('')    // 产品价格
  const [commissionPayout, setCommissionPayout] = useState('') // 佣金比例

  // ========== 自动生成字段（只读显示） ==========
  const [offerName, setOfferName] = useState('')          // 自动生成
  const [targetLanguage, setTargetLanguage] = useState('') // 自动推导

  // 当品牌名称或国家变化时，实时显示offer_name预览
  useEffect(() => {
    if (brandName && targetCountry) {
      setOfferName(`${brandName}_${targetCountry}_01`)  // 预览
      setTargetLanguage(getLanguageFromCountry(targetCountry))
    }
  }, [brandName, targetCountry])

  return (
    <form onSubmit={handleSubmit}>
      <h3>基本信息（必填）</h3>

      {/* 1. 推广链接 */}
      <label>推广链接 *</label>
      <input
        type="url"
        required
        placeholder="https://pboost.me/UKTs4I6"
        value={affiliateLink}
        onChange={e => setAffiliateLink(e.target.value)}
      />
      <p className="hint">Affiliate跟踪链接，访问后重定向到最终落地页</p>

      {/* 2. 品牌名称 */}
      <label>品牌名称 * (最多25字符)</label>
      <input
        type="text"
        required
        maxLength={25}
        placeholder="Reolink"
        value={brandName}
        onChange={e => setBrandName(e.target.value)}
      />

      {/* 3. 推广国家 */}
      <label>推广国家 *</label>
      <select value={targetCountry} onChange={e => setTargetCountry(e.target.value)}>
        <option value="US">美国 (US)</option>
        <option value="DE">德国 (DE)</option>
        <option value="GB">英国 (GB)</option>
        {/* ... */}
      </select>

      {/* 4. 店铺/商品落地页 */}
      <label>店铺或商品落地页 *</label>
      <input
        type="url"
        required
        placeholder="https://www.amazon.com/stores/page/..."
        value={shopUrl}
        onChange={e => setShopUrl(e.target.value)}
      />
      <p className="hint">最终的产品/店铺页面URL，将配置到Google Ads</p>

      {/* ========== 自动生成字段（只读显示） ========== */}
      <h3>自动生成信息</h3>
      <div className="readonly-field">
        <label>Offer标识</label>
        <span>{offerName || '请先填写品牌和国家'}</span>
      </div>
      <div className="readonly-field">
        <label>推广语言</label>
        <span>{targetLanguage || '请先选择国家'}</span>
      </div>

      {/* ========== 可选字段（需求28） ========== */}
      <h3>定价信息（可选）</h3>
      <label>产品价格</label>
      <input
        type="text"
        placeholder="$699.00"
        value={productPrice}
        onChange={e => setProductPrice(e.target.value)}
      />
      <label>佣金比例</label>
      <input
        type="text"
        placeholder="6.75%"
        value={commissionPayout}
        onChange={e => setCommissionPayout(e.target.value)}
      />

      <button type="submit">创建Offer</button>
    </form>
  )
}

// 辅助函数：根据国家获取语言
function getLanguageFromCountry(countryCode: string): string {
  const mapping: Record<string, string> = {
    'US': 'English', 'GB': 'English', 'CA': 'English', 'AU': 'English',
    'DE': 'German', 'FR': 'French', 'ES': 'Spanish', 'IT': 'Italian',
    'JP': 'Japanese', 'CN': 'Chinese'
  }
  return mapping[countryCode] || 'English'
}
```

#### 方案3: 优化API实现offer_name自动生成（必须执行）

```typescript
// src/app/api/offers/route.ts (优化后)
import { generateOfferName, getTargetLanguage } from '@/lib/offer-utils'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const userId = parseInt(request.headers.get('x-user-id')!, 10)

  // 验证输入（只需4个必填 + 2个可选）
  const schema = z.object({
    affiliate_link: z.string().url('无效的推广链接'),
    brand_name: z.string().min(1).max(25, '品牌名称最多25字符'),
    target_country: z.string().length(2, '国家代码必须是2个字符'),
    shop_url: z.string().url('无效的店铺URL'),
    product_price: z.string().optional(),
    commission_payout: z.string().optional(),
  })

  const data = schema.parse(body)

  // ========== 自动生成offer_name和target_language ==========
  const offer_name = generateOfferName(data.brand_name, data.target_country, userId)
  const target_language = getTargetLanguage(data.target_country)

  // 插入数据库
  const db = getDatabase()
  const result = db.prepare(`
    INSERT INTO offers (
      user_id, affiliate_link, brand_name, target_country, shop_url,
      offer_name, target_language, product_price, commission_payout
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    data.affiliate_link,
    data.brand_name,
    data.target_country,
    data.shop_url,
    offer_name,
    target_language,
    data.product_price || null,
    data.commission_payout || null
  )

  return NextResponse.json({ success: true, offer: { id: result.lastInsertRowid, offer_name } })
}
```

#### 方案4: 创建辅助函数库（必须执行）

```typescript
// src/lib/offer-utils.ts (新建)
import { getDatabase } from '@/lib/db'

/**
 * 生成Offer唯一标识
 * 格式：品牌名称_推广国家_序号
 * 示例：Reolink_US_01, Reolink_US_02, ITEHIL_DE_01
 */
export function generateOfferName(
  brandName: string,
  countryCode: string,
  userId: number
): string {
  const db = getDatabase()

  // 查询该用户下同品牌同国家的Offer数量
  const result = db.prepare(`
    SELECT COUNT(*) as count
    FROM offers
    WHERE user_id = ? AND brand_name = ? AND target_country = ?
  `).get(userId, brandName, countryCode) as { count: number }

  // 序号从01开始，格式化为2位数字
  const sequence = String(result.count + 1).padStart(2, '0')

  // 组合生成offer_name
  return `${brandName}_${countryCode}_${sequence}`
}

/**
 * 根据国家代码获取推广语言
 * 需求5: 根据国家确定推广语言
 */
export function getTargetLanguage(countryCode: string): string {
  const mapping: Record<string, string> = {
    // 英语国家
    'US': 'English',  // 美国
    'GB': 'English',  // 英国
    'CA': 'English',  // 加拿大（默认英语）
    'AU': 'English',  // 澳大利亚
    'NZ': 'English',  // 新西兰
    'IE': 'English',  // 爱尔兰

    // 欧洲主要语言
    'DE': 'German',   // 德国
    'FR': 'French',   // 法国
    'ES': 'Spanish',  // 西班牙
    'IT': 'Italian',  // 意大利
    'PT': 'Portuguese', // 葡萄牙
    'NL': 'Dutch',    // 荷兰
    'PL': 'Polish',   // 波兰
    'SE': 'Swedish',  // 瑞典
    'NO': 'Norwegian',// 挪威
    'DK': 'Danish',   // 丹麦
    'FI': 'Finnish',  // 芬兰

    // 亚洲语言
    'JP': 'Japanese', // 日本
    'CN': 'Chinese',  // 中国
    'KR': 'Korean',   // 韩国
    'TH': 'Thai',     // 泰国
    'VN': 'Vietnamese', // 越南
    'IN': 'Hindi',    // 印度（默认印地语）

    // 其他
    'BR': 'Portuguese', // 巴西
    'MX': 'Spanish',  // 墨西哥
    'AR': 'Spanish',  // 阿根廷
  }

  // 如果没有映射，默认返回English
  return mapping[countryCode] || 'English'
}

/**
 * 验证品牌名称长度
 */
export function validateBrandName(brandName: string): { valid: boolean; error?: string } {
  if (!brandName || brandName.trim().length === 0) {
    return { valid: false, error: '品牌名称不能为空' }
  }

  if (brandName.length > 25) {
    return { valid: false, error: '品牌名称最多25个字符' }
  }

  return { valid: true }
}

/**
 * 计算建议最大CPC（需求28）
 * 公式：最大CPC = product_price * commission_payout / 50
 * 示例：$699.00 * 6.75% / 50 = $0.94
 */
export function calculateSuggestedMaxCPC(
  productPrice: string,  // 如 "$699.00"
  commissionPayout: string,  // 如 "6.75%"
  targetCurrency: string = 'USD'  // 目标货币
): { amount: number; currency: string; formatted: string } | null {
  // 解析价格（去除货币符号）
  const priceMatch = productPrice.match(/[\d.]+/)
  if (!priceMatch) return null
  const price = parseFloat(priceMatch[0])

  // 解析佣金比例（去除%符号）
  const payoutMatch = commissionPayout.match(/[\d.]+/)
  if (!payoutMatch) return null
  const payout = parseFloat(payoutMatch[0]) / 100  // 转换为小数

  // 计算最大CPC（按50个点击出一单）
  const maxCPC = (price * payout) / 50

  return {
    amount: maxCPC,
    currency: targetCurrency,
    formatted: `${targetCurrency === 'USD' ? '$' : '¥'}${maxCPC.toFixed(2)}`
  }
}
```

### 📋 需求1优化任务清单

- [ ] 执行数据库Schema迁移（ALTER TABLE）
- [ ] 创建`src/lib/offer-utils.ts`工具函数库
- [ ] 重构`src/app/offers/new/page.tsx`前端表单
- [ ] 重构`src/app/api/offers/route.ts` API
- [ ] 更新`src/lib/offers.ts`（如果存在）的CRUD函数
- [ ] 添加单元测试验证offer_name唯一性
- [ ] 测试语言映射逻辑

---

## 🔍 需求2: Offer列表页和操作按钮（完成度50%）

### 需求描述
首页新增一个列表页显示所有Offer的信息，并在每个Offer的后面显示"操作"栏，包括如下操作按钮：
- **"一键上广告"**
- **"一键调整CPC"**

### 现状分析

#### ✅ 已实现
1. 有Offer列表页（`src/app/offers/page.tsx`）
2. 显示基本的Offer信息（品牌、URL、国家、状态）
3. 点击Offer可以查看详情页

#### ❌ 主要问题

**问题1: 缺少操作按钮**

```tsx
// 现有实现 (src/app/offers/page.tsx:147-214)
{offers.map((offer) => (
  <li key={offer.id}>
    <a href={`/offers/${offer.id}`}>  {/* ❌ 整行都是链接，无法添加操作按钮 */}
      <div className="px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p>{offer.brand}</p>
            <p>{offer.url}</p>
          </div>
          <div className="ml-2 flex-shrink-0 flex">
            <span className={getScrapeStatusColor(offer.scrape_status)}>
              {getScrapeStatusLabel(offer.scrape_status)}
            </span>
          </div>
        </div>
      </div>
    </a>
  </li>
))}
```

**问题2: 缺少操作栏设计**

需要添加：
- "一键上广告"按钮
- "一键调整CPC"按钮
- 其他操作（如"投放分析"，需求19）

### 🎯 优化方案（遵循KISS原则）

#### 方案1: 重构列表页，添加操作栏（必须执行）

```tsx
// src/app/offers/page.tsx (优化后)
export default function OffersPage() {
  const [offers, setOffers] = useState<Offer[]>([])
  const [launchingAdId, setLaunchingAdId] = useState<number | null>(null)
  const [adjustingCPCId, setAdjustingCPCId] = useState<number | null>(null)

  // 一键上广告弹窗
  const handleLaunchAd = (offerId: number) => {
    setLaunchingAdId(offerId)
  }

  // 一键调整CPC弹窗
  const handleAdjustCPC = (offerId: number) => {
    setAdjustingCPCId(offerId)
  }

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-md">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th>Offer标识</th>
            <th>品牌名称</th>
            <th>推广国家</th>
            <th>推广语言</th>
            <th>状态</th>
            <th>操作</th>  {/* ✅ 新增操作栏 */}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {offers.map((offer) => (
            <tr key={offer.id}>
              <td>
                <a href={`/offers/${offer.id}`} className="text-indigo-600 hover:text-indigo-900">
                  {offer.offer_name}  {/* ✅ 显示offer_name */}
                </a>
              </td>
              <td>{offer.brand_name}</td>
              <td>{offer.target_country}</td>
              <td>{offer.target_language}</td>  {/* ✅ 显示推广语言 */}
              <td>
                <span className={`badge ${getStatusColor(offer.scrape_status)}`}>
                  {getStatusLabel(offer.scrape_status)}
                </span>
              </td>

              {/* ========== 操作栏 ========== */}
              <td className="flex space-x-2">
                {/* 一键上广告 */}
                <button
                  onClick={() => handleLaunchAd(offer.id)}
                  className="btn btn-primary"
                  title="快速创建并发布Google Ads广告"
                >
                  🚀 一键上广告
                </button>

                {/* 一键调整CPC */}
                <button
                  onClick={() => handleAdjustCPC(offer.id)}
                  className="btn btn-secondary"
                  title="根据表现数据智能调整CPC出价"
                >
                  💰 一键调整CPC
                </button>

                {/* 投放分析（需求19） */}
                <button
                  onClick={() => router.push(`/offers/${offer.id}/launch-score`)}
                  className="btn btn-outline"
                  title="分析Offer投放潜力和ROI预估"
                >
                  📊 投放分析
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 一键上广告弹窗（需求3） */}
      {launchingAdId && (
        <LaunchAdModal
          offerId={launchingAdId}
          onClose={() => setLaunchingAdId(null)}
        />
      )}

      {/* 一键调整CPC弹窗 */}
      {adjustingCPCId && (
        <AdjustCPCModal
          offerId={adjustingCPCId}
          onClose={() => setAdjustingCPCId(null)}
        />
      )}
    </div>
  )
}
```

### 📋 需求2优化任务清单

- [ ] 重构列表页为表格布局
- [ ] 添加"操作"列
- [ ] 实现"一键上广告"按钮和点击事件
- [ ] 实现"一键调整CPC"按钮和点击事件
- [ ] 创建LaunchAdModal组件（需求3）
- [ ] 创建AdjustCPCModal组件

---

## 🔍 需求3: 一键上广告弹窗（完成度0%）

### 需求描述
当用户点击"一键上广告"按钮后，弹窗显示需要在对应的Google Ads账号中上线一个新广告所需的参数和步骤。

### 现状分析

#### ❌ 完全缺失
- 没有任何弹窗组件
- 没有参数配置界面
- 没有步骤引导流程

### 🎯 优化方案（遵循KISS原则）

#### 方案1: 创建简化的多步骤弹窗（必须执行）

**设计原则（KISS）**:
1. **分步骤展示**：不要一次性显示所有参数，分为3-4个步骤
2. **默认值优先**（需求14）：大部分参数使用默认值，用户只需确认
3. **关键参数突出**：只让用户关注最重要的参数（预算、CPC、关键词）

```tsx
// src/components/LaunchAdModal.tsx (新建)
interface LaunchAdModalProps {
  offerId: number
  onClose: () => void
}

export function LaunchAdModal({ offerId, onClose }: LaunchAdModalProps) {
  const [step, setStep] = useState(1)  // 当前步骤
  const [offer, setOffer] = useState<Offer | null>(null)
  const [adConfig, setAdConfig] = useState({
    // ========== 需求14: 默认值 ==========
    objective: 'Website traffic',          // 默认
    conversionGoals: 'Page views',         // 默认
    campaignType: 'Search',                // 默认
    biddingStrategy: 'Maximize clicks',    // 默认
    maxCPCLimit: 0.17,  // US$0.17 或 CN¥1.2  // 默认
    dailyBudget: 100,                      // 默认100单位
    euPoliticalAds: 'No',                  // 默认

    // ========== 用户需要关注的参数 ==========
    numberOfVariants: 1,  // 广告变体数量（1-3，需求16）
    keywords: [],         // 关键词列表
    creatives: [],        // 广告创意
  })

  useEffect(() => {
    // 加载Offer信息
    fetchOffer(offerId).then(setOffer)
  }, [offerId])

  return (
    <Dialog open={true} onClose={onClose}>
      <DialogTitle>
        🚀 一键上广告 - {offer?.offer_name}
      </DialogTitle>

      <DialogContent>
        {/* 步骤指示器 */}
        <StepIndicator currentStep={step} totalSteps={4} />

        {/* 步骤1: 确认Offer信息 */}
        {step === 1 && (
          <Step1ConfirmOffer offer={offer} />
        )}

        {/* 步骤2: 配置广告参数 */}
        {step === 2 && (
          <Step2ConfigureAd
            adConfig={adConfig}
            setAdConfig={setAdConfig}
            offer={offer}
          />
        )}

        {/* 步骤3: 生成广告创意 */}
        {step === 3 && (
          <Step3GenerateCreatives
            offerId={offerId}
            numberOfVariants={adConfig.numberOfVariants}
            onCreativesGenerated={(creatives) =>
              setAdConfig({ ...adConfig, creatives })
            }
          />
        )}

        {/* 步骤4: 确认并发布 */}
        {step === 4 && (
          <Step4ConfirmAndLaunch
            offer={offer}
            adConfig={adConfig}
          />
        )}
      </DialogContent>

      <DialogActions>
        {step > 1 && (
          <Button onClick={() => setStep(step - 1)}>上一步</Button>
        )}

        {step < 4 ? (
          <Button onClick={() => setStep(step + 1)} variant="primary">
            下一步
          </Button>
        ) : (
          <Button onClick={handleLaunch} variant="primary">
            发布到Google Ads
          </Button>
        )}

        <Button onClick={onClose} variant="outline">取消</Button>
      </DialogActions>
    </Dialog>
  )
}

// 步骤2: 配置广告参数（需求14默认值）
function Step2ConfigureAd({ adConfig, setAdConfig, offer }) {
  // 计算建议最大CPC（需求28）
  const suggestedMaxCPC = offer.product_price && offer.commission_payout
    ? calculateSuggestedMaxCPC(offer.product_price, offer.commission_payout)
    : null

  return (
    <div className="space-y-4">
      <h3>📋 广告配置</h3>

      {/* 广告变体数量（需求16） */}
      <div>
        <label>广告变体数量（1-3个）</label>
        <select
          value={adConfig.numberOfVariants}
          onChange={e => setAdConfig({ ...adConfig, numberOfVariants: parseInt(e.target.value) })}
        >
          <option value={1}>1个（品牌导向）</option>
          <option value={2}>2个（品牌导向 + 产品导向）</option>
          <option value={3}>3个（品牌导向 + 产品导向 + 促销导向）</option>
        </select>
        <p className="hint">不同变体的广告创意、关键词会有差异化</p>
      </div>

      {/* 每日预算 */}
      <div>
        <label>每日预算</label>
        <input
          type="number"
          value={adConfig.dailyBudget}
          onChange={e => setAdConfig({ ...adConfig, dailyBudget: parseFloat(e.target.value) })}
        />
        <span className="suffix">USD/day</span>  {/* 根据账号货币单位调整 */}
      </div>

      {/* 最大CPC出价限制 */}
      <div>
        <label>最大CPC出价限制</label>
        <input
          type="number"
          step="0.01"
          value={adConfig.maxCPCLimit}
          onChange={e => setAdConfig({ ...adConfig, maxCPCLimit: parseFloat(e.target.value) })}
        />
        <span className="suffix">USD</span>

        {/* 需求28: 显示建议最大CPC */}
        {suggestedMaxCPC && (
          <p className="hint">
            💡 建议最大CPC: {suggestedMaxCPC.formatted}
            （按50个点击出一单计算）
          </p>
        )}
      </div>

      {/* 折叠的高级选项 */}
      <details>
        <summary>高级选项（使用默认值）</summary>
        <div className="space-y-2">
          <div>
            <label>Objective</label>
            <input type="text" value={adConfig.objective} disabled />
          </div>
          <div>
            <label>Conversion goals</label>
            <input type="text" value={adConfig.conversionGoals} disabled />
          </div>
          <div>
            <label>Campaign type</label>
            <input type="text" value={adConfig.campaignType} disabled />
          </div>
          <div>
            <label>Bidding strategy</label>
            <input type="text" value={adConfig.biddingStrategy} disabled />
          </div>
        </div>
      </details>
    </div>
  )
}
```

### 📋 需求3优化任务清单

- [ ] 创建`LaunchAdModal.tsx`组件
- [ ] 实现4步骤流程设计
- [ ] 实现步骤1: 确认Offer信息
- [ ] 实现步骤2: 配置广告参数（使用需求14的默认值）
- [ ] 实现步骤3: 生成广告创意（需求4）
- [ ] 实现步骤4: 确认并发布
- [ ] 集成到Offer列表页

---

## 🔍 需求4: "一键上广告"功能包含的步骤（完成度25%）

### 需求描述
"一键上广告"功能应该包含：
1. **真实详情页数据获取**
2. **关键词真实搜索量查询**
3. **根据真实详情页数据生成headline/description/callout/sitelink**

### 现状分析

#### ✅ 已实现
1. 有基本的创意生成API（`src/app/api/offers/[id]/generate-creatives/route.ts`）
2. 有关键词生成逻辑（`src/lib/keyword-generator.ts`）
3. 使用Gemini AI生成广告文案

#### ❌ 主要问题

**问题1: 缺少真实详情页数据获取**

需求要求：
- 通过**配置代理后真实访问**"店铺或商品落地页"获取相关数据（需求1）
- 访问"Offer推广链接"，一定要配置代理IP访问，不要降级为非代理直接访问（需求9）
- 从落地页截取Final URL和Final URL suffix（需求9）

现有实现：
- ❌ 没有代理配置管理
- ❌ 没有URL访问和重定向跟踪逻辑
- ❌ 没有Final URL解析逻辑
- ❌ 没有页面数据抓取逻辑

**问题2: 缺少关键词真实搜索量查询**

需求要求：
- 调用Google Ads的**Keyword Planner工具**来查询每个关键词在推广国家的搜索量（需求6）
- 通过Google搜索商品品牌词来提取"下拉词"，并调用Keyword Planner查询搜索量（需求11）
- 过滤掉购买意图不强烈的词，比如"setup"、"how to"、"free"等（需求11）

现有实现：
- ✅ 有AI生成关键词的逻辑（`keyword-generator.ts`）
- ❌ **完全没有调用Google Ads Keyword Planner API**
- ❌ 关键词搜索量是AI估算的，不是真实API数据
- ❌ 没有下拉词提取逻辑
- ❌ 没有低意图词过滤逻辑

**问题3: 生成的callout和sitelink不够真实**

需求要求（需求15）：
- AI创意生成中，需要生成**真实有效的callout和sitelink**
- 可以参考Offer对应品牌的官网信息，并结合AI能力来实现

现有实现：
- ⚠️ 有生成callout和sitelink的逻辑
- ❌ 没有访问品牌官网获取真实信息
- ❌ 生成的内容可能不够真实

**问题4: 缺少广告质量评分功能**

需求要求（需求17）：
- 在广告创意生成后，需要对生成的广告质量进行评分（满分100分）
- 支持用户通过点击"重新生成"按钮来多次尝试，满意后再继续后面的流程

现有实现：
- ❌ 完全缺失广告质量评分逻辑
- ❌ 没有"重新生成"功能

### 🎯 优化方案（遵循KISS原则）

#### 方案1: 实现代理访问和数据抓取（高优先级，但复杂）

**简化方案（KISS原则）**:
- **阶段1（必须）**: 先实现无代理的基础数据抓取
- **阶段2（推荐）**: 再增加代理支持

```typescript
// src/lib/scraper.ts (新建)
import { JSDOM } from 'jsdom'

/**
 * 抓取店铺/商品页面数据
 * @param shopUrl - 店铺或商品落地页URL
 * @param useProxy - 是否使用代理（默认false，KISS原则先不用代理）
 */
export async function scrapeProductData(
  shopUrl: string,
  useProxy: boolean = false
): Promise<ProductData> {
  try {
    // ========== 阶段1: 简单fetch（KISS） ==========
    const response = await fetch(shopUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const html = await response.text()
    const dom = new JSDOM(html)
    const doc = dom.window.document

    // ========== 提取数据（通用逻辑） ==========
    // 1. 产品标题
    const productName =
      doc.querySelector('h1#title')?.textContent?.trim() ||  // Amazon
      doc.querySelector('h1.product-title')?.textContent?.trim() ||  // 通用
      doc.querySelector('meta[property="og:title"]')?.getAttribute('content')

    // 2. 产品描述
    const productDescription =
      doc.querySelector('#productDescription')?.textContent?.trim() ||  // Amazon
      doc.querySelector('.product-description')?.textContent?.trim() ||  // 通用
      doc.querySelector('meta[property="og:description"]')?.getAttribute('content')

    // 3. 品牌名称
    const brandName =
      doc.querySelector('#bylineInfo')?.textContent?.trim() ||  // Amazon
      doc.querySelector('.brand-name')?.textContent?.trim() ||
      doc.querySelector('meta[property="og:brand"]')?.getAttribute('content')

    // 4. 产品价格
    const price =
      doc.querySelector('.a-price-whole')?.textContent?.trim() ||  // Amazon
      doc.querySelector('.product-price')?.textContent?.trim()

    // 5. 产品类目
    const category =
      doc.querySelector('#wayfinding-breadcrumbs_feature_div')?.textContent?.trim() ||  // Amazon
      doc.querySelector('.breadcrumb')?.textContent?.trim()

    // 6. 产品特性（用于生成callout）
    const features: string[] = []
    doc.querySelectorAll('#feature-bullets li, .product-feature').forEach(li => {
      const text = li.textContent?.trim()
      if (text && text.length > 10 && text.length < 200) {
        features.push(text)
      }
    })

    return {
      productName,
      productDescription,
      brandName,
      price,
      category,
      features,
      scrapedAt: new Date().toISOString(),
      sourceUrl: shopUrl,
    }
  } catch (error) {
    console.error('数据抓取失败:', error)
    throw new Error(`数据抓取失败: ${error.message}`)
  }
}

/**
 * 解析推广链接的Final URL和Final URL suffix（需求9）
 * @param affiliateLink - 推广链接（如 https://pboost.me/UKTs4I6）
 */
export async function resolveAffiliateLink(affiliateLink: string): Promise<{
  finalUrl: string
  finalUrlSuffix: string
}> {
  try {
    // 跟踪重定向，获取最终落地页
    const response = await fetch(affiliateLink, {
      redirect: 'manual',  // 不自动跟踪重定向
      headers: {
        'User-Agent': 'Mozilla/5.0',
      }
    })

    // 手动跟踪所有重定向
    let currentUrl = affiliateLink
    let finalLandingPage = ''
    const maxRedirects = 10

    for (let i = 0; i < maxRedirects; i++) {
      const res = await fetch(currentUrl, { redirect: 'manual' })

      if (res.status >= 300 && res.status < 400) {
        // 有重定向
        const location = res.headers.get('location')
        if (!location) break

        currentUrl = new URL(location, currentUrl).href
      } else {
        // 到达最终页面
        finalLandingPage = currentUrl
        break
      }
    }

    // 解析最终URL
    const url = new URL(finalLandingPage)

    // 分离Final URL和Final URL suffix
    // Final URL: 协议 + 域名 + 路径（不含查询参数）
    const finalUrl = `${url.protocol}//${url.host}${url.pathname}`

    // Final URL suffix: 查询参数（去除?号）
    const finalUrlSuffix = url.search.substring(1)  // 去除开头的?

    return {
      finalUrl,
      finalUrlSuffix,
    }
  } catch (error) {
    console.error('推广链接解析失败:', error)
    throw new Error(`推广链接解析失败: ${error.message}`)
  }
}

interface ProductData {
  productName: string | null
  productDescription: string | null
  brandName: string | null
  price: string | null
  category: string | null
  features: string[]
  scrapedAt: string
  sourceUrl: string
}
```

#### 方案2: 集成Google Ads Keyword Planner API（高优先级）

**简化方案（KISS原则）**:
- 只查询关键词的平均月搜索量
- 不需要复杂的竞争度、CPC预测等（可以后续添加）

```typescript
// src/lib/google-ads-api.ts (扩展现有文件)
import { GoogleAdsApi, enums } from 'google-ads-api'

/**
 * 查询关键词的真实搜索量（需求6）
 * 使用Google Ads Keyword Planner API
 */
export async function getKeywordSearchVolumes(
  keywords: string[],
  countryCode: string,
  language: string
): Promise<KeywordMetrics[]> {
  const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
  })

  const customer = client.Customer({
    customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID!,
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
  })

  try {
    // 调用Keyword Plan Idea Service
    const response = await customer.keywordPlanIdeaService.generateKeywordIdeas({
      customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID!,
      language: getLanguageCode(language),  // 如 1000 = English
      geo_target_constants: [getGeoTargetCode(countryCode)],  // 如 2840 = United States
      keyword_seed: {
        keywords: keywords,
      },
    })

    // 解析结果
    const metrics: KeywordMetrics[] = response.results.map(result => ({
      keyword: result.text,
      avgMonthlySearches: result.keyword_idea_metrics.avg_monthly_searches || 0,
      competition: result.keyword_idea_metrics.competition || 'UNKNOWN',
      lowTopPageBid: result.keyword_idea_metrics.low_top_of_page_bid_micros / 1_000_000,
      highTopPageBid: result.keyword_idea_metrics.high_top_of_page_bid_micros / 1_000_000,
    }))

    return metrics
  } catch (error) {
    console.error('关键词搜索量查询失败:', error)
    throw new Error(`关键词搜索量查询失败: ${error.message}`)
  }
}

/**
 * 过滤低购买意图关键词（需求11）
 */
export function filterLowIntentKeywords(keywords: string[]): string[] {
  const lowIntentPatterns = [
    /\bhow\s+to\b/i,       // how to
    /\bsetup\b/i,          // setup
    /\binstall\b/i,        // install
    /\bfree\b/i,           // free
    /\btutorial\b/i,       // tutorial
    /\bguide\b/i,          // guide
    /\breview\b/i,         // review（可选过滤）
    /\bcompare\b/i,        // compare（可选过滤）
    /\bvs\b/i,             // vs
    /\brepair\b/i,         // repair
    /\bfix\b/i,            // fix
    /\btroubleshooting\b/i,// troubleshooting
  ]

  return keywords.filter(keyword => {
    // 如果匹配任何一个低意图模式，则过滤掉
    return !lowIntentPatterns.some(pattern => pattern.test(keyword))
  })
}

interface KeywordMetrics {
  keyword: string
  avgMonthlySearches: number
  competition: string
  lowTopPageBid: number
  highTopPageBid: number
}

// 辅助函数：国家代码 → Google Ads Geo Target ID
function getGeoTargetCode(countryCode: string): string {
  const mapping: Record<string, string> = {
    'US': '2840',  // United States
    'GB': '2826',  // United Kingdom
    'CA': '2124',  // Canada
    'AU': '2036',  // Australia
    'DE': '2276',  // Germany
    'FR': '2250',  // France
    'JP': '2392',  // Japan
    // ... 更多国家
  }
  return mapping[countryCode] || '2840'  // 默认美国
}

// 辅助函数：语言 → Google Ads Language ID
function getLanguageCode(language: string): string {
  const mapping: Record<string, string> = {
    'English': '1000',
    'German': '1001',
    'French': '1002',
    'Spanish': '1003',
    'Italian': '1004',
    'Japanese': '1005',
    'Chinese': '1017',
    // ... 更多语言
  }
  return mapping[language] || '1000'  // 默认英语
}
```

#### 方案3: 优化创意生成流程（中等优先级）

```typescript
// src/lib/creative-generator.ts (优化现有逻辑)
import { scrapeProductData } from './scraper'
import { getKeywordSearchVolumes, filterLowIntentKeywords } from './google-ads-api'

/**
 * 完整的"一键上广告"流程（需求4）
 */
export async function launchAdCampaign(offerId: number): Promise<LaunchAdResult> {
  // ========== 步骤1: 获取Offer信息 ==========
  const offer = await getOfferById(offerId)

  // ========== 步骤2: 真实详情页数据获取 ==========
  console.log('🔍 正在抓取产品数据...')
  const productData = await scrapeProductData(offer.shop_url)

  // 更新Offer的product_name和product_description
  await updateOffer(offerId, {
    product_name: productData.productName,
    product_description: productData.productDescription,
    category: productData.category,
  })

  // ========== 步骤3: 生成关键词 ==========
  console.log('💡 正在生成关键词...')
  const aiKeywords = await generateKeywordsWithAI(offer, productData)

  // ========== 步骤4: 关键词真实搜索量查询 ==========
  console.log('📊 正在查询关键词搜索量...')
  const keywordMetrics = await getKeywordSearchVolumes(
    aiKeywords.map(k => k.keyword),
    offer.target_country,
    offer.target_language
  )

  // 过滤低意图关键词
  const filteredKeywords = filterLowIntentKeywords(keywordMetrics.map(k => k.keyword))

  // 按搜索量排序，取前30个
  const topKeywords = keywordMetrics
    .filter(k => filteredKeywords.includes(k.keyword))
    .sort((a, b) => b.avgMonthlySearches - a.avgMonthlySearches)
    .slice(0, 30)

  // ========== 步骤5: 生成广告创意 ==========
  console.log('✨ 正在生成广告创意...')
  const creatives = await generateCreativesWithAI(offer, productData, topKeywords)

  // ========== 步骤6: 广告质量评分（需求17） ==========
  console.log('📝 正在评分广告质量...')
  const scoredCreatives = await scoreCreatives(creatives)

  return {
    offer,
    productData,
    keywords: topKeywords,
    creatives: scoredCreatives,
  }
}

/**
 * 广告质量评分（需求17）
 * 满分100分，从多个维度评估广告质量
 */
async function scoreCreatives(creatives: Creative[]): Promise<ScoredCreative[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

  return Promise.all(creatives.map(async (creative) => {
    const prompt = `你是一个专业的Google Ads质量评估专家。请从以下维度对这个广告创意进行评分（满分100分）：

广告创意:
标题: ${creative.headlines.join(', ')}
描述: ${creative.descriptions.join(', ')}
Callouts: ${creative.callouts.join(', ')}
Sitelinks: ${creative.sitelinks.map(s => s.text).join(', ')}

评分维度:
1. 相关性（30分）: 广告与产品/服务的相关程度
2. 吸引力（25分）: 标题和描述的吸引力和创新性
3. 清晰度（20分）: 信息表达的清晰程度
4. 完整性（15分）: Callouts和Sitelinks的质量和相关性
5. 合规性（10分）: 是否符合Google Ads政策

请返回JSON格式的评分结果:
{
  "totalScore": 85,
  "breakdown": {
    "relevance": 25,
    "attractiveness": 22,
    "clarity": 18,
    "completeness": 12,
    "compliance": 8
  },
  "strengths": ["优点1", "优点2"],
  "improvements": ["改进建议1", "改进建议2"]
}
`

    const result = await model.generateContent(prompt)
    const responseText = result.response.text()
    const score = JSON.parse(responseText)

    return {
      ...creative,
      score: score.totalScore,
      scoreBreakdown: score.breakdown,
      strengths: score.strengths,
      improvements: score.improvements,
    }
  }))
}
```

### 📋 需求4优化任务清单

- [ ] 创建`src/lib/scraper.ts`实现数据抓取
- [ ] 实现`scrapeProductData()`函数
- [ ] 实现`resolveAffiliateLink()`函数（需求9）
- [ ] 扩展`src/lib/google-ads-api.ts`
- [ ] 实现`getKeywordSearchVolumes()`函数（调用Keyword Planner API）
- [ ] 实现`filterLowIntentKeywords()`函数
- [ ] 优化`src/lib/creative-generator.ts`
- [ ] 实现`scoreCreatives()`函数（需求17）
- [ ] 在LaunchAdModal中集成完整流程
- [ ] 添加"重新生成"功能（需求17）

---

## 🔍 需求5: 语言自动映射（完成度0%）

### 需求描述
根据国家确定推广语言，比如：
- 若推广国家是"美国US"，则推广语言就是"English"
- 若推广国家是"德国GE"，则推广语言就是"German"

### 现状分析

#### ❌ 完全缺失
- 没有国家到语言的映射逻辑
- 数据库中没有`target_language`字段
- 前端没有显示推广语言

### 🎯 优化方案

**已在需求1的"方案4"中实现**（见上文`src/lib/offer-utils.ts`的`getTargetLanguage()`函数）

### 📋 需求5优化任务清单

- [ ] 创建`getTargetLanguage()`函数（已在需求1方案中定义）
- [ ] 在Offer创建时自动调用
- [ ] 在前端创建页面实时显示
- [ ] 在Offer列表页显示
- [ ] 测试所有主要国家的语言映射

---

## 📊 总结与优化路线图

### 🔴 P0: 必须立即修复（阻塞核心功能）

1. **修复数据库Schema**（需求1）
   - 执行ALTER TABLE迁移
   - 添加缺失字段: `offer_name`, `target_language`, `final_url`, `final_url_suffix`, `product_price`, `commission_payout`

2. **实现offer_name自动生成**（需求1）
   - 创建`src/lib/offer-utils.ts`
   - 实现`generateOfferName()`和`getTargetLanguage()`

3. **添加操作按钮**（需求2）
   - 在Offer列表页添加"一键上广告"和"一键调整CPC"按钮

### 🟡 P1: 高优先级（影响用户体验）

4. **创建LaunchAdModal**（需求3）
   - 实现4步骤弹窗流程
   - 使用需求14的默认值

5. **简化前端表单**（需求1）
   - 只保留4个必填字段 + 2个可选字段
   - 移除AI应该抓取的字段

6. **实现数据抓取**（需求4）
   - 创建`scraper.ts`
   - 实现基础的无代理抓取（KISS原则）

### 🟢 P2: 中等优先级（增强功能）

7. **集成Keyword Planner API**（需求4）
   - 查询真实搜索量
   - 过滤低意图关键词

8. **实现广告质量评分**（需求4）
   - 多维度评分（满分100）
   - 支持重新生成

9. **优化创意生成**（需求4）
   - 访问品牌官网获取真实callout/sitelink
   - 提升生成质量

### ⏰ 预估工作量

| 优先级 | 任务数 | 预估时间 | 复杂度 |
|--------|--------|----------|--------|
| P0 | 3个 | 4-6小时 | 低-中 |
| P1 | 3个 | 8-12小时 | 中-高 |
| P2 | 3个 | 12-16小时 | 高 |
| **总计** | **9个** | **24-34小时** | **中-高** |

### 🎯 KISS原则应用

1. **数据库设计**: 只保留必需字段，延迟生成非必需字段
2. **前端表单**: 简化输入，自动生成能自动的，默认值能默认的
3. **弹窗流程**: 分步引导，每步只关注最重要的信息
4. **代理访问**: 阶段1先不用代理（简化），阶段2再加（完善）
5. **API调用**: 先调用必需的API（Keyword Planner），其他后续增加

---

## 📝 附录：完整的字段映射对照表

| 需求文档字段名 | 现有字段名 | 字段类型 | 是否必填 | 自动生成 | 延迟生成 | 说明 |
|---------------|-----------|---------|---------|---------|---------|------|
| `affiliate_link` | `affiliate_link` | TEXT | ✅ | ❌ | ❌ | 推广链接（如 https://pboost.me/UKTs4I6） |
| `brand_name` | `brand` | TEXT | ✅ | ❌ | ❌ | 品牌名称（≤25字符） |
| `target_country` | `target_country` | TEXT | ✅ | ❌ | ❌ | 推广国家（如 US, DE） |
| `shop_url` | `url` | TEXT | ✅ | ❌ | ❌ | 店铺/商品落地页（Final URL） |
| `offer_name` | ❌缺失 | TEXT | ✅ | ✅ | ❌ | Offer唯一标识（Reolink_US_01） |
| `target_language` | ❌缺失 | TEXT | ✅ | ✅ | ❌ | 推广语言（English, German） |
| `product_price` | ❌缺失 | TEXT | ❌ | ❌ | ❌ | 产品价格（$699.00） |
| `commission_payout` | ❌缺失 | TEXT | ❌ | ❌ | ❌ | 佣金比例（6.75%） |
| `final_url` | ❌缺失 | TEXT | ❌ | ❌ | ✅ | 从推广链接解析的Final URL |
| `final_url_suffix` | ❌缺失 | TEXT | ❌ | ❌ | ✅ | 从推广链接解析的URL参数 |
| `product_name` | ❌缺失 | TEXT | ❌ | ❌ | ✅ | AI抓取的产品名称 |
| `product_description` | ❌缺失 | TEXT | ❌ | ❌ | ✅ | AI抓取的产品描述 |
| `category` | `category` | TEXT | ❌ | ❌ | ✅ | AI抓取的产品类目 |
| `target_keywords` | ❌缺失 | TEXT | ❌ | ❌ | ✅ | AI生成的关键词（JSON数组） |
| `brand_description` | `brand_description` | TEXT | ❌ | ❌ | ✅ | ❌**应删除，AI抓取** |
| `unique_selling_points` | `unique_selling_points` | TEXT | ❌ | ❌ | ✅ | ❌**应删除，AI抓取** |
| `product_highlights` | `product_highlights` | TEXT | ❌ | ❌ | ✅ | ❌**应删除，AI抓取** |
| `target_audience` | `target_audience` | TEXT | ❌ | ❌ | ✅ | ❌**应删除，AI抓取** |

---

**生成时间**: 2025-11-18
**文档版本**: v1.0
**分析人员**: Claude Code
**下一步行动**: 执行P0优先级任务

