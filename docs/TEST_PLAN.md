# 测试计划 (Test Plan)

## 文档概述

本文档详细规划AutoAds系统的测试策略、测试用例、质量标准和验收准则，确保系统质量和稳定性。

---

## 一、测试策略

### 1.1 测试目标

- **功能完整性**：所有功能按需求正常工作
- **数据准确性**：数据同步、存储、展示准确无误
- **用户体验**：流畅的交互体验，无明显卡顿
- **系统稳定性**：长时间运行无崩溃，错误恢复能力强
- **安全性**：Token安全存储，无XSS/CSRF漏洞
- **兼容性**：主流浏览器和设备兼容

### 1.2 测试层次

```
金字塔测试模型：

           ┌─────────────┐
           │  E2E测试   │  10%
           │   (Playwright) │
           └─────────────┘
         ┌─────────────────┐
         │  集成测试       │  30%
         │   (Jest)        │
         └─────────────────┘
       ┌───────────────────────┐
       │  单元测试              │  60%
       │  (Jest + RTL)         │
       └───────────────────────┘
```

### 1.3 测试环境

| 环境 | 用途 | 配置 |
|------|------|------|
| **开发环境** | 日常开发测试 | localhost:3000 + 测试Google Ads账号 |
| **测试环境** | CI/CD自动测试 | Docker容器 + GitHub Actions + 测试账号 |
| **预发布环境** | 生产前验证 | ClawCloud测试服务器（Docker镜像 prod-{commitid}） |
| **生产环境** | 真实用户环境 | ClawCloud生产服务器（Docker镜像 prod-latest） |

### 1.4 测试工具

| 工具 | 用途 | 版本 |
|------|------|------|
| **Jest** | 单元测试、集成测试 | ^29.0.0 |
| **React Testing Library** | 组件测试 | ^14.0.0 |
| **Playwright** | E2E测试、浏览器自动化 | ^1.40.0 |
| **MSW (Mock Service Worker)** | API Mock | ^2.0.0 |
| **Lighthouse** | 性能测试 | ^11.0.0 |
| **OWASP ZAP** | 安全扫描 | ^2.14.0 |

---

## 二、单元测试 (Unit Testing)

### 2.1 测试范围

**核心业务逻辑**：
- [ ] 关键词分类算法
- [ ] 质量评分算法
- [ ] 数据加密/解密
- [ ] 日期计算和格式化
- [ ] 错误处理逻辑

**工具类函数**：
- [ ] Token存储/获取/刷新
- [ ] IndexedDB CRUD操作
- [ ] 数据验证函数
- [ ] 字符截断函数

**组件逻辑**：
- [ ] 表单验证
- [ ] 状态管理
- [ ] 事件处理

### 2.2 测试用例示例

#### 2.2.1 关键词分类测试

```typescript
// __tests__/lib/keywordClassifier.test.ts
import { classifyKeyword } from '@/lib/keywordClassifier';

describe('Keyword Classifier', () => {
  test('应将品牌词分类为EXACT', () => {
    const result = classifyKeyword('Nike', { brandName: 'Nike' });
    expect(result.matchType).toBe('EXACT');
  });

  test('应将2-3词产品词分类为PHRASE', () => {
    const result = classifyKeyword('running shoes');
    expect(result.matchType).toBe('PHRASE');
  });

  test('应将≥4词长尾词分类为BROAD', () => {
    const result = classifyKeyword('best running shoes for marathon');
    expect(result.matchType).toBe('BROAD');
  });

  test('应允许用户手动覆盖分类', () => {
    const result = classifyKeyword('Nike', {
      brandName: 'Nike',
      manualOverride: 'PHRASE'
    });
    expect(result.matchType).toBe('PHRASE');
  });
});
```

#### 2.2.2 质量评分测试

```typescript
// __tests__/lib/qualityScorer.test.ts
import { calculateQualityScore } from '@/lib/qualityScorer';

describe('Quality Scorer', () => {
  const mockCreatives = {
    headlines: [
      'Nike运动鞋 官方旗舰店',
      '限时特惠 全场8折',
      '免费配送 30天退换'
    ],
    descriptions: ['专业运动装备，助您超越极限']
  };

  const mockInput = {
    brandName: 'Nike',
    keywords: ['Nike', '运动鞋', '跑步鞋']
  };

  const mockWebsiteData = {
    usps: ['免费配送', '正品保证', '30天退换'],
    title: 'Nike官方旗舰店'
  };

  test('应返回0-100之间的分数', () => {
    const score = calculateQualityScore(mockCreatives, mockInput, mockWebsiteData);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  test('所有关键词被使用应得满分30分（关键词覆盖率）', () => {
    const score = calculateQualityScore(mockCreatives, mockInput, mockWebsiteData);
    // 假设其他维度都是0分，关键词覆盖率应占30分
    expect(score).toBeGreaterThanOrEqual(30);
  });

  test('创意与官网一致性高应得高分', () => {
    const highAlignmentScore = calculateQualityScore(
      mockCreatives,
      mockInput,
      mockWebsiteData
    );

    const lowAlignmentScore = calculateQualityScore(
      mockCreatives,
      mockInput,
      { ...mockWebsiteData, usps: [], title: 'Unrelated' }
    );

    expect(highAlignmentScore).toBeGreaterThan(lowAlignmentScore);
  });
});
```

