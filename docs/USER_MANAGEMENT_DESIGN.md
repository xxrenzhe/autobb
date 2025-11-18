# AutoAds 用户管理系统设计

**日期**: 2025-01-17
**版本**: v1.0
**状态**: 设计阶段

---

## 📋 需求概述

### 业务需求

1. **简单的用户管理**：仅管理员可创建用户
2. **强制修改密码**：新用户首次登录必须修改密码（管理员除外）
3. **后端数据库**：单实例SQLite，实现每日自动备份
4. **有效期管理**：过期后无法登录，提示购买/升级套餐
5. **默认管理员**：username: `autoads` / password: `K$j6z!9Tq@P2w#aR`
6. **管理员功能**：用户管理页面（CRUD、套餐配置、有效期调整、禁用）
7. **备份历史**：管理员可查看数据库备份记录
8. **安全措施**：防止有效期被篡改
9. **多用户并发**：用户业务数据在本地，共享后端认证服务

### 套餐类型

| 套餐名称 | 价格 | 有效期 | 说明 |
|---------|------|--------|------|
| 年卡 | ¥5,999 | 365天 | 适合BB新人 |
| 终身买断 | ¥10,999 | 长期 | 适合持续投入的个人 |
| 私有化部署 | ¥29,999 | 1年+续签 | 独立工作室，含技术支持 |
| 试用套餐 | 免费 | 7/14/30天 | 市场推广活动 |

**注**：所有套餐功能无区别，仅有效期不同

---

## 🏗️ 技术架构

### 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js Frontend                      │
│  - 登录页 (/login)                                       │
│  - 首次修改密码页 (/change-password)                     │
│  - 业务功能页 (需身份验证)                                │
│  - 管理员页面 (/admin/users, /admin/backups)            │
└────────────────┬────────────────────────────────────────┘
                 │ HTTP + JWT Token
                 ↓
