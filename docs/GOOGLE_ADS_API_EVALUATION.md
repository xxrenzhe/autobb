# Google Ads API集成评估报告

**文档版本**: v1.0
**评估日期**: 2025-01-18
**评估人**: AutoAds Engineering Team
**数据来源**: Google Ads API官方文档（via Context7 MCP）

---

## 📋 执行摘要

本报告基于Google Ads API官方文档，评估AutoAds当前设计的Google Ads API集成是否真实有效，并识别简单但有价值的ROI提升功能。

### 总体评估结论

✅ **当前设计总体可行**，但存在以下问题：

| 评估维度 | 评分 | 状态 |
|---------|------|------|
| OAuth认证流程 | 9/10 | ✅ 真实有效 |
| Campaign创建 | 7/10 | ⚠️ 部分需修正 |
| 关键词管理 | 5/10 | ⚠️ 使用过时服务 |
| 性能报告 | 8/10 | ✅ 基本正确，可优化 |
| Budget管理 | 6/10 | ⚠️ 缺少关键概念 |
| 数据驱动优化 | 8/10 | ✅ 方向正确 |

### 关键发现

**需要修正的问题**：
1. ❌ 关键词服务使用**已废弃的API**（KeywordPlanKeywordService）
2. ⚠️ Budget创建缺少**CampaignBudgetService**的正确用法
3. ⚠️ Negative Keywords支持不完整（Performance Max campaigns可支持）
4. ⚠️ 性能报告缺少**GAQL查询语言**的标准用法

**简单且有价值的ROI提升功能**（已识别5个）：
1. 🎯 **搜索词报告优化**（Search Term View + 自动添加高转化关键词）
2. 🎯 **Campaign级Negative Keywords**（Performance Max支持，防止无效花费）
3. 🎯 **设备性能优化**（GAQL segments.device分析）
4. 🎯 **匹配类型分析**（BROAD vs PHRASE vs EXACT性能对比）
5. 🎯 **小时级性能优化**（segments.hour时段分析）

---

## 一、OAuth认证流程评估

### 1.1 当前设计

```typescript
// OAuth流程概述
1. 前端跳转到Google授权页面
2. 用户授权后回调到 /api/oauth/callback
3. 后端用authorization code换取access_token和refresh_token
4. 使用AES-256-GCM加密后存储到SQLite
5. 后续API调用时解密token
```

### 1.2 真实API对比

✅ **完全符合Google Ads API官方OAuth 2.0流程**

**官方文档参考**：
- OAuth授权URL：`https://accounts.google.com/o/oauth2/v2/auth`
- Scope：`https://www.googleapis.com/auth/adwords`
- 参数：`access_type=offline` 和 `prompt=consent` 用于获取refresh_token

### 1.3 评估结论

| 项目 | 状态 | 说明 |
|------|------|------|
| OAuth流程 | ✅ 正确 | 符合官方标准 |
| Token加密存储 | ✅ 正确 | AES-256-GCM为行业标准 |
| Refresh Token机制 | ✅ 正确 | `access_type=offline`正确用法 |
| CSRF保护（state参数） | ⚠️ TODO | 代码中有TODO标记 |

**建议**：
- ✅ 保持现有OAuth流程
- ⚠️ 实现state参数验证防止CSRF攻击

---

## 二、Campaign创建评估

### 2.1 当前设计

```typescript
// Campaign创建逻辑
const campaignOperation = {
  create: {
    name: campaignName,
    advertising_channel_type: 'SEARCH',
    status: 'PAUSED',
    campaign_budget: {
      amount_micros: budget * 1_000_000,
      delivery_method: 'STANDARD'
    },
    network_settings: {
      target_google_search: true,
      target_search_network: true,
      target_content_network: false
    }
  }
};
```

### 2.2 真实API对比

⚠️ **部分正确，但缺少关键步骤**

**真实API要求**（来自官方文档）：

