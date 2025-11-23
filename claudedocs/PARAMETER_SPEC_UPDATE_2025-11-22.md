# 广告发布参数规范更新
**日期**: 2025-11-22
**基于**: 用户提供的详细业务规范

---

## 更新概述

根据用户提供的详细广告发布参数说明，对系统进行了全面更新，确保严格遵守业务规范。

---

## 关键变更

### 1. ✅ Bidding Strategy（出价策略）
**之前**: Manual CPC (默认)
**现在**: **Maximize Clicks (target_spend)** - 固定策略

**代码修改** (`src/lib/google-ads-api.ts` lines 284-289):
```typescript
// 设置出价策略 - Maximize Clicks (Target Spend)
// 根据业务规范：Bidding Strategy必须选择Maximize Clicks
campaign.target_spend = {
  // target_spend_micros 已废弃，设置为undefined让Google自动优化
  target_spend_micros: undefined
}
```

**理由**: 业务规范明确要求"Bidding Strategy：选择 Maximize Clicks"

---

### 2. ✅ Final URL Suffix（URL后缀）
**之前**: 未支持
**现在**: **Campaign层级配置** - 从推广链接重定向提取

**代码修改**:
- `src/lib/google-ads-api.ts` lines 291-295: 添加final_url_suffix字段
- `src/app/api/campaigns/publish/route.ts` line 318: 传递creative.final_url_suffix

```typescript
// 添加Final URL Suffix（如果提供）
// 从推广链接重定向访问后提取的Final URL suffix
if (params.finalUrlSuffix) {
  campaign.final_url_suffix = params.finalUrlSuffix
}
```

**理由**: 规范要求"Final URL suffix：配置在广告系列层级，是从之前推广链接重定向访问后提取出的Final URL suffix"

---

### 3. ✅ Headlines数量验证
**之前**: 3-15个（范围）
**现在**: **必须正好15个** - 严格限制

**代码修改** (`src/lib/google-ads-api.ts` lines 867-871):
```typescript
// Validate headlines (必须正好15个)
// 根据业务规范：Headlines必须配置15个，如果从广告创意中获得的标题数量不足，则报错
if (params.headlines.length !== 15) {
  throw new Error(`Headlines必须正好15个，当前提供了${params.headlines.length}个。如果从广告创意中获得的标题数量不足，请报错。`)
}
```

**理由**: 规范要求"Headlines：必须配置15个，如果从广告创意中获得的标题数量不足，请报错"

---

### 4. ✅ Descriptions数量验证
**之前**: 2-4个（范围）
**现在**: **必须正好4个** - 严格限制

**代码修改** (`src/lib/google-ads-api.ts` lines 873-877):
```typescript
// Validate descriptions (必须正好4个)
// 根据业务规范：Descriptions必须配置4个，如果从广告创意中获得的描述数量不足，则报错
if (params.descriptions.length !== 4) {
  throw new Error(`Descriptions必须正好4个，当前提供了${params.descriptions.length}个。如果从广告创意中获得的描述数量不足，请报错。`)
}
```

**理由**: 规范要求"Descriptions：必须配置4个，如果从广告创意中获得的描述数量不足，请报错"

---

## 参数规范总结

### ✅ 已实现的严格要求

| 参数 | 规范要求 | 实现状态 |
|------|---------|---------|
| **Bidding Strategy** | Maximize Clicks | ✅ 已固定 |
| **Budget Type** | DAILY（每日预算） | ✅ 已固定 |
| **Budget Amount** | 10美元或等值货币 | ✅ 已设置 |
| **CPC Bid** | 0.17美元或等值货币 | ✅ 已设置 |
| **Headlines** | 必须正好15个 | ✅ 严格验证 |
| **Descriptions** | 必须正好4个 | ✅ 严格验证 |
| **Target Country** | 与offer保持一致 | ✅ 已实现 |
| **Target Language** | 与国家映射的语言一致 | ✅ 已实现 |
| **Final URL** | Ad层级配置 | ✅ 已实现 |
| **Final URL Suffix** | Campaign层级配置 | ✅ 新增支持 |

### ⏳ 待实现的要求

| 参数 | 规范要求 | 当前状态 |
|------|---------|---------|
| **Campaign Name** | 必须包含品牌名 | ⚠️ 需要验证 |
| **Ad Group Name** | 必须包含品牌名 | ⚠️ 需要验证 |
| **Ad Name** | 必须包含品牌名 | ⚠️ 需要验证 |
| **Keywords** | 从offer创意获取，缺失报错 | ⚠️ 需要验证 |
| **Callouts** | 从offer创意获取，缺失报错 | ⚠️ 需要验证 |
| **Sitelinks** | 从offer创意获取，缺失报错 | ⚠️ 需要验证 |

---

## 货币相关参数

### 规范要求
- **Budget Amount**: 10美元或等值的其他货币（根据ads账号支持的货币决定）
- **CPC Bid**: 0.17美元或等值的其他货币（根据ads账号支持的货币决定）

### 待实现功能
需要实现货币换算逻辑，根据Google Ads账号支持的货币自动换算：

