# 部署指南 (Deployment Guide)

## 文档概述

本文档详细说明AutoAds系统基于Docker容器化的完整部署流程，包括GitHub Actions自动构建、ClawCloud平台部署、环境配置和运维操作指南。

---

## 一、部署架构

### 1.1 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Repository                         │
│  ┌────────────────────────────────────────────────────┐     │
│  │  main分支（唯一分支）                              │     │
│  │  - 推送代码 → 触发GitHub Actions                   │     │
│  │  - 打tag → 触发版本发布构建                        │     │
│  └────────────────────┬───────────────────────────────┘     │
└────────────────────────┼───────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  GitHub Actions                              │
│  ┌──────────────────────────────────────────────────┐       │
│  │  1. Lint & TypeCheck                             │       │
│  │  2. Unit Tests                                   │       │
│  │  3. Build Next.js                                │       │
│  │  4. Build Docker Image                           │       │
│  │  5. Tag & Push to Registry                       │       │
│  │     - prod-latest (最新版本)                     │       │
│  │     - prod-[commitid] (Git commit SHA)           │       │
│  │     - prod-[tag] (Git tag如v3.0.0)               │       │
│  └──────────────────────┬───────────────────────────┘       │
└─────────────────────────┼───────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                   Docker Registry                            │
│  (GitHub Container Registry - ghcr.io)                       │
│  ┌────────────────────────────────────────────────┐         │
│  │  ghcr.io/your-org/autoads:prod-latest          │         │
│  │  ghcr.io/your-org/autoads:prod-abc123def       │         │
│  │  ghcr.io/your-org/autoads:prod-v3.0.0          │         │
│  └────────────────────────────────────────────────┘         │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                    ClawCloud Platform                        │
│  ┌────────────────────────────────────────────────┐         │
│  │  手动拉取镜像并部署                            │         │
│  │  $ docker pull ghcr.io/your-org/autoads:prod-latest    │
│  │  $ docker run -d -p 3000:3000 ...              │         │
│  └────────────────────────────────────────────────┘         │
│                                                              │
│  ┌────────────────────────────────────────────────┐         │
│  │  Next.js Container (Port 3000)                 │         │
│  │  - Serverless Functions                        │         │
│  │  - Static Assets                               │         │
│  └────────────────────────────────────────────────┘         │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│              Client Browser (User Device)                    │
│  ┌────────────────────────────────────────────────────┐     │
│  │ IndexedDB (Local Storage)                          │     │
│  │  - Google Ads账号信息 + 加密Token                  │     │
│  │  - Offers数据                                      │     │
│  │  - Campaign性能数据（90天）                        │     │
│  │  - 创意版本历史                                    │     │
│  └────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 技术栈

| 组件 | 技术 | 版本 |
|------|------|------|
| **前端框架** | Next.js (App Router) | 14.0+ |
| **UI组件** | Shadcn/ui + Radix UI | Latest |
| **样式** | Tailwind CSS | 3.4+ |
| **状态管理** | Zustand | 4.4+ |
| **数据获取** | TanStack Query | 5.0+ |
| **本地存储** | IndexedDB (idb库) | 8.0+ |
| **容器化** | Docker | 24.0+ |
| **CI/CD** | GitHub Actions | Latest |
| **部署平台** | ClawCloud | Latest |
| **Runtime** | Node.js | 18.x |

---

## 二、环境准备

### 2.1 必需账号

#### 2.1.1 GitHub账号
1. 访问 https://github.com
2. 创建组织账号（推荐）或使用个人账号
3. 创建代码仓库：`autoads`

#### 2.1.2 GitHub Container Registry
1. 启用GitHub Packages
2. 创建Personal Access Token (PAT)
   - 访问 Settings → Developer settings → Personal access tokens → Tokens (classic)
   - 生成新token，权限选择：
     - ✅ `write:packages` (上传Docker镜像)
     - ✅ `read:packages` (下载Docker镜像)
     - ✅ `delete:packages` (删除旧镜像)
   - 复制并保存Token

#### 2.1.3 ClawCloud账号
1. 访问ClawCloud平台
2. 创建账号并完成认证
3. 创建项目/应用

#### 2.1.4 Google Cloud Platform
1. 访问 https://console.cloud.google.com/
2. 创建新项目：`autoads-production`
3. 启用以下API：
   - Google Ads API
   - OAuth 2.0

#### 2.1.5 Google Ads API
1. 访问 https://developers.google.com/google-ads/api
2. 申请Developer Token
   - 测试环境：立即获得Test Account Token
   - 生产环境：申请Standard Access（需审核3-5个工作日）

