# 风险提示功能设计文档

**文档版本**: v1.0
**创建日期**: 2025-01-18
**目的**: 在数据大盘增加"风险提示"板块，实时监控推广链接有效性和Google Ads账号状态
**状态**: ✅ Ready for Implementation

---

## 📋 功能概述

### 目标

在数据大盘增加"风险提示"板块，帮助用户及时发现和解决以下风险：
1. **推广链接失效风险**：affiliate_link无法访问或跳转页面异常
2. **Google Ads账号风险**：账号被暂停、限制投放、预算不足等

### 核心特性

- ✅ **每日自动检测**：定时任务自动执行检测
- ✅ **真实环境测试**：使用代理模拟目标国家的访问环境
- ✅ **智能验证**：验证跳转页面是否包含正确的品牌信息
- ✅ **实时提醒**：在Dashboard显著位置展示风险提示
- ✅ **历史记录**：保留检测历史，便于追溯和分析
- ✅ **风险分级**：critical（严重）/ warning（警告）/ info（提示）

---

## 一、数据库Schema设计

### 1.1 risk_alerts表（风险提示表）

```sql
CREATE TABLE risk_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,

  -- 风险类型
  alert_type TEXT NOT NULL,              -- 风险类型：affiliate_link_failed | ads_account_suspended | ads_account_limited | budget_exhausted
  severity TEXT NOT NULL,                -- 严重程度：critical | warning | info

  -- 关联实体
  entity_type TEXT NOT NULL,             -- 实体类型：offer | ads_account | campaign
  entity_id INTEGER NOT NULL,            -- 实体ID
  entity_name TEXT,                      -- 实体名称（冗余，便于显示）

  -- 风险详情
  title TEXT NOT NULL,                   -- 风险标题
  description TEXT NOT NULL,             -- 风险描述
  details TEXT,                          -- 详细信息（JSON格式）

  -- 状态
  status TEXT NOT NULL DEFAULT 'active', -- 状态：active（活跃）| resolved（已解决）| ignored（已忽略）
  resolved_at TEXT,                      -- 解决时间
  resolved_by TEXT,                      -- 解决方式：auto（自动）| manual（手动）

  -- 时间戳
  detected_at TEXT NOT NULL DEFAULT (datetime('now')),  -- 检测时间
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX idx_risk_alerts_user_id ON risk_alerts(user_id);
CREATE INDEX idx_risk_alerts_status ON risk_alerts(status);
CREATE INDEX idx_risk_alerts_severity ON risk_alerts(severity);
CREATE INDEX idx_risk_alerts_entity ON risk_alerts(entity_type, entity_id);
CREATE INDEX idx_risk_alerts_detected_at ON risk_alerts(detected_at DESC);
```

### 1.2 link_check_logs表（链接检测日志表）

```sql
CREATE TABLE link_check_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  offer_id INTEGER NOT NULL,

  -- 检测目标
  affiliate_link TEXT NOT NULL,          -- 被检测的推广链接
  target_country TEXT NOT NULL,          -- 目标国家
  expected_brand TEXT NOT NULL,          -- 期望的品牌名称

  -- 检测结果
  check_status TEXT NOT NULL,            -- 检测状态：success | failed | timeout | error
  is_accessible BOOLEAN NOT NULL,        -- 链接是否可访问
  final_url TEXT,                        -- 最终跳转URL
  response_time INTEGER,                 -- 响应时间（毫秒）

  -- 页面验证
  page_title TEXT,                       -- 页面标题
  brand_found BOOLEAN,                   -- 是否找到品牌名
  brand_match_score REAL,                -- 品牌匹配度（0-1）
  page_content_sample TEXT,              -- 页面内容样本（前500字符）
  screenshot_path TEXT,                  -- 截图路径

  -- 错误信息
  error_type TEXT,                       -- 错误类型：network_error | timeout | redirect_error | validation_error
  error_message TEXT,                    -- 错误消息

  -- 代理信息
  proxy_used TEXT,                       -- 使用的代理服务器
  proxy_country TEXT,                    -- 代理国家

  -- 时间戳
  checked_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX idx_link_check_logs_user_id ON link_check_logs(user_id);
CREATE INDEX idx_link_check_logs_offer_id ON link_check_logs(offer_id);
CREATE INDEX idx_link_check_logs_checked_at ON link_check_logs(checked_at DESC);
CREATE INDEX idx_link_check_logs_check_status ON link_check_logs(check_status);
```

### 1.3 ads_account_check_logs表（Google Ads账号检测日志表）

```sql
CREATE TABLE ads_account_check_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  ads_account_id INTEGER NOT NULL,

  -- 账号信息
  customer_id TEXT NOT NULL,             -- Google Ads Customer ID

  -- 检测结果
  check_status TEXT NOT NULL,            -- 检测状态：success | failed | unauthorized | error
  account_status TEXT,                   -- 账号状态：ENABLED | SUSPENDED | CANCELED | UNKNOWN
  serving_status TEXT,                   -- 投放状态：SERVING | SUSPENDED | ELIGIBLE | ENDED

  -- 账号健康度
  can_manage_clients BOOLEAN,            -- 是否可管理客户
  has_campaigns BOOLEAN,                 -- 是否有Campaign
  total_campaigns INTEGER,               -- Campaign总数
  active_campaigns INTEGER,              -- 活跃Campaign数量

  -- 预算信息
  currency_code TEXT,                    -- 货币代码
  total_budget REAL,                     -- 总预算
  spent_budget REAL,                     -- 已消费
  remaining_budget REAL,                 -- 剩余预算

  -- 限制和警告
  restrictions TEXT,                     -- 限制信息（JSON数组）
  warnings TEXT,                         -- 警告信息（JSON数组）

  -- 错误信息
  error_type TEXT,                       -- 错误类型：auth_error | api_error | network_error
  error_message TEXT,                    -- 错误消息

  -- 时间戳
  checked_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (ads_account_id) REFERENCES google_ads_accounts(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX idx_ads_account_check_logs_user_id ON ads_account_check_logs(user_id);
CREATE INDEX idx_ads_account_check_logs_ads_account_id ON ads_account_check_logs(ads_account_id);
CREATE INDEX idx_ads_account_check_logs_checked_at ON ads_account_check_logs(checked_at DESC);
CREATE INDEX idx_ads_account_check_logs_account_status ON ads_account_check_logs(account_status);
```

