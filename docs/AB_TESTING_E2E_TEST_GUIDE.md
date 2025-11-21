# A/B测试端到端测试指南

## 文档概述

本文档提供完整的Phase 1（创意测试）→ Phase 2（策略测试）端到端测试流程，用于验证AutoAds A/B测试系统的完整功能。

**测试目标**：
- ✅ 验证Phase 1创意测试完整流程
- ✅ 验证Phase 2策略测试完整流程
- ✅ 验证自动监控和数据同步
- ✅ 验证前端Dashboard实时展示
- ✅ 验证统计分析和winner判定

**预计测试时长**：2-3小时（包含数据积累时间）

---

## 一、测试环境准备

### 1.1 数据库状态检查

```bash
# 检查数据库表结构
sqlite3 data/autoads.db ".schema ab_tests"
sqlite3 data/autoads.db ".schema ab_test_variants"
sqlite3 data/autoads.db ".schema campaign_performance"
sqlite3 data/autoads.db ".schema campaigns"
```

**预期输出**：所有表都存在且结构正确

### 1.2 清理测试数据（可选）

```sql
-- 清理之前的测试数据
DELETE FROM ab_tests WHERE test_name LIKE '%测试%';
DELETE FROM ab_test_variants WHERE test_id NOT IN (SELECT id FROM ab_tests);
DELETE FROM campaign_performance WHERE date > date('now', '-1 day');
```

### 1.3 准备测试Offer

```bash
# 检查是否有可用的Offer
sqlite3 data/autoads.db "SELECT id, name, status FROM offers LIMIT 5;"
```

**要求**：至少有1个状态为'active'的Offer

### 1.4 启动应用和调度器

```bash
# Terminal 1: 启动Next.js开发服务器
npm run dev

# Terminal 2: 启动调度器（用于A/B测试监控）
npm run scheduler
```

**验证点**：
- ✅ Next.js运行在 http://localhost:3000
- ✅ 调度器显示: "⏰ 调度器已启动..."
- ✅ 调度器显示: "A/B测试监控 (每小时)"

---

## 二、Phase 1 测试流程：创意测试

### 2.1 创建Phase 1测试

**目标**：测试不同广告创意对CTR（点击率）的影响

#### 步骤1：通过API创建测试

```bash
# 创建Phase 1创意测试
curl -X POST http://localhost:3000/api/ab-tests \
  -H "Content-Type: application/json" \
  -d '{
    "offer_id": 1,
    "test_name": "测试-创意优化-20250121",
    "test_mode": "standard",
    "test_dimension": "creative",
    "variants": [
      {
        "variant_name": "control",
        "variant_label": "原始创意",
        "headline": "专业CRM系统 - 提升销售效率",
        "description": "全功能CRM解决方案，助力企业数字化转型",
        "budget_allocation": 0.34
      },
      {
        "variant_name": "variant_a",
        "variant_label": "强调ROI",
        "headline": "CRM系统 - 3个月内ROI提升50%",
        "description": "已帮助1000+企业实现销售增长，立即免费试用",
        "budget_allocation": 0.33
      },
      {
        "variant_name": "variant_b",
        "variant_label": "强调简单易用",
        "headline": "5分钟上手的CRM - 无需培训",
        "description": "直观界面，拖拽操作，让销售团队立即投入使用",
        "budget_allocation": 0.33
      }
    ],
    "min_sample_size": 100,
    "confidence_level": 0.95
  }'
```

**预期响应**：
```json
{
  "success": true,
  "test_id": 1,
  "message": "A/B测试创建成功",
  "variants": [
    {
      "variant_name": "control",
      "campaign_id": 101,
      "budget_allocation": 0.34
    },
    {
      "variant_name": "variant_a",
      "campaign_id": 102,
      "budget_allocation": 0.33
    },
    {
      "variant_name": "variant_b",
      "campaign_id": 103,
      "budget_allocation": 0.33
    }
  ]
}
```

**验证点**：
- ✅ `test_id` 返回有效数值
- ✅ 3个variants都创建成功
- ✅ 每个variant都有对应的`campaign_id`

#### 步骤2：验证数据库状态