#### 2.1.6 AI API

**Gemini 2.5 API**:
1. 访问 https://ai.google.dev/
2. 获取API Key
3. 模型：`gemini-2.0-flash-exp` 或 `gemini-2.5-pro-preview`
4. 计费：免费配额60 requests/min，超出后按Token计费

**Claude 4.5 API**:
1. 访问 https://console.anthropic.com/
2. 获取API Key
3. 模型：`claude-sonnet-4-5-20250929`
4. 计费方式：按Token计费

### 2.2 环境变量配置

创建`.env.local`文件（开发环境）和`.env.production`（生产环境）：

```bash
# ===== Google Ads API =====
GOOGLE_ADS_DEVELOPER_TOKEN=your_developer_token_here
GOOGLE_ADS_CLIENT_ID=your_oauth_client_id.apps.googleusercontent.com
GOOGLE_ADS_CLIENT_SECRET=your_oauth_client_secret

# ===== Gemini 2.5 API =====
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.0-flash-exp
# 或使用更强大的模型（成本更高）
# GEMINI_MODEL=gemini-2.5-pro-preview

# ===== Claude 4.5 API =====
ANTHROPIC_API_KEY=sk-ant-your_api_key_here
ANTHROPIC_MODEL=claude-sonnet-4-5-20250929

# ===== 前端公开变量（NEXT_PUBLIC_前缀）=====
NEXT_PUBLIC_GOOGLE_OAUTH_REDIRECT_URI=https://yourdomain.com/api/oauth/callback
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# ===== 安全配置 =====
NEXTAUTH_SECRET=your_random_secret_string_here  # 生成: openssl rand -base64 32
NEXTAUTH_URL=https://yourdomain.com

# ===== Node环境 =====
NODE_ENV=production

# ===== 可选：监控和分析 =====
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX  # Google Analytics
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx  # Sentry错误追踪
```

---

## 三、Docker容器化

### 3.1 Dockerfile

创建项目根目录的`Dockerfile`：

```dockerfile
# ===== Stage 1: Dependencies =====
FROM node:18-alpine AS deps
WORKDIR /app

# 安装依赖
COPY package.json package-lock.json ./
RUN npm ci --only=production

# ===== Stage 2: Builder =====
FROM node:18-alpine AS builder
WORKDIR /app

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 设置环境变量（构建时需要）
ARG NEXT_PUBLIC_GOOGLE_OAUTH_REDIRECT_URI
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_GOOGLE_OAUTH_REDIRECT_URI=$NEXT_PUBLIC_GOOGLE_OAUTH_REDIRECT_URI
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_TELEMETRY_DISABLED=1

# 构建Next.js应用
RUN npm run build

# ===== Stage 3: Runner =====
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 创建非root用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 复制构建产物
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 切换到非root用户
USER nextjs

# 暴露端口
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 启动应用
CMD ["node", "server.js"]
```

### 3.2 .dockerignore

创建`.dockerignore`文件：

```
# 依赖
node_modules
npm-debug.log*

# Next.js
.next
out
build

# 环境变量
.env*.local
.env.production

# Git
.git
.gitignore

# IDE
.vscode
.idea
*.swp
*.swo

# 测试
coverage
.nyc_output
playwright-report

# 文档
docs
README.md
*.md

# CI/CD
.github

# 其他
.DS_Store
Thumbs.db
```

### 3.3 next.config.js 配置

更新`next.config.js`以支持standalone输出：

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // 启用standalone输出（Docker优化）
  output: 'standalone',

  // 图片优化配置
  images: {
    domains: ['googleads.google.com'],
    unoptimized: process.env.NODE_ENV === 'development',
  },

  // 环境变量
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_GOOGLE_OAUTH_REDIRECT_URI: process.env.NEXT_PUBLIC_GOOGLE_OAUTH_REDIRECT_URI,
  },

  // 生产环境优化
  productionBrowserSourceMaps: false,
  poweredByHeader: false,

  // 安全头
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          }
        ]
      }
    ];
  },
};

module.exports = nextConfig;
```

### 3.4 本地测试Docker构建

```bash
# 构建镜像
docker build -t autoads:local \
  --build-arg NEXT_PUBLIC_GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/oauth/callback \
  --build-arg NEXT_PUBLIC_APP_URL=http://localhost:3000 \
  .

# 运行容器
docker run -d \
  --name autoads-local \
  -p 3000:3000 \
  --env-file .env.local \
  autoads:local

