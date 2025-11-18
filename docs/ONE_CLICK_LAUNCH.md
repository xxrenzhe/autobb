# 一键上广告流程设计

**文档版本**: v1.0
**创建日期**: 2025-01-18
**设计原则**: 自动化优先 + 数据驱动

---

## 📋 功能概述

### 核心理念

**将已创建的Offer自动转化为Google Ads上的真实Campaign**

用户只需点击一个按钮，系统自动完成：
- ✅ AI抓取产品信息（从shop_url）
- ✅ AI生成10-15个关键词
- ✅ AI生成广告创意（15条Headlines + 4条Descriptions）
- ✅ 智能设置预算和出价
- ✅ 调用Google Ads API创建Campaign、AdGroup、Ads、Keywords
- ✅ 自动关联Assets（Callouts、Sitelinks、Business Name）

### 业务价值

| 传统方式 | 一键上广告 | 节省时间 |
|---------|-----------|---------|
| 手动研究产品（15分钟） | AI自动抓取（10秒） | ↓ 95% |
| 手动研究关键词（30分钟） | AI生成+验证（20秒） | ↓ 97% |
| 手动撰写广告文案（20分钟） | AI生成创意（15秒） | ↓ 98% |
| 手动创建Campaign（15分钟） | API自动创建（5秒） | ↓ 97% |
| **总计: 80分钟** | **总计: 50秒** | **↓ 99%** |

---

## 一、完整流程概览

### 1.1 10步骤流程

```
用户选择一个或多个Offer → 点击"一键上广告"
  ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 1: 验证前置条件                                         │
│ • 检查Offer状态（必须为not_launched）                       │
│ • 检查Google Ads账号授权                                     │
│ • 检查shop_url有效性                                         │
└─────────────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 2: AI抓取产品信息                                       │
│ • 配置代理访问shop_url                                       │
│ • Playwright渲染页面                                         │
│ • AI提取：product_name, product_description, category       │
│ • 更新Offer表字段                                            │
└─────────────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 3: AI生成关键词                                         │
│ • AI基于产品信息生成10-15个关键词                           │
│ • 调用Google Ads Keyword Planner API验证搜索量             │
│ • 过滤低搜索量关键词（< 100/月）                            │
│ • 智能分配匹配类型（EXACT/PHRASE/BROAD）                    │
└─────────────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 4: 自动设置预算和出价                                   │
│ • 获取关键词建议CPC范围                                      │
│ • 计算平均建议CPC                                            │
│ • 设置target_cpc = 平均建议CPC                              │
│ • 设置budget_daily = target_cpc × 30次点击                 │
└─────────────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 5: AI生成广告创意                                       │
│ • 生成15条Headlines（基于产品名称、品牌、卖点）             │
│ • 生成4条Descriptions（基于产品描述、特性）                 │
│ • 生成3-4条Callouts（关键特性）                             │
│ • 生成3-4条Sitelinks（产品类别页面）                        │
└─────────────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 6: 创建Campaign Budget                                 │
│ • 调用CampaignBudgetService.create()                        │
│ • amount_micros = budget_daily × 1,000,000                  │
│ • delivery_method = "STANDARD"                              │
└─────────────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 7: 创建Campaign                                         │
│ • 调用CampaignService.create()                              │
│ • name = offer_name + " Campaign"                           │
│ • campaign_budget = Step 6的Budget ResourceName            │
│ • advertising_channel_type = "SEARCH"                       │
│ • bidding_strategy = MaximizeConversions                    │
│ • geo_target = target_country对应的location_id             │
│ • language = target_language对应的language_id              │
│ • status = "PAUSED"（初始暂停，等待用户确认）               │
└─────────────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 8: 创建AdGroup                                          │
│ • 调用AdGroupService.create()                               │
│ • name = offer_name + " AdGroup"                            │
│ • campaign = Step 7的Campaign ResourceName                 │
│ • status = "ENABLED"                                         │
└─────────────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 9: 创建RSA Ad + Keywords + Assets                      │
│ • 调用AdGroupAdService.create()（创建RSA）                  │
│   - 15条Headlines                                           │
│   - 4条Descriptions                                         │
│   - final_urls = [affiliate_link]                          │
│ • 调用AdGroupCriterionService.create()（添加关键词）        │
│   - 逐个添加关键词，设置match_type和cpc_bid_micros         │
│ • 创建Assets并关联到Campaign                                │
│   - Business Name Asset                                     │
│   - Callout Assets                                          │
│   - Sitelink Assets                                         │
└─────────────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 10: 更新Offer状态并返回结果                             │
│ • 更新Offer.ad_status = 'active'（或'paused'如果初始暂停）  │
│ • 保存google_campaign_id到数据库                            │
│ • 返回创建结果给前端                                         │
└─────────────────────────────────────────────────────────────┘
  ↓
前端显示创建结果页面
```

