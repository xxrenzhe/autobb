# 评分算法迁移测试指南

## 已完成的工作

✅ **旧API迁移** - `/api/offers/[id]/generate-ad-creative` 已使用Ad Strength评估系统
✅ **旧算法标记** - `calculateAdCreativeScore` 已标记为 `@deprecated`
✅ **调用点验证** - 所有 `createAdCreative` 调用都传入score参数
✅ **清理旧数据** - Offer 51的所有旧创意已删除

---

## 测试步骤

### 方法1：浏览器测试（推荐）

1. **访问创意生成页面**
   ```
   http://localhost:3000/offers/51/launch
   ```

2. **点击"再次生成"按钮**
   - 系统会调用新API生成广告创意
   - 使用Ad Strength评估系统评分

3. **观察浏览器控制台（F12）**
   - **期望看到**：无错误
   - **不应该看到**：`⚠️ calculateAdCreativeScore已废弃` 警告

4. **观察服务器控制台（npm run dev终端）**
   - **期望看到**：
     ```
     📊 创意评估: EXCELLENT (85分)
     ✅ 广告创意已保存 (ID: 73, 评分: 85, 评级: EXCELLENT)
     ```
   - **不应该看到**：
     ```
     ⚠️ calculateAdCreativeScore已废弃，建议使用Ad Strength评估系统
     ```

5. **检查生成的创意**
   - 查看Ad Strength评级（应该是EXCELLENT/GOOD/AVERAGE之一）
   - 查看雷达图（应该显示5个维度）
   - 检查分数是否在合理范围内（60-100分）

6. **刷新页面验证持久化**
   - 刷新页面后分数和评级应该保持一致
   - 雷达图应该显示相同的数据

---

### 方法2：数据库验证

生成创意后，查询数据库验证：

```bash
sqlite3 data/autoads.db "
  SELECT
    id,
    score,
    score_breakdown
  FROM ad_creatives
  WHERE offer_id = 51
  ORDER BY id DESC
  LIMIT 1;
"
```

**期望结果**：
- `score` 应该在 60-100 范围内
- `score_breakdown` 应该包含5个维度且都不超过最大值：
  - `diversity` ≤ 25
  - `relevance` ≤ 25
  - `engagement` ≤ 20（对应completeness）
  - `quality` ≤ 20
  - `clarity` ≤ 10（对应compliance）

---

### 方法3：自动化测试脚本

运行测试脚本验证：

```bash
npx tsx scripts/test-scoring-migration.ts
```

**期望输出**：
```
✅ 所有创意的评分都在合法范围内
📋 迁移测试结论：迁移成功！所有创意都使用Ad Strength评估系统
```

---

## 验证清单

### ✅ 代码层面
- [x] 旧API导入了 `evaluateCreativeAdStrength`
- [x] 旧API调用了Ad Strength评估
- [x] 旧API传入了 `score` 和 `score_breakdown` 参数
- [x] `calculateAdCreativeScore` 添加了 `@deprecated` 注释
- [x] `calculateAdCreativeScore` 添加了 `console.warn` 警告

### ⏳ 运行时验证（待测试）
- [ ] 生成创意时调用Ad Strength评估
- [ ] 控制台显示 `📊 创意评估: XX (XX分)`
- [ ] 控制台**不显示** `⚠️ calculateAdCreativeScore已废弃`
- [ ] 数据库中所有维度分数 ≤ 最大值
- [ ] 刷新页面后分数和评级一致

---

## 故障排查

### 问题1：仍然看到"calculateAdCreativeScore已废弃"警告

**原因**：`createAdCreative` 未收到 `score` 参数，回退到旧算法

**解决方案**：
1. 检查API代码是否正确传入 `score` 和 `score_breakdown`
2. 检查 `evaluateCreativeAdStrength` 是否正常执行
3. 查看完整的错误堆栈

### 问题2：维度分数超过最大值

**原因**：使用了旧评分算法（双重四舍五入bug）

**解决方案**：
1. 确认API代码已修改
2. 删除旧创意重新生成
3. 检查服务器是否重启以加载新代码

### 问题3：分数刷新后变化

**原因**：未正确传入 `score` 参数，每次都重新计算

**解决方案**：
1. 检查 `createAdCreative` 调用是否传入 `score`
2. 检查数据库中 `score` 字段是否正确保存
3. 查看API响应和数据库数据是否一致

---

## 成功标准

迁移成功的标志：

1. ✅ **控制台日志正确**
   - 显示 `📊 创意评估: XX (XX分)`
   - 显示 `✅ 广告创意已保存 (ID: XX, 评分: XX, 评级: XX)`
   - **不显示** 废弃警告

2. ✅ **数据库数据合法**
   - 所有维度分数 ≤ 最大值
   - `score_breakdown` 包含5个维度
   - 总分在 60-100 范围内

3. ✅ **前端显示一致**
   - 生成后显示正确评级
   - 雷达图显示5个维度
   - 刷新后数据不变

---

## 下一步（测试后）

测试成功后，可以考虑：

1. **清理其他Offer的旧数据**（可选）
   ```sql
   DELETE FROM ad_creatives WHERE created_at < '2025-11-22 16:00:00';
   ```

2. **添加数据库版本标记**（可选）
   ```sql
   ALTER TABLE ad_creatives ADD COLUMN scoring_version TEXT DEFAULT 'v1';
   UPDATE ad_creatives SET scoring_version = 'v2' WHERE created_at >= '2025-11-22 16:00:00';
   ```

3. **完全移除旧算法**（未来）
   - 删除 `calculateAdCreativeScore` 函数
   - 移除 `createAdCreative` 中的条件逻辑
   - 强制要求传入 `score` 参数

---

**测试时间**: 2025-11-22
**迁移状态**: ✅ 代码已完成，⏳ 等待运行时验证
