# Supervisord 快速启动指南

## ✅ 问题解决

**原问题**：每次重启服务器都需要手动配置cron，非常不便

**解决方案**：使用supervisord + node-cron实现完全自动化

---

## 🚀 一键部署（推荐）

```bash
cd /Users/jason/Documents/Kiro/autobb
./scripts/setup-supervisor.sh
```

**脚本会自动完成**：
1. 检查并安装supervisord（macOS使用Homebrew）
2. 创建必要的目录（logs, tmp, data/backups）
3. 安装npm依赖
4. 构建Next.js应用
5. 配置supervisord
6. 启动所有服务

**预期输出**：
```
🚀 AutoAds Supervisord 自动化部署脚本
======================================
📁 项目目录: /Users/jason/Documents/Kiro/autobb
📦 步骤1: 检查系统依赖...
✅ supervisord 已安装
✅ Node.js v18.17.0
✅ npm 9.6.7
...
✅ AutoAds 部署完成！

📊 进程状态
======================================
autoads-scheduler         RUNNING   pid 12345, uptime 0:00:03
autoads-web               RUNNING   pid 12346, uptime 0:00:03
```

---

## 📊 查看状态

```bash
# 查看所有服务状态
supervisorctl -c supervisord-generated.conf status

# 实时查看Web应用日志
supervisorctl -c supervisord-generated.conf tail -f autoads-web

# 实时查看调度器日志
supervisorctl -c supervisord-generated.conf tail -f autoads-scheduler
```

---

## 🎛️ 常用命令

```bash
# 重启Web应用
supervisorctl -c supervisord-generated.conf restart autoads-web

# 重启调度器
supervisorctl -c supervisord-generated.conf restart autoads-scheduler

# 重启所有服务
supervisorctl -c supervisord-generated.conf restart all

# 停止所有服务
supervisorctl -c supervisord-generated.conf stop all

# 完全关闭supervisord
supervisorctl -c supervisord-generated.conf shutdown
```

---

## 📅 定时任务配置

调度器会自动执行以下任务（无需手动配置cron）：

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

修改后重启调度器：
```bash
supervisorctl -c supervisord-generated.conf restart autoads-scheduler
```

---

## 🔄 开机自启动（可选）

### macOS使用launchd

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
        <string>/Users/jason/Documents/Kiro/autobb/supervisord-generated.conf</string>
    </array>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <true/>

    <key>WorkingDirectory</key>
    <string>/Users/jason/Documents/Kiro/autobb</string>

    <key>StandardOutPath</key>
    <string>/Users/jason/Documents/Kiro/autobb/logs/launchd-stdout.log</string>

    <key>StandardErrorPath</key>
    <string>/Users/jason/Documents/Kiro/autobb/logs/launchd-stderr.log</string>
</dict>
</plist>
```

加载和启动：

```bash
# 加载配置
sudo launchctl load /Library/LaunchDaemons/com.autoads.supervisor.plist

# 启动服务
sudo launchctl start com.autoads.supervisor

# 查看状态
sudo launchctl list | grep autoads
```

---

## 🗂️ 日志文件位置

```
logs/
├── supervisord.log          # supervisord主日志
├── web-output.log           # Web应用标准输出
├── web-error.log            # Web应用错误输出
├── scheduler-output.log     # 调度器标准输出
└── scheduler-error.log      # 调度器错误输出
```

---

## 🔧 故障排查

### 问题1: supervisord启动失败

```bash
# 检查配置文件语法
supervisord -c supervisord-generated.conf -n

# 查看详细错误
tail -f logs/supervisord.log
```

### 问题2: Web应用无法启动

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

### 问题3: 调度器无法启动

```bash
# 查看调度器错误日志
tail -100 logs/scheduler-error.log

# 手动测试
npx tsx src/scheduler.ts
```

---

## 📚 完整文档

详细文档请查看：`docs/SUPERVISOR_DEPLOYMENT.md`

包含内容：
- 手动部署步骤
- Linux系统配置
- 监控和告警
- 安全建议
- 最佳实践

---

## ✅ 优势总结

相比传统cron方案：

| 特性 | Cron | Supervisord + node-cron |
|------|------|------------------------|
| 自动启动 | ❌ 需手动配置 | ✅ 一键部署 |
| 进程监控 | ❌ 无 | ✅ 自动重启 |
| 日志管理 | ❌ 分散 | ✅ 集中管理 |
| 配置维护 | ❌ 每次重启都需配置 | ✅ 永久生效 |
| 状态查看 | ❌ 困难 | ✅ 实时查看 |
| 错误恢复 | ❌ 手动 | ✅ 自动 |

---

## 🎯 总结

**零手动配置**：服务器重启后，supervisord可配置为自动启动，无需任何手动操作

**高可用性**：进程崩溃自动重启，确保服务持续运行

**易于维护**：统一管理所有服务，简单的命令行操作
