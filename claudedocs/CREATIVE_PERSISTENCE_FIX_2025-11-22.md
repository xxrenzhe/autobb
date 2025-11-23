# 广告创意刷新后丢失问题修复 2025-11-22

## 问题描述

**用户报告**：/offers/51/launch页面，点击"再次生成"后，生成了一个经过3轮优化的96分广告创意，但是刷新页面后，却变成了一个经过1轮优化的64分的广告创意。

**预期行为**：生成的96分创意应该保存到数据库，刷新页面后仍然显示96分。

---

## 问题排查过程

### 1. 数据库查询

```sql
SELECT id, offer_id, score, generation_round, created_at
FROM ad_creatives
WHERE offer_id = 51
ORDER BY id DESC;
```

**结果**：
```
ID 72: score=64.0, generation_round=1, created_at=2025-11-22 15:27:06
ID 71: score=63.0, generation_round=1, created_at=2025-11-22 15:23:31
ID 70: score=64.0, generation_round=1, created_at=2025-11-22 15:01:22
```

**发现**：
- ❌ **没有96分的记录**
- ❌ 所有记录的`generation_round`都是1（应该是3如果经过3轮优化）
- ❌ 所有记录的`score`都是63-64分（旧的简单算法计算的）

### 2. 全库高分查询

```sql
SELECT id, offer_id, score, generation_round, created_at
FROM ad_creatives
WHERE score >= 85
ORDER BY id DESC;
```

**结果**：无记录

**结论**：96分的Ad Strength创意根本没有保存到数据库！

### 3. 代码分析

#### 前端handleGenerate（Step1CreativeGeneration.tsx:298）

```typescript
const newCreative = {
  id: Date.now(), // 临时ID，等待后端实现保存功能
  ...data.creative,
  score: data.adStrength.score, // 96分
  // ...
}
```

**注释说明**："等待后端实现保存功能" - 但后端其实已经保存了！

#### 后端API（generate-creatives/route.ts:184-204）

```typescript
// 保存到数据库
const savedCreative = createAdCreative(parseInt(userId, 10), parseInt(id, 10), {
  headlines: bestCreative.headlines,
  // ...
  score: bestEvaluation.finalScore, // ✅ 96分传入
  score_breakdown: {
    relevance: bestEvaluation.localEvaluation.dimensions.relevance.score,
    // ...
  },
  generation_round: 1 // ❌ 硬编码为1，应该是attempts!
})
```

API确实保存了，但是`generation_round`硬编码为1。

#### createAdCreative函数（ad-creative.ts:138-151）

```typescript
export function createAdCreative(
  userId: number,
  offerId: number,
  data: GeneratedAdCreativeData & {
    final_url: string
    final_url_suffix?: string
    ai_model: string
    generation_round?: number
  }
): AdCreative {
  const db = getDatabase()

  // 计算评分
  const scoreResult = calculateAdCreativeScore(data, offerId) // ❌ 重新计算！
```

**根本原因找到了！**

`createAdCreative`**忽略了传入的`data.score`，重新调用旧的`calculateAdCreativeScore`计算分数！**

---

## 根本原因

### 双重评分系统冲突

**旧算法**（`calculateAdCreativeScore`）：
- 相关性：0-30分（基于关键词匹配）
- 质量：0-25分（基于文本长度和格式）
- 吸引力：0-25分（基于CTA和紧迫感）
- 多样性：0-10分（基于标题描述数量）
- 清晰度：0-10分（基于合规性）

**新算法**（`evaluateCreativeAdStrength` - Ad Strength系统）：
- Diversity（多样性）：0-25分
- Relevance（相关性）：0-25分
- Completeness（完整性）：0-20分
- Quality（质量）：0-20分
- Compliance（合规性）：0-10分

### 错误的流程

1. **API生成阶段**：
   ```
   generateAdCreative() → evaluateCreativeAdStrength()
   → 得到96分（新算法）
   → 经过3轮优化，attempts=3
   ```

2. **API保存阶段**：
   ```typescript
   createAdCreative({
     score: 96,  // ← 传入了96分
     score_breakdown: { ... },
     generation_round: 1  // ❌ 硬编码为1
   })
   → 内部调用 calculateAdCreativeScore() // ❌ 重新计算
   → 得到64分（旧算法）// ❌ 忽略传入的96分！
   → 保存64分到数据库
   ```