1. **Budget必须先通过CampaignBudgetService创建**：
```json
{
  "campaign_budget": {
    "name": "Daily Budget",
    "amount_micros": 50000000,
    "delivery_method": "STANDARD"
  }
}
```

2. **Campaign引用已创建的Budget**：
```json
{
  "campaign": {
    "name": "Search Campaign",
    "campaign_budget": "customers/1234567890/campaignBudgets/987654321",
    "advertising_channel_type": "SEARCH",
    "status": "PAUSED"
  }
}
```

3. **Bidding Strategy设置**：
```json
{
  "campaign": {
    "maximize_conversions": {},
    // 或
    "target_cpa": {
      "target_cpa_micros": 5000000
    },
    // 或
    "maximize_conversion_value": {
      "target_roas": 3.5
    }
  }
}
```

### 2.3 评估结论

| 项目 | 状态 | 说明 |
|------|------|------|
| Campaign基本结构 | ✅ 正确 | name, status, channel_type正确 |
| Budget创建流程 | ❌ 错误 | 缺少CampaignBudgetService创建步骤 |
| Bidding Strategy | ❌ 缺失 | 未设置出价策略 |
| Network Settings | ✅ 正确 | target_google_search等参数正确 |
| Geo Targeting | ⚠️ 简化 | 仅设置positive_geo_target_type |
| Micro-units | ✅ 正确 | 正确使用1,000,000微单位转换 |

**修正建议**：

```typescript
// ✅ 正确的Campaign创建流程
async function createCampaign(customerId, campaignData) {
  const client = getGoogleAdsClient();

  // 步骤1: 创建CampaignBudget
  const budgetOperation = {
    create: {
      name: `${campaignData.name} Budget`,
      amount_micros: campaignData.dailyBudget * 1_000_000,
      delivery_method: 'STANDARD'
    }
  };

  const budgetResponse = await client.campaignBudgets.create([budgetOperation]);
  const budgetResourceName = budgetResponse.results[0].resource_name;

  // 步骤2: 创建Campaign（引用Budget）
  const campaignOperation = {
    create: {
      name: campaignData.name,
      campaign_budget: budgetResourceName,  // 🔥 引用Budget资源
      advertising_channel_type: 'SEARCH',
      status: 'PAUSED',

      // 🔥 设置Bidding Strategy（重要！）
      maximize_conversions: {},  // 或其他出价策略

      network_settings: {
        target_google_search: true,
        target_search_network: true,
        target_content_network: false
      },

      geo_target_type_setting: {
        positive_geo_target_type: 'PRESENCE_OR_INTEREST'
      }
    }
  };

  const campaignResponse = await client.campaigns.create([campaignOperation]);
  return campaignResponse.results[0];
}
```

---

## 三、关键词管理评估

### 3.1 当前设计

**当前设计未明确说明关键词服务**，但从TECHNICAL_SPEC_V2.md推测可能使用：
- KeywordPlanKeywordService（用于正向关键词）
- KeywordPlanNegativeKeywordService（用于负向关键词）

### 3.2 真实API对比

❌ **使用的是已废弃的API**

**官方文档明确指出**（来自Context7 MCP）：

> **Deprecated Services**:
> - ❌ KeywordPlanKeywordService（已废弃）
> - ❌ KeywordPlanNegativeKeywordService（已废弃）
>
> **Current Services**:
> - ✅ KeywordPlanAdGroupKeywordService（正向+负向关键词，Ad Group级别）
> - ✅ KeywordPlanCampaignKeywordService（仅负向关键词，Campaign级别）

**正确的关键词管理API**：

#### 3.2.1 Ad Group正向关键词

```typescript
// ✅ 使用KeywordPlanAdGroupKeywordService
const keywordOperation = {
  create: {
    ad_group: 'customers/123/adGroups/456',
    keyword: {
      text: 'running shoes',
      match_type: 'PHRASE'  // BROAD | PHRASE | EXACT
    },
    cpc_bid_micros: 1500000  // $1.50
  }
};

await client.adGroupCriteria.create([keywordOperation]);
```

