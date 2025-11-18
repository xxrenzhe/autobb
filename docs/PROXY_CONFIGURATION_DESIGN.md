# 代理配置功能设计

**创建日期**: 2025-01-18
**版本**: 1.0
**状态**: 设计完成，待开发

---

## 目录

1. [功能概述](#功能概述)
2. [数据库设计](#数据库设计)
3. [Proxy URL格式规范](#proxy-url格式规范)
4. [代理IP获取机制](#代理ip获取机制)
5. [业务场景集成](#业务场景集成)
6. [前端UI设计](#前端ui设计)
7. [API设计](#api设计)
8. [错误处理](#错误处理)
9. [安全考虑](#安全考虑)
10. [测试计划](#测试计划)
11. [实施计划](#实施计划)

---

## 功能概述

### 核心需求

**用户场景**: 用户需要配置代理服务器，以便在数据爬取、URL访问等场景中使用不同国家的IP地址

**核心功能**:
- ✅ 用户在配置页面配置Proxy_URL
- ✅ 前端验证Proxy_URL格式（必须参数检查）
- ✅ 动态获取代理IP（每次使用时请求新IP）
- ✅ 在数据爬取、Final URL获取等业务场景中使用代理
- ✅ 确保不降级为直连访问（强制使用代理）
- ✅ 支持多个国家的代理配置

**业务价值**:
- 🌍 真实地理位置访问：使用目标国家的IP访问推广链接
- 🔒 隐私保护：隐藏服务器真实IP地址
- 🚀 绕过限制：避免IP被封或访问限制
- 📊 数据准确性：获取目标国家用户看到的真实内容

### 使用场景

1. **数据爬取**（Playwright浏览器自动化）
   - 抓取产品信息时使用目标国家代理
   - 检测推广链接是否可访问

2. **Final URL获取**
   - 访问affiliate_link获取最终跳转URL
   - 验证品牌信息是否正确

3. **风险检测**（每日定时任务）
   - 使用对应国家代理检测推广链接
   - 确保检测结果的真实性

---

## 数据库设计

### 1. user_settings表扩展

**新增字段**:

```sql
-- 在现有user_settings表基础上添加以下字段
ALTER TABLE user_settings ADD COLUMN proxy_url TEXT;
ALTER TABLE user_settings ADD COLUMN proxy_country_code TEXT; -- UK | CA | ROW
ALTER TABLE user_settings ADD COLUMN proxy_enabled BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN proxy_validated BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN proxy_last_validated_at TEXT;
ALTER TABLE user_settings ADD COLUMN proxy_validation_error TEXT;

-- 添加索引
CREATE INDEX idx_user_settings_proxy_enabled ON user_settings(proxy_enabled);
```

**字段说明**:
- `proxy_url`: 代理服务商提供的API URL
- `proxy_country_code`: 代理国家代码（从URL中解析的cc参数）
- `proxy_enabled`: 是否启用代理（0=禁用，1=启用）
- `proxy_validated`: URL格式验证是否通过（0=未验证或失败，1=验证通过）
- `proxy_last_validated_at`: 最后一次验证时间
- `proxy_validation_error`: 验证失败的错误信息

**示例数据**:
```sql
INSERT INTO user_settings (
  user_id,
  proxy_url,
  proxy_country_code,
  proxy_enabled,
  proxy_validated
) VALUES (
  1,
  'https://api.iprocket.io/api?username=com49692430&password=Qxi9V59e3kNOW6pnRi3i&cc=ROW&ips=1&type=-res-&proxyType=http&responseType=txt',
  'ROW',
  1,
  1
);
```

### 2. proxy_usage_logs表（新建）

**用途**: 记录代理IP的使用情况，便于监控和调试

```sql
CREATE TABLE proxy_usage_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  usage_type TEXT NOT NULL,              -- playwright | url_fetch | risk_check
  target_url TEXT NOT NULL,
  proxy_ip TEXT NOT NULL,                -- 格式: 15.235.13.80:5959
  proxy_username TEXT NOT NULL,
  country_code TEXT NOT NULL,            -- UK | CA | ROW
  success BOOLEAN NOT NULL,
  response_time INTEGER,                 -- 毫秒
  error_message TEXT,
  used_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX idx_proxy_logs_user_id ON proxy_usage_logs(user_id);
CREATE INDEX idx_proxy_logs_used_at ON proxy_usage_logs(used_at);
CREATE INDEX idx_proxy_logs_success ON proxy_usage_logs(success);
```

**关键设计**:
- 📝 记录每次代理IP的使用
- 📊 跟踪成功率和响应时间
- 🔍 便于排查代理相关问题
- 📈 分析代理服务质量

---

## Proxy URL格式规范

### 1. 完整示例

```
https://api.iprocket.io/api?username=com49692430&password=Qxi9V59e3kNOW6pnRi3i&cc=ROW&ips=1&type=-res-&proxyType=http&responseType=txt
```

### 2. 必需参数

**前端验证规则**:

| 参数 | 值要求 | 说明 | 错误提示 |
|------|--------|------|----------|
| **cc** | UK\|CA\|ROW | 国家代码 | "缺少国家代码参数 (cc)，请确认URL包含 cc=UK、cc=CA 或 cc=ROW" |
| **ips** | 整数 | 一次获取的IP数量 | "缺少IP数量参数 (ips)，请确认URL包含 ips=1" |
| **proxyType** | http | 代理类型 | "代理类型必须为HTTP，请确认URL包含 proxyType=http" |
| **responseType** | txt | 响应格式 | "响应格式必须为文本，请确认URL包含 responseType=txt" |

**国家代码说明**:
- `cc=UK`: 英国 (United Kingdom)
- `cc=CA`: 加拿大 (Canada)
- `cc=ROW`: 美国 (Rest of World - 代理服务商特定代码)

### 3. 格式验证函数

```typescript
// lib/proxy/validate-url.ts
export interface ProxyUrlValidation {
  isValid: boolean;
  countryCode: string | null;
  errors: string[];
}

export function validateProxyUrl(proxyUrl: string): ProxyUrlValidation {
  const errors: string[] = [];
  let countryCode: string | null = null;

  try {
    const url = new URL(proxyUrl);
    const params = new URLSearchParams(url.search);

    // 验证 cc 参数
    const cc = params.get('cc');
    if (!cc) {
      errors.push('缺少国家代码参数 (cc)，请确认URL包含 cc=UK、cc=CA 或 cc=ROW');
    } else if (!['UK', 'CA', 'ROW'].includes(cc.toUpperCase())) {
      errors.push(`国家代码 "${cc}" 无效，仅支持 UK、CA、ROW`);
    } else {
      countryCode = cc.toUpperCase();
    }

    // 验证 ips 参数
    const ips = params.get('ips');
    if (!ips) {
      errors.push('缺少IP数量参数 (ips)，请确认URL包含 ips=1');
    } else if (parseInt(ips) < 1) {
      errors.push('IP数量必须大于0');
    }

    // 验证 proxyType 参数
    const proxyType = params.get('proxyType');
    if (!proxyType) {
      errors.push('缺少代理类型参数 (proxyType)，请确认URL包含 proxyType=http');
    } else if (proxyType.toLowerCase() !== 'http') {
      errors.push(`代理类型必须为HTTP，当前为: ${proxyType}`);
    }

    // 验证 responseType 参数
    const responseType = params.get('responseType');
    if (!responseType) {
      errors.push('缺少响应格式参数 (responseType)，请确认URL包含 responseType=txt');
    } else if (responseType.toLowerCase() !== 'txt') {
      errors.push(`响应格式必须为文本，当前为: ${responseType}`);
    }

    // 验证URL协议
    if (!['http:', 'https:'].includes(url.protocol)) {
      errors.push('URL必须使用HTTP或HTTPS协议');
    }

  } catch (error) {
    errors.push('URL格式无效，请检查URL是否正确');
  }

  return {
    isValid: errors.length === 0,
    countryCode,
    errors
  };
}
```

### 4. 验证示例

**正确示例**:
```typescript
const validUrl = 'https://api.iprocket.io/api?username=user&password=pass&cc=ROW&ips=1&type=-res-&proxyType=http&responseType=txt';
const validation = validateProxyUrl(validUrl);
// { isValid: true, countryCode: 'ROW', errors: [] }
```

**错误示例1 - 缺少cc参数**:
```typescript
const invalidUrl = 'https://api.iprocket.io/api?username=user&password=pass&ips=1&proxyType=http&responseType=txt';
const validation = validateProxyUrl(invalidUrl);
// {
//   isValid: false,
//   countryCode: null,
//   errors: ['缺少国家代码参数 (cc)，请确认URL包含 cc=UK、cc=CA 或 cc=ROW']
// }
```

**错误示例2 - proxyType不是http**:
```typescript
const invalidUrl = 'https://api.iprocket.io/api?username=user&password=pass&cc=ROW&ips=1&proxyType=socks5&responseType=txt';
const validation = validateProxyUrl(invalidUrl);
// {
//   isValid: false,
//   countryCode: 'ROW',
//   errors: ['代理类型必须为HTTP，当前为: socks5']
// }
```

---

## 代理IP获取机制

### 1. 代理IP格式

**服务商返回格式**:
```
15.235.13.80:5959:com49692430-res-row-sid-867994980:Qxi9V59e3kNOW6pnRi3i
```

**字段说明**:
- 字段1: `15.235.13.80` - **host**（代理服务器地址）
- 字段2: `5959` - **port**（代理服务器端口）
- 字段3: `com49692430-res-row-sid-867994980` - **username**（认证用户名）
- 字段4: `Qxi9V59e3kNOW6pnRi3i` - **password**（认证密码）

### 2. 获取代理IP函数

```typescript
// lib/proxy/fetch-proxy-ip.ts
export interface ProxyCredentials {
  host: string;
  port: number;
  username: string;
  password: string;
  fullAddress: string; // 完整格式（便于日志记录）
}

export async function fetchProxyIp(proxyUrl: string): Promise<ProxyCredentials> {
  try {
    // Step 1: 验证URL格式
    const validation = validateProxyUrl(proxyUrl);
    if (!validation.isValid) {
      throw new Error(`Proxy URL验证失败: ${validation.errors.join(', ')}`);
    }

    // Step 2: 请求代理IP
    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      // 设置超时 10秒
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error(`获取代理IP失败: HTTP ${response.status}`);
    }

    // Step 3: 解析响应
    const proxyString = await response.text();
    const trimmedProxy = proxyString.trim();

    // Step 4: 解析代理字符串
    const parts = trimmedProxy.split(':');
    if (parts.length !== 4) {
      throw new Error(`代理IP格式错误: 期望4个字段，实际${parts.length}个字段。响应内容: ${trimmedProxy}`);
    }

    const [host, portStr, username, password] = parts;
    const port = parseInt(portStr);

    if (isNaN(port) || port < 1 || port > 65535) {
      throw new Error(`端口号无效: ${portStr}`);
    }

    return {
      host,
      port,
      username,
      password,
      fullAddress: `${host}:${port}`
    };

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`获取代理IP失败: ${error.message}`);
    }
    throw new Error('获取代理IP失败: 未知错误');
  }
}
```

### 3. 使用示例

```typescript
// 获取代理IP
const proxyUrl = 'https://api.iprocket.io/api?username=com49692430&password=Qxi9V59e3kNOW6pnRi3i&cc=ROW&ips=1&type=-res-&proxyType=http&responseType=txt';

const proxy = await fetchProxyIp(proxyUrl);
console.log(proxy);
// {
//   host: '15.235.13.80',
//   port: 5959,
//   username: 'com49692430-res-row-sid-867994980',
//   password: 'Qxi9V59e3kNOW6pnRi3i',
//   fullAddress: '15.235.13.80:5959'
// }
```

### 4. 缓存策略

**问题**: 每次访问都获取新IP，可能导致请求过多

**解决方案**:
- ✅ 短期缓存（5分钟）：同一个URL访问可以复用IP
- ✅ 轮询刷新：每5分钟自动刷新IP
- ✅ 失败重试：IP不可用时立即获取新IP

```typescript
// lib/proxy/proxy-cache.ts
interface CachedProxy {
  credentials: ProxyCredentials;
  fetchedAt: number;
  expiresAt: number;
}

const proxyCache = new Map<string, CachedProxy>();
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟

export async function getProxyIp(proxyUrl: string, forceRefresh = false): Promise<ProxyCredentials> {
  const now = Date.now();

  // 检查缓存
  if (!forceRefresh) {
    const cached = proxyCache.get(proxyUrl);
    if (cached && now < cached.expiresAt) {
      console.log('使用缓存的代理IP:', cached.credentials.fullAddress);
      return cached.credentials;
    }
  }

  // 获取新IP
  const credentials = await fetchProxyIp(proxyUrl);

  // 更新缓存
  proxyCache.set(proxyUrl, {
    credentials,
    fetchedAt: now,
    expiresAt: now + CACHE_DURATION
  });

  console.log('获取新代理IP:', credentials.fullAddress);
  return credentials;
}
```

---

## 业务场景集成

### 场景1: Playwright浏览器自动化

**用途**: 数据爬取、推广链接检测

```typescript
// lib/scraper/playwright-with-proxy.ts
import { chromium, Browser, BrowserContext } from 'playwright';
import { getProxyIp } from '@/lib/proxy/proxy-cache';

export async function createBrowserWithProxy(proxyUrl: string): Promise<{ browser: Browser; context: BrowserContext }> {
  // Step 1: 获取代理IP
  const proxy = await getProxyIp(proxyUrl);

  // Step 2: 启动浏览器
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  });

  // Step 3: 创建带代理的上下文
  const context = await browser.newContext({
    proxy: {
      server: `http://${proxy.host}:${proxy.port}`,
      username: proxy.username,
      password: proxy.password
    },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezoneId: 'America/New_York'
  });

  return { browser, context };
}

// 使用示例
export async function scrapeProductWithProxy(shopUrl: string, proxyUrl: string): Promise<any> {
  const { browser, context } = await createBrowserWithProxy(proxyUrl);

  try {
    const page = await context.newPage();

    // 访问目标URL
    await page.goto(shopUrl, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // 提取数据
    const productName = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      return h1 ? h1.textContent : null;
    });

    return { productName };

  } finally {
    await context.close();
    await browser.close();
  }
}
```

### 场景2: Final URL获取（HTTP请求）

**用途**: 获取affiliate_link的最终跳转URL

```typescript
// lib/url/fetch-final-url.ts
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { getProxyIp } from '@/lib/proxy/proxy-cache';

export async function fetchFinalUrl(affiliateLink: string, proxyUrl: string): Promise<string> {
  // Step 1: 获取代理IP
  const proxy = await getProxyIp(proxyUrl);

  // Step 2: 创建代理Agent
  const proxyAgent = new HttpsProxyAgent(
    `http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`
  );

  // Step 3: 发送请求（禁用自动跟随重定向）
  try {
    const response = await axios.get(affiliateLink, {
      maxRedirects: 0,  // 禁用自动重定向
      validateStatus: (status) => status >= 200 && status < 400,
      httpAgent: proxyAgent,
      httpsAgent: proxyAgent,
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    // 如果有Location头，返回跳转URL
    if (response.headers.location) {
      return response.headers.location;
    }

    // 否则返回原URL
    return affiliateLink;

  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.headers.location) {
      return error.response.headers.location;
    }
    throw error;
  }
}

// 使用示例
const finalUrl = await fetchFinalUrl(
  'https://pboost.me/UKTs4I6',
  'https://api.iprocket.io/api?username=user&password=pass&cc=ROW&ips=1&type=-res-&proxyType=http&responseType=txt'
);
console.log('Final URL:', finalUrl);
```

### 场景3: Final URL Suffix提取

**用途**: 从Final URL中提取品牌相关的路径后缀

```typescript
// lib/url/extract-url-suffix.ts
export function extractUrlSuffix(finalUrl: string): string {
  try {
    const url = new URL(finalUrl);

    // 提取路径（去除查询参数和hash）
    const path = url.pathname;

    // 提取最后一段路径作为suffix
    const parts = path.split('/').filter(p => p.length > 0);
    const suffix = parts.length > 0 ? parts[parts.length - 1] : '';

    return suffix;
  } catch (error) {
    console.error('提取URL suffix失败:', error);
    return '';
  }
}

// 完整流程示例
export async function getUrlSuffixWithProxy(affiliateLink: string, proxyUrl: string): Promise<string> {
  // Step 1: 使用代理获取Final URL
  const finalUrl = await fetchFinalUrl(affiliateLink, proxyUrl);

  // Step 2: 提取suffix
  const suffix = extractUrlSuffix(finalUrl);

  return suffix;
}

// 使用示例
const suffix = await getUrlSuffixWithProxy(
  'https://pboost.me/UKTs4I6',
  'https://api.iprocket.io/api?username=user&password=pass&cc=ROW&ips=1&type=-res-&proxyType=http&responseType=txt'
);
console.log('URL Suffix:', suffix);
// 例如: "reolink-camera" 或 "products/security-camera"
```

### 场景4: 风险检测中的代理使用

**整合到AffiliateLinkChecker**:

```typescript
// lib/risk-detection/affiliate-link-checker.ts (更新版本)
import { createBrowserWithProxy } from '@/lib/scraper/playwright-with-proxy';

export class AffiliateLinkChecker {
  async checkAllActiveOffers(): Promise<void> {
    const offers = db.prepare(`
      SELECT
        o.id, o.user_id, o.affiliate_link, o.brand_name, o.target_country, o.offer_name,
        us.proxy_url, us.proxy_enabled
      FROM offers o
      LEFT JOIN user_settings us ON o.user_id = us.user_id
      WHERE o.ad_status = 'active'
      ORDER BY o.user_id, o.id
    `).all();

    for (const offer of offers) {
      const checkResult = await this.performLinkCheck(
        offer.affiliate_link,
        offer.brand_name,
        offer.target_country,
        offer.proxy_url,
        offer.proxy_enabled
      );

      this.saveCheckLog(offer, checkResult);
      await this.updateRiskAlert(offer, checkResult);
      await this.sleep(2000);
    }
  }

  private async performLinkCheck(
    affiliateLink: string,
    expectedBrand: string,
    targetCountry: string,
    proxyUrl: string | null,
    proxyEnabled: boolean
  ): Promise<any> {

    // Step 1: 检查是否启用代理
    if (!proxyEnabled || !proxyUrl) {
      throw new Error('代理未启用或未配置，无法执行链接检测');
    }

    // Step 2: 使用代理创建浏览器
    const { browser, context } = await createBrowserWithProxy(proxyUrl);

    try {
      const page = await context.newPage();

      // Step 3: 访问推广链接
      const startTime = Date.now();
      const response = await page.goto(affiliateLink, {
        waitUntil: 'networkidle',
        timeout: 30000
      });
      const responseTime = Date.now() - startTime;

      // Step 4: 验证品牌
      const brandFound = await this.verifyBrand(page, expectedBrand);

      // Step 5: 截图（如果检测失败）
      let screenshotPath = null;
      if (!brandFound.found || brandFound.score < 0.5) {
        screenshotPath = `/screenshots/link-check-${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
      }

      return {
        check_status: brandFound.found && brandFound.score >= 0.5 ? 'success' : 'failed',
        is_accessible: response?.status() < 400,
        final_url: page.url(),
        page_title: await page.title(),
        brand_found: brandFound.found,
        brand_match_score: brandFound.score,
        response_time: responseTime,
        screenshot_path: screenshotPath,
        proxy_used: proxyUrl
      };

    } finally {
      await context.close();
      await browser.close();
    }
  }
}
```

---

## 前端UI设计

**注意**: 代理配置UI已整合到统一配置页面中，详见 `SETTINGS_PAGE_DESIGN.md`

### 整合说明

代理配置不再使用单独的页面，而是作为统一配置页面的一个Tab标签：

**页面路径**: `/settings`

**Tab结构**:
- Google Ads API
- Gemini API
- **代理配置** ← 代理URL配置在这里

### 核心组件

代理配置组件 `components/settings/ProxySettings.tsx` 提供以下功能：

**1. Proxy URL输入和验证**
- ✅ 输入代理服务商提供的API URL
- ✅ 实时格式验证（必须包含cc、ips、proxyType=http、responseType=txt）
- ✅ "测试代理URL"按钮验证连接
- ✅ 显示验证结果和国家代码

**2. 启用/禁用开关**
- ✅ 只有验证通过后才能启用
- ✅ 启用后所有业务场景自动使用代理

**3. 验证反馈**
- ✅ 成功：显示绿色提示 + 国家名称 + 测试IP
- ✅ 失败：显示红色错误列表，详细说明问题

**4. 国家代码说明**
- ROW = 美国
- UK = 英国
- CA = 加拿大

**完整UI实现详见**: `SETTINGS_PAGE_DESIGN.md` 中的 `ProxySettings` 组件

---

## API设计

### 1. POST /api/settings/proxy/validate - 验证Proxy URL

**请求**:
```json
{
  "proxy_url": "https://api.iprocket.io/api?username=user&password=pass&cc=ROW&ips=1&proxyType=http&responseType=txt"
}
```

**响应成功 (200)**:
```json
{
  "success": true,
  "message": "验证成功",
  "data": {
    "is_valid": true,
    "country_code": "ROW",
    "test_ip": "15.235.13.80:5959"
  }
}
```

**响应失败 (400)**:
```json
{
  "success": false,
  "errors": [
    "缺少国家代码参数 (cc)，请确认URL包含 cc=UK、cc=CA 或 cc=ROW",
    "代理类型必须为HTTP，请确认URL包含 proxyType=http"
  ]
}
```

**后端实现**:
```typescript
// app/api/settings/proxy/validate/route.ts
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { proxy_url } = body;

  // Step 1: 格式验证
  const validation = validateProxyUrl(proxy_url);
  if (!validation.isValid) {
    return NextResponse.json({
      success: false,
      errors: validation.errors
    }, { status: 400 });
  }

  // Step 2: 实际测试（获取代理IP）
  try {
    const proxy = await fetchProxyIp(proxy_url);

    return NextResponse.json({
      success: true,
      message: '验证成功',
      data: {
        is_valid: true,
        country_code: validation.countryCode,
        test_ip: proxy.fullAddress
      }
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      errors: [error instanceof Error ? error.message : '获取代理IP失败']
    }, { status: 400 });
  }
}
```

### 2. PUT /api/settings/proxy - 更新代理设置

**请求**:
```json
{
  "proxy_url": "https://api.iprocket.io/api?...",
  "proxy_enabled": true
}
```

**响应**:
```json
{
  "success": true,
  "message": "代理设置已保存"
}
```

### 3. GET /api/settings/proxy/status - 获取代理状态

**响应**:
```json
{
  "success": true,
  "data": {
    "proxy_enabled": true,
    "country_code": "ROW",
    "last_validated_at": "2025-01-18T10:30:00Z"
  }
}
```

---

## 错误处理

### 1. 代理获取失败

**场景**: 代理服务商API不可用或返回错误

**处理**:
```typescript
try {
  const proxy = await getProxyIp(proxyUrl);
} catch (error) {
  // 记录错误日志
  console.error('获取代理IP失败:', error);

  // 不降级为直连访问，直接抛出错误
  throw new Error('代理服务不可用，无法执行操作。请检查代理配置或联系管理员。');
}
```

**关键原则**: **绝不降级为直连访问**

### 2. 代理IP不可用

**场景**: 获取的代理IP无法连接

**处理**:
```typescript
// 带重试机制的代理使用
async function useProxyWithRetry(proxyUrl: string, maxRetries = 3): Promise<ProxyCredentials> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      // 强制刷新获取新IP
      const proxy = await getProxyIp(proxyUrl, true);

      // 测试IP是否可用（发送测试请求）
      await testProxyConnection(proxy);

      return proxy;

    } catch (error) {
      console.error(`代理IP尝试 ${i + 1}/${maxRetries} 失败:`, error);

      if (i === maxRetries - 1) {
        throw new Error('代理服务连续失败，无法执行操作');
      }

      // 等待2秒后重试
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  throw new Error('代理服务不可用');
}
```

### 3. URL格式错误

**处理**: 前端实时验证 + 后端二次验证

```typescript
// 前端实时验证
const handleProxyUrlChange = (value: string) => {
  setProxyUrl(value);

  if (value.length > 10) {
    const validation = validateProxyUrl(value);
    setValidationErrors(validation.errors);
  }
};
```

---

## 安全考虑

### 1. 敏感信息保护

**问题**: Proxy URL包含username和password

**解决方案**:
```typescript
// 数据库存储时加密
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;

export function encryptProxyUrl(proxyUrl: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);

  let encrypted = cipher.update(proxyUrl, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
}

export function decryptProxyUrl(encryptedProxyUrl: string): string {
  const [ivHex, encrypted, authTagHex] = encryptedProxyUrl.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

**数据库Schema更新**:
```sql
-- 使用加密存储
ALTER TABLE user_settings ADD COLUMN encrypted_proxy_url TEXT;
```

### 2. 日志脱敏

**问题**: 日志中不应暴露完整的代理URL

**解决方案**:
```typescript
export function maskProxyUrl(proxyUrl: string): string {
  try {
    const url = new URL(proxyUrl);
    const params = new URLSearchParams(url.search);

    // 保留cc参数，隐藏认证信息
    const cc = params.get('cc');
    return `${url.origin}${url.pathname}?cc=${cc}&...`;

  } catch (error) {
    return '[INVALID_URL]';
  }
}

// 使用
console.log('使用代理:', maskProxyUrl(proxyUrl));
// 输出: "https://api.iprocket.io/api?cc=ROW&..."
```

---

## 测试计划

### 1. 单元测试

```typescript
// __tests__/lib/proxy/validate-url.test.ts
describe('validateProxyUrl', () => {
  it('should validate correct proxy URL', () => {
    const url = 'https://api.iprocket.io/api?username=user&password=pass&cc=ROW&ips=1&proxyType=http&responseType=txt';
    const result = validateProxyUrl(url);

    expect(result.isValid).toBe(true);
    expect(result.countryCode).toBe('ROW');
    expect(result.errors).toEqual([]);
  });

  it('should reject URL without cc parameter', () => {
    const url = 'https://api.iprocket.io/api?username=user&password=pass&ips=1&proxyType=http&responseType=txt';
    const result = validateProxyUrl(url);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('缺少国家代码参数 (cc)，请确认URL包含 cc=UK、cc=CA 或 cc=ROW');
  });

  it('should reject URL with wrong proxyType', () => {
    const url = 'https://api.iprocket.io/api?username=user&password=pass&cc=ROW&ips=1&proxyType=socks5&responseType=txt';
    const result = validateProxyUrl(url);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('代理类型必须为HTTP，当前为: socks5');
  });
});
```

### 2. 集成测试

```typescript
// __tests__/api/proxy/validate.test.ts
describe('POST /api/settings/proxy/validate', () => {
  it('should validate and test proxy URL', async () => {
    const response = await fetch('http://localhost:3000/api/settings/proxy/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testToken}`
      },
      body: JSON.stringify({
        proxy_url: 'https://api.iprocket.io/api?username=user&password=pass&cc=ROW&ips=1&proxyType=http&responseType=txt'
      })
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.country_code).toBe('ROW');
    expect(data.data.test_ip).toMatch(/^\d+\.\d+\.\d+\.\d+:\d+$/);
  });
});
```

---

## 实施计划

### Phase 1: 数据库和核心函数（2天）

**Day 1**: 数据库设计
- ✅ 扩展user_settings表
- ✅ 创建proxy_usage_logs表
- ✅ 数据库迁移脚本

**Day 2**: 核心函数实现
- ✅ validateProxyUrl函数
- ✅ fetchProxyIp函数
- ✅ getProxyIp缓存函数
- ✅ 单元测试

### Phase 2: 业务场景集成（3天）

**Day 1**: Playwright集成
- ✅ createBrowserWithProxy函数
- ✅ scrapeProductWithProxy函数

**Day 2**: HTTP请求集成
- ✅ fetchFinalUrl函数
- ✅ extractUrlSuffix函数

**Day 3**: 风险检测集成
- ✅ 更新AffiliateLinkChecker
- ✅ 集成测试

### Phase 3: API和前端（3天）

**Day 1**: API实现
- ✅ POST /api/settings/proxy/validate
- ✅ PUT /api/settings/proxy
- ✅ GET /api/settings/proxy/status

**Day 2**: 前端UI
- ✅ 配置页面代理设置区域
- ✅ 实时验证和错误提示
- ✅ 代理状态指示器

**Day 3**: 集成和优化
- ✅ 前后端联调
- ✅ 错误处理完善

### Phase 4: 测试和部署（2天）

**Day 1**: 测试
- ✅ E2E测试
- ✅ 性能测试
- ✅ 安全测试

**Day 2**: 部署
- ✅ 数据库迁移
- ✅ 功能验证
- ✅ 文档更新

**总工作量**: 10个工作日

---

## 附录

### A. 代理服务商比较

| 服务商 | 支持国家 | 价格 | 稳定性 | 备注 |
|--------|---------|------|--------|------|
| IPRocket | 150+ | $$$ | 高 | 推荐使用 |
| Bright Data | 195+ | $$$$ | 很高 | 企业级 |
| Oxylabs | 100+ | $$$$ | 很高 | 高端选择 |
| SmartProxy | 195+ | $$ | 中 | 性价比高 |

### B. 相关文档

- `RISK_ALERT_DESIGN.md`: 风险检测功能（使用代理）
- `ONE_CLICK_LAUNCH.md`: 一键上广告（数据爬取使用代理）
- `TECHNICAL_SPEC_V2.md`: 数据库Schema

---

**文档状态**: ✅ 设计完成
**下一步**: 开始Phase 1 - 数据库和核心函数
**预计上线时间**: 10个工作日后
