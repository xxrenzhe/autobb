# Google Ads API配额统计系统 - 实现总结

**实现日期**: 2025-11-22
**需求**: 在Dashboard新增每天Google Ads API访问次数统计，使用圆环图可视化，每天上限15,000次
**参考文档**: https://developers.google.com/google-ads/api/docs/best-practices/quotas

---

## ✅ 已完成功能

### 1. 数据库设计

**文件**: `scripts/migrations/019_create_google_ads_api_usage.sql`

创建表：
- `google_ads_api_usage`: 存储每次API调用记录
- 视图 `daily_api_usage_summary`: 每日汇总统计

**字段**:
- user_id: 用户ID
- operation_type: 操作类型（search, mutate, report等）
- endpoint: API端点
- customer_id: Google Ads客户ID
- request_count: 请求计数（某些操作计为多次）
- response_time_ms: 响应时间
- is_success: 是否成功
- error_message: 错误信息
- date: 日期字符串（YYYY-MM-DD）

**索引**:
- 日期 + 用户ID索引（快速查询当天统计）
- 创建时间索引

---

### 2. API追踪工具

**文件**: `src/lib/google-ads-api-tracker.ts`

**核心函数**:

```typescript
// 记录API调用
trackApiUsage(record: ApiUsageRecord): void

// 获取今天的API使用统计
getDailyUsageStats(userId: number, date?: string): DailyUsageStats

// 获取最近N天的使用趋势
getUsageTrend(userId: number, days: number): UsageTrend[]

// 检查是否接近配额限制
checkQuotaLimit(userId: number, warningThreshold: number): QuotaCheck
```

**操作类型枚举**:
- SEARCH / SEARCH_STREAM: 查询操作（权重1）
- MUTATE / MUTATE_BATCH: 变更操作（权重=操作数量）
- REPORT: 报告操作（权重1）
- GET_KEYWORD_IDEAS / GET_AD_STRENGTH: 专用API操作
- OAUTH / LIST_ACCOUNTS: 不计入配额

---

### 3. API端点

**文件**: `src/app/api/dashboard/api-quota/route.ts`

**端点**: `GET /api/dashboard/api-quota?days=7`

**返回数据**:
```json
{
  "success": true,
  "data": {
    "today": {
      "totalRequests": 125,
      "quotaLimit": 15000,
      "quotaRemaining": 14875,
      "quotaUsagePercent": 0.83,
      "successfulOperations": 120,
      "failedOperations": 5,
      "operationBreakdown": {
        "get_keyword_ideas": 50,
        "search": 35,
        "mutate": 40
      }
    },
    "quotaCheck": {
      "isNearLimit": false,
      "isOverLimit": false,
      "currentUsage": 125,
      "percentUsed": 0.83
    },
    "recommendations": [
      "✅ API使用正常，配额充足"
    ],
    "trend": [
      { "date": "2025-11-22", "totalRequests": 125, "successRate": 96 },
      { "date": "2025-11-21", "totalRequests": 98, "successRate": 98 }
    ]
  }
}
```

---

### 4. 圆环图组件

**文件**: `src/components/dashboard/ApiQuotaChart.tsx`

**功能**:
- SVG圆环图显示配额使用百分比
- 颜色根据使用率变化：
  - 正常（<80%）: 绿色
  - 接近限制（80-100%）: 橙色
  - 已超限（≥100%）: 红色
- 显示剩余配额和成功率
- 显示操作类型分布（前3种）
- 显示最近趋势（前3天）
- 显示智能建议

**UI截图**:
```
┌─────────────────────────────┐
│ 🔵 API配额使用     [优秀]   │
│ 今日Google Ads API调用次数   │
├─────────────────────────────┤
│        ⬤ 125 / 15,000      │
│         0.8%                │
│                             │
│   剩余配额      成功率       │
│   14,875        96%         │
│                             │
│ ✅ API使用正常，配额充足     │
│                             │
│ 操作类型分布：              │
│  Keyword Ideas      50      │
│  Search             35      │
│  Mutate             40      │
└─────────────────────────────┘
```

---

### 5. Dashboard集成

**文件**: `src/app/(app)/dashboard/page.tsx`

**修改**:
- 导入 `ApiQuotaChart` 组件
- 在Dashboard底部添加3列网格布局：
  - API配额卡片
  - Insights卡片
  - AB测试进度卡片

**位置**: Dashboard页面底部

---

### 6. 示例追踪实现

**文件**: `src/lib/google-ads-keyword-planner.ts`

已在以下函数中添加API追踪：
- `getKeywordIdeas()`: 关键词建议
- `getKeywordMetrics()`: 关键词历史指标

**追踪模式**:
```typescript
const startTime = Date.now()
let success = false
let errorMessage: string | undefined

try {
  // API调用
  success = true
  return result
} catch (error) {
  success = false
  errorMessage = error.message
  throw error
} finally {
  if (params.userId) {
    trackApiUsage({
      userId: params.userId,
      operationType: ApiOperationType.GET_KEYWORD_IDEAS,
      endpoint: 'getKeywordIdeas',
      customerId: params.customerId,
      requestCount: 1,
      responseTimeMs: Date.now() - startTime,
      isSuccess: success,
      errorMessage
    })
  }
}
```

---

## 📊 配额管理策略

根据Google Ads API官方文档：

### 每日配额：15,000次操作

