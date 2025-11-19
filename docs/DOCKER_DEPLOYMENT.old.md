# AutoAds Docker部署指南

**版本**: 2.0 (集成Supervisord)
**更新时间**: 2025-11-19
**部署架构**: Monorepo单容器多服务

---

## 📦 架构概览

AutoAds采用**Monorepo单容器部署架构**，所有服务运行在同一个容器中，由supervisord统一管理：

```
Docker容器（单容器，对外端口3000）
├── Supervisord (进程管理器)
    ├── autoads-web (Next.js应用, 端口3000)
    └── autoads-scheduler (定时任务调度器)
        ├── 数据同步 (每6小时: 0, 6, 12, 18点)
        ├── 数据库备份 (每天凌晨2点)
        └── 数据清理 (每天凌晨3点)
```

**核心特性**：
- ✅ **单容器多服务**: 所有服务在同一容器，统一管理
- ✅ **自动重启**: 进程崩溃自动恢复
- ✅ **集中日志**: 所有日志统一收集
- ✅ **健康检查**: 内置 `/api/health` 端点
- ✅ **镜像优化**: < 300MB (Next.js standalone + supervisord)

---

## 🚀 部署流程

### 1. 本地构建镜像

```bash
# 1. 构建生产镜像
docker build -t autoads:latest -f Dockerfile .

# 2. 查看镜像大小
docker images autoads

# 预期输出：
# REPOSITORY   TAG      SIZE
# autoads      latest   ~280MB
```

### 2. 运行容器

```bash
# 创建环境变量文件
cat > .env << 'EOF'
# Gemini AI
GEMINI_API_KEY=your_api_key_here

# Google Ads API
GOOGLE_ADS_CLIENT_ID=your_client_id
GOOGLE_ADS_CLIENT_SECRET=your_client_secret
GOOGLE_ADS_DEVELOPER_TOKEN=your_developer_token
GOOGLE_ADS_LOGIN_CUSTOMER_ID=1234567890

# 应用URL
NEXT_PUBLIC_APP_URL=https://autoads.dev
EOF

# 运行容器
docker run -d \
  --name autoads-app \
  --restart unless-stopped \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  --env-file .env \
  autoads:latest

# 查看日志
docker logs -f autoads-app
```

### 3. 生产环境部署（GitHub Actions）

```bash
# 推送代码到GitHub main分支
git add .
git commit -m "feat: 新功能"
git push origin main

# GitHub Actions自动构建镜像：
# - 镜像标签: prod-latest, prod-[commitid]

# 在生产服务器拉取镜像
docker pull ghcr.io/your-org/autoads:prod-latest

# 运行容器
docker run -d \
  --name autoads-app \
  --restart unless-stopped \
  -p 3000:3000 \
  -v /data/autoads:/app/data \
  -v /logs/autoads:/app/logs \
  --env-file /etc/autoads/.env \
  ghcr.io/your-org/autoads:prod-latest
```

---

## 📊 容器管理

### 查看所有服务状态

```bash
# 进入容器
docker exec -it autoads-app sh

# 查看supervisord管理的所有服务
supervisorctl status

# 输出示例：
# autoads-scheduler         RUNNING   pid 15, uptime 0:05:23
# autoads-web               RUNNING   pid 14, uptime 0:05:23
```

### 重启服务

```bash
# 重启Web应用
supervisorctl restart autoads-web

# 重启调度器
supervisorctl restart autoads-scheduler

# 重启所有服务
supervisorctl restart all
```

### 查看日志

```bash
# 实时查看Web应用日志
supervisorctl tail -f autoads-web

# 实时查看调度器日志
supervisorctl tail -f autoads-scheduler

# 或直接查看日志文件
tail -f /app/logs/web-output.log
tail -f /app/logs/scheduler-output.log
tail -f /app/logs/web-error.log
tail -f /app/logs/scheduler-error.log
```

---

## 📁 目录结构

```
/app/                          # 容器内应用根目录
├── server.js                  # Next.js服务器
├── src/
│   ├── scheduler.ts           # 定时任务调度器
│   └── lib/                   # 共享库
├── supervisord.conf           # Supervisord配置
├── data/                      # 持久化数据目录
│   ├── database.db            # SQLite数据库
│   └── backups/               # 数据库备份
├── logs/                      # 日志目录
│   ├── supervisord.log        # Supervisord日志
│   ├── web-output.log         # Web应用标准输出
│   ├── web-error.log          # Web应用错误输出
│   ├── scheduler-output.log   # 调度器标准输出
│   └── scheduler-error.log    # 调度器错误输出
└── tmp/                       # 临时文件
    ├── supervisord.pid        # Supervisord PID
    └── supervisor.sock        # Supervisord socket
```

---

## 🔍 健康检查

Docker Compose配置中包含健康检查：

```yaml
healthcheck:
  test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/api/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

**手动测试健康检查**：

```bash
# 容器内测试
wget -q -O- http://localhost:3000/api/health

# 宿主机测试
curl http://localhost:3000/api/health

# 正常响应：
{
  "status": "healthy",
  "timestamp": "2025-11-19T10:00:00.000Z",
  "checks": {
    "database": "ok",
    "server": "ok"
  }
}
```

---

## 🗄️ 数据持久化

### 数据库备份

调度器会自动备份数据库（每天凌晨2点）：

```bash
# 查看备份文件
docker exec -it autoads-app ls -lh /app/data/backups/