```sql
-- 检查测试记录
SELECT id, test_name, test_dimension, status, start_date
FROM ab_tests
WHERE test_name = '测试-创意优化-20250121';

-- 检查variants记录
SELECT
  v.test_id,
  v.variant_name,
  v.variant_label,
  v.campaign_id,
  c.name AS campaign_name,
  c.status AS campaign_status
FROM ab_test_variants v
JOIN campaigns c ON v.campaign_id = c.id
WHERE v.test_id = 1;
```

**预期结果**：
- ✅ ab_tests表有1条记录，status='running', start_date已设置
- ✅ ab_test_variants表有3条记录
- ✅ 所有campaign_id都对应有效的campaigns记录
- ✅ campaigns的status都是'active'或'running'

#### 步骤3：检查Dashboard显示

访问: http://localhost:3000/dashboard

**验证点**：
- ✅ "A/B测试进度"卡片显示测试数量为1
- ✅ 显示测试名称"测试-创意优化-20250121"
- ✅ 显示"创意测试"badge
- ✅ 进度条显示0%（因为还没有数据）
- ✅ 显示"0 / 100 点击"

### 2.2 模拟Campaign性能数据

由于Google Ads API需要真实广告投放，我们通过直接插入数据来模拟：

```sql
-- 获取campaign IDs
SELECT id, name FROM campaigns WHERE id IN (101, 102, 103);

-- 插入模拟性能数据（Day 1）
-- Control组：CTR = 2.0%
INSERT INTO campaign_performance (
  user_id, campaign_id, date,
  impressions, clicks, conversions, cost,
  ctr, cpc, cpa, conversion_rate
) VALUES
(1, 101, date('now'), 5000, 100, 5, 500.0, 2.0, 5.0, 100.0, 5.0);

-- Variant A（强调ROI）：CTR = 2.8% (更好)
INSERT INTO campaign_performance (
  user_id, campaign_id, date,
  impressions, clicks, conversions, cost,
  ctr, cpc, cpa, conversion_rate
) VALUES
(1, 102, date('now'), 5000, 140, 7, 490.0, 2.8, 3.5, 70.0, 5.0);

-- Variant B（强调简单易用）：CTR = 1.8% (较差)
INSERT INTO campaign_performance (
  user_id, campaign_id, date,
  impressions, clicks, conversions, cost,
  ctr, cpc, cpa, conversion_rate
) VALUES
(1, 103, date('now'), 5000, 90, 4, 450.0, 1.8, 5.0, 112.5, 4.4);
```

**数据说明**：
- Control: 5000展示 → 100点击 → CTR 2.0%
- Variant A: 5000展示 → 140点击 → CTR 2.8% **(领先40%)**
- Variant B: 5000展示 → 90点击 → CTR 1.8% (落后10%)

### 2.3 触发监控任务

```bash
# 方式1：等待1小时让cron自动触发
# 方式2：手动触发监控任务
node -e "require('./src/scheduler/ab-test-monitor').monitorABTests()"
```

**预期输出**：
```
📊 A/B测试监控任务启动...
📊 找到 1 个运行中的A/B测试 (创意+策略)

🧪 [创意测试] 测试-创意优化-20250121 (ID: 1)
  Control: 5000 imp, 100 clicks, CTR 2.00%
  Variant A: 5000 imp, 140 clicks, CTR 2.80%
  Variant B: 5000 imp, 90 clicks, CTR 1.80%

🏆 当前领先: Variant A (强调ROI)
  - CTR提升: +40.00% vs Control
  - P-value: 0.0023
  - 统计显著性: ✅ 显著 (p < 0.05)
  - 进度: 330 / 100 样本 (330%)
  - 结论: 已达到最小样本量，可以结束测试

✅ 测试已完成! Winner: Variant A
   - Campaign ID: 102
   - 优化提升: +40.00%
```

#### 验证数据库更新

```sql
-- 检查ab_test_variants数据更新
SELECT
  variant_name,
  impressions,
  clicks,
  ctr,
  is_winner
FROM ab_test_variants
WHERE test_id = 1;

-- 检查测试状态
SELECT
  id,
  test_name,
  status,
  winner_variant_id,
  improvement_percentage,
  end_date
FROM ab_tests
WHERE id = 1;
```

