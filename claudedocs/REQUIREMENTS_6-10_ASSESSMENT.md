# 需求6-10完成度评估报告

**评估日期**: 2025-01-18
**评估范围**: Requirements 6-10
**评估目标**: 分析现有实现，识别gaps，制定优化方案

---

## 需求6：Keyword Planner工具集成

### 当前实现状态 ✅ **90%完成**

**已实现功能**:
- ✅ `src/lib/google-ads-keyword-planner.ts`:
  - `getKeywordIdeas()` - 基于种子关键词和URL生成关键词建议
  - `getKeywordMetrics()` - 获取已知关键词的历史指标
  - `filterHighQualityKeywords()` - 根据搜索量、竞争度筛选
  - `rankKeywordsByRelevance()` - 综合评分排序
  - `groupKeywordsByTheme()` - 按主题分组（品牌、产品、对比、信息、交易）
- ✅ `src/app/api/offers/[id]/keyword-ideas/route.ts`: API路由
- ✅ 支持多国家/多语言（US、CN、UK、CA、AU、DE、FR、JP、KR）
- ✅ 格式化输出（CPC金额、搜索量）

**需要优化**:
- ⚠️ **下拉词提取**（需求11）: 缺少Google搜索下拉词提取功能
- ⚠️ **负面关键词过滤**（需求11）: 缺少对"setup"、"how to"、"free"等低意图词的过滤
- ⚠️ **错误重试机制**: Keyword Planner API调用失败时缺少重试逻辑

**优化建议**:
1. 增加下拉词提取功能（使用Playwright模拟Google搜索）
2. 完善负面关键词黑名单过滤
3. 添加API调用失败的重试机制（3次重试，指数退避）

---

## 需求7：每日表现数据获取

### 当前实现状态 ⚠️ **60%完成**

**已实现功能**:
- ✅ `src/app/api/dashboard/trends/route.ts`: 从数据库查询趋势数据
- ✅ 数据库表 `campaign_performance` 存储每日指标
- ✅ 支持7/30/90天趋势数据
- ✅ 计算派生指标（CTR、CPC、转化率）

**关键缺失**:
- ❌ **Google Ads API数据同步**: 没有从Google Ads API拉取每日表现数据的代码
- ❌ **定时任务调度**: 没有每日自动同步的定时任务
- ❌ **增量同步逻辑**: 没有只拉取新增日期数据的增量更新机制

**优化方案**:
```typescript
// 需要实现：src/lib/google-ads-performance-sync.ts
export async function syncCampaignPerformance(params: {
  customerId: string
  refreshToken: string
  campaignIds: string[]
  dateRange: { startDate: string; endDate: string }
  userId: number
}): Promise<{ synced: number; failed: number }>

// 需要实现：src/app/api/sync/campaign-performance/route.ts
POST /api/sync/campaign-performance
- 手动触发同步
- 支持指定日期范围
- 批量更新campaign_performance表

// 需要实现：定时任务（cron）
SYNC_INTERVAL_HOURS=6 → 每6小时自动同步
```

**实施步骤**:
1. 实现 `syncCampaignPerformance` 函数调用Google Ads Reporting API
2. 创建API路由支持手动触发同步
3. 添加定时任务（node-cron或Vercel Cron）
4. 添加同步日志记录到 `sync_logs` 表

---

## 需求8：配置页面

### 当前实现状态 ✅ **85%完成**

**已实现功能**:
- ✅ `src/lib/settings.ts`: 配置管理核心逻辑
  - `getAllSettings()` - 获取所有配置
  - `getSettingsByCategory()` - 按分类获取
  - `updateSetting()` - 更新单个配置
  - `updateSettings()` - 批量更新
- ✅ `src/app/api/settings/route.ts`: GET/PUT API路由
- ✅ 配置分类（google_ads、ai、proxy）
- ✅ 敏感字段加密存储（encrypted_value）
- ✅ 验证状态跟踪（validation_status、validation_message）

**需要完善**:
- ⚠️ **配置验证函数**: `validateGoogleAdsConfig` 和 `validateAIApiKey` 是TODO状态
- ⚠️ **前端UI**: 缺少完整的配置页面前端组件
- ⚠️ **验证API路由**: 缺少 `/api/settings/validate` 端点