---

## 二、推广链接检测实现

### 2.1 检测流程

```
┌─────────────────────────────────────────────────────┐
│ Step 1: 获取所有需要检测的Offer                      │
│ - 查询ad_status = 'active'的Offer                   │
│ - 按user_id分组                                      │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ Step 2: 为每个Offer配置代理                          │
│ - 根据target_country选择对应国家的代理               │
│ - 配置Playwright浏览器使用代理                       │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ Step 3: 访问affiliate_link                          │
│ - 设置30秒超时                                       │
│ - 记录HTTP状态码                                     │
│ - 跟踪重定向链                                       │
│ - 捕获最终落地页URL                                  │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ Step 4: 验证最终页面                                 │
│ - 提取页面标题                                       │
│ - 搜索品牌名关键词（brand_name）                     │
│ - 计算品牌匹配度分数                                 │
│ - 截图保存（用于人工审核）                           │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ Step 5: 记录检测结果                                 │
│ - 保存到link_check_logs表                           │
│ - 如果检测失败，创建risk_alert                       │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ Step 6: 更新风险提示                                 │
│ - 如果之前有active的风险且现在检测通过 → 标记resolved│
│ - 如果检测失败且之前无风险 → 创建新风险             │
└─────────────────────────────────────────────────────┘
```

### 2.2 实现代码

