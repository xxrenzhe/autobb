# API集成文档 (API Integration Guide)

## 文档概述

本文档详细说明AutoAds系统与外部API的集成方式，包括：
1. 用户认证与授权API（JWT + 限流）
2. Google Ads API集成（OAuth + 后端存储）
3. AI API集成（Gemini/Claude）
4. 管理员管理API
5. 数据驱动优化API（KISS版）
   - Campaign对比分析
   - 每周优化建议（8种建议类型）
   - 🆕 性能数据查询（小时/设备维度）
   - 🆕 搜索词报告（关键词优化）
6. API性能设计
   - 强制分页（所有列表API）
   - 限流策略（登录+API请求）
   - 并发控制（乐观锁）

---

## 零、用户认证与授权API

### 0.1 JWT认证体系

#### JWT Token结构

```typescript
interface JWTPayload {
  userId: number;           // 用户ID
  username: string;         // 用户名
  role: 'admin' | 'user';   // 角色
  packageType: string;      // 套餐类型
  validUntil: string;       // 有效期（ISO 8601）
  iat: number;              // 签发时间（UNIX时间戳）
  exp: number;              // 过期时间（UNIX时间戳，7天后）
}
```

#### JWT签发与验证

```typescript
// lib/auth/jwt.ts
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export function signToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}
```

#### 认证中间件

```typescript
// lib/auth/middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from './jwt';
import Database from 'better-sqlite3';

const db = new Database(process.env.DATABASE_PATH!);

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    userId: number;
    username: string;
    role: 'admin' | 'user';
    packageType: string;
    validUntil: string;
  };
}

export async function requireAuth(request: NextRequest): Promise<NextResponse | null> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Missing or invalid Authorization header' },
      { status: 401 }
    );
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);

  if (!payload) {
    return NextResponse.json(
      { error: 'Invalid or expired token' },
      { status: 401 }
    );
  }

  // 双重验证：从数据库查询用户状态
  const user = db.prepare(`
    SELECT id, username, role, package_type, valid_until, is_active
    FROM users
    WHERE id = ? AND is_active = 1
  `).get(payload.userId) as any;

  if (!user) {
    return NextResponse.json(
      { error: 'User not found or inactive' },
      { status: 401 }
    );
  }

  // 验证套餐有效期
  const now = new Date();
  const validUntil = new Date(user.valid_until);

  if (now > validUntil) {
    return NextResponse.json(
      {
        error: 'Package expired',
        validUntil: user.valid_until,
        message: '您的套餐已过期，请联系管理员续费'
      },
      { status: 403 }
    );
  }

  // 将用户信息附加到请求对象
  (request as AuthenticatedRequest).user = {
    userId: user.id,
    username: user.username,
    role: user.role,
    packageType: user.package_type,
    validUntil: user.valid_until
  };

  return null; // 认证通过，返回null
}

export async function requireAdmin(request: NextRequest): Promise<NextResponse | null> {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const user = (request as AuthenticatedRequest).user;

  if (user?.role !== 'admin') {
    return NextResponse.json(
      { error: 'Admin access required' },
      { status: 403 }
    );
  }

  return null; // 管理员权限验证通过
}
```

### 0.2 登录API

#### POST /api/auth/login

**请求体**：
```json
{
  "username": "autoads",
  "password": "K$j6z!9Tq@P2w#aR"
}
```

**响应**：
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "userId": 1,
    "username": "autoads",
    "displayName": "系统管理员",
    "role": "admin",
    "packageType": "lifetime",
    "validUntil": "2099-12-31T23:59:59Z",
    "mustChangePassword": false
  }
}
```

**实现**：
```typescript
// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import Database from 'better-sqlite3';
import { signToken } from '@/lib/auth/jwt';

const db = new Database(process.env.DATABASE_PATH!);

// 登录尝试限制（内存存储，生产环境应使用Redis）
const loginAttempts = new Map<string, { count: number; lockUntil?: number }>();

const MAX_LOGIN_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5');
const LOCKOUT_DURATION = parseInt(process.env.LOCKOUT_DURATION_MINUTES || '5') * 60 * 1000;

export async function POST(request: NextRequest) {
  const { username, password } = await request.json();

  if (!username || !password) {
    return NextResponse.json(
      { error: 'Username and password are required' },
      { status: 400 }
    );
  }

  // 检查登录尝试次数
  const attempts = loginAttempts.get(username);
  if (attempts?.lockUntil && Date.now() < attempts.lockUntil) {
    const remainingSeconds = Math.ceil((attempts.lockUntil - Date.now()) / 1000);
    return NextResponse.json(
      {
        error: `Too many login attempts. Try again in ${remainingSeconds} seconds`,
        lockUntil: new Date(attempts.lockUntil).toISOString()
      },
      { status: 429 }
    );
  }

  // 查询用户
  const user = db.prepare(`
    SELECT id, username, password_hash, display_name, email, role,
           package_type, valid_from, valid_until, is_active, must_change_password
    FROM users
    WHERE username = ?
  `).get(username) as any;

  if (!user) {
    // 记录失败尝试
    recordFailedAttempt(username);

    return NextResponse.json(
      { error: 'Invalid username or password' },
      { status: 401 }
    );
  }

  // 验证密码
  const passwordMatch = await bcrypt.compare(password, user.password_hash);

  if (!passwordMatch) {
    recordFailedAttempt(username);

    return NextResponse.json(
      { error: 'Invalid username or password' },
      { status: 401 }
    );
  }

  // 检查账号状态
  if (user.is_active !== 1) {
    return NextResponse.json(
      { error: 'Account is disabled. Contact administrator.' },
      { status: 403 }
    );
  }

  // 检查套餐有效期
  const now = new Date();
  const validFrom = new Date(user.valid_from);
  const validUntil = new Date(user.valid_until);

  if (now < validFrom || now > validUntil) {
    return NextResponse.json(
      {
        error: 'Package expired or not yet active',
        validFrom: user.valid_from,
        validUntil: user.valid_until,
        message: '您的套餐已过期或尚未生效，请联系管理员'
      },
      { status: 403 }
    );
  }

  // 清除失败尝试记录
  loginAttempts.delete(username);

  // 更新最后登录时间
  db.prepare(`
    UPDATE users
    SET last_login_at = datetime('now')
    WHERE id = ?
  `).run(user.id);

  // 签发JWT
  const token = signToken({
    userId: user.id,
    username: user.username,
    role: user.role,
    packageType: user.package_type,
    validUntil: user.valid_until
  });

  // 返回结果
  return NextResponse.json({
    success: true,
    token,
    user: {
      userId: user.id,
      username: user.username,
      displayName: user.display_name,
      email: user.email,
      role: user.role,
      packageType: user.package_type,
      validFrom: user.valid_from,
      validUntil: user.valid_until,
      mustChangePassword: user.must_change_password === 1
    }
  });
}

function recordFailedAttempt(username: string) {
  const attempts = loginAttempts.get(username) || { count: 0 };
  attempts.count += 1;

  if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
    attempts.lockUntil = Date.now() + LOCKOUT_DURATION;
  }

  loginAttempts.set(username, attempts);
}
```

### 0.3 修改密码API

#### POST /api/auth/change-password

**请求头**：
```
Authorization: Bearer <jwt_token>
```

**请求体**：
```json
{
  "currentPassword": "old_password",
  "newPassword": "new_password"
}
```

**响应**：
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**实现**：
```typescript
// app/api/auth/change-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import Database from 'better-sqlite3';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth/middleware';

const db = new Database(process.env.DATABASE_PATH!);
const BCRYPT_SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10');