---

## 二、Step 2: AI抓取产品信息

### 2.1 抓取流程

**API端点**: `POST /api/offers/scrape-product-info`

**Request Body**:
```json
{
  "offer_id": 1,
  "shop_url": "https://www.amazon.com/stores/page/201E3A4F-C63F-48A6-87B7-524F985330DA",
  "target_country": "US",
  "target_language": "English"
}
```

**技术实现**:
```typescript
import { chromium } from 'playwright';

async function scrapeProductInfo(
  shopUrl: string,
  targetCountry: string,
  targetLanguage: string
): Promise<ProductInfo> {

  // 1. 配置代理（根据目标国家选择代理服务器）
  const proxy = getProxyForCountry(targetCountry);

  // 2. 启动Playwright浏览器
  const browser = await chromium.launch({
    proxy: {
      server: proxy.server,
      username: proxy.username,
      password: proxy.password
    },
    headless: true
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    locale: getLocaleCode(targetCountry), // 'en-US', 'de-DE', etc.
    geolocation: getGeolocation(targetCountry),
    permissions: []
  });

  const page = await context.newPage();

  try {
    // 3. 访问shop_url
    await page.goto(shopUrl, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // 4. 等待页面加载关键元素
    await page.waitForSelector('body', { timeout: 10000 });

    // 5. 提取页面HTML
    const html = await page.content();

    // 6. 截图（用于调试）
    const screenshot = await page.screenshot({
      fullPage: false,
      type: 'png'
    });

    // 7. 使用AI提取产品信息
    const productInfo = await extractProductInfoWithAI(html, targetLanguage);

    return productInfo;

  } finally {
    await browser.close();
  }
}

// AI提取产品信息
async function extractProductInfoWithAI(
  html: string,
  targetLanguage: string
): Promise<ProductInfo> {

  const prompt = `
Extract product information from the following HTML content.
Target Language: ${targetLanguage}

HTML Content:
${html.substring(0, 50000)} // 限制长度避免token超限

Please extract and return ONLY a JSON object with the following fields:
{
  "product_name": "The main product name (max 100 characters)",
  "product_description": "A comprehensive product description (100-300 characters)",
  "category": "Product category path (e.g., 'Electronics > Security Cameras')",
  "key_features": ["Feature 1", "Feature 2", "Feature 3"],
  "selling_points": ["Point 1", "Point 2", "Point 3"]
}

Rules:
1. If multiple products are shown, extract information for the main/featured product
2. Focus on factual product information, not marketing fluff
3. Use ${targetLanguage} language for all extracted content
4. Keep product_name concise and descriptive
5. Return ONLY valid JSON, no additional text

JSON:
  `;

  const response = await callOpenAI(prompt, {
    model: 'gpt-4o',
    temperature: 0.3,
    max_tokens: 1000
  });

  // 解析JSON
  const productInfo = JSON.parse(response);

  // 验证必填字段
  if (!productInfo.product_name || !productInfo.product_description) {
    throw new Error('AI failed to extract required product information');
  }

  return productInfo;
}
```

**Response (Success)**:
```json
{
  "success": true,
  "data": {
    "product_name": "Reolink 8CH 5MP PoE Security Camera System",
    "product_description": "Complete home security solution with 4 weatherproof cameras, 2TB NVR, night vision, and mobile app access for 24/7 monitoring",
    "category": "Electronics > Security & Surveillance > Security Camera Systems",
    "key_features": [
      "5MP Super HD Resolution",
      "PoE Power & Connectivity",
      "2TB Hard Drive Included",
      "100ft Night Vision",
      "AI Motion Detection"
    ],
    "selling_points": [
      "Easy plug-and-play installation",
      "24/7 continuous recording",
      "Free mobile app remote viewing",
      "Weatherproof outdoor cameras"
    ]
  }
}
```