3. **前端显示阶段**：
   ```
   前端收到API返回的96分
   → 在内存中显示96分创意（临时ID）
   → 用户看到96分
   ```

4. **刷新页面**：
   ```
   fetchExistingCreatives() → 从数据库加载
   → 只能找到64分的记录（ID 70, 71, 72）
   → 96分创意丢失！
   ```

---

## 修复方案

### 修复1：createAdCreative接受外部评分

**修改文件**：`src/lib/ad-creative.ts`

**修改前**（lines 138-151）：
```typescript
export function createAdCreative(
  userId: number,
  offerId: number,
  data: GeneratedAdCreativeData & {
    final_url: string
    final_url_suffix?: string
    ai_model: string
    generation_round?: number
  }
): AdCreative {
  const db = getDatabase()

  // 计算评分
  const scoreResult = calculateAdCreativeScore(data, offerId) // ❌ 总是重新计算
```

**修改后**（lines 138-167）：
```typescript
export function createAdCreative(
  userId: number,
  offerId: number,
  data: GeneratedAdCreativeData & {
    final_url: string
    final_url_suffix?: string
    ai_model?: string
    generation_round?: number
    // 新增：允许外部传入评分（Ad Strength评估结果）
    score?: number
    score_breakdown?: {
      relevance: number
      quality: number
      engagement: number
      diversity: number
      clarity: number
    }
  }
): AdCreative {
  const db = getDatabase()

  // 如果外部传入了score，优先使用（来自Ad Strength评估）
  // 否则使用旧的评分算法计算（向后兼容）
  const scoreResult = data.score && data.score_breakdown
    ? {
        total_score: data.score,
        breakdown: data.score_breakdown,
        explanation: data.explanation || '由Ad Strength评估系统生成'
      }
    : calculateAdCreativeScore(data, offerId)
```

**修改逻辑**：
- 如果传入了`data.score`和`data.score_breakdown`，优先使用（Ad Strength评估的结果）
- 否则回退到旧算法`calculateAdCreativeScore`（向后兼容其他地方的调用）

### 修复2：传入Ad Strength评分和实际轮次

**修改文件**：`src/app/api/offers/[id]/generate-creatives/route.ts`

**修改前**（lines 183-204）：
```typescript
const savedCreative = createAdCreative(parseInt(userId, 10), parseInt(id, 10), {
  // ...
  score: bestEvaluation.finalScore,      // ✅ 传入了但是被忽略
  score_breakdown: {                      // ✅ 传入了但是被忽略
    relevance: bestEvaluation.localEvaluation.dimensions.relevance.score,
    quality: bestEvaluation.localEvaluation.dimensions.quality.score,
    engagement: bestEvaluation.localEvaluation.dimensions.completeness.score,
    diversity: bestEvaluation.localEvaluation.dimensions.diversity.score,
    clarity: bestEvaluation.localEvaluation.dimensions.compliance.score
  },
  generation_round: 1 // ❌ 硬编码为1，应该是attempts
})
```

**修改后**（lines 183-205）：
```typescript
const savedCreative = createAdCreative(parseInt(userId, 10), parseInt(id, 10), {
  headlines: bestCreative.headlines,
  descriptions: bestCreative.descriptions,
  keywords: bestCreative.keywords,
  keywordsWithVolume: bestCreative.keywordsWithVolume,
  callouts: bestCreative.callouts,
  sitelinks: bestCreative.sitelinks,
  theme: bestCreative.theme,
  explanation: bestCreative.explanation,
  final_url: offer.final_url || offer.url,
  final_url_suffix: offer.final_url_suffix || undefined,
  // 传入Ad Strength评估的分数（而不是让createAdCreative重新计算）
  score: bestEvaluation.finalScore,
  score_breakdown: {
    relevance: bestEvaluation.localEvaluation.dimensions.relevance.score,
    quality: bestEvaluation.localEvaluation.dimensions.quality.score,
    engagement: bestEvaluation.localEvaluation.dimensions.completeness.score,
    diversity: bestEvaluation.localEvaluation.dimensions.diversity.score,
    clarity: bestEvaluation.localEvaluation.dimensions.compliance.score
  },
  generation_round: attempts // ✅ 传入实际的尝试次数（1-3）
})
```

