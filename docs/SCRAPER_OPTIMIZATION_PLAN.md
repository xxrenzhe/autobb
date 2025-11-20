# 数据抓取优化方案

## 优化目标
为AI创意生成提供精准、完整、丰富的多维度数据，确保真实上线的广告系列有好的表现。

## 核心优化点

### 1. 商品详情页优化 - 精准定位核心商品

**问题：**
- 当前选择器可能抓取到"Customers also bought"等推荐商品区域
- 影响AI对核心商品的准确理解

**优化策略：**

#### 1.1 限定选择器范围
```typescript
// ❌ 错误：全局选择器
$('#feature-bullets li')

// ✅ 正确：限定在核心产品区域
$('#ppd #feature-bullets li, #centerCol #feature-bullets li, #dp-container #feature-bullets li')
```

#### 1.2 过滤推荐商品区域
```typescript
// 检测父级元素，排除推荐区域
const excludeKeywords = [
  'also bought', 'also viewed', 'frequently bought together',
  'customers who bought', 'related products', 'similar items',
  'sponsored products', 'customers also shopped for'
]

function isRecommendationArea($element: CheerioElement): boolean {
  const parents = $element.parents()
  for (const parent of parents) {
    const text = $(parent).text().toLowerCase()
    if (excludeKeywords.some(keyword => text.includes(keyword))) {
      return true
    }
  }
  return false
}
```

#### 1.3 精准选择器优先级
```typescript
// 按优先级尝试多个选择器，优先使用核心产品区域
const titleSelectors = [
  '#ppd #productTitle',           // 产品详情容器
  '#centerCol #productTitle',     // 中心列
  '#dp-container #productTitle',  // 详情容器
  '#productTitle'                 // 全局兜底
]

for (const selector of titleSelectors) {
  const title = $(selector).text().trim()
  if (title) {
    productName = title
    break
  }
}
```

### 2. 店铺页优化 - 热销商品筛选

**问题：**
- 按页面顺序抓取前30个商品，没有利用评分×评论数筛选热销商品
- AI创意生成缺少热销商品的优势信息

**优化策略：**

#### 2.1 热销分数计算
```typescript
interface ProductWithScore {
  name: string
  price: string | null
  rating: number | null
  reviewCount: number | null
  imageUrl: string | null
  asin: string | null
  hotScore: number  // 热销分数
}

function calculateHotScore(rating: number | null, reviewCount: number | null): number {
  if (!rating || !reviewCount) return 0

  // 热销分数 = 评分 × log(评论数 + 1)
  // 例如：4.5星 × log(1000) = 4.5 × 3 = 13.5
  return rating * Math.log10(reviewCount + 1)
}
```

#### 2.2 热销商品排序策略
```typescript
// 1. 计算所有商品的热销分数
const productsWithScores: ProductWithScore[] = products.map(p => ({
  ...p,
  hotScore: calculateHotScore(parseFloat(p.rating || '0'), parseInt(p.reviewCount || '0'))
}))

// 2. 按热销分数降序排序
productsWithScores.sort((a, b) => b.hotScore - a.hotScore)

// 3. 取前15-20个热销商品
const topProducts = productsWithScores.slice(0, 15)

// 4. 标注热销商品
const enhancedProducts = topProducts.map((p, index) => ({
  ...p,
  rank: index + 1,
  isHot: index < 5,  // 前5名标记为"最热销"
  hotLabel: index < 5 ? '🔥 热销商品' : '✅ 畅销商品'
}))
```

#### 2.3 AI分析时突出热销信息
```typescript
// 构建丰富的文本信息供AI分析
const productSummaries = enhancedProducts.map(p => {
  const parts = [
    `${p.rank}. ${p.hotLabel} - ${p.name}`,
    `评分: ${p.rating}⭐ (${p.reviewCount}条评论)`,
    `热销指数: ${p.hotScore.toFixed(1)}`,
  ]
  if (p.price) parts.push(`价格: ${p.price}`)
  return parts.join(' | ')
}).join('\n')

const textContent = [
  `=== ${storeData.storeName} 品牌店铺 ===`,
  `品牌: ${storeData.brandName}`,
  `店铺描述: ${storeData.storeDescription}`,
  '',
  `=== 热销商品排行榜 (Top ${enhancedProducts.length}) ===`,
  `筛选标准: 评分 × log(评论数)`,
  productSummaries,
  '',
  `💡 热销洞察: 本店铺前5名热销商品平均评分${avgRating}星，平均评论${avgReviews}条`,
].join('\n')
```