**错误处理**:
```typescript
// 抓取失败的降级方案
if (scrapeError) {
  // 方案1: 使用品牌名称作为产品名称
  product_name = offer.brand_name + " Product";
  product_description = "请在Google Ads后台手动补充产品描述";

  // 方案2: 允许用户手动输入
  return {
    success: false,
    error: '产品信息抓取失败',
    fallback_needed: true,
    message: '请手动输入产品信息以继续创建广告'
  };
}
```

---

## 三、Step 3: AI生成关键词

### 3.1 关键词生成流程

```typescript
async function generateKeywords(
  productName: string,
  productDescription: string,
  brandName: string,
  category: string,
  targetCountry: string
): Promise<KeywordWithMetrics[]> {

  // 1. AI生成候选关键词
  const candidateKeywords = await generateCandidateKeywords(
    productName,
    productDescription,
    brandName,
    category,
    targetCountry
  );

  // 2. 调用Google Ads Keyword Planner API验证
  const keywordMetrics = await getKeywordMetrics(
    candidateKeywords,
    targetCountry
  );

  // 3. 过滤和排序
  const validKeywords = keywordMetrics
    .filter(kw => kw.avg_monthly_searches >= 100) // 月搜索量 ≥ 100
    .sort((a, b) => b.avg_monthly_searches - a.avg_monthly_searches) // 按搜索量降序
    .slice(0, 15); // 最多取15个

  // 4. 智能分配匹配类型
  const keywordsWithMatchType = assignMatchTypes(validKeywords, brandName);

  return keywordsWithMatchType;
}

// AI生成候选关键词
async function generateCandidateKeywords(
  productName: string,
  productDescription: string,
  brandName: string,
  category: string,
  targetCountry: string
): Promise<string[]> {

  const prompt = `
Generate 20 high-quality Google Ads keywords for the following product.

Product Information:
- Product Name: ${productName}
- Brand: ${brandName}
- Category: ${category}
- Description: ${productDescription}
- Target Country: ${targetCountry}

Requirements:
1. Include brand keywords (e.g., "reolink security camera")
2. Include product category keywords (e.g., "poe security camera system")
3. Include benefit/feature keywords (e.g., "outdoor camera with night vision")
4. Include long-tail keywords (e.g., "wireless security camera system for home")
5. Focus on commercial intent (buyers, not researchers)
6. Use language appropriate for ${targetCountry}
7. Avoid overly generic keywords

Return ONLY a JSON array of keyword strings:
["keyword 1", "keyword 2", ...]

JSON:
  `;

  const response = await callOpenAI(prompt, {
    model: 'gpt-4o',
    temperature: 0.5,
    max_tokens: 500
  });

  const keywords = JSON.parse(response);
  return keywords;
}

// 调用Google Ads Keyword Planner API
async function getKeywordMetrics(
  keywords: string[],
  targetCountry: string
): Promise<KeywordMetrics[]> {

  const locationId = getLocationIdByCountry(targetCountry); // US: 2840, GE: 2276
  const languageId = getLanguageIdByCountry(targetCountry); // US: 1000 (English)

  const request = {
    keywords: keywords,
    geo_target_constants: [`geoTargetConstants/${locationId}`],
    language: `languageConstants/${languageId}`,
    keyword_plan_network: 'GOOGLE_SEARCH'
  };

  const response = await googleAdsClient.keywordPlanIdeas.generateKeywordIdeas(
    customerId,
    request
  );

  return response.results.map(result => ({
    keyword: result.text,
    avg_monthly_searches: result.keyword_idea_metrics.avg_monthly_searches,
    competition: result.keyword_idea_metrics.competition, // LOW | MEDIUM | HIGH
    low_top_of_page_bid_micros: result.keyword_idea_metrics.low_top_of_page_bid_micros,
    high_top_of_page_bid_micros: result.keyword_idea_metrics.high_top_of_page_bid_micros
  }));
}

// 智能分配匹配类型
function assignMatchTypes(
  keywords: KeywordWithMetrics[],
  brandName: string
): KeywordWithMatchType[] {

  return keywords.map(kw => {
    // 规则1: 包含品牌名 → EXACT（精确匹配）
    if (kw.keyword.toLowerCase().includes(brandName.toLowerCase())) {
      return { ...kw, match_type: 'EXACT' };
    }

    // 规则2: 2-3个词的短语 → PHRASE（词组匹配）
    const wordCount = kw.keyword.split(' ').length;
    if (wordCount >= 2 && wordCount <= 3) {
      return { ...kw, match_type: 'PHRASE' };
    }

    // 规则3: ≥4个词的长尾词 → BROAD（广泛匹配）
    if (wordCount >= 4) {
      return { ...kw, match_type: 'BROAD' };
    }

    // 默认: PHRASE
    return { ...kw, match_type: 'PHRASE' };
  });
}
```

