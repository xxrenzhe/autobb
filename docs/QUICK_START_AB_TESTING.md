# A/B测试快速开始指南

## 🚀 快速开始：5分钟完成端到端测试

### 第一步：启动服务

```bash
# Terminal 1: 启动Next.js开发服务器
npm run dev

# Terminal 2: 启动调度器（用于A/B测试监控）
npm run scheduler
```

**验证**：访问 http://localhost:3000 确认服务运行正常

### 第二步：运行自动化测试

```bash
# 在项目根目录执行
./scripts/test-ab-testing-e2e.sh
```

**脚本将自动完成以下操作**：
1. ✅ 检查依赖和服务状态
2. ✅ 清理旧测试数据
3. ✅ 创建Phase 1创意测试（3个variants）
4. ✅ 插入模拟性能数据
5. ✅ 运行监控任务分析结果
6. ✅ 验证Phase 1 winner
7. ✅ 创建Phase 2策略测试（基于Phase 1 winner）
8. ✅ 插入Phase 2性能数据
9. ✅ 运行监控任务分析CPC
10. ✅ 生成测试报告

**预期输出**：
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🎉 端到端测试完成！所有测试通过！
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 第三步：查看测试结果

#### 方式1：查看生成的测试报告

```bash
# 查看最新生成的测试报告
cat test-report-*.txt | tail -100
```

#### 方式2：在浏览器中验证

**Dashboard页面**：
- URL: http://localhost:3000/dashboard
- 验证：A/B测试进度卡片显示2个测试（1个创意测试 + 1个策略测试）

**Phase 1详情页**：
- URL: http://localhost:3000/ab-tests/[test_id]
- 验证：
  - ✅ 测试状态为"已完成"
  - ✅ Winner标识显示在正确的variant上
  - ✅ 优化指标显示"CTR（点击率）"
  - ✅ 性能提升百分比正确

**Phase 2详情页**：
- URL: http://localhost:3000/ab-tests/[test_id]
- 验证：
  - ✅ 测试状态为"已完成"
  - ✅ Winner标识显示在正确的variant上
  - ✅ 优化指标显示"CPC（点击成本）"
  - ✅ CPC降低百分比正确（负数=好）
  - ✅ 显示绿色下降箭头

#### 方式3：直接查询数据库

```bash
# 查看所有测试
sqlite3 data/autoads.db "
SELECT
  id,
  test_name,
  test_dimension,
  status,
  CASE WHEN winner_variant_id IS NOT NULL THEN '有Winner' ELSE '无Winner' END as winner_status
FROM ab_tests
WHERE test_name LIKE '%测试-%'
ORDER BY created_at DESC LIMIT 5;
"

# 查看Phase 1结果（创意测试）
sqlite3 data/autoads.db -header -column "
SELECT
  variant_label AS '变体',
  impressions AS '展示',
  clicks AS '点击',
  ctr AS 'CTR',
  CASE WHEN is_winner=1 THEN '🏆' ELSE '' END AS 'Winner'
FROM ab_test_variants
WHERE test_id = (
  SELECT id FROM ab_tests WHERE test_dimension='creative' ORDER BY created_at DESC LIMIT 1
)
ORDER BY variant_name;
"

# 查看Phase 2结果（策略测试）
sqlite3 data/autoads.db -header -column "
SELECT
  variant_label AS '变体',
  clicks AS '点击',
  cost AS '成本',
  ROUND(cost/clicks, 2) AS 'CPC',
  CASE WHEN is_winner=1 THEN '🏆' ELSE '' END AS 'Winner'
FROM ab_test_variants
WHERE test_id = (
  SELECT id FROM ab_tests WHERE test_dimension='strategy' ORDER BY created_at DESC LIMIT 1
)
ORDER BY variant_name;
"
```

---

## 📋 验证清单

### Phase 1验证（创意测试）

- [ ] ✅ 测试创建成功，test_dimension='creative'
- [ ] ✅ 3个variants创建成功（control, variant_a, variant_b）
- [ ] ✅ 性能数据正确插入campaign_performance表
- [ ] ✅ 监控任务正确聚合数据到ab_test_variants
- [ ] ✅ CTR计算正确（clicks / impressions * 100）
- [ ] ✅ Winner判定正确（CTR最高且统计显著）
- [ ] ✅ 测试状态更新为'completed'
- [ ] ✅ Dashboard显示创意测试卡片
- [ ] ✅ 详情页显示"CTR（点击率）"标签
- [ ] ✅ 改进方向正确（CTR提升=绿色上升箭头）

### Phase 2验证（策略测试）

- [ ] ✅ 测试创建成功，test_dimension='strategy'
- [ ] ✅ parent_test_id指向Phase 1测试
- [ ] ✅ base_campaign_id指向Phase 1 winner campaign
- [ ] ✅ 策略配置正确存储（JSON格式）
- [ ] ✅ 3个variants创建成功
- [ ] ✅ 性能数据正确插入
- [ ] ✅ 监控任务识别策略测试维度
- [ ] ✅ CPC计算正确（cost / clicks）
- [ ] ✅ Winner判定正确（CPC最低且统计显著）
- [ ] ✅ improvement_percentage计算正确（负数=成本降低）
- [ ] ✅ Dashboard显示策略测试卡片
- [ ] ✅ Dashboard显示CPC指标（而非CPA）
- [ ] ✅ 详情页显示"CPC（点击成本）"标签
- [ ] ✅ 改进方向正确（CPC降低=绿色下降箭头）

