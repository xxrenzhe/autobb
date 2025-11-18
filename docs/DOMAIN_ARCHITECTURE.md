# 域名架构与导航流程设计

**创建日期**: 2025-01-18
**状态**: ✅ 推荐方案

---

## 📋 需求概述

### 核心要求
1. **营销页面**: www.autoads.dev - 公开访问，无需登录
2. **应用系统**: app.autoads.dev - 需要登录认证
3. **认证策略**: 除首页外所有页面强制登录，未认证用户自动跳转登录页
4. **用户流程**: 营销页 → 登录 → 应用系统

---

## ✅ 架构评估：推荐方案

**结论**: **强烈推荐**使用 www + app 子域名分离架构（单容器Monorepo部署）

### 🏗️ 单容器部署架构概述

**核心设计**:
- **Monorepo结构**: 单个Next.js项目，使用Route Groups组织代码
- **单容器部署**: 一次构建，一个Vercel实例，降低运维成本
- **双域名路由**: `www.autoads.dev` 和 `app.autoads.dev` 指向同一部署
- **Middleware路由**: 基于hostname动态路由到不同页面组
- **逻辑分离**: 营销页和应用系统完全独立，互不干扰

**技术栈**:
```yaml
框架: Next.js 14 (App Router)
语言: TypeScript
UI: shadcn/ui + Tailwind CSS
认证: JWT + Cookie Session
部署: Vercel (单项目，双域名)
数据库: PostgreSQL (生产) / SQLite (开发)
```

**路由策略**:
```typescript
// Middleware根据hostname路由
www.autoads.dev → app/(www)/*   # 营销页，无需认证
app.autoads.dev → app/(app)/*   # 应用系统，需要认证
app.autoads.dev → app/(auth)/*  # 登录注册，公开访问
```

**部署架构**:
```
DNS配置:
├── www.autoads.dev (CNAME → cname.vercel-dns.com)
└── app.autoads.dev (CNAME → cname.vercel-dns.com)
    ↓
    同一个Vercel部署实例
    ↓
Middleware hostname检测
├── www.* → 营销页路由组 (无认证)
└── app.* → 应用路由组 (需认证)
```

### 核心优势

#### 1. 🎯 **清晰的职责分离**

```yaml
www.autoads.dev:
  职责: 营销和转化
  访问控制: 公开访问
  目标用户: 潜在客户、访客
  技术栈: 静态优化、SEO优化
  部署方式: CDN边缘节点（全球加速）

app.autoads.dev:
  职责: 应用功能
  访问控制: 需要认证
  目标用户: 付费用户
  技术栈: 动态应用、状态管理
  部署方式: 区域服务器（数据安全）
```

#### 2. 🚀 **性能优化**

**营销页面（www）**:
- ✅ 静态生成（SSG）或静态站点，极速加载
- ✅ CDN全球分发，降低延迟
- ✅ 无需认证检查，减少服务器压力
- ✅ 独立缓存策略（长期缓存）

**应用系统（app）**:
- ✅ 服务端渲染（SSR）或客户端渲染（CSR）
- ✅ 复杂状态管理和实时数据
- ✅ 认证和授权逻辑独立
- ✅ 独立缓存策略（短期或无缓存）

**性能对比**:
```
www.autoads.dev:
  首屏加载: < 1s
  CDN命中率: 95%+
  全球延迟: < 100ms

app.autoads.dev:
  首次加载: 2-3s（包含认证）
  CDN使用: 仅静态资源
  区域延迟: < 200ms（主要用户区域）
```

#### 3. 🔒 **安全性增强**

**Cookie隔离**:
```javascript
// www.autoads.dev - 无敏感Cookie
// 仅营销相关（如UTM追踪、匿名分析）

// app.autoads.dev - 认证Cookie
Set-Cookie: session_token=xxx;
  Domain=app.autoads.dev;
  Secure;
  HttpOnly;
  SameSite=Strict;
  Path=/;
```

**安全优势**:
- ✅ 营销页面不暴露认证信息
- ✅ 防止CSRF攻击（Cookie作用域严格限制）
- ✅ 减少XSS攻击面（营销页面无敏感数据）
- ✅ 独立的CSP策略（内容安全策略）

#### 4. 📊 **SEO优化**

