# AutoAds 用户管理功能验证报告

**日期**: 2025-11-18
**验证人员**: Claude Code
**文档状态**: 完成

---

## 📋 执行摘要

本次验证对照《USER_MANAGEMENT_DESIGN.md》设计文档，全面检查了AutoAds用户管理和套餐功能的实现情况。

**总体结论**: ❌ **未满足需求 - 需要大量开发工作**

**符合度评分**: 15/100

- ✅ 已实现：2项（数据库基础、JWT框架）
- ⚠️ 部分实现：1项（用户认证基础）
- ❌ 未实现：10项（核心功能缺失）

---

## 🔍 详细验证结果

### 1. 前端登录界面（❌ 不符合需求）

**需求**: 登录页面只有登录功能，没有注册功能

**实际情况**:
- ❌ 登录页面包含"创建新账户"链接（`src/app/login/page.tsx:66-71`）
- ❌ 注册页面完整存在且可用（`src/app/register/page.tsx`）
- ❌ 支持邮箱/密码自主注册
- ❌ 支持Google OAuth注册

**影响**: 用户可以绕过管理员审批自行创建账号，无法控制用户准入

**修复建议**:
```typescript
// 需要修改的文件：
// 1. src/app/login/page.tsx - 删除注册链接（66-71行）
// 2. src/app/register/page.tsx - 删除整个文件
// 3. src/app/api/auth/register/route.ts - 删除或标记为仅管理员可用
// 4. src/middleware.ts - 从publicPaths中移除 '/register' 和 '/api/auth/register'
```

---

### 2. 用户创建机制（❌ 未实现）

**需求**:
- 仅管理员可在后台创建用户
- 自动生成8-12位动物名作为用户名
- 默认密码统一为 `auto11@20ads`

**实际情况**:
- ❌ 无管理员后台页面（`/admin/users` 不存在）
- ❌ 无管理员用户创建API（`/api/admin/users` 不存在）
- ❌ 无动物名生成逻辑
- ❌ 用户使用邮箱登录，不支持用户名登录
- ✅ 现有注册API支持自主注册（与需求相反）

**影响**: 无法实现管理员集中控制用户创建，无法使用动物名作为用户名

**修复建议**:
```typescript
// 需要创建的文件：
// 1. src/lib/animal-name-generator.ts - 动物名生成器
// 2. src/app/admin/users/page.tsx - 管理员用户管理页面
// 3. src/app/api/admin/users/route.ts - 创建用户API
// 4. src/app/api/admin/users/[id]/route.ts - 更新/删除用户API
```

示例动物名生成器:
```typescript
const ANIMALS = ['elephant', 'giraffe', 'penguin', 'dolphin', ...];
const ADJECTIVES = ['swift', 'brave', 'clever', 'gentle', ...];

export function generateAnimalUsername(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const suffix = Math.floor(Math.random() * 999);
  return `${adj}${animal}${suffix}`; // e.g., "swiftelephant123"
}
```

---

### 3. 首次登录强制修改密码（❌ 未实现）

**需求**:
- 新用户首次登录必须修改密码
- 管理员除外

**实际情况**:
- ❌ 数据库缺少 `must_change_password` 字段
- ❌ 无首次修改密码页面（`/change-password` 不存在）
- ❌ 登录API未返回 `mustChangePassword` 标志
- ❌ 无强制跳转逻辑

**影响**: 用户可以一直使用默认密码，存在安全风险

**修复建议**:
```sql
-- 1. 数据库迁移：添加must_change_password字段
ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 1;

-- 2. 更新管理员的must_change_password为0
UPDATE users SET must_change_password = 0 WHERE role = 'admin';
```

```typescript
// 3. 创建修改密码页面
// src/app/change-password/page.tsx

// 4. 修改登录API返回
interface LoginResponse {
  token: string;
  user: {...};
  mustChangePassword: boolean; // 新增
}

// 5. 前端登录逻辑
if (data.mustChangePassword) {
  router.push('/change-password');
} else {
  router.push('/dashboard');
}
```

---

### 4. SQLite数据库和备份机制（⚠️ 部分实现）