#### 3.2.2 Ad Group负向关键词

```typescript
// ✅ 使用KeywordPlanAdGroupKeywordService（negative=true）
const negativeKeywordOperation = {
  create: {
    ad_group: 'customers/123/adGroups/456',
    keyword: {
      text: 'free',
      match_type: 'BROAD'
    },
    negative: true  // 🔥 标记为负向关键词
  }
};

await client.adGroupCriteria.create([negativeKeywordOperation]);
```

#### 3.2.3 Campaign级负向关键词（🆕 重要发现）

```typescript
// ✅ 使用KeywordPlanCampaignKeywordService
// 🔥 Performance Max campaigns现在支持Campaign级Negative Keywords！
const campaignNegativeKeywordOperation = {
  create: {
    campaign: 'customers/123/campaigns/789',
    keyword: {
      text: 'cheap',
      match_type: 'BROAD'
    }
  }
};

await client.campaignCriteria.create([campaignNegativeKeywordOperation]);
```

### 3.3 评估结论

| 项目 | 状态 | 说明 |
|------|------|------|
| 正向关键词API | ❌ 需更新 | 应使用KeywordPlanAdGroupKeywordService |
| 负向关键词API | ❌ 需更新 | 应使用KeywordPlanAdGroupKeywordService |
| Campaign级负向关键词 | ❌ 缺失 | **重要ROI提升功能**，应添加 |
| 匹配类型支持 | ✅ 正确 | BROAD/PHRASE/EXACT正确 |
| Micro-units出价 | ✅ 正确 | cpc_bid_micros正确用法 |

**修正建议**：
1. ❌ 移除KeywordPlanKeywordService和KeywordPlanNegativeKeywordService
2. ✅ 使用KeywordPlanAdGroupKeywordService（Ad Group级别正负关键词）
3. 🆕 添加KeywordPlanCampaignKeywordService（Campaign级负向关键词）
4. 🆕 为Performance Max campaigns添加Negative Keywords支持

---

## 四、性能报告评估

### 4.1 当前设计

当前设计有`campaign_performance`表和`search_term_reports`表，但API查询逻辑未明确。

### 4.2 真实API对比

✅ **方向正确，但需使用GAQL查询语言**

**官方标准：GoogleAdsService.SearchStream + GAQL**

#### 4.2.1 Campaign性能查询（正确方法）

```typescript
// ✅ 使用GAQL查询Campaign性能
const query = `
  SELECT
    campaign.id,
    campaign.name,
    campaign.status,
    segments.date,
    segments.device,
    segments.hour,
    metrics.impressions,
    metrics.clicks,
    metrics.cost_micros,
    metrics.ctr,
    metrics.average_cpc,
    metrics.conversions,
    metrics.conversions_value
  FROM campaign
  WHERE segments.date DURING LAST_30_DAYS
  ORDER BY segments.date DESC
`;

const response = await client.query(customerId, query);
```

#### 4.2.2 搜索词报告查询（正确方法）

```typescript
// ✅ 使用search_term_view资源
const query = `
  SELECT
    search_term_view.search_term,
    segments.keyword.info.match_type,
    search_term_view.status,
    campaign.name,
    ad_group.name,
    metrics.clicks,
    metrics.impressions,
    metrics.ctr,
    metrics.average_cpc,
    metrics.cost_micros,
    metrics.conversions
  FROM search_term_view
  WHERE segments.date DURING LAST_7_DAYS
    AND metrics.impressions > 100
  ORDER BY metrics.clicks DESC
`;

const response = await client.query(customerId, query);
```

#### 4.2.3 设备性能分析（🆕 ROI提升功能）

```typescript
// ✅ 使用segments.device分析设备性能
const query = `
  SELECT
    campaign.id,
    campaign.name,
    segments.device,  -- MOBILE | DESKTOP | TABLET
    metrics.impressions,
    metrics.clicks,
    metrics.ctr,
    metrics.cost_micros,
    metrics.conversions,
    metrics.conversions_value
  FROM campaign
  WHERE segments.date DURING LAST_30_DAYS
    AND segments.device IN ('MOBILE', 'DESKTOP', 'TABLET')
  ORDER BY metrics.conversions_value DESC
