/**
 * 创建默认管理员账号
 * 用户名: autoads
 * 密码: K$j6z!9Tq@P2w#aR
 * 套餐: 终身买断
 * 有效期: 2099-12-31
 */

import Database from 'better-sqlite3'
import path from 'path'
import bcrypt from 'bcrypt'

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'autoads.db')

console.log('🚀 创建默认管理员账号...')
console.log('📍 数据库路径:', dbPath)

const db = new Database(dbPath)

try {
  // 检查是否已存在管理员账号
  const existingAdmin = db.prepare(
    "SELECT * FROM users WHERE username = 'autoads' OR role = 'admin'"
  ).get() as { id: number; username: string | null; email: string; role: string } | undefined

  if (existingAdmin) {
    console.log('⚠️  管理员账号已存在:')
    console.log(`   - ID: ${existingAdmin.id}`)
    console.log(`   - 用户名: ${existingAdmin.username || 'N/A'}`)
    console.log(`   - 邮箱: ${existingAdmin.email || 'N/A'}`)
    console.log(`   - 角色: ${existingAdmin.role}`)
    console.log('\n如需重新创建，请先手动删除现有管理员账号')
    process.exit(0)
  }

  console.log('\n🔐 生成密码哈希...')
  const passwordHash = bcrypt.hashSync('K$j6z!9Tq@P2w#aR', 10)
  console.log('✅ 密码哈希生成完成')

  console.log('\n📝 插入管理员记录...')

  const result = db.prepare(`
    INSERT INTO users (
      username,
      password_hash,
      display_name,
      email,
      role,
      package_type,
      valid_from,
      valid_until,
      must_change_password,
      is_active,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    'autoads',                           // username
    passwordHash,                         // password_hash
    'AutoAds管理员',                      // display_name
    'admin@autoads.local',               // email (管理员专用邮箱)
    'admin',                              // role
    'lifetime',                           // package_type
    '2025-01-17T00:00:00Z',              // valid_from
    '2099-12-31T23:59:59Z',              // valid_until
    0,                                    // must_change_password (管理员无需修改)
    1                                     // is_active
  )

  console.log('\n✅ 默认管理员账号创建成功！')
  console.log('\n📋 账号信息:')
  console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('   🆔 用户ID:    ', result.lastInsertRowid)
  console.log('   👤 用户名:     autoads')
  console.log('   📧 邮箱:       admin@autoads.local')
  console.log('   🔑 密码:       K$j6z!9Tq@P2w#aR')
  console.log('   👑 角色:       admin (管理员)')
  console.log('   📦 套餐类型:   lifetime (终身买断)')
  console.log('   📅 有效期:     2025-01-17 至 2099-12-31')
  console.log('   🔓 修改密码:   否 (管理员无需首次修改密码)')
  console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('\n⚠️  请妥善保管管理员密码，建议首次登录后立即修改！')
  console.log('\n💡 登录方式: 可使用用户名(autoads)或邮箱(admin@autoads.local)登录')

} catch (error) {
  console.error('\n❌ 创建管理员账号失败:', error)
  process.exit(1)
} finally {
  db.close()
}