**需求**:
- 单实例SQLite数据库
- 每日定时备份
- 保留最近30天备份
- `backup_logs` 表记录备份历史

**实际情况**:
- ✅ SQLite数据库已创建（`data/autoads.db`）
- ✅ 使用better-sqlite3 + WAL模式
- ❌ 无 `backup_logs` 表
- ❌ 无备份脚本（`scripts/backup-database.ts` 不存在）
- ❌ 无定时任务（`node-cron` 未集成）
- ❌ 无备份目录（`data/backups/` 不存在）

**影响**: 数据无备份，存在丢失风险

**修复建议**:
```sql
-- 1. 创建backup_logs表
CREATE TABLE backup_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  backup_filename TEXT NOT NULL,
  backup_path TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  backup_type TEXT NOT NULL DEFAULT 'auto',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

```typescript
// 2. 创建备份脚本
// scripts/backup-database.ts
// 参考设计文档 USER_MANAGEMENT_DESIGN.md:969-1059

// 3. 集成定时任务
// lib/cron/backup-scheduler.ts
import cron from 'node-cron';
cron.schedule('0 2 * * *', backupDatabase);
```

---

### 5. 有效期过期验证（❌ 未实现）

**需求**:
- 登录时检查 `valid_until` 字段
- 过期后登录失败，提示购买/升级套餐

**实际情况**:
- ❌ 数据库缺少 `valid_from` 和 `valid_until` 字段
- ⚠️ 仅有 `package_expires_at` 字段
- ❌ 登录API未检查有效期（`src/lib/auth.ts:120-161`）
- ❌ 无过期提示文案
- ❌ JWT中未包含 `validUntil` 字段

**当前数据库字段**:
```sql
CREATE TABLE users (
  ...
  package_expires_at TEXT,  -- 存在但未使用
  ...
);
```

**设计要求的字段**:
```sql
-- 设计文档要求的字段（缺失）
valid_from TEXT NOT NULL,
valid_until TEXT NOT NULL,
```

**影响**: 无法按有效期控制用户访问，套餐功能无法实现

**修复建议**:
```sql
-- 1. 数据库迁移
ALTER TABLE users ADD COLUMN valid_from TEXT NOT NULL DEFAULT (datetime('now'));
ALTER TABLE users ADD COLUMN valid_until TEXT NOT NULL DEFAULT (datetime('now', '+365 days'));
```

```typescript
// 2. 修改登录逻辑（src/lib/auth.ts:120-161）
export async function loginWithPassword(email: string, password: string): Promise<LoginResponse> {
  const user = findUserByEmail(email);

  // ... 现有验证 ...

  // 新增：检查有效期
  if (user.valid_until) {
    const validUntil = new Date(user.valid_until);
    if (validUntil < new Date()) {
      throw new Error('ACCOUNT_EXPIRED'); // 账号已过期，请购买或续费套餐
    }
  }

  // JWT中包含validUntil
  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    packageType: user.package_type,
    validUntil: user.valid_until, // 新增
  });
}
```

```typescript
// 3. 前端错误处理
if (error.message === 'ACCOUNT_EXPIRED') {
  setError('账号已过期，请联系管理员购买或续费套餐');
}
```

---

### 6. 默认管理员账号（❌ 未实现）

**需求**:
- 用户名：`autoads`
- 密码：`K$j6z!9Tq@P2w#aR`
- 套餐：终身买断
- 有效期：2099-12-31
- 无需修改密码

**实际情况**:
- ❌ 数据库为空，无任何用户
- ❌ 无数据库初始化脚本
- ❌ 无默认管理员创建逻辑

**影响**: 无法登录管理员账号，无法使用管理功能