**关键变化**：
- `generation_round: attempts` - 使用实际的优化轮次（1, 2, 或3）

### 修复3：ai_model默认值（额外修复）

**修改文件**：`src/lib/ad-creative.ts` (line 193)

```typescript
data.ai_model || 'gemini-2.0-flash-exp' // 添加默认值，因为ai_model现在是可选的
```

---

## 修复后的正确流程

### 1. API生成阶段
```
用户点击"生成创意"
→ POST /api/offers/51/generate-creatives
→ generateAdCreative() 生成创意
→ evaluateCreativeAdStrength() 评估
→ 第1轮：64分（AVERAGE）
→ 第2轮：78分（GOOD）
→ 第3轮：96分（EXCELLENT）✅
→ attempts = 3
→ bestEvaluation.finalScore = 96
```

### 2. API保存阶段
```typescript
createAdCreative({
  score: 96,                    // ✅ 传入Ad Strength评分
  score_breakdown: { ... },     // ✅ 传入5维度分数
  generation_round: 3           // ✅ 传入实际轮次
})

→ 内部逻辑：
  if (data.score && data.score_breakdown) {
    // ✅ 使用传入的评分
    scoreResult = {
      total_score: 96,
      breakdown: { ... },
      explanation: '由Ad Strength评估系统生成'
    }
  }

→ 保存到数据库：
  INSERT INTO ad_creatives (score, score_breakdown, generation_round)
  VALUES (96, '{"relevance":25,...}', 3)
```

### 3. 前端显示阶段
```
前端收到API响应：
data.creative.id = 73 (真实数据库ID)
data.adStrength.score = 96
data.optimization.attempts = 3

→ 显示96分创意，经过3轮优化
```

### 4. 刷新页面
```
fetchExistingCreatives()
→ GET /api/offers/51/generate-ad-creative
→ 查询数据库

SELECT * FROM ad_creatives WHERE offer_id = 51

→ 返回：
  ID 73: score=96, generation_round=3 ✅
  ID 72: score=64, generation_round=1
  ID 71: score=63, generation_round=1

→ 前端显示96分创意（最高分）
```

---

## 验证测试

### 测试步骤

1. 访问 http://localhost:3000/offers/51/launch
2. 点击"再次生成"按钮
3. 等待生成完成，记录显示的分数和轮次
4. 查看数据库记录：
   ```sql
   SELECT id, score, generation_round, created_at
   FROM ad_creatives
   WHERE offer_id = 51
   ORDER BY id DESC LIMIT 1;
   ```
5. 刷新页面
6. 验证显示的分数和轮次是否一致

### 预期结果

**生成后**：
- ✅ 显示Ad Strength评分（可能60-100分）
- ✅ 显示实际优化轮次（1-3轮）
- ✅ 数据库中有对应记录，score和generation_round正确

**刷新后**：
- ✅ 显示相同的分数
- ✅ 显示相同的轮次
- ✅ 雷达图形状一致

### 数据库验证

```sql
-- 查看最新创意的详细信息
SELECT
  id,
  score,
  generation_round,
  score_breakdown,
  created_at
FROM ad_creatives
WHERE offer_id = 51
ORDER BY id DESC
LIMIT 1;
```

**预期**：
- `score`应该是Ad Strength评分（60-100）
- `generation_round`应该是实际尝试次数（1-3）
- `score_breakdown`应该包含5个维度的分数

---

## 技术细节

### 评分系统对比

| 维度 | 旧算法最大值 | Ad Strength最大值 | 映射关系 |
|------|-------------|------------------|----------|
| 相关性（Relevance） | 30分 | 25分 | 不同算法 |
| 质量（Quality） | 25分 | 20分 | 不同算法 |
| 吸引力（Engagement）| 25分 | 20分（Completeness） | 不同算法 |
| 多样性（Diversity） | 10分 | 25分 | 不同算法 |
| 清晰度（Clarity） | 10分 | 10分（Compliance） | 相同 |
| **总分** | **100分** | **100分** | **相同** |

### 数据流向