**www域名SEO优势**:
- ✅ 符合用户预期（www = 官网）
- ✅ 独立的robots.txt和sitemap.xml
- ✅ 专注于营销关键词优化
- ✅ 避免应用页面（需登录）被搜索引擎索引

**app域名SEO策略**:
- ✅ 明确标记noindex（避免登录墙内容被索引）
- ✅ 不分散主域名的SEO权重
- ✅ 专注于应用功能，不参与SEO竞争

#### 5. 🛠️ **运维便利性**

**独立部署**:
```yaml
www.autoads.dev:
  部署平台: Vercel / Cloudflare Pages / Netlify
  部署频率: 低（营销内容变化慢）
  CDN: 全球边缘节点
  成本: 极低（静态托管）

app.autoads.dev:
  部署平台: Vercel / AWS / GCP
  部署频率: 高（功能迭代快）
  服务器: 区域部署（中国香港/新加坡）
  成本: 中等（动态计算资源）
```

**灰度发布和回滚**:
- ✅ 营销页面和应用系统独立发布
- ✅ 应用更新不影响营销页
- ✅ 出问题可独立回滚
- ✅ A/B测试互不干扰

#### 6. 📈 **数据分析**

**独立分析策略**:
```javascript
// www.autoads.dev - 营销漏斗分析
Google Analytics 4:
  - 访问来源
  - 页面浏览路径
  - CTA点击率
  - 转化漏斗

Mixpanel:
  - 用户行为追踪
  - 注册转化率

// app.autoads.dev - 产品使用分析
Mixpanel:
  - 功能使用频率
  - 用户留存率
  - 核心路径完成率

Sentry:
  - 错误监控
  - 性能监控
```

#### 7. 💰 **单容器方案的额外优势**

**成本优化**:
- ✅ **单一构建**: 只需一次构建，而非两次（www + app各一次）
- ✅ **单一实例**: Vercel收费基于实例数，单容器=单价
- ✅ **共享资源**: 函数调用、带宽等共享配额
- ✅ **预计节省**: 相比双容器方案节省约40-50%成本

**开发效率**:
- ✅ **统一代码库**: 修改一次影响全局，无需同步
- ✅ **共享组件**: Button、Input等UI组件完全复用
- ✅ **类型共享**: TypeScript类型定义自动同步
- ✅ **依赖统一**: package.json单一管理，无版本冲突

**部署便利**:
- ✅ **单次部署**: git push一次，两个域名同时更新
- ✅ **原子更新**: 营销页和应用系统同步上线，无版本差异
- ✅ **简化回滚**: 一键回滚到上一版本，两域名同步
- ✅ **环境变量**: 统一管理，无需双倍配置

**维护优势**:
- ✅ **日志集中**: 所有日志在同一Vercel项目
- ✅ **监控统一**: 单一Sentry项目，错误追踪集中
- ✅ **依赖更新**: 一次更新Next.js，全局生效
- ✅ **安全补丁**: 安全更新无需协调多项目

**对比双容器方案**:
```yaml
单容器方案（推荐）:
  构建次数: 1次
  部署实例: 1个
  环境变量: 1套
  日志监控: 1个项目
  成本: 基础价（假设$20/月）
  维护复杂度: 低

双容器方案:
  构建次数: 2次（www + app）
  部署实例: 2个
  环境变量: 2套（需同步）
  日志监控: 2个项目
  成本: 约$35-40/月（两个实例）
  维护复杂度: 中等
```

---

## 🔄 完整用户流程设计

### 1. 首次访问流程

```mermaid
graph TD
    A[访客访问 www.autoads.dev] --> B{浏览营销页面}
    B --> C[了解产品价值]
    C --> D[点击 "立即开始" CTA]
    D --> E[跳转到 app.autoads.dev/login]
    E --> F{是否已有账号?}
    F -->|有账号| G[登录]
    F -->|无账号| H[注册]
    G --> I[验证凭证]
    H --> J[创建账号]
    I --> K{认证成功?}
    J --> K
    K -->|成功| L[跳转到 app.autoads.dev/dashboard]
    K -->|失败| E
```

### 2. 认证状态检查流程

```mermaid
graph TD
    A[用户访问 app.autoads.dev/*] --> B{检查认证状态}
    B -->|已登录| C[显示目标页面]
    B -->|未登录| D[重定向到 /login?redirect=/original-path]
    D --> E[用户登录]
    E --> F{登录成功?}
    F -->|成功| G[跳转回原始目标页面]
    F -->|失败| D
```

