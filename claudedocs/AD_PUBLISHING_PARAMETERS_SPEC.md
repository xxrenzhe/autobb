# 广告发布参数规范
**版本**: 1.0
**日期**: 2025-11-22
**状态**: ✅ 已实现

---

## 参数分类和要求

### 1. Campaign Level（广告系列层级）

| 参数名 | 类型 | 是否必需 | 默认值 | 说明 | 数据来源 |
|--------|------|---------|--------|------|---------|
| **campaignName** | string | ✅ 必需 | - | 必须包含品牌名 | 用户配置 + Offer品牌名 |
| **budgetType** | enum | ✅ 必需 | DAILY | 固定为每日预算 | 系统固定 |
| **budgetAmount** | number | ✅ 必需 | 10 | 10美元或等值其他货币 | 根据ads账号支持的货币 |
| **targetCountry** | string | ✅ 必需 | - | 与offer的推广国家保持一致 | Offer配置 |
| **targetLanguage** | string | ✅ 必需 | - | 与推广国家映射的语言一致 | Offer配置 → 语言映射 |
| **biddingStrategy** | enum | ✅ 必需 | Maximize Clicks | 固定为Maximize Clicks（target_spend） | 系统固定 |
| **finalUrlSuffix** | string | 可选 | - | 从推广链接重定向后提取 | URL解析器提取 |
| **status** | enum | 自动 | PAUSED | 创建时暂停（Google推荐） | 系统自动 |

### 2. Ad Group Level（广告组层级）

| 参数名 | 类型 | 是否必需 | 默认值 | 说明 | 数据来源 |
|--------|------|---------|--------|------|---------|
| **adGroupName** | string | ✅ 必需 | - | 必须包含品牌名 | 用户配置 + Offer品牌名 |
| **cpcBidMicros** | number | ✅ 必需 | 170000 | 0.17美元 = 170,000 micros | 根据ads账号货币换算 |
| **status** | enum | 自动 | ENABLED | 广告组默认启用 | 系统自动 |

### 3. Keywords Level（关键词层级）

| 参数名 | 类型 | 是否必需 | 默认值 | 说明 | 数据来源 |
|--------|------|---------|--------|------|---------|
| **keywords** | array | ✅ 必需 | - | 至少1个关键词 | 广告创意生成 |
| **matchType** | enum | ✅ 必需 | PHRASE | BROAD/PHRASE/EXACT | 广告创意配置 |
| **status** | enum | 自动 | ENABLED | 关键词默认启用 | 系统自动 |

**❌ 缺失报错**:
- 如果广告创意中缺少keywords，则报错：`缺少关键词配置，请确保广告创意包含至少1个关键词`

### 4. Ad Level（广告层级 - Responsive Search Ad）

| 参数名 | 类型 | 是否必需 | 数量要求 | 说明 | 数据来源 |
|--------|------|---------|---------|------|---------|
| **adName** | string | ✅ 必需 | - | 必须包含品牌名 | 用户配置 + Offer品牌名 |
| **headlines** | array | ✅ 必需 | **必须正好15个** | 每个最多30字符 | 广告创意生成 |
| **descriptions** | array | ✅ 必需 | **必须正好4个** | 每个最多90字符 | 广告创意生成 |
| **finalUrls** | array | ✅ 必需 | 至少1个 | 从推广链接重定向后提取的Final URL | URL解析器提取 |
| **path1** | string | 可选 | - | 显示路径1（最多15字符） | URL解析器提取 |
| **path2** | string | 可选 | - | 显示路径2（最多15字符） | URL解析器提取 |

**❌ 缺失报错**:
- **Headlines不足15个**: `Headlines必须正好15个，当前提供了{N}个。如果从广告创意中获得的标题数量不足，请报错。`
- **Descriptions不足4个**: `Descriptions必须正好4个，当前提供了{N}个。如果从广告创意中获得的描述数量不足，请报错。`

### 5. Extensions（广告附加信息）