**优化方案**:
```typescript
// 1. 实现真实的验证逻辑
export async function validateGoogleAdsConfig(config): Promise<ValidationResult> {
  // 调用Google Ads API测试连接
  const customer = new GoogleAdsCustomer({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    developer_token: config.developerToken,
    refresh_token: testRefreshToken
  })

  try {
    await customer.listAccessibleCustomers()
    return { valid: true, message: '配置验证成功' }
  } catch (error) {
    return { valid: false, message: error.message }
  }
}

// 2. 实现Gemini API验证
export async function validateGeminiApiKey(apiKey): Promise<ValidationResult> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
  )
  return { valid: response.ok, message: response.ok ? '验证成功' : '无效的API Key' }
}

// 3. 添加验证API路由
POST /api/settings/validate
{
  "category": "google_ads",
  "config": { ... }
}
```

---

## 需求9：Final URL和Final URL suffix提取

### 当前实现状态 ⚠️ **40%完成**

**已实现功能**:
- ✅ `src/lib/scraper.ts` 有基础的URL访问和代理支持
- ✅ `scrapeUrl()` 函数可以获取页面内容
- ✅ `validateUrl()` 函数可以检查URL可访问性

**关键缺失**:
- ❌ **重定向跟踪**: 没有专门跟踪affiliate_link多次重定向的逻辑
- ❌ **Final URL提取**: 没有明确的函数提取最终URL（去掉查询参数）
- ❌ **Final URL suffix提取**: 没有提取查询参数作为suffix的逻辑
- ❌ **Google Ads Campaign配置**: 没有将Final URL配置到Campaigns-Ads层级、Final URL suffix配置到Campaigns-Campaigns层级的实现

**需求描述分析**:
```
Offer推广链接: https://pboost.me/UKTs4I6
最终落地页: https://www.amazon.com/stores/page/201E3A4F-C63F-48A6-87B7-524F985330DA?maas=maas_adg_api_588289795052186734_static_12_201&ref_=aa_maas&tag=maas&aa_campaignid=9323c24e59a532dc86f430bf18a14950&aa_adgroupid=f21dEi3q5C057CRsghsfp1PmgJ80HG83HiYmme9yASfdsR5SQ2ouyKhsXtIqmoobEo_aBn43QCYHMVkI_c&aa_creativeid=ed3fyhjAUbNxoKWV45nWjblAJoB9fmOGtWvxGVbRhBL6MYY_c

Final URL: https://www.amazon.com/stores/page/201E3A4F-C63F-48A6-87B7-524F985330DA
Final URL suffix: maas=maas_adg_api_588289795052186734_static_12_201&ref_=aa_maas&tag=maas&aa_campaignid=9323c24e59a532dc86f430bf18a14950&aa_adgroupid=f21dEi3q5C057CRsghsfp1PmgJ80HG83HiYmme9yASfdsR5SQ2ouyKhsXtIqmoobEo_aBn43QCYHMVkI_c&aa_creativeid=ed3fyhjAUbNxoKWV45nWjblAJoB9fmOGtWvxGVbRhBL6MYY_c
```

**优化方案**:
```typescript
// 新建文件：src/lib/url-resolver.ts
export interface ResolvedUrl {
  finalUrl: string           // 不含查询参数的URL
  finalUrlSuffix: string      // 查询参数部分
  redirectChain: string[]     // 重定向链
  redirectCount: number
}

export async function resolveAffiliateLink(
  affiliateLink: string,
  proxyUrl?: string
): Promise<ResolvedUrl> {
  const proxy = proxyUrl ? await getProxyIp(proxyUrl) : undefined
  const redirectChain: string[] = [affiliateLink]

  // 使用axios手动跟踪重定向
  let currentUrl = affiliateLink
  let redirectCount = 0
  const maxRedirects = 10

  while (redirectCount < maxRedirects) {
    const response = await axios.get(currentUrl, {
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400,
      httpsAgent: proxy ? createProxyAgent(proxy) : undefined,
      timeout: 10000
    })

    if (response.status >= 300 && response.status < 400 && response.headers.location) {
      currentUrl = resolveRedirectUrl(currentUrl, response.headers.location)
      redirectChain.push(currentUrl)
      redirectCount++
    } else {
      break
    }
  }

  // 最终URL
  const finalFullUrl = currentUrl

  // 分离Final URL和Final URL suffix
  const urlObj = new URL(finalFullUrl)
  const finalUrl = `${urlObj.origin}${urlObj.pathname}`
  const finalUrlSuffix = urlObj.search.substring(1) // 去掉开头的'?'

  return {
    finalUrl,
    finalUrlSuffix,
    redirectChain,
    redirectCount
  }
}

// 新建API路由：src/app/api/offers/[id]/resolve-url/route.ts
POST /api/offers/:id/resolve-url
{
  "affiliateLink": "https://pboost.me/UKTs4I6"
}
→ 返回：{
  "finalUrl": "...",
  "finalUrlSuffix": "...",
  "redirectChain": [...],
  "redirectCount": 5
}
```

