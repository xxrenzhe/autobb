# Supervisord自动化部署指南

**AutoAds应用的完整supervisord部署方案**

---

## 📋 方案概述

使用supervisord管理AutoAds应用，实现：
- ✅ Next.js Web应用自动启动
- ✅ 定时任务调度器自动启动
- ✅ 进程监控和自动重启
- ✅ 日志管理和轮转
- ✅ 优雅退出和重启
- ✅ 开机自启动（可选）

**vs Cron的优势**：
- 进程管理：自动重启、状态监控
- 日志集中：统一日志管理
- 配置简单：一次配置，永久生效
- 零手动：服务器重启后自动恢复

---

## 🚀 快速开始（一键部署）

### 方法1: 使用自动化脚本（推荐）

```bash
# 进入项目目录
cd /path/to/autobb

# 运行自动化部署脚本
./scripts/setup-supervisor.sh
```

**脚本会自动完成**：
1. 检查并安装supervisord
2. 创建必要的目录（logs, tmp, data/backups）
3. 安装npm依赖
4. 构建Next.js应用
5. 配置supervisord
6. 启动所有服务

**预期输出**：
```
🚀 AutoAds Supervisord 自动化部署脚本
======================================
📁 项目目录: /path/to/autobb
📦 步骤1: 检查系统依赖...
✅ supervisord 已存在
✅ Node.js v18.17.0
✅ npm 9.6.7
...
✅ AutoAds 部署完成！
```

### 方法2: 手动部署

