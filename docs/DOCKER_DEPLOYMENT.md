# AutoAds Docker部署指南

**版本**: 2.0 (Supervisord + Monorepo单容器)
**更新时间**: 2025-11-19
**部署架构**: 单容器多服务，对外端口3000

---

## 📦 架构概览

```
Docker容器 (单容器，对外端口3000)
├── Supervisord (进程管理器)
    ├── autoads-web (Next.js应用, 端口3000)
    └── autoads-scheduler (定时任务调度器)
        ├── 数据同步 (每6小时: 0, 6, 12, 18点)
        ├── 数据库备份 (每天凌晨2点)
        └── 数据清理 (每天凌晨3点)
```

**核心特性**：
- ✅ 单容器多服务架构（Monorepo）
- ✅ Supervisord自动管理所有进程
- ✅ 镜像优化 < 300MB (Next.js standalone)
- ✅ 健康检查端点 `/api/health`
- ✅ 自动重启、集中日志

---

## 🚀 部署流程

### 本地开发测试

```bash
# 1. 构建镜像
docker build -t autoads:latest .

# 2. 创建环境变量文件
cat > .env << 'EOF'
GEMINI_API_KEY=your_api_key
GOOGLE_ADS_CLIENT_ID=your_client_id
GOOGLE_ADS_CLIENT_SECRET=your_client_secret
GOOGLE_ADS_DEVELOPER_TOKEN=your_token
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF

# 3. 运行容器
docker run -d \
  --name autoads-app \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  --env-file .env \
  autoads:latest

# 4. 查看日志
docker logs -f autoads-app
```

### 生产环境部署（标准流程）

```bash
# Step 1: 推送代码到GitHub
git push origin main

# Step 2: GitHub Actions自动构建镜像
# - 镜像标签: prod-latest, prod-[commitid]
# - 推送到: ghcr.io/your-org/autoads

# Step 3: 生产服务器拉取镜像
docker pull ghcr.io/your-org/autoads:prod-latest

# Step 4: 运行容器
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

### 查看服务状态

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
docker exec -it autoads-app supervisorctl restart autoads-web

# 重启调度器
docker exec -it autoads-app supervisorctl restart autoads-scheduler

# 重启所有服务
docker exec -it autoads-app supervisorctl restart all
```

### 查看日志

```bash
# 查看容器日志
docker logs -f autoads-app

# 进入容器查看详细日志
docker exec -it autoads-app tail -f /app/logs/web-output.log
docker exec -it autoads-app tail -f /app/logs/scheduler-output.log
docker exec -it autoads-app tail -f /app/logs/web-error.log
docker exec -it autoads-app tail -f /app/logs/scheduler-error.log

# 或使用supervisorctl
docker exec -it autoads-app supervisorctl tail -f autoads-web
docker exec -it autoads-app supervisorctl tail -f autoads-scheduler
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
├── data/                      # 持久化数据（卷挂载）
│   ├── database.db            # SQLite数据库
│   └── backups/               # 数据库备份
├── logs/                      # 日志目录（卷挂载）
│   ├── supervisord.log
│   ├── web-output.log
│   ├── web-error.log
│   ├── scheduler-output.log
│   └── scheduler-error.log
└── tmp/                       # 临时文件
    ├── supervisord.pid
    └── supervisor.sock
```

---

## 🔍 健康检查

### 手动测试

```bash
# 容器内测试
docker exec -it autoads-app wget -q -O- http://localhost:3000/api/health

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

### 自动健康检查

Docker会自动调用健康检查端点，如果连续失败3次，容器会被标记为unhealthy。

---

## 🗄️ 数据持久化

### 自动备份

调度器会自动备份数据库（每天凌晨2点）：

```bash
# 查看备份文件
docker exec -it autoads-app ls -lh /app/data/backups/

# 输出示例：
# -rw-r--r-- 1 nextjs nodejs 2.5M Nov 19 02:00 database_20251119_020000.db
```

### 手动备份

```bash
# 复制数据库文件
docker cp autoads-app:/app/data/database.db ./backup_$(date +%Y%m%d).db

# 备份整个data目录
docker cp autoads-app:/app/data ./data-backup-$(date +%Y%m%d)
```

### 恢复备份

```bash
# 停止容器
docker stop autoads-app

# 恢复数据库文件
docker cp backup_20251119.db autoads-app:/app/data/database.db

# 重启容器
docker start autoads-app
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
- 端口被占用（`lsof -i :3000`）
- 数据库文件损坏（恢复备份）

### 问题2: Web应用无法访问

```bash
# 检查服务状态
docker exec -it autoads-app supervisorctl status

# 查看Web应用日志
docker exec -it autoads-app tail -f /app/logs/web-error.log
```

**常见原因**：
- Web进程崩溃（自动重启，查看错误日志）
- 端口映射错误（检查docker run命令）

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

---

## 📈 监控和维护

### 查看容器资源使用

```bash
# 实时资源使用情况
docker stats autoads-app

# 输出示例：
# NAME         CPU %   MEM USAGE / LIMIT   MEM %   NET I/O
# autoads-app  0.5%    180MiB / 2GiB      9%      1kB / 500B
```

### 清理日志

```bash
# 清理旧日志（谨慎操作）
docker exec -it autoads-app sh -c "find /app/logs -name '*.log' -mtime +7 -delete"

# 重启supervisord重新创建日志文件
docker exec -it autoads-app supervisorctl restart all
```

### 更新容器

```bash
# 1. 拉取最新镜像
docker pull ghcr.io/your-org/autoads:prod-latest

# 2. 停止旧容器
docker stop autoads-app
docker rm autoads-app

# 3. 启动新容器（使用相同配置）
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

## 🔒 生产环境最佳实践

### 1. 使用反向代理

```nginx
# Nginx配置示例
server {
    listen 80;
    server_name autoads.dev;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 2. 配置SSL证书

使用Cloudflare CDN或Let's Encrypt配置HTTPS。

### 3. 设置资源限制

```bash
docker run -d \
  --name autoads-app \
  --restart unless-stopped \
  --memory="2g" \
  --cpus="2.0" \
  -p 3000:3000 \
  ...
```

### 4. 配置外部备份

```bash
# 添加cron任务定期备份到外部存储
0 4 * * * docker cp autoads-app:/app/data/backups/$(ls -t /app/data/backups/ | head -1) /backup/external/
```

---

## ✅ 部署检查清单

- [ ] `.env`文件已配置所有必需的环境变量
- [ ] `data/`目录存在且有正确权限
- [ ] Docker已安装（20.10+）
- [ ] 端口3000未被占用
- [ ] 有足够的磁盘空间（至少5GB）
- [ ] 已测试健康检查端点
- [ ] 已配置数据库备份策略
- [ ] 已配置反向代理（生产环境）
- [ ] 已设置资源限制（生产环境）

---

## 📚 相关文档

- **本地部署**: `docs/SUPERVISOR_DEPLOYMENT.md`
- **快速启动**: `claudedocs/SUPERVISORD_QUICK_START.md`
- **优化方案**: `claudedocs/SUPERVISOR_OPTIMIZATION_SUMMARY.md`
- **Monorepo构建**: `docs/MONOREPO_BUILD_BEST_PRACTICES.md`
- **基本原则**: `docs/BasicPrinciples/MustKnowV1.md`

---

**部署时间**: < 5分钟
**最低要求**: Docker 20.10+
**支持平台**: Linux (推荐), macOS, Windows (WSL2)
**镜像大小**: ~280MB
**内存需求**: 最小512MB，推荐2GB