#### 2.2.3 Token加密测试

```typescript
// __tests__/lib/tokenStorage.test.ts
import { TokenStorage } from '@/lib/storage/tokenStorage';
import { openDB } from 'idb';

jest.mock('idb');

describe('TokenStorage', () => {
  const mockCustomerId = '1234567890';
  const mockTokens = {
    accessToken: 'mock_access_token',
    refreshToken: 'mock_refresh_token',
    expiryDate: Date.now() + 3600000
  };
  const mockPassword = 'TestPassword123';

  beforeEach(() => {
    localStorage.clear();
  });

  test('应加密存储refresh token', async () => {
    await TokenStorage.storeTokens(mockCustomerId, mockTokens, mockPassword);

    const db = await openDB('AutoAdsDB', 1);
    const account = await db.get('googleAdsAccounts', mockCustomerId);

    expect(account.refreshToken).not.toBe(mockTokens.refreshToken);
    expect(account.refreshToken.length).toBeGreaterThan(0);
  });

  test('应能正确解密refresh token', async () => {
    await TokenStorage.storeTokens(mockCustomerId, mockTokens, mockPassword);
    const decrypted = await TokenStorage.getRefreshToken(mockCustomerId);

    expect(decrypted).toBe(mockTokens.refreshToken);
  });

  test('错误密码应解密失败', async () => {
    await TokenStorage.storeTokens(mockCustomerId, mockTokens, mockPassword);

    // 修改加密密钥
    localStorage.setItem(
      `ads_encryption_key_${mockCustomerId}`,
      'wrong_key'
    );

    await expect(
      TokenStorage.getRefreshToken(mockCustomerId)
    ).rejects.toThrow();
  });
});
```

### 2.3 覆盖率目标

| 类型 | 目标覆盖率 |
|------|-----------|
| **语句覆盖率** (Statements) | ≥75% |
| **分支覆盖率** (Branches) | ≥70% |
| **函数覆盖率** (Functions) | ≥80% |
| **行覆盖率** (Lines) | ≥75% |

---

## 三、集成测试 (Integration Testing)

### 3.1 测试范围

**API集成**：
- [ ] Google Ads OAuth流程
- [ ] Google Ads API调用（Campaign创建、查询）
- [ ] OpenAI/Anthropic API调用
- [ ] 错误处理和重试机制

**数据流**：
- [ ] IndexedDB存储和读取
- [ ] 数据同步流程
- [ ] 缓存机制

### 3.2 测试用例示例

#### 3.2.1 Campaign创建集成测试

```typescript
// __tests__/integration/campaignCreation.test.ts
import { CampaignCreator } from '@/lib/googleAds/campaignCreator';
import { TokenStorage } from '@/lib/storage/tokenStorage';

describe('Campaign Creation Integration', () => {
  let campaignCreator: CampaignCreator;
  const mockCustomerId = '1234567890';

  beforeAll(async () => {
    // 使用测试账号的真实Token
    campaignCreator = new CampaignCreator(
      mockCustomerId,
      process.env.TEST_REFRESH_TOKEN!
    );
  });

  test('应成功创建完整Campaign（10步流程）', async () => {
    const config = {
      campaignName: `Test Campaign ${Date.now()}`,
      dailyBudget: 100000000, // 100 CNY in micros
      creatives: {
        finalUrl: 'https://example.com',
        headlines: Array(15).fill('Test Headline'),
        descriptions: Array(4).fill('Test Description'),
      },
      keywords: [
        { text: 'test keyword', matchType: 'BROAD' }
      ],
      sitelinks: [],
      callouts: ['Free Shipping', '24/7 Support']
    };

    const result = await campaignCreator.createCompleteCampaign(config);

    expect(result.success).toBe(true);
    expect(result.campaignId).toBeDefined();
    expect(result.adGroupId).toBeDefined();
  }, 60000); // 60秒超时

  test('应能处理API错误并回滚', async () => {
    const invalidConfig = {
      campaignName: '', // 无效名称
      dailyBudget: -100,
      creatives: {},
      keywords: []
    };

    await expect(
      campaignCreator.createCompleteCampaign(invalidConfig as any)
    ).rejects.toThrow();
  });
});
```