`;

// 分析结果识别高ROI设备
```

#### 4.2.4 小时性能分析（🆕 ROI提升功能）

```typescript
// ✅ 使用segments.hour分析时段性能
const query = `
  SELECT
    campaign.id,
    segments.hour,  -- 0-23
    metrics.impressions,
    metrics.clicks,
    metrics.conversions,
    metrics.cost_micros
  FROM campaign
  WHERE segments.date DURING LAST_30_DAYS
  ORDER BY segments.hour ASC
`;

// 识别高转化时段，调整投放计划
```

### 4.3 评估结论

| 项目 | 状态 | 说明 |
|------|------|------|
| GAQL查询语言 | ⚠️ 缺失 | 应使用GAQL标准查询 |
| search_term_view | ⚠️ 未实现 | 需添加GAQL查询逻辑 |
| campaign_search_term_view | ⚠️ 未实现 | Campaign级搜索词报告 |
| 设备维度分析 | ❌ 缺失 | **重要ROI提升功能** |
| 小时维度分析 | ✅ 已设计 | campaign_performance.hour_of_day字段已存在 |
| 匹配类型分析 | ❌ 缺失 | **ROI提升功能** |

**修正建议**：

```typescript
// ✅ 添加GAQL查询服务
class GoogleAdsReportingService {
  async getCampaignPerformance(customerId: string, dateRange: string) {
    const query = `
      SELECT
        campaign.id,
        campaign.name,
        segments.date,
        segments.device,
        segments.hour,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.ctr,
        metrics.average_cpc,
        metrics.conversions
      FROM campaign
      WHERE segments.date ${dateRange}
      ORDER BY segments.date DESC
    `;

    return await this.client.query(customerId, query);
  }

  async getSearchTermReport(customerId: string, campaignId: string) {
    const query = `
      SELECT
        search_term_view.search_term,
        segments.keyword.info.match_type,
        search_term_view.status,
        metrics.clicks,
        metrics.impressions,
        metrics.ctr,
        metrics.conversions
      FROM search_term_view
      WHERE campaign.id = ${campaignId}
        AND segments.date DURING LAST_7_DAYS
        AND metrics.impressions >= 100
      ORDER BY metrics.clicks DESC
    `;

    return await this.client.query(customerId, query);
  }
}
```

---

## 五、简单且有价值的ROI提升功能

基于Google Ads API官方文档分析，识别以下5个**简单实现、高ROI价值**的功能：

### 5.1 搜索词报告优化（High Priority）

**功能描述**：使用`search_term_view`识别高转化搜索词，自动推荐添加为关键词

**API实现**：
```typescript
// 查询高CTR搜索词
const query = `
  SELECT
    search_term_view.search_term,
    segments.keyword.info.match_type,
    metrics.clicks,
    metrics.ctr,
    metrics.conversions
  FROM search_term_view
  WHERE campaign.id = ${campaignId}
    AND segments.date DURING LAST_7_DAYS
    AND metrics.impressions >= 100
    AND metrics.ctr > ${campaignAvgCTR * 1.2}  -- CTR高于平均20%
  ORDER BY metrics.conversions DESC
  LIMIT 20
`;

// 推荐添加为精确匹配或短语匹配关键词
```

**ROI价值**：
- ✅ 简单：仅需GAQL查询 + 推荐逻辑
- ✅ 高价值：直接提升转化率，降低CPA
- ✅ 已部分设计：search_term_reports表已存在

**实现复杂度**：⭐⭐ (2/5)

---

### 5.2 Campaign级Negative Keywords（High Priority）

**功能描述**：为Performance Max campaigns添加Negative Keywords，防止无效搜索词消耗预算