**修复建议**:
```typescript
// 创建数据库初始化脚本
// scripts/init-database.ts

import { getDatabase } from '@/lib/db';
import { hashPassword } from '@/lib/crypto';

export async function initializeDatabase() {
  const db = getDatabase();

  // 检查是否已有管理员
  const admin = db.prepare("SELECT * FROM users WHERE username = 'autoads'").get();
  if (admin) {
    console.log('管理员账号已存在');
    return;
  }

  // 创建默认管理员
  const passwordHash = await hashPassword('K$j6z!9Tq@P2w#aR');

  db.prepare(`
    INSERT INTO users (
      username, password_hash, display_name, role, package_type,
      valid_from, valid_until, must_change_password, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'autoads',
    passwordHash,
    'AutoAds管理员',
    'admin',
    'lifetime',
    '2025-01-17T00:00:00Z',
    '2099-12-31T23:59:59Z',
    0,  // 管理员无需修改密码
    1
  );

  console.log('✅ 默认管理员账号创建成功');
}

// 在应用启动时调用
initializeDatabase();
```

---

### 7. 管理员用户管理页面（❌ 未实现）

**需求**:
- 管理员页面：`/admin/users`
- 功能：创建用户、配置套餐、调整有效期、禁用用户、查看用户列表

**实际情况**:
- ❌ 无 `/admin/users` 页面
- ❌ 无管理员CRUD API
- ❌ 无用户列表展示
- ❌ 无套餐配置界面
- ❌ 无有效期调整功能

**影响**: 无法管理用户，核心功能缺失

**修复建议**:
```bash
# 需要创建的文件结构
src/app/admin/
├── users/
│   ├── page.tsx                # 用户列表页面
│   └── new/
│       └── page.tsx            # 创建用户页面
└── backups/
    └── page.tsx                # 备份历史页面

src/app/api/admin/
├── users/
│   ├── route.ts                # GET 用户列表, POST 创建用户
│   └── [id]/
│       └── route.ts            # PUT 更新用户, DELETE 删除用户
└── backups/
    ├── route.ts                # GET 备份列表
    └── manual/
        └── route.ts            # POST 手动备份
```

参考设计文档 `USER_MANAGEMENT_DESIGN.md:439-662` 的详细API设计。

---

### 8. 数据库备份历史展示（❌ 未实现）

**需求**:
- 管理员页面：`/admin/backups`
- 显示备份列表、文件大小、状态、备份时间
- 支持手动触发备份

**实际情况**:
- ❌ 无备份历史页面
- ❌ 无 `backup_logs` 表
- ❌ 无备份API
- ❌ 无手动备份功能

**影响**: 无法查看和管理备份

**修复建议**: 参考第4点"SQLite数据库和备份机制"

---

### 9. 安全措施（❌ 大部分未实现）

**需求**:
1. 有效期防破解（双重验证）
2. 防暴力破解（5次失败锁定5分钟）
3. 密码复杂度验证
4. JWT安全配置

**实际情况**:

#### 9.1 有效期防破解 ❌
- ❌ JWT中未包含 `validUntil` 字段
- ❌ API中未从数据库重新验证有效期
- ❌ 可能被前端篡改

**当前实现**（不安全）:
```typescript
// src/lib/jwt.ts:27-34
export function verifyToken(token: string): JWTPayload | null {
  const decoded = jwt.verify(token, JWT_SECRET);
  return decoded; // ❌ 仅验证签名，未检查数据库
}
```

**安全实现**（设计要求）:
```typescript
// 设计文档要求：双重验证
async function verifyTokenWithDB(token: string) {
  const payload = jwt.verify(token, JWT_SECRET);

  // 从数据库重新查询有效期
  const user = await db.prepare(
    'SELECT valid_until, is_active FROM users WHERE id = ?'
  ).get(payload.userId);

  if (!user) throw new Error('用户不存在');
  if (!user.is_active) throw new Error('账号已禁用');
  if (new Date() > new Date(user.valid_until)) {
    throw new Error('账号已过期，请联系管理员续费');
  }

  return payload;
}
```

#### 9.2 防暴力破解 ❌
- ❌ 无登录失败次数记录
- ❌ 无账号锁定机制
- ❌ 无5分钟冷却期

**修复建议**:
```typescript
// src/lib/auth.ts - 添加防暴力破解
const loginAttempts = new Map<string, { count: number; lockedUntil?: Date }>();