#### 3.2.2 数据同步集成测试

```typescript
// __tests__/integration/dataSync.test.ts
import { PerformanceSync } from '@/lib/googleAds/performanceSync';
import { openDB } from 'idb';

describe('Performance Data Sync Integration', () => {
  let sync: PerformanceSync;
  const mockAccountId = '1234567890';

  beforeAll(() => {
    sync = new PerformanceSync(
      mockAccountId,
      process.env.TEST_REFRESH_TOKEN!
    );
  });

  test('应成功同步昨天的性能数据', async () => {
    const result = await sync.syncYesterdayPerformance();

    expect(result.success).toBe(true);
    expect(result.recordsCount).toBeGreaterThanOrEqual(0);
  }, 30000);

  test('同步的数据应正确存储到IndexedDB', async () => {
    await sync.syncYesterdayPerformance();

    const db = await openDB('AutoAdsDB', 1);
    const records = await db.getAll('campaign_performance');

    expect(records.length).toBeGreaterThan(0);
    expect(records[0]).toHaveProperty('impressions');
    expect(records[0]).toHaveProperty('clicks');
    expect(records[0]).toHaveProperty('costMicros');
  });

  test('应更新账号的lastSyncedAt时间戳', async () => {
    const beforeSync = Date.now();
    await sync.syncYesterdayPerformance();

    const db = await openDB('AutoAdsDB', 1);
    const account = await db.get('googleAdsAccounts', mockAccountId);

    const lastSynced = new Date(account.lastSyncedAt).getTime();
    expect(lastSynced).toBeGreaterThanOrEqual(beforeSync);
  });
});
```

---

## 四、端到端测试 (E2E Testing)

### 4.1 测试范围

**关键用户流程**：
- [ ] 首次使用流程（OAuth → 创建Offer → 生成创意 → 上线Campaign）
- [ ] 日常使用流程（查看Dashboard → 编辑创意 → 查看优化建议）
- [ ] 错误恢复流程（Token失效 → 重新授权 → 恢复操作）

### 4.2 测试用例示例

#### 4.2.1 完整的首次使用流程

```typescript
// e2e/firstTimeUser.spec.ts
import { test, expect } from '@playwright/test';

test.describe('首次使用完整流程', () => {
  test('用户应能从授权到成功上线广告', async ({ page }) => {
    // Step 1: 访问首页
    await page.goto('http://localhost:3000');

    // Step 2: 点击"连接Google Ads账号"
    await page.click('text=连接Google Ads账号');

    // Step 3: 完成OAuth授权（需要在测试环境模拟）
    // 注意：实际测试中需要使用测试账号自动完成授权
    await expect(page).toHaveURL(/\/oauth\/callback/);

    // Step 4: 选择Google Ads账号
    await page.click('text=选择账号');
    await page.click('[data-testid="account-1234567890"]');
    await page.click('text=确认');

    // Step 5: 创建Offer
    await page.goto('/offers/new');
    await page.fill('[name="brandName"]', 'TestBrand');
    await page.fill('[name="productDescription"]', 'Test Product Description');
    await page.fill('[name="landingPageUrl"]', 'https://example.com');

    // 添加关键词
    await page.fill('[name="keyword"]', 'test keyword');
    await page.click('text=添加关键词');

    await page.click('text=保存Offer');

    // Step 6: 生成AI创意
    await page.click('text=生成广告创意');

    // 等待AI生成完成（最多30秒）
    await page.waitForSelector('text=生成完成', { timeout: 30000 });

    // 验证质量评分显示
    const scoreElement = await page.textContent('[data-testid="quality-score"]');
    const score = parseInt(scoreElement!);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);

    // Step 7: 一键上广告
    await page.click('text=一键上广告');

    // 选择1个变体（品牌导向）
    await page.click('[data-testid="variant-brand"]');
    await page.click('text=确认上线');

    // 等待Campaign创建完成
    await page.waitForSelector('text=广告上线成功', { timeout: 60000 });

    // 验证成功页面
    await expect(page.locator('text=Campaign已成功创建')).toBeVisible();

    // 验证提示上传图片
    await expect(page.locator('text=请在Google Ads控制台上传Images和Logo')).toBeVisible();
  });
});
```

#### 4.2.2 Dashboard数据查看流程