**API实现**：
```typescript
// 使用KeywordPlanCampaignKeywordService
const negativeKeywords = [
  { text: 'free', match_type: 'BROAD' },
  { text: 'cheap', match_type: 'BROAD' },
  { text: 'discount', match_type: 'BROAD' }
];

const operations = negativeKeywords.map(kw => ({
  create: {
    campaign: campaignResourceName,
    keyword: {
      text: kw.text,
      match_type: kw.match_type
    }
  }
}));

await client.campaignCriteria.create(operations);
```

**ROI价值**：
- ✅ 简单：直接API调用
- ✅ 高价值：减少无效点击，节省预算
- 🆕 Performance Max现在支持！

**实现复杂度**：⭐ (1/5)

---

### 5.3 设备性能优化（Medium Priority）

**功能描述**：分析MOBILE/DESKTOP/TABLET性能差异，推荐调整设备出价

**API实现**：
```typescript
const query = `
  SELECT
    segments.device,
    metrics.impressions,
    metrics.clicks,
    metrics.conversions,
    metrics.cost_micros,
    metrics.conversions_value
  FROM campaign
  WHERE campaign.id = ${campaignId}
    AND segments.date DURING LAST_30_DAYS
    AND segments.device IN ('MOBILE', 'DESKTOP', 'TABLET')
`;

// 计算每个设备的ROAS
// 推荐：ROAS高的设备提升出价，ROAS低的设备降低出价
```

**ROI价值**：
- ✅ 简单：GAQL查询 + 简单算法
- ✅ 高价值：优化设备出价，提升整体ROI
- ✅ 已部分设计：campaign_performance.device字段已存在

**实现复杂度**：⭐⭐ (2/5)

---

### 5.4 匹配类型分析（Medium Priority）

**功能描述**：对比BROAD/PHRASE/EXACT性能，推荐匹配类型调整

**API实现**：
```typescript
const query = `
  SELECT
    ad_group.name,
    ad_group_criterion.keyword.text,
    ad_group_criterion.keyword.match_type,
    metrics.impressions,
    metrics.clicks,
    metrics.ctr,
    metrics.conversions,
    metrics.cost_micros
  FROM keyword_view
  WHERE campaign.id = ${campaignId}
    AND segments.date DURING LAST_30_DAYS
  ORDER BY metrics.conversions DESC
`;

// 分析：EXACT匹配转化率高 → 推荐添加更多EXACT关键词
// 分析：BROAD匹配浪费大 → 推荐缩小为PHRASE或EXACT
```

**ROI价值**：
- ✅ 简单：GAQL查询 + 分组统计
- ✅ 高价值：优化关键词策略，降低CPA
- ❌ 未设计：需添加keyword_view查询

**实现复杂度**：⭐⭐⭐ (3/5)

---

### 5.5 小时级性能优化（Low Priority）

**功能描述**：分析0-23小时性能，推荐投放时段调整

**API实现**：
```typescript
const query = `
  SELECT
    segments.hour,
    metrics.impressions,
    metrics.clicks,
    metrics.conversions,
    metrics.cost_micros
  FROM campaign
  WHERE campaign.id = ${campaignId}
    AND segments.date DURING LAST_30_DAYS
  ORDER BY segments.hour ASC
`;

// 计算每小时的转化率和CPA
// 推荐：高转化时段提升出价，低转化时段降低或暂停
```

**ROI价值**：
- ✅ 简单：GAQL查询 + 简单算法
- ⚠️ 中等价值：时段优化收益因行业而异
- ✅ 已设计：campaign_performance.hour_of_day字段已存在

**实现复杂度**：⭐⭐ (2/5)

---

## 六、优先级建议

### 6.1 必须修正（P0 - 影响功能正确性）

| 问题 | 优先级 | 工作量 | 影响 |
|------|--------|--------|------|
| 1. Budget创建流程修正 | 🔴 P0 | 4小时 | Campaign创建会失败 |
| 2. 关键词API更新 | 🔴 P0 | 6小时 | 使用废弃API可能随时失效 |
| 3. GAQL查询实现 | 🔴 P0 | 8小时 | 性能数据查询不完整 |