function checkLoginAttempts(email: string): void {
  const attempts = loginAttempts.get(email);

  if (attempts?.lockedUntil && new Date() < attempts.lockedUntil) {
    throw new Error('登录失败次数过多，账号已锁定5分钟');
  }

  if (attempts && attempts.count >= 5) {
    attempts.lockedUntil = new Date(Date.now() + 5 * 60 * 1000);
    throw new Error('登录失败次数过多，账号已锁定5分钟');
  }
}

function recordLoginFailure(email: string): void {
  const attempts = loginAttempts.get(email) || { count: 0 };
  attempts.count++;
  loginAttempts.set(email, attempts);
}

function resetLoginAttempts(email: string): void {
  loginAttempts.delete(email);
}
```

#### 9.3 密码复杂度验证 ⚠️
- ⚠️ 前端有基本验证（最少8位）
- ❌ 后端缺少详细验证
- ❌ 不符合设计要求（大小写+数字+特殊字符）

**设计要求的密码规则**:
- 最少8个字符
- 至少1个大写字母
- 至少1个小写字母
- 至少1个数字
- 至少1个特殊字符 `!@#$%^&*`

**修复建议**:
```typescript
// src/lib/password-validator.ts
export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[]
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('密码至少需要8个字符');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('密码至少需要1个大写字母');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('密码至少需要1个小写字母');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('密码至少需要1个数字');
  }
  if (!/[!@#$%^&*]/.test(password)) {
    errors.push('密码至少需要1个特殊字符（!@#$%^&*）');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
```

#### 9.4 JWT安全配置 ⚠️
- ✅ JWT签名验证已实现
- ⚠️ JWT_SECRET使用默认值（开发环境）
- ❌ 无环境变量配置检查

**当前配置**:
```typescript
// src/lib/jwt.ts:3
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-please-change-in-production'
```

**修复建议**:
```typescript
// 在生产环境强制要求JWT_SECRET
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('生产环境必须配置JWT_SECRET环境变量');
}
```

---

### 10. 多用户数据隔离（⚠️ 部分实现）

**需求**:
- 用户业务数据通过 `user_id` 隔离
- 数据库查询自动过滤用户数据

**实际情况**:
- ✅ JWT包含 `userId` 字段
- ✅ Middleware将 `user_id` 写入请求头（`x-user-id`）
- ⚠️ 部分API有数据隔离（需逐一检查）
- ❌ 无统一的数据隔离中间件

**示例检查**（offers API）:
```typescript
// src/app/api/offers/route.ts
// 需要确保所有查询都包含user_id过滤
```

**修复建议**:
```typescript
// 创建统一的数据隔离工具函数
// src/lib/data-isolation.ts

export function getUserIdFromHeaders(request: NextRequest): number {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    throw new Error('未找到用户ID，请重新登录');
  }
  return parseInt(userId, 10);
}

export function ensureUserOwnership(
  db: Database,
  table: string,
  recordId: number,
  userId: number
): void {
  const record = db.prepare(
    `SELECT user_id FROM ${table} WHERE id = ?`
  ).get(recordId) as { user_id: number } | undefined;

  if (!record) {
    throw new Error('记录不存在');
  }

  if (record.user_id !== userId) {
    throw new Error('无权访问该记录');
  }
}
```

---

## 📊 数据库结构对比

### 当前数据库结构
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,                    -- ✅ 有
  password_hash TEXT,                            -- ✅ 有
  display_name TEXT,                             -- ✅ 有
  google_id TEXT UNIQUE,                         -- ✅ 有（额外功能）
  profile_picture TEXT,                          -- ✅ 有（额外功能）
  role TEXT NOT NULL DEFAULT 'user',             -- ✅ 有
  package_type TEXT NOT NULL DEFAULT 'trial',    -- ✅ 有
  package_expires_at TEXT,                       -- ⚠️ 有但未使用
  is_active INTEGER NOT NULL DEFAULT 1,          -- ✅ 有
  last_login_at TEXT,                            -- ✅ 有
  created_at TEXT NOT NULL DEFAULT (datetime('now')),  -- ✅ 有
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))   -- ✅ 有
);
```

### 设计要求的数据库结构
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,                 -- ❌ 缺失（关键）
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT,                                    -- ⚠️ 应为可选，当前为必填

  role TEXT NOT NULL DEFAULT 'user',
  package_type TEXT NOT NULL,
  valid_from TEXT NOT NULL,                      -- ❌ 缺失（关键）
  valid_until TEXT NOT NULL,                     -- ❌ 缺失（关键）

  is_active INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 1,  -- ❌ 缺失（关键）
  last_login_at TEXT,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER,                            -- ❌ 缺失

  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE backup_logs (                      -- ❌ 完全缺失
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  backup_filename TEXT NOT NULL,
  backup_path TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  backup_type TEXT NOT NULL DEFAULT 'auto'
);
```

