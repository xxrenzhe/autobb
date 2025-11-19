import { test, expect } from '@playwright/test'

test.describe('管理员登录测试', () => {
  test('应该能够成功登录管理员账号', async ({ page }) => {
    // 1. 访问登录页面
    await page.goto('http://localhost:3000/login')
    await expect(page).toHaveURL(/.*login/)
    console.log('✅ 成功访问登录页面')

    // 2. 填写管理员凭证
    const usernameInput = page.locator('input[name="username"], input[type="text"]').first()
    const passwordInput = page.locator('input[name="password"], input[type="password"]').first()

    await usernameInput.fill('autoads')
    await passwordInput.fill('K$j6z!9Tq@P2w#aR')
    console.log('✅ 已填写管理员用户名和密码')

    // 3. 点击登录按钮
    const loginButton = page.locator('button[type="submit"]').first()
    await loginButton.click()
    console.log('✅ 已点击登录按钮')

    // 4. 等待跳转到 dashboard
    await page.waitForURL(/.*dashboard/, { timeout: 10000 })
    console.log('✅ 成功跳转到 dashboard 页面')

    // 5. 验证 cookie 是否设置
    const cookies = await page.context().cookies()
    const authCookie = cookies.find(c => c.name === 'auth_token')
    expect(authCookie).toBeDefined()
    console.log('✅ auth_token cookie 已设置')

    // 6. 验证用户信息
    await page.waitForTimeout(2000) // 等待页面加载完成

    // 检查是否有用户信息显示（个人中心等）
    const pageContent = await page.content()
    console.log('✅ Dashboard 页面已加载')

    // 7. 截图保存
    await page.screenshot({
      path: 'test-screenshots/admin-login-success.png',
      fullPage: true
    })
    console.log('✅ 已保存登录成功截图')

    // 8. 验证 /api/auth/me 接口
    const response = await page.goto('http://localhost:3000/api/auth/me')
    expect(response?.status()).toBe(200)

    const userData = await response?.json()
    console.log('✅ 用户数据获取成功:', {
      username: userData.user.username,
      email: userData.user.email,
      role: userData.user.role,
      packageType: userData.user.packageType
    })

    expect(userData.user.username).toBe('autoads')
    expect(userData.user.email).toBe('admin@autoads.com')
    expect(userData.user.role).toBe('admin')
    expect(userData.user.packageType).toBe('lifetime')
    console.log('✅ 管理员信息验证通过')

    console.log('\n🎉 管理员登录测试全部通过！')
  })

  test('应该显示管理员的套餐信息', async ({ page }) => {
    // 1. 先登录
    await page.goto('http://localhost:3000/login')
    await page.locator('input[name="username"], input[type="text"]').first().fill('autoads')
    await page.locator('input[name="password"], input[type="password"]').first().fill('K$j6z!9Tq@P2w#aR')
    await page.locator('button[type="submit"]').first().click()
    await page.waitForURL(/.*dashboard/, { timeout: 10000 })

    // 2. 通过 API 验证套餐信息
    const response = await page.goto('http://localhost:3000/api/auth/me')
    const userData = await response?.json()

    console.log('📋 管理员套餐信息:')
    console.log('   套餐类型:', userData.user.packageType)
    console.log('   套餐有效期:', userData.user.packageExpiresAt)

    expect(userData.user.packageType).toBe('lifetime')
    expect(userData.user.packageExpiresAt).toBe('2099-12-31T23:59:59.000Z')
    console.log('✅ 套餐信息验证通过：终身买断制，有效期至2099年')
  })
})