```typescript
// e2e/dashboard.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Dashboard数据大盘', () => {
  test.beforeEach(async ({ page }) => {
    // 假设用户已登录并有数据
    await page.goto('/dashboard');
  });

  test('应显示4个KPI卡片', async ({ page }) => {
    await expect(page.locator('[data-testid="kpi-impressions"]')).toBeVisible();
    await expect(page.locator('[data-testid="kpi-clicks"]')).toBeVisible();
    await expect(page.locator('[data-testid="kpi-cost"]')).toBeVisible();
    await expect(page.locator('[data-testid="kpi-conversions"]')).toBeVisible();
  });

  test('应显示趋势图表', async ({ page }) => {
    const chart = page.locator('[data-testid="trend-chart"]');
    await expect(chart).toBeVisible();

    // 验证图表有数据点
    const dataPoints = await chart.locator('.recharts-line-dot').count();
    expect(dataPoints).toBeGreaterThan(0);
  });

  test('应能切换日期范围', async ({ page }) => {
    // 默认显示近30天
    await expect(page.locator('text=近30天')).toBeVisible();

    // 切换到近7天
    await page.click('text=近30天');
    await page.click('text=近7天');

    // 等待数据更新
    await page.waitForTimeout(1000);

    // 验证URL参数变化
    await expect(page).toHaveURL(/dateRange=7/);
  });

  test('应显示Campaign列表', async ({ page }) => {
    const table = page.locator('[data-testid="campaign-table"]');
    await expect(table).toBeVisible();

    // 验证表头
    await expect(table.locator('text=Campaign名称')).toBeVisible();
    await expect(table.locator('text=展示量')).toBeVisible();
    await expect(table.locator('text=点击量')).toBeVisible();
    await expect(table.locator('text=花费')).toBeVisible();
  });

  test('应显示智能洞察', async ({ page }) => {
    const insights = page.locator('[data-testid="smart-insights"]');
    await expect(insights).toBeVisible();

    // 验证至少有1条洞察
    const insightCards = await insights.locator('.insight-card').count();
    expect(insightCards).toBeGreaterThanOrEqual(1);
  });

  test('应能手动刷新数据', async ({ page }) => {
    const refreshButton = page.locator('[data-testid="refresh-button"]');
    await refreshButton.click();

    // 验证Loading状态
    await expect(page.locator('text=同步中')).toBeVisible();

    // 等待同步完成
    await page.waitForSelector('text=最后同步', { timeout: 10000 });
  });
});
```

#### 4.2.3 内容编辑流程

```typescript
// e2e/contentEditing.spec.ts
import { test, expect } from '@playwright/test';

test.describe('内容编辑与版本管理', () => {
  test('应能编辑Headlines并保存', async ({ page }) => {
    await page.goto('/offers/test-offer-id/creative');

    // 点击编辑按钮
    await page.click('[data-testid="edit-headline-0"]');

    // 修改内容
    const input = page.locator('[data-testid="headline-input-0"]');
    await input.fill('New Headline Text');

    // 验证字符计数
    await expect(page.locator('text=17/30')).toBeVisible();

    // 保存
    await page.click('[data-testid="save-headline-0"]');

    // 验证保存成功
    await expect(page.locator('text=New Headline Text')).toBeVisible();
  });

  test('应能查看版本历史', async ({ page }) => {
    await page.goto('/offers/test-offer-id/creative');

    // 打开版本历史
    await page.click('text=版本历史');

    // 验证版本列表
    const versionList = page.locator('[data-testid="version-list"]');
    await expect(versionList).toBeVisible();

    // 验证至少有1个版本
    const versions = await versionList.locator('.version-item').count();
    expect(versions).toBeGreaterThanOrEqual(1);
  });

  test('应能对比两个版本', async ({ page }) => {
    await page.goto('/offers/test-offer-id/creative');
    await page.click('text=版本历史');

    // 选择两个版本
    await page.click('[data-testid="version-checkbox-0"]');
    await page.click('[data-testid="version-checkbox-1"]');

    // 点击对比
    await page.click('text=对比选中版本');

    // 验证对比视图
    await expect(page.locator('[data-testid="diff-view"]')).toBeVisible();
    await expect(page.locator('text=版本 1')).toBeVisible();
    await expect(page.locator('text=版本 2')).toBeVisible();
  });

  test('应能回滚到历史版本', async ({ page }) => {
    await page.goto('/offers/test-offer-id/creative');
    await page.click('text=版本历史');

    // 选择一个历史版本
    await page.click('[data-testid="version-item-1"]');

    // 点击回滚
    await page.click('text=恢复此版本');

    // 确认对话框
    await page.click('text=确认恢复');

    // 验证恢复成功
    await expect(page.locator('text=版本已恢复')).toBeVisible();
  });
});
```