**操作权重**:
- Search / Report: 1次
- Mutate: 按操作数量计算（3个操作 = 3次）
- Keyword Planner: 1次

### 警告阈值

- **正常**: 0-80% (绿色)
- **接近限制**: 80-100% (橙色)
- **已超限**: ≥100% (红色)

### 智能建议

系统自动生成建议：
- 配额超限：提示明天再试或联系支持
- 接近限制：提醒谨慎使用
- 失败率高：建议检查参数和权限
- 响应慢：建议使用批量操作

---

## 🎯 使用指南

### 1. 查看API配额

访问 `/dashboard` 即可看到API配额卡片，实时显示：
- 今日已用次数
- 剩余配额
- 使用百分比
- 成功率

### 2. 添加API追踪到新功能

在任何调用Google Ads API的地方添加：

```typescript
import { trackApiUsage, ApiOperationType } from '@/lib/google-ads-api-tracker'

// 在API调用前后添加追踪
const startTime = Date.now()
let success = false

try {
  // 你的API调用
  success = true
} catch (error) {
  success = false
  throw error
} finally {
  if (userId) {
    trackApiUsage({
      userId,
      operationType: ApiOperationType.SEARCH, // 选择合适的类型
      endpoint: 'functionName',
      customerId,
      requestCount: 1, // mutate操作可能>1
      responseTimeMs: Date.now() - startTime,
      isSuccess: success,
      errorMessage: error?.message
    })
  }
}
```

### 3. 查询历史数据

```typescript
import { getDailyUsageStats, getUsageTrend } from '@/lib/google-ads-api-tracker'

// 获取今天的统计
const todayStats = getDailyUsageStats(userId)

// 获取最近7天趋势
const trend = getUsageTrend(userId, 7)

// 检查配额限制
const quotaCheck = checkQuotaLimit(userId, 0.8)
if (quotaCheck.isNearLimit) {
  console.warn('接近配额限制！')
}
```

---

## 📁 文件清单

### 新增文件

1. `scripts/migrations/019_create_google_ads_api_usage.sql` - 数据库表
2. `src/lib/google-ads-api-tracker.ts` - 追踪工具
3. `src/app/api/dashboard/api-quota/route.ts` - API端点
4. `src/components/dashboard/ApiQuotaChart.tsx` - 圆环图组件
5. `claudedocs/API_QUOTA_TRACKING_GUIDE.md` - 使用指南
6. `claudedocs/API_QUOTA_IMPLEMENTATION_SUMMARY.md` - 本文档

### 修改文件

1. `src/app/(app)/dashboard/page.tsx` - 集成API配额卡片
2. `src/lib/google-ads-keyword-planner.ts` - 添加API追踪示例

---

## 🧪 测试验证

### 1. 数据库验证

```sql
-- 查看API调用记录
SELECT * FROM google_ads_api_usage ORDER BY created_at DESC LIMIT 10;

-- 查看每日汇总
SELECT * FROM daily_api_usage_summary WHERE user_id = 1 ORDER BY date DESC;
```

### 2. 功能测试

1. 访问 `http://localhost:3000/dashboard`
2. 查看API配额卡片是否正确显示
3. 执行任何Google Ads API操作（如生成关键词）
4. 刷新Dashboard，验证配额数字是否增加

### 3. 配额警告测试

模拟高使用率：
```sql
-- 插入测试数据（接近配额限制）
INSERT INTO google_ads_api_usage (user_id, operation_type, endpoint, request_count, is_success, date)
VALUES (1, 'search', 'test', 12000, 1, date('now'));
```

刷新Dashboard，应该看到橙色警告。

---

## 🚀 下一步优化建议

### P0 - 核心功能（建议优先）

1. **自动追踪所有API调用**
   - 创建统一的API调用包装函数
   - 在所有Google Ads API调用处添加追踪

2. **配额预警通知**
   - 80%时发送邮件/站内通知
   - 95%时限制非关键操作

### P1 - 增强功能

3. **智能限流**
   - 配额不足时自动延迟非关键操作
   - 优先保证关键业务流程

4. **历史分析**
   - 生成月度/周度配额使用报告
   - 识别API使用模式和优化机会

5. **多用户管理**
   - 管理员可查看所有用户配额使用
   - 设置用户级配额限制

### P2 - 高级功能

6. **成本分析**
   - 关联API调用与业务成本
   - ROI分析和优化建议

7. **预测性分析**
   - 基于历史数据预测配额使用
   - 提前预警可能的配额不足

---

## 📝 技术要点

1. **不阻塞主流程**: trackApiUsage()使用try-catch，失败不影响业务
2. **可选追踪**: 只在有userId时才追踪，避免未授权场景报错
3. **灵活计数**: requestCount支持批量操作计数
4. **性能优化**: 使用索引和视图加速查询
5. **向后兼容**: 旧代码无需修改，新功能逐步添加追踪

---

## 🎉 总结

已成功实现完整的Google Ads API配额追踪系统：

✅ 数据库表和索引
✅ API追踪工具函数
✅ Dashboard API端点
✅ 圆环图可视化组件
✅ Dashboard集成
✅ 示例追踪实现
✅ 使用文档

系统现在可以实时监控API使用情况，帮助用户合理管理每天15,000次的配额限制，避免超限影响业务！

---

**维护联系**: Claude Code
**最后更新**: 2025-11-22