**预期结果**：
- ✅ variant_a的is_winner=1
- ✅ 测试status='completed'
- ✅ winner_variant_id指向variant_a的ID
- ✅ improvement_percentage≈40
- ✅ end_date已设置

### 2.4 检查Dashboard更新

刷新Dashboard页面（或等待30秒自动刷新）

**验证点**：
- ✅ 进度条显示100%（已完成）
- ✅ 显示"330 / 100 点击"
- ✅ 当前领先显示"强调ROI"
- ✅ CTR显示2.80%
- ✅ 显示绿色上升箭头和"+40.0%"
- ✅ 显示"统计显著"badge

### 2.5 查看详细结果页面

访问: http://localhost:3000/ab-tests/1

**验证点**：
- ✅ 测试状态显示为"已完成"（绿色）
- ✅ Winner banner显示"Variant A: 强调ROI"
- ✅ 优化指标显示"CTR（点击率）"
- ✅ 性能提升显示"+40.0%"
- ✅ 置信度显示"95%"
- ✅ 统计显著性显示"p < 0.05"
- ✅ Variants表格中Variant A有"Winner"徽章
- ✅ 进度图表显示100%完成

---

## 三、Phase 2 测试流程：策略测试

### 3.1 创建Phase 2测试

**目标**：基于Phase 1的winner（Variant A创意），测试不同优化策略对CPC（点击成本）的影响

#### 步骤1：通过API创建策略测试

```bash
# 创建Phase 2策略测试
curl -X POST http://localhost:3000/api/ab-tests \
  -H "Content-Type: application/json" \
  -d '{
    "offer_id": 1,
    "test_name": "测试-策略优化-20250121",
    "test_mode": "standard",
    "test_dimension": "strategy",
    "parent_test_id": 1,
    "base_campaign_id": 102,
    "variants": [
      {
        "variant_name": "control",
        "variant_label": "基础策略",
        "strategy_type": "basic",
        "budget_allocation": 0.34
      },
      {
        "variant_name": "variant_a",
        "variant_label": "激进负关键词",
        "strategy_type": "aggressive_negative",
        "negative_keywords": [
          "免费", "破解", "盗版", "下载",
          "试用", "演示", "demo"
        ],
        "budget_allocation": 0.33
      },
      {
        "variant_name": "variant_b",
        "variant_label": "CPC优化",
        "strategy_type": "cpc_optimization",
        "target_cpa": 80.0,
        "cpc_bid_adjustment": 0.85,
        "budget_allocation": 0.33
      }
    ],
    "min_sample_size": 50,
    "confidence_level": 0.95
  }'
```

**预期响应**：
```json
{
  "success": true,
  "test_id": 2,
  "message": "A/B测试创建成功",
  "variants": [
    {
      "variant_name": "control",
      "campaign_id": 201,
      "strategy_applied": "基础策略",
      "budget_allocation": 0.34
    },
    {
      "variant_name": "variant_a",
      "campaign_id": 202,
      "strategy_applied": "7个负关键词已应用",
      "budget_allocation": 0.33
    },
    {
      "variant_name": "variant_b",
      "campaign_id": 203,
      "strategy_applied": "CPC调整至15% (目标CPA: ¥80.00)",
      "budget_allocation": 0.33
    }
  ]
}
```

**验证点**：
- ✅ `test_id` = 2
- ✅ 3个variants创建成功
- ✅ 每个variant都应用了对应策略

#### 步骤2：验证数据库状态

```sql
-- 检查Phase 2测试记录
SELECT
  id,
  test_name,
  test_dimension,
  parent_test_id,
  base_campaign_id,
  status,
  start_date
FROM ab_tests
WHERE id = 2;

-- 检查策略variants
SELECT
  v.test_id,
  v.variant_name,
  v.variant_label,
  v.campaign_id,
  v.strategy_config,
  c.name AS campaign_name
FROM ab_test_variants v
JOIN campaigns c ON v.campaign_id = c.id
WHERE v.test_id = 2;
```

**预期结果**：
- ✅ test_dimension='strategy'
- ✅ parent_test_id=1
- ✅ base_campaign_id=102（Phase 1的winner campaign）
- ✅ strategy_config包含JSON配置

### 3.2 检查Dashboard显示（同时显示两个测试）