# 输出示例：
# -rw-r--r-- 1 nextjs nodejs 2.5M Nov 19 02:00 database_20251119_020000.db
# -rw-r--r-- 1 nextjs nodejs 2.4M Nov 18 02:00 database_20251118_020000.db
```

### 手动备份

```bash
# 方法1: 复制数据库文件
docker cp autoads-app:/app/data/database.db ./backup_$(date +%Y%m%d).db

# 方法2: 使用Docker卷备份
docker run --rm \
  -v autoads_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/data-backup-$(date +%Y%m%d).tar.gz -C /data .
```

### 恢复备份

```bash
# 停止容器
docker-compose down

# 恢复数据库文件
cp backup_20251119.db ./data/database.db

# 重启容器
docker-compose up -d
```

---

## 🛠️ 故障排查

### 问题1: 容器启动失败

```bash
# 查看容器日志
docker logs autoads-app

# 查看supervisord日志
docker exec -it autoads-app cat /app/logs/supervisord.log
```

**常见原因**：
- 环境变量缺失（检查.env文件）
- 端口被占用（修改docker-compose.yml中的端口映射）
- 数据库文件损坏（恢复备份）

### 问题2: Web应用无法访问

```bash
# 检查服务状态
docker exec -it autoads-app supervisorctl status

# 查看Web应用日志
docker exec -it autoads-app supervisorctl tail autoads-web
```

**常见原因**：
- Web进程崩溃（自动重启，查看错误日志）
- 端口映射错误（检查docker-compose.yml）
- 网络问题（检查Docker网络配置）

### 问题3: 调度器未执行任务

```bash
# 查看调度器日志
docker exec -it autoads-app tail -f /app/logs/scheduler-output.log

# 检查调度器状态
docker exec -it autoads-app supervisorctl status autoads-scheduler
```

**常见原因**：
- 调度器进程崩溃（查看错误日志）
- 环境变量缺失（检查GEMINI_API_KEY等）
- 时区问题（调度器使用Asia/Shanghai时区）

---

## 📈 监控和日志

### 实时日志监控

```bash
# 所有服务日志
docker-compose logs -f

# 只看Web应用
docker-compose logs -f autoads | grep "autoads-web"

# 只看调度器
docker exec -it autoads-app supervisorctl tail -f autoads-scheduler
```

### 日志文件管理

日志文件会自动轮转：
- 最大单文件大小: 10MB
- 保留文件数: 10个
- 自动压缩旧日志

**手动清理日志**：

```bash
# 清理所有日志（谨慎操作）
docker exec -it autoads-app sh -c "rm -f /app/logs/*.log"

# 重启supervisord重新创建日志文件
docker exec -it autoads-app supervisorctl restart all
```

---

## 🚀 生产部署建议

### 1. 使用环境变量管理敏感信息

```bash
# 不要在docker-compose.yml中硬编码敏感信息
# 使用.env文件或Docker secrets

# Docker Swarm环境使用secrets
docker secret create gemini_api_key ./gemini_key.txt
```

### 2. 配置反向代理

使用Nginx/Traefik作为反向代理：

```nginx
# Nginx配置示例
server {
    listen 80;
    server_name autoads.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 3. 数据库备份策略

```bash
# 添加cron任务定期复制备份到外部存储
0 3 * * * docker cp autoads-app:/app/data/backups/$(ls -t /app/data/backups/ | head -1) /backup/external/
```

### 4. 资源限制

```yaml
# docker-compose.yml
services:
  autoads:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

---

## 🔄 更新和升级

### 更新应用

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 重新构建镜像
docker-compose build

# 3. 重启服务
docker-compose down
docker-compose up -d

# 4. 验证服务状态
docker-compose ps
docker-compose logs -f
```

### 回滚到旧版本

```bash
# 1. 停止当前版本
docker-compose down

# 2. 使用旧版本镜像
docker-compose -f docker-compose.old.yml up -d

# 3. 或恢复数据库备份
cp backup_20251118.db ./data/database.db
docker-compose up -d
```

---

## 📚 相关文档

- **Supervisord配置**: `supervisord.docker.conf`
- **本地部署**: `docs/SUPERVISOR_DEPLOYMENT.md`
- **快速启动**: `claudedocs/SUPERVISORD_QUICK_START.md`
- **优化方案**: `claudedocs/SUPERVISOR_OPTIMIZATION_SUMMARY.md`

---

## ✅ 部署检查清单

部署前确保完成：

- [ ] `.env`文件已配置所有必需的环境变量
- [ ] `data/`目录存在且有正确权限
- [ ] Docker和Docker Compose已安装
- [ ] 端口3000未被占用
- [ ] 有足够的磁盘空间（至少5GB）
- [ ] 已测试健康检查端点
- [ ] 已配置数据库备份策略
- [ ] 已配置反向代理（生产环境）
- [ ] 已设置资源限制（生产环境）

---

**部署时间**: < 5分钟
**运行环境**: Docker 20.10+ / Docker Compose 1.29+
**支持平台**: Linux, macOS, Windows (WSL2)