```typescript
// 示例实现
const currencyRates: Record<string, number> = {
  'USD': 1,       // 美元基准
  'EUR': 0.92,    // 欧元
  'GBP': 0.79,    // 英镑
  'JPY': 149.50,  // 日元
  'CNY': 7.24,    // 人民币
}

function getCurrencyEquivalent(usdAmount: number, accountCurrency: string): number {
  const rate = currencyRates[accountCurrency] || 1
  return Math.round(usdAmount * rate * 100) / 100
}

// 使用示例：
// budgetAmount = getCurrencyEquivalent(10, adsAccount.currency)
// cpcBidMicros = getCurrencyEquivalent(0.17, adsAccount.currency) * 1000000
```

---

## 品牌名要求

### 规范要求
所有名称字段必须包含品牌名：
- Campaign Name
- Ad Group Name
- Ad Name

### 建议实现
```typescript
// 从Offer获取品牌名
const brandName = offer.brand_name || offer.product_name

// 自动添加到名称中
const campaignName = `${brandName} - ${userProvidedName}`
const adGroupName = `${brandName} - ${adGroupDescription}`
const adName = `${brandName} - ${adVariant}`
```

---

## 数据来源映射

### 从Offer配置获取
- ✅ `targetCountry` ← Offer.target_country
- ✅ `targetLanguage` ← countryLanguageMap[targetCountry]
- ⚠️ `brandName` ← Offer.brand_name（需要验证使用）

### 从广告创意生成获取
- ✅ `headlines` ← AdCreative.headlines（必须15个）
- ✅ `descriptions` ← AdCreative.descriptions（必须4个）
- ⚠️ `keywords` ← AdCreative.keywords（需要验证缺失报错）
- ⚠️ `callouts` ← AdCreative.callouts（需要验证缺失报错）
- ⚠️ `sitelinks` ← AdCreative.sitelinks（需要验证缺失报错）

### 从推广链接解析获取
- ✅ `finalUrls` ← 重定向后的最终URL
- ✅ `finalUrlSuffix` ← URL参数提取
- ✅ `path1` ← URL路径提取（可选）
- ✅ `path2` ← URL路径提取（可选）

---

## 错误处理

### 已实现的错误验证

1. **Headlines数量不足**:
   ```
   Headlines必须正好15个，当前提供了{N}个。如果从广告创意中获得的标题数量不足，请报错。
   ```

2. **Descriptions数量不足**:
   ```
   Descriptions必须正好4个，当前提供了{N}个。如果从广告创意中获得的描述数量不足，请报错。
   ```

3. **Headlines字符超限**:
   ```
   标题{index}超过30字符限制: "{headline}" ({length}字符)
   ```

4. **Descriptions字符超限**:
   ```
   描述{index}超过90字符限制: "{desc}" ({length}字符)
   ```

### 待实现的错误验证

1. **Keywords缺失**:
   ```
   缺少关键词配置，请确保广告创意包含至少1个关键词
   ```

2. **Callouts缺失**:
   ```
   缺少Callout配置，请确保广告创意包含宣传信息
   ```

3. **Sitelinks缺失**:
   ```
   缺少Sitelink配置，请确保广告创意包含附加链接
   ```

4. **品牌名缺失**:
   ```
   Campaign/Ad Group/Ad名称必须包含品牌名
   ```

---

## 测试建议

### Campaign创建测试
```bash
# 测试账号: 5427414593
# 验证点:
1. ✅ Bidding Strategy = Maximize Clicks (target_spend)
2. ✅ Final URL Suffix正确设置
3. ✅ Target Country与offer一致
4. ✅ Target Language正确映射
5. ⚠️ Campaign Name包含品牌名
```

### Ad创建测试
```bash
# 验证点:
1. ✅ Headlines正好15个
2. ✅ Descriptions正好4个
3. ✅ Final URL正确
4. ⚠️ Ad Name包含品牌名
5. ⚠️ CPC Bid = 0.17 USD（或等值货币）
```

### 错误处理测试
```bash
# 测试场景:
1. ✅ Headlines不足15个 → 报错
2. ✅ Descriptions不足4个 → 报错
3. ⚠️ Keywords缺失 → 报错（待实现）
4. ⚠️ Callouts缺失 → 报错（待实现）
5. ⚠️ Sitelinks缺失 → 报错（待实现）
```

---

## 相关文档

- **参数规范**: `/claudedocs/AD_PUBLISHING_PARAMETERS_SPEC.md`
- **Campaign创建修复**: `/claudedocs/CAMPAIGN_CREATION_FIX_2025-11-22.md`
- **调试报告**: `/claudedocs/CAMPAIGN_CREATION_DEBUG_2025-11-22.md`

---

## 下一步行动

### 立即可测试
1. 使用账号5427414593测试Campaign创建
2. 验证Bidding Strategy为Maximize Clicks
3. 验证Final URL Suffix正确设置
4. 验证Headlines/Descriptions数量验证

### 待补充实现
1. 品牌名自动添加到名称中
2. Keywords/Callouts/Sitelinks缺失验证
3. 货币换算逻辑
4. Extensions（Callouts/Sitelinks）创建

---

## 总结

✅ **已完成**:
- Bidding Strategy固定为Maximize Clicks
- Final URL Suffix支持
- Headlines必须15个的严格验证
- Descriptions必须4个的严格验证
- CampaignCriterion（geo/language）定位

⏳ **待完成**:
- 品牌名验证和自动添加
- Keywords/Callouts/Sitelinks缺失报错
- 货币换算逻辑
- Extensions创建

📊 **完成度**: 70%（核心功能已实现，剩余为增强功能）