| 参数名 | 类型 | 是否必需 | 说明 | 数据来源 |
|--------|------|---------|------|---------|
| **callouts** | array | ✅ 必需 | 宣传信息（例如"免费配送"） | 广告创意生成 |
| **sitelinks** | array | ✅ 必需 | 附加链接 | 广告创意生成 |

**❌ 缺失报错**:
- 如果广告创意中缺少callouts，则报错：`缺少Callout配置，请确保广告创意包含宣传信息`
- 如果广告创意中缺少sitelinks，则报错：`缺少Sitelink配置，请确保广告创意包含附加链接`

---

## 参数验证规则

### Headlines验证
```typescript
// 必须正好15个
if (headlines.length !== 15) {
  throw new Error(`Headlines必须正好15个，当前提供了${headlines.length}个。如果从广告创意中获得的标题数量不足，请报错。`)
}

// 每个标题最多30字符
headlines.forEach((headline, index) => {
  if (headline.length > 30) {
    throw new Error(`标题${index + 1}超过30字符限制: "${headline}" (${headline.length}字符)`)
  }
})
```

### Descriptions验证
```typescript
// 必须正好4个
if (descriptions.length !== 4) {
  throw new Error(`Descriptions必须正好4个，当前提供了${descriptions.length}个。如果从广告创意中获得的描述数量不足，请报错。`)
}

// 每个描述最多90字符
descriptions.forEach((desc, index) => {
  if (desc.length > 90) {
    throw new Error(`描述${index + 1}超过90字符限制: "${desc}" (${desc.length}字符)`)
  }
})
```

### Budget Amount验证
```typescript
// 根据ads账号支持的货币决定
// 美元: 10 USD
// 其他货币: 等值金额
const budgetAmount = getCurrencyEquivalent(10, accountCurrency)
```

### CPC Bid验证
```typescript
// 根据ads账号支持的货币决定
// 美元: 0.17 USD = 170,000 micros
// 其他货币: 等值金额
const cpcBidMicros = getCurrencyEquivalent(0.17, accountCurrency) * 1000000
```

---

## 参数来源映射

### 从Offer配置获取
- `targetCountry` ← Offer.target_country
- `targetLanguage` ← Offer.target_country → 语言映射（例如：US → en, JP → ja）
- `campaignName` ← Offer.brand_name + 用户配置的名称模板

### 从广告创意生成获取
- `headlines` ← AdCreative.headlines（必须15个）
- `descriptions` ← AdCreative.descriptions（必须4个）
- `keywords` ← AdCreative.keywords（带搜索量）
- `callouts` ← AdCreative.callouts
- `sitelinks` ← AdCreative.sitelinks

### 从推广链接解析获取
- `finalUrls` ← 重定向后的最终URL
- `finalUrlSuffix` ← URL参数（例如：?utm_source=google）
- `path1` ← URL路径提取（例如：/sale）
- `path2` ← URL路径提取（例如：/2025）

### 系统固定值
- `budgetType` = "DAILY"（固定）
- `biddingStrategy` = "Maximize Clicks"（固定）
- `budgetAmount` = 10 USD 或等值货币
- `cpcBidMicros` = 0.17 USD 或等值货币 × 1,000,000

---

## 国家/地区与语言映射

```typescript
const countryLanguageMap: Record<string, string> = {
  'US': 'en',      // United States → English
  'GB': 'en',      // United Kingdom → English
  'CA': 'en',      // Canada → English
  'AU': 'en',      // Australia → English
  'DE': 'de',      // Germany → German
  'FR': 'fr',      // France → French
  'JP': 'ja',      // Japan → Japanese
  'CN': 'zh',      // China → Chinese (Simplified)
  'TW': 'zh-TW',   // Taiwan → Chinese (Traditional)
  'IN': 'en',      // India → English
  'BR': 'pt',      // Brazil → Portuguese
  'MX': 'es',      // Mexico → Spanish
  'ES': 'es',      // Spain → Spanish
  'IT': 'it',      // Italy → Italian
  'KR': 'ko',      // South Korea → Korean
  'RU': 'ru',      // Russia → Russian
  'SG': 'en',      // Singapore → English
  'HK': 'zh-TW',   // Hong Kong → Chinese (Traditional)
}
```