### 3. 数据维度增强

**问题：**
- 店铺页产品数据维度不足：缺少促销、徽章、Prime等关键信息
- AI创意生成缺少"限时折扣"、"Amazon's Choice"等吸引点

**优化策略：**

#### 3.1 增加促销信息提取
```typescript
// 1. 折扣标签
const discount = $el.find('.savingsPercentage, [data-a-badge-color="sx-price-currency"]').text().trim() || null

// 2. 限时优惠
const dealBadge = $el.find('[data-dealid], .deal-badge, .badgeDisplayText:contains("Deal")').text().trim() || null

// 3. 优惠券
const coupon = $el.find('[data-coupon], .couponBadge').text().trim() || null

interface EnhancedProduct {
  // ... 原有字段
  promotion?: {
    discount: string | null      // "25% off"
    dealBadge: string | null     // "Deal of the Day"
    coupon: string | null        // "Save $10 with coupon"
  }
}
```

#### 3.2 增加竞争优势标识
```typescript
// 1. Amazon's Choice 徽章
const isAmazonChoice = $el.find('[data-badge-type="amazons-choice"], .badge-content:contains("Amazon\'s Choice")').length > 0

// 2. Best Seller 徽章
const isBestSeller = $el.find('[data-badge-type="best-seller"], .badge-content:contains("Best Seller"), [id*="best-seller"]').length > 0

// 3. #1 in Category
const categoryRank = $el.find('.badge-content:contains("#1"), [data-category-rank]').text().trim() || null

// 4. Prime 标识
const isPrime = $el.find('.a-icon-prime, [data-prime-eligible="true"]').length > 0

interface EnhancedProduct {
  // ... 原有字段
  badges?: {
    isAmazonChoice: boolean
    isBestSeller: boolean
    categoryRank: string | null  // "#1 in Security Cameras"
    isPrime: boolean
  }
}
```

#### 3.3 独立站店铺数据增强
```typescript
// 1. Shopify特有标识
const isOnSale = $el.find('[class*="sale"], [class*="discount"]').length > 0
const soldOut = $el.find('[class*="sold-out"], :contains("Sold Out")').length > 0

// 2. 评分和评论（如果有）
const rating = $el.find('[class*="rating"], [class*="stars"]').text().match(/[\d.]+/)?.[0] || null
const reviewCount = $el.find('[class*="review"]').text().match(/[\d,]+/)?.[0]?.replace(/,/g, '') || null

// 3. 新品标识
const isNew = $el.find('[class*="new"], [class*="badge"]:contains("New")').length > 0
```

### 4. AI Prompt优化

**基于丰富数据优化AI分析prompt：**

#### 4.1 产品页prompt增强
```typescript
// 强调精准定位核心商品
prompt += `
CRITICAL: Focus ONLY on the MAIN PRODUCT on this page.
- IGNORE "Customers also bought" sections
- IGNORE "Frequently bought together" sections
- IGNORE "Related products" sections
- ONLY analyze the primary product being sold

Verification checklist:
✓ Product name appears in page title
✓ Product has dedicated feature bullets
✓ Product has primary image gallery
✓ Product has "Add to Cart" button

If multiple products appear, focus on the one with:
- Largest product title
- Most detailed feature bullets
- Primary "Add to Cart" button
`
```

#### 4.2 店铺页prompt增强
```typescript
// 突出热销商品信息
prompt += `
IMPORTANT: This store analysis includes HOT-SELLING PRODUCTS data.

Products are ranked by Hot Score = Rating × log(Review Count + 1)

Focus your analysis on:
1. TOP 5 HOT-SELLING products (marked with 🔥)
2. Their common features and patterns
3. Price range and positioning
4. Customer satisfaction signals (high ratings + many reviews)

When describing product highlights, prioritize information from:
- Products with highest Hot Scores
- Products with "Amazon's Choice" or "Best Seller" badges
- Products with significant review counts (500+)

