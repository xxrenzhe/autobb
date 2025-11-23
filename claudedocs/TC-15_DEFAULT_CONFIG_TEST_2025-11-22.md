# TC-15: 一键上广告默认配置验证测试报告

**测试日期**: 2025-11-22
**测试环境**: localhost:3000
**测试方式**: 代码审查 + 配置验证

---

## 测试总结

| 配置项 | 要求值 | 实际值 | 状态 | 文件位置 |
|--------|--------|--------|------|----------|
| Marketing Objective | Website traffic | Website traffic (由Bidding Strategy决定) | ✅ PASS | google-ads-api.ts:288 |
| Conversion goals | Page views | 未明确配置 | ⚠️ N/A | - |
| Campaign type | Search | SEARCH | ✅ PASS | google-ads-api.ts:274 |
| Bidding strategy | Maximize clicks | TARGET_SPEND (Maximize Clicks) | ✅ PASS | google-ads-api.ts:288 |
| Max CPC bid limit | ¥1.2 或 US$0.17 | $0.17 (170000 micros) | ✅ PASS | google-ads-api.ts:290 |
| Budget | 对应货币100单位 | **10 USD** | ❌ **FAIL** | Step2CampaignConfig.tsx:62 |
| EU political ads | No | DOES_NOT_CONTAIN | ✅ PASS | google-ads-api.ts:295 |
| 用户可修改 | 是 | 是 | ✅ PASS | Step2CampaignConfig.tsx |

**总体通过率**: 75% (6/8)
**关键问题**: Budget默认值错误（10 USD应为100 USD）

---

## 详细验证结果

### 1. Marketing Objective (营销目标)

**要求**: Website traffic
**实际**: Website traffic ✅

**验证方式**: 由 Bidding Strategy 决定
```typescript
// src/lib/google-ads-api.ts:288
campaign.bidding_strategy_type = enums.BiddingStrategyType.TARGET_SPEND  // Maximize Clicks
```

**前端显示逻辑**:
```typescript
// src/app/(app)/offers/[id]/launch/steps/Step2CampaignConfig.tsx:408-413
{config.biddingStrategy === 'MAXIMIZE_CLICKS' ? '网站流量 (Web Traffic)' :
 config.biddingStrategy === 'MAXIMIZE_CONVERSIONS' ? '潜在客户 (Leads)' :
 '手动出价 (Manual)'}
```

**说明**: Google Ads API中，营销目标由bidding_strategy_type隐式决定：
- TARGET_SPEND (Maximize Clicks) → Website Traffic
- TARGET_CPA (Maximize Conversions) → Leads/Conversions

---

### 2. Conversion Goals

**要求**: Page views
**实际**: 未明确配置 ⚠️

**说明**: Conversion goals在Google Ads中是可选配置，通常需要：
1. 先设置Google Ads转化跟踪代码
2. 通过ConversionGoalCampaignConfig服务关联到Campaign

**影响**: 不影响广告投放，但无法精确跟踪转化

**建议**: 在后续版本中补充Conversion Goals配置功能

---

### 3. Campaign Type

**要求**: Search
**实际**: SEARCH ✅

**代码位置**: `src/lib/google-ads-api.ts:274`
```typescript
advertising_channel_type: enums.AdvertisingChannelType.SEARCH
```

**验证**: 硬编码为SEARCH类型，符合要求

---

### 4. Bidding Strategy

**要求**: Maximize clicks
**实际**: TARGET_SPEND (Maximize Clicks) ✅

**代码位置**:
- Frontend: `Step2CampaignConfig.tsx:66`
  ```typescript
  biddingStrategy: 'MAXIMIZE_CLICKS'
  ```
- Backend: `google-ads-api.ts:288-291`
  ```typescript
  campaign.bidding_strategy_type = enums.BiddingStrategyType.TARGET_SPEND
  campaign.target_spend = {
    cpc_bid_ceiling_micros: params.cpcBidCeilingMicros || 170000
  }
  ```