```
┌─────────────────────────────────────────────────────┐
│ 1. 生成阶段                                         │
│    generateAdCreative() → AI生成创意                │
│    evaluateCreativeAdStrength() → 96分 (3轮优化)   │
└────────────────────┬────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────┐
│ 2. 保存阶段                                         │
│    createAdCreative({                              │
│      score: 96,              ← 直接使用Ad Strength │
│      score_breakdown: {...}, ← 5维度分数            │
│      generation_round: 3     ← 实际轮次             │
│    })                                               │
│    → INSERT INTO ad_creatives (96, {...}, 3)       │
└────────────────────┬────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────┐
│ 3. 显示阶段                                         │
│    前端显示：96分，经过3轮优化                      │
└────────────────────┬────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────┐
│ 4. 刷新后                                           │
│    fetchExistingCreatives()                        │
│    → SELECT * WHERE offer_id=51                    │
│    → 返回：score=96, generation_round=3            │
│    → 前端显示：96分，经过3轮优化 ✅                 │
└─────────────────────────────────────────────────────┘
```

---

## 影响范围

### 修改的文件

1. **`src/lib/ad-creative.ts`**
   - 修改`createAdCreative`函数签名，添加可选的`score`和`score_breakdown`参数
   - 添加条件逻辑：优先使用传入的评分，否则回退到旧算法
   - 添加`ai_model`默认值
   - 行号：138-167, 193

2. **`src/app/api/offers/[id]/generate-creatives/route.ts`**
   - 修改调用`createAdCreative`时传入Ad Strength评分
   - 修改`generation_round`为实际尝试次数`attempts`
   - 行号：183-205

### 向后兼容性

- ✅ **完全向后兼容**
- 其他调用`createAdCreative`的地方不传`score`和`score_breakdown`，仍然使用旧算法
- 新的Ad Strength评估会传入这些参数，使用新算法结果

---

## 后续优化建议

### 优先级P1（推荐实施）

1. **统一评分系统**：
   - 逐步废弃旧的`calculateAdCreativeScore`算法
   - 所有地方都使用Ad Strength评估系统

2. **数据库迁移**：
   ```sql
   -- 标记旧数据
   ALTER TABLE ad_creatives ADD COLUMN scoring_version TEXT DEFAULT 'v1';

   -- 新数据标记为v2（Ad Strength）
   UPDATE ad_creatives
   SET scoring_version = 'v2'
   WHERE created_at > '2025-11-22';
   ```

3. **前端显示优化**：
   ```typescript
   // 显示评分来源
   {creative.scoring_version === 'v2' ? (
     <Badge>Ad Strength评分</Badge>
   ) : (
     <Badge variant="secondary">旧版评分</Badge>
   )}
   ```

### 优先级P2（可选）

4. **日志记录**：
   ```typescript
   console.log(`📊 使用${data.score ? 'Ad Strength' : '旧版'}评分系统`)
   console.log(`   最终分数: ${scoreResult.total_score}`)
   console.log(`   优化轮次: ${data.generation_round || 1}`)
   ```

5. **单元测试**：
   ```typescript
   describe('createAdCreative', () => {
     it('should use Ad Strength score when provided', () => {
       const result = createAdCreative(userId, offerId, {
         ...mockData,
         score: 96,
         score_breakdown: mockBreakdown
       })
       expect(result.score).toBe(96)
     })

     it('should fallback to old scoring when no score provided', () => {
       const result = createAdCreative(userId, offerId, mockData)
       expect(result.score).toBeLessThan(100)
     })
   })
   ```

---

## 总结

### 核心成果

1. ✅ **修复评分丢失** - Ad Strength评分正确保存到数据库
2. ✅ **修复轮次记录** - 实际优化轮次（1-3）正确记录
3. ✅ **修复刷新一致性** - 刷新页面后分数和轮次保持一致
4. ✅ **向后兼容** - 不影响其他使用旧评分的代码

### 技术亮点

- **条件逻辑设计**：优先使用新评分，回退到旧算法，确保向后兼容
- **参数化设计**：通过可选参数实现功能扩展，不破坏现有接口
- **数据流追踪**：从生成→保存→显示→刷新，全链路数据一致性

### 验证标准

- ✅ 生成96分创意，数据库中score=96
- ✅ 经过3轮优化，数据库中generation_round=3
- ✅ 刷新页面后，显示96分和3轮
- ✅ 雷达图显示正确的5维度分数
- ✅ 旧数据仍然能正常显示

---

**实现时间**: 2025-11-22
**开发者**: Claude Code
**状态**: ✅ 已完成，待测试验证