export async function POST(request: NextRequest) {
  // 认证检查
  const authError = await requireAuth(request);
  if (authError) return authError;

  const user = (request as AuthenticatedRequest).user!;
  const { currentPassword, newPassword } = await request.json();

  // 验证输入
  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: 'Current password and new password are required' },
      { status: 400 }
    );
  }

  // 密码强度验证
  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: 'Password must be at least 8 characters long' },
      { status: 400 }
    );
  }

  // 查询当前密码哈希
  const userRecord = db.prepare(`
    SELECT password_hash FROM users WHERE id = ?
  `).get(user.userId) as any;

  if (!userRecord) {
    return NextResponse.json(
      { error: 'User not found' },
      { status: 404 }
    );
  }

  // 验证当前密码
  const passwordMatch = await bcrypt.compare(currentPassword, userRecord.password_hash);

  if (!passwordMatch) {
    return NextResponse.json(
      { error: 'Current password is incorrect' },
      { status: 401 }
    );
  }

  // 生成新密码哈希
  const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

  // 更新密码并清除must_change_password标记
  db.prepare(`
    UPDATE users
    SET password_hash = ?,
        must_change_password = 0,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(newPasswordHash, user.userId);

  return NextResponse.json({
    success: true,
    message: 'Password changed successfully'
  });
}
```

### 0.4 验证Token API

#### GET /api/auth/verify

**请求头**：
```
Authorization: Bearer <jwt_token>
```

**响应**：
```json
{
  "valid": true,
  "user": {
    "userId": 1,
    "username": "autoads",
    "role": "admin",
    "packageType": "lifetime",
    "validUntil": "2099-12-31T23:59:59Z"
  }
}
```

**实现**：
```typescript
// app/api/auth/verify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth/middleware';

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) {
    return NextResponse.json({ valid: false }, { status: 401 });
  }

  const user = (request as AuthenticatedRequest).user!;

  return NextResponse.json({
    valid: true,
    user: {
      userId: user.userId,
      username: user.username,
      role: user.role,
      packageType: user.packageType,
      validUntil: user.validUntil
    }
  });
}
```

### 0.5 登出API

#### POST /api/auth/logout

**说明**：JWT是无状态的，前端登出只需删除本地存储的token。后端API仅用于记录日志。

**请求头**：
```
Authorization: Bearer <jwt_token>
```

**响应**：
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**实现**：
```typescript
// app/api/auth/logout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth/middleware';

export async function POST(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const user = (request as AuthenticatedRequest).user!;

  console.log(`User ${user.username} (ID: ${user.userId}) logged out at ${new Date().toISOString()}`);

  return NextResponse.json({
    success: true,
    message: 'Logged out successfully'
  });
}
```

### 0.6 前端认证集成

#### Token存储

```typescript
// lib/auth/tokenStorage.ts
const TOKEN_KEY = 'autoads_auth_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}
```

#### API请求封装

```typescript
// lib/api/client.ts
import { getToken, removeToken } from '@/lib/auth/tokenStorage';

export class APIClient {
  private baseURL: string;

  constructor(baseURL: string = '') {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = getToken();

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers
    });

    // 处理认证失败
    if (response.status === 401) {
      removeToken();
      window.location.href = '/login';
      throw new Error('Authentication required');
    }

    // 处理套餐过期
    if (response.status === 403) {
      const data = await response.json();
      if (data.error === 'Package expired') {
        alert(data.message || '您的套餐已过期，请联系管理员续费');
        removeToken();
        window.location.href = '/login';
      }
      throw new Error(data.error || 'Forbidden');
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Request failed');
    }

    return response.json();
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async put<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new APIClient();
```

#### 登录页面示例

```typescript
// app/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import { setToken } from '@/lib/auth/tokenStorage';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await apiClient.post<any>('/api/auth/login', {
        username,
        password
      });

      // 存储token
      setToken(response.token);

      // 检查是否需要修改密码
      if (response.user.mustChangePassword) {
        router.push('/change-password');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6 text-center">AutoAds 登录</h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 mb-2">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

---

### 0.3 API限流和性能控制

#### 0.3.1 限流策略（rate_limits表）

**设计原则**：使用SQLite存储限流记录，支持多实例部署

**限流表结构**：
```sql
CREATE TABLE rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL,                  -- 限流标识（IP地址或user_id）
  action TEXT NOT NULL,                      -- 操作类型（login, api_request等）
  request_count INTEGER NOT NULL DEFAULT 1,  -- 当前窗口请求次数
  window_start TEXT NOT NULL,                -- 窗口开始时间
  is_blocked INTEGER NOT NULL DEFAULT 0,     -- 是否被封禁（0=否, 1=是）
  blocked_until TEXT,                        -- 封禁解除时间
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**限流规则**：
| 类型 | 标识符 | 窗口 | 最大请求 | 封禁时长 |
|------|--------|------|----------|----------|
| 登录限流 | IP地址 | 5分钟 | 5次失败 | 5分钟 |
| API限流 | user_id | 1分钟 | 100次 | 无（拒绝请求） |

**实现示例**：
```typescript
// lib/rateLimit.ts
import { getDatabase } from './database';

export async function checkRateLimit(
  identifier: string,
  action: string,
  maxRequests: number,
  windowMinutes: number
): Promise<boolean> {
  const db = getDatabase();
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000);

  const record = db.prepare(`
    SELECT * FROM rate_limits
    WHERE identifier = ? AND action = ?
  `).get(identifier, action);

  if (!record) {
    // 首次请求，创建记录
    db.prepare(`
      INSERT INTO rate_limits (identifier, action, request_count, window_start)
      VALUES (?, ?, 1, datetime('now'))
    `).run(identifier, action);
    return true;
  }

  // 检查是否被封禁
  if (record.is_blocked && new Date(record.blocked_until) > now) {
    return false;
  }

  // 检查窗口是否过期
  if (new Date(record.window_start) < windowStart) {
    // 重置窗口
    db.prepare(`
      UPDATE rate_limits
      SET request_count = 1, window_start = datetime('now'),
          is_blocked = 0, blocked_until = NULL, updated_at = datetime('now')
      WHERE id = ?
    `).run(record.id);
    return true;
  }

  // 窗口内请求
  if (record.request_count >= maxRequests) {
    // 超过限制，封禁
    const blockedUntil = new Date(now.getTime() + windowMinutes * 60 * 1000);
    db.prepare(`
      UPDATE rate_limits
      SET is_blocked = 1, blocked_until = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(blockedUntil.toISOString(), record.id);
    return false;
  }

  // 增加计数
  db.prepare(`
    UPDATE rate_limits
    SET request_count = request_count + 1, updated_at = datetime('now')
    WHERE id = ?
  `).run(record.id);
  return true;
}
```

#### 0.3.2 API强制分页

**设计原则**：所有列表查询API必须支持分页，避免大数据量查询

**标准分页参数**：
```typescript
interface PaginationParams {
  page?: number;      // 页码（从1开始），默认1
  limit?: number;     // 每页数量，默认20，最大100
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

**实现示例**：
```typescript
// GET /api/offers?page=1&limit=20
export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const user = (request as AuthenticatedRequest).user!;
  const searchParams = request.nextUrl.searchParams;

  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
  const offset = (page - 1) * limit;

  const db = getDatabase();
  const offers = db.prepare(`
    SELECT * FROM offers WHERE user_id = ? LIMIT ? OFFSET ?
  `).all(user.userId, limit, offset);

  const total = db.prepare(`
    SELECT COUNT(*) as count FROM offers WHERE user_id = ?
  `).get(user.userId).count;

  return NextResponse.json({
    data: offers,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
}
```

**必须分页的API**：
- `GET /api/offers` - Offer列表
- `GET /api/campaigns` - Campaign列表
- `GET /api/campaign_performance` - 性能数据列表
- `GET /api/weekly_recommendations` - 优化建议列表
- `GET /api/search_term_reports` - 搜索词报告列表

#### 0.3.3 并发控制（乐观锁）

**设计原则**：使用`version`字段实现乐观锁，防止并发更新冲突

**需要乐观锁的表**：
- `offers` - 同一用户在不同设备/浏览器上同时编辑同一个Offer
- `campaigns` - 同一用户在不同设备上同时更新Campaign状态
- `users` - 用户信息更新（如套餐升级时管理员和用户同时操作）

**数据隔离说明**：
- AutoAds通过`user_id`实现数据隔离，一个用户只能管理自己的Offer和Campaign
- 乐观锁主要用于防止同一用户在多设备并发编辑时的数据冲突

**更新逻辑**：
```typescript
// PUT /api/offers/:id
export async function PUT(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const user = (request as AuthenticatedRequest).user!;
  const offerId = request.nextUrl.pathname.split('/').pop();
  const { offerName, version } = await request.json();

  const db = getDatabase();
  const result = db.prepare(`
    UPDATE offers
    SET offer_name = ?, version = version + 1, updated_at = datetime('now')
    WHERE id = ? AND user_id = ? AND version = ?
  `).run(offerName, offerId, user.userId, version);

  if (result.changes === 0) {
    return NextResponse.json(
      { error: '更新冲突：数据已被其他用户修改，请刷新后重试' },
      { status: 409 }
    );
  }

  return NextResponse.json({ success: true });
}
```

---

## 一、Google Ads API集成

### 1.1 环境配置

#### 必需的环境变量

```bash
# Google Ads API配置
GOOGLE_ADS_DEVELOPER_TOKEN=your_developer_token
GOOGLE_ADS_CLIENT_ID=your_oauth_client_id
GOOGLE_ADS_CLIENT_SECRET=your_oauth_client_secret

# 应用配置
NEXT_PUBLIC_GOOGLE_OAUTH_REDIRECT_URI=https://yourdomain.com/api/oauth/callback

# 数据库配置
DATABASE_PATH=./data/users.db

# JWT配置
JWT_SECRET=your_random_64_char_hex_secret
JWT_EXPIRES_IN=7d

# 加密配置（用于OAuth Token加密）
ENCRYPTION_KEY=your_32_byte_hex_key  # AES-256-GCM需要32字节密钥
```

#### 获取Developer Token

1. 访问 [Google Ads API Center](https://developers.google.com/google-ads/api/docs/first-call/dev-token)
2. 申请Developer Token（测试环境可使用Test Account Token）
3. 生产环境需要申请Standard Access（需要审核）

#### 创建OAuth 2.0凭据

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 启用Google Ads API
4. 创建OAuth 2.0客户端ID
   - 应用类型：Web Application
   - 授权重定向URI：`https://yourdomain.com/api/oauth/callback`

### 1.2 OAuth 2.0认证流程（V2.0更新）

**V2.0变更**：OAuth tokens现在存储在后端SQLite数据库中，使用AES-256-GCM加密。

#### 1.2.1 前端：发起授权请求

```typescript
// app/components/GoogleAdsConnect.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api/client';

export function GoogleAdsConnect() {
  const [loading, setLoading] = useState(false);

  const handleConnect = () => {
    setLoading(true);

    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID!,
      redirect_uri: process.env.NEXT_PUBLIC_GOOGLE_OAUTH_REDIRECT_URI!,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/adwords',
      access_type: 'offline',  // 重要：获取refresh_token
      prompt: 'consent',        // 重要：强制显示授权页面
      state: generateRandomState()  // CSRF保护
    });

    // 跳转到Google授权页面
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  };

  return (
    <Button onClick={handleConnect} disabled={loading}>
      {loading ? '正在连接...' : '连接Google Ads账号'}
    </Button>
  );
}

function generateRandomState(): string {
  return Math.random().toString(36).substring(7);
}
```

#### 1.2.2 后端：处理授权回调并存储到数据库

```typescript
// app/api/oauth/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import Database from 'better-sqlite3';
import crypto from 'crypto';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth/middleware';

const db = new Database(process.env.DATABASE_PATH!);
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');

export async function GET(request: NextRequest) {
  // 认证检查
  const authError = await requireAuth(request);
  if (authError) return authError;

  const user = (request as AuthenticatedRequest).user!;
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code) {
    return NextResponse.json({ error: 'Missing authorization code' }, { status: 400 });
  }

  // TODO: 验证state参数（CSRF保护）

  try {
    // 初始化OAuth2客户端
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_ADS_CLIENT_ID,
      process.env.GOOGLE_ADS_CLIENT_SECRET,
      process.env.NEXT_PUBLIC_GOOGLE_OAUTH_REDIRECT_URI
    );

    // 交换授权码获取tokens
    const { tokens } = await oauth2Client.getToken(code);

    // 加密refresh token
    const encryptedRefreshToken = encryptToken(tokens.refresh_token!);
    const encryptedAccessToken = encryptToken(tokens.access_token!);

    // 获取账号信息
    const accountInfo = await getGoogleAdsAccounts(tokens.access_token!);

    // 存储到数据库
    for (const account of accountInfo) {
      db.prepare(`
        INSERT INTO google_ads_accounts (
          user_id, customer_id, account_name, currency_code,
          time_zone, encrypted_refresh_token, encrypted_access_token,
          token_expiry_date, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        ON CONFLICT(user_id, customer_id) DO UPDATE SET
          encrypted_refresh_token = excluded.encrypted_refresh_token,
          encrypted_access_token = excluded.encrypted_access_token,
          token_expiry_date = excluded.token_expiry_date,
          status = excluded.status,
          updated_at = datetime('now')
      `).run(
        user.userId,
        account.customerId,
        account.accountName,
        account.currencyCode,
        account.timeZone,
        encryptedRefreshToken,
        encryptedAccessToken,
        tokens.expiry_date,
        account.status
      );
    }

    return NextResponse.redirect(new URL('/dashboard?oauth=success', request.url));

  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(new URL('/dashboard?oauth=error', request.url));
  }
}

/**
 * AES-256-GCM加密Token
 */
function encryptToken(token: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // 格式: iv:authTag:encryptedData
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * AES-256-GCM解密Token
 */
function decryptToken(encryptedToken: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedToken.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

async function getGoogleAdsAccounts(accessToken: string) {
  const { GoogleAdsApi } = require('google-ads-api');

  const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  });

  // 使用access_token创建客户端
  const customer = client.Customer({
    customer_id: 'YOUR_MANAGER_ACCOUNT_ID',
    refresh_token: accessToken
  });

  // 查询所有可访问的客户账号
  const accounts = await customer.query(`
    SELECT
      customer_client.id,
      customer_client.descriptive_name,
      customer_client.currency_code,
      customer_client.time_zone,
      customer_client.status
    FROM customer_client
    WHERE customer_client.status = 'ENABLED'
  `);

  return accounts.map((account: any) => ({
    customerId: account.customer_client.id.toString(),
    accountName: account.customer_client.descriptive_name,
    currencyCode: account.customer_client.currency_code,
    timeZone: account.customer_client.time_zone,
    status: account.customer_client.status
  }));
}
```

#### 1.2.3 获取用户的Google Ads账号列表

```typescript
// app/api/google-ads-accounts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth/middleware';

const db = new Database(process.env.DATABASE_PATH!);

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const user = (request as AuthenticatedRequest).user!;

  const accounts = db.prepare(`
    SELECT
      id, customer_id, account_name, currency_code,
      time_zone, status, token_expiry_date,
      last_synced_at, created_at, updated_at
    FROM google_ads_accounts
    WHERE user_id = ? AND status = 'ENABLED'
    ORDER BY account_name ASC
  `).all(user.userId);

  return NextResponse.json({ accounts });
}
```

### 1.3 Campaign创建API（V2.0更新）

**V2.0变更**：Campaign数据现在保存到后端SQLite数据库，支持多用户隔离。

#### 1.3.1 创建Campaign

```typescript
// app/api/campaigns/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import { GoogleAdsApi } from 'google-ads-api';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import crypto from 'crypto';

const db = new Database(process.env.DATABASE_PATH!);
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');

export async function POST(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const user = (request as AuthenticatedRequest).user!;
  const campaignData = await request.json();

  const {
    offerId,
    customerId,
    campaignName,
    budget,
    locations,
    languages,
    adGroups  // Array of ad groups with keywords and ads
  } = campaignData;

  try {
    // 1. 验证Offer归属
    const offer = db.prepare(`
      SELECT id FROM offers WHERE id = ? AND user_id = ?
    `).get(offerId, user.userId);

    if (!offer) {
      return NextResponse.json(
        { error: 'Offer not found or access denied' },
        { status: 404 }
      );
    }

    // 2. 获取解密的OAuth token
    const accountRecord = db.prepare(`
      SELECT encrypted_refresh_token, encrypted_access_token, token_expiry_date
      FROM google_ads_accounts
      WHERE user_id = ? AND customer_id = ?
    `).get(user.userId, customerId) as any;

    if (!accountRecord) {
      return NextResponse.json(
        { error: 'Google Ads account not found' },
        { status: 404 }
      );
    }

    const refreshToken = decryptToken(accountRecord.encrypted_refresh_token);

    // 3. 初始化Google Ads API客户端
    const client = new GoogleAdsApi({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
      developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!
    });

    const customer = client.Customer({
      customer_id: customerId,
      refresh_token: refreshToken
    });

    // 4. 创建独立的Campaign Budget
    const budgetOperation = {
      create: {
        name: `${campaignName} Budget`,
        amount_micros: budget * 1_000_000,  // 美元转换为micros（美元 × 1,000,000）
        delivery_method: 'STANDARD'
      }
    };

    const budgetResponse = await customer.campaignBudgets.create([budgetOperation]);
    const budgetResourceName = budgetResponse.results[0].resource_name;

    // 5. 创建Campaign（引用Budget）
    const campaignOperation = {
      create: {
        name: campaignName,
        campaign_budget: budgetResourceName,  // 引用Budget的resource_name
        advertising_channel_type: 'SEARCH',
        status: 'PAUSED',  // 默认暂停，等待用户上传Logo/Images
        maximize_conversions: {},  // 使用MaximizeConversions出价策略
        network_settings: {
          target_google_search: true,
          target_search_network: true,
          target_content_network: false
        },
        geo_target_type_setting: {
          positive_geo_target_type: 'PRESENCE_OR_INTEREST'
        }
      }
    };

    const campaignResponse = await customer.campaigns.create([campaignOperation]);
    const campaignResourceName = campaignResponse.results[0].resource_name;
    const campaignId = campaignResourceName.split('/').pop();

    // 6. 保存到数据库
    const result = db.prepare(`
      INSERT INTO campaigns (
        user_id, offer_id, customer_id, campaign_id, campaign_name,
        budget, status, locations, languages, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      user.userId,
      offerId,
      customerId,
      campaignId,
      campaignName,
      budget,
      'PAUSED',
      JSON.stringify(locations),
      JSON.stringify(languages)
    );

    // 7. 创建Ad Groups, Keywords, Ads（省略详细实现）
    // ...

    return NextResponse.json({
      success: true,
      campaignId: result.lastInsertRowid,
      googleCampaignId: campaignId,
      message: 'Campaign created successfully'
    });

  } catch (error: any) {
    console.error('Campaign creation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create campaign' },
      { status: 500 }
    );
  }
}