### 缺失字段总结
| 字段名 | 重要性 | 影响 |
|--------|--------|------|
| `username` | 🔴 P0 | 无法使用动物名登录，无法区分email和username |
| `valid_from` | 🔴 P0 | 无法记录套餐开始时间 |
| `valid_until` | 🔴 P0 | 无法验证套餐有效期 |
| `must_change_password` | 🔴 P0 | 无法强制首次修改密码 |
| `created_by` | 🟡 P1 | 无法追踪用户创建者 |
| `backup_logs` 表 | 🔴 P0 | 无法记录备份历史 |

---

## 🚨 关键缺失功能清单

### P0 - 严重缺失（阻塞核心需求）

1. ❌ **用户名登录系统** - 数据库缺少 `username` 字段
2. ❌ **套餐有效期管理** - 缺少 `valid_from` 和 `valid_until` 字段
3. ❌ **首次修改密码** - 缺少 `must_change_password` 字段和相关页面
4. ❌ **管理员后台** - 完全缺失（用户管理、备份管理）
5. ❌ **动物名生成器** - 未实现
6. ❌ **数据库备份系统** - 缺少 `backup_logs` 表、备份脚本、定时任务
7. ❌ **默认管理员账号** - 数据库为空
8. ❌ **有效期验证** - 登录时未检查有效期
9. ❌ **有效期防破解** - 未实现双重验证
10. ❌ **防暴力破解** - 无登录失败锁定机制

### P1 - 重要缺失（影响安全和用户体验）

11. ❌ **密码复杂度验证** - 后端未实现完整验证
12. ❌ **生产环境JWT检查** - 未强制配置JWT_SECRET
13. ❌ **注册功能禁用** - 需要移除注册页面和API

### P2 - 次要缺失（可后续优化）

14. ⚠️ **数据隔离工具** - 需要统一的辅助函数
15. ⚠️ **用户创建者追踪** - 缺少 `created_by` 字段

---

## 📝 改进建议

### 短期（1-2周）- 阻塞需求修复

1. **数据库迁移脚本**
   - 添加 `username` 字段（唯一索引）
   - 添加 `valid_from` 和 `valid_until` 字段
   - 添加 `must_change_password` 字段
   - 创建 `backup_logs` 表
   - 创建默认管理员账号

2. **禁用自主注册**
   - 删除 `/register` 页面
   - 删除或保护 `/api/auth/register` API
   - 移除登录页的注册链接

3. **实现核心认证功能**
   - 添加用户名登录支持
   - 实现有效期检查（登录时）
   - 实现首次修改密码流程
   - 实现防暴力破解机制

4. **管理员基础功能**
   - 创建管理员用户管理页面
   - 实现用户CRUD API
   - 实现动物名生成器
   - 实现套餐和有效期配置

### 中期（2-4周）- 安全和备份

5. **安全加固**
   - 实现有效期双重验证
   - 完善密码复杂度验证
   - 添加生产环境JWT检查
   - 实现统一数据隔离中间件

6. **备份系统**
   - 创建备份脚本
   - 集成node-cron定时任务
   - 实现备份历史查询API
   - 创建备份管理页面

### 长期（1-2个月）- 优化和完善

7. **用户体验优化**
   - 添加套餐购买/续费引导
   - 优化有效期即将到期提醒
   - 添加管理员操作日志
   - 优化用户列表搜索和筛选