**示例输出**:
```json
{
  "keywords": [
    {
      "keyword": "reolink security camera",
      "match_type": "EXACT",
      "avg_monthly_searches": 8100,
      "competition": "MEDIUM",
      "suggested_cpc_micros": 1500000
    },
    {
      "keyword": "poe security camera system",
      "match_type": "PHRASE",
      "avg_monthly_searches": 5400,
      "competition": "HIGH",
      "suggested_cpc_micros": 2100000
    },
    {
      "keyword": "outdoor security camera with night vision",
      "match_type": "BROAD",
      "avg_monthly_searches": 3600,
      "competition": "MEDIUM",
      "suggested_cpc_micros": 1800000
    }
  ]
}
```

---

## 四、Step 4: 自动设置预算和出价

### 4.1 智能预算计算

```typescript
async function calculateBudgetAndCPC(
  keywords: KeywordWithMetrics[]
): Promise<BudgetSettings> {

  // 1. 计算平均建议CPC
  const avgSuggestedCPC = keywords.reduce((sum, kw) => {
    const midCPC = (kw.low_top_of_page_bid_micros + kw.high_top_of_page_bid_micros) / 2;
    return sum + (midCPC / 1_000_000); // 转换为美元
  }, 0) / keywords.length;

  // 2. 设置目标CPC（向上取整到0.1美元）
  const targetCPC = Math.ceil(avgSuggestedCPC * 10) / 10;

  // 3. 计算每日预算（目标CPC × 30次点击）
  const budgetDaily = Math.round(targetCPC * 30);

  // 4. 应用预算限制（最低$10，最高$500）
  const finalBudget = Math.max(10, Math.min(500, budgetDaily));

  return {
    budget_daily: finalBudget,
    target_cpc: targetCPC,
    estimated_daily_clicks: Math.floor(finalBudget / targetCPC),
    calculation_basis: {
      keyword_count: keywords.length,
      avg_suggested_cpc: avgSuggestedCPC,
      cpc_range: {
        min: Math.min(...keywords.map(k => k.low_top_of_page_bid_micros / 1_000_000)),
        max: Math.max(...keywords.map(k => k.high_top_of_page_bid_micros / 1_000_000))
      }
    }
  };
}
```

**示例输出**:
```json
{
  "budget_daily": 45,
  "target_cpc": 1.5,
  "estimated_daily_clicks": 30,
  "calculation_basis": {
    "keyword_count": 15,
    "avg_suggested_cpc": 1.47,
    "cpc_range": {
      "min": 0.8,
      "max": 2.3
    }
  }
}
```

---

## 五、Step 5: AI生成广告创意

### 5.1 RSA创意生成

**要求**:
- 15条Headlines（每条 ≤ 30字符）
- 4条Descriptions（每条 ≤ 90字符）
- 包含品牌名、产品名、关键卖点

```typescript
async function generateAdCreatives(
  productName: string,
  productDescription: string,
  brandName: string,
  keyFeatures: string[],
  sellingPoints: string[],
  targetLanguage: string
): Promise<AdCreatives> {

  const prompt = `
Generate Google Ads RSA (Responsive Search Ad) creatives for the following product.