### 3. 跨域会话管理

```mermaid
graph TD
    A[app.autoads.dev 设置认证Cookie] --> B[Cookie属性]
    B --> C[Domain: app.autoads.dev]
    B --> D[Secure: true]
    B --> E[HttpOnly: true]
    B --> F[SameSite: Strict]

    G[www.autoads.dev] --> H[无法读取 app 的Cookie]
    H --> I[通过URL跳转传递状态]

    J[用户点击"立即开始"] --> K[app.autoads.dev/login]
    K --> L{有Session Cookie?}
    L -->|有| M[直接进入Dashboard]
    L -->|无| N[显示登录表单]
```

---

## 💻 技术实现方案

### 1. Next.js项目结构（Monorepo单容器部署）

**部署架构**: Monorepo结构 + 单容器部署 + 基于hostname的路由

```
autobb/
├── app/                        # Next.js App Router根目录
│   ├── (www)/                  # 营销站点路由组（www.autoads.dev）
│   │   ├── layout.tsx          # 营销站布局
│   │   ├── page.tsx            # 首页
│   │   ├── pricing/
│   │   │   └── page.tsx        # 定价页
│   │   ├── blog/
│   │   │   ├── page.tsx
│   │   │   └── [slug]/
│   │   ├── demo/
│   │   └── about/
│   │
│   ├── (app)/                  # 应用系统路由组（app.autoods.dev）
│   │   ├── layout.tsx          # 应用布局（包含侧边栏等）
│   │   ├── page.tsx            # 重定向到/dashboard
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── offers/
│   │   │   ├── page.tsx
│   │   │   ├── [id]/
│   │   │   └── new/
│   │   ├── campaigns/
│   │   ├── analytics/
│   │   └── settings/
│   │
│   ├── (auth)/                 # 认证页面路由组（app.autoads.dev）
│   │   ├── layout.tsx          # 认证页布局（简洁，无侧边栏）
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── register/
│   │   │   └── page.tsx
│   │   ├── forgot-password/
│   │   └── reset-password/
│   │
│   └── api/
│       ├── auth/
│       │   ├── login/
│       │   ├── register/
│       │   └── logout/
│       ├── offers/
│       ├── campaigns/
│       └── health/
│
├── middleware.ts               # 全局中间件（hostname路由 + 认证）
├── components/
│   ├── www/                    # 营销站专用组件
│   │   ├── Hero.tsx
│   │   ├── PricingCard.tsx
│   │   └── Testimonial.tsx
│   ├── app/                    # 应用专用组件
│   │   ├── Sidebar.tsx
│   │   ├── OfferCard.tsx
│   │   └── Dashboard.tsx
│   └── shared/                 # 共享组件
│       ├── Button.tsx
│       ├── Input.tsx
│       └── ...
│
├── lib/
│   ├── auth.ts
│   ├── db.ts
│   └── utils.ts
│
├── public/
│   ├── www/                    # 营销站资源
│   │   ├── images/
│   │   └── videos/
│   └── app/                    # 应用资源
│       └── icons/
│
├── next.config.js              # 统一配置
├── package.json
└── tsconfig.json
```

**架构特点**:
- ✅ **Route Groups路由组**: 使用Next.js 13+的路由组功能，逻辑分离但物理统一
- ✅ **单容器部署**: 一次构建，一个部署实例，降低运维成本
- ✅ **Hostname路由**: Middleware根据域名动态路由到不同页面组
- ✅ **代码复用**: 完全共享组件、库、类型定义
- ✅ **统一依赖**: 单一package.json，版本管理简单

### 2. Hostname路由 + 认证中间件实现

#### middleware.ts（单容器版本）

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 域名配置
const WWW_DOMAIN = 'www.autoads.dev';
const APP_DOMAIN = 'app.autoads.dev';