访问: http://localhost:3000/dashboard

**验证点**：
- ✅ "A/B测试进度"显示"(2)"
- ✅ 第一个卡片：Phase 1测试（已完成）
- ✅ 第二个卡片：Phase 2测试（进行中）
- ✅ Phase 2显示"策略测试"badge
- ✅ Phase 2显示"0 / 50 转化"

### 3.3 模拟策略测试性能数据

```sql
-- 插入Phase 2性能数据（Day 1-2累计）
-- Control（基础策略）：CPC = ¥10.00
INSERT INTO campaign_performance (
  user_id, campaign_id, date,
  impressions, clicks, conversions, cost,
  ctr, cpc, cpa, conversion_rate
) VALUES
(1, 201, date('now'), 10000, 200, 20, 2000.0, 2.0, 10.0, 100.0, 10.0);

-- Variant A（激进负关键词）：CPC = ¥7.50 (更好，降低25%)
INSERT INTO campaign_performance (
  user_id, campaign_id, date,
  impressions, clicks, conversions, cost,
  ctr, cpc, cpa, conversion_rate
) VALUES
(1, 202, date('now'), 10000, 200, 24, 1500.0, 2.0, 7.5, 62.5, 12.0);

-- Variant B（CPC优化）：CPC = ¥8.50 (较好，降低15%)
INSERT INTO campaign_performance (
  user_id, campaign_id, date,
  impressions, clicks, conversions, cost,
  ctr, cpc, cpa, conversion_rate
) VALUES
(1, 203, date('now'), 10000, 200, 20, 1700.0, 2.0, 8.5, 85.0, 10.0);
```

**数据说明**（策略维度）：
- Control: 200点击 → 成本¥2000 → CPC ¥10.00
- Variant A: 200点击 → 成本¥1500 → CPC ¥7.50 **(降低25%，成本更低)**
- Variant B: 200点击 → 成本¥1700 → CPC ¥8.50 (降低15%)

### 3.4 触发监控任务（策略分析）

```bash
# 手动触发监控
node -e "require('./src/scheduler/ab-test-monitor').monitorABTests()"
```

**预期输出**：
```
📊 A/B测试监控任务启动...
📊 找到 1 个运行中的A/B测试 (创意+策略)

🎯 [策略测试] 测试-策略优化-20250121 (ID: 2)
  Control: 200 clicks, Cost $2000.00, CPC $10.00
  Variant A: 200 clicks, Cost $1500.00, CPC $7.50
  Variant B: 200 clicks, Cost $1700.00, CPC $8.50

🏆 当前领先: Variant A (激进负关键词)
  - CPC降低: -25.00% vs Control
  - P-value: 0.0412
  - 统计显著性: ✅ 显著 (p < 0.05)
  - 进度: 600 / 50 样本 (1200%)
  - 结论: 已达到最小样本量，可以结束测试

✅ 测试已完成! Winner: Variant A
   - Campaign ID: 202
   - 成本优化: -25.00%
```

#### 验证数据库更新

```sql
-- 检查Phase 2结果
SELECT
  variant_name,
  variant_label,
  clicks,
  cost,
  (cost / clicks) as cpc,
  is_winner
FROM ab_test_variants
WHERE test_id = 2;

-- 检查测试完成状态
SELECT
  id,
  test_name,
  test_dimension,
  status,
  winner_variant_id,
  improvement_percentage,
  end_date
FROM ab_tests
WHERE id = 2;
```

**预期结果**：
- ✅ Variant A的is_winner=1
- ✅ status='completed'
- ✅ improvement_percentage≈-25（负数表示成本降低）
- ✅ end_date已设置

### 3.5 检查Dashboard最终状态

刷新Dashboard页面

**验证点**：
- ✅ Phase 1测试显示为完成状态
- ✅ Phase 2测试显示为完成状态
- ✅ Phase 2进度条100%
- ✅ Phase 2显示"600 / 50 点击"
- ✅ 当前领先显示"激进负关键词"
- ✅ CPC显示¥7.50
- ✅ 显示绿色下降箭头和"-25.0%"（注意：CPC降低是好的）
- ✅ 显示"统计显著"badge

### 3.6 查看Phase 2详细结果

访问: http://localhost:3000/ab-tests/2