function decryptToken(encryptedToken: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedToken.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

---

#### 1.3.2 关键词匹配类型智能分配

**目的**: 根据关键词特征自动分配合适的匹配类型（EXACT, PHRASE, BROAD），优化广告投放效果。

**分配规则**（遵循PRD和ONE_CLICK_LAUNCH设计）:

| 规则 | 条件 | 匹配类型 | 示例 | 理由 |
|------|------|---------|------|------|
| 规则1 | 包含品牌名 | `EXACT` | "Reolink camera" | 品牌词精准匹配，避免浪费预算 |
| 规则2 | 2-3个词 | `PHRASE` | "security camera" | 核心产品词，保持相关性 |
| 规则3 | ≥4个词 | `BROAD` | "best outdoor security camera" | 长尾词，扩大覆盖面 |
| 默认 | 其他情况 | `PHRASE` | "camera" | 平衡覆盖和相关性 |

**实现代码**:

```typescript
// lib/google-ads/keyword-match-type.ts

interface Keyword {
  keyword: string;
  match_type?: 'EXACT' | 'PHRASE' | 'BROAD';
  // 其他字段...
}

/**
 * 智能分配关键词匹配类型
 * @param keywords - 关键词列表
 * @param brandName - 品牌名称（用于识别品牌词）
 * @returns 添加了match_type的关键词列表
 */
export function assignMatchTypes(
  keywords: Keyword[],
  brandName: string
): Keyword[] {
  return keywords.map(kw => {
    const keywordText = kw.keyword.toLowerCase();
    const brandNameLower = brandName.toLowerCase();
    const wordCount = kw.keyword.trim().split(/\s+/).length;

    // 规则1: 包含品牌名 → EXACT
    if (keywordText.includes(brandNameLower)) {
      return { ...kw, match_type: 'EXACT' };
    }

    // 规则2: 2-3个词 → PHRASE
    if (wordCount >= 2 && wordCount <= 3) {
      return { ...kw, match_type: 'PHRASE' };
    }

    // 规则3: ≥4个词 → BROAD
    if (wordCount >= 4) {
      return { ...kw, match_type: 'BROAD' };
    }

    // 默认: PHRASE（1个词的情况）
    return { ...kw, match_type: 'PHRASE' };
  });
}
```

**使用示例**:

```typescript
// 在"一键上广告"流程中使用
import { assignMatchTypes } from '@/lib/google-ads/keyword-match-type';

// Step 3: AI生成关键词后
const generatedKeywords = [
  { keyword: 'Reolink security camera', search_volume: 1500 },
  { keyword: 'security camera', search_volume: 12000 },
  { keyword: 'outdoor camera', search_volume: 8000 },
  { keyword: 'best wireless security camera system', search_volume: 2500 },
  { keyword: 'camera', search_volume: 50000 }
];

// 智能分配匹配类型
const keywordsWithMatchType = assignMatchTypes(generatedKeywords, 'Reolink');

// 结果:
// [
//   { keyword: 'Reolink security camera', match_type: 'EXACT', search_volume: 1500 },
//   { keyword: 'security camera', match_type: 'PHRASE', search_volume: 12000 },
//   { keyword: 'outdoor camera', match_type: 'PHRASE', search_volume: 8000 },
//   { keyword: 'best wireless security camera system', match_type: 'BROAD', search_volume: 2500 },
//   { keyword: 'camera', match_type: 'PHRASE', search_volume: 50000 }
// ]
```

**添加关键词到Google Ads**:

```typescript
// 在Campaign创建过程中添加关键词
const adGroupCriteriaOperations = keywordsWithMatchType.map(kw => ({
  create: {
    ad_group: adGroupResourceName,
    status: 'ENABLED',
    keyword: {
      text: kw.keyword,
      match_type: kw.match_type  // 使用智能分配的匹配类型
    },
    cpc_bid_micros: Math.round(kw.suggested_cpc_micros * 1.1)  // 建议CPC的110%
  }
}));

await customer.adGroupCriteria.create(adGroupCriteriaOperations);
```

**相关文档**:
- **ONE_CLICK_LAUNCH.md** - "一键上广告"流程中关键词生成和分配的完整实现
- **PRD.md** - 关键词匹配类型的产品需求说明

---

### 1.4 Performance数据同步API（V2.0更新）

**V2.0变更**：Performance数据保存到后端SQLite，前端IndexedDB仅作为7天过期缓存。

#### 1.4.1 同步Campaign性能数据

```typescript
// app/api/campaigns/[campaignId]/sync-performance/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import { GoogleAdsApi } from 'google-ads-api';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth/middleware';

const db = new Database(process.env.DATABASE_PATH!);

export async function POST(
  request: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const user = (request as AuthenticatedRequest).user!;
  const campaignId = parseInt(params.campaignId);

  try {
    // 1. 验证Campaign归属
    const campaign = db.prepare(`
      SELECT c.*, o.user_id
      FROM campaigns c
      JOIN offers o ON c.offer_id = o.id
      WHERE c.id = ? AND o.user_id = ?
    `).get(campaignId, user.userId) as any;

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found or access denied' },
        { status: 404 }
      );
    }

    // 2. 获取OAuth token并查询Google Ads API
    // (省略获取token和API查询代码，参考V1.0文档)

    // 3. 保存性能数据到sync_logs表
    db.prepare(`
      INSERT INTO sync_logs (
        user_id, entity_type, entity_id, sync_type,
        status, records_synced, error_message,
        synced_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      user.userId,
      'campaign',
      campaignId,
      'performance',
      'success',
      performanceData.length,
      null
    );

    // 4. 更新campaign的last_synced_at
    db.prepare(`
      UPDATE campaigns
      SET last_synced_at = datetime('now')
      WHERE id = ?
    `).run(campaignId);

    return NextResponse.json({
      success: true,
      recordsSynced: performanceData.length,
      lastSyncedAt: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Performance sync error:', error);

    // 记录失败日志
    db.prepare(`
      INSERT INTO sync_logs (
        user_id, entity_type, entity_id, sync_type,
        status, records_synced, error_message,
        synced_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      user.userId,
      'campaign',
      campaignId,
      'performance',
      'failed',
      0,
      error.message
    );

    return NextResponse.json(
      { error: error.message || 'Failed to sync performance data' },
      { status: 500 }
    );
  }
}
```

### ❌ 1.5 离线创建Offer + 自动同步（已移除 - MVP简化）

**移除原因**：
- 离线Offer创建增加复杂度（pending_offers表、自动同步逻辑、失败重试机制）
- MVP阶段用户量少，离线使用场景不多
- 维护成本高，边缘场景

**替代方案**：
```typescript
// 简单网络检测和提示
if (!navigator.onLine) {
  showNotification('请连接网络后操作', 'warning');
  return;
}

// 所有操作要求在线
await fetch('/api/offers', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${getToken()}` },
  body: JSON.stringify(offerData)
});
```

**V2.0考虑**：如果用户强烈需要离线支持，再引入PWA离线机制

---

#### 1.5.1 后端Offer创建API（在线）

```typescript
// app/api/offers/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth/middleware';

const db = new Database(process.env.DATABASE_PATH!);

export async function POST(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const user = (request as AuthenticatedRequest).user!;
  const offerData = await request.json();

  const {
    offerName,
    productUrl,
    targetCountries,
    targetLanguages,
    monthlyBudget,
    productDescription,
    productImages,
    keywordData
  } = offerData;

  try {
    const result = db.prepare(`
      INSERT INTO offers (
        user_id, offer_name, product_url, target_countries,
        target_languages, monthly_budget, product_description,
        product_images, keyword_data, status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      user.userId,
      offerName,
      productUrl,
      JSON.stringify(targetCountries),
      JSON.stringify(targetLanguages),
      monthlyBudget,
      productDescription,
      JSON.stringify(productImages),
      JSON.stringify(keywordData),
      'draft'
    );

    return NextResponse.json({
      success: true,
      offerId: result.lastInsertRowid,
      message: 'Offer created successfully'
    });

  } catch (error: any) {
    console.error('Offer creation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create offer' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const user = (request as AuthenticatedRequest).user!;

  const offers = db.prepare(`
    SELECT * FROM offers
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(user.userId);

  return NextResponse.json({ offers });
}
```

---

## ❌ 二、数据导出API（延后至V2.0）

**延后原因**：
- 数据导出为高级功能，非MVP核心需求
- 用户可通过管理员导出数据库文件实现
- 避免增加API复杂度和维护成本

**临时方案**：
```bash
# 管理员手动导出数据（运维操作）
sqlite3 /data/autoads.db ".dump" > backup.sql

# 或直接复制数据库文件
cp /data/autoads.db /backups/user_data_export.db
```

**V2.0考虑**：
- 提供Web界面导出功能（JSON/CSV格式）
- 支持按表导出、时间范围筛选
- 数据脱敏和隐私保护

---

## 三、管理员管理API（V2.0新功能）

### 3.1 用户管理

#### POST /api/admin/users - 创建用户

**请求头**：
```
Authorization: Bearer <jwt_token>
```

**请求体**：
```json
{
  "username": "user001",
  "password": "TempPassword123",
  "displayName": "张三",
  "email": "user001@example.com",
  "packageType": "annual",
  "validFrom": "2024-01-01T00:00:00Z",
  "validUntil": "2024-12-31T23:59:59Z"
}
```

**响应**：
```json
{
  "success": true,
  "userId": 2,
  "message": "User created successfully"
}
```

**实现**：
```typescript
// app/api/admin/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import Database from 'better-sqlite3';
import { requireAdmin, AuthenticatedRequest } from '@/lib/auth/middleware';

const db = new Database(process.env.DATABASE_PATH!);
const BCRYPT_SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10');

export async function POST(request: NextRequest) {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  const admin = (request as AuthenticatedRequest).user!;
  const userData = await request.json();

  const {
    username,
    password,
    displayName,
    email,
    packageType,
    validFrom,
    validUntil
  } = userData;

  // 验证输入
  if (!username || !password || !displayName || !packageType || !validFrom || !validUntil) {
    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 }
    );
  }

  // 检查用户名是否已存在
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return NextResponse.json(
      { error: 'Username already exists' },
      { status: 409 }
    );
  }

  try {
    // 生成密码哈希
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // 插入用户
    const result = db.prepare(`
      INSERT INTO users (
        username, password_hash, display_name, email, role,
        package_type, valid_from, valid_until, is_active,
        must_change_password, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      username,
      passwordHash,
      displayName,
      email || null,
      'user',
      packageType,
      validFrom,
      validUntil,
      1,  // is_active
      1,  // must_change_password
      admin.userId
    );

    return NextResponse.json({
      success: true,
      userId: result.lastInsertRowid,
      message: 'User created successfully'
    });

  } catch (error: any) {
    console.error('User creation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create user' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  const users = db.prepare(`
    SELECT
      id, username, display_name, email, role, package_type,
      valid_from, valid_until, is_active, must_change_password,
      last_login_at, created_at, updated_at
    FROM users
    ORDER BY created_at DESC
  `).all();

  return NextResponse.json({ users });
}
```

#### PUT /api/admin/users/[id] - 更新用户

**请求体**：
```json
{
  "displayName": "张三（已续费）",
  "packageType": "lifetime",
  "validUntil": "2099-12-31T23:59:59Z",
  "isActive": true
}
```

**实现**：
```typescript
// app/api/admin/users/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import { requireAdmin } from '@/lib/auth/middleware';

const db = new Database(process.env.DATABASE_PATH!);

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  const userId = parseInt(params.id);
  const updates = await request.json();

  const allowedFields = [
    'display_name',
    'email',
    'package_type',
    'valid_from',
    'valid_until',
    'is_active'
  ];

  const setClauses: string[] = [];
  const values: any[] = [];

  for (const [key, value] of Object.entries(updates)) {
    const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    if (allowedFields.includes(snakeKey)) {
      setClauses.push(`${snakeKey} = ?`);
      values.push(value);
    }
  }

  if (setClauses.length === 0) {
    return NextResponse.json(
      { error: 'No valid fields to update' },
      { status: 400 }
    );
  }

  setClauses.push('updated_at = datetime(\'now\')');
  values.push(userId);

  try {
    db.prepare(`
      UPDATE users
      SET ${setClauses.join(', ')}
      WHERE id = ?
    `).run(...values);

    return NextResponse.json({
      success: true,
      message: 'User updated successfully'
    });

  } catch (error: any) {
    console.error('User update error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update user' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  const userId = parseInt(params.id);

  // 防止删除管理员自己
  const user = (request as any).user;
  if (user.userId === userId) {
    return NextResponse.json(
      { error: 'Cannot delete your own account' },
      { status: 400 }
    );
  }

  try {
    // 软删除：设置is_active = 0
    db.prepare(`
      UPDATE users
      SET is_active = 0, updated_at = datetime('now')
      WHERE id = ?
    `).run(userId);

    return NextResponse.json({
      success: true,
      message: 'User deactivated successfully'
    });

  } catch (error: any) {
    console.error('User deletion error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete user' },
      { status: 500 }
    );
  }
}
```

### 3.2 备份管理

#### GET /api/admin/backups - 查看备份历史

```typescript
// app/api/admin/backups/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import { requireAdmin } from '@/lib/auth/middleware';

const db = new Database(process.env.DATABASE_PATH!);

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  const backups = db.prepare(`
    SELECT * FROM backup_logs
    ORDER BY created_at DESC
    LIMIT 30
  `).all();

  return NextResponse.json({ backups });
}
```

#### POST /api/admin/backups/manual - 手动触发备份

```typescript
// app/api/admin/backups/manual/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { requireAdmin } from '@/lib/auth/middleware';

const db = new Database(process.env.DATABASE_PATH!);

export async function POST(request: NextRequest) {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  try {
    const backupDir = process.env.BACKUP_DIR || './data/backups';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `autoads_manual_${timestamp}.db`;
    const backupPath = path.join(backupDir, backupFileName);

    // 确保备份目录存在
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // 执行备份
    db.backup(backupPath);

    const stats = fs.statSync(backupPath);

    // 记录备份日志
    db.prepare(`
      INSERT INTO backup_logs (
        backup_path, backup_size_bytes, backup_type, status, created_at
      ) VALUES (?, ?, ?, ?, datetime('now'))
    `).run(backupPath, stats.size, 'manual', 'success');

    return NextResponse.json({
      success: true,
      backupPath,
      backupSize: stats.size,
      message: 'Manual backup created successfully'
    });

  } catch (error: any) {
    console.error('Manual backup error:', error);

    db.prepare(`
      INSERT INTO backup_logs (
        backup_path, backup_size_bytes, backup_type, status, error_message, created_at
      ) VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run('', 0, 'manual', 'failed', error.message);

    return NextResponse.json(
      { error: error.message || 'Failed to create backup' },
      { status: 500 }
    );
  }
}
```

---

## 四、AI API集成（Gemini / Claude）

**说明**：AI API集成保持与V1.0一致，仅需在API路由中添加JWT认证中间件。

### 4.1 Launch Score计算API

#### POST /api/launch-score/calculate

**请求头**：
```
Authorization: Bearer <jwt_token>
```

**请求体**：
```json
{
  "offerId": 1,
  "forceRecalculate": false
}
```

**实现**：
```typescript
// app/api/launch-score/calculate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { calculateLaunchScore } from '@/lib/ai/launchScore';

const db = new Database(process.env.DATABASE_PATH!);

export async function POST(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const user = (request as AuthenticatedRequest).user!;
  const { offerId, forceRecalculate } = await request.json();

  try {
    // 1. 验证Offer归属
    const offer = db.prepare(`
      SELECT * FROM offers WHERE id = ? AND user_id = ?
    `).get(offerId, user.userId) as any;

    if (!offer) {
      return NextResponse.json(
        { error: 'Offer not found or access denied' },
        { status: 404 }
      );
    }

    // 2. 检查是否已有评分（缓存策略）
    if (!forceRecalculate) {
      const existingScore = db.prepare(`
        SELECT * FROM launch_scores
        WHERE offer_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `).get(offerId) as any;

      if (existingScore) {
        const ageHours = (Date.now() - new Date(existingScore.created_at).getTime()) / (1000 * 60 * 60);
        if (ageHours < 24) {
          return NextResponse.json({
            success: true,
            cached: true,
            launchScore: JSON.parse(existingScore.score_data)
          });
        }
      }
    }

    // 3. 调用AI计算Launch Score
    const scoreResult = await calculateLaunchScore(offer);

    // 4. 保存到数据库
    db.prepare(`
      INSERT INTO launch_scores (
        offer_id, overall_score, score_data, insights,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      offerId,
      scoreResult.overallScore,
      JSON.stringify(scoreResult),
      JSON.stringify(scoreResult.insights)
    );

    return NextResponse.json({
      success: true,
      cached: false,
      launchScore: scoreResult
    });

  } catch (error: any) {
    console.error('Launch Score calculation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate Launch Score' },
      { status: 500 }
    );
  }
}
```

---

## 五、数据驱动优化API（V2.0新功能 - KISS版）

**说明**：数据驱动优化功能API，用于Campaign对比、AI自动学习、每周优化建议等。

### 5.1 Campaign对比分析API

#### GET /api/campaigns/compare

**请求头**：
```
Authorization: Bearer <jwt_token>
```

**查询参数**：
```
offer_id: number  // Offer ID
```

**返回示例**：
```json
{
  "success": true,
  "offer": {
    "id": 1,
    "name": "Nike专业跑鞋春季促销"
  },
  "campaigns": [
    {
      "campaign_id": 101,
      "campaign_name": "Nike跑鞋-变体A",
      "status": "ENABLED",
      "headline": "Nike专业跑鞋 轻便透气 马拉松训练首选",
      "description": "立即购买享受8折优惠",
      "metrics": {
        "impressions": 15230,
        "clicks": 487,
        "cost": 245.60,
        "conversions": 23,
        "ctr": 0.0320,
        "cpc": 0.50,
        "cpa": 10.68,
        "roi": 2.15
      },
      "is_winner": true,
      "winner_score": 85.3
    },
    {
      "campaign_id": 102,
      "campaign_name": "Nike跑鞋-变体B",
      "status": "ENABLED",
      "headline": "Nike跑鞋 专业竞速款 顶级缓震科技",
      "description": "春季特惠 满200减50",
      "metrics": {
        "impressions": 14890,
        "clicks": 372,
        "cost": 223.20,
        "conversions": 18,
        "ctr": 0.0250,
        "cpc": 0.60,
        "cpa": 12.40,
        "roi": 1.61
      },
      "is_winner": false,
      "winner_score": 68.7,
      "recommendation": {
        "type": "pause",
        "reason": "CTR低于Winner的78%，建议暂停",
        "action": "暂停此Campaign",
        "expected_impact": "节省预算，集中资源到高效Campaign"
      }
    }
  ],
  "stats": {
    "total_impressions": 30120,
    "total_clicks": 859,
    "total_cost": 468.80,
    "avg_ctr": 0.0285,
    "best_ctr": 0.0320,
    "worst_ctr": 0.0250
  }
}
```

**实现**：
```typescript
// app/api/campaigns/compare/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth/middleware';

const db = new Database(process.env.DATABASE_PATH!);

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const user = (request as AuthenticatedRequest).user!;
  const { searchParams } = new URL(request.url);
  const offerId = parseInt(searchParams.get('offer_id') || '0');

  if (!offerId) {
    return NextResponse.json({ error: 'Missing offer_id' }, { status: 400 });
  }

  try {
    // 1. 验证Offer归属
    const offer = db.prepare(`
      SELECT id, name FROM offers WHERE id = ? AND user_id = ?
    `).get(offerId, user.userId) as any;

    if (!offer) {
      return NextResponse.json(
        { error: 'Offer not found or access denied' },
        { status: 404 }
      );
    }

    // 2. 查询该Offer的所有Campaign
    const campaigns = db.prepare(`
      SELECT
        c.id AS campaign_id,
        c.name AS campaign_name,
        c.status,
        c.headline,
        c.description,
        c.impressions,
        c.clicks,
        c.cost,
        c.conversions,
        c.ctr,
        c.cpc,
        c.cpa,
        c.roi
      FROM campaigns c
      WHERE c.offer_id = ?
      ORDER BY c.ctr DESC
    `).all(offerId) as any[];

    // 3. 计算Winner（CTR 40% + ROI 40% + CPA 20%）
    const qualified = campaigns.filter(c => c.impressions >= 1000);

    const scored = qualified.map(c => ({
      campaign: c,
      score: calculateWinnerScore(c)
    }));

    scored.sort((a, b) => b.score - a.score);
    const winner = scored.length > 0 ? scored[0] : null;

    // 4. 为每个Campaign添加Winner标记和建议
    const enrichedCampaigns = campaigns.map(c => {
      const isWinner = winner && c.campaign_id === winner.campaign.campaign_id;
      const score = scored.find(s => s.campaign.campaign_id === c.campaign_id)?.score || 0;

      let recommendation = null;
      if (!isWinner && winner && c.impressions >= 1000) {
        if (c.ctr < winner.campaign.ctr * 0.5) {
          recommendation = {
            type: 'pause',
            reason: `CTR低于Winner的${((c.ctr / winner.campaign.ctr) * 100).toFixed(0)}%`,
            action: '暂停此Campaign',
            expected_impact: '节省预算，集中资源到高效Campaign'
          };
        }
      }

      return {
        campaign_id: c.campaign_id,
        campaign_name: c.campaign_name,
        status: c.status,
        headline: c.headline,
        description: c.description,
        metrics: {
          impressions: c.impressions,
          clicks: c.clicks,
          cost: c.cost,
          conversions: c.conversions,
          ctr: c.ctr,
          cpc: c.cpc,
          cpa: c.cpa,
          roi: c.roi
        },
        is_winner: isWinner,
        winner_score: score,
        recommendation
      };
    });

    // 5. 统计数据
    const stats = {
      total_impressions: campaigns.reduce((sum, c) => sum + c.impressions, 0),
      total_clicks: campaigns.reduce((sum, c) => sum + c.clicks, 0),
      total_cost: campaigns.reduce((sum, c) => sum + c.cost, 0),
      avg_ctr: campaigns.reduce((sum, c) => sum + c.ctr, 0) / campaigns.length,
      best_ctr: Math.max(...campaigns.map(c => c.ctr)),
      worst_ctr: Math.min(...campaigns.map(c => c.ctr))
    };

    return NextResponse.json({
      success: true,
      offer: {
        id: offer.id,
        name: offer.name
      },
      campaigns: enrichedCampaigns,
      stats
    });

  } catch (error: any) {
    console.error('Campaign comparison error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to compare campaigns' },
      { status: 500 }
    );
  }
}

// 计算Winner Score（CTR 40% + ROI 40% + CPA 20%）
function calculateWinnerScore(c: any): number {
  const ctrScore = (c.ctr / 0.03) * 40;      // CTR权重40%，基准3%
  const roiScore = (c.roi / 1.5) * 40;       // ROI权重40%，基准150%
  const cpaScore = c.cpa > 0 ? (1 / c.cpa) * 20 : 0; // CPA权重20%
  return ctrScore + roiScore + cpaScore;
}
```

---

### 5.2 每周优化建议API

#### GET /api/recommendations/weekly

**请求头**：
```
Authorization: Bearer <jwt_token>
```

**查询参数**（可选）：
```
status: string  // pending | applied | ignored（默认：pending）
```

**返回示例**：
```json
{
  "success": true,
  "recommendations": [
    {
      "id": 1,
      "priority": "high",
      "type": "pause",
      "campaign_id": 102,
      "campaign_name": "Nike跑鞋-变体B",
      "offer_name": "Nike专业跑鞋春季促销",
      "reason": "CTR仅为1.8%，低于行业均值3.0%的60%，且连续7天无改善",
      "action": "暂停此Campaign，停止无效花费",
      "expected_impact": "预计节省预算 $150/周",
      "metrics": {
        "ctr": 0.018,
        "cpc": 0.65,
        "cost": 450,
        "conversions": 12,
        "cpa": 37.50,
        "roi": 0.80
      },
      "status": "pending",
      "created_at": "2025-01-20T00:30:00Z"
    },
    {
      "id": 2,
      "priority": "high",
      "type": "increase_budget",
      "campaign_id": 101,
      "campaign_name": "Nike跑鞋-变体A",
      "offer_name": "Nike专业跑鞋春季促销",
      "reason": "ROI达到215%，CTR为3.2%，远超行业均值，且当前预算仅$100/天",
      "action": "建议增加预算至$140/天（+40%）",
      "expected_impact": "预计转化量提升30%，ROI保持稳定",
      "metrics": {
        "ctr": 0.032,
        "cpc": 0.50,
        "cost": 700,
        "conversions": 67,
        "cpa": 10.45,
        "roi": 2.15
      },
      "status": "pending",
      "created_at": "2025-01-20T00:30:00Z"
    }
  ],
  "summary": {
    "total_pending": 8,
    "by_priority": {
      "high": 3,
      "medium": 4,
      "low": 1
    }
  }
}
```

**实现**：
```typescript
// app/api/recommendations/weekly/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth/middleware';

const db = new Database(process.env.DATABASE_PATH!);

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const user = (request as AuthenticatedRequest).user!;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || 'pending';

  const recommendations = db.prepare(`
    SELECT * FROM weekly_recommendations
    WHERE user_id = ? AND status = ?
    ORDER BY
      CASE priority
        WHEN 'high' THEN 0
        WHEN 'medium' THEN 1
        WHEN 'low' THEN 2
      END,
      created_at DESC
  `).all(user.userId, status) as any[];

  // 统计信息
  const allPending = db.prepare(`
    SELECT priority, COUNT(*) as count
    FROM weekly_recommendations
    WHERE user_id = ? AND status = 'pending'
    GROUP BY priority
  `).all(user.userId) as any[];

  const summary = {
    total_pending: allPending.reduce((sum, p) => sum + p.count, 0),
    by_priority: {
      high: allPending.find(p => p.priority === 'high')?.count || 0,
      medium: allPending.find(p => p.priority === 'medium')?.count || 0,
      low: allPending.find(p => p.priority === 'low')?.count || 0
    }
  };

  return NextResponse.json({
    success: true,
    recommendations: recommendations.map(r => ({
      ...r,
      metrics: JSON.parse(r.metrics)
    })),
    summary
  });
}
```

---

#### POST /api/recommendations/:id/apply

**请求头**：
```
Authorization: Bearer <jwt_token>
```

**返回示例**：
```json
{
  "success": true,
  "message": "Recommendation applied successfully",
  "recommendation_id": 1,
  "applied_at": "2025-01-20T10:30:00Z"
}
```

**实现**：
```typescript
// app/api/recommendations/[id]/apply/route.ts
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const user = (request as AuthenticatedRequest).user!;
  const recId = parseInt(params.id);

  try {
    // 1. 查询建议
    const rec = db.prepare(`
      SELECT * FROM weekly_recommendations
      WHERE id = ? AND user_id = ?
    `).get(recId, user.userId) as any;

    if (!rec) {
      return NextResponse.json(
        { error: 'Recommendation not found' },
        { status: 404 }
      );
    }

    // 2. 根据类型执行操作
    if (rec.type === 'pause') {
      db.prepare(`
        UPDATE campaigns SET status = 'PAUSED' WHERE id = ?
      `).run(rec.campaign_id);
      // TODO: 调用Google Ads API暂停Campaign
    } else if (rec.type === 'increase_budget') {
      const metrics = JSON.parse(rec.metrics);
      const currentBudget = db.prepare(
        'SELECT budget FROM campaigns WHERE id = ?'
      ).get(rec.campaign_id) as any;
      const newBudget = currentBudget.budget * 1.4;
      db.prepare(`
        UPDATE campaigns SET budget = ? WHERE id = ?
      `).run(newBudget, rec.campaign_id);
      // TODO: 调用Google Ads API更新预算
    }

    // 3. 更新建议状态
    db.prepare(`
      UPDATE weekly_recommendations
      SET status = 'applied', applied_at = datetime('now')
      WHERE id = ?
    `).run(recId);

    return NextResponse.json({
      success: true,
      message: 'Recommendation applied successfully',
      recommendation_id: recId,
      applied_at: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Apply recommendation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to apply recommendation' },
      { status: 500 }
    );
  }
}
```

---

#### POST /api/recommendations/:id/ignore

**请求头**：
```
Authorization: Bearer <jwt_token>
```

**返回示例**：
```json
{
  "success": true,
  "message": "Recommendation ignored",
  "recommendation_id": 1
}
```

**实现**：
```typescript
// app/api/recommendations/[id]/ignore/route.ts
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const user = (request as AuthenticatedRequest).user!;
  const recId = parseInt(params.id);

  try {
    const result = db.prepare(`
      UPDATE weekly_recommendations
      SET status = 'ignored'
      WHERE id = ? AND user_id = ?
    `).run(recId, user.userId);

    if (result.changes === 0) {
      return NextResponse.json(
        { error: 'Recommendation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Recommendation ignored',
      recommendation_id: recId
    });

  } catch (error: any) {
    console.error('Ignore recommendation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to ignore recommendation' },
      { status: 500 }
    );
  }
}
```

---

### 5.3 AI创意自动学习（优化现有API）

**说明**：优化现有的创意生成API，添加自动学习历史高CTR创意的逻辑。

#### 修改 POST /api/creatives/generate

**实现变更**：
```typescript
// lib/ai/creativeOptimization.ts（新增）

interface TopCreative {
  creative_data: string;
  ctr: number;
  headline: string;
  description: string;
}

export function getTopPerformingCreatives(userId: number): TopCreative[] {
  const db = new Database(process.env.DATABASE_PATH!);

  // 查询该用户CTR > 3%的创意（取前10个）
  const topCreatives = db.prepare(`
    SELECT
      c.creative_data,
      camp.ctr,
      camp.headline,
      camp.description
    FROM creatives c
    JOIN campaigns camp ON c.campaign_id = camp.campaign_id
    WHERE c.user_id = ?
      AND camp.ctr > 0.03
      AND camp.impressions >= 100
    ORDER BY camp.ctr DESC
    LIMIT 10
  `).all(userId) as TopCreative[];

  return topCreatives;
}

// 在现有的 generateCreatives 函数中添加学习逻辑
export async function generateCreatives(
  offerData: any,
  userId: number
): Promise<Creative> {
  // 1. 获取用户历史高CTR创意
  const topCreatives = getTopPerformingCreatives(userId);

  // 2. 构建AI prompt（自动注入成功案例）
  let learningPrompt = '';
  if (topCreatives.length > 0) {
    learningPrompt = `
## 📊 用户历史表现最好的创意（CTR > 3%）：

${topCreatives.map((c, i) => `
${i + 1}. CTR: ${(c.ctr * 100).toFixed(2)}%
   标题: ${c.headline}
   描述: ${c.description}
`).join('\n')}

## 🎯 请参考上述成功案例的风格和特点：
- 标题结构和长度
- 关键词使用方式
- 情感化/功能化表达
- 号召性用语风格

在生成新创意时，请保持与用户历史成功案例相似的风格。
`;
  }

  // 3. 调用AI API
  const prompt = `
${BASE_CREATIVE_PROMPT}

${learningPrompt}

## 产品信息：
${JSON.stringify(offerData, null, 2)}

请生成5组广告创意...
`;

  const response = await callAIAPI(prompt);
  return parseCreativeResponse(response);
}
```

**⚠️ 注意**：该AI学习逻辑已在DATA_DRIVEN_OPTIMIZATION.md中升级为更完善的特征提取方案，详见Section 2的完整实现。

---

### 5.4 性能数据查询API（新增）

#### GET /api/performance/hourly

**说明**：获取Campaign按小时维度的性能数据，用于Rule 6/7时段优化分析。

**请求头**：
```
Authorization: Bearer <jwt_token>
```

**查询参数**：
```
campaign_id: number  // Campaign ID
date_start: string   // 开始日期（YYYY-MM-DD，可选，默认7天前）
date_end: string     // 结束日期（YYYY-MM-DD，可选，默认今天）
```

**返回示例**：
```json
{
  "success": true,
  "campaign_id": 101,
  "campaign_name": "Nike跑鞋-变体A",
  "hourly_performance": [
    {
      "hour_of_day": 0,
      "impressions": 120,
      "clicks": 3,
      "cost": 1.50,
      "conversions": 0,
      "ctr": 0.025,
      "cpc": 0.50
    },
    {
      "hour_of_day": 9,
      "impressions": 850,
      "clicks": 34,
      "cost": 17.00,
      "conversions": 2,
      "ctr": 0.040,
      "cpc": 0.50
    }
    // ... 其他小时数据
  ],
  "peak_hours": [9, 14, 20],  // CTR最高的3个小时
  "low_hours": [0, 1, 2, 3, 4, 5]  // CTR最低的6个小时
}
```

**实现**：
```typescript
// app/api/performance/hourly/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth/middleware';

const db = new Database(process.env.DATABASE_PATH!);

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const user = (request as AuthenticatedRequest).user!;
  const { searchParams } = new URL(request.url);

  const campaignId = parseInt(searchParams.get('campaign_id') || '0');
  const dateStart = searchParams.get('date_start') ||
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const dateEnd = searchParams.get('date_end') ||
    new Date().toISOString().split('T')[0];

  if (!campaignId) {
    return NextResponse.json({ error: 'Missing campaign_id' }, { status: 400 });
  }

  try {
    // 验证Campaign归属
    const campaign = db.prepare(`
      SELECT id, name FROM campaigns WHERE id = ? AND user_id = ?
    `).get(campaignId, user.userId) as any;

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found or access denied' },
        { status: 404 }
      );
    }

    // 查询小时维度性能数据
    const hourlyData = db.prepare(`
      SELECT
        hour_of_day,
        SUM(impressions) as impressions,
        SUM(clicks) as clicks,
        SUM(cost) as cost,
        SUM(conversions) as conversions,
        CAST(SUM(clicks) AS REAL) / SUM(impressions) as ctr,
        CAST(SUM(cost) AS REAL) / SUM(clicks) as cpc
      FROM campaign_performance
      WHERE campaign_id = ?
        AND date >= ? AND date <= ?
        AND hour_of_day IS NOT NULL
      GROUP BY hour_of_day
      ORDER BY hour_of_day
    `).all(campaignId, dateStart, dateEnd) as any[];

    // 计算峰值和低谷时段
    const sorted = [...hourlyData].sort((a, b) => b.ctr - a.ctr);
    const peakHours = sorted.slice(0, 3).map(h => h.hour_of_day);
    const lowHours = sorted.slice(-6).map(h => h.hour_of_day);

    return NextResponse.json({
      success: true,
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      hourly_performance: hourlyData,
      peak_hours: peakHours,
      low_hours: lowHours
    });

  } catch (error: any) {
    console.error('Hourly performance query error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to query hourly performance' },
      { status: 500 }
    );
  }
}
```

---

### 5.5 搜索词报告API（新增）

#### GET /api/search-terms

**说明**：获取Campaign的搜索词报告数据，用于Rule 5关键词优化。

**请求头**：
```
Authorization: Bearer <jwt_token>
```

**查询参数**：
```
campaign_id: number  // Campaign ID
min_impressions: number  // 最小展示量（默认100）
sort_by: string  // 排序字段：ctr | impressions | conversions（默认ctr）
```

**返回示例**：
```json
{
  "success": true,
  "campaign_id": 101,
  "campaign_name": "Nike跑鞋-变体A",
  "campaign_ctr": 0.032,
  "search_terms": [
    {
      "search_term": "耐克专业跑鞋",
      "match_type": "PHRASE",
      "impressions": 1250,
      "clicks": 58,
      "cost": 29.00,
      "conversions": 3,
      "ctr": 0.046,
      "cpc": 0.50,
      "conversion_rate": 0.052,
      "is_keyword": false,
      "recommendation": {
        "action": "add_keyword",
        "reason": "CTR为4.6%，高于Campaign平均CTR（3.2%）的44%",
        "expected_impact": "添加为关键词后可扩大相关流量10-15%"
      }
    },
    {
      "search_term": "跑步鞋推荐",
      "match_type": "BROAD",
      "impressions": 890,
      "clicks": 31,
      "cost": 15.50,
      "conversions": 2,
      "ctr": 0.035,
      "cpc": 0.50,
      "conversion_rate": 0.065,
      "is_keyword": true,
      "added_as_keyword_at": "2025-01-15T10:00:00Z"
    }
  ],
  "summary": {
    "total_search_terms": 45,
    "recommended_to_add": 8,
    "already_keywords": 12
  }
}
```

**实现**：
```typescript
// app/api/search-terms/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth/middleware';

const db = new Database(process.env.DATABASE_PATH!);

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const user = (request as AuthenticatedRequest).user!;
  const { searchParams } = new URL(request.url);

  const campaignId = parseInt(searchParams.get('campaign_id') || '0');
  const minImpressions = parseInt(searchParams.get('min_impressions') || '100');
  const sortBy = searchParams.get('sort_by') || 'ctr';

  if (!campaignId) {
    return NextResponse.json({ error: 'Missing campaign_id' }, { status: 400 });
  }

  try {
    // 验证Campaign归属并获取平均CTR
    const campaign = db.prepare(`
      SELECT id, name, ctr FROM campaigns WHERE id = ? AND user_id = ?
    `).get(campaignId, user.userId) as any;

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found or access denied' },
        { status: 404 }
      );
    }

    // 查询搜索词数据
    const searchTerms = db.prepare(`
      SELECT *
      FROM search_term_reports
      WHERE campaign_id = ?
        AND impressions >= ?
      ORDER BY ${sortBy} DESC
    `).all(campaignId, minImpressions) as any[];

    // 为每个搜索词生成建议
    const enrichedTerms = searchTerms.map(term => {
      let recommendation = null;

      if (!term.is_keyword && term.ctr > campaign.ctr * 1.2) {
        recommendation = {
          action: 'add_keyword',
          reason: `CTR为${(term.ctr * 100).toFixed(1)}%，高于Campaign平均CTR（${(campaign.ctr * 100).toFixed(1)}%）的${((term.ctr / campaign.ctr - 1) * 100).toFixed(0)}%`,
          expected_impact: '添加为关键词后可扩大相关流量10-15%'
        };
      }

      return {
        search_term: term.search_term,
        match_type: term.match_type,
        impressions: term.impressions,
        clicks: term.clicks,
        cost: term.cost,
        conversions: term.conversions,
        ctr: term.ctr,
        cpc: term.cpc,
        conversion_rate: term.conversion_rate,
        is_keyword: term.is_keyword === 1,
        added_as_keyword_at: term.added_as_keyword_at,
        recommendation
      };
    });

    // 统计信息
    const summary = {
      total_search_terms: searchTerms.length,
      recommended_to_add: enrichedTerms.filter(t => t.recommendation).length,
      already_keywords: enrichedTerms.filter(t => t.is_keyword).length
    };

    return NextResponse.json({
      success: true,
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      campaign_ctr: campaign.ctr,
      search_terms: enrichedTerms,
      summary
    });

  } catch (error: any) {
    console.error('Search terms query error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to query search terms' },
      { status: 500 }
    );
  }
}
```

---

### 5.6 Top创意查询API（新增）

#### GET /api/recommendations/top-creatives

**说明**：获取用户历史Top表现的创意，用于AI Prompt优化学习。

**请求头**：
```
Authorization: Bearer <jwt_token>
```

**查询参数**（可选）：
```
limit: number  // 返回数量（默认10）
min_ctr: number  // 最小CTR（默认0.03即3%）
```

**返回示例**：
```json
{
  "success": true,
  "top_creatives": [
    {
      "creative_id": 45,
      "campaign_id": 101,
      "headline": "Nike专业跑鞋 轻便透气 马拉松训练首选",
      "description": "立即购买享受8折优惠，限时特价仅需$89",
      "impressions": 15230,
      "clicks": 487,
      "conversions": 23,
      "ctr": 0.032,
      "conversion_rate": 0.047,
      "features": {
        "headline_length": 21,
        "has_brand": true,
        "has_price": true,
        "has_numbers": true,
        "emotion_words": ["专业", "首选"],
        "urgency_words": ["限时"]
      },
      "tracked_at": "2025-01-20T00:30:00Z"
    }
    // ... 其他Top创意
  ],
  "patterns": {
    "avg_headline_length": 19.5,
    "brand_mention_rate": 0.80,
    "price_info_rate": 0.60,
    "common_emotion_words": ["专业", "首选", "优质"]
  }
}
```

**实现**：
```typescript
// app/api/recommendations/top-creatives/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth/middleware';

const db = new Database(process.env.DATABASE_PATH!);

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const user = (request as AuthenticatedRequest).user!;
  const { searchParams } = new URL(request.url);

  const limit = parseInt(searchParams.get('limit') || '10');
  const minCtr = parseFloat(searchParams.get('min_ctr') || '0.03');

  try {
    // 查询Top创意
    const topCreatives = db.prepare(`
      SELECT
        creative_id,
        campaign_id,
        headline,
        description,
        impressions,
        clicks,
        conversions,
        ctr,
        conversion_rate,
        features,
        tracked_at
      FROM top_performing_creatives
      WHERE user_id = ?
        AND ctr >= ?
      ORDER BY ctr DESC
      LIMIT ?
    `).all(user.userId, minCtr, limit) as any[];

    // 解析特征并计算模式
    const creativesWithFeatures = topCreatives.map(c => ({
      ...c,
      features: c.features ? JSON.parse(c.features) : null
    }));

    // 提取成功模式
    const patterns = {
      avg_headline_length: creativesWithFeatures.reduce((sum, c) =>
        sum + (c.features?.headline_length || 0), 0) / creativesWithFeatures.length,
      brand_mention_rate: creativesWithFeatures.filter(c =>
        c.features?.has_brand).length / creativesWithFeatures.length,
      price_info_rate: creativesWithFeatures.filter(c =>
        c.features?.has_price).length / creativesWithFeatures.length,
      common_emotion_words: extractCommonWords(
        creativesWithFeatures.map(c => c.features?.emotion_words || [])
      )
    };

    return NextResponse.json({
      success: true,
      top_creatives: creativesWithFeatures,
      patterns
    });

  } catch (error: any) {
    console.error('Top creatives query error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to query top creatives' },
      { status: 500 }
    );
  }
}

function extractCommonWords(wordArrays: string[][]): string[] {
  const wordCounts = new Map<string, number>();

  wordArrays.forEach(words => {
    words.forEach(word => {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    });
  });

  return Array.from(wordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}
```

---

### 5.7 批量应用建议API（新增）

#### POST /api/recommendations/batch-apply

**说明**：批量应用多个优化建议，提升操作效率。

**请求头**：
```
Authorization: Bearer <jwt_token>
```

**请求体**：
```json
{
  "recommendation_ids": [1, 2, 5, 8]
}
```

**返回示例**：
```json
{
  "success": true,
  "results": [
    {
      "recommendation_id": 1,
      "status": "applied",
      "message": "Campaign paused successfully"
    },
    {
      "recommendation_id": 2,
      "status": "applied",
      "message": "Budget increased to $140/day"
    },
    {
      "recommendation_id": 5,
      "status": "failed",
      "error": "Campaign not found"
    },
    {
      "recommendation_id": 8,
      "status": "applied",
      "message": "CPC adjusted to $0.45"
    }
  ],
  "summary": {
    "total": 4,
    "applied": 3,
    "failed": 1
  }
}
```

**实现**：
```typescript
// app/api/recommendations/batch-apply/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth/middleware';

const db = new Database(process.env.DATABASE_PATH!);

export async function POST(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const user = (request as AuthenticatedRequest).user!;
  const body = await request.json();
  const { recommendation_ids } = body;

  if (!Array.isArray(recommendation_ids) || recommendation_ids.length === 0) {
    return NextResponse.json(
      { error: 'Missing or invalid recommendation_ids array' },
      { status: 400 }
    );
  }

  try {
    const results = [];
    let appliedCount = 0;
    let failedCount = 0;

    for (const recId of recommendation_ids) {
      try {
        // 查询建议
        const rec = db.prepare(`
          SELECT * FROM weekly_recommendations
          WHERE id = ? AND user_id = ?
        `).get(recId, user.userId) as any;

        if (!rec) {
          results.push({
            recommendation_id: recId,
            status: 'failed',
            error: 'Recommendation not found'
          });
          failedCount++;
          continue;
        }

        // 根据类型执行操作（简化版，实际需调用Google Ads API）
        const metrics = JSON.parse(rec.metrics);
        let message = '';

        switch (rec.type) {
          case 'pause':
            db.prepare(`UPDATE campaigns SET status = 'PAUSED' WHERE id = ?`)
              .run(rec.campaign_id);
            message = 'Campaign paused successfully';
            break;

          case 'increase_budget':
            const currentBudget = db.prepare(
              'SELECT budget FROM campaigns WHERE id = ?'
            ).get(rec.campaign_id) as any;
            const newBudget = currentBudget.budget * 1.4;
            db.prepare(`UPDATE campaigns SET budget = ? WHERE id = ?`)
              .run(newBudget, rec.campaign_id);
            message = `Budget increased to $${newBudget.toFixed(2)}/day`;
            break;

          case 'adjust_cpc':
            // 逻辑省略...
            message = 'CPC adjusted';
            break;

          default:
            message = 'Recommendation applied';
        }

        // 更新状态
        db.prepare(`
          UPDATE weekly_recommendations
          SET status = 'applied', applied_at = datetime('now')
          WHERE id = ?
        `).run(recId);

        results.push({
          recommendation_id: recId,
          status: 'applied',
          message
        });
        appliedCount++;

      } catch (error: any) {
        results.push({
          recommendation_id: recId,
          status: 'failed',
          error: error.message
        });
        failedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: recommendation_ids.length,
        applied: appliedCount,
        failed: failedCount
      }
    });

  } catch (error: any) {
    console.error('Batch apply error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to batch apply recommendations' },
      { status: 500 }
    );
  }
}
```

---

## 六、API调用最佳实践

### 6.1 JWT Token刷新策略

```typescript
// lib/auth/tokenRefresh.ts
import { apiClient } from '@/lib/api/client';
import { setToken, getToken } from '@/lib/auth/tokenStorage';

let tokenRefreshTimer: NodeJS.Timeout | null = null;

export function startTokenRefreshTimer() {
  // JWT过期时间为7天，在第6天刷新
  const refreshInterval = 6 * 24 * 60 * 60 * 1000;  // 6天

  tokenRefreshTimer = setInterval(async () => {
    const token = getToken();
    if (!token) {
      stopTokenRefreshTimer();
      return;
    }

    try {
      const response = await apiClient.get<any>('/api/auth/verify');
      if (response.valid) {
        console.log('Token still valid');
      }
    } catch (error) {
      console.error('Token refresh check failed:', error);
      stopTokenRefreshTimer();
    }
  }, refreshInterval);
}

export function stopTokenRefreshTimer() {
  if (tokenRefreshTimer) {
    clearInterval(tokenRefreshTimer);
    tokenRefreshTimer = null;
  }
}
```

### 6.2 多用户数据隔离模式

所有API查询必须包含`user_id`过滤：

```typescript
// ✅ 正确：带user_id过滤
const offers = db.prepare(`
  SELECT * FROM offers WHERE user_id = ?
`).all(user.userId);

// ❌ 错误：没有user_id过滤，泄漏其他用户数据
const offers = db.prepare(`
  SELECT * FROM offers
`).all();
```

### 6.3 错误处理标准

```typescript
try {
  // API操作
} catch (error: any) {
  console.error('Operation error:', error);

  if (error.code === 'SQLITE_CONSTRAINT') {
    return NextResponse.json(
      { error: 'Duplicate entry or constraint violation' },
      { status: 409 }
    );
  }

  return NextResponse.json(
    { error: error.message || 'Internal server error' },
    { status: 500 }
  );
}
```

---

## 七、V2.0迁移指南

### 7.1 从V1.0迁移到V2.0

**重要**：本项目不支持从V1.0自动迁移历史数据，因为架构发生根本性变化（前端IndexedDB → 后端SQLite）。

**迁移步骤**：
1. 部署V2.0系统（全新数据库）
2. 使用默认管理员账号登录（username: `autoads`, password: `K$j6z!9Tq@P2w#aR`）
3. 创建新用户并分配套餐
4. 用户手动重新连接Google Ads账号
5. 用户重新创建Offer和Campaign

**数据导出（V1.0用户可选）**：
- V1.0用户可使用浏览器开发者工具导出IndexedDB数据
- 手动转换为JSON格式
- 通过V2.0的数据导入功能导入（需自行开发）

### 7.2 V2.0新功能检查清单

- [ ] 用户登录功能正常
- [ ] 首次登录强制修改密码
- [ ] JWT认证在所有API中生效
- [ ] Google Ads OAuth回调保存到后端数据库
- [ ] Offer创建保存到后端数据库
- [ ] 离线创建Offer功能测试
- [ ] 网络恢复后自动同步测试
- [ ] 数据导出功能（JSON/CSV）
- [ ] 管理员创建用户功能
- [ ] 管理员查看备份历史
- [ ] 手动触发备份功能
- [ ] 套餐过期拦截测试
- [ ] 多用户数据隔离验证
- [ ] Campaign对比分析功能
- [ ] 每周优化建议生成
- [ ] AI自动学习历史创意功能

---

## 附录A：完整API端点列表

### 认证相关
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/change-password` - 修改密码
- `GET /api/auth/verify` - 验证Token
- `POST /api/auth/logout` - 登出

### Google Ads相关
- `GET /api/oauth/callback` - OAuth回调
- `GET /api/google-ads-accounts` - 获取账号列表
- `POST /api/campaigns` - 创建Campaign
- `POST /api/campaigns/[id]/sync-performance` - 同步性能数据

### Offer相关
- `POST /api/offers` - 创建Offer
- `GET /api/offers` - 获取Offer列表
- `GET /api/offers/[id]` - 获取Offer详情
- `PUT /api/offers/[id]` - 更新Offer
- `DELETE /api/offers/[id]` - 删除Offer

### Launch Score相关
- `POST /api/launch-score/calculate` - 计算Launch Score
- `GET /api/launch-score/history/[offerId]` - 获取历史评分

### 数据驱动优化相关（KISS版）
- `GET /api/campaigns/compare` - Campaign对比分析
- `GET /api/recommendations/weekly` - 获取每周优化建议
- `POST /api/recommendations/[id]/apply` - 应用优化建议
- `POST /api/recommendations/[id]/ignore` - 忽略优化建议

### 数据导出相关
- `GET /api/data/export` - 导出用户数据
- `GET /api/admin/data/export-all` - 管理员全量导出

### 管理员相关
- `POST /api/admin/users` - 创建用户
- `GET /api/admin/users` - 获取用户列表
- `PUT /api/admin/users/[id]` - 更新用户
- `DELETE /api/admin/users/[id]` - 删除用户
- `GET /api/admin/backups` - 查看备份历史
- `POST /api/admin/backups/manual` - 手动备份

---

## 附录B：环境变量完整列表

```bash
# Google Ads API
GOOGLE_ADS_DEVELOPER_TOKEN=your_developer_token
GOOGLE_ADS_CLIENT_ID=your_oauth_client_id
GOOGLE_ADS_CLIENT_SECRET=your_oauth_client_secret
NEXT_PUBLIC_GOOGLE_OAUTH_REDIRECT_URI=https://yourdomain.com/api/oauth/callback

# Gemini API
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-pro-latest

# Claude API (备用)
CLAUDE_API_KEY=your_claude_api_key
CLAUDE_MODEL=claude-4.5-sonnet-20250101

# 数据库配置
DATABASE_PATH=./data/users.db
BACKUP_DIR=./data/backups
MAX_BACKUP_DAYS=30

# JWT配置
JWT_SECRET=your_random_64_char_hex_secret_here
JWT_EXPIRES_IN=7d

# 加密配置
ENCRYPTION_KEY=your_32_byte_hex_key_for_aes256

# 安全配置
BCRYPT_SALT_ROUNDS=10
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION_MINUTES=5

# 备份配置
BACKUP_CRON_SCHEDULE=0 2 * * *
ENABLE_AUTO_BACKUP=true
```

---

**文档版本**：V2.0
**最后更新**：2024年
**维护者**：AutoAds开发团队