// app域的公开路径（无需认证）
const APP_PUBLIC_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/api/auth/*',        // 认证API
  '/api/health',        // 健康检查
];

// 认证后不应访问的路径
const AUTH_PAGES = ['/login', '/register'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host') || '';

  // ============================================
  // 阶段1: Hostname路由（区分www和app域）
  // ============================================

  // 1.1 开发环境域名映射
  const isLocalhost = hostname.includes('localhost') || hostname.includes('127.0.0.1');
  let targetDomain = '';

  if (isLocalhost) {
    // 开发环境：通过端口或参数区分
    // localhost:3000 → www
    // localhost:3000/?app=true → app
    const isAppMode = request.nextUrl.searchParams.has('app');
    targetDomain = isAppMode ? 'app' : 'www';
  } else {
    // 生产环境：通过hostname区分
    if (hostname === WWW_DOMAIN || hostname.startsWith('www.')) {
      targetDomain = 'www';
    } else if (hostname === APP_DOMAIN || hostname.startsWith('app.')) {
      targetDomain = 'app';
    }
  }

  // 1.2 根据域名重写路径到对应的路由组
  if (targetDomain === 'www') {
    // www域名访问 → 重写到(www)路由组
    // 例如: / → /(www)
    // 注意: Next.js的Route Groups不影响URL，只是内部组织方式
    // 所以这里主要是确保认证逻辑不应用于www域

    // www域名不需要认证，直接放行
    const response = NextResponse.next();

    // 为www域添加特定的安全头
    response.headers.set('X-Frame-Options', 'SAMEORIGIN');
    response.headers.set('X-Content-Type-Options', 'nosniff');

    return response;
  }

  // ============================================
  // 阶段2: App域认证检查（仅app.autoads.dev）
  // ============================================

  if (targetDomain === 'app') {
    // 2.1 检查是否是公开路径
    const isPublicPath = APP_PUBLIC_PATHS.some(path => {
      if (path.endsWith('/*')) {
        return pathname.startsWith(path.slice(0, -2));
      }
      return pathname === path;
    });

    // 2.2 获取认证状态
    const sessionToken = request.cookies.get('session_token')?.value;
    const isAuthenticated = !!sessionToken;

    // 2.3 已登录用户访问登录/注册页 → 重定向到Dashboard
    if (isAuthenticated && AUTH_PAGES.includes(pathname)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // 2.4 未登录用户访问受保护页面 → 重定向到登录页
    if (!isAuthenticated && !isPublicPath) {
      const loginUrl = new URL('/login', request.url);

      // 保存原始目标路径，登录后跳转回来
      if (pathname !== '/') {
        loginUrl.searchParams.set('redirect', pathname);
      }

      return NextResponse.redirect(loginUrl);
    }

    // 2.5 为app域添加安全头
    const response = NextResponse.next();

    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    );
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
    );

    return response;
  }

  // 默认放行
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径除了:
     * - _next/static (静态文件)
     * - _next/image (图片优化)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
```

**关键实现说明**:

1. **Hostname检测**: 通过`request.headers.get('host')`获取域名
2. **双域名支持**: www域直接放行，app域执行认证检查
3. **开发环境兼容**: localhost通过查询参数`?app=true`区分
4. **Route Groups**: Next.js会自动处理`(www)`和`(app)`路由组，无需手动重写
5. **认证逻辑**: 仅在app域执行，保持与之前完全一致

### 3. 登录页实现

#### app.autoads.dev/app/login/page.tsx

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn({ email, password });

      if (result.success) {
        // 登录成功，跳转到目标页面
        router.push(redirectPath);
      } else {
        setError(result.error || '登录失败，请重试');
      }
    } catch (err) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-lg">
        {/* Logo */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">AutoAds</h1>
          <p className="mt-2 text-sm text-gray-600">
            登录您的账号，开始自动化广告投放
          </p>
        </div>

        {/* 错误提示 */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* 登录表单 */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="email">邮箱</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="your@email.com"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="mt-1"
            />
          </div>

          <div className="flex items-center justify-between">
            <a
              href="/forgot-password"
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              忘记密码？
            </a>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
            {loading ? '登录中...' : '登录'}
          </Button>
        </form>

        {/* 注册链接 */}
        <div className="text-center text-sm text-gray-600">
          还没有账号？
          <a
            href="/register"
            className="ml-1 text-blue-600 hover:text-blue-500 font-medium"
          >
            立即注册
          </a>
        </div>

        {/* Google OAuth（可选） */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">或</span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => {/* Google OAuth登录 */}}
        >
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
            {/* Google图标SVG */}
          </svg>
          使用Google账号登录
        </Button>
      </div>
    </div>
  );
}
```

### 4. 营销页CTA按钮实现

#### www.autoads.dev/app/page.tsx

```typescript
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="hero">
        <div className="container mx-auto px-4 py-20">
          <h1 className="text-6xl font-bold leading-tight text-center">
            告别手工投放<br/>
            拥抱<span className="text-gradient">AI自动化</span>
          </h1>

          <p className="text-2xl text-gray-600 mt-6 text-center">
            让Google Ads联盟营销像开关一样简单
          </p>

          <div className="flex justify-center gap-4 mt-10">
            {/* 主CTA - 跳转到应用系统登录页 */}
            <Button
              size="lg"
              className="text-lg px-8 py-6"
              asChild
            >
              <Link href="https://app.autoads.dev/login">
                立即开始 →
              </Link>
            </Button>

            {/* 次要CTA - 查看演示视频 */}
            <Button
              size="lg"
              variant="outline"
              className="text-lg px-8 py-6"
              asChild
            >
              <Link href="#demo-video">
                查看演示视频
              </Link>
            </Button>
          </div>

          {/* 信任标识 */}
          <div className="flex justify-center items-center gap-6 mt-8 text-sm text-gray-600">
            <span className="flex items-center gap-2">
              ✓ 14天免费试用
            </span>
            <span className="flex items-center gap-2">
              ✓ 无需信用卡
            </span>
            <span className="flex items-center gap-2">
              ✓ 随时取消
            </span>
          </div>
        </div>
      </section>

      {/* 其他Section... */}
    </div>
  );
}
```

### 5. 会话管理和Cookie配置

#### lib/auth.ts

```typescript
import { cookies } from 'next/headers';

