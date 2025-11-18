# 定时任务配置指南

本文档说明如何配置系统定时任务（cron jobs）来自动化数据同步和清理。

## 📋 定时任务列表

### 1. 数据同步任务
**脚本**: `scripts/cron-sync-data.ts`
**频率**: 每5分钟
**功能**: 从Google Ads API拉取最新的Campaign性能数据

### 2. 数据清理任务
**脚本**: `scripts/cron-cleanup-old-data.ts`
**频率**: 每天凌晨2点
**功能**: 清理90天之前的性能数据，释放存储空间

---

## 🚀 配置步骤

### 方案A: 使用系统Crontab（推荐）

1. **创建日志目录**
```bash
mkdir -p logs
```

2. **编辑crontab**
```bash
crontab -e
```

3. **添加定时任务**
```bash
# 每5分钟执行数据同步
*/5 * * * * cd /path/to/autobb && npx tsx scripts/cron-sync-data.ts >> logs/sync.log 2>&1

# 每天凌晨2点执行数据清理
0 2 * * * cd /path/to/autobb && npx tsx scripts/cron-cleanup-old-data.ts >> logs/cleanup.log 2>&1
```

4. **验证crontab配置**
```bash
crontab -l
```

### 方案B: 使用PM2（适合VPS部署）

1. **安装PM2**
```bash
npm install -g pm2
```

2. **创建PM2 ecosystem文件**
```bash
# ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'autoads-sync',
      script: 'scripts/cron-sync-data.ts',
      interpreter: 'npx',
      interpreter_args: 'tsx',
      cron_restart: '*/5 * * * *',  // 每5分钟
      autorestart: false,
      watch: false,
    },
    {
      name: 'autoads-cleanup',
      script: 'scripts/cron-cleanup-old-data.ts',
      interpreter: 'npx',
      interpreter_args: 'tsx',
      cron_restart: '0 2 * * *',  // 每天凌晨2点
      autorestart: false,
      watch: false,
    },
  ],
}
```

3. **启动PM2任务**
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # 开机自启动
```

---

## 📊 监控和日志

### 查看日志
```bash
# 同步日志
tail -f logs/sync.log

# 清理日志
tail -f logs/cleanup.log

# PM2日志
pm2 logs autoads-sync
pm2 logs autoads-cleanup
```

### 手动测试

**测试数据同步**:
```bash
npx tsx scripts/cron-sync-data.ts
```

**测试数据清理**:
```bash
npx tsx scripts/cron-cleanup-old-data.ts
```

---

## ⚠️ 注意事项

1. **环境变量**: 确保cron环境可以访问必要的环境变量（`.env`文件）
2. **权限**: 确保脚本有执行权限
3. **路径**: crontab中使用绝对路径
4. **日志轮转**: 定期清理或归档日志文件
5. **Google Ads API配额**: 注意API调用频率限制

---

## 🔧 故障排查

### 问题1: Cron任务未执行
- 检查crontab语法: `crontab -l`
- 检查日志文件: `cat logs/sync.log`
- 检查环境变量: 在cron脚本中添加 `source ~/.bashrc` 或 `source ~/.profile`

### 问题2: 权限错误
```bash
chmod +x scripts/cron-sync-data.ts
chmod +x scripts/cron-cleanup-old-data.ts
```

### 问题3: Node模块未找到
在crontab中添加NODE_PATH:
```bash
NODE_PATH=/path/to/node_modules */5 * * * * cd /path/to/autobb && npx tsx scripts/cron-sync-data.ts
```

---

## 📈 性能优化建议

1. **调整同步频率**: 根据实际需求调整5分钟间隔（可改为10分钟或30分钟）
2. **错峰执行**: 避免在高峰期执行重任务
3. **批量处理**: 一次同步多个用户，减少API调用次数
4. **缓存优化**: 利用Google Ads API的缓存机制

---

## 📝 最佳实践

✅ 定期检查日志，确保任务正常执行
✅ 监控数据库大小，及时调整数据保留策略
✅ 设置告警通知（可集成Slack/Email）
✅ 定期备份数据库
✅ 使用PM2或Supervisor管理长期运行的任务

---

**部署环境**: ClawCloud VPS
**推荐方案**: 方案A（系统Crontab）或方案B（PM2）