# 查看日志
docker logs -f autoads-local

# 访问应用
open http://localhost:3000

# 停止并删除容器
docker stop autoads-local
docker rm autoads-local
```

---

## 四、GitHub Actions CI/CD

### 4.1 工作流配置

创建`.github/workflows/docker-build.yml`：

```yaml
name: Docker Build and Push

on:
  push:
    branches:
      - main
    tags:
      - 'v*.*.*'

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run Lint
        run: npm run lint

      - name: Run TypeCheck
        run: npm run type-check

      - name: Run Unit Tests
        run: npm run test:unit -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          fail_ci_if_error: false

  build-and-push:
    needs: lint-and-test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch,prefix=prod-,suffix=-{{sha}}
            type=ref,event=tag,prefix=prod-
            type=raw,value=prod-latest,enable={{is_default_branch}}

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          build-args: |
            NEXT_PUBLIC_GOOGLE_OAUTH_REDIRECT_URI=${{ secrets.NEXT_PUBLIC_GOOGLE_OAUTH_REDIRECT_URI }}
            NEXT_PUBLIC_APP_URL=${{ secrets.NEXT_PUBLIC_APP_URL }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Image digest
        run: echo ${{ steps.meta.outputs.digest }}

  notify:
    needs: build-and-push
    runs-on: ubuntu-latest
    if: always()
    steps:
      - name: Deployment notification
        run: |
          echo "✅ Docker镜像构建完成！"
          echo "镜像标签："
          echo "- prod-latest"
          echo "- prod-${{ github.sha }}"
          if [[ "${{ github.ref }}" == refs/tags/* ]]; then
            echo "- prod-${{ github.ref_name }}"
          fi
          echo ""
          echo "📦 拉取镜像："
          echo "docker pull ghcr.io/${{ github.repository }}:prod-latest"
          echo ""
          echo "🚀 请在ClawCloud手动部署"
```

### 4.2 镜像标签策略

| 触发条件 | 镜像标签 | 示例 |
|---------|---------|------|
| **推送到main分支** | `prod-latest`<br>`prod-<commitid>` | `prod-latest`<br>`prod-abc123def` |
| **打tag** | `prod-<tag>`<br>`prod-<commitid>`<br>`prod-latest` | `prod-v3.0.0`<br>`prod-abc123def`<br>`prod-latest` |

**标签说明**：
- `prod-latest`：始终指向main分支最新版本（用于快速部署）
- `prod-<commitid>`：Git commit SHA（可追溯到具体代码版本）
- `prod-<tag>`：版本发布标签（如v3.0.0，用于稳定版本）

### 4.3 GitHub Secrets配置

在GitHub仓库设置中添加以下Secrets：

```
Settings → Secrets and variables → Actions → New repository secret
```

必需的Secrets：

```
NEXT_PUBLIC_GOOGLE_OAUTH_REDIRECT_URI = https://yourdomain.com/api/oauth/callback
NEXT_PUBLIC_APP_URL = https://yourdomain.com
```

可选的Secrets（用于测试）：

```
CODECOV_TOKEN = [从Codecov获取]
```

### 4.4 分支策略

**重要**：只使用`main`分支，不创建其他分支。

**工作流程**：
```
开发 → 本地测试 → 推送到main → 自动构建镜像 → 手动部署到ClawCloud
```

**版本发布流程**：
```bash
# 完成功能开发
git add .
git commit -m "feat: add new feature"
git push origin main

# 等待GitHub Actions构建完成

# 测试通过后打tag发布
git tag -a v3.0.0 -m "Release v3.0.0"
git push origin v3.0.0

# 自动触发版本镜像构建
# 镜像标签：prod-v3.0.0, prod-abc123def, prod-latest
```

---

## 五、ClawCloud部署

### 5.1 首次部署

#### Step 1: 登录ClawCloud

```bash
# SSH连接到ClawCloud服务器
ssh user@your-clawcloud-server.com
```

#### Step 2: 登录GitHub Container Registry

```bash
# 使用GitHub Personal Access Token登录
echo $GITHUB_PAT | docker login ghcr.io -u your-github-username --password-stdin
```

#### Step 3: 拉取Docker镜像

```bash
# 拉取最新镜像
docker pull ghcr.io/your-org/autoads:prod-latest

# 或拉取特定版本
docker pull ghcr.io/your-org/autoads:prod-v3.0.0
```

#### Step 4: 创建环境变量文件

```bash
# 在服务器创建.env.production文件
cat > /opt/autoads/.env.production << 'EOF'
GOOGLE_ADS_DEVELOPER_TOKEN=your_token
GOOGLE_ADS_CLIENT_ID=your_client_id
GOOGLE_ADS_CLIENT_SECRET=your_secret
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-2.0-flash-exp
ANTHROPIC_API_KEY=your_claude_key
ANTHROPIC_MODEL=claude-sonnet-4-5-20250929
NEXT_PUBLIC_GOOGLE_OAUTH_REDIRECT_URI=https://yourdomain.com/api/oauth/callback
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXTAUTH_SECRET=your_secret
NEXTAUTH_URL=https://yourdomain.com
NODE_ENV=production
EOF

# 设置文件权限
chmod 600 /opt/autoads/.env.production
```

#### Step 5: 启动容器

```bash
# 创建并启动容器
docker run -d \
  --name autoads-prod \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file /opt/autoads/.env.production \
  --health-cmd="curl -f http://localhost:3000/api/health || exit 1" \
  --health-interval=30s \
  --health-timeout=10s \
  --health-retries=3 \
  ghcr.io/your-org/autoads:prod-latest

# 查看日志确认启动成功
docker logs -f autoads-prod
```

#### Step 6: 配置反向代理（Nginx）

```nginx
# /etc/nginx/sites-available/autoads
server {
    listen 80;
    server_name yourdomain.com;

    # 重定向到HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # SSL证书配置
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # SSL优化
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # 安全头
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;

    # 反向代理到Docker容器
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 90s;
    }

    # 静态资源缓存
    location /_next/static {
        proxy_pass http://localhost:3000;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # 健康检查
    location /api/health {
        proxy_pass http://localhost:3000;
        access_log off;
    }
}
```

```bash
# 启用配置
sudo ln -s /etc/nginx/sites-available/autoads /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### Step 7: 配置SSL证书（Let's Encrypt）

```bash
# 安装Certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# 获取SSL证书
sudo certbot --nginx -d yourdomain.com

# 自动续期（已自动配置）
sudo certbot renew --dry-run
```

### 5.2 更新部署

```bash
# 1. 拉取最新镜像
docker pull ghcr.io/your-org/autoads:prod-latest

# 2. 停止旧容器
docker stop autoads-prod

# 3. 删除旧容器
docker rm autoads-prod

# 4. 启动新容器（使用新镜像）
docker run -d \
  --name autoads-prod \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file /opt/autoads/.env.production \
  --health-cmd="curl -f http://localhost:3000/api/health || exit 1" \
  --health-interval=30s \
  --health-timeout=10s \
  --health-retries=3 \
  ghcr.io/your-org/autoads:prod-latest

# 5. 验证新版本
docker logs -f autoads-prod
curl -I https://yourdomain.com/api/health
```

### 5.3 部署脚本

创建`deploy.sh`脚本自动化部署：

```bash
#!/bin/bash
set -e

IMAGE_NAME="ghcr.io/your-org/autoads:prod-latest"
CONTAINER_NAME="autoads-prod"
ENV_FILE="/opt/autoads/.env.production"

echo "🚀 开始部署AutoAds..."

# 1. 拉取最新镜像
echo "📦 拉取Docker镜像..."
docker pull $IMAGE_NAME

# 2. 停止并删除旧容器
if [ "$(docker ps -q -f name=$CONTAINER_NAME)" ]; then
    echo "🛑 停止旧容器..."
    docker stop $CONTAINER_NAME
fi

if [ "$(docker ps -aq -f name=$CONTAINER_NAME)" ]; then
    echo "🗑️  删除旧容器..."
    docker rm $CONTAINER_NAME
fi

# 3. 启动新容器
echo "🎬 启动新容器..."
docker run -d \
  --name $CONTAINER_NAME \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file $ENV_FILE \
  --health-cmd="curl -f http://localhost:3000/api/health || exit 1" \
  --health-interval=30s \
  --health-timeout=10s \
  --health-retries=3 \
  $IMAGE_NAME

# 4. 等待健康检查
echo "⏳ 等待应用启动..."
sleep 10

# 5. 验证部署
if [ "$(docker ps -q -f name=$CONTAINER_NAME -f health=healthy)" ]; then
    echo "✅ 部署成功！"
    echo "📊 容器状态："
    docker ps -f name=$CONTAINER_NAME
    echo ""
    echo "📝 查看日志："
    echo "docker logs -f $CONTAINER_NAME"
else
    echo "❌ 部署失败！查看日志："
    docker logs $CONTAINER_NAME
    exit 1
fi

# 6. 清理旧镜像
echo "🧹 清理旧镜像..."
docker image prune -f

echo "🎉 部署完成！"
```

使用方式：

```bash
# 赋予执行权限
chmod +x deploy.sh

# 执行部署
./deploy.sh
```

---

## 六、监控和日志

### 6.1 健康检查端点

创建`app/api/health/route.ts`：

```typescript
// app/api/health/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  };

  return NextResponse.json(health, { status: 200 });
}
```

测试健康检查：

```bash
curl https://yourdomain.com/api/health
```

### 6.2 Docker日志管理

```bash
# 查看实时日志
docker logs -f autoads-prod

# 查看最近100行日志
docker logs --tail 100 autoads-prod

# 查看特定时间的日志
docker logs --since 2024-01-01T00:00:00 autoads-prod

# 导出日志到文件
docker logs autoads-prod > /var/log/autoads/app.log 2>&1
```

配置日志轮转（`/etc/logrotate.d/docker-autoads`）：

```
/var/log/autoads/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0640 root root
}
```

### 6.3 系统监控

使用`docker stats`监控资源使用：

```bash
# 实时监控
docker stats autoads-prod

# 输出示例：
# CONTAINER ID   NAME          CPU %   MEM USAGE / LIMIT   MEM %   NET I/O
# abc123def456   autoads-prod  0.50%   256MB / 2GB        12.8%   1.5GB / 500MB
```

### 6.4 错误追踪（Sentry集成）

安装Sentry（已在依赖中）：

```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

配置`sentry.client.config.ts`：

```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === 'production',
});
```

---

## 七、安全加固

### 7.1 环境变量安全

```bash
# 加密环境变量文件
openssl enc -aes-256-cbc -salt -in .env.production -out .env.production.enc

# 解密
openssl enc -aes-256-cbc -d -in .env.production.enc -out .env.production

# 设置严格权限
chmod 600 .env.production
chown root:root .env.production
```

### 7.2 Docker安全

```bash
# 以非root用户运行（已在Dockerfile配置）
# 禁用不必要的capabilities
docker run -d \
  --name autoads-prod \
  --cap-drop=ALL \
  --cap-add=NET_BIND_SERVICE \
  --read-only \
  --tmpfs /tmp \
  ...
```

### 7.3 定期更新

```bash
# 每月检查依赖更新
npm outdated

# 更新依赖
npm update

# 安全审计
npm audit
npm audit fix
```

---

## 八、故障恢复

### 8.1 快速回滚

```bash
# 回滚到特定版本
docker pull ghcr.io/your-org/autoads:prod-v2.9.0

# 停止当前容器
docker stop autoads-prod
docker rm autoads-prod

# 启动旧版本
docker run -d \
  --name autoads-prod \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file /opt/autoads/.env.production \
  ghcr.io/your-org/autoads:prod-v2.9.0

# 验证
docker logs -f autoads-prod
```

### 8.2 数据备份

虽然数据存储在用户浏览器，但需备份配置：

```bash
# 备份环境变量
cp /opt/autoads/.env.production /opt/autoads/backup/.env.production.$(date +%Y%m%d)

# 备份Nginx配置
cp /etc/nginx/sites-available/autoads /opt/autoads/backup/nginx.conf.$(date +%Y%m%d)

# 定期备份脚本
0 2 * * * /opt/autoads/scripts/backup.sh
```

### 8.3 应急预案

```
1. 检测故障
   ├─ 健康检查失败 (curl /api/health)
   ├─ 容器状态异常 (docker ps)
   └─ 用户反馈

2. 评估影响
   ├─ 影响范围（部分功能 vs 全站）
   ├─ 用户数量
   └─ 业务影响

3. 快速响应
   ├─ 如果是代码问题 → 回滚到稳定版本
   ├─ 如果是容器崩溃 → 重启容器
   └─ 如果是资源不足 → 扩容服务器

4. 根本修复
   ├─ 定位问题根因
   ├─ 修复并测试
   └─ 发布修复版本

5. 事后总结
   ├─ 记录故障原因
   ├─ 改进监控告警
   └─ 更新应急预案
```

---

## 九、性能优化

### 9.1 Docker镜像优化

**当前镜像大小**：~200MB（多阶段构建后）

**优化技巧**：
1. 使用alpine基础镜像（已使用）
2. 多阶段构建（已使用）
3. 仅复制必需文件
4. 利用layer缓存

### 9.2 启用Gzip压缩

Nginx配置：

```nginx
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 6;
gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;
```

### 9.3 CDN加速

可选择使用CloudFlare CDN加速静态资源：

1. 将域名DNS指向CloudFlare
2. 启用CDN代理
3. 配置缓存规则

---

## 十、部署检查清单

### 10.1 首次部署前检查

**代码准备**：
- [ ] 所有测试通过
- [ ] Lint检查通过
- [ ] TypeScript类型检查通过
- [ ] 本地Docker构建成功

**环境配置**：
- [ ] 所有环境变量已配置
- [ ] GitHub Secrets已添加
- [ ] ClawCloud服务器已准备
- [ ] 域名DNS已配置

**安全配置**：
- [ ] SSL证书已配置
- [ ] Nginx反向代理已配置
- [ ] 防火墙规则已设置
- [ ] 环境变量文件权限正确（600）

**监控配置**：
- [ ] 健康检查端点可访问
- [ ] 日志轮转已配置
- [ ] Sentry错误追踪已配置

### 10.2 部署后验证

```bash
# 1. 健康检查
curl https://yourdomain.com/api/health

# 2. 容器状态
docker ps -f name=autoads-prod

# 3. 日志检查
docker logs --tail 50 autoads-prod

# 4. 资源使用
docker stats --no-stream autoads-prod

# 5. 端到端测试
# 访问应用执行关键流程
```

---

## 十一、成本优化

### 11.1 ClawCloud资源

**推荐配置**：
- CPU: 2核
- 内存: 2GB
- 存储: 20GB SSD
- 带宽: 5Mbps

**预估成本**：~¥200/月（具体以ClawCloud定价为准）

### 11.2 AI API成本

| API | 计费方式 | 预估成本（1000次生成/月） |
|-----|---------|--------------------------|
| **Gemini 2.0 Flash** | $0.075 / 1M input tokens<br>$0.30 / 1M output tokens | ~$30/月 |
| **Claude 4.5 Sonnet** | $3 / 1M input tokens<br>$15 / 1M output tokens | ~$60/月（备选） |

**优化策略**：
- 优先使用Gemini（成本更低）
- Claude作为备选（质量更高）
- 缓存生成结果（减少重复调用）

### 11.3 总成本估算

| 项目 | 月成本 |
|------|--------|
| ClawCloud服务器 | ~¥200 |
| Gemini API | ~¥220 |
| Claude API（备选） | ~¥440（按需） |
| 域名 + SSL | ~¥10 |
| **总计** | **~¥430 - ¥870/月** |

---

## 十二、常见问题

### Q1: GitHub Actions构建失败

**原因**：依赖安装失败或环境变量缺失

**解决**：
1. 检查GitHub Secrets配置
2. 查看Actions日志
3. 本地复现构建：`docker build -t test .`

### Q2: 容器启动后立即退出

**原因**：环境变量配置错误或端口冲突

**解决**：
```bash
# 查看日志
docker logs autoads-prod

# 检查端口占用
netstat -tlnp | grep 3000

# 测试环境变量
docker run --rm --env-file .env.production alpine env
```

### Q3: 镜像拉取失败

**原因**：未登录GitHub Container Registry或权限不足

**解决**：
```bash
# 重新登录
echo $GITHUB_PAT | docker login ghcr.io -u username --password-stdin

# 验证权限
docker pull ghcr.io/your-org/autoads:prod-latest
```

### Q4: Nginx 502 Bad Gateway

**原因**：容器未启动或端口映射错误

**解决**：
```bash
# 检查容器状态
docker ps -a

# 检查端口映射
docker port autoads-prod

# 测试容器内服务
curl http://localhost:3000/api/health
```

---

## 总结

本部署指南覆盖了AutoAds系统基于Docker容器化的完整部署流程：

1. **Docker容器化**：多阶段构建、优化镜像大小
2. **GitHub Actions CI/CD**：自动测试、构建、推送镜像
3. **镜像标签策略**：prod-latest、prod-commitid、prod-tag
4. **ClawCloud部署**：手动拉取镜像并部署
5. **监控运维**：健康检查、日志管理、性能监控
6. **安全加固**：环境变量加密、Docker安全、SSL配置
7. **故障恢复**：快速回滚、数据备份、应急预案

关键成功因素：
- ✅ 自动化CI/CD流程
- ✅ 完善的监控和日志
- ✅ 清晰的部署文档和脚本
- ✅ 快速的故障恢复能力