**验证点**：
- ✅ 测试状态显示"已完成"
- ✅ Winner banner显示"Variant A: 激进负关键词"
- ✅ 优化指标显示"CPC（点击成本）"
- ✅ 性能提升显示"-25.0%"（绿色，表示成本降低）
- ✅ Variants表格显示：
  - Control: CPC ¥10.00, 200点击
  - Variant A: CPC ¥7.50, 200点击, Winner徽章
  - Variant B: CPC ¥8.50, 200点击
- ✅ 策略配置卡片显示负关键词列表

---

## 四、完整流程验证清单

### 4.1 Phase 1验证（创意测试）

- [ ] ✅ 测试创建成功，返回test_id
- [ ] ✅ 3个campaign创建成功
- [ ] ✅ Dashboard显示测试进度卡片
- [ ] ✅ 性能数据正确聚合到ab_test_variants
- [ ] ✅ 监控任务识别创意测试（CTR分析）
- [ ] ✅ 统计分析正确（Z-test, P-value）
- [ ] ✅ Winner正确判定（CTR最高且显著）
- [ ] ✅ 测试自动标记为completed
- [ ] ✅ Dashboard实时更新（30秒内）
- [ ] ✅ 详情页展示完整结果

### 4.2 Phase 2验证（策略测试）

- [ ] ✅ 基于Phase 1 winner创建成功
- [ ] ✅ parent_test_id和base_campaign_id正确关联
- [ ] ✅ 策略配置正确存储（JSON格式）
- [ ] ✅ 负关键词策略应用成功
- [ ] ✅ CPC优化策略应用成功
- [ ] ✅ Dashboard同时显示两个测试
- [ ] ✅ 监控任务识别策略测试（CPC分析）
- [ ] ✅ CPC计算正确（cost / clicks）
- [ ] ✅ Winner判定逻辑正确（CPC最低且显著）
- [ ] ✅ improvement_percentage正确（负数=成本降低）
- [ ] ✅ 前端正确显示CPC指标和降低百分比
- [ ] ✅ 详情页显示策略配置信息

### 4.3 数据同步验证

- [ ] ✅ campaign_performance表数据完整
- [ ] ✅ 数据聚合到ab_test_variants正确
- [ ] ✅ UPSERT逻辑避免重复数据
- [ ] ✅ 索引优化查询性能
- [ ] ✅ 30秒内前端可见更新

### 4.4 前端集成验证

- [ ] ✅ Dashboard卡片显示所有运行中测试
- [ ] ✅ 30秒自动刷新正常工作
- [ ] ✅ 创意测试显示CTR指标
- [ ] ✅ 策略测试显示CPC指标
- [ ] ✅ 进度条和百分比计算正确
- [ ] ✅ 样本量显示正确单位（点击）
- [ ] ✅ Winner展示逻辑正确
- [ ] ✅ 改进方向正确（CTR↑绿色，CPC↓绿色）
- [ ] ✅ 统计显著性badge正确
- [ ] ✅ 点击跳转到详情页正常

### 4.5 边界情况验证

- [ ] ⚠️ 样本量不足时不判定winner
- [ ] ⚠️ P-value > 0.05时标记为"继续观察"
- [ ] ⚠️ 所有variants性能接近时的处理
- [ ] ⚠️ 并发测试互不干扰
- [ ] ⚠️ 异常数据处理（0点击、0转化）

---

## 五、问题排查指南

### 5.1 监控任务未执行

**症状**：手动插入数据后，ab_test_variants没有更新

**排查步骤**：
```bash
# 1. 检查调度器是否运行
ps aux | grep scheduler

# 2. 查看调度器日志
# 应该看到"A/B测试监控 (每小时)"

# 3. 手动执行监控任务
node -e "require('./src/scheduler/ab-test-monitor').monitorABTests()"

# 4. 检查是否有错误输出
```

**常见原因**：
- 调度器未启动
- 测试status不是'running'
- campaign_performance数据缺失

### 5.2 Dashboard不显示测试

**症状**：创建测试后Dashboard为空

**排查步骤**：
```sql
-- 1. 检查测试状态
SELECT id, test_name, status, start_date FROM ab_tests;

-- 2. 检查API响应
-- 浏览器DevTools → Network → 查看 /api/ab-tests?status=running

-- 3. 检查浏览器Console是否有错误
```