**说明**:
- Google Ads API中 "Maximize Clicks" 的枚举值是 `TARGET_SPEND`
- 前端使用 `MAXIMIZE_CLICKS`，后端转换为 `TARGET_SPEND`

---

### 5. Maximum CPC Bid Limit

**要求**: ¥1.2 或 US$0.17
**实际**: $0.17 (170000 micros) ✅

**代码位置**:
- Frontend Default: `Step2CampaignConfig.tsx:72`
  ```typescript
  maxCpcBid: 0.17
  ```
- Backend Default: `google-ads-api.ts:290`
  ```typescript
  cpc_bid_ceiling_micros: params.cpcBidCeilingMicros || 170000  // 0.17 USD
  ```

**货币转换**:
- Google Ads API使用micros单位: 1 USD = 1,000,000 micros
- 170000 micros = 0.17 USD ✅
- ¥1.2 约等于 $0.17 (汇率1:7)

---

### 6. Budget 🐛

**要求**: 对应货币100单位
**实际**: **10 USD** ❌

**问题代码位置**: `src/app/(app)/offers/[id]/launch/steps/Step2CampaignConfig.tsx:62`
```typescript
budgetAmount: 10,  // ❌ 应该是100
```

**影响**:
- 默认预算偏低（10 USD/day）
- 可能导致广告展示量不足

**建议修复**:
```typescript
budgetAmount: 100,  // ✅ 修正为100 USD
```

**用户可修改**: 是，但默认值不符合规范

---

### 7. EU Political Ads

**要求**: No
**实际**: DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING ✅

**代码位置**: `src/lib/google-ads-api.ts:295`
```typescript
campaign.contains_eu_political_advertising =
  enums.EuPoliticalAdvertisingStatus.DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING
```

**说明**:
- 硬编码为 "不包含EU政治广告"
- 符合大多数商业广告场景
- Google Ads API的必填字段

---

### 8. 用户可修改性

**要求**: 所有默认值支持用户手动修改
**实际**: 是 ✅

**验证**: 所有配置项在Step2CampaignConfig.tsx中均可编辑：
- Campaign Name: `<Input>` 组件
- Budget: `<Input type="number">` + `<Select>` (DAILY/TOTAL)
- Target Country/Language: `<Input>` 组件
- Bidding Strategy: `<Select>` 组件 (3个选项)
- CPC Bid: `<Input type="number">` 组件
- Keywords: 动态添加/删除
- Headlines: 15个可编辑输入框
- Descriptions: 4个可编辑文本框
- Final URLs: `<Input>` 组件

**用户体验**:
- 清晰的字段标签和Badge提示
- 实时字符计数（Headlines 30字符，Descriptions 90字符）
- 验证错误提示
- 自动填充功能（Headlines/Descriptions数量不足时）

---

## 代码架构分析

### Frontend配置组件
**文件**: `src/app/(app)/offers/[id]/launch/steps/Step2CampaignConfig.tsx`

**默认值初始化**:
```typescript
const [config, setConfig] = useState<CampaignConfig>(
  initialConfig || {
    // Campaign Level
    campaignName: `${offer.brand || 'Brand'} - ${offer.target_country || 'US'} Campaign`,
    budgetAmount: 10,  // 🐛 BUG: 应该是100
    budgetType: 'DAILY' as const,
    targetCountry: offer.target_country || 'US',
    targetLanguage: offer.target_language || 'en',
    biddingStrategy: 'MAXIMIZE_CLICKS',
    finalUrlSuffix: selectedCreative?.final_url_suffix || offer.finalUrlSuffix || '',

    // Ad Group Level
    adGroupName: `${offer.brand || 'Brand'} - Ad Group 1`,
    maxCpcBid: 0.17,

    // Ad Level
    headlines: selectedCreative?.headlines || [],
    descriptions: selectedCreative?.descriptions || [],
    finalUrls: [selectedCreative?.final_url || offer.finalUrl || offer.url],

    // Extensions
    callouts: selectedCreative?.callouts || [],
    sitelinks: selectedCreative?.sitelinks || []
  }
)
```