```typescript
// lib/risk-detection/affiliate-link-checker.ts
import { chromium, Browser, Page } from 'playwright';
import Database from 'better-sqlite3';

const db = new Database(process.env.DATABASE_PATH!);

interface ProxyConfig {
  server: string;
  username?: string;
  password?: string;
  country: string;
}

// 代理配置（按国家）
const PROXY_CONFIGS: Record<string, ProxyConfig> = {
  'US': {
    server: process.env.PROXY_US_SERVER!,
    username: process.env.PROXY_USERNAME,
    password: process.env.PROXY_PASSWORD,
    country: 'US'
  },
  'GE': {
    server: process.env.PROXY_GE_SERVER!,
    username: process.env.PROXY_USERNAME,
    password: process.env.PROXY_PASSWORD,
    country: 'GE'
  },
  'FR': {
    server: process.env.PROXY_FR_SERVER!,
    username: process.env.PROXY_USERNAME,
    password: process.env.PROXY_PASSWORD,
    country: 'FR'
  },
  // ... 其他国家的代理配置
};

/**
 * 推广链接检测器
 */
export class AffiliateLinkChecker {
  private browser: Browser | null = null;

  /**
   * 检测单个Offer的推广链接
   */
  async checkAffiliateLinkForOffer(offerId: number): Promise<void> {
    // 1. 获取Offer信息
    const offer = db.prepare(`
      SELECT
        o.id, o.user_id, o.affiliate_link, o.brand_name,
        o.target_country, o.offer_name
      FROM offers o
      WHERE o.id = ? AND o.ad_status = 'active'
    `).get(offerId) as any;

    if (!offer) {
      console.log(`Offer ${offerId} not found or not active`);
      return;
    }

    // 2. 执行检测
    const checkResult = await this.performLinkCheck(
      offer.affiliate_link,
      offer.brand_name,
      offer.target_country
    );

    // 3. 保存检测日志
    const logId = this.saveCheckLog(offer, checkResult);

    // 4. 更新风险提示
    await this.updateRiskAlert(offer, checkResult, logId);
  }

  /**
   * 批量检测所有活跃Offer
   */
  async checkAllActiveOffers(): Promise<void> {
    console.log('[Link Checker] Starting batch check for all active offers...');

    // 获取所有活跃的Offer
    const offers = db.prepare(`
      SELECT
        id, user_id, affiliate_link, brand_name,
        target_country, offer_name
      FROM offers
      WHERE ad_status = 'active'
      ORDER BY user_id, id
    `).all() as any[];

    console.log(`[Link Checker] Found ${offers.length} active offers to check`);

    // 初始化浏览器
    await this.initBrowser();

    let successCount = 0;
    let failedCount = 0;

    try {
      // 逐个检测（避免并发过多导致代理服务器压力）
      for (const offer of offers) {
        try {
          console.log(`[Link Checker] Checking offer ${offer.offer_name} (${offer.id})...`);

          const checkResult = await this.performLinkCheck(
            offer.affiliate_link,
            offer.brand_name,
            offer.target_country
          );

          // 保存日志
          const logId = this.saveCheckLog(offer, checkResult);

          // 更新风险提示
          await this.updateRiskAlert(offer, checkResult, logId);

          if (checkResult.check_status === 'success' && checkResult.is_accessible) {
            successCount++;
          } else {
            failedCount++;
          }

          // 避免请求过快，间隔2秒
          await this.sleep(2000);

        } catch (error: any) {
          console.error(`[Link Checker] Error checking offer ${offer.id}:`, error.message);
          failedCount++;
        }
      }
    } finally {
      // 关闭浏览器
      await this.closeBrowser();
    }

    console.log(`[Link Checker] Batch check completed. Success: ${successCount}, Failed: ${failedCount}`);
  }

  /**
   * 执行链接检测
   */
  private async performLinkCheck(
    affiliateLink: string,
    expectedBrand: string,
    targetCountry: string
  ): Promise<any> {
    const startTime = Date.now();
    const result: any = {
      affiliate_link: affiliateLink,
      target_country: targetCountry,
      expected_brand: expectedBrand,
      check_status: 'failed',
      is_accessible: false,
      final_url: null,
      response_time: null,
      page_title: null,
      brand_found: false,
      brand_match_score: 0,
      page_content_sample: null,
      screenshot_path: null,
      error_type: null,
      error_message: null,
      proxy_used: null,
      proxy_country: targetCountry
    };

    let page: Page | null = null;

    try {
      // 1. 获取代理配置
      const proxyConfig = PROXY_CONFIGS[targetCountry];
      if (!proxyConfig) {
        throw new Error(`No proxy configured for country: ${targetCountry}`);
      }
      result.proxy_used = proxyConfig.server;

      // 2. 创建浏览器上下文
      if (!this.browser) {
        await this.initBrowser();
      }

      const context = await this.browser!.newContext({
        proxy: {
          server: proxyConfig.server,
          username: proxyConfig.username,
          password: proxyConfig.password
        },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        locale: this.getLocaleForCountry(targetCountry),
        viewport: { width: 1920, height: 1080 }
      });

      page = await context.newPage();

      // 3. 访问affiliate_link
      const response = await page.goto(affiliateLink, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      const responseTime = Date.now() - startTime;
      result.response_time = responseTime;

      // 4. 检查HTTP状态
      if (!response || response.status() >= 400) {
        result.error_type = 'network_error';
        result.error_message = `HTTP ${response?.status() || 'N/A'}`;
        return result;
      }

      // 5. 获取最终URL
      result.final_url = page.url();
      result.is_accessible = true;

      // 6. 提取页面信息
      result.page_title = await page.title();

      const pageContent = await page.content();
      result.page_content_sample = pageContent.substring(0, 500);

      // 7. 验证品牌名
      const brandFound = await this.verifyBrand(page, expectedBrand);
      result.brand_found = brandFound.found;
      result.brand_match_score = brandFound.score;

      // 8. 截图（仅在检测失败时保存）
      if (!brandFound.found || brandFound.score < 0.5) {
        const screenshotPath = `screenshots/link-check-${Date.now()}.png`;
        await page.screenshot({
          path: `public/${screenshotPath}`,
          fullPage: true
        });
        result.screenshot_path = screenshotPath;
      }

      // 9. 判断检测状态
      if (brandFound.found && brandFound.score >= 0.5) {
        result.check_status = 'success';
      } else {
        result.check_status = 'failed';
        result.error_type = 'validation_error';
        result.error_message = `Brand "${expectedBrand}" not found or match score too low (${brandFound.score})`;
      }

      // 关闭页面和上下文
      await page.close();
      await context.close();

    } catch (error: any) {
      result.check_status = 'error';

      if (error.name === 'TimeoutError') {
        result.error_type = 'timeout';
        result.error_message = 'Page load timeout (30s)';
      } else {
        result.error_type = 'error';
        result.error_message = error.message;
      }

      // 关闭页面
      if (page) {
        try {
          await page.close();
        } catch (e) {
          // Ignore close error
        }
      }
    }

    return result;
  }

  /**
   * 验证页面中是否包含品牌名
   */
  private async verifyBrand(page: Page, brandName: string): Promise<{ found: boolean; score: number }> {
    try {
      const brandLower = brandName.toLowerCase();

      // 1. 检查页面标题
      const title = await page.title();
      const titleContainsBrand = title.toLowerCase().includes(brandLower);

      // 2. 检查页面文本内容
      const bodyText = await page.evaluate(() => document.body.innerText);
      const bodyContainsBrand = bodyText.toLowerCase().includes(brandLower);

      // 3. 检查meta标签
      const metaDescription = await page.evaluate(() => {
        const meta = document.querySelector('meta[name="description"]');
        return meta ? meta.getAttribute('content') : '';
      });
      const metaContainsBrand = metaDescription?.toLowerCase().includes(brandLower) || false;

      // 4. 计算匹配分数
      let score = 0;
      if (titleContainsBrand) score += 0.5;
      if (bodyContainsBrand) score += 0.3;
      if (metaContainsBrand) score += 0.2;

      const found = titleContainsBrand || bodyContainsBrand;

      return { found, score };

    } catch (error) {
      console.error('Brand verification error:', error);
      return { found: false, score: 0 };
    }
  }

  /**
   * 保存检测日志
   */
  private saveCheckLog(offer: any, checkResult: any): number {
    const stmt = db.prepare(`
      INSERT INTO link_check_logs (
        user_id, offer_id, affiliate_link, target_country, expected_brand,
        check_status, is_accessible, final_url, response_time,
        page_title, brand_found, brand_match_score, page_content_sample, screenshot_path,
        error_type, error_message, proxy_used, proxy_country,
        checked_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    const result = stmt.run(
      offer.user_id,
      offer.id,
      checkResult.affiliate_link,
      checkResult.target_country,
      checkResult.expected_brand,
      checkResult.check_status,
      checkResult.is_accessible ? 1 : 0,
      checkResult.final_url,
      checkResult.response_time,
      checkResult.page_title,
      checkResult.brand_found ? 1 : 0,
      checkResult.brand_match_score,
      checkResult.page_content_sample,
      checkResult.screenshot_path,
      checkResult.error_type,
      checkResult.error_message,
      checkResult.proxy_used,
      checkResult.proxy_country
    );

    return result.lastInsertRowid as number;
  }

  /**
   * 更新风险提示
   */
  private async updateRiskAlert(offer: any, checkResult: any, logId: number): Promise<void> {
    const isSuccess = checkResult.check_status === 'success' &&
                     checkResult.is_accessible &&
                     checkResult.brand_found;

    if (isSuccess) {
      // 检测成功 - 将之前的active风险标记为resolved
      db.prepare(`
        UPDATE risk_alerts
        SET status = 'resolved',
            resolved_at = datetime('now'),
            resolved_by = 'auto',
            updated_at = datetime('now')
        WHERE user_id = ?
          AND entity_type = 'offer'
          AND entity_id = ?
          AND alert_type = 'affiliate_link_failed'
          AND status = 'active'
      `).run(offer.user_id, offer.id);

    } else {
      // 检测失败 - 检查是否已有active风险
      const existingAlert = db.prepare(`
        SELECT id FROM risk_alerts
        WHERE user_id = ?
          AND entity_type = 'offer'
          AND entity_id = ?
          AND alert_type = 'affiliate_link_failed'
          AND status = 'active'
        LIMIT 1
      `).get(offer.user_id, offer.id);

      if (!existingAlert) {
        // 创建新风险提示
        const title = `推广链接失效：${offer.offer_name}`;
        const description = this.generateErrorDescription(checkResult);
        const details = JSON.stringify({
          affiliate_link: checkResult.affiliate_link,
          error_type: checkResult.error_type,
          error_message: checkResult.error_message,
          final_url: checkResult.final_url,
          brand_found: checkResult.brand_found,
          brand_match_score: checkResult.brand_match_score,
          screenshot_path: checkResult.screenshot_path,
          log_id: logId
        });

        db.prepare(`
          INSERT INTO risk_alerts (
            user_id, alert_type, severity, entity_type, entity_id, entity_name,
            title, description, details, status, detected_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'), datetime('now'), datetime('now'))
        `).run(
          offer.user_id,
          'affiliate_link_failed',
          'critical',
          'offer',
          offer.id,
          offer.offer_name,
          title,
          description,
          details
        );

        console.log(`[Link Checker] Created risk alert for offer ${offer.offer_name}`);
      }
    }
  }

  /**
   * 生成错误描述
   */
  private generateErrorDescription(checkResult: any): string {
    if (checkResult.error_type === 'timeout') {
      return '推广链接访问超时（30秒），可能是网络问题或链接已失效。';
    } else if (checkResult.error_type === 'network_error') {
      return `推广链接返回HTTP ${checkResult.error_message}，链接可能已失效。`;
    } else if (checkResult.error_type === 'validation_error') {
      return `推广链接可访问，但页面未找到品牌名"${checkResult.expected_brand}"，可能跳转到错误页面。`;
    } else {
      return `推广链接检测失败：${checkResult.error_message}`;
    }
  }

  /**
   * 初始化浏览器
   */
  private async initBrowser(): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
  }

  /**
   * 关闭浏览器
   */
  private async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * 获取国家对应的Locale
   */
  private getLocaleForCountry(countryCode: string): string {
    const localeMap: Record<string, string> = {
      'US': 'en-US',
      'GE': 'de-DE',
      'FR': 'fr-FR',
      'UK': 'en-GB',
      'CA': 'en-CA',
      'AU': 'en-AU',
      'ES': 'es-ES',
      'IT': 'it-IT',
      'JP': 'ja-JP',
      'BR': 'pt-BR'
    };
    return localeMap[countryCode] || 'en-US';
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

## 三、Google Ads账号状态检测

### 3.1 检测流程

```
┌─────────────────────────────────────────────────────┐
│ Step 1: 获取所有需要检测的Google Ads账号             │
│ - 查询google_ads_accounts表                         │
│ - 按user_id分组                                      │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ Step 2: 初始化Google Ads API客户端                   │
│ - 使用developer_token                                │
│ - 解密refresh_token                                  │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ Step 3: 查询账号状态                                 │
│ - 调用customer.query()获取账号信息                   │
│ - 获取account_status和serving_status                │
│ - 获取预算和消费信息                                 │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ Step 4: 检查限制和警告                               │
│ - 查询账号限制（restrictions）                       │
│ - 查询账号警告（warnings）                           │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ Step 5: 记录检测结果                                 │
│ - 保存到ads_account_check_logs表                    │
│ - 如果发现问题，创建risk_alert                       │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ Step 6: 更新风险提示                                 │
│ - 账号被暂停 → 创建critical风险                      │
│ - 账号受限 → 创建warning风险                         │
│ - 预算不足 → 创建warning风险                         │
└─────────────────────────────────────────────────────┘
```

### 3.2 实现代码

```typescript
// lib/risk-detection/ads-account-checker.ts
import { GoogleAdsApi } from 'google-ads-api';
import Database from 'better-sqlite3';
import crypto from 'crypto';

const db = new Database(process.env.DATABASE_PATH!);
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');

/**
 * Google Ads账号检测器
 */
export class AdsAccountChecker {
  private googleAdsClient: GoogleAdsApi;

  constructor() {
    this.googleAdsClient = new GoogleAdsApi({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
      developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!
    });
  }

  /**
   * 检测单个Google Ads账号
   */
  async checkAdsAccount(adsAccountId: number): Promise<void> {
    // 1. 获取账号信息
    const account = db.prepare(`
      SELECT
        id, user_id, customer_id, account_name,
        encrypted_refresh_token, encrypted_access_token
      FROM google_ads_accounts
      WHERE id = ?
    `).get(adsAccountId) as any;

    if (!account) {
      console.log(`Ads account ${adsAccountId} not found`);
      return;
    }

    // 2. 解密token
    const refreshToken = this.decryptToken(account.encrypted_refresh_token);

    // 3. 执行检测
    const checkResult = await this.performAccountCheck(
      account.customer_id,
      refreshToken
    );

    // 4. 保存检测日志
    const logId = this.saveCheckLog(account, checkResult);

    // 5. 更新风险提示
    await this.updateRiskAlert(account, checkResult, logId);
  }

  /**
   * 批量检测所有Google Ads账号
   */
  async checkAllAdsAccounts(): Promise<void> {
    console.log('[Ads Checker] Starting batch check for all ads accounts...');

    const accounts = db.prepare(`
      SELECT
        id, user_id, customer_id, account_name,
        encrypted_refresh_token, encrypted_access_token
      FROM google_ads_accounts
      ORDER BY user_id, id
    `).all() as any[];

    console.log(`[Ads Checker] Found ${accounts.length} ads accounts to check`);

    let successCount = 0;
    let failedCount = 0;

    for (const account of accounts) {
      try {
        console.log(`[Ads Checker] Checking account ${account.account_name} (${account.customer_id})...`);

        const refreshToken = this.decryptToken(account.encrypted_refresh_token);
        const checkResult = await this.performAccountCheck(
          account.customer_id,
          refreshToken
        );

        const logId = this.saveCheckLog(account, checkResult);
        await this.updateRiskAlert(account, checkResult, logId);

        if (checkResult.check_status === 'success') {
          successCount++;
        } else {
          failedCount++;
        }

        // 避免API请求过快
        await this.sleep(1000);

      } catch (error: any) {
        console.error(`[Ads Checker] Error checking account ${account.id}:`, error.message);
        failedCount++;
      }
    }

    console.log(`[Ads Checker] Batch check completed. Success: ${successCount}, Failed: ${failedCount}`);
  }

  /**
   * 执行账号检测
   */
  private async performAccountCheck(customerId: string, refreshToken: string): Promise<any> {
    const result: any = {
      customer_id: customerId,
      check_status: 'failed',
      account_status: null,
      serving_status: null,
      can_manage_clients: false,
      has_campaigns: false,
      total_campaigns: 0,
      active_campaigns: 0,
      currency_code: null,
      total_budget: null,
      spent_budget: null,
      remaining_budget: null,
      restrictions: null,
      warnings: null,
      error_type: null,
      error_message: null
    };

    try {
      // 1. 创建customer实例
      const customer = this.googleAdsClient.Customer({
        customer_id: customerId,
        refresh_token: refreshToken
      });

      // 2. 查询账号基本信息
      const accountQuery = `
        SELECT
          customer.id,
          customer.descriptive_name,
          customer.currency_code,
          customer.manager,
          customer.status,
          customer.serving_status,
          customer.can_manage_clients,
          customer.has_partners_badge
        FROM customer
        WHERE customer.id = ${customerId}
      `;

      const accountResults = await customer.query(accountQuery);
      const accountInfo = accountResults[0]?.customer;

      if (!accountInfo) {
        result.error_type = 'api_error';
        result.error_message = 'Customer not found';
        return result;
      }

      result.account_status = accountInfo.status;
      result.serving_status = accountInfo.serving_status;
      result.can_manage_clients = accountInfo.can_manage_clients;
      result.currency_code = accountInfo.currency_code;

      // 3. 查询Campaign信息
      const campaignQuery = `
        SELECT
          campaign.id,
          campaign.name,
          campaign.status
        FROM campaign
        ORDER BY campaign.id
      `;

      const campaigns = await customer.query(campaignQuery);
      result.total_campaigns = campaigns.length;
      result.active_campaigns = campaigns.filter((c: any) => c.campaign.status === 'ENABLED').length;
      result.has_campaigns = campaigns.length > 0;

      // 4. 查询预算信息（汇总所有Campaign的预算）
      if (campaigns.length > 0) {
        const budgetQuery = `
          SELECT
            campaign_budget.amount_micros,
            campaign.status
          FROM campaign_budget
          JOIN campaign ON campaign.campaign_budget = campaign_budget.resource_name
        `;

        try {
          const budgets = await customer.query(budgetQuery);
          const totalBudget = budgets.reduce((sum: number, b: any) => {
            return sum + (b.campaign_budget?.amount_micros || 0);
          }, 0) / 1_000_000; // 转换为美元

          result.total_budget = totalBudget;
        } catch (error) {
          // Budget查询可能失败，忽略
          console.warn('Budget query failed:', error);
        }
      }

      // 5. 检测限制和警告
      const restrictions: string[] = [];
      const warnings: string[] = [];

      // 账号状态检查
      if (accountInfo.status === 'SUSPENDED') {
        restrictions.push('账号已被暂停');
      } else if (accountInfo.status === 'CANCELED') {
        restrictions.push('账号已取消');
      }

      // 投放状态检查
      if (accountInfo.serving_status === 'SUSPENDED') {
        restrictions.push('投放已暂停');
      } else if (accountInfo.serving_status === 'ENDED') {
        warnings.push('投放已结束');
      }

      // Campaign检查
      if (!result.has_campaigns) {
        warnings.push('账号没有Campaign');
      } else if (result.active_campaigns === 0) {
        warnings.push('所有Campaign都已暂停');
      }

      result.restrictions = restrictions.length > 0 ? JSON.stringify(restrictions) : null;
      result.warnings = warnings.length > 0 ? JSON.stringify(warnings) : null;

      // 6. 判断检测状态
      result.check_status = 'success';

    } catch (error: any) {
      result.check_status = 'error';

      if (error.message?.includes('PERMISSION_DENIED') || error.message?.includes('UNAUTHORIZED')) {
        result.error_type = 'auth_error';
        result.error_message = 'Unauthorized or permission denied';
      } else {
        result.error_type = 'api_error';
        result.error_message = error.message;
      }
    }

    return result;
  }

  /**
   * 保存检测日志
   */
  private saveCheckLog(account: any, checkResult: any): number {
    const stmt = db.prepare(`
      INSERT INTO ads_account_check_logs (
        user_id, ads_account_id, customer_id,
        check_status, account_status, serving_status,
        can_manage_clients, has_campaigns, total_campaigns, active_campaigns,
        currency_code, total_budget, spent_budget, remaining_budget,
        restrictions, warnings, error_type, error_message,
        checked_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    const result = stmt.run(
      account.user_id,
      account.id,
      checkResult.customer_id,
      checkResult.check_status,
      checkResult.account_status,
      checkResult.serving_status,
      checkResult.can_manage_clients ? 1 : 0,
      checkResult.has_campaigns ? 1 : 0,
      checkResult.total_campaigns,
      checkResult.active_campaigns,
      checkResult.currency_code,
      checkResult.total_budget,
      checkResult.spent_budget,
      checkResult.remaining_budget,
      checkResult.restrictions,
      checkResult.warnings,
      checkResult.error_type,
      checkResult.error_message
    );

    return result.lastInsertRowid as number;
  }

  /**
   * 更新风险提示
   */
  private async updateRiskAlert(account: any, checkResult: any, logId: number): Promise<void> {
    const restrictions = checkResult.restrictions ? JSON.parse(checkResult.restrictions) : [];
    const warnings = checkResult.warnings ? JSON.parse(checkResult.warnings) : [];

    // 1. 处理账号暂停风险
    if (checkResult.account_status === 'SUSPENDED' || checkResult.serving_status === 'SUSPENDED') {
      await this.createOrUpdateAlert(
        account,
        'ads_account_suspended',
        'critical',
        `Google Ads账号已暂停：${account.account_name}`,
        '您的Google Ads账号已被暂停，所有广告已停止投放。请登录Google Ads后台查看详情并解决问题。',
        {
          account_status: checkResult.account_status,
          serving_status: checkResult.serving_status,
          restrictions,
          log_id: logId
        }
      );
    } else {
      // 账号正常，将之前的暂停风险标记为resolved
      await this.resolveAlert(account, 'ads_account_suspended');
    }

    // 2. 处理账号受限风险
    if (restrictions.length > 0 && checkResult.account_status !== 'SUSPENDED') {
      await this.createOrUpdateAlert(
        account,
        'ads_account_limited',
        'warning',
        `Google Ads账号受限：${account.account_name}`,
        `账号存在限制：${restrictions.join(', ')}`,
        {
          restrictions,
          warnings,
          log_id: logId
        }
      );
    } else {
      await this.resolveAlert(account, 'ads_account_limited');
    }

    // 3. 处理预算不足风险（如果有预算信息）
    if (checkResult.remaining_budget !== null && checkResult.remaining_budget <= 0) {
      await this.createOrUpdateAlert(
        account,
        'budget_exhausted',
        'warning',
        `Google Ads账号预算耗尽：${account.account_name}`,
        '账号预算已用完，所有广告已停止投放。请增加预算以继续投放。',
        {
          total_budget: checkResult.total_budget,
          spent_budget: checkResult.spent_budget,
          currency_code: checkResult.currency_code,
          log_id: logId
        }
      );
    } else if (checkResult.remaining_budget > 0) {
      await this.resolveAlert(account, 'budget_exhausted');
    }
  }

  /**
   * 创建或更新风险提示
   */
  private async createOrUpdateAlert(
    account: any,
    alertType: string,
    severity: string,
    title: string,
    description: string,
    details: any
  ): Promise<void> {
    const existing = db.prepare(`
      SELECT id FROM risk_alerts
      WHERE user_id = ?
        AND entity_type = 'ads_account'
        AND entity_id = ?
        AND alert_type = ?
        AND status = 'active'
      LIMIT 1
    `).get(account.user_id, account.id, alertType);

    if (!existing) {
      db.prepare(`
        INSERT INTO risk_alerts (
          user_id, alert_type, severity, entity_type, entity_id, entity_name,
          title, description, details, status, detected_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'), datetime('now'), datetime('now'))
      `).run(
        account.user_id,
        alertType,
        severity,
        'ads_account',
        account.id,
        account.account_name,
        title,
        description,
        JSON.stringify(details)
      );

      console.log(`[Ads Checker] Created risk alert: ${title}`);
    }
  }

  /**
   * 解决风险提示
   */
  private async resolveAlert(account: any, alertType: string): Promise<void> {
    db.prepare(`
      UPDATE risk_alerts
      SET status = 'resolved',
          resolved_at = datetime('now'),
          resolved_by = 'auto',
          updated_at = datetime('now')
      WHERE user_id = ?
        AND entity_type = 'ads_account'
        AND entity_id = ?
        AND alert_type = ?
        AND status = 'active'
    `).run(account.user_id, account.id, alertType);
  }

  /**
   * 解密Token
   */
  private decryptToken(encryptedToken: string): string {
    const [ivHex, authTagHex, encrypted] = encryptedToken.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

## 四、定时任务调度

### 4.1 Cron Job配置

使用**node-cron**或**Vercel Cron Jobs**（如果部署在Vercel）

```typescript
// lib/cron/risk-detection-jobs.ts
import cron from 'node-cron';
import { AffiliateLinkChecker } from '@/lib/risk-detection/affiliate-link-checker';
import { AdsAccountChecker } from '@/lib/risk-detection/ads-account-checker';

/**
 * 初始化定时任务
 */
export function initRiskDetectionJobs() {
  // 每天凌晨2点执行推广链接检测
  cron.schedule('0 2 * * *', async () => {
    console.log('[Cron] Starting affiliate link check job...');
    try {
      const linkChecker = new AffiliateLinkChecker();
      await linkChecker.checkAllActiveOffers();
      console.log('[Cron] Affiliate link check job completed');
    } catch (error) {
      console.error('[Cron] Affiliate link check job failed:', error);
    }
  }, {
    timezone: 'UTC'
  });

  // 每天凌晨3点执行Google Ads账号检测
  cron.schedule('0 3 * * *', async () => {
    console.log('[Cron] Starting ads account check job...');
    try {
      const adsChecker = new AdsAccountChecker();
      await adsChecker.checkAllAdsAccounts();
      console.log('[Cron] Ads account check job completed');
    } catch (error) {
      console.error('[Cron] Ads account check job failed:', error);
    }
  }, {
    timezone: 'UTC'
  });

  console.log('[Cron] Risk detection jobs initialized');
}
```

### 4.2 Next.js App Router集成

```typescript
// app/api/cron/risk-detection/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AffiliateLinkChecker } from '@/lib/risk-detection/affiliate-link-checker';
import { AdsAccountChecker } from '@/lib/risk-detection/ads-account-checker';

// Vercel Cron Jobs需要验证Authorization header
const CRON_SECRET = process.env.CRON_SECRET || 'your-secret-key';

export async function GET(request: NextRequest) {
  // 验证Cron Job授权
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const jobType = searchParams.get('type'); // 'link' | 'account'

  try {
    if (jobType === 'link') {
      // 执行推广链接检测
      const linkChecker = new AffiliateLinkChecker();
      await linkChecker.checkAllActiveOffers();
      return NextResponse.json({ success: true, job: 'affiliate_link_check' });

    } else if (jobType === 'account') {
      // 执行Google Ads账号检测
      const adsChecker = new AdsAccountChecker();
      await adsChecker.checkAllAdsAccounts();
      return NextResponse.json({ success: true, job: 'ads_account_check' });

    } else {
      return NextResponse.json({ error: 'Invalid job type' }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Cron job error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

### 4.3 Vercel Cron配置

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/risk-detection?type=link",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/cron/risk-detection?type=account",
      "schedule": "0 3 * * *"
    }
  ]
}
```

---

## 五、前端Dashboard UI设计

### 5.1 组件结构

```
<Dashboard>
  ├── <RiskAlertBanner>         # 顶部风险提示横幅（高优先级）
  ├── <RiskAlertPanel>          # 风险提示详细面板
  │   ├── <CriticalAlerts>      # 严重风险（红色）
  │   ├── <WarningAlerts>       # 警告风险（黄色）
  │   └── <InfoAlerts>          # 提示信息（蓝色）
  └── <RiskHistoryModal>        # 风险历史记录弹窗
```

### 5.2 风险提示横幅

```typescript
// components/dashboard/RiskAlertBanner.tsx
'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, XCircle, Info } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

interface RiskAlert {
  id: number;
  alert_type: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  entity_type: string;
  entity_id: number;
  entity_name: string;
  detected_at: string;
}

export function RiskAlertBanner() {
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveAlerts();
  }, []);

  const fetchActiveAlerts = async () => {
    try {
      const response = await fetch('/api/risk-alerts?status=active&limit=3');
      const data = await response.json();
      setAlerts(data.alerts || []);
    } catch (error) {
      console.error('Failed to fetch risk alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || alerts.length === 0) {
    return null;
  }

  // 只显示最严重的一个风险
  const topAlert = alerts.sort((a, b) => {
    const severityOrder = { critical: 3, warning: 2, info: 1 };
    return severityOrder[b.severity] - severityOrder[a.severity];
  })[0];

  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case 'critical':
        return {
          icon: XCircle,
          variant: 'destructive' as const,
          className: 'border-red-500 bg-red-50',
          iconColor: 'text-red-600'
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          variant: 'default' as const,
          className: 'border-yellow-500 bg-yellow-50',
          iconColor: 'text-yellow-600'
        };
      default:
        return {
          icon: Info,
          variant: 'default' as const,
          className: 'border-blue-500 bg-blue-50',
          iconColor: 'text-blue-600'
        };
    }
  };

  const config = getSeverityConfig(topAlert.severity);
  const Icon = config.icon;

  return (
    <div className="mb-6">
      <Alert variant={config.variant} className={config.className}>
        <Icon className={`h-5 w-5 ${config.iconColor}`} />
        <AlertTitle className="text-lg font-semibold">
          {topAlert.title}
          {alerts.length > 1 && (
            <span className="ml-2 text-sm font-normal text-gray-600">
              +{alerts.length - 1} 个其他风险
            </span>
          )}
        </AlertTitle>
        <AlertDescription className="mt-2">
          {topAlert.description}
          <a
            href="#risk-alerts"
            className="ml-4 text-sm font-medium underline hover:no-underline"
          >
            查看详情 →
          </a>
        </AlertDescription>
      </Alert>
    </div>
  );
}
```

### 5.3 风险提示面板

```typescript
// components/dashboard/RiskAlertPanel.tsx
'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, XCircle, Info, CheckCircle, ExternalLink } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface RiskAlert {
  id: number;
  alert_type: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  entity_type: string;
  entity_id: number;
  entity_name: string;
  details: any;
  detected_at: string;
  status: string;
}

export function RiskAlertPanel() {
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      const response = await fetch('/api/risk-alerts?status=active');
      const data = await response.json();
      setAlerts(data.alerts || []);
    } catch (error) {
      console.error('Failed to fetch risk alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (alertId: number) => {
    try {
      await fetch(`/api/risk-alerts/${alertId}/resolve`, {
        method: 'POST'
      });
      // 刷新列表
      fetchAlerts();
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  };

  const handleIgnore = async (alertId: number) => {
    try {
      await fetch(`/api/risk-alerts/${alertId}/ignore`, {
        method: 'POST'
      });
      fetchAlerts();
    } catch (error) {
      console.error('Failed to ignore alert:', error);
    }
  };

  const filteredAlerts = filter === 'all'
    ? alerts
    : alerts.filter(a => a.severity === filter);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      default:
        return <Info className="h-5 w-5 text-blue-600" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const config = {
      critical: { label: '严重', className: 'bg-red-100 text-red-800' },
      warning: { label: '警告', className: 'bg-yellow-100 text-yellow-800' },
      info: { label: '提示', className: 'bg-blue-100 text-blue-800' }
    };
    const c = config[severity as keyof typeof config] || config.info;
    return <Badge className={c.className}>{c.label}</Badge>;
  };

  const getActionButton = (alert: RiskAlert) => {
    if (alert.alert_type === 'affiliate_link_failed') {
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(`/offers/${alert.entity_id}/edit`, '_blank')}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          修改推广链接
        </Button>
      );
    } else if (alert.alert_type.startsWith('ads_account')) {
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open('https://ads.google.com', '_blank')}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          前往Google Ads
        </Button>
      );
    }
    return null;
  };

  return (
    <Card id="risk-alerts">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold">风险提示</CardTitle>
          <div className="flex gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              全部 ({alerts.length})
            </Button>
            <Button
              variant={filter === 'critical' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('critical')}
            >
              严重 ({alerts.filter(a => a.severity === 'critical').length})
            </Button>
            <Button
              variant={filter === 'warning' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('warning')}
            >
              警告 ({alerts.filter(a => a.severity === 'warning').length})
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-gray-500">加载中...</div>
        ) : filteredAlerts.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-gray-600">暂无风险提示</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAlerts.map(alert => (
              <div
                key={alert.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-1">
                    {getSeverityIcon(alert.severity)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="text-lg font-semibold text-gray-900">
                        {alert.title}
                      </h4>
                      {getSeverityBadge(alert.severity)}
                    </div>

                    <p className="text-sm text-gray-700 mb-3">
                      {alert.description}
                    </p>

                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                      <span>实体: {alert.entity_name}</span>
                      <span>•</span>
                      <span>检测时间: {new Date(alert.detected_at).toLocaleString('zh-CN')}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {getActionButton(alert)}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleResolve(alert.id)}
                      >
                        标记为已解决
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleIgnore(alert.id)}
                      >
                        忽略
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

---

## 六、API设计

### 6.1 获取风险提示列表

```typescript
// app/api/risk-alerts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth/middleware';

const db = new Database(process.env.DATABASE_PATH!);

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const user = (request as AuthenticatedRequest).user!;
  const { searchParams } = new URL(request.url);

  const status = searchParams.get('status') || 'active'; // active | resolved | ignored
  const severity = searchParams.get('severity'); // critical | warning | info
  const limit = parseInt(searchParams.get('limit') || '50');

  try {
    let query = `
      SELECT
        id, alert_type, severity, entity_type, entity_id, entity_name,
        title, description, details, status, detected_at, created_at
      FROM risk_alerts
      WHERE user_id = ?
    `;
    const params: any[] = [user.userId];

    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }

    if (severity) {
      query += ` AND severity = ?`;
      params.push(severity);
    }

    query += ` ORDER BY
      CASE severity
        WHEN 'critical' THEN 1
        WHEN 'warning' THEN 2
        WHEN 'info' THEN 3
      END,
      detected_at DESC
      LIMIT ?
    `;
    params.push(limit);

    const alerts = db.prepare(query).all(...params);

    // 解析details字段（JSON）
    const alertsWithParsedDetails = alerts.map((alert: any) => ({
      ...alert,
      details: alert.details ? JSON.parse(alert.details) : null
    }));

    return NextResponse.json({
      success: true,
      alerts: alertsWithParsedDetails,
      total: alerts.length
    });

  } catch (error: any) {
    console.error('Get risk alerts error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

### 6.2 解决/忽略风险提示

```typescript
// app/api/risk-alerts/[id]/resolve/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth/middleware';

const db = new Database(process.env.DATABASE_PATH!);

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const user = (request as AuthenticatedRequest).user!;
  const alertId = parseInt(params.id);

  try {
    // 验证Alert归属
    const alert = db.prepare(`
      SELECT id FROM risk_alerts
      WHERE id = ? AND user_id = ?
    `).get(alertId, user.userId);

    if (!alert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    // 更新状态为resolved
    db.prepare(`
      UPDATE risk_alerts
      SET status = 'resolved',
          resolved_at = datetime('now'),
          resolved_by = 'manual',
          updated_at = datetime('now')
      WHERE id = ?
    `).run(alertId);

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Resolve alert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// app/api/risk-alerts/[id]/ignore/route.ts
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const user = (request as AuthenticatedRequest).user!;
  const alertId = parseInt(params.id);

  try {
    const alert = db.prepare(`
      SELECT id FROM risk_alerts
      WHERE id = ? AND user_id = ?
    `).get(alertId, user.userId);

    if (!alert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    db.prepare(`
      UPDATE risk_alerts
      SET status = 'ignored',
          updated_at = datetime('now')
      WHERE id = ?
    `).run(alertId);

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Ignore alert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

---

## 七、实施计划

### 7.1 开发阶段

**Phase 1: 数据库和基础架构**（2天）
- [ ] 创建risk_alerts、link_check_logs、ads_account_check_logs表
- [ ] 实现数据库迁移脚本
- [ ] 配置代理服务器

**Phase 2: 推广链接检测**（3天）
- [ ] 实现AffiliateLinkChecker类
- [ ] 集成Playwright浏览器自动化
- [ ] 实现品牌验证逻辑
- [ ] 测试不同国家的代理访问

**Phase 3: Google Ads账号检测**（2天）
- [ ] 实现AdsAccountChecker类
- [ ] 集成Google Ads API查询
- [ ] 测试账号状态检测

**Phase 4: 定时任务**（1天）
- [ ] 配置Cron Jobs
- [ ] 实现API endpoint
- [ ] 测试定时执行

**Phase 5: 前端UI**（3天）
- [ ] 实现RiskAlertBanner组件
- [ ] 实现RiskAlertPanel组件
- [ ] 实现API集成
- [ ] UI/UX优化

**Phase 6: 测试和优化**（2天）
- [ ] 端到端测试
- [ ] 性能优化
- [ ] 错误处理完善

**总工作量**: 13天

---

## 八、环境变量配置

```bash
# .env

# 代理服务器配置
PROXY_US_SERVER=http://us-proxy.example.com:8080
PROXY_GE_SERVER=http://ge-proxy.example.com:8080
PROXY_FR_SERVER=http://fr-proxy.example.com:8080
PROXY_USERNAME=your-proxy-username
PROXY_PASSWORD=your-proxy-password

# Cron Job密钥
CRON_SECRET=your-cron-secret-key

# 截图保存路径
SCREENSHOT_PATH=public/screenshots
```

---

## 九、注意事项

### 9.1 性能优化

- **批量检测间隔**: 每个检测间隔2秒，避免代理服务器压力过大
- **浏览器复用**: 使用单个浏览器实例处理多个检测
- **并发控制**: 限制同时运行的检测任务数量
- **超时设置**: 单个链接检测超时30秒

### 9.2 错误处理

- **网络错误**: 重试机制（最多3次）
- **代理失败**: 记录错误但不阻塞后续检测
- **API限制**: Google Ads API请求限制处理

### 9.3 安全考虑

- **Token加密**: Google Ads refresh_token加密存储
- **Cron授权**: Cron endpoint需要验证Authorization header
- **用户隔离**: 严格的用户数据隔离

---

**文档状态**: ✅ Ready for Implementation
**下一步**: 开始Phase 1开发（数据库和基础架构）
**预计完成时间**: 13个工作日