**常见原因**：
- 测试status不是'running'
- start_date为NULL
- API权限问题

### 5.3 Winner判定不正确

**症状**：监控任务执行后winner判定异常

**排查步骤**：
```sql
-- 1. 检查variant数据
SELECT
  variant_name,
  impressions,
  clicks,
  conversions,
  ctr,
  cpa
FROM ab_test_variants
WHERE test_id = ?;

-- 2. 验证样本量
SELECT
  test_dimension,
  min_sample_size,
  (SELECT SUM(clicks) FROM ab_test_variants WHERE test_id = ?) AS total_clicks,
  (SELECT SUM(conversions) FROM ab_test_variants WHERE test_id = ?) AS total_conversions
FROM ab_tests
WHERE id = ?;
```

**常见原因**：
- 样本量不足（< min_sample_size）
- P-value > 0.05（不显著）
- 数据异常（0点击、0转化）

### 5.4 前端不刷新

**症状**：手动刷新能看到更新，但30秒不自动刷新

**排查步骤**：
```javascript
// 检查浏览器Console
// 应该看到每30秒的API请求

// 检查组件代码
useEffect(() => {
  fetchActiveTests()
  const interval = setInterval(fetchActiveTests, 30000)
  return () => clearInterval(interval)  // 清理函数
}, [])
```

**常见原因**：
- 组件卸载导致interval清理
- 浏览器标签页后台休眠
- 网络请求失败

---

## 六、成功标准

### 6.1 功能完整性

- ✅ Phase 1创意测试完整流程可执行
- ✅ Phase 2策略测试完整流程可执行
- ✅ 自动监控任务正常运行
- ✅ 统计分析结果准确
- ✅ Winner判定逻辑正确

### 6.2 数据准确性

- ✅ campaign_performance → ab_test_variants数据流转正确
- ✅ CTR/CPA计算准确
- ✅ Z-test和P-value计算正确
- ✅ improvement_percentage计算正确
- ✅ 时间戳和日期处理正确

### 6.3 用户体验

- ✅ Dashboard实时更新（<30秒延迟）
- ✅ 多维度测试可视化区分明确
- ✅ 进度和状态展示直观
- ✅ Winner结果易于理解
- ✅ 详情页信息完整

### 6.4 系统稳定性

- ✅ 并发测试互不干扰
- ✅ 异常数据处理健壮
- ✅ 数据库查询性能良好
- ✅ 前端无内存泄漏
- ✅ 调度器长时间运行稳定

---

## 七、下一步优化建议

基于测试结果，以下是建议的优化方向：

### 7.1 短期优化（P1）

1. **增强监控告警**：
   - 样本收集速度过慢时发送提醒
   - 异常数据模式检测（如突然的CPA飙升）
   - Winner判定后的邮件/Webhook通知

2. **优化数据模拟**：
   - 创建专用的测试数据生成脚本
   - 支持渐进式数据积累（模拟真实场景）
   - 添加数据验证和一致性检查

3. **完善错误处理**：
   - API更详细的错误信息
   - 前端错误边界和降级展示
   - 监控任务失败重试机制

### 7.2 中期优化（P2）

1. **自动化测试套件**：
   - E2E测试覆盖完整流程
   - 单元测试覆盖统计计算
   - 集成测试覆盖API端点

2. **性能优化**：
   - 数据库查询优化（如索引优化）
   - 前端渲染优化（虚拟滚动、懒加载）
   - API响应缓存策略

3. **用户体验增强**：
   - 测试创建向导（步骤式引导）
   - 实时预览功能（预估测试时长）
   - 历史测试对比分析

### 7.3 长期优化（P3）

1. **高级分析功能**：
   - 多变量测试支持（MVT）
   - 贝叶斯统计分析
   - 机器学习预测最优配置

2. **企业级特性**：
   - 多用户协作和权限管理
   - 测试模板和最佳实践库
   - 审计日志和合规性报告

3. **生态集成**：
   - 与BI工具集成（如Metabase）
   - 与营销自动化平台集成
   - RESTful API对外开放

---

## 八、测试报告模板

完成测试后，填写以下报告：