### 4.3 跨浏览器测试

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
});
```

---

## 五、性能测试

### 5.1 性能指标目标

| 指标 | 目标值 | 测量工具 |
|------|--------|----------|
| **FCP** (First Contentful Paint) | <1.5s | Lighthouse |
| **LCP** (Largest Contentful Paint) | <2.5s | Lighthouse |
| **TTI** (Time to Interactive) | <3.5s | Lighthouse |
| **CLS** (Cumulative Layout Shift) | <0.1 | Lighthouse |
| **FID** (First Input Delay) | <100ms | Lighthouse |
| **Bundle Size** (首次加载) | <500KB | Webpack Bundle Analyzer |

### 5.2 性能测试脚本

```typescript
// e2e/performance.spec.ts
import { test, expect } from '@playwright/test';
import { playAudit } from 'playwright-lighthouse';

test.describe('性能测试', () => {
  test('Dashboard页面应通过Lighthouse性能审计', async ({ page }) => {
    await page.goto('/dashboard');

    await playAudit({
      page,
      thresholds: {
        performance: 90,
        accessibility: 90,
        'best-practices': 90,
        seo: 80,
      },
      reports: {
        formats: {
          html: true,
          json: true,
        },
        directory: './lighthouse-reports',
      },
    });
  });

  test('大数据量Campaign列表应流畅加载', async ({ page }) => {
    // 假设有100+个Campaigns
    await page.goto('/dashboard');

    const startTime = Date.now();

    // 等待表格渲染完成
    await page.waitForSelector('[data-testid="campaign-table"]');

    const loadTime = Date.now() - startTime;

    // 应在2秒内加载完成
    expect(loadTime).toBeLessThan(2000);
  });

  test('IndexedDB查询应快速响应', async ({ page }) => {
    await page.goto('/dashboard');

    // 测试查询性能
    const queryStart = Date.now();

    await page.evaluate(async () => {
      const db = await (window as any).indexedDB.open('AutoAdsDB', 1);
      // 查询所有Campaign性能数据
      const records = await db.getAll('campaign_performance');
      return records;
    });

    const queryTime = Date.now() - queryStart;

    // 查询应在500ms内完成
    expect(queryTime).toBeLessThan(500);
  });
});
```

### 5.3 压力测试

```typescript
// e2e/stress.spec.ts
import { test, expect } from '@playwright/test';

test.describe('压力测试', () => {
  test('应能处理大量数据同步', async ({ page }) => {
    await page.goto('/dashboard');

    // 模拟同步90天数据（大量数据写入IndexedDB）
    await page.evaluate(async () => {
      const { PerformanceSync } = await import('@/lib/googleAds/performanceSync');
      const sync = new PerformanceSync('1234567890', 'test_token');
      await sync.syncHistoricalPerformance(90);
    });

    // 验证页面仍然响应
    await page.click('[data-testid="refresh-button"]');
    await expect(page.locator('text=同步中')).toBeVisible();
  });

  test('应能处理快速连续操作', async ({ page }) => {
    await page.goto('/offers');

    // 快速点击"新建Offer" 10次
    for (let i = 0; i < 10; i++) {
      await page.click('text=新建Offer');
      await page.click('text=取消');
    }

    // 验证页面无错误
    const errors = await page.locator('.error-message').count();
    expect(errors).toBe(0);
  });
});
```

---

## 六、安全测试

### 6.1 安全测试清单

- [ ] **XSS防护**：所有用户输入应正确转义
- [ ] **CSRF防护**：关键操作需CSRF Token
- [ ] **Token安全**：Refresh Token加密存储
- [ ] **HTTPS强制**：生产环境强制HTTPS
- [ ] **CSP策略**：配置Content Security Policy
- [ ] **依赖扫描**：无已知高危漏洞

### 6.2 安全测试用例

#### 6.2.1 XSS防护测试

```typescript
// e2e/security/xss.spec.ts
import { test, expect } from '@playwright/test';

test.describe('XSS防护', () => {
  test('Offer名称应转义恶意脚本', async ({ page }) => {
    await page.goto('/offers/new');

    // 尝试注入脚本
    const maliciousInput = '<script>alert("XSS")</script>';
    await page.fill('[name="brandName"]', maliciousInput);
    await page.fill('[name="productDescription"]', 'Test');
    await page.fill('[name="landingPageUrl"]', 'https://example.com');
    await page.click('text=保存Offer');

    // 验证脚本未执行
    await page.goto('/offers');
    const displayedName = await page.textContent('[data-testid="offer-name"]');

    // 应显示转义后的文本，而不是执行脚本
    expect(displayedName).toContain('&lt;script&gt;');

    // 验证没有alert弹窗
    page.on('dialog', () => {
      throw new Error('XSS attack succeeded!');
    });
  });

  test('Headlines应转义HTML标签', async ({ page }) => {
    await page.goto('/offers/test-offer/creative');

    await page.click('[data-testid="edit-headline-0"]');
    await page.fill('[data-testid="headline-input-0"]', '<b>Bold Text</b>');
    await page.click('[data-testid="save-headline-0"]');

    const html = await page.innerHTML('[data-testid="headline-0"]');

    // HTML标签应被转义
    expect(html).toContain('&lt;b&gt;');
  });
});
```

#### 6.2.2 Token安全测试

```typescript
// __tests__/security/tokenSecurity.test.ts
import { TokenStorage } from '@/lib/storage/tokenStorage';