**集成到Google Ads创建流程**:
```typescript
// 在创建Ad时使用Final URL
await createGoogleAdsResponsiveSearchAd({
  ...
  finalUrls: [resolvedUrl.finalUrl],  // 设置Final URL
  finalUrlSuffix: resolvedUrl.finalUrlSuffix, // 设置Final URL suffix
  ...
})

// 在创建Campaign时设置Final URL suffix（Campaign层级）
await createGoogleAdsCampaign({
  ...
  urlCustomParameters: {
    finalUrlSuffix: resolvedUrl.finalUrlSuffix
  }
  ...
})
```

---

## 需求10：代理URL配置和使用

### 当前实现状态 ⚠️ **50%完成**

**已实现功能**:
- ✅ 环境变量支持（PROXY_ENABLED、PROXY_URL）
- ✅ `src/lib/scraper.ts` 的 `getProxyAgent()` 函数
- ✅ 基础的HTTP代理支持（axios + https-proxy-agent）

**关键缺失**:
- ❌ **代理URL格式验证**: 没有检查cc、ips、proxyType=http、responseType=txt参数
- ❌ **代理IP解析**: 没有解析 `host:port:username:password` 格式的逻辑
- ❌ **用户级代理配置**: 没有从system_settings表读取用户配置的代理URL
- ❌ **代理使用场景覆盖**:
  - ❌ Playwright浏览器自动化中使用代理
  - ❌ Final URL获取中使用代理
  - ❌ 风险检测中使用代理
- ❌ **代理日志记录**: 没有proxy_usage_logs表来跟踪代理使用情况

**详细设计文档**: `docs/PROXY_CONFIGURATION_DESIGN.md` 已存在，包含完整的实现方案

**优化方案**:

### 1. 代理URL验证
```typescript
// src/lib/proxy/validate-url.ts
export interface ProxyUrlValidation {
  isValid: boolean
  countryCode: string | null  // UK | CA | ROW
  errors: string[]
}

export function validateProxyUrl(proxyUrl: string): ProxyUrlValidation {
  const errors: string[] = []
  const url = new URL(proxyUrl)
  const params = new URLSearchParams(url.search)

  // 验证cc参数
  const cc = params.get('cc')
  if (!cc || !['UK', 'CA', 'ROW'].includes(cc.toUpperCase())) {
    errors.push('缺少国家代码参数 (cc)，请确认URL包含 cc=UK、cc=CA 或 cc=ROW')
  }

  // 验证ips参数
  if (!params.get('ips')) {
    errors.push('缺少IP数量参数 (ips)，请确认URL包含 ips=1')
  }

  // 验证proxyType参数
  if (params.get('proxyType') !== 'http') {
    errors.push('代理类型必须为HTTP，请确认URL包含 proxyType=http')
  }

  // 验证responseType参数
  if (params.get('responseType') !== 'txt') {
    errors.push('响应格式必须为文本，请确认URL包含 responseType=txt')
  }

  return {
    isValid: errors.length === 0,
    countryCode: cc?.toUpperCase() || null,
    errors
  }
}
```

### 2. 代理IP获取和解析
```typescript
// src/lib/proxy/fetch-proxy-ip.ts
export interface ProxyCredentials {
  host: string
  port: number
  username: string
  password: string
  fullAddress: string
}

export async function fetchProxyIp(proxyUrl: string): Promise<ProxyCredentials> {
  // 1. 验证URL格式
  const validation = validateProxyUrl(proxyUrl)
  if (!validation.isValid) {
    throw new Error(`Proxy URL验证失败: ${validation.errors.join(', ')}`)
  }

  // 2. 请求代理IP
  const response = await fetch(proxyUrl, {
    method: 'GET',
    signal: AbortSignal.timeout(10000)
  })

  if (!response.ok) {
    throw new Error(`获取代理IP失败: HTTP ${response.status}`)
  }

  // 3. 解析代理字符串: "15.235.13.80:5959:com49692430-res-row-sid-867994980:Qxi9V59e3kNOW6pnRi3i"
  const proxyString = await response.text()
  const [host, portStr, username, password] = proxyString.trim().split(':')

  if (!host || !portStr || !username || !password) {
    throw new Error(`代理IP格式错误，期望格式: host:port:username:password`)
  }

  const port = parseInt(portStr)
  if (isNaN(port)) {
    throw new Error(`端口号无效: ${portStr}`)
  }

  return {
    host,
    port,
    username,
    password,
    fullAddress: `${host}:${port}`
  }
}
```