Product Information:
- Product Name: ${productName}
- Brand: ${brandName}
- Description: ${productDescription}
- Key Features: ${keyFeatures.join(', ')}
- Selling Points: ${sellingPoints.join(', ')}
- Language: ${targetLanguage}

Requirements:

1. Generate 15 unique Headlines:
   - Each headline MUST be ≤ 30 characters (STRICT LIMIT)
   - At least 3 headlines must include the brand name "${brandName}"
   - At least 5 headlines must focus on product features/benefits
   - At least 3 headlines must include call-to-action (e.g., "Buy Now", "Shop Today")
   - At least 2 headlines must mention price/value (e.g., "Best Price", "Free Shipping")
   - Use ${targetLanguage} language
   - Be compelling and action-oriented

2. Generate 4 unique Descriptions:
   - Each description MUST be ≤ 90 characters (STRICT LIMIT)
   - Description 1: Focus on main product benefit
   - Description 2: Focus on key features
   - Description 3: Focus on trust/credibility (e.g., reviews, warranty)
   - Description 4: Focus on call-to-action and urgency
   - Use ${targetLanguage} language

3. Generate 4 Callouts (short phrases):
   - Each callout ≤ 25 characters
   - Highlight key features or benefits

4. Generate 4 Sitelinks:
   - Each sitelink has a title (≤ 25 characters) and description (≤ 35 characters)
   - Link to different product categories or pages

Return ONLY a JSON object with this structure:
{
  "headlines": ["headline 1", "headline 2", ...],
  "descriptions": ["description 1", "description 2", ...],
  "callouts": ["callout 1", "callout 2", ...],
  "sitelinks": [
    {"title": "link title", "description": "link description"},
    ...
  ]
}

CRITICAL: Strictly enforce character limits. Any headline > 30 chars or description > 90 chars will cause API errors.

JSON:
  `;

  const response = await callOpenAI(prompt, {
    model: 'gpt-4o',
    temperature: 0.7,
    max_tokens: 2000
  });

  const creatives = JSON.parse(response);

  // 验证字符限制
  creatives.headlines = creatives.headlines
    .map(h => h.substring(0, 30))
    .slice(0, 15);

  creatives.descriptions = creatives.descriptions
    .map(d => d.substring(0, 90))
    .slice(0, 4);

  creatives.callouts = creatives.callouts
    .map(c => c.substring(0, 25))
    .slice(0, 4);

  creatives.sitelinks = creatives.sitelinks
    .map(s => ({
      title: s.title.substring(0, 25),
      description: s.description.substring(0, 35)
    }))
    .slice(0, 4);

  return creatives;
}
```

**示例输出**:
```json
{
  "headlines": [
    "Reolink Security Cameras",
    "5MP HD PoE Camera System",
    "24/7 Home Protection",
    "Shop Reolink Today",
    "Free Shipping Available",
    "2TB Storage Included",
    "Night Vision Up To 100ft",
    "Easy Installation",
    "Best Price Guaranteed",
    "AI Motion Detection",
    "Weatherproof Outdoor Cams",
    "Remote Mobile App Access",
    "Buy Now & Save",
    "Trusted by 1M+ Users",
    "Premium Security Solution"
  ],
  "descriptions": [
    "Get complete home security with 4 HD cameras, 2TB NVR, and 24/7 recording.",
    "Features 5MP resolution, PoE power, night vision, and AI motion detection.",
    "Rated 4.5 stars by 50,000+ customers. 2-year warranty included.",
    "Shop now for the best price. Free shipping on orders over $100. Limited time!"
  ],
  "callouts": [
    "Free 2-Year Warranty",
    "24/7 Customer Support",
    "Easy Setup in Minutes",
    "Mobile App Included"
  ],
  "sitelinks": [
    {
      "title": "Indoor Cameras",
      "description": "Browse our indoor camera models"
    },
    {
      "title": "Outdoor Cameras",
      "description": "Weatherproof outdoor solutions"
    },
    {
      "title": "NVR Systems",
      "title": "Complete NVR recording systems"
    },
    {
      "title": "Accessories",
      "description": "Cables, mounts, and more"
    }
  ]
}
```

---