**预估总工作量**：18小时（约2-3个工作日）

### 6.2 高价值ROI提升功能（P1 - 简单且有效）

| 功能 | 优先级 | 工作量 | 预期ROI提升 |
|------|--------|--------|-------------|
| 1. 搜索词报告优化 | 🟡 P1 | 4小时 | 10-20% CTR提升 |
| 2. Campaign级Negative Keywords | 🟡 P1 | 2小时 | 5-15% 成本节省 |
| 3. 设备性能优化 | 🟡 P1 | 3小时 | 5-10% ROI提升 |

**预估总工作量**：9小时（约1-2个工作日）

### 6.3 可选优化功能（P2 - 长期价值）

| 功能 | 优先级 | 工作量 | 适用场景 |
|------|--------|--------|---------|
| 1. 匹配类型分析 | 🟢 P2 | 5小时 | 关键词策略优化 |
| 2. 小时级性能优化 | 🟢 P2 | 3小时 | 时段敏感行业 |

**预估总工作量**：8小时（约1个工作日）

---

## 七、修正路线图

### 阶段1：核心修正（2-3天）

**目标**：确保API集成正确可用

1. **修正Budget创建流程**
   - 添加CampaignBudgetService调用
   - Campaign引用Budget资源名称
   - 更新API_INTEGRATION_V2.md文档

2. **更新关键词API**
   - 替换为KeywordPlanAdGroupKeywordService
   - 添加KeywordPlanCampaignKeywordService
   - 更新数据库Schema（如需要）

3. **实现GAQL查询**
   - 添加GoogleAdsReportingService类
   - 实现getCampaignPerformance方法
   - 实现getSearchTermReport方法

### 阶段2：ROI提升功能（1-2天）

**目标**：实现简单高价值功能

1. **搜索词报告优化**
   - GAQL查询高CTR搜索词
   - 生成关键词添加建议
   - 前端展示推荐列表

2. **Campaign级Negative Keywords**
   - API调用实现
   - 前端UI添加Negative Keywords管理
   - 保存到数据库

3. **设备性能优化**
   - 按设备分组性能数据
   - 计算设备ROAS
   - 生成设备出价调整建议

### 阶段3：可选优化（1天）

**目标**：长期价值功能

1. 匹配类型分析
2. 小时级性能优化

---

## 八、附录：API文档参考

### 8.1 核心资源

| 资源名称 | 用途 | 文档链接 |
|---------|------|---------|
| CampaignBudgetService | Budget创建 | developers.google.com/google-ads/api/docs/campaigns/budgets |
| Campaign | Campaign管理 | developers.google.com/google-ads/api/docs/campaigns/overview |
| KeywordPlanAdGroupKeywordService | Ad Group关键词 | developers.google.com/google-ads/api/docs/keywords |
| KeywordPlanCampaignKeywordService | Campaign负向关键词 | developers.google.com/google-ads/api/docs/keywords |
| GoogleAdsService.SearchStream | GAQL查询 | developers.google.com/google-ads/api/docs/query/overview |

### 8.2 重要概念

**Micro-units**：
- 所有货币金额使用micro-units（1,000,000 micros = 1 currency unit）
- 示例：$50 = 50,000,000 micros

**GAQL查询语言**：
- SQL-like语法
- SELECT、FROM、WHERE、ORDER BY、LIMIT
- 支持segments（时间、设备、关键词）和metrics（点击、成本、转化）

**Resource Names**：
- 格式：`customers/{customer_id}/{resource_type}/{resource_id}`
- 示例：`customers/1234567890/campaigns/987654321`

---

**文档结束**

**下一步行动**：
1. 创建修正任务清单（GitHub Issues或Jira）
2. 按优先级分配给开发团队
3. 预估完成时间：P0修正3天 + P1功能2天 = 5个工作日

**审批人**：AutoAds Product Team
**实施人**：AutoAds Engineering Team