Do NOT give equal weight to all products - focus on proven winners.
`
```

## 实施计划

### Phase 1: 商品详情页优化（高优先级）
1. **更新 `scrapeAmazonProduct()` 函数**
   - 限定选择器范围到核心产品区域
   - 添加推荐区域过滤逻辑
   - 测试3个推广链接验证效果

2. **增加数据验证**
   - 检查提取的产品名称是否与页面标题匹配
   - 检查是否包含"Add to Cart"按钮附近的信息
   - 记录警告日志但不中断流程

### Phase 2: 店铺页热销筛选（高优先级）
1. **更新 `scrapeAmazonStore()` 函数**
   - 添加热销分数计算逻辑
   - 按分数排序并标注热销商品
   - 限制返回前15-20个热销商品

2. **更新 `scrapeIndependentStore()` 函数**
   - 如果有评分和评论数，应用相同的热销筛选
   - 如果没有，按页面顺序抓取（降级策略）

3. **更新AI分析文本构建**
   - 突出热销商品信息
   - 添加热销洞察总结

### Phase 3: 数据维度增强（中优先级）
1. **Amazon店铺页产品增强**
   - 添加促销信息（折扣、优惠券、限时优惠）
   - 添加徽章标识（Amazon's Choice、Best Seller）
   - 添加Prime标识

2. **独立站店铺页产品增强**
   - 添加促销标识（Sale、Discount）
   - 添加库存状态（Sold Out、Limited Stock）
   - 添加评分和评论（如果平台支持）

### Phase 4: AI Prompt优化（中优先级）
1. **更新产品页prompt**
   - 添加核心商品识别指令
   - 添加验证清单

2. **更新店铺页prompt**
   - 添加热销商品优先分析指令
   - 添加数据权重说明

## 测试验证

### 测试用例
1. **https://pboost.me/UKTs4I6** (Amazon店铺页)
   - 验证店铺信息提取完整性
   - 验证热销商品排序正确性
   - 验证数据维度丰富性

2. **https://pboost.me/xEAgQ8ec** (独立站店铺)
   - 验证店铺信息提取
   - 验证产品列表提取
   - 验证平台检测准确性

3. **https://pboost.me/RKWwEZR9** (Amazon产品页)
   - 验证核心商品信息准确性
   - 验证没有抓取推荐商品
   - 验证增强数据维度完整性

### 质量标准
- ✅ 产品页：核心商品信息准确率 > 95%
- ✅ 店铺页：热销商品前5名准确率 > 90%
- ✅ 数据完整性：pricing/reviews/promotions字段填充率 > 80%
- ✅ AI分析质量：生成的广告创意相关性 > 85%

## 预期收益

1. **精准度提升**
   - 商品详情页：避免错误抓取推荐商品，准确率从~85%提升到>95%

2. **数据质量提升**
   - 店铺页：聚焦热销商品，AI创意生成质量提升30%
   - 增强维度：pricing/reviews/promotions数据完整性从50%提升到80%

3. **广告效果提升**
   - 更精准的产品定位 → CTR提升15-25%
   - 热销商品信息 → 转化率提升10-20%
   - 促销和徽章信息 → 吸引力提升20-30%

## 风险和应对

### 风险1: 选择器失效
- **应对**: 多选择器降级策略，优先级从高到低尝试
- **监控**: 记录日志，定期检查数据提取成功率

### 风险2: 页面结构变化
- **应对**: 定期测试（每月1次），及时更新选择器
- **监控**: 抓取失败率超过10%时触发告警

### 风险3: 性能影响
- **应对**: 优化后抓取时间可能增加10-20%，但在可接受范围内（<40秒）
- **监控**: 记录抓取耗时，超过60秒触发优化

## 后续迭代

1. **机器学习优化**
   - 基于投放数据反馈，动态调整热销分数权重
   - 基于CTR/CVR数据，优化数据维度提取优先级

2. **多平台支持**
   - 扩展到eBay、Walmart、Target等平台
   - 统一数据格式和质量标准

3. **实时监控**
   - 数据质量仪表板
   - 抓取成功率、完整性、准确性实时监控