describe('Token安全性', () => {
  test('Refresh Token应加密存储', async () => {
    const plainToken = 'plain_refresh_token_value';

    await TokenStorage.storeTokens(
      '1234567890',
      {
        accessToken: 'access',
        refreshToken: plainToken,
        expiryDate: Date.now() + 3600000
      },
      'password123'
    );

    // 从LocalStorage直接读取，验证已加密
    const encryptedKey = localStorage.getItem('ads_encryption_key_1234567890');
    expect(encryptedKey).not.toBe('password123');  // 密钥应经过PBKDF2派生

    // 从IndexedDB读取，验证Token已加密
    const db = await openDB('AutoAdsDB', 1);
    const account = await db.get('googleAdsAccounts', '1234567890');
    expect(account.refreshToken).not.toBe(plainToken);
  });

  test('解密失败不应泄露原始Token', async () => {
    await TokenStorage.storeTokens(
      '1234567890',
      {
        accessToken: 'access',
        refreshToken: 'secret_token',
        expiryDate: Date.now() + 3600000
      },
      'correct_password'
    );

    // 破坏加密密钥
    localStorage.setItem('ads_encryption_key_1234567890', 'wrong_key');

    try {
      await TokenStorage.getRefreshToken('1234567890');
      fail('Should throw error');
    } catch (error: any) {
      // 错误信息不应包含Token
      expect(error.message).not.toContain('secret_token');
    }
  });
});
```

### 6.3 OWASP ZAP自动扫描

```bash
# 使用OWASP ZAP扫描本地开发环境
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t http://localhost:3000 \
  -r zap-report.html
```

---

## 七、兼容性测试

### 7.1 浏览器兼容性

| 浏览器 | 最低版本 | 测试状态 |
|--------|----------|----------|
| Chrome | 90+ | ✅ 必测 |
| Firefox | 88+ | ✅ 必测 |
| Safari | 14+ | ✅ 必测 |
| Edge | 90+ | ⚠️ 可选 |
| Opera | 76+ | ⚠️ 可选 |

### 7.2 设备兼容性

| 设备类型 | 分辨率 | 测试状态 |
|----------|--------|----------|
| Desktop | 1920×1080 | ✅ 必测 |
| Laptop | 1366×768 | ✅ 必测 |
| Tablet | 768×1024 | ⚠️ 可选 |
| Mobile | 375×667 | ⚠️ 可选 |

### 7.3 IndexedDB兼容性测试

```typescript
// e2e/compatibility/indexedDB.spec.ts
import { test, expect } from '@playwright/test';

test.describe('IndexedDB兼容性', () => {
  test('应检测IndexedDB支持', async ({ page }) => {
    await page.goto('/');

    const supported = await page.evaluate(() => {
      return 'indexedDB' in window;
    });

    expect(supported).toBe(true);
  });

  test('不支持IndexedDB时应显示错误', async ({ page }) => {
    // 模拟不支持IndexedDB的浏览器
    await page.addInitScript(() => {
      delete (window as any).indexedDB;
    });

    await page.goto('/');

    await expect(page.locator('text=您的浏览器不支持离线存储')).toBeVisible();
  });
});
```

---

## 八、回归测试

### 8.1 回归测试策略

**触发条件**：
- 每次代码提交（CI/CD Pipeline）
- 发布前完整回归
- 修复Bug后针对性回归

**测试范围**：
- 核心功能测试用例（100%）
- 受影响模块的测试用例（100%）
- 随机抽取20%其他测试用例

### 8.2 CI/CD Pipeline集成

```yaml
# .github/workflows/test.yml
name: Test Pipeline

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:unit -- --coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run build
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/

  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run build
      - run: npm run lighthouse
      - uses: actions/upload-artifact@v3
        with:
          name: lighthouse-report
          path: lighthouse-reports/
```

### 8.3 Docker构建和部署测试

```yaml
# .github/workflows/docker-build.yml
name: Docker Build and Test

on:
  push:
    branches: [main]
    tags: ['v*.*.*']
  pull_request:
    branches: [main]