## 六、Step 6-9: 调用Google Ads API创建Campaign

### 6.1 完整API调用流程

```typescript
async function createGoogleAdsCampaign(
  offer: Offer,
  keywords: KeywordWithMatchType[],
  creatives: AdCreatives,
  budgetSettings: BudgetSettings,
  googleAdsAccountId: string,
  refreshToken: string
): Promise<CampaignCreationResult> {

  // 初始化Google Ads API客户端
  const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  });

  const customer = client.Customer({
    customer_id: googleAdsAccountId,
    refresh_token: refreshToken
  });

  try {
    // Step 6: 创建Campaign Budget
    const budgetResourceName = await createCampaignBudget(
      customer,
      offer.offer_name,
      budgetSettings.budget_daily
    );

    // Step 7: 创建Campaign
    const campaignResourceName = await createCampaign(
      customer,
      offer,
      budgetResourceName
    );

    // Step 8: 创建AdGroup
    const adGroupResourceName = await createAdGroup(
      customer,
      offer.offer_name,
      campaignResourceName
    );

    // Step 9a: 创建RSA Ad
    const adResourceName = await createRSAAd(
      customer,
      adGroupResourceName,
      offer.affiliate_link,
      creatives.headlines,
      creatives.descriptions
    );

    // Step 9b: 添加Keywords
    await addKeywords(
      customer,
      adGroupResourceName,
      keywords
    );

    // Step 9c: 创建并关联Assets
    await createAndLinkAssets(
      customer,
      campaignResourceName,
      offer.brand_name,
      creatives.callouts,
      creatives.sitelinks
    );

    // 提取Campaign ID
    const campaignId = campaignResourceName.split('/').pop();

    return {
      success: true,
      campaign_id: campaignId,
      campaign_resource_name: campaignResourceName,
      ad_group_resource_name: adGroupResourceName,
      ad_resource_name: adResourceName,
      keywords_added: keywords.length,
      initial_status: 'PAUSED'
    };

  } catch (error) {
    console.error('Google Ads API Error:', error);
    throw new Error(`Campaign creation failed: ${error.message}`);
  }
}

// Step 6: 创建Campaign Budget
async function createCampaignBudget(
  customer: Customer,
  offerName: string,
  budgetDaily: number
): Promise<string> {

  const budgetOperation = {
    create: {
      name: `${offerName} Budget`,
      amount_micros: budgetDaily * 1_000_000,
      delivery_method: 'STANDARD'
    }
  };

  const response = await customer.campaignBudgets.create([budgetOperation]);
  return response.results[0].resource_name;
}

// Step 7: 创建Campaign
async function createCampaign(
  customer: Customer,
  offer: Offer,
  budgetResourceName: string
): Promise<string> {

  const locationId = getLocationIdByCountry(offer.target_country);
  const languageId = getLanguageIdByLanguage(offer.target_language);

  const campaignOperation = {
    create: {
      name: `${offer.offer_name} Campaign`,
      campaign_budget: budgetResourceName,
      advertising_channel_type: 'SEARCH',
      status: 'PAUSED', // 初始暂停，等待用户激活

      // 出价策略: Maximize Conversions
      maximize_conversions: {},

      // 网络设置
      network_settings: {
        target_google_search: true,
        target_search_network: true,
        target_content_network: false,
        target_partner_search_network: false
      },

      // 地理定位
      geo_target_type_setting: {
        positive_geo_target_type: 'PRESENCE_OR_INTEREST',
        negative_geo_target_type: 'PRESENCE'
      }
    }
  };

  const response = await customer.campaigns.create([campaignOperation]);
  const campaignResourceName = response.results[0].resource_name;

  // 添加地理位置定位
  await customer.campaignCriteria.create([{
    create: {
      campaign: campaignResourceName,
      location: {
        geo_target_constant: `geoTargetConstants/${locationId}`
      }
    }
  }]);

  // 添加语言定位
  await customer.campaignCriteria.create([{
    create: {
      campaign: campaignResourceName,
      language: {
        language_constant: `languageConstants/${languageId}`
      }
    }
  }]);

  return campaignResourceName;
}

// Step 8: 创建AdGroup
async function createAdGroup(
  customer: Customer,
  offerName: string,
  campaignResourceName: string
): Promise<string> {

  const adGroupOperation = {
    create: {
      name: `${offerName} AdGroup`,
      campaign: campaignResourceName,
      status: 'ENABLED',
      type: 'SEARCH_STANDARD'
    }
  };

  const response = await customer.adGroups.create([adGroupOperation]);
  return response.results[0].resource_name;
}

// Step 9a: 创建RSA Ad
async function createRSAAd(
  customer: Customer,
  adGroupResourceName: string,
  finalUrl: string,
  headlines: string[],
  descriptions: string[]
): Promise<string> {

  const adOperation = {
    create: {
      ad_group: adGroupResourceName,
      status: 'ENABLED',
      ad: {
        final_urls: [finalUrl],
        responsive_search_ad: {
          headlines: headlines.map(text => ({ text })),
          descriptions: descriptions.map(text => ({ text })),
          path1: 'shop',
          path2: 'deals'
        }
      }
    }
  };

  const response = await customer.adGroupAds.create([adOperation]);
  return response.results[0].resource_name;
}

// Step 9b: 添加Keywords
async function addKeywords(
  customer: Customer,
  adGroupResourceName: string,
  keywords: KeywordWithMatchType[]
): Promise<void> {

  const keywordOperations = keywords.map(kw => ({
    create: {
      ad_group: adGroupResourceName,
      status: 'ENABLED',
      keyword: {
        text: kw.keyword,
        match_type: kw.match_type // EXACT | PHRASE | BROAD
      },
      cpc_bid_micros: Math.round(kw.suggested_cpc_micros * 1.1) // 建议出价 × 1.1
    }
  }));

  await customer.adGroupCriteria.create(keywordOperations);
}

// Step 9c: 创建并关联Assets
async function createAndLinkAssets(
  customer: Customer,
  campaignResourceName: string,
  brandName: string,
  callouts: string[],
  sitelinks: Array<{title: string, description: string}>
): Promise<void> {

  // 1. 创建Business Name Asset
  const businessNameAsset = await customer.assets.create([{
    create: {
      name: `${brandName} Business Name`,
      type: 'BUSINESS_NAME',
      business_name_asset: {
        business_name: brandName
      }
    }
  }]);

  // 2. 创建Callout Assets
  const calloutAssets = await Promise.all(
    callouts.map(text =>
      customer.assets.create([{
        create: {
          type: 'CALLOUT',
          callout_asset: { callout_text: text }
        }
      }])
    )
  );

  // 3. 创建Sitelink Assets
  const sitelinkAssets = await Promise.all(
    sitelinks.map(link =>
      customer.assets.create([{
        create: {
          type: 'SITELINK',
          sitelink_asset: {
            link_text: link.title,
            description1: link.description,
            final_urls: [finalUrl] // 可根据实际情况设置不同URL
          }
        }
      }])
    )
  );

  // 4. 关联Assets到Campaign
  const assetLinks = [
    ...businessNameAsset.results.map(r => r.resource_name),
    ...calloutAssets.flatMap(r => r.results.map(a => a.resource_name)),
    ...sitelinkAssets.flatMap(r => r.results.map(a => a.resource_name))
  ];

  await Promise.all(
    assetLinks.map(assetResourceName =>
      customer.campaignAssets.create([{
        create: {
          campaign: campaignResourceName,
          asset: assetResourceName,
          field_type: getAssetFieldType(assetResourceName) // BUSINESS_NAME | CALLOUT | SITELINK
        }
      }])
    )
  );
}
```

