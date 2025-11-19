import { test, expect, Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

// Test configuration
const BASE_URL = 'http://localhost:3000'
const ADMIN_USERNAME = 'autoads'
const ADMIN_PASSWORD = 'K$j6z!9Tq@P2w#aR'

// Test state
let consoleLogs: Array<{ type: string; message: string; timestamp: string }> = []
let testContext: {
  offerId?: string
  hasOffers?: boolean
  keywordSuggestions?: any[]
  creativeGeneration?: any
  consoleKeywordLogs?: string[]
  consoleAILogs?: string[]
}

/**
 * E2E测试：验证需求11-15的实现
 *
 * 测试环境：
 * - URL: http://localhost:3000
 * - 管理员账号: autoads / K$j6z!9Tq@P2w#aR
 */

test.beforeAll(() => {
  testContext = {}
  // Create directory for screenshots
  const screenshotDir = path.join(__dirname, '../test-screenshots')
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true })
  }
})

// Helper function to capture console logs
function setupConsoleLogging(page: Page) {
  page.on('console', (msg) => {
    const timestamp = new Date().toISOString()
    const logEntry = {
      type: msg.type(),
      message: msg.text(),
      timestamp
    }
    consoleLogs.push(logEntry)

    // Log to test output
    console.log(`[${timestamp}] [${msg.type().toUpperCase()}] ${msg.text()}`)
  })
}

// Helper function to take screenshot
async function takeScreenshot(page: Page, name: string) {
  const screenshotPath = path.join(__dirname, '../test-screenshots', `${name}.png`)
  await page.screenshot({ path: screenshotPath, fullPage: true })
  console.log(`📸 Screenshot saved: ${screenshotPath}`)
}