jobs:
  docker-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2

      - name: Build Docker image
        uses: docker/build-push-action@v4
        with:
          context: .
          push: false
          tags: autobb:test
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Test Docker container
        run: |
          docker run -d --name autobb-test \
            -p 3000:3000 \
            -e NODE_ENV=production \
            autobb:test

          # 等待容器启动
          sleep 10

          # 健康检查
          curl --fail http://localhost:3000/api/health || exit 1

          # 清理
          docker stop autobb-test
          docker rm autobb-test

      - name: Login to GitHub Container Registry
        if: github.event_name != 'pull_request'
        uses: docker/login-action@v2
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        if: github.event_name != 'pull_request'
        id: meta
        uses: docker/metadata-action@v4
        with:
          images: ghcr.io/${{ github.repository }}
          tags: |
            type=ref,event=branch,prefix=prod-,suffix=-{{sha}}
            type=ref,event=tag,prefix=prod-
            type=raw,value=prod-latest,enable={{is_default_branch}}

      - name: Build and push
        if: github.event_name != 'pull_request'
        uses: docker/build-push-action@v4
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

**部署测试清单**：
- [ ] Docker镜像成功构建
- [ ] 容器启动正常（无错误日志）
- [ ] 健康检查端点响应正常（/api/health返回200）
- [ ] 环境变量正确加载
- [ ] 静态资源可访问
- [ ] 性能指标达标（内存<500MB，启动<30秒）
- [ ] 镜像大小合理（<300MB）

---

## 九、测试数据管理

### 9.1 测试数据准备

**Google Ads测试账号**：
- 使用Google Ads测试账号（非生产环境）
- 配置测试Campaign、AdGroup、Keywords
- 准备测试用的Refresh Token

**Offer测试数据**：
```typescript
// __tests__/fixtures/offers.ts
export const mockOffers = [
  {
    id: 'offer-1',
    name: 'Test Offer 1',
    brandName: 'TestBrand',
    productDescription: 'Test product for automated testing',
    landingPageUrl: 'https://example.com',
    keywords: ['test keyword 1', 'test keyword 2'],
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  // ... more test data
];
```

**性能数据Fixture**：
```typescript
// __tests__/fixtures/performance.ts
export const mockPerformanceData = [
  {
    googleAdsAccountId: '1234567890',
    googleCampaignId: 'campaign-1',
    campaignName: 'Test Campaign',
    date: '2024-01-01',
    impressions: 10000,
    clicks: 500,
    ctr: 0.05,
    averageCpc: 1.5,
    costMicros: 750000000,
    conversions: 25,
    conversionRate: 0.05,
    costPerConversion: 30.0,
    syncedAt: '2024-01-02T00:00:00Z'
  },
  // ... more test data
];
```

### 9.2 Mock Service Worker (MSW)

```typescript
// mocks/handlers.ts
import { rest } from 'msw';

export const handlers = [
  // Mock Google Ads API
  rest.post('https://googleads.googleapis.com/v*/customers/:customerId/googleAds:search', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        results: mockPerformanceData
      })
    );
  }),

  // Mock OpenAI API
  rest.post('https://api.openai.com/v1/chat/completions', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        choices: [
          {
            message: {
              content: JSON.stringify(mockCreativeContent)
            }
          }
        ]
      })
    );
  }),
];
```

---

## 十、验收标准

### 10.1 Phase 1 验收标准（MVP）

- [ ] 单元测试覆盖率≥70%
- [ ] OAuth认证流程E2E测试通过
- [ ] Offer CRUD功能E2E测试通过
- [ ] AI创意生成E2E测试通过（3级Fallback）
- [ ] Campaign创建E2E测试通过（10步流程）
- [ ] 质量评分算法单元测试通过
- [ ] 无P0/P1 Bug

### 10.2 Phase 2 验收标准（数据能力）

- [ ] 数据同步集成测试通过
- [ ] Dashboard所有组件E2E测试通过
- [ ] IndexedDB查询性能测试通过（<500ms）
- [ ] 90天数据保留逻辑单元测试通过
- [ ] Lighthouse性能评分≥90
- [ ] 无P0/P1 Bug

### 10.3 Phase 3 验收标准（增强功能）

- [ ] 内容编辑E2E测试通过
- [ ] 版本管理E2E测试通过
- [ ] 合规检查单元测试通过（20+规则）
- [ ] Recommendations API集成测试通过
- [ ] XSS防护安全测试通过
- [ ] 无P0/P1 Bug

### 10.4 Phase 4 验收标准（生产就绪）

- [ ] 全量回归测试通过率≥98%
- [ ] 跨浏览器兼容性测试通过（Chrome/Firefox/Safari）
- [ ] 性能测试所有指标达标
- [ ] OWASP ZAP安全扫描无高危漏洞
- [ ] 压力测试通过（90天数据同步）
- [ ] 数据导出/导入E2E测试通过
- [ ] 无P0/P1/P2 Bug