┌─────────────────────────────────────────────────────────┐
│              Next.js API Routes (Backend)                │
│  - /api/auth/* (认证相关)                                │
│  - /api/admin/* (管理员功能)                             │
│  - /api/protected/* (业务API，需token验证)               │
└────────────────┬────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────┐
│              SQLite Database (users.db)                  │
│  - users表：用户账号、套餐、有效期                        │
│  - backup_logs表：备份历史                               │
└────────────────┬────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────┐
│           Daily Backup (Cron Job)                        │
│  - 每日凌晨2点备份数据库                                  │
│  - 保留最近30天备份                                       │
└─────────────────────────────────────────────────────────┘

用户业务数据（Offer、Campaign等）仍然保存在：
┌─────────────────────────────────────────────────────────┐
│           IndexedDB (用户本地浏览器)                      │
│  - google_ads_accounts, offers, campaigns, etc.         │
└─────────────────────────────────────────────────────────┘
```

### 技术栈

| 层级 | 技术选型 | 说明 |
|------|---------|------|
| 前端框架 | Next.js 14 + TypeScript | 现有技术栈 |
| UI组件库 | Makerkit组件 | 现有UI系统 |
| 数据库 | SQLite | 单实例、零配置、易备份 |
| ORM | better-sqlite3 | 同步API、高性能 |
| 认证 | JWT (jsonwebtoken) | 无状态、安全 |
| 密码加密 | bcrypt | 行业标准 |
| 定时任务 | node-cron | 简单易用 |
| 状态管理 | React Context | 轻量级、满足需求 |

---

## 💾 数据库设计

### 数据库文件位置

```
/data/
  ├── users.db              # 主数据库
  └── backups/              # 备份目录
      ├── users_20250117_020000.db
      ├── users_20250118_020000.db
      └── ...
```

### users 表

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,              -- 用户名（唯一）
  password_hash TEXT NOT NULL,                -- bcrypt加密密码
  display_name TEXT NOT NULL,                 -- 显示名称
  email TEXT,                                 -- 邮箱（可选）

  role TEXT NOT NULL DEFAULT 'user',          -- 角色：'admin' | 'user'
  package_type TEXT NOT NULL,                 -- 套餐类型：'annual' | 'lifetime' | 'private' | 'trial'
  valid_from TEXT NOT NULL,                   -- 有效期开始日期（ISO 8601）
  valid_until TEXT NOT NULL,                  -- 有效期结束日期（ISO 8601）

  is_active INTEGER NOT NULL DEFAULT 1,       -- 是否启用：1=启用, 0=禁用
  must_change_password INTEGER NOT NULL DEFAULT 1,  -- 首次登录修改密码：1=必须, 0=不必须
  last_login_at TEXT,                         -- 最后登录时间

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER,                         -- 创建者user_id（管理员）

  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 索引
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_valid_until ON users(valid_until);
CREATE INDEX idx_users_role ON users(role);
```

### backup_logs 表

```sql
CREATE TABLE backup_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  backup_filename TEXT NOT NULL,              -- 备份文件名
  backup_path TEXT NOT NULL,                  -- 备份文件路径
  file_size_bytes INTEGER NOT NULL,           -- 文件大小（字节）
  status TEXT NOT NULL,                       -- 状态：'success' | 'failed'
  error_message TEXT,                         -- 错误信息（失败时）
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  backup_type TEXT NOT NULL DEFAULT 'auto'    -- 备份类型：'auto' | 'manual'
);

-- 索引
CREATE INDEX idx_backup_logs_created_at ON backup_logs(created_at DESC);
```

### 套餐类型枚举

```typescript
export enum PackageType {
  ANNUAL = 'annual',         // 年卡
  LIFETIME = 'lifetime',     // 终身买断
  PRIVATE = 'private',       // 私有化部署
  TRIAL = 'trial'            // 试用套餐
}

export const PACKAGE_INFO = {
  annual: {
    name: '年卡',
    price: 5999,
    duration_days: 365,
    description: '适合BB新人，期望在25年Q4促销季大赚一笔的个人'
  },
  lifetime: {
    name: '终身买断制',
    price: 10999,
    duration_days: 36500,  // 100年（等同终身）
    description: '适合热爱BB并持续投入的个人，外加相信大师兄能力的粉丝'
  },
  private: {
    name: '私有化部署',
    price: 29999,
    duration_days: 365,    // 1年，可续签
    description: '适合独立工作室，包含1年技术支持和有限功能定制'
  },
  trial: {
    name: '试用套餐',
    price: 0,
    duration_days: 7,      // 默认7天，可调整为14/30天
    description: '市场推广活动赠送的试用期'
  }
} as const;
```

### 默认管理员数据

```sql
-- 插入默认管理员（密码: K$j6z!9Tq@P2w#aR）
INSERT INTO users (
  username,
  password_hash,
  display_name,
  role,
  package_type,
  valid_from,
  valid_until,
  must_change_password
) VALUES (
  'autoads',
  '$2b$10$...', -- bcrypt hash of 'K$j6z!9Tq@P2w#aR'
  'AutoAds管理员',
  'admin',
  'lifetime',
  '2025-01-17T00:00:00Z',
  '2099-12-31T23:59:59Z',
  0  -- 管理员无需修改密码
);
```

---

## 🔐 认证与授权

### JWT Token 设计

```typescript
interface JWTPayload {
  userId: number;
  username: string;
  role: 'admin' | 'user';
  packageType: string;
  validUntil: string;  // ISO 8601
  iat: number;         // Issued at
  exp: number;         // Expires at (token有效期：7天)
}
```

**Token生成规则**：
- 签名密钥：从环境变量 `JWT_SECRET` 读取（随机生成，不可逆）
- Token有效期：7天
- 刷新机制：前端检测到token即将过期时自动刷新

**安全措施**：
1. **密码加密**：bcrypt + 盐值（cost=10）
2. **Token签名**：HMAC SHA256，密钥存储在服务端环境变量
3. **有效期检查**：每次API请求服务端验证 `valid_until`
4. **敏感信息保护**：
   - `valid_until` 不可在前端修改（服务端重新查询数据库）
   - `password_hash` 永不返回给前端
5. **防暴力破解**：登录失败5次后锁定账号5分钟

### 认证流程

```
┌─────────┐                                    ┌─────────┐
│ 用户登录 │                                    │ 后端API │
└────┬────┘                                    └────┬────┘
     │                                              │
     │ 1. POST /api/auth/login                     │
     │    { username, password }                   │
     ├────────────────────────────────────────────>│
     │                                              │ 2. 查询users表
     │                                              │    验证密码
     │                                              │    检查is_active
     │                                              │    检查valid_until
     │                                              │
     │ 3. 返回JWT token + user信息                 │
     │    { token, user: {...}, mustChangePassword }│
     │<────────────────────────────────────────────│
     │                                              │
     │ 4a. 如果mustChangePassword=true             │
     │     跳转到 /change-password                  │
     │                                              │
     │ 4b. 否则存储token到localStorage              │
     │     跳转到业务页面                            │
     │                                              │
     │ 5. 访问业务API时携带token                    │
     │    Authorization: Bearer <token>            │
     ├────────────────────────────────────────────>│
     │                                              │ 6. 验证token签名
     │                                              │    解析payload
     │                                              │    查询数据库验证valid_until
     │                                              │    （防止前端篡改）
     │                                              │
     │ 7. 返回业务数据                              │
     │<────────────────────────────────────────────│
     │                                              │
```

**有效期验证双重检查**：
```typescript
// ❌ 不安全：仅检查token中的valid_until（可被篡改）
const { validUntil } = decodeToken(token);
if (new Date() > new Date(validUntil)) {
  throw new Error('账号已过期');
}

// ✅ 安全：从数据库重新查询valid_until
const { userId } = decodeToken(token);
const user = await db.getUserById(userId);
if (new Date() > new Date(user.valid_until)) {
  throw new Error('账号已过期，请联系管理员续费');
}
```

---

## 🌐 API 设计

### 认证相关 API

#### 1. 用户登录

**端点**: `POST /api/auth/login`

**请求体**:
```typescript
interface LoginRequest {
  username: string;
  password: string;
}
```

**响应**:
```typescript
interface LoginResponse {
  success: boolean;
  token?: string;
  user?: {
    id: number;
    username: string;
    displayName: string;
    role: 'admin' | 'user';
    packageType: string;
    validUntil: string;
  };
  mustChangePassword?: boolean;  // true表示需要修改密码
  error?: {
    code: 'INVALID_CREDENTIALS' | 'ACCOUNT_DISABLED' | 'ACCOUNT_EXPIRED' | 'ACCOUNT_LOCKED';
    message: string;
  };
}
```

**错误场景**:
- `INVALID_CREDENTIALS`: 用户名或密码错误
- `ACCOUNT_DISABLED`: 账号已被禁用，请联系管理员
- `ACCOUNT_EXPIRED`: 账号已过期，请联系管理员续费或购买套餐
- `ACCOUNT_LOCKED`: 登录失败次数过多，账号已锁定5分钟

---

#### 2. 修改密码

**端点**: `POST /api/auth/change-password`

**请求头**: `Authorization: Bearer <token>`

**请求体**:
```typescript
interface ChangePasswordRequest {
  oldPassword?: string;    // 非首次修改时必填
  newPassword: string;     // 至少8位，包含大小写字母+数字+特殊字符
  confirmPassword: string;
}
```

**响应**:
```typescript
interface ChangePasswordResponse {
  success: boolean;
  message?: string;
  error?: {
    code: 'PASSWORD_MISMATCH' | 'WEAK_PASSWORD' | 'INVALID_OLD_PASSWORD';
    message: string;
  };
}
```

**密码强度规则**:
- 最少8个字符
- 至少1个大写字母
- 至少1个小写字母
- 至少1个数字
- 至少1个特殊字符 `!@#$%^&*`

---

#### 3. 验证Token

**端点**: `GET /api/auth/verify`

**请求头**: `Authorization: Bearer <token>`

**响应**:
```typescript
interface VerifyResponse {
  success: boolean;
  user?: {
    id: number;
    username: string;
    displayName: string;
    role: 'admin' | 'user';
    packageType: string;
    validUntil: string;
    isExpiringSoon: boolean;  // 剩余30天内为true
  };
  error?: {
    code: 'INVALID_TOKEN' | 'TOKEN_EXPIRED' | 'ACCOUNT_EXPIRED';
    message: string;
  };
}
```

---

#### 4. 登出

**端点**: `POST /api/auth/logout`

**请求头**: `Authorization: Bearer <token>`

**响应**:
```typescript
interface LogoutResponse {
  success: boolean;
}
```

**前端行为**:
- 清除 `localStorage` 中的token
- 清除 `sessionStorage`
- 跳转到登录页

---

### 管理员 API

#### 1. 创建用户

**端点**: `POST /api/admin/users`

**权限**: 仅管理员

**请求头**: `Authorization: Bearer <admin_token>`

**请求体**:
```typescript
interface CreateUserRequest {
  username: string;        // 4-20位字母数字下划线
  password: string;        // 临时密码（符合强度规则）
  displayName: string;     // 显示名称
  email?: string;          // 邮箱（可选）
  packageType: 'annual' | 'lifetime' | 'private' | 'trial';
  validFromDate?: string;  // 有效期开始日期（默认今天）
  durationDays?: number;   // 有效期天数（覆盖套餐默认值）
}
```

**响应**:
```typescript
interface CreateUserResponse {
  success: boolean;
  user?: {
    id: number;
    username: string;
    displayName: string;
    packageType: string;
    validFrom: string;
    validUntil: string;
    tempPassword: string;  // 临时密码（仅此一次返回）
  };
  error?: {
    code: 'USERNAME_EXISTS' | 'INVALID_PACKAGE' | 'PERMISSION_DENIED';
    message: string;
  };
}
```

---

#### 2. 获取用户列表

**端点**: `GET /api/admin/users`

**权限**: 仅管理员

**查询参数**:
```typescript
interface GetUsersQuery {
  page?: number;           // 页码（默认1）
  pageSize?: number;       // 每页数量（默认20）
  role?: 'admin' | 'user'; // 角色筛选
  packageType?: string;    // 套餐筛选
  status?: 'active' | 'disabled' | 'expired';  // 状态筛选
  search?: string;         // 搜索用户名/显示名称
}
```

**响应**:
```typescript
interface GetUsersResponse {
  success: boolean;
  data?: {
    users: Array<{
      id: number;
      username: string;
      displayName: string;
      email: string | null;
      role: 'admin' | 'user';
      packageType: string;
      validFrom: string;
      validUntil: string;
      isActive: boolean;
      isExpired: boolean;
      daysRemaining: number;  // 剩余天数（负数表示已过期）
      lastLoginAt: string | null;
      createdAt: string;
    }>;
    pagination: {
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
  };
}
```

---

#### 3. 更新用户

**端点**: `PUT /api/admin/users/[id]`

**权限**: 仅管理员

**请求体**:
```typescript
interface UpdateUserRequest {
  displayName?: string;
  email?: string;
  packageType?: string;
  validUntil?: string;     // 调整有效期
  isActive?: boolean;      // 启用/禁用用户
  resetPassword?: string;  // 重置密码（符合强度规则）
}
```

**响应**:
```typescript
interface UpdateUserResponse {
  success: boolean;
  user?: {
    id: number;
    username: string;
    displayName: string;
    packageType: string;
    validUntil: string;
    isActive: boolean;
  };
  tempPassword?: string;  // 重置密码时返回
  error?: {
    code: 'USER_NOT_FOUND' | 'CANNOT_MODIFY_ADMIN' | 'PERMISSION_DENIED';
    message: string;
  };
}
```

**限制**:
- 不允许修改默认管理员 `autoads` 的套餐和有效期
- 不允许删除管理员账号
- 不允许降级管理员权限

---

#### 4. 删除用户

**端点**: `DELETE /api/admin/users/[id]`

**权限**: 仅管理员

**响应**:
```typescript
interface DeleteUserResponse {
  success: boolean;
  error?: {
    code: 'USER_NOT_FOUND' | 'CANNOT_DELETE_ADMIN' | 'PERMISSION_DENIED';
    message: string;
  };
}
```

**限制**:
- 不允许删除管理员账号
- 删除用户不删除其业务数据（业务数据在本地IndexedDB）

---

#### 5. 获取备份历史

**端点**: `GET /api/admin/backups`

**权限**: 仅管理员

**查询参数**:
```typescript
interface GetBackupsQuery {
  page?: number;
  pageSize?: number;
}
```

**响应**:
```typescript
interface GetBackupsResponse {
  success: boolean;
  data?: {
    backups: Array<{
      id: number;
      backupFilename: string;
      backupPath: string;
      fileSizeBytes: number;
      fileSizeMB: string;        // 格式化大小
      status: 'success' | 'failed';
      errorMessage: string | null;
      backupType: 'auto' | 'manual';
      createdAt: string;
    }>;
    pagination: {
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
  };
}
```

---

#### 6. 手动触发备份

**端点**: `POST /api/admin/backups/manual`

**权限**: 仅管理员

**响应**:
```typescript
interface ManualBackupResponse {
  success: boolean;
  backup?: {
    backupFilename: string;
    backupPath: string;
    fileSizeBytes: number;
    createdAt: string;
  };
  error?: {
    code: 'BACKUP_FAILED';
    message: string;
  };
}
```

---

## 🎨 前端页面设计

### 1. 登录页 (`/login`)

**布局**:
```
┌────────────────────────────────────────┐
│          AutoAds 登录                  │
│                                        │
│  ┌──────────────────────────────────┐ │
│  │ 用户名                            │ │
│  │ [___________________________]    │ │
│  │                                   │ │
│  │ 密码                              │ │
│  │ [___________________________]    │ │
│  │                                   │ │
│  │ [ 登录 ]                          │ │
│  └──────────────────────────────────┘ │
│                                        │
│  提示：忘记密码请联系管理员             │
└────────────────────────────────────────┘
```

**错误提示**:
- ❌ **用户名或密码错误**
- ❌ **账号已被禁用，请联系管理员**
- ❌ **账号已过期，请购买或续费套餐**
  → 显示套餐购买链接：[查看套餐详情](#)
- ❌ **登录失败次数过多，账号已锁定5分钟**

**登录成功后**:
- 如果 `mustChangePassword = true`：跳转到 `/change-password`
- 否则：跳转到业务主页 `/dashboard`

---

### 2. 首次修改密码页 (`/change-password`)

**布局**:
```
┌────────────────────────────────────────┐
│      首次登录 - 请修改密码              │
│                                        │
│  ⚠️ 为了账号安全，请立即修改密码        │
│                                        │
│  ┌──────────────────────────────────┐ │
│  │ 新密码                            │ │
│  │ [___________________________]    │ │
│  │ 至少8位，包含大小写字母+数字+特殊字符│ │
│  │                                   │ │
│  │ 确认密码                          │ │
│  │ [___________________________]    │ │
│  │                                   │ │
│  │ [ 确认修改 ]                      │ │
│  └──────────────────────────────────┘ │
│                                        │
│  密码强度：█████░░░░░ 中等             │
└────────────────────────────────────────┘
```

**验证规则**:
- 实时显示密码强度（弱/中等/强）
- 两次密码必须一致
- 符合密码复杂度要求

**修改成功后**:
- 自动跳转到业务主页 `/dashboard`
- 显示提示：✅ 密码修改成功

---

### 3. 管理员用户管理页 (`/admin/users`)

**权限**: 仅管理员可访问

**布局**:
```
┌────────────────────────────────────────────────────────────┐
│  AutoAds - 用户管理                    [+ 创建新用户]       │
├────────────────────────────────────────────────────────────┤
│  筛选：[全部套餐 ▼] [全部状态 ▼]  搜索：[_________] [搜索] │
├────────────────────────────────────────────────────────────┤
│  用户名    │ 显示名称 │ 套餐类型 │ 有效期至    │ 状态 │ 操作│
│  ─────────┼─────────┼─────────┼────────────┼─────┼──────│
│  user001  │ 张三    │ 年卡    │ 2025-12-31 │ 正常 │ [编辑]│
│  user002  │ 李四    │ 终身买断│ 2099-12-31 │ 正常 │ [编辑]│
│  user003  │ 王五    │ 试用    │ 2025-01-24 │ 过期 │ [编辑]│
│  ...                                                       │
├────────────────────────────────────────────────────────────┤
│  第1页 / 共5页    每页20条    [上一页] [下一页]            │
└────────────────────────────────────────────────────────────┘
```

**功能**:
- ➕ 创建新用户（弹窗）
- ✏️ 编辑用户（弹窗）
- 🔍 搜索用户
- 📊 套餐/状态筛选
- 📄 分页显示

**创建用户弹窗**:
```
┌──────────────────────────────────────┐
│  创建新用户                    [✕]   │
├──────────────────────────────────────┤
│  用户名*：[_____________________]    │
│  显示名称*：[_____________________]  │
│  邮箱（可选）：[_________________]   │
│                                      │
│  套餐类型*：[年卡 ▼]                 │
│                                      │
│  有效期设置：                        │
│    开始日期：[2025-01-17]            │
│    结束日期：[2026-01-17]（自动计算）│
│    或调整天数：[365] 天              │
│                                      │
│  临时密码*：[_____________________]  │
│  （用户首次登录需修改）               │
│                                      │
│  [ 取消 ]          [ 创建 ]          │
└──────────────────────────────────────┘
```

**编辑用户弹窗**:
```
┌──────────────────────────────────────┐
│  编辑用户：user001              [✕]  │
├──────────────────────────────────────┤
│  用户名：user001（不可修改）         │
│  显示名称：[_____________________]   │
│  邮箱：[_________________________]   │
│                                      │
│  套餐类型：[年卡 ▼]                  │
│  有效期至：[2025-12-31]              │
│    或延长天数：[___] 天 [延长]       │
│                                      │
│  账号状态：                          │
│    ○ 启用  ● 禁用                   │
│                                      │
│  密码管理：                          │
│    [ 重置密码 ]                      │
│                                      │
│  [ 取消 ]          [ 保存 ]          │
└──────────────────────────────────────┘
```

---

### 4. 管理员备份历史页 (`/admin/backups`)

**权限**: 仅管理员可访问

**布局**:
```
┌────────────────────────────────────────────────────────────┐
│  AutoAds - 数据库备份历史           [手动备份]             │
├────────────────────────────────────────────────────────────┤
│  备份文件名                │ 大小   │ 状态   │ 备份时间     │
│  ─────────────────────────┼───────┼───────┼─────────────│
│  users_20250117_020000.db │ 2.4MB │ 成功  │ 2025-01-17 02:00│
│  users_20250116_020000.db │ 2.3MB │ 成功  │ 2025-01-16 02:00│
│  users_20250115_020000.db │ 2.3MB │ 成功  │ 2025-01-15 02:00│
│  users_20250114_020000.db │ -     │ 失败  │ 2025-01-14 02:00│
│  ...                                                       │
├────────────────────────────────────────────────────────────┤
│  第1页 / 共2页    每页20条    [上一页] [下一页]            │
└────────────────────────────────────────────────────────────┘
```

**功能**:
- 📁 查看备份历史
- 🔄 手动触发备份
- 📊 显示备份状态（成功/失败）
- 📏 显示文件大小

**备份策略**:
- 自动备份：每日凌晨2点
- 保留策略：最近30天
- 命名格式：`users_YYYYMMDD_HHMMSS.db`

---

## 🔒 安全措施

### 1. 密码安全

```typescript
import bcrypt from 'bcrypt';

// 密码加密
const SALT_ROUNDS = 10;
const hashedPassword = await bcrypt.hash(plainPassword, SALT_ROUNDS);

// 密码验证
const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
```

### 2. JWT密钥管理

```bash
# .env.local
JWT_SECRET=<随机生成的64位密钥>
JWT_EXPIRES_IN=7d
```

**密钥生成**（Node.js）:
```typescript
import crypto from 'crypto';
const secret = crypto.randomBytes(64).toString('hex');
```

### 3. 有效期防篡改

```typescript
// ❌ 错误：仅检查token payload（可被篡改）
function verifyTokenOnly(token: string) {
  const payload = jwt.verify(token, JWT_SECRET);
  if (new Date() > new Date(payload.validUntil)) {
    throw new Error('账号已过期');
  }
}

// ✅ 正确：双重验证（token + 数据库）
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

### 4. 防暴力破解

```typescript
// 使用内存缓存记录登录失败次数
const loginAttempts = new Map<string, { count: number; lockedUntil?: Date }>();

function checkLoginAttempts(username: string): void {
  const attempts = loginAttempts.get(username);

  if (attempts?.lockedUntil && new Date() < attempts.lockedUntil) {
    throw new Error('账号已锁定，请5分钟后重试');
  }

  if (attempts && attempts.count >= 5) {
    attempts.lockedUntil = new Date(Date.now() + 5 * 60 * 1000); // 5分钟
    throw new Error('登录失败次数过多，账号已锁定5分钟');
  }
}

function recordLoginFailure(username: string): void {
  const attempts = loginAttempts.get(username) || { count: 0 };
  attempts.count++;
  loginAttempts.set(username, attempts);
}

function resetLoginAttempts(username: string): void {
  loginAttempts.delete(username);
}
```

### 5. SQL注入防护

```typescript
// ✅ 使用参数化查询
db.prepare('SELECT * FROM users WHERE username = ?').get(username);

// ❌ 永不拼接SQL字符串
// const sql = `SELECT * FROM users WHERE username = '${username}'`;
```

### 6. XSS防护

```typescript
// 前端：使用React自动转义
<div>{user.displayName}</div>  // 自动转义HTML

// 后端：验证输入格式
function validateUsername(username: string): boolean {
  return /^[a-zA-Z0-9_]{4,20}$/.test(username);
}
```

---

## 🔄 数据备份方案

### 自动备份脚本

**位置**: `/scripts/backup-database.ts`

```typescript
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'users.db');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const MAX_BACKUPS = 30; // 保留最近30天

async function backupDatabase(): Promise<void> {
  try {
    // 确保备份目录存在
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    // 生成备份文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').split('Z')[0];
    const backupFilename = `users_${timestamp}.db`;
    const backupPath = path.join(BACKUP_DIR, backupFilename);

    // 复制数据库文件
    fs.copyFileSync(DB_PATH, backupPath);

    // 获取文件大小
    const stats = fs.statSync(backupPath);
    const fileSizeBytes = stats.size;

    // 记录到backup_logs表
    const db = new Database(DB_PATH);
    db.prepare(`
      INSERT INTO backup_logs (
        backup_filename,
        backup_path,
        file_size_bytes,
        status,
        backup_type
      ) VALUES (?, ?, ?, 'success', 'auto')
    `).run(backupFilename, backupPath, fileSizeBytes);
    db.close();

    console.log(`✅ 数据库备份成功: ${backupFilename} (${(fileSizeBytes / 1024 / 1024).toFixed(2)}MB)`);

    // 清理旧备份
    cleanupOldBackups();
  } catch (error) {
    console.error('❌ 数据库备份失败:', error);

    // 记录失败日志
    try {
      const db = new Database(DB_PATH);
      db.prepare(`
        INSERT INTO backup_logs (
          backup_filename,
          backup_path,
          file_size_bytes,
          status,
          error_message,
          backup_type
        ) VALUES (?, ?, 0, 'failed', ?, 'auto')
      `).run('', '', error.message);
      db.close();
    } catch (logError) {
      console.error('无法记录备份失败日志:', logError);
    }
  }
}

function cleanupOldBackups(): void {
  const backupFiles = fs.readdirSync(BACKUP_DIR)
    .filter(file => file.startsWith('users_') && file.endsWith('.db'))
    .map(file => ({
      name: file,
      path: path.join(BACKUP_DIR, file),
      time: fs.statSync(path.join(BACKUP_DIR, file)).mtime
    }))
    .sort((a, b) => b.time.getTime() - a.time.getTime());

  // 删除超过MAX_BACKUPS的旧备份
  if (backupFiles.length > MAX_BACKUPS) {
    const filesToDelete = backupFiles.slice(MAX_BACKUPS);
    filesToDelete.forEach(file => {
      fs.unlinkSync(file.path);
      console.log(`🗑️  删除旧备份: ${file.name}`);
    });
  }
}

// 执行备份
backupDatabase();
```

### Cron定时任务

**位置**: `/lib/cron/backup-scheduler.ts`

```typescript
import cron from 'node-cron';
import { exec } from 'child_process';
import path from 'path';

// 每日凌晨2点执行备份
export function startBackupScheduler() {
  cron.schedule('0 2 * * *', () => {
    console.log('📅 执行定时备份任务...');

    const scriptPath = path.join(process.cwd(), 'scripts', 'backup-database.ts');

    exec(`ts-node ${scriptPath}`, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ 备份任务执行失败:', error);
        return;
      }
      console.log(stdout);
    });
  });

  console.log('✅ 备份定时任务已启动（每日02:00执行）');
}
```

**启动位置**: `/pages/api/_app.ts` 或 Next.js自定义服务器

```typescript
// 在Next.js启动时初始化
import { startBackupScheduler } from '@/lib/cron/backup-scheduler';

if (process.env.NODE_ENV === 'production') {
  startBackupScheduler();
}
```

---

## 👥 多用户并发设计

### 架构说明

```
用户A浏览器                      用户B浏览器
   │                                │
   │ IndexedDB (本地)               │ IndexedDB (本地)
   │  - offers_A                    │  - offers_B
   │  - campaigns_A                 │  - campaigns_B
   │  - launch_scores_A             │  - launch_scores_B
   │                                │
   └────────┬───────────────────────┘
            │
            ↓ JWT Token (携带userId)
   ┌────────────────────────────┐
   │  Next.js API Routes        │
   │  - 认证与授权              │
   │  - 有效期验证              │
   │  - Google Ads API代理      │
   └────────────────────────────┘
            │
            ↓
   ┌────────────────────────────┐
   │  SQLite (users.db)         │
   │  - 用户账号                │
   │  - 套餐和有效期            │
   │  - 备份历史                │
   └────────────────────────────┘
```

**关键点**：
1. **业务数据隔离**：每个用户的Offer、Campaign等数据存储在自己浏览器的IndexedDB中
2. **账号信息共享**：用户账号、套餐、有效期存储在后端SQLite
3. **并发访问**：多用户可同时访问后端API，通过JWT识别身份
4. **无数据冲突**：用户间业务数据完全隔离，不存在并发写冲突

### SQLite并发性能

**better-sqlite3配置**:
```typescript
import Database from 'better-sqlite3';

const db = new Database('data/users.db', {
  readonly: false,
  fileMustExist: false,
  timeout: 5000,  // 5秒超时
  verbose: process.env.NODE_ENV === 'development' ? console.log : undefined
});

// 启用WAL模式（Write-Ahead Logging）提升并发性能
db.pragma('journal_mode = WAL');

// 优化性能
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -64000');  // 64MB缓存
```

**并发能力**：
- SQLite WAL模式支持多读一写
- 典型场景：100+ QPS（查询为主）
- 对于AutoAds的管理场景（读多写少），完全满足需求

---

## 📦 依赖包清单

```json
{
  "dependencies": {
    "better-sqlite3": "^9.2.2",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "node-cron": "^3.0.3",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/bcrypt": "^5.0.2",
    "@types/better-sqlite3": "^7.6.8",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/node-cron": "^3.0.11"
  }
}
```

---

## 🚀 实施计划

### Phase 1: 后端核心（2天）
- [x] 数据库Schema设计
- [ ] SQLite初始化脚本
- [ ] 认证API实现（login, change-password, verify）
- [ ] JWT中间件
- [ ] 管理员API实现（CRUD users）
- [ ] 单元测试（认证流程）

### Phase 2: 备份系统（1天）
- [ ] 备份脚本实现
- [ ] Cron定时任务
- [ ] 管理员备份API
- [ ] 备份恢复测试

### Phase 3: 前端页面（3天）
- [ ] 登录页实现
- [ ] 首次修改密码页
- [ ] 管理员用户管理页
- [ ] 管理员备份历史页
- [ ] 统一认证Context
- [ ] 路由守卫（ProtectedRoute）

### Phase 4: 安全加固（1天）
- [ ] 有效期双重验证
- [ ] 防暴力破解
- [ ] XSS/SQL注入检测
- [ ] 安全审计日志

### Phase 5: 测试与文档（1天）
- [ ] E2E测试（Playwright）
- [ ] 多用户并发测试
- [ ] 性能压测（100 QPS）
- [ ] 用户文档编写
- [ ] 部署指南

**总计**: 8个工作日

---

## 📝 环境变量配置

```bash
# .env.local
# ==========================================
# JWT配置
# ==========================================
JWT_SECRET=<随机生成的64位hex密钥>
JWT_EXPIRES_IN=7d

# ==========================================
# 数据库配置
# ==========================================
DATABASE_PATH=./data/users.db
BACKUP_DIR=./data/backups
MAX_BACKUP_DAYS=30

# ==========================================
# 安全配置
# ==========================================
BCRYPT_SALT_ROUNDS=10
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION_MINUTES=5

# ==========================================
# 备份配置
# ==========================================
BACKUP_CRON_SCHEDULE=0 2 * * *  # 每日02:00
ENABLE_AUTO_BACKUP=true
```

---

## ✅ 验收标准

### 功能验收
- [ ] 默认管理员可成功登录
- [ ] 新用户首次登录强制修改密码
- [ ] 管理员可创建、编辑、禁用用户
- [ ] 过期用户无法登录，显示正确提示
- [ ] 管理员可查看备份历史
- [ ] 每日自动备份正常执行
- [ ] 手动备份功能正常
- [ ] 多用户可并发访问

### 安全验收
- [ ] 密码强度验证通过
- [ ] JWT签名验证通过
- [ ] 有效期防篡改验证通过
- [ ] 登录失败5次后账号锁定
- [ ] SQL注入攻击无效
- [ ] XSS攻击无效

### 性能验收
- [ ] 登录响应时间 < 500ms
- [ ] API响应时间 < 200ms（P95）
- [ ] 支持100+ QPS并发
- [ ] 备份时间 < 10秒（1MB数据库）

---

## 📚 参考资料

- [SQLite WAL Mode](https://www.sqlite.org/wal.html)
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)
- [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [bcrypt Node.js](https://github.com/kelektiv/node.bcrypt.js)
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)

---

**文档版本**: v1.0
**最后更新**: 2025-01-17
**作者**: AutoAds Development Team