---

## 七、前端UI流程

### 7.1 一键上广告按钮

```tsx
// Offer列表页面
<OfferCard offer={offer}>
  {offer.ad_status === 'not_launched' && (
    <Button onClick={() => handleLaunchAd(offer.id)}>
      🚀 一键上广告
    </Button>
  )}

  {offer.ad_status === 'launching' && (
    <LoadingSpinner text="正在上广告..." />
  )}

  {offer.ad_status === 'active' && (
    <Badge color="green">广告已上线</Badge>
  )}
</OfferCard>
```

### 7.2 上广告进度显示

```
用户点击"一键上广告"
  ↓
显示进度弹窗：
┌───────────────────────────────────────────────┐
│ 🚀 正在创建广告...                             │
├───────────────────────────────────────────────┤
│ ✅ Step 1: 验证前置条件                        │
│ ✅ Step 2: AI抓取产品信息 (10秒)               │
│ 🔄 Step 3: AI生成关键词 (20秒)                │
│ ⏳ Step 4: 设置预算和出价                      │
│ ⏳ Step 5: AI生成广告创意                      │
│ ⏳ Step 6-9: 调用Google Ads API               │
│ ⏳ Step 10: 更新状态                           │
│                                                │
│ 预计剩余时间: 40秒                             │
└───────────────────────────────────────────────┘
```