// Cookie配置
const SESSION_COOKIE_NAME = 'session_token';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7天

export async function setSessionCookie(token: string) {
  cookies().set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: SESSION_MAX_AGE,
    path: '/',
    // 仅在app.autoads.dev域下有效
    domain: process.env.NODE_ENV === 'production'
      ? 'app.autoads.dev'
      : 'localhost',
  });
}

export async function clearSessionCookie() {
  cookies().delete(SESSION_COOKIE_NAME);
}

export async function getSessionToken() {
  return cookies().get(SESSION_COOKIE_NAME)?.value;
}

// 登录函数
export async function signIn({ email, password }: {
  email: string;
  password: string;
}) {
  try {
    const response = await fetch(`${process.env.API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok && data.token) {
      // 设置Cookie
      await setSessionCookie(data.token);

      return { success: true };
    } else {
      return {
        success: false,
        error: data.message || '登录失败'
      };
    }
  } catch (error) {
    return {
      success: false,
      error: '网络错误，请稍后重试'
    };
  }
}

// 登出函数
export async function signOut() {
  await clearSessionCookie();

  // 可选：调用后端API使token失效
  try {
    await fetch(`${process.env.API_BASE_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch (error) {
    // 忽略错误，即使API调用失败，也已清除客户端Cookie
  }
}
```

---

## 🚀 部署配置（单容器方案）

### 1. Vercel单项目多域名部署

#### vercel.json（统一配置）

```json
{
  "buildCommand": "npm run build",
  "framework": "nextjs",
  "regions": ["hkg1"],
  "env": {
    "NODE_ENV": "production",
    "DATABASE_URL": "@database_url",
    "JWT_SECRET": "@jwt_secret",
    "SESSION_SECRET": "@session_secret",
    "GOOGLE_ADS_CLIENT_ID": "@google_ads_client_id",
    "GOOGLE_ADS_CLIENT_SECRET": "@google_ads_client_secret",
    "GEMINI_API_KEY": "@gemini_api_key",
    "NEXT_PUBLIC_WWW_URL": "https://www.autoads.dev",
    "NEXT_PUBLIC_APP_URL": "https://app.autoads.dev"
  }
}
```

#### 域名配置（Vercel Dashboard）

**在Vercel项目设置中添加两个域名**:
1. **主域名**: `www.autoads.dev`
2. **应用域名**: `app.autoads.dev`

两个域名指向**同一个Vercel项目**，通过Middleware的hostname检测进行路由。

#### DNS配置

```bash
# 在您的DNS提供商（如Cloudflare）配置：

# www子域名
Type: CNAME
Name: www
Value: cname.vercel-dns.com
TTL: Auto

# app子域名
Type: CNAME
Name: app
Value: cname.vercel-dns.com
TTL: Auto

# 或者使用A记录（Vercel提供的IP）
Type: A
Name: www
Value: 76.76.21.21
TTL: Auto

Type: A
Name: app
Value: 76.76.21.21
TTL: Auto
```

**重要**: 两个域名指向同一个Vercel部署实例，通过Middleware区分。

### 2. 环境变量配置

#### .env.local（开发环境）

```bash
# 应用配置
NODE_ENV=development
NEXT_PUBLIC_WWW_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# 认证
JWT_SECRET=dev-jwt-secret-change-in-production
SESSION_SECRET=dev-session-secret-change-in-production

# 数据库（本地SQLite）
DATABASE_URL=file:./dev.db

# 第三方服务（开发环境可选）
GOOGLE_ADS_CLIENT_ID=your-dev-client-id
GOOGLE_ADS_CLIENT_SECRET=your-dev-client-secret
GEMINI_API_KEY=your-dev-gemini-key

# 分析（开发环境可选）
NEXT_PUBLIC_GA_ID=
NEXT_PUBLIC_MIXPANEL_TOKEN=
```

#### .env.production（生产环境 - Vercel环境变量）

```bash
# 应用配置
NODE_ENV=production
NEXT_PUBLIC_WWW_URL=https://www.autoads.dev
NEXT_PUBLIC_APP_URL=https://app.autoads.dev

# 认证（使用Vercel Secrets）
JWT_SECRET=@jwt_secret                    # 32字节随机字符串
SESSION_SECRET=@session_secret            # 32字节随机字符串

# 数据库（生产环境PostgreSQL）
DATABASE_URL=@database_url                # postgresql://user:pass@host:5432/dbname

# 加密密钥（用于敏感配置加密）
ENCRYPTION_KEY=@encryption_key            # 32字节随机字符串

# Google Ads API
GOOGLE_ADS_CLIENT_ID=@google_ads_client_id
GOOGLE_ADS_CLIENT_SECRET=@google_ads_client_secret
GOOGLE_ADS_DEVELOPER_TOKEN=@google_ads_developer_token

# Gemini API
GEMINI_API_KEY=@gemini_api_key

# Anthropic Claude API（可选，备用AI引擎）
ANTHROPIC_API_KEY=@anthropic_api_key

# 分析和监控
NEXT_PUBLIC_GA_ID=@ga_id                  # Google Analytics ID
NEXT_PUBLIC_MIXPANEL_TOKEN=@mixpanel_token
SENTRY_DSN=@sentry_dsn                    # 错误监控

# 支付（可选）
STRIPE_SECRET_KEY=@stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=@stripe_publishable_key
```

**设置Vercel Secrets**:
```bash
# 在Vercel CLI中设置敏感环境变量
vercel secrets add jwt_secret "your-32-byte-random-string"
vercel secrets add session_secret "your-32-byte-random-string"
vercel secrets add database_url "postgresql://..."
vercel secrets add gemini_api_key "your-gemini-api-key"
# ... 其他secrets
```

### 3. next.config.js（统一配置）

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // 生产环境优化
  reactStrictMode: true,
  swcMinify: true,

  // 图片优化
  images: {
    domains: [
      'www.autoads.dev',
      'app.autoads.dev',
      'lh3.googleusercontent.com', // Google OAuth头像
    ],
    formats: ['image/avif', 'image/webp'],
  },

  // 环境变量（客户端可访问）
  env: {
    NEXT_PUBLIC_WWW_URL: process.env.NEXT_PUBLIC_WWW_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },

  // 重定向规则
  async redirects() {
    return [
      // 主域名重定向到www
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'autoads.dev',
          },
        ],
        destination: 'https://www.autoads.dev/:path*',
        permanent: true,
      },
    ];
  },

  // 响应头（全局安全头由Middleware处理）
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },

  // 实验性功能
  experimental: {
    serverActions: true,
  },
};

module.exports = nextConfig;
```

---

## 📊 用户体验流程示例

### 场景1: 新用户首次访问

```
1. 用户访问 www.autoads.dev
   ├─ 浏览营销内容
   ├─ 观看产品演示视频
   ├─ 阅读定价方案
   └─ 决定试用

2. 点击 "立即开始" 按钮
   → 跳转到 app.autoads.dev/login

3. 未注册用户点击 "立即注册"
   → app.autoads.dev/register
   ├─ 填写邮箱、密码
   ├─ 同意服务条款
   └─ 提交注册

4. 注册成功
   → 自动登录
   → 设置Session Cookie
   → 跳转到 app.autoads.dev/dashboard

5. 进入Dashboard
   ├─ 显示欢迎引导
   ├─ 提示完成配置（Google Ads API、Gemini等）
   └─ 开始使用系统
```

### 场景2: 已注册用户再次访问

```
1. 用户直接访问 app.autoads.dev/offers
   ├─ Middleware检测到未登录
   └─ 重定向到 app.autoads.dev/login?redirect=/offers

2. 用户登录
   ├─ 输入邮箱、密码
   ├─ 验证成功
   └─ 设置Session Cookie

3. 登录成功后
   → 自动跳转回原目标页面
   → app.autoads.dev/offers（自动从redirect参数获取）
```

### 场景3: 用户从营销页返回应用

```
1. 已登录用户访问 www.autoads.dev（查看更新/博客）
   ├─ 浏览营销内容
   └─ 想回到应用系统

2. 点击导航栏 "进入应用" 或 "Dashboard"
   → app.autoads.dev/dashboard

3. 因为已有Session Cookie
   ├─ Middleware检测到已认证
   ├─ 跳过登录页
   └─ 直接进入Dashboard
```

---

## ⚠️ 注意事项和最佳实践

### 1. 跨域问题

**问题**: www.autoads.dev 和 app.autoads.dev 是不同域，无法共享Cookie

**解决方案**:
- ✅ 每个域独立管理自己的认证状态
- ✅ 营销页（www）不需要认证信息
- ✅ 应用系统（app）通过自己的Cookie管理会话
- ✅ 用户通过URL跳转完成域切换，不需要共享Cookie

### 2. SEO配置

#### www.autoads.dev/robots.txt
```
User-agent: *
Allow: /
Disallow: /api/

Sitemap: https://www.autoads.dev/sitemap.xml
```

#### app.autoads.dev/robots.txt
```
User-agent: *
Disallow: /

# 应用系统不需要被搜索引擎索引
# 所有页面都需要登录，对SEO无价值
```

### 3. CORS配置（如果app需要调用www的API）

```typescript
// app.autoads.dev/next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: 'https://www.autoads.dev',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },
    ];
  },
};
```

### 4. 性能监控

**www.autoads.dev**:
- Core Web Vitals (LCP, FID, CLS)
- 转化漏斗追踪
- CTA点击率

**app.autoads.dev**:
- 登录成功率
- 页面加载时间
- API响应时间
- 错误率

---

## 🎯 实施计划（单容器部署）

### Phase 1: 项目初始化（3天）

- [x] 确认域名架构方案（单容器Monorepo）
- [ ] 初始化Next.js项目
  ```bash
  npx create-next-app@latest autobb --typescript --tailwind --app
  cd autobb
  ```
- [ ] 配置Route Groups结构
  - 创建 `app/(www)/` 目录
  - 创建 `app/(app)/` 目录
  - 创建 `app/(auth)/` 目录
- [ ] 安装核心依赖
  ```bash
  npm install @shadcn/ui @radix-ui/react-* class-variance-authority clsx tailwind-merge
  npm install next-auth bcryptjs zod react-hook-form
  npm install -D @types/bcryptjs
  ```
- [ ] 配置环境变量（.env.local）

### Phase 2: Middleware和路由（2天）

- [ ] 实现Hostname路由Middleware
  - Hostname检测逻辑
  - www域直接放行
  - app域认证检查
- [ ] 测试开发环境路由
  - localhost → www内容
  - localhost?app=true → app内容
- [ ] 配置安全头
- [ ] 测试认证重定向逻辑

### Phase 3: 营销页面开发（2周）

- [ ] 按照LANDING_PAGE_DESIGN.md实现
  - Hero Section
  - 核心价值Section
  - 功能展示Section
  - 用户证言Section
  - 定价方案Section
  - FAQ Section
  - 最终CTA Section
- [ ] 组件开发
  - PricingCard（3个套餐）
  - FeatureCard（功能展示）
  - Testimonial（用户证言）
  - CTAButton（跳转到app.autoads.dev）
- [ ] SEO优化
  - Metadata配置
  - Sitemap生成
  - robots.txt
  - Structured Data（Schema.org）
- [ ] 性能优化
  - 图片优化（next/image）
  - 字体优化（next/font）
  - 代码分割
- [ ] 分析工具集成
  - Google Analytics 4
  - Mixpanel
  - Hotjar（可选）

### Phase 4: 认证系统开发（1周）

- [ ] 登录页面（app/(auth)/login）
  - 表单UI
  - 表单验证（Zod）
  - 登录API调用
  - 错误处理
  - Google OAuth（可选）
- [ ] 注册页面（app/(auth)/register）
- [ ] 忘记密码功能
- [ ] Session管理
  - Cookie配置
  - JWT生成和验证
  - Session持久化
- [ ] API路由
  - /api/auth/login
  - /api/auth/register
  - /api/auth/logout
  - /api/auth/session
- [ ] 测试认证流程
  - 单元测试
  - 集成测试

### Phase 5: 应用系统开发（3-4周）

- [ ] Dashboard布局
  - 侧边栏导航
  - 顶部导航栏
  - 用户头像菜单
- [ ] Dashboard首页
  - 欢迎引导
  - 配置状态检查
  - 快速操作入口
- [ ] Offers管理
- [ ] Campaigns管理
- [ ] Analytics展示
- [ ] Settings配置
- [ ] 按照现有设计文档实现核心功能

### Phase 6: 集成测试（1周）

- [ ] 端到端测试
  - 营销页 → 登录 → Dashboard流程
  - 未登录访问app域自动跳转
  - 已登录访问auth页面自动跳转Dashboard
  - Redirect参数正确传递和使用
- [ ] 跨域测试
  - www → app跳转
  - Cookie正确设置和读取
  - Session正确维持
- [ ] 跨浏览器测试
  - Chrome
  - Firefox
  - Safari
  - Edge
- [ ] 移动端测试
  - 响应式布局
  - 触摸交互
  - 移动端性能
- [ ] 性能测试
  - Lighthouse CI
  - Core Web Vitals
  - 负载测试（可选）

### Phase 7: 部署配置（3天）

- [ ] Vercel项目创建
  - 连接GitHub仓库
  - 配置构建设置
- [ ] 环境变量配置
  - 在Vercel Dashboard设置所有Secrets
  - 验证环境变量正确加载
- [ ] 域名配置
  - 在Vercel添加www.autoads.dev
  - 在Vercel添加app.autoads.dev
  - 配置DNS记录（CNAME或A记录）
  - 等待DNS传播
  - 验证SSL证书自动配置
- [ ] 测试生产环境
  - 访问www.autoads.dev验证营销页
  - 访问app.autoads.dev验证应用系统
  - 测试认证流程
  - 测试hostname路由

### Phase 8: 监控和优化（持续）

- [ ] 错误监控
  - Sentry集成
  - 错误告警配置
- [ ] 性能监控
  - Vercel Analytics
  - Core Web Vitals监控
- [ ] 用户行为分析
  - GA4转化漏斗
  - Mixpanel用户路径
- [ ] A/B测试（可选）
  - 定价页面测试
  - CTA按钮文案测试
- [ ] 用户反馈收集
  - 反馈表单
  - 用户访谈

**总工作量**: 6-7周

### 快速开发技巧

**并行开发**:
- 营销页面和应用系统可以并行开发
- UI组件可以提前开发并共享

**复用现有设计**:
- LANDING_PAGE_DESIGN.md已提供完整营销页文案和结构
- SETTINGS_PAGE_DESIGN.md等已提供应用系统设计
- CONFIGURATION_AUDIT.md已明确所有配置项

**开发优先级**:
1. **先完成基础架构**（Middleware + Route Groups）→ 确保路由正确
2. **再开发认证系统** → 确保安全访问控制
3. **最后并行开发** 营销页 + 应用功能

---

## 📚 参考资源

- [Next.js Authentication Patterns](https://nextjs.org/docs/authentication)
- [Vercel Multi-Project Monorepo](https://vercel.com/docs/monorepos)
- [Cookie Security Best Practices](https://owasp.org/www-community/controls/SecureCookieAttribute)
- [Cross-Domain Authentication](https://auth0.com/docs/authenticate/login/cross-origin-authentication)

---

**文档版本**: 1.0
**最后更新**: 2025-01-18
**维护者**: AutoAds技术团队
