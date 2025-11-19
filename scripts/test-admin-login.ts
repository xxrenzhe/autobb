import { loginWithPassword } from '../src/lib/auth'

async function testLogin() {
  console.log('🔐 测试管理员登录...\n')

  try {
    const result = await loginWithPassword('autoads', 'K$j6z!9Tq@P2w#aR')

    console.log('✅ 登录成功！\n')
    console.log('📋 用户信息：')
    console.log('   ID:', result.user.id)
    console.log('   用户名:', result.user.username)
    console.log('   邮箱:', result.user.email)
    console.log('   角色:', result.user.role)
    console.log('   套餐:', result.user.packageType)
    console.log('   需要修改密码:', result.mustChangePassword ? '是' : '否')
    console.log('\n🎉 管理员账户可以正常登录！')

  } catch (error: any) {
    console.error('❌ 登录失败:', error.message)
    process.exit(1)
  }
}

testLogin()