---

## 十一、Bug管理

### 11.1 Bug优先级定义

| 优先级 | 定义 | SLA |
|--------|------|-----|
| **P0** | 阻断功能，无法使用 | 24小时内修复 |
| **P1** | 核心功能受影响，有workaround | 3天内修复 |
| **P2** | 次要功能受影响 | 1周内修复 |
| **P3** | 体验问题，不影响功能 | 2周内修复 |
| **P4** | 优化建议 | 待规划 |

### 11.2 Bug报告模板

```markdown
**Bug标题**：[模块] 简短描述

**优先级**：P0/P1/P2/P3/P4

**环境**：
- 浏览器：Chrome 120
- 操作系统：macOS 14.0
- 测试环境：localhost / Docker容器（GitHub Actions CI）

**复现步骤**：
1. 访问/offers页面
2. 点击"新建Offer"
3. 填写表单
4. 点击"保存"

**期望结果**：Offer保存成功，跳转到Offer详情页

**实际结果**：点击保存后无响应，控制台报错

**截图/视频**：[附件]

**错误日志**：
```
Error: Cannot read property 'id' of undefined
  at OfferForm.tsx:45
```

**补充信息**：首次创建Offer时不会出现，第二次创建时必现
```

---

## 十二、测试报告

### 12.1 测试总结报告模板

```markdown
# AutoAds测试报告 - Phase X

**测试周期**：2024-01-01 ~ 2024-01-15
**测试环境**：Docker容器（CI/CD）+ 测试Google Ads账号
**测试人员**：QA Team

## 测试执行情况

| 测试类型 | 计划用例数 | 执行用例数 | 通过数 | 失败数 | 通过率 |
|----------|-----------|-----------|--------|--------|--------|
| 单元测试 | 120 | 120 | 115 | 5 | 95.8% |
| 集成测试 | 30 | 30 | 28 | 2 | 93.3% |
| E2E测试 | 25 | 25 | 24 | 1 | 96.0% |
| 性能测试 | 5 | 5 | 5 | 0 | 100% |
| 安全测试 | 10 | 10 | 10 | 0 | 100% |
| **总计** | **190** | **190** | **182** | **8** | **95.8%** |

## 代码覆盖率

- **语句覆盖率**：78.5%（目标≥75%）✅
- **分支覆盖率**：72.3%（目标≥70%）✅
- **函数覆盖率**：85.1%（目标≥80%）✅
- **行覆盖率**：77.9%（目标≥75%）✅

## 性能指标

| 指标 | 实际值 | 目标值 | 状态 |
|------|--------|--------|------|
| FCP | 1.2s | <1.5s | ✅ |
| LCP | 2.1s | <2.5s | ✅ |
| TTI | 3.0s | <3.5s | ✅ |
| Lighthouse Score | 92 | ≥90 | ✅ |

## Bug统计

| 优先级 | 发现数 | 已修复 | 待修复 | 延期 |
|--------|--------|--------|--------|------|
| P0 | 2 | 2 | 0 | 0 |
| P1 | 5 | 4 | 1 | 0 |
| P2 | 8 | 5 | 3 | 0 |
| P3 | 12 | 6 | 4 | 2 |
| **总计** | **27** | **17** | **8** | **2** |

## 遗留问题

1. **[P1] AI生成偶现超时**：AI API调用在10%的情况下超过30秒，需优化超时处理
2. **[P2] Dashboard首次加载较慢**：大数据量时首次加载需4秒，需优化IndexedDB查询

## 风险评估

- ✅ **低风险**：核心功能稳定，无阻断性Bug
- ⚠️ **中风险**：AI生成稳定性需持续监控
- ✅ **可发布**：满足Phase X验收标准

## 测试结论

**Phase X测试通过，建议进入下一阶段。**
```

---

## 总结

本测试计划覆盖AutoAds系统的完整测试策略，包括：

1. **4层测试金字塔**：单元测试(60%) → 集成测试(30%) → E2E测试(10%)
2. **120+测试用例**：涵盖功能、性能、安全、兼容性
3. **自动化CI/CD**：GitHub Actions集成，每次提交自动测试
4. **质量门禁**：代码覆盖率≥70%，性能评分≥90，无P0/P1 Bug
5. **完整文档**：测试用例、Bug管理、测试报告模板

关键成功因素：
- ✅ 测试先行，TDD驱动开发
- ✅ 自动化优先，减少手工测试
- ✅ 持续集成，及时发现问题
- ✅ 数据驱动，量化质量指标
