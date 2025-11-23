# Google Ads API配额追踪使用指南

## 实现概述

已实现完整的Google Ads API配额追踪系统：

1. ✅ 数据库表：`google_ads_api_usage` 存储API调用记录
2. ✅ 追踪工具：`src/lib/google-ads-api-tracker.ts` 提供追踪函数
3. ✅ API端点：`/api/dashboard/api-quota` 查询配额统计
4. ✅ 可视化组件：`ApiQuotaChart` 圆环图显示配额使用情况
5. ✅ Dashboard集成：已添加到仪表盘

## 如何追踪API调用

在每个Google Ads API调用的关键位置添加追踪代码：

### 示例 1: 追踪Search操作

```typescript
import { trackApiUsage, ApiOperationType } from '@/lib/google-ads-api-tracker'

export async function searchCampaigns(userId: number, customerId: string, refreshToken: string) {
  const startTime = Date.now()
  let success = false
  let errorMessage: string | undefined

  try {
    const customer = await getCustomer(customerId, refreshToken)

    // 执行实际的API调用
    const campaigns = await customer.query(`
      SELECT campaign.id, campaign.name
      FROM campaign
      WHERE campaign.status = 'ENABLED'
    `)

    success = true
    return campaigns
  } catch (error: any) {
    success = false
    errorMessage = error.message
    throw error
  } finally {
    // 记录API使用
    trackApiUsage({
      userId,
      operationType: ApiOperationType.SEARCH,
      endpoint: 'searchCampaigns',
      customerId,
      requestCount: 1, // Search操作计为1次
      responseTimeMs: Date.now() - startTime,
      isSuccess: success,
      errorMessage
    })
  }
}
```

### 示例 2: 追踪Mutate操作（多个操作）

```typescript
import { trackApiUsage, ApiOperationType } from '@/lib/google-ads-api-tracker'

export async function createCampaign(userId: number, customerId: string, refreshToken: string, campaignData: any) {
  const startTime = Date.now()
  let success = false
  let errorMessage: string | undefined

  try {
    const customer = await getCustomer(customerId, refreshToken)

    // 批量创建操作
    const operations = [
      { /* campaign operation */ },
      { /* ad group operation */ },
      { /* ad operation */ }
    ]

    const result = await customer.mutateResources(operations)

    success = true
    return result
  } catch (error: any) {
    success = false
    errorMessage = error.message
    throw error
  } finally {
    // 记录API使用
    trackApiUsage({
      userId,
      operationType: ApiOperationType.MUTATE_BATCH,
      endpoint: 'createCampaign',
      customerId,
      requestCount: 3, // 3个操作，计为3次
      responseTimeMs: Date.now() - startTime,
      isSuccess: success,
      errorMessage
    })
  }
}
```

### 示例 3: 追踪Keyword Planner操作

```typescript
import { trackApiUsage, ApiOperationType } from '@/lib/google-ads-api-tracker'

export async function generateKeywordIdeas(userId: number, customerId: string, refreshToken: string, keywords: string[]) {
  const startTime = Date.now()
  let success = false
  let errorMessage: string | undefined

  try {
    const customer = await getCustomer(customerId, refreshToken)

    // 调用Keyword Planner API
    const ideas = await customer.keywordPlanIdeas.generateKeywordIdeas({
      /* ... */
    })

    success = true
    return ideas
  } catch (error: any) {
    success = false
    errorMessage = error.message
    throw error
  } finally {
    trackApiUsage({
      userId,
      operationType: ApiOperationType.GET_KEYWORD_IDEAS,
      endpoint: 'generateKeywordIdeas',
      customerId,
      requestCount: 1,
      responseTimeMs: Date.now() - startTime,
      isSuccess: success,
      errorMessage
    })
  }
}
```

## 需要添加追踪的关键文件

按优先级排序：

### P0 - 核心API调用（必须追踪）

1. ✅ `src/lib/google-ads-api.ts` - 基础API客户端
2. ✅ `src/lib/google-ads-keyword-planner.ts` - 关键词规划
3. ✅ `src/app/api/campaigns/publish/route.ts` - 广告发布
4. ✅ `src/app/api/google-ads/credentials/accounts/route.ts` - 账号查询

### P1 - 高频操作（建议追踪）

5. `src/lib/google-ads-strength-api.ts` - Ad Strength评估
6. `src/app/api/ad-groups/[id]/generate-keywords/route.ts` - 关键词生成

## 配额管理最佳实践

根据Google Ads API配额文档（https://developers.google.com/google-ads/api/docs/best-practices/quotas）：

### 每日配额：15,000次操作

- **Search操作**：1次
- **Mutate操作**：按操作数量计算（3个操作 = 3次）
- **Report操作**：1次

### 建议追踪策略

1. **所有Mutate操作必须追踪**
   - 创建广告系列（Campaign）
   - 创建广告组（Ad Group）
   - 创建广告创意（Ad）
   - 批量操作（Batch Mutate）

2. **高频Search操作必须追踪**
   - 查询广告系列列表
   - 查询广告效果数据
   - 查询关键词数据

3. **Keyword Planner必须追踪**
   - 关键词建议请求
   - 搜索量查询

## Dashboard展示

已在Dashboard添加API配额圆环图，显示：

- 今日API调用次数
- 配额使用百分比
- 剩余配额
- 操作成功率
- 操作类型分布
- 最近7天趋势
- 配额警告和建议

## 配额警告阈值

- **正常**：< 80%（绿色）
- **接近限制**：80-100%（橙色）
- **已超限**：≥ 100%（红色）

## 测试验证

1. 访问 `/dashboard` 查看API配额卡片
2. 执行任何Google Ads API操作（创建广告、查询关键词等）
3. 刷新Dashboard，查看配额数字是否增加
4. 检查数据库：
   ```sql
   SELECT * FROM google_ads_api_usage ORDER BY created_at DESC LIMIT 10;
   ```

## 下一步优化

1. **自动追踪所有API调用**：创建统一的API调用包装函数
2. **配额预警通知**：接近限制时发送通知
3. **智能限流**：配额不足时自动延迟非关键操作
4. **历史分析**：生成配额使用报告和趋势分析