### Backend Google Ads API
**文件**: `src/lib/google-ads-api.ts`

**Campaign创建逻辑**:
```typescript
export async function createGoogleAdsCampaign(params: {
  customerId: string
  refreshToken: string
  campaignName: string
  budgetAmount: number
  budgetType: 'DAILY' | 'TOTAL'
  status: 'ENABLED' | 'PAUSED'
  biddingStrategy?: string
  cpcBidCeilingMicros?: number
  targetCountry?: string
  targetLanguage?: string
  finalUrlSuffix?: string
  // ...
}) {
  const campaign: any = {
    name: params.campaignName,
    status: enums.CampaignStatus.PAUSED,
    advertising_channel_type: enums.AdvertisingChannelType.SEARCH,  // ✅ Search
    campaign_budget: budgetResourceName,
    network_settings: {
      target_google_search: true,
      target_search_network: true,
      target_content_network: true,  // Display Expansion
      target_partner_search_network: false,
    },
  }

  // Bidding Strategy
  campaign.bidding_strategy_type = enums.BiddingStrategyType.TARGET_SPEND  // ✅ Maximize Clicks
  campaign.target_spend = {
    cpc_bid_ceiling_micros: params.cpcBidCeilingMicros || 170000  // ✅ $0.17
  }

  // EU Political Ads
  campaign.contains_eu_political_advertising =
    enums.EuPoliticalAdvertisingStatus.DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING  // ✅ No

  // Final URL Suffix
  if (params.finalUrlSuffix) {
    campaign.final_url_suffix = params.finalUrlSuffix
  }

  // 创建Campaign并添加Geo/Language定位
  // ...
}
```

---

## 问题总结

### 🐛 BUG-003: Budget默认值错误 (P1)

**问题描述**: Budget默认值为10 USD，但需求规范要求100单位
**发现位置**: `Step2CampaignConfig.tsx:62`
**影响范围**: 所有新创建的Offer广告投放
**严重程度**: P1 (High) - 影响广告效果

**当前代码**:
```typescript
budgetAmount: 10,  // ❌ 错误
```

**建议修复**:
```typescript
budgetAmount: 100,  // ✅ 符合规范
```

**验证方式**: 修改后重新测试Offer广告投放流程

---

## 其他发现

### 💡 Conversion Goals未配置 (P3)

**说明**: 当前实现未包含Conversion Goals配置，属于可选功能

**原因**:
- Conversion Goals需要额外的Google Ads转化跟踪配置
- 需要ConversionGoalCampaignConfig服务单独设置

**影响**:
- 不影响广告投放
- 无法精确跟踪"页面浏览"转化

**建议**:
- 在MVP阶段可跳过此功能
- 后续版本补充完整的Conversion Tracking功能

---

## 测试建议

### 立即执行 (P0)
1. ✅ 修复BUG-003: Budget默认值从10改为100
2. 🔄 重新验证TC-15完整性

### 短期优化 (P1)
1. 补充Conversion Goals配置功能
2. 增加货币转换逻辑（USD vs CNY）
3. 增加Budget范围验证（建议最小10，最大10000）

### 长期规划 (P2)
1. 支持多种Bidding Strategy (Target CPA, Target ROAS等)
2. 完整的Conversion Tracking设置
3. 支持Display和Video Campaign类型

---

## 结论

### 总体评价
**基本合格 - 核心配置正确，存在1个高优先级Bug**

### 通过情况
- 核心配置: 6/8 ✅
- 关键Bug数: 1个 (Budget默认值)
- 用户体验: 优秀 (所有字段可编辑，验证完善)

### 建议
**可以继续测试TC-16至TC-18** - Budget问题不影响功能测试，只是默认值不符合规范，用户可手动修改

**生产部署前必须修复**: BUG-003 Budget默认值

---

**测试执行人**: Claude Code
**文件审查数**: 2个主要文件
**代码行数**: ~1000行
**测试耗时**: 约20分钟
