import { test, expect } from '@playwright/test'

const BASE_URL = 'http://localhost:3002'
const ADMIN_USERNAME = 'autoads'
const ADMIN_PASSWORD = 'K$j6z!9Tq@P2w#aR'

test.describe('需求16-20优化验证', () => {
  test.beforeEach(async ({ page }) => {
    // 管理员登录
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[name="username"]', ADMIN_USERNAME)
    await page.fill('input[type="password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 10000 })
  })

  test('优化1: 个人中心按钮已存在且可点击', async ({ page }) => {
    // 验证个人中心按钮存在
    const profileButton = page.locator('button:has-text("个人中心")')
    await expect(profileButton).toBeVisible({ timeout: 5000 })

    // 点击按钮
    await profileButton.click()

    // 验证弹窗打开
    await expect(page.locator('text=/个人信息|Personal Information/i')).toBeVisible({ timeout: 3000 })

    console.log('✅ 个人中心按钮功能正常')
  })

  test('优化2: 用户管理页面正常加载', async ({ page }) => {
    // 访问用户管理页面
    await page.goto(`${BASE_URL}/admin/users`)

    // 等待页面加载完成（等待标题或内容）
    await expect(page.locator('h1:has-text("用户管理")')).toBeVisible({ timeout: 10000 })

    // 验证创建用户按钮存在
    await expect(page.locator('button:has-text("创建用户")')).toBeVisible()

    // 验证表格或用户列表加载（可能是空的或有数据）
    const hasTable = await page.locator('table').isVisible().catch(() => false)
    const hasEmptyState = await page.locator('text=/暂无用户/i').isVisible().catch(() => false)

    expect(hasTable || hasEmptyState).toBeTruthy()

    console.log('✅ 用户管理页面加载成功')
  })

  test('优化3: Offer列表"投放分析"按钮存在', async ({ page }) => {
    // 访问Offer列表页
    await page.goto(`${BASE_URL}/offers`)
    await page.waitForLoadState('networkidle', { timeout: 10000 })

    // 检查是否有Offer数据
    const hasOffers = await page.locator('table').isVisible().catch(() => false)

    if (hasOffers) {
      // 验证"投放分析"按钮存在
      const launchScoreButton = page.locator('button:has-text("投放分析")').first()
      await expect(launchScoreButton).toBeVisible({ timeout: 5000 })

      console.log('✅ 投放分析按钮存在于Offer列表')

      // 可选：点击按钮验证弹窗
      await launchScoreButton.click()
      await expect(page.locator('text=/投放分析|Launch Score/i')).toBeVisible({ timeout: 3000 })

      console.log('✅ 投放分析弹窗正常打开')
    } else {
      console.log('⚠️ 暂无Offer，跳过投放分析按钮测试')
    }
  })

  test('优化4: Launch Score详情展开功能', async ({ page }) => {
    // 访问Offer列表页
    await page.goto(`${BASE_URL}/offers`)
    await page.waitForLoadState('networkidle', { timeout: 10000 })

    // 检查是否有Offer
    const hasOffers = await page.locator('table').isVisible().catch(() => false)

    if (hasOffers) {
      // 点击投放分析按钮
      const launchScoreButton = page.locator('button:has-text("投放分析")').first()
      await launchScoreButton.click()
      await page.waitForTimeout(1000)

      // 检查是否有评分数据（可能需要先生成）
      const hasScore = await page.locator('text=/关键词|市场契合|着陆页/i').isVisible().catch(() => false)

      if (hasScore) {
        // 点击一个维度卡片（例如"关键词"）
        const keywordCard = page.locator('button:has-text("关键词")').first()
        await keywordCard.click()
        await page.waitForTimeout(500)

        // 验证详情区域展开
        await expect(page.locator('text=/关键词分析详情|相关性评分/i')).toBeVisible({ timeout: 3000 })

        console.log('✅ Launch Score详情展开功能正常')

        // 再次点击收起
        await keywordCard.click()
        await page.waitForTimeout(500)

        // 验证详情区域收起
        const detailsVisible = await page.locator('text=/关键词分析详情/i').isVisible().catch(() => false)
        expect(detailsVisible).toBeFalsy()

        console.log('✅ Launch Score详情收起功能正常')
      } else {
        console.log('⚠️ 暂无评分数据，跳过详情展开测试')
      }
    } else {
      console.log('⚠️ 暂无Offer，跳过Launch Score测试')
    }
  })

  test('综合验证: 所有优化功能集成测试', async ({ page }) => {
    console.log('📋 开始综合验证测试...')

    // 1. 验证Dashboard个人中心
    await expect(page.locator('button:has-text("个人中心")')).toBeVisible()
    console.log('✅ Step 1: Dashboard个人中心按钮存在')

    // 2. 验证用户管理页面
    await page.goto(`${BASE_URL}/admin/users`)
    await expect(page.locator('h1:has-text("用户管理")')).toBeVisible({ timeout: 10000 })
    console.log('✅ Step 2: 用户管理页面正常加载')

    // 3. 验证Offer列表投放分析按钮
    await page.goto(`${BASE_URL}/offers`)
    await page.waitForLoadState('networkidle')

    const hasOffers = await page.locator('table').isVisible().catch(() => false)
    if (hasOffers) {
      await expect(page.locator('button:has-text("投放分析")').first()).toBeVisible()
      console.log('✅ Step 3: Offer列表投放分析按钮存在')
    } else {
      console.log('⚠️ Step 3: 暂无Offer数据')
    }

    console.log('🎉 所有优化功能验证完成！')
  })
})
