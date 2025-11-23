# 品牌搜索量维度设计文档

## 背景

在广告创意评分中增加一个新维度：品牌词在目标国家目标语言的搜索量，用于评估品牌影响力和市场认知度。

---

## 新的评分系统（110分总分）

| 维度 | 权重 | 最大分数 | 说明 |
|------|------|---------|------|
| Diversity (多样性) | 22.7% | 25分 | 资产类型和内容多样性 |
| Relevance (相关性) | 22.7% | 25分 | 关键词相关性 |
| Completeness (完整性) | 18.2% | 20分 | 资产完整性 |
| Quality (质量) | 18.2% | 20分 | 内容质量 |
| Compliance (合规性) | 9.1% | 10分 | 政策合规性 |
| **Brand Search Volume (品牌搜索量)** | **9.1%** | **10分** | **品牌影响力** |
| **总计** | **100%** | **110分** | |

---

## 品牌搜索量维度设计

### 评分标准（月均搜索量）

| 流量级别 | 月均搜索量范围 | 分数 | 百分比 | 说明 |
|---------|--------------|------|--------|------|
| 超大流量 | 100,001+ | 10分 | 100% | 国际知名品牌 |
| 大流量 | 10,001 - 100,000 | 7.5分 | 75% | 区域知名品牌 |
| 中流量 | 1,001 - 10,000 | 5分 | 50% | 小众品牌或新兴品牌 |
| 小流量 | 100 - 1,000 | 2.5分 | 25% | 本地品牌或初创品牌 |
| 微小流量 | 0 - 99 | 0分 | 0% | 无品牌认知度 |

### 分级逻辑示例

```typescript
function calculateBrandSearchVolumeScore(monthlySearchVolume: number): number {
  if (monthlySearchVolume >= 100001) return 10    // 超大流量
  if (monthlySearchVolume >= 10001) return 7.5    // 大流量
  if (monthlySearchVolume >= 1001) return 5       // 中流量
  if (monthlySearchVolume >= 100) return 2.5      // 小流量
  return 0                                        // 微小流量或无数据
}
```

### 区分度分析

**对数分布**：搜索量通常呈指数级分布，分级采用对数刻度能更好体现差异

| 流量级别 | 数量级 | 分数差异 | 区分度 |
|---------|--------|---------|--------|
| 微小→小 | 10² | 2.5分 | ★★★ 显著 |
| 小→中 | 10³ | 2.5分 | ★★★ 显著 |
| 中→大 | 10⁴ | 2.5分 | ★★★ 显著 |
| 大→超大 | 10⁵+ | 2.5分 | ★★★ 显著 |

---

## 数据获取方式

### 方案1：Google Ads Keyword Planner API（推荐）

```typescript
import { getKeywordSearchVolume } from '@/lib/google-ads-keyword-planner'

// 获取品牌词搜索量
const brandKeyword = offer.brand  // 如 "BAGSMART"
const searchVolumeData = await getKeywordSearchVolume({
  keywords: [brandKeyword],
  targetCountry: offer.target_country,  // 如 "US"
  targetLanguage: offer.target_language || 'en'
})

const monthlySearchVolume = searchVolumeData[0]?.monthlySearches || 0
const brandScore = calculateBrandSearchVolumeScore(monthlySearchVolume)
```

### 方案2：缓存优化（建议）

```typescript
// 品牌搜索量缓存（避免重复API调用）
const cacheKey = `brand_volume:${brandKeyword}:${targetCountry}`
const cachedVolume = await redis.get(cacheKey)

if (cachedVolume) {
  return parseInt(cachedVolume, 10)
}

const volume = await fetchFromKeywordPlanner()
await redis.setex(cacheKey, 86400 * 7, volume) // 缓存7天
return volume
```

---

## 实现细节

### 数据结构

```typescript
export interface AdStrengthEvaluation {
  overallScore: number // 0-110 (新总分)
  rating: AdStrengthRating

  dimensions: {
    // ... 现有5个维度
    brandSearchVolume: {
      score: number // 0-10
      weight: 0.091 // 10/110
      details: {
        monthlySearchVolume: number // 原始搜索量
        volumeLevel: 'micro' | 'small' | 'medium' | 'large' | 'xlarge'
        dataSource: 'keyword_planner' | 'cached' | 'estimated'
      }
    }
  }
}
```

### 评级标准调整

| 评级 | 旧标准 (100分) | 新标准 (110分) | 说明 |
|------|--------------|--------------|------|
| EXCELLENT | ≥ 85 | ≥ 94 | 保持85%比例 |
| GOOD | 70-84 | 77-93 | 保持70-85%比例 |
| AVERAGE | 50-69 | 55-76 | 保持50-70%比例 |
| POOR | < 50 | < 55 | 低于50% |