### 测试环境信息
- **测试日期**：____________________
- **测试人员**：____________________
- **系统版本**：____________________
- **数据库版本**：SQLite ____________________

### Phase 1测试结果
- **测试ID**：____________________
- **测试名称**：____________________
- **Variants数量**：____________________
- **Winner**：____________________
- **CTR提升**：____________________
- **统计显著性**：是 / 否
- **总耗时**：____________________
- **问题记录**：____________________

### Phase 2测试结果
- **测试ID**：____________________
- **测试名称**：____________________
- **基于Phase 1 Winner**：是 / 否
- **Winner策略**：____________________
- **CPA降低**：____________________
- **统计显著性**：是 / 否
- **总耗时**：____________________
- **问题记录**：____________________

### Dashboard功能验证
- [ ] 测试列表显示正确
- [ ] 实时刷新正常工作
- [ ] 进度条和指标准确
- [ ] Winner展示清晰
- [ ] 跳转功能正常

### 数据同步验证
- [ ] campaign_performance数据完整
- [ ] ab_test_variants聚合正确
- [ ] 时间戳处理正确
- [ ] 前端延迟可接受（<30秒）

### 总体评价
- **测试通过率**：______%
- **发现问题数**：______个
- **严重问题数**：______个
- **建议下一步**：____________________

---

## 附录A：快速测试脚本

创建一个完整的测试脚本，自动化整个流程：