### 3. Playwright集成
```typescript
// src/lib/scraper/playwright-with-proxy.ts
import { chromium } from 'playwright'
import { fetchProxyIp } from '@/lib/proxy/fetch-proxy-ip'

export async function createBrowserWithProxy(proxyUrl: string) {
  const proxy = await fetchProxyIp(proxyUrl)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    proxy: {
      server: `http://${proxy.host}:${proxy.port}`,
      username: proxy.username,
      password: proxy.password
    }
  })

  return { browser, context }
}
```

### 4. 用户级代理配置
```typescript
// src/lib/proxy/get-user-proxy.ts
export async function getUserProxyUrl(userId: number): Promise<string | null> {
  const db = getDatabase()

  const setting = db.prepare(`
    SELECT proxy_url, proxy_enabled
    FROM user_settings
    WHERE user_id = ? AND proxy_enabled = 1
  `).get(userId)

  if (!setting || !setting.proxy_url) {
    return null
  }

  return setting.proxy_url
}
```

---

## 总体优化优先级

### P0 - 必须完成（影响核心功能）
1. ✅ **需求9优化**: 实现Final URL和Final URL suffix提取逻辑
2. ✅ **需求10优化**: 完善代理URL验证和使用
3. ✅ **需求7优化**: 实现Google Ads API数据同步

### P1 - 重要（提升用户体验）
4. ✅ **需求8优化**: 完善配置验证逻辑
5. ✅ **需求6优化**: 增加下拉词提取和负面关键词过滤

### P2 - 可选（锦上添花）
6. ⭕ 代理使用日志记录
7. ⭕ 错误重试机制优化

---

## 实施计划

### 阶段1：核心功能完善（2天）
**Day 1**:
- [ ] 实现 `url-resolver.ts` (Final URL提取)
- [ ] 实现 `proxy/validate-url.ts` (代理URL验证)
- [ ] 实现 `proxy/fetch-proxy-ip.ts` (代理IP解析)

**Day 2**:
- [ ] 实现 `google-ads-performance-sync.ts` (数据同步)
- [ ] 创建 `/api/sync/campaign-performance` 路由
- [ ] 集成代理到Playwright和URL访问逻辑

### 阶段2：集成和测试（1天）
**Day 3**:
- [ ] 配置验证逻辑实现（Google Ads API、Gemini API）
- [ ] 下拉词提取功能（Playwright + Google搜索）
- [ ] 负面关键词黑名单过滤
- [ ] 单元测试和集成测试

### 阶段3：真实环境测试（当前任务）
**Day 4**:
- [ ] 读取.env环境变量
- [ ] 启动本地服务
- [ ] 使用真实参数测试全流程
- [ ] 浏览器自动化测试（Playwright）

---

## 测试用例清单

### 需求6测试
- [ ] 调用Keyword Planner获取关键词建议（品牌：Reolink，国家：US）
- [ ] 验证搜索量数据准确性
- [ ] 验证过滤和排序逻辑

### 需求7测试
- [ ] 触发数据同步API
- [ ] 验证campaign_performance表数据更新
- [ ] 验证趋势图数据正确性

### 需求8测试
- [ ] 测试配置页面GET/PUT接口
- [ ] 测试Google Ads API配置验证
- [ ] 测试Gemini API Key验证

### 需求9测试
- [ ] 测试affiliate_link重定向跟踪（https://pboost.me/UKTs4I6）
- [ ] 验证Final URL和Final URL suffix正确分离
- [ ] 验证代理IP在URL解析中的使用

### 需求10测试
- [ ] 测试代理URL格式验证
- [ ] 测试代理IP获取和解析
- [ ] 测试Playwright使用代理访问
- [ ] 测试axios使用代理访问

---

## KISS原则应用

### 简化原则
1. **代理配置**: 用户只需填写Proxy URL，系统自动验证和解析
2. **Final URL提取**: 一个函数完成重定向跟踪+URL分离，无需多次调用
3. **数据同步**: 单个API端点 `/api/sync/campaign-performance` 完成所有同步任务
4. **配置验证**: 每个配置项独立验证，错误信息清晰明确

### 避免过度设计
- ❌ 不引入复杂的代理池管理
- ❌ 不实现代理IP轮换策略（使用5分钟缓存即可）
- ❌ 不实现复杂的重试机制（简单的3次重试足够）
- ❌ 不实现复杂的URL解析规则（统一处理查询参数）

---

**评估结论**: 需求6-10的基础功能已实现60-90%，主要缺失数据同步、Final URL提取、代理完整集成等核心功能。通过3-4天的优化和测试，可以达到生产级别的完成度。