---

## 🔧 故障排查

### 问题1：脚本执行失败 "Next.js服务未运行"

**原因**：Next.js开发服务器未启动

**解决方案**：
```bash
# 在另一个terminal启动服务
npm run dev
```

### 问题2：脚本执行失败 "数据库文件不存在"

**原因**：数据库路径不正确

**解决方案**：
```bash
# 检查数据库文件
ls -lh data/autoads.db

# 如果不存在，创建数据库
npm run db:migrate
```

### 问题3：测试创建失败 "offer_id不存在"

**原因**：数据库中没有Offer数据

**解决方案**：
```bash
# 方式1：通过前端创建Offer
# 访问 http://localhost:3000/offers/new

# 方式2：通过SQL创建测试Offer
sqlite3 data/autoads.db "
INSERT INTO offers (name, url, status, user_id, created_at)
VALUES ('测试Offer', 'https://example.com', 'active', 1, datetime('now'));
"
```

### 问题4：监控任务未判定winner

**原因**：样本量不足或未达到统计显著性

**检查**：
```bash
# 查看变体数据
sqlite3 data/autoads.db "
SELECT variant_name, impressions, clicks, ctr
FROM ab_test_variants
WHERE test_id = ?;
"

# 检查样本量是否足够
# Phase 1需要: 总点击数 >= 100
# Phase 2需要: 总点击数 >= 50
```

**解决方案**：调整min_sample_size或增加模拟数据

### 问题5：前端不显示测试

**原因**：测试未启动或状态不对

**检查**：
```bash
sqlite3 data/autoads.db "
SELECT id, test_name, status, start_date
FROM ab_tests
ORDER BY created_at DESC LIMIT 5;
"
```

**解决方案**：确保status='running'且start_date不为NULL

---

## 🎯 手动测试（不使用脚本）

如果您想逐步手动测试，可以按照以下步骤：

### Step 1: 创建Phase 1测试

```bash
curl -X POST http://localhost:3000/api/ab-tests \
  -H "Content-Type: application/json" \
  -d '{
    "offer_id": 1,
    "test_name": "手动测试-创意-001",
    "test_mode": "standard",
    "test_dimension": "creative",
    "variants": [
      {
        "variant_name": "control",
        "variant_label": "原始",
        "headline": "测试标题A",
        "description": "测试描述A",
        "budget_allocation": 0.5
      },
      {
        "variant_name": "variant_a",
        "variant_label": "变体A",
        "headline": "测试标题B",
        "description": "测试描述B",
        "budget_allocation": 0.5
      }
    ],
    "min_sample_size": 100,
    "confidence_level": 0.95
  }'
```

### Step 2: 插入性能数据

```bash
# 获取刚创建的campaign IDs
sqlite3 data/autoads.db "SELECT id FROM campaigns ORDER BY created_at DESC LIMIT 2;"

# 插入模拟数据（使用上面获取的campaign IDs）
sqlite3 data/autoads.db "
INSERT INTO campaign_performance (user_id, campaign_id, date, impressions, clicks, conversions, cost, ctr, cpc, cpa, conversion_rate)
VALUES
  (1, [CAMPAIGN_ID_1], date('now'), 5000, 100, 5, 500.0, 2.0, 5.0, 100.0, 5.0),
  (1, [CAMPAIGN_ID_2], date('now'), 5000, 140, 7, 490.0, 2.8, 3.5, 70.0, 5.0);
"
```

### Step 3: 运行监控任务

```bash
node -e "require('./src/scheduler/ab-test-monitor').monitorActiveABTests()"
```

### Step 4: 查看结果

访问：http://localhost:3000/dashboard

---

## 📚 相关文档

- **完整测试指南**: `docs/AB_TESTING_E2E_TEST_GUIDE.md`
- **策略维度修正报告**: `docs/AB_TESTING_STRATEGY_DIMENSION_FIX.md`
- **Phase 2完成报告**: `docs/AB_TESTING_PHASE2_COMPLETE.md`
- **前端集成报告**: `docs/AB_TESTING_FRONTEND_INTEGRATION_COMPLETE.md`

---

## ✨ 快速验证命令

```bash
# 一键查看最近的测试状态
sqlite3 data/autoads.db "
SELECT
  t.id,
  t.test_name,
  t.test_dimension AS '维度',
  t.status AS '状态',
  COALESCE(w.variant_label, '无') AS 'Winner'
FROM ab_tests t
LEFT JOIN ab_test_variants w ON t.id = w.test_id AND w.is_winner = 1
ORDER BY t.created_at DESC
LIMIT 5;
"
```

---

**文档版本**: v1.0
**最后更新**: 2025-01-21
**维护者**: AutoAds团队