```bash
#!/bin/bash
# quick-e2e-test.sh

echo "🚀 开始A/B测试端到端验证..."

# 1. 清理旧数据
echo "📝 步骤1: 清理测试数据..."
sqlite3 data/autoads.db <<EOF
DELETE FROM ab_tests WHERE test_name LIKE '%测试%';
DELETE FROM ab_test_variants WHERE test_id NOT IN (SELECT id FROM ab_tests);
DELETE FROM campaign_performance WHERE date > date('now', '-1 day');
EOF

# 2. 创建Phase 1测试
echo "📝 步骤2: 创建Phase 1创意测试..."
PHASE1_RESPONSE=$(curl -s -X POST http://localhost:3000/api/ab-tests \
  -H "Content-Type: application/json" \
  -d '{
    "offer_id": 1,
    "test_name": "自动测试-创意-'$(date +%Y%m%d%H%M%S)'",
    "test_mode": "standard",
    "test_dimension": "creative",
    "variants": [
      {"variant_name": "control", "variant_label": "原始", "budget_allocation": 0.34, "headline": "Test", "description": "Control"},
      {"variant_name": "variant_a", "variant_label": "变体A", "budget_allocation": 0.33, "headline": "Test A", "description": "Variant A"},
      {"variant_name": "variant_b", "variant_label": "变体B", "budget_allocation": 0.33, "headline": "Test B", "description": "Variant B"}
    ],
    "min_sample_size": 100,
    "confidence_level": 0.95
  }')

TEST1_ID=$(echo $PHASE1_RESPONSE | jq -r '.test_id')
echo "✅ Phase 1测试创建成功, ID: $TEST1_ID"

# 3. 获取campaign IDs
CAMPAIGN_IDS=$(sqlite3 data/autoads.db "SELECT campaign_id FROM ab_test_variants WHERE test_id=$TEST1_ID ORDER BY variant_name;")
CID_ARRAY=($CAMPAIGN_IDS)

# 4. 插入Phase 1性能数据
echo "📝 步骤3: 插入Phase 1模拟数据..."
sqlite3 data/autoads.db <<EOF
INSERT INTO campaign_performance (user_id, campaign_id, date, impressions, clicks, conversions, cost, ctr, cpc, cpa, conversion_rate)
VALUES
  (1, ${CID_ARRAY[0]}, date('now'), 5000, 100, 5, 500.0, 2.0, 5.0, 100.0, 5.0),
  (1, ${CID_ARRAY[1]}, date('now'), 5000, 140, 7, 490.0, 2.8, 3.5, 70.0, 5.0),
  (1, ${CID_ARRAY[2]}, date('now'), 5000, 90, 4, 450.0, 1.8, 5.0, 112.5, 4.4);
EOF

# 5. 运行监控任务
echo "📝 步骤4: 运行Phase 1监控任务..."
node -e "require('./src/scheduler/ab-test-monitor').monitorABTests()"

# 6. 验证Phase 1结果
WINNER1=$(sqlite3 data/autoads.db "SELECT variant_name FROM ab_test_variants WHERE test_id=$TEST1_ID AND is_winner=1;")
echo "✅ Phase 1 Winner: $WINNER1"

# 7. 创建Phase 2测试
echo "📝 步骤5: 创建Phase 2策略测试..."
WINNER_CID=$(sqlite3 data/autoads.db "SELECT campaign_id FROM ab_test_variants WHERE test_id=$TEST1_ID AND is_winner=1;")

PHASE2_RESPONSE=$(curl -s -X POST http://localhost:3000/api/ab-tests \
  -H "Content-Type: application/json" \
  -d '{
    "offer_id": 1,
    "test_name": "自动测试-策略-'$(date +%Y%m%d%H%M%S)'",
    "test_mode": "standard",
    "test_dimension": "strategy",
    "parent_test_id": '$TEST1_ID',
    "base_campaign_id": '$WINNER_CID',
    "variants": [
      {"variant_name": "control", "variant_label": "基础", "strategy_type": "basic", "budget_allocation": 0.34},
      {"variant_name": "variant_a", "variant_label": "负关键词", "strategy_type": "aggressive_negative", "negative_keywords": ["免费","破解"], "budget_allocation": 0.33},
      {"variant_name": "variant_b", "variant_label": "CPC优化", "strategy_type": "cpc_optimization", "target_cpa": 80.0, "budget_allocation": 0.33}
    ],
    "min_sample_size": 50,
    "confidence_level": 0.95
  }')

TEST2_ID=$(echo $PHASE2_RESPONSE | jq -r '.test_id')
echo "✅ Phase 2测试创建成功, ID: $TEST2_ID"

# 8. 获取Phase 2 campaign IDs
CAMPAIGN_IDS2=$(sqlite3 data/autoads.db "SELECT campaign_id FROM ab_test_variants WHERE test_id=$TEST2_ID ORDER BY variant_name;")
CID_ARRAY2=($CAMPAIGN_IDS2)

# 9. 插入Phase 2性能数据
echo "📝 步骤6: 插入Phase 2模拟数据..."
sqlite3 data/autoads.db <<EOF
INSERT INTO campaign_performance (user_id, campaign_id, date, impressions, clicks, conversions, cost, ctr, cpc, cpa, conversion_rate)
VALUES
  (1, ${CID_ARRAY2[0]}, date('now'), 10000, 200, 20, 2000.0, 2.0, 10.0, 100.0, 10.0),
  (1, ${CID_ARRAY2[1]}, date('now'), 9000, 180, 24, 1800.0, 2.0, 10.0, 75.0, 13.3),
  (1, ${CID_ARRAY2[2]}, date('now'), 11000, 220, 20, 1700.0, 2.0, 7.7, 85.0, 9.1);
EOF

# 10. 运行监控任务
echo "📝 步骤7: 运行Phase 2监控任务..."
node -e "require('./src/scheduler/ab-test-monitor').monitorABTests()"

# 11. 验证Phase 2结果
WINNER2=$(sqlite3 data/autoads.db "SELECT variant_name FROM ab_test_variants WHERE test_id=$TEST2_ID AND is_winner=1;")
echo "✅ Phase 2 Winner: $WINNER2"

# 12. 汇总报告
echo ""
echo "📊 测试完成汇总："
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Phase 1 测试ID: $TEST1_ID"
echo "Phase 1 Winner: $WINNER1"
echo "Phase 2 测试ID: $TEST2_ID"
echo "Phase 2 Winner: $WINNER2"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 端到端测试完成！请访问以下URL验证："
echo "  Dashboard: http://localhost:3000/dashboard"
echo "  Phase 1详情: http://localhost:3000/ab-tests/$TEST1_ID"
echo "  Phase 2详情: http://localhost:3000/ab-tests/$TEST2_ID"
```

使用方法：
```bash
chmod +x quick-e2e-test.sh
./quick-e2e-test.sh
```

---

**文档版本**：v1.0
**最后更新**：2025-01-21
**维护者**：AutoAds团队