### 7.3 创建成功页面

```
┌───────────────────────────────────────────────┐
│ ✅ 广告创建成功！                              │
├───────────────────────────────────────────────┤
│ Campaign ID: 123456789                        │
│ Campaign名称: Reolink_US_01 Campaign          │
│                                                │
│ 📊 创建详情:                                   │
│ • 产品名称: Reolink 8CH 5MP PoE Security...   │
│ • 关键词数量: 15个                             │
│ • Headlines数量: 15条                          │
│ • Descriptions数量: 4条                        │
│ • 每日预算: $45.00                             │
│ • 目标CPC: $1.50                               │
│                                                │
│ ⚠️ 当前状态: PAUSED（已暂停）                  │
│                                                │
│ 下一步操作:                                    │
│ 1. 在Google Ads后台上传Logo和图片            │
│ 2. 检查广告预览并确认无误                     │
│ 3. 点击下方按钮激活广告                       │
│                                                │
│ [在Google Ads中查看]  [激活广告 →]            │
└───────────────────────────────────────────────┘
```

---

## 八、数据库更新

### 8.1 更新Offer表

```sql
UPDATE offers
SET
  product_name = ?,
  product_description = ?,
  category = ?,
  target_keywords = ?,
  budget_daily = ?,
  target_cpc = ?,
  ad_status = 'active',
  google_campaign_id = ?,
  updated_at = datetime('now')
WHERE id = ?;
```

### 8.2 创建campaigns表记录

```sql
INSERT INTO campaigns (
  user_id,
  offer_id,
  google_campaign_id,
  google_campaign_name,
  campaign_type,
  budget_daily,
  target_cpc,
  target_languages,
  target_locations,
  status,
  google_status,
  created_at,
  updated_at
) VALUES (?, ?, ?, ?, 'SEARCH', ?, ?, ?, ?, 'active', 'PAUSED', datetime('now'), datetime('now'));
```

---

## 九、错误处理

### 9.1 常见错误和解决方案

| 错误类型 | 原因 | 解决方案 |
|---------|------|---------|
| 产品信息抓取失败 | 网络超时、页面结构变化 | 允许用户手动输入产品信息 |
| 关键词搜索量过低 | AI生成的关键词太冷门 | 重新生成或提供推荐关键词 |
| Google Ads API配额超限 | 请求频率过高 | 队列化处理，延迟重试 |
| Campaign创建失败 | API参数错误、账号权限不足 | 显示详细错误信息，引导用户修正 |
| Token过期 | OAuth refresh token失效 | 引导用户重新授权 |

---

## 十、总结

### 10.1 核心优势

| 优势 | 说明 |
|------|------|
| **极致自动化** | 99%的工作由AI和API完成 |
| **数据驱动** | 基于Google Ads真实数据设置预算和出价 |
| **高质量创意** | AI生成专业广告文案 |
| **快速上线** | 50秒内完成从Offer到Campaign |
| **降低门槛** | 无需专业知识即可投放Google Ads |

### 10.2 实施计划

- [ ] AI产品信息抓取（Playwright + Proxy）: 6-8小时
- [ ] AI关键词生成和验证: 4-6小时
- [ ] AI广告创意生成: 3-4小时
- [ ] Google Ads API集成: 8-10小时
- [ ] 前端UI和进度显示: 4-6小时
- [ ] 测试和优化: 6-8小时
- **总计**: 31-42小时

---

**下一步**: 实施本文档定义的"一键上广告"功能