8. **监控和审计**
   - 添加登录日志记录
   - 添加管理员操作审计
   - 实现异常登录告警
   - 性能监控和优化

---

## ✅ 验收标准更新

基于当前实现情况，更新验收标准：

### 功能验收（0/8 通过）
- [ ] ❌ 默认管理员可成功登录
- [ ] ❌ 新用户首次登录强制修改密码
- [ ] ❌ 管理员可创建、编辑、禁用用户
- [ ] ❌ 过期用户无法登录，显示正确提示
- [ ] ❌ 管理员可查看备份历史
- [ ] ❌ 每日自动备份正常执行
- [ ] ❌ 手动备份功能正常
- [ ] ⚠️ 多用户可并发访问（部分实现）

### 安全验收（1/6 通过）
- [ ] ❌ 密码强度验证通过
- [ ] ✅ JWT签名验证通过
- [ ] ❌ 有效期防篡改验证通过
- [ ] ❌ 登录失败5次后账号锁定
- [ ] ✅ SQL注入攻击无效（better-sqlite3参数化查询）
- [ ] ✅ XSS攻击无效（React自动转义）

### 性能验收（无法测试）
- [ ] ⏸️ 登录响应时间 < 500ms
- [ ] ⏸️ API响应时间 < 200ms（P95）
- [ ] ⏸️ 支持100+ QPS并发
- [ ] ⏸️ 备份时间 < 10秒（1MB数据库）

---

## 🎯 下一步行动计划

### 立即执行（本周）
1. 创建数据库迁移脚本（添加缺失字段）
2. 禁用注册功能（删除页面和API）
3. 初始化默认管理员账号
4. 实现基础用户名登录

### 本月完成
1. 完整的管理员用户管理系统
2. 首次修改密码功能
3. 有效期验证和安全加固
4. 动物名生成器

### 下月完成
1. 完整的备份系统
2. 防暴力破解机制
3. E2E测试和性能测试
4. 文档更新

---

## 📚 附录

### A. 需要创建的文件清单

```
数据库迁移:
- scripts/migrations/001_add_user_management_fields.sql
- scripts/migrations/002_create_backup_logs_table.sql
- scripts/init-database.ts

前端页面:
- src/app/change-password/page.tsx
- src/app/admin/users/page.tsx
- src/app/admin/users/new/page.tsx
- src/app/admin/backups/page.tsx

API路由:
- src/app/api/admin/users/route.ts
- src/app/api/admin/users/[id]/route.ts
- src/app/api/admin/backups/route.ts
- src/app/api/admin/backups/manual/route.ts
- src/app/api/auth/change-password/route.ts

业务逻辑:
- src/lib/animal-name-generator.ts
- src/lib/password-validator.ts
- src/lib/data-isolation.ts
- src/lib/cron/backup-scheduler.ts
- scripts/backup-database.ts
```

### B. 需要修改的文件清单

```
删除/修改:
- src/app/login/page.tsx (删除注册链接)
- src/app/register/page.tsx (删除整个文件)
- src/app/api/auth/register/route.ts (删除或标记为管理员专用)

更新:
- src/lib/auth.ts (添加有效期验证、防暴力破解)
- src/lib/jwt.ts (添加validUntil字段、生产环境检查)
- src/middleware.ts (移除/register路径)
- src/lib/db.ts (添加迁移脚本执行)
```

### C. 环境变量配置

```bash
# .env.local
JWT_SECRET=<生产环境必须配置>
JWT_EXPIRES_IN=7d

DATABASE_PATH=./data/autoads.db
BACKUP_DIR=./data/backups
MAX_BACKUP_DAYS=30

BCRYPT_SALT_ROUNDS=10
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION_MINUTES=5

BACKUP_CRON_SCHEDULE=0 2 * * *
ENABLE_AUTO_BACKUP=true
```

---

**报告结束**

**生成时间**: 2025-11-18
**验证范围**: 用户管理和套餐功能全面验证
**符合度**: 15% (严重不符合需求，需要大量开发工作)