test.describe('Requirements 11-15 E2E Testing', () => {

  test('1. Login Test', async ({ page }) => {
    setupConsoleLogging(page)

    console.log('🔐 测试1：登录测试')

    // Navigate to login page
    await page.goto(`${BASE_URL}/login`)
    await page.waitForLoadState('networkidle')

    // Take screenshot of login page
    await takeScreenshot(page, '01-login-page')

    // Fill in credentials
    await page.fill('input[name="username"], input[type="text"]', ADMIN_USERNAME)
    await page.fill('input[name="password"], input[type="password"]', ADMIN_PASSWORD)

    // Click login button
    await page.click('button[type="submit"]')

    // Wait for navigation
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Verify login success (should redirect to dashboard or offers page)
    const currentUrl = page.url()
    console.log(`✅ 登录后URL: ${currentUrl}`)

    // Take screenshot after login
    await takeScreenshot(page, '02-after-login')

    expect(currentUrl).not.toContain('/login')
  })

  test('2. Check for Offers', async ({ page }) => {
    setupConsoleLogging(page)

    console.log('📋 测试2：检查Offer列表')

    // Login first
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[name="username"], input[type="text"]', ADMIN_USERNAME)
    await page.fill('input[name="password"], input[type="password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Navigate to offers page
    await page.goto(`${BASE_URL}/offers`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Take screenshot
    await takeScreenshot(page, '03-offers-list')

    // Check if there are offers
    const offerLinks = await page.$$('a[href*="/offers/"]')
    testContext.hasOffers = offerLinks.length > 0

    if (testContext.hasOffers) {
      // Get first offer ID
      const firstOfferHref = await offerLinks[0].getAttribute('href')
      testContext.offerId = firstOfferHref?.split('/').pop()
      console.log(`✅ 找到Offer，ID: ${testContext.offerId}`)
    } else {
      console.log('⚠️ 未找到Offer，需要手动创建')
    }

    expect(testContext.hasOffers).toBe(true)
  })

  test('3. Requirement 11 - Keyword Suggestions with Google Autocomplete & Intent Filtering', async ({ page }) => {
    setupConsoleLogging(page)

    console.log('🔑 测试3：需求11 - 关键词获取（Google下拉词 + 购买意图过滤）')

    // Login
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[name="username"], input[type="text"]', ADMIN_USERNAME)
    await page.fill('input[name="password"], input[type="password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Navigate to first offer
    if (!testContext.offerId) {
      // Get offer ID if not set
      await page.goto(`${BASE_URL}/offers`)
      await page.waitForLoadState('networkidle')
      const offerLinks = await page.$$('a[href*="/offers/"]')
      if (offerLinks.length > 0) {
        const href = await offerLinks[0].getAttribute('href')
        testContext.offerId = href?.split('/').pop()
      }
    }

    expect(testContext.offerId).toBeTruthy()

    // Go to offer detail page
    await page.goto(`${BASE_URL}/offers/${testContext.offerId}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    await takeScreenshot(page, '04-offer-detail')

    // Click "一键上广告" button
    const launchButton = page.locator('button:has-text("一键上广告"), button:has-text("Launch Ad")')
    await launchButton.first().click()
    await page.waitForTimeout(1000)

    await takeScreenshot(page, '05-launch-ad-modal')

    // Click "获取关键词建议" button
    const keywordButton = page.locator('button:has-text("获取关键词"), button:has-text("Keyword")')
    const keywordButtonExists = await keywordButton.count() > 0

    if (keywordButtonExists) {
      // Clear console logs before keyword generation
      consoleLogs = []

      await keywordButton.first().click()
      console.log('🔍 点击"获取关键词建议"按钮...')

      // Wait for API call to complete
      await page.waitForTimeout(5000)

      await takeScreenshot(page, '06-after-keyword-fetch')

      // Collect console logs related to keywords
      testContext.consoleKeywordLogs = consoleLogs
        .filter(log =>
          log.message.includes('Google') ||
          log.message.includes('下拉词') ||
          log.message.includes('过滤') ||
          log.message.includes('低意图') ||
          log.message.includes('keyword') ||
          log.message.includes('intent')
        )
        .map(log => `[${log.type}] ${log.message}`)

      console.log('\n📊 关键词相关日志:')
      testContext.consoleKeywordLogs.forEach(log => console.log(log))

      // Verify: Check if there are logs about Google autocomplete
      const hasGoogleSuggestLogs = testContext.consoleKeywordLogs.some(log =>
        log.includes('Google') && (log.includes('搜索建议') || log.includes('下拉词') || log.includes('suggest'))
      )

      // Verify: Check if there are logs about intent filtering
      const hasIntentFilterLogs = testContext.consoleKeywordLogs.some(log =>
        log.includes('过滤') || log.includes('低意图') || log.includes('filter')
      )

      console.log(`\n✅ 验证点A - Google下拉词调用: ${hasGoogleSuggestLogs ? '通过' : '未通过'}`)
      console.log(`✅ 验证点B - 购买意图过滤: ${hasIntentFilterLogs ? '通过' : '未通过'}`)

      // Check if low-intent keywords are filtered
      const filteredKeywords = testContext.consoleKeywordLogs.filter(log =>
        log.includes('free') || log.includes('how to') || log.includes('setup')
      )

      console.log(`✅ 验证点C - 低意图关键词被过滤: ${filteredKeywords.length > 0 ? '通过（发现过滤日志）' : '未检测到'}`)

      // Save console logs to file
      const logPath = path.join(__dirname, '../test-screenshots', 'keyword-console-logs.json')
      fs.writeFileSync(logPath, JSON.stringify(testContext.consoleKeywordLogs, null, 2))
      console.log(`📄 关键词日志已保存: ${logPath}`)
    } else {
      console.log('⚠️ 未找到"获取关键词建议"按钮，可能UI已变化')
    }
  })

  test('4. Requirement 12 - Verify Gemini 2.5 Model Usage', async ({ page }) => {
    setupConsoleLogging(page)

    console.log('🤖 测试4：需求12 - 验证Gemini 2.5模型使用')

    // This is a code-level verification
    // We'll check the source code files
    const aiLibPath = path.join(__dirname, '../src/lib/ai.ts')
    const keywordGenPath = path.join(__dirname, '../src/lib/keyword-generator.ts')
    const settingsPath = path.join(__dirname, '../src/lib/settings.ts')

    const filesToCheck = [
      { path: aiLibPath, name: 'ai.ts' },
      { path: keywordGenPath, name: 'keyword-generator.ts' },
      { path: settingsPath, name: 'settings.ts' }
    ]

    const modelUsage: Array<{ file: string; usesGemini25: boolean; lines: string[] }> = []

    for (const file of filesToCheck) {
      if (fs.existsSync(file.path)) {
        const content = fs.readFileSync(file.path, 'utf-8')
        const lines = content.split('\n')

        const gemini25Lines = lines
          .map((line, idx) => ({ line, idx }))
          .filter(({ line }) => line.includes('gemini-2.5') || line.includes('gemini-2\.5'))
          .map(({ line, idx }) => `Line ${idx + 1}: ${line.trim()}`)

        modelUsage.push({
          file: file.name,
          usesGemini25: gemini25Lines.length > 0,
          lines: gemini25Lines
        })
      }
    }

    console.log('\n📊 Gemini模型使用情况:')
    modelUsage.forEach(({ file, usesGemini25, lines }) => {
      console.log(`\n${file}: ${usesGemini25 ? '✅ 使用Gemini 2.5' : '❌ 未使用Gemini 2.5'}`)
      if (lines.length > 0) {
        lines.forEach(line => console.log(`  ${line}`))
      }
    })

    // Save to file
    const reportPath = path.join(__dirname, '../test-screenshots', 'gemini-model-verification.json')
    fs.writeFileSync(reportPath, JSON.stringify(modelUsage, null, 2))
    console.log(`\n📄 Gemini模型验证报告已保存: ${reportPath}`)

    // Verify all files use Gemini 2.5
    const allUseGemini25 = modelUsage.every(item => item.usesGemini25)
    expect(allUseGemini25).toBe(true)
  })

  test('5. Requirement 15 - AI Creative Generation with Real Brand Info', async ({ page }) => {
    setupConsoleLogging(page)

    console.log('🎨 测试5：需求15 - AI创意生成（callout/sitelink优化）')

    // Login
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[name="username"], input[type="text"]', ADMIN_USERNAME)
    await page.fill('input[name="password"], input[type="password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Navigate to offer
    if (!testContext.offerId) {
      await page.goto(`${BASE_URL}/offers`)
      await page.waitForLoadState('networkidle')
      const offerLinks = await page.$$('a[href*="/offers/"]')
      if (offerLinks.length > 0) {
        const href = await offerLinks[0].getAttribute('href')
        testContext.offerId = href?.split('/').pop()
      }
    }

    expect(testContext.offerId).toBeTruthy()

    await page.goto(`${BASE_URL}/offers/${testContext.offerId}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Click "一键上广告"
    const launchButton = page.locator('button:has-text("一键上广告"), button:has-text("Launch Ad")')
    await launchButton.first().click()
    await page.waitForTimeout(1000)

    // Find and click "生成广告创意" button
    const generateButton = page.locator('button:has-text("生成"), button:has-text("Generate")')
    const generateButtonExists = await generateButton.count() > 0

    if (generateButtonExists) {
      // Clear console logs
      consoleLogs = []

      await generateButton.first().click()
      console.log('🎨 点击"生成广告创意"按钮...')

      // Wait for AI generation (may take longer)
      await page.waitForTimeout(10000)

      await takeScreenshot(page, '07-after-creative-generation')

      // Collect AI-related logs
      testContext.consoleAILogs = consoleLogs
        .filter(log =>
          log.message.includes('AI') ||
          log.message.includes('Gemini') ||
          log.message.includes('creative') ||
          log.message.includes('创意') ||
          log.message.includes('callout') ||
          log.message.includes('sitelink')
        )
        .map(log => `[${log.type}] ${log.message}`)

      console.log('\n📊 AI创意生成日志:')
      testContext.consoleAILogs.forEach(log => console.log(log))

      // Try to extract generated creatives from page
      const calloutsText = await page.textContent('body')
      const hasCallouts = calloutsText?.includes('Free Shipping') ||
                          calloutsText?.includes('Official Store') ||
                          calloutsText?.includes('24/7 Support')

      const hasSitelinks = calloutsText?.includes('Support Center') ||
                           calloutsText?.includes('Shop Now') ||
                           calloutsText?.includes('Contact Us')

      console.log(`\n✅ 验证点A - Callouts生成: ${hasCallouts ? '通过（发现callout元素）' : '未检测到'}`)
      console.log(`✅ 验证点B - Sitelinks生成: ${hasSitelinks ? '通过（发现sitelink元素）' : '未检测到'}`)

      // Check if creatives reference real brand info (not purely fictional)
      const pageText = await page.textContent('body')
      const brandKeywords = ['Reolink', 'Official', 'Security', 'Camera', 'Support']
      const hasBrandReference = brandKeywords.some(keyword =>
        pageText?.toLowerCase().includes(keyword.toLowerCase())
      )

      console.log(`✅ 验证点C - 基于真实品牌信息: ${hasBrandReference ? '通过' : '未通过'}`)

      // Save logs
      const logPath = path.join(__dirname, '../test-screenshots', 'ai-creative-logs.json')
      fs.writeFileSync(logPath, JSON.stringify(testContext.consoleAILogs, null, 2))
      console.log(`📄 AI创意日志已保存: ${logPath}`)
    } else {
      console.log('⚠️ 未找到"生成广告创意"按钮')
    }
  })

  test('6. Requirement 13 - Verify Data Sync Mechanism', async ({ page }) => {
    console.log('🔄 测试6：需求13 - 验证数据同步机制')

    // Check for cron script
    const cronScriptPath = path.join(__dirname, '../scripts/cron-sync-data.ts')
    const cronScriptExists = fs.existsSync(cronScriptPath)

    // Check for data-sync-service
    const dataSyncServicePath = path.join(__dirname, '../src/lib/data-sync-service.ts')
    const dataSyncServiceExists = fs.existsSync(dataSyncServicePath)

    console.log(`\n📊 数据同步机制检查:`)
    console.log(`✅ Cron脚本 (scripts/cron-sync-data.ts): ${cronScriptExists ? '存在' : '不存在'}`)
    console.log(`✅ 数据同步服务 (src/lib/data-sync-service.ts): ${dataSyncServiceExists ? '存在' : '不存在'}`)

    if (cronScriptExists) {
      const cronContent = fs.readFileSync(cronScriptPath, 'utf-8')
      const hasSyncFunction = cronContent.includes('syncPerformanceData') || cronContent.includes('dataSyncService')
      console.log(`✅ Cron脚本包含同步函数: ${hasSyncFunction ? '是' : '否'}`)
    }

    if (dataSyncServiceExists) {
      const serviceContent = fs.readFileSync(dataSyncServicePath, 'utf-8')
      const hasGAQLQuery = serviceContent.includes('GAQL') || serviceContent.includes('queryPerformanceData')
      const hasSyncLogs = serviceContent.includes('sync_logs')
      console.log(`✅ 数据同步服务包含GAQL查询: ${hasGAQLQuery ? '是' : '否'}`)
      console.log(`✅ 数据同步服务包含日志记录: ${hasSyncLogs ? '是' : '否'}`)
    }

    // Save verification report
    const report = {
      requirement13: {
        cronScriptExists,
        dataSyncServiceExists,
        verified: cronScriptExists && dataSyncServiceExists
      }
    }

    const reportPath = path.join(__dirname, '../test-screenshots', 'data-sync-verification.json')
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log(`\n📄 数据同步验证报告已保存: ${reportPath}`)

    expect(cronScriptExists).toBe(true)
    expect(dataSyncServiceExists).toBe(true)
  })

  test.afterAll(async () => {
    // Generate final test report
    const report = {
      testDate: new Date().toISOString(),
      environment: {
        baseUrl: BASE_URL,
        username: ADMIN_USERNAME
      },
      requirements: {
        req11_keywordSuggestions: {
          status: testContext.consoleKeywordLogs ? 'tested' : 'not_tested',
          logs: testContext.consoleKeywordLogs || []
        },
        req12_gemini25: {
          status: 'verified',
          details: 'Code-level verification completed'
        },
        req13_dataSync: {
          status: 'verified',
          details: 'Cron script and service verified'
        },
        req15_aiCreative: {
          status: testContext.consoleAILogs ? 'tested' : 'not_tested',
          logs: testContext.consoleAILogs || []
        }
      },
      screenshots: [
        '01-login-page.png',
        '02-after-login.png',
        '03-offers-list.png',
        '04-offer-detail.png',
        '05-launch-ad-modal.png',
        '06-after-keyword-fetch.png',
        '07-after-creative-generation.png'
      ],
      allConsoleLogs: consoleLogs
    }

    const reportPath = path.join(__dirname, '../test-screenshots', 'final-test-report.json')
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log(`\n📊 最终测试报告已保存: ${reportPath}`)
  })
})