详见 [手动部署步骤](#手动部署步骤)

---

## 📊 查看服务状态

```bash
# 查看所有服务状态
supervisorctl -c supervisord-generated.conf status

# 预期输出：
# autoads-scheduler         RUNNING   pid 12345, uptime 0:05:23
# autoads-web               RUNNING   pid 12346, uptime 0:05:23
```

---

## 🎛️ 服务管理命令

### 启动/停止/重启

```bash
# 重启Web应用
supervisorctl -c supervisord-generated.conf restart autoads-web

# 重启调度器
supervisorctl -c supervisord-generated.conf restart autoads-scheduler

# 重启所有服务
supervisorctl -c supervisord-generated.conf restart all

# 停止所有服务
supervisorctl -c supervisord-generated.conf stop all

# 启动所有服务
supervisorctl -c supervisord-generated.conf start all

# 完全关闭supervisord
supervisorctl -c supervisord-generated.conf shutdown
```

### 查看日志

```bash
# 实时查看Web应用日志
supervisorctl -c supervisord-generated.conf tail -f autoads-web

# 实时查看调度器日志
supervisorctl -c supervisord-generated.conf tail -f autoads-scheduler

# 查看supervisord主日志
tail -f logs/supervisord.log

# 查看所有日志
tail -f logs/*.log
```

### 重新加载配置

```bash
# 修改supervisord.conf后重新加载
supervisorctl -c supervisord-generated.conf reread
supervisorctl -c supervisord-generated.conf update
```

---

## 🔄 开机自启动配置

### Linux (Ubuntu/Debian)

**方法1: 使用systemd（推荐）**

创建systemd服务文件：

```bash
sudo nano /etc/systemd/system/autoads-supervisor.service
```

内容：

```ini
[Unit]
Description=AutoAds Supervisord Service
After=network.target

[Service]
Type=forking
User=YOUR_USERNAME
WorkingDirectory=/path/to/autobb
ExecStart=/usr/bin/supervisord -c /path/to/autobb/supervisord-generated.conf
ExecStop=/usr/bin/supervisorctl -c /path/to/autobb/supervisord-generated.conf shutdown
ExecReload=/usr/bin/supervisorctl -c /path/to/autobb/supervisord-generated.conf reload
PIDFile=/path/to/autobb/tmp/supervisord.pid
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**替换以下内容**：
- `YOUR_USERNAME`: 你的系统用户名
- `/path/to/autobb`: 实际项目路径

**启用开机自启动**：

```bash
# 重新加载systemd配置
sudo systemctl daemon-reload

# 启用开机自启动
sudo systemctl enable autoads-supervisor

# 启动服务
sudo systemctl start autoads-supervisor

# 查看状态
sudo systemctl status autoads-supervisor
```

**常用systemd命令**：

```bash
# 启动
sudo systemctl start autoads-supervisor

# 停止
sudo systemctl stop autoads-supervisor

# 重启
sudo systemctl restart autoads-supervisor

# 查看状态
sudo systemctl status autoads-supervisor

# 查看日志
sudo journalctl -u autoads-supervisor -f
```

---

**方法2: 使用rc.local（备选）**

```bash
# 编辑rc.local
sudo nano /etc/rc.local

# 添加以下内容（在exit 0之前）
cd /path/to/autobb && supervisord -c supervisord-generated.conf

# 赋予执行权限
sudo chmod +x /etc/rc.local
```

---

### macOS

**使用launchd创建开机自启动**

创建plist文件：

```bash
sudo nano /Library/LaunchDaemons/com.autoads.supervisor.plist
```

内容：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.autoads.supervisor</string>

    <key>ProgramArguments</key>
    <array>
        <string>/opt/homebrew/bin/supervisord</string>
        <string>-c</string>
        <string>/path/to/autobb/supervisord-generated.conf</string>
    </array>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <true/>

    <key>WorkingDirectory</key>
    <string>/path/to/autobb</string>

    <key>StandardOutPath</key>
    <string>/path/to/autobb/logs/launchd-stdout.log</string>

    <key>StandardErrorPath</key>
    <string>/path/to/autobb/logs/launchd-stderr.log</string>
</dict>
</plist>
```

**加载和启动**：

```bash
# 加载配置
sudo launchctl load /Library/LaunchDaemons/com.autoads.supervisor.plist

# 启动服务
sudo launchctl start com.autoads.supervisor

# 查看状态
sudo launchctl list | grep autoads
```

---

## 📅 定时任务配置

调度器自动执行以下任务：

| 任务 | 频率 | 时间 | 功能 |
|------|------|------|------|
| 数据同步 | 每6小时 | 0, 6, 12, 18点 | 同步Google Ads性能数据 |
| 数据库备份 | 每天 | 凌晨2点 | 备份SQLite数据库 |
| 数据清理 | 每天 | 凌晨3点 | 清理90天前的数据 |

**修改调度时间**：

编辑 `src/scheduler.ts`，修改cron表达式：

```typescript
// 每6小时改为每3小时
cron.schedule('0 */3 * * *', async () => {
  await syncDataTask()
})

// 每天凌晨2点改为每天下午2点
cron.schedule('0 14 * * *', async () => {
  await backupDatabaseTask()
})
```

**Cron表达式格式**：
```
* * * * *
│ │ │ │ │
│ │ │ │ └─ 星期 (0-7, 0和7都代表周日)
│ │ │ └─── 月份 (1-12)
│ │ └───── 日期 (1-31)
│ └─────── 小时 (0-23)
└───────── 分钟 (0-59)
```

**常用示例**：
- `0 */6 * * *` - 每6小时
- `0 0 * * *` - 每天午夜
- `0 2 * * *` - 每天凌晨2点
- `0 0 * * 0` - 每周日午夜
- `*/30 * * * *` - 每30分钟

修改后重启调度器：
```bash
supervisorctl -c supervisord-generated.conf restart autoads-scheduler
```

---

## 🗂️ 日志管理

### 日志文件位置

```
logs/
├── supervisord.log          # supervisord主日志
├── web-output.log           # Web应用标准输出
├── web-error.log            # Web应用错误输出
├── scheduler-output.log     # 调度器标准输出
└── scheduler-error.log      # 调度器错误输出
```

### 日志轮转配置

supervisord自动进行日志轮转：
- 单个日志文件最大50MB
- 保留最近10个备份

**手动配置logrotate（可选）**：

```bash
sudo nano /etc/logrotate.d/autoads
```

内容：

```
/path/to/autobb/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 YOUR_USERNAME YOUR_USERNAME
    sharedscripts
    postrotate
        supervisorctl -c /path/to/autobb/supervisord-generated.conf restart all
    endscript
}
```

---

## 🔧 故障排查

### 问题1: supervisord启动失败

**症状**：运行`supervisord -c supervisord-generated.conf`报错

**排查**：

```bash
# 检查配置文件语法
supervisord -c supervisord-generated.conf -n

# 查看详细错误
tail -f logs/supervisord.log
```

**常见原因**：
- 端口被占用（Next.js 3000端口）
- 配置文件路径错误
- 权限不足
- 依赖未安装

---

### 问题2: Web应用无法启动

**症状**：`supervisorctl status`显示`autoads-web FATAL`

**排查**：

```bash
# 查看Web应用错误日志
tail -100 logs/web-error.log

# 手动测试启动
npm run start
```

**常见原因**：
- `.next`目录不存在（需要`npm run build`）
- 端口3000被占用
- 环境变量缺失
- 数据库连接失败

**解决**：

```bash
# 重新构建
npm run build

# 检查端口占用
lsof -i :3000

# 重启服务
supervisorctl -c supervisord-generated.conf restart autoads-web
```

---

### 问题3: 调度器无法启动

**症状**：`autoads-scheduler FATAL`

**排查**：

```bash
# 查看调度器错误日志
tail -100 logs/scheduler-error.log

# 手动测试
npx tsx src/scheduler.ts
```

**常见原因**：
- 数据库文件不存在
- Google Ads API配置错误
- node-cron依赖缺失

---

### 问题4: 定时任务未执行

**症状**：调度器运行中，但任务未执行

**排查**：

```bash
# 查看调度器输出日志
tail -f logs/scheduler-output.log

# 检查是否有任务日志
grep "开始执行" logs/scheduler-output.log
```

**验证**：

```bash
# 检查时区配置
date
timedatectl  # Linux

# 检查cron表达式
# 使用在线工具: https://crontab.guru/
```

---

### 问题5: 内存占用过高

**症状**：服务器内存不足

**排查**：

```bash
# 查看进程内存占用
ps aux | grep -E "node|supervisord"

# 使用top监控
top -p $(pgrep -d',' -f autoads)
```

**优化**：

```bash
# 限制Node.js内存（在supervisord.conf中）
[program:autoads-web]
environment=NODE_ENV="production",NODE_OPTIONS="--max-old-space-size=1024"
```

---

## 📊 监控和告警

### 基础监控

```bash
# 创建监控脚本
cat > scripts/health-check.sh << 'EOF'
#!/bin/bash
# 健康检查脚本

# 检查supervisord是否运行
if ! supervisorctl -c supervisord-generated.conf status > /dev/null 2>&1; then
    echo "❌ Supervisord not running"
    exit 1
fi

# 检查所有服务状态
STATUS=$(supervisorctl -c supervisord-generated.conf status)

if echo "$STATUS" | grep -q "FATAL\\|STOPPED"; then
    echo "❌ Some services are down"
    echo "$STATUS"
    exit 1
fi

echo "✅ All services healthy"
exit 0
EOF

chmod +x scripts/health-check.sh
```

### 告警集成（可选）

**发送邮件告警**：

```bash
# 安装mailutils
sudo apt-get install mailutils

# 修改health-check.sh添加邮件通知
if echo "$STATUS" | grep -q "FATAL"; then
    echo "$STATUS" | mail -s "AutoAds Service Alert" admin@example.com
fi
```

**集成到cron**：

```bash
# 每小时检查一次
0 * * * * /path/to/autobb/scripts/health-check.sh || echo "Health check failed"
```

---

## 📝 手动部署步骤

如果不使用自动化脚本，可以手动执行以下步骤：

### 1. 安装supervisord

**Ubuntu/Debian**:
```bash
sudo apt-get update
sudo apt-get install -y supervisor
```

**CentOS/RHEL**:
```bash
sudo yum install -y supervisor
```

**macOS**:
```bash
brew install supervisor
```

### 2. 创建目录

```bash
cd /path/to/autobb
mkdir -p logs tmp data/backups
```

### 3. 安装依赖

```bash
npm install
```

### 4. 构建应用

```bash
npm run build
```

### 5. 生成supervisord配置

```bash
export USER=$(whoami)
envsubst < supervisord.conf > supervisord-generated.conf
```

### 6. 启动supervisord

```bash
supervisord -c supervisord-generated.conf
```

### 7. 验证状态

```bash
supervisorctl -c supervisord-generated.conf status
```

---

## 🔐 安全建议

1. **文件权限**：
```bash
chmod 600 supervisord-generated.conf
chmod 700 tmp
```

2. **日志权限**：
```bash
chmod 640 logs/*.log
```

3. **数据库备份权限**：
```bash
chmod 700 data/backups
```

4. **防火墙配置**：
```bash
# 只允许本地访问3000端口（如果使用nginx反向代理）
sudo ufw allow from 127.0.0.1 to any port 3000
```

---

## 📚 最佳实践

1. ✅ **定期备份**：确保数据库备份任务正常运行
2. ✅ **监控日志**：定期检查错误日志
3. ✅ **资源限制**：配置合理的内存和CPU限制
4. ✅ **健康检查**：定期运行health-check脚本
5. ✅ **版本控制**：不要提交`supervisord-generated.conf`到git
6. ✅ **文档更新**：记录所有配置变更

---

## 🆘 获取帮助

**查看supervisord文档**：
- 官方文档: http://supervisord.org/
- 配置参考: http://supervisord.org/configuration.html

**项目相关**：
- GitHub Issues: [项目地址]
- 内部文档: `docs/`目录

---

## 📝 总结

使用supervisord部署AutoAds应用可以实现：

- 🚀 **零手动**：一键部署，自动启动
- 🔄 **自动恢复**：进程崩溃自动重启
- 📊 **集中管理**：统一管理所有服务
- 📝 **日志管理**：自动轮转，易于查看
- ⏰ **定时任务**：替代cron，更可靠
- 🔧 **易于维护**：简单的命令行操作

**相比传统cron的优势**：服务器重启后supervisord可以配置为自动启动，而cron需要手动配置。supervisord提供进程监控和自动重启，确保服务高可用。