---

## 货币换算

```typescript
// 示例：根据ads账号支持的货币换算预算和CPC出价
const currencyRates: Record<string, number> = {
  'USD': 1,       // 美元基准
  'EUR': 0.92,    // 欧元
  'GBP': 0.79,    // 英镑
  'JPY': 149.50,  // 日元
  'CNY': 7.24,    // 人民币
  'CAD': 1.36,    // 加拿大元
  'AUD': 1.53,    // 澳大利亚元
}

function getCurrencyEquivalent(usdAmount: number, currency: string): number {
  const rate = currencyRates[currency] || 1
  return Math.round(usdAmount * rate * 100) / 100
}

// 使用示例：
// 预算: 10 USD → 10 EUR (if EUR account)
// CPC: 0.17 USD → 0.17 EUR (if EUR account)
```

---

## 实现状态

### ✅ 已实现
- [x] Campaign层级参数（包括finalUrlSuffix）
- [x] Ad Group层级参数
- [x] Keywords层级参数
- [x] Ad层级参数（Headlines/Descriptions严格验证）
- [x] 地理位置和语言定位（CampaignCriterion）
- [x] Bidding Strategy固定为Maximize Clicks
- [x] Headlines必须正好15个的验证
- [x] Descriptions必须正好4个的验证

### ⏳ 待实现
- [ ] Extensions（Callouts/Sitelinks）创建
- [ ] 货币换算逻辑（根据ads账号货币）
- [ ] 品牌名自动插入到Campaign/Ad Group/Ad名称
- [ ] 缺失参数的友好错误提示

---

## 测试检查清单

### Campaign创建测试
- [ ] Campaign名称包含品牌名
- [ ] Budget类型为DAILY
- [ ] Budget金额为10 USD（或等值货币）
- [ ] Bidding Strategy为Maximize Clicks
- [ ] Target Country与offer一致
- [ ] Target Language正确映射
- [ ] Final URL Suffix正确设置

### Ad创建测试
- [ ] Ad名称包含品牌名
- [ ] Headlines正好15个
- [ ] Descriptions正好4个
- [ ] Final URL正确
- [ ] CPC Bid为0.17 USD（或等值货币）

### 错误处理测试
- [ ] Headlines不足15个时报错
- [ ] Descriptions不足4个时报错
- [ ] 缺少Keywords时报错
- [ ] 缺少Callouts时报错
- [ ] 缺少Sitelinks时报错

---

## 相关文件

### 实现文件
- `src/lib/google-ads-api.ts` - Google Ads API封装
- `src/app/api/campaigns/publish/route.ts` - 发布API路由
- `src/lib/ad-creative.ts` - 广告创意生成
- `src/lib/url-resolver-enhanced.ts` - URL解析器

### 配置文件
- `src/lib/google-ads-api.ts` - 国家/地区映射（lines 185-233）
- `src/lib/google-ads-api.ts` - 语言映射（lines 210-233）

### 测试页面
- `/test/campaign-params` - 参数测试页面
- `src/app/test/campaign-params/page.tsx` - 测试UI
- `src/app/api/test/campaign-params/route.ts` - 测试API

---

## 注意事项

1. **Headlines和Descriptions数量严格限制**
   - 不是范围（3-15个），而是必须正好15个
   - 不是范围（2-4个），而是必须正好4个
   - 如果数量不足，必须报错，不能自动补全

2. **品牌名必须包含在名称中**
   - Campaign Name、Ad Group Name、Ad Name都必须包含品牌名
   - 格式示例：`{品牌名} - {描述性名称}`

3. **Final URL vs Final URL Suffix**
   - Final URL：配置在Ad层级
   - Final URL Suffix：配置在Campaign层级
   - 都从推广链接重定向后提取

4. **货币换算**
   - 预算和CPC出价需要根据ads账号支持的货币进行换算
   - 保持等值金额，不是固定数字

5. **Bidding Strategy固定**
   - 必须使用Maximize Clicks（target_spend）
   - 不支持Manual CPC或其他策略