或者保持原有阈值：
- EXCELLENT: ≥ 85分（占110分的77%，更容易达到）
- GOOD: 70-84分
- AVERAGE: 50-69分
- POOR: < 50分

**建议：保持原有阈值**，这样新增维度会让分数普遍提升，更符合"改进"的预期。

---

## 实现步骤

### 1. 修改评估器 (ad-strength-evaluator.ts)

- [ ] 增加 `brandSearchVolume` 维度定义
- [ ] 实现 `evaluateBrandSearchVolume()` 函数
- [ ] 更新 `evaluateCreativeAdStrength()` 整合新维度
- [ ] 调整总分计算逻辑（110分制）

### 2. 更新雷达图组件 (ScoreRadarChart.tsx)

- [ ] 支持6个维度显示
- [ ] 更新maxValues映射
- [ ] 调整雷达图布局（6边形）

### 3. 更新数据库Schema

现有 `score_breakdown` 是JSON字段，自动兼容新字段：

```json
{
  "diversity": 25,
  "relevance": 25,
  "completeness": 20,
  "quality": 20,
  "compliance": 10,
  "brandSearchVolume": 7.5  // 新增
}
```

**无需迁移脚本**，JSON字段自动支持。

### 4. 更新API响应

- [ ] generate-creatives API返回新维度
- [ ] generate-ad-creative API返回新维度
- [ ] 前端组件读取新维度数据

### 5. 测试验证

- [ ] 单元测试：各流量级别评分
- [ ] 集成测试：完整创意生成流程
- [ ] E2E测试：前端雷达图显示

---

## 示例数据

### BAGSMART品牌（假设）

```typescript
// 输入
const brand = "BAGSMART"
const targetCountry = "US"

// API返回
const searchVolume = 27300  // 月均搜索量

// 计算
const level = "large"        // 10,001-100,000
const score = 7.5           // 大流量档位

// 最终评分
{
  brandSearchVolume: {
    score: 7.5,
    weight: 0.091,
    details: {
      monthlySearchVolume: 27300,
      volumeLevel: "large",
      dataSource: "keyword_planner"
    }
  }
}
```

### Nike品牌（假设）

```typescript
const brand = "Nike"
const searchVolume = 2740000  // 超大流量

const level = "xlarge"
const score = 10             // 满分

// 总分示例
{
  overallScore: 107,  // 97 (其他维度) + 10 (品牌)
  rating: "EXCELLENT"
}
```

---

## 优势分析

### 对广告主的价值

1. **品牌认知度量化**：客观评估品牌在市场的影响力
2. **竞争力分析**：与竞品品牌搜索量对比
3. **增长追踪**：监控品牌搜索量随时间变化

### 对评分系统的优化

1. **更全面的质量评估**：品牌力是广告效果的重要因素
2. **区分度提升**：知名品牌vs新品牌有明显差异
3. **激励品牌建设**：鼓励广告主重视品牌长期价值

---

## 注意事项

### 1. 数据可用性

- 并非所有品牌都能获取搜索量数据
- 新品牌或本地品牌可能搜索量为0
- **降级策略**：无数据时给予基准分（如2.5分）

### 2. API成本

- Keyword Planner API有配额限制
- **优化方案**：
  - 缓存搜索量数据（7天）
  - 批量查询多个品牌
  - 仅在创意生成时查询，不实时刷新

### 3. 跨国差异

- 同一品牌在不同国家搜索量差异巨大
- **解决方案**：基于 `target_country` 查询
- 示例：Nike在US vs Nike在某小国

### 4. 品牌名称歧义

- 品牌名可能与通用词重复（如"Apple"）
- **解决方案**：结合品牌描述优化查询
- 示例：`"Apple" + "company"` 而非仅 `"Apple"`

---

## 后续优化（可选）

### P1 - 趋势分析

```typescript
brandSearchVolume: {
  score: 7.5,
  trend: "+15%",  // 相比上月增长
  historicalData: [25000, 26000, 27300]  // 最近3个月
}
```

### P2 - 竞品对比

```typescript
brandSearchVolume: {
  score: 7.5,
  competitorComparison: {
    rank: 3,
    totalCompetitors: 10,
    marketShare: "12%"
  }
}
```

### P3 - 区域细分

```typescript
brandSearchVolume: {
  score: 7.5,
  byRegion: {
    "California": 8500,
    "New York": 7200,
    "Texas": 4100
  }
}
```

---

**设计完成时间**: 2025-11-22
**设计者**: Claude Code
**状态**: ✅ 设计完成，待实施
