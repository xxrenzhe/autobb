import Database from 'better-sqlite3'
import path from 'path'
import { hashPassword } from '../src/lib/crypto'

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'autoads.db')
const db = new Database(dbPath)

async function initAdmin() {
    console.log('🚀 初始化默认管理员账号...')

    const adminUser = {
        username: 'autoads',
        email: 'admin@autoads.com', // Placeholder email
        password: 'K$j6z!9Tq@P2w#aR',
        role: 'admin',
        package_type: 'lifetime',
        package_expires_at: '2099-12-31 23:59:59',
        must_change_password: 0 // Admin doesn't need to change default password
    }

    try {
        const passwordHash = await hashPassword(adminUser.password)

        // Check if admin exists by username
        const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get(adminUser.username)

        if (existingAdmin) {
            console.log('⚠️ 管理员账号已存在，更新密码和套餐...')
            db.prepare(`
        UPDATE users 
        SET password_hash = ?, role = ?, package_type = ?, package_expires_at = ?, must_change_password = ?, is_active = 1
        WHERE username = ?
      `).run(
                passwordHash,
                adminUser.role,
                adminUser.package_type,
                adminUser.package_expires_at,
                adminUser.must_change_password,
                adminUser.username
            )
        } else {
            console.log('✨ 创建新管理员账号...')
            db.prepare(`
        INSERT INTO users (username, email, password_hash, role, package_type, package_expires_at, must_change_password, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
                adminUser.username,
                adminUser.email,
                passwordHash,
                adminUser.role,
                adminUser.package_type,
                adminUser.package_expires_at,
                adminUser.must_change_password,
                1
            )
        }

        console.log('✅ 管理员账号初始化完成')
        console.log(`   用户名: ${adminUser.username}`)
        console.log(`   密码: ${adminUser.password}`)
        console.log(`   有效期: ${adminUser.package_expires_at}`)

    } catch (error) {
        console.error('❌ 初始化管理员失败:', error)
        process.exit(1)
    } finally {
        db.close()
    }
}

initAdmin()
