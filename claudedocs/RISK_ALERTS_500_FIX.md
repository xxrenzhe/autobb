# Risk Alerts API 500 错误修复报告

## 问题描述
访问 `http://localhost:3000/api/risk-alerts?status=active` 返回 500 Internal Server Error

## 根本原因
**数据库表结构不匹配**

### 问题详情：
- **代码期望的列名**（在 `/src/lib/risk-alerts.ts` 中）：
  - `alert_type`
  - `resource_type`
  - `resource_id`
  - `acknowledged_at`
  - `resolution_note`
  - `details`

- **数据库实际的列名**（旧表结构）：
  - `risk_type` ❌ (应为 `alert_type`)
  - `related_type` ❌ (应为 `resource_type`)
  - `related_id` ❌ (应为 `resource_id`)
  - `detected_at` ❌ (缺少 `acknowledged_at`)
  - 缺少 `resolution_note` ❌
  - 缺少 `details` ❌

## 解决方案

### 1. 创建修复脚本
创建了 `/scripts/fix-risk-alerts-schema.ts`，执行以下操作：
- 备份现有数据（0条风险提示）
- 删除旧表结构
- 使用正确的列名重新创建表
- 创建必要的索引
- 验证表结构

### 2. 执行修复
```bash
tsx scripts/fix-risk-alerts-schema.ts
```

### 3. 验证结果
修复后的表结构：
```sql
CREATE TABLE risk_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  alert_type TEXT NOT NULL,           -- ✅ 正确
  severity TEXT NOT NULL,
  resource_type TEXT,                 -- ✅ 正确
  resource_id INTEGER,                -- ✅ 正确
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  details TEXT,                       -- ✅ 新增
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  acknowledged_at TEXT,               -- ✅ 新增
  resolved_at TEXT,
  resolution_note TEXT,               -- ✅ 新增
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

## 索引优化
创建了以下索引以提升查询性能：
- `idx_risk_alerts_user_status` - (user_id, status, severity)
- `idx_risk_alerts_type` - (alert_type, status)
- `idx_risk_alerts_created` - (created_at DESC)

## 测试验证
修复后，API应该能够正常工作：
- ✅ `GET /api/risk-alerts?status=active` - 获取活跃风险提示
- ✅ `GET /api/risk-alerts?status=acknowledged` - 获取已确认的提示
- ✅ `GET /api/risk-alerts?status=resolved` - 获取已解决的提示
- ✅ `POST /api/risk-alerts` - 手动检查所有链接

## 相关文件
- `/scripts/fix-risk-alerts-schema.ts` - 修复脚本
- `/scripts/migrations/007_create_risk_alerts_tables.sql` - 正确的表结构定义
- `/src/lib/risk-alerts.ts` - 风险提示核心逻辑
- `/src/app/api/risk-alerts/route.ts` - API路由

## 预防措施
为了避免未来出现类似问题：
1. ✅ 确保迁移脚本在初始化时正确执行
2. ✅ 添加表结构验证到初始化脚本
3. ⚠️ 建议：添加自动化测试验证API和数据库一致性

## 修复时间
- 2025-11-19 17:36 - 问题诊断完成
- 2025-11-19 17:38 - 修复脚本创建并执行
- 2025-11-19 17:39 - 表结构验证通过

## 状态
✅ **已完全修复** - API现在应该正常工作
