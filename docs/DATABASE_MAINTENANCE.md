# 数据库维护指南

## 概述

本文档描述数据库配置管理和维护的最佳实践，确保数据库初始化和重建时不会引入错误配置。

## 核心原则

### 1. 唯一数据源（Single Source of Truth）

**所有系统配置项必须在 `scripts/init-database.ts` 中定义**

当前标准配置：

```typescript
// Google Ads API配置
{ category: 'google_ads', key: 'client_id', ... },
{ category: 'google_ads', key: 'client_secret', ... },
{ category: 'google_ads', key: 'developer_token', ... },

// AI配置
{ category: 'ai', key: 'gemini_api_key', ... },
{ category: 'ai', key: 'gemini_model', ... },

// 代理配置
{ category: 'proxy', key: 'enabled', ... },
{ category: 'proxy', key: 'url', ... },

// 系统配置
{ category: 'system', key: 'currency', ... },
{ category: 'system', key: 'language', ... },
{ category: 'system', key: 'sync_interval_hours', ... },
{ category: 'system', key: 'link_check_enabled', ... },
{ category: 'system', key: 'link_check_time', ... },
```

### 2. 禁止的配置项

以下配置项**不应该存在**于数据库中：

| 配置项 | 原因 |
|--------|------|
| `ai.claude_api_key` | 项目使用Gemini API，不使用Claude |
| `ai.primary_model` | 应使用 `gemini_model` |
| `proxy.host` | 已改为使用 `url` 配置 |
| `proxy.port` | 已改为使用 `url` 配置 |

### 3. 前端元数据同步

前端 `src/app/(app)/settings/page.tsx` 的 `SETTING_METADATA` 必须与数据库配置保持一致。

**必须匹配的字段**：
- `category` + `key` 组合必须对应
- 字段名称要使用正确的key（如 `gemini_model` 而不是 `primary_model`）

## 维护工具

### 1. 验证脚本

**用途**: 检查数据库配置一致性

```bash
npm run db:verify-settings
```

**检查项**：
- ✅ 是否存在禁止的配置项
- ✅ 是否缺失必需的配置项
- ✅ 配置属性是否正确（数据类型、敏感标记、必填标记）
- ✅ 是否存在未预期的配置项

**输出示例**：
```
✅ 数据库配置完全正确！
```

或

```
❌ 发现严重问题:
❌ 发现禁止的配置: ai.claude_api_key - 不使用Claude API

⚠️ 发现警告:
⚠️ ai.gemini_model: 数据类型不匹配 (期望: string, 实际: number)
```

### 2. 清理脚本

**用途**: 自动修复配置问题

```bash
npm run db:clean-settings
```

**操作**：
1. 删除禁止的配置项
2. 添加缺失的配置项
3. 重命名配置项（如 `primary_model` → `gemini_model`）
4. 显示清理后的最终状态

**输出示例**：
```
✅ 已删除: ai.claude_api_key (不使用Claude API)
✅ 已重命名: ai.primary_model → ai.gemini_model
✅ 清理完成！已修复配置问题。
```

## 工作流程

### 日常开发

无需特殊操作，数据库配置由 `init-database.ts` 保证正确性。

### 添加新配置项

1. **修改 `scripts/init-database.ts`**
   ```typescript
   const defaultSettings = [
     // ... 现有配置
     { category: 'new_category', key: 'new_key', dataType: 'string', ... }
   ]
   ```

2. **修改 `scripts/verify-database-settings.ts`**
   ```typescript
   const expectedSettings = [
     // ... 现有配置
     { category: 'new_category', key: 'new_key', ... }
   ]
   ```

3. **修改前端 `src/app/(app)/settings/page.tsx`**
   ```typescript
   const SETTING_METADATA: Record<string, {...}> = {
     // ... 现有元数据
     'new_category.new_key': {
       label: '显示名称',
       description: '配置说明',
       ...
     }
   }
   ```

4. **运行验证**
   ```bash
   npm run db:verify-settings
   ```

### 重建数据库

当需要完全重建数据库时：

```bash
# 1. 备份现有数据库
npm run db:backup

# 2. 删除数据库文件
rm data/autoads.db

# 3. 重新初始化
npm run db:init

# 4. 验证配置正确性
npm run db:verify-settings
```

### 修复配置问题

如果发现数据库配置有问题：

```bash
# 1. 运行验证脚本
npm run db:verify-settings

# 2. 如果发现问题，运行清理脚本
npm run db:clean-settings

# 3. 再次验证确认修复
npm run db:verify-settings
```

## 常见问题

### Q: 为什么数据库中会出现不应该存在的配置？

A: 可能原因：
1. 手动SQL插入
2. 旧版本迁移脚本遗留
3. 测试代码插入的测试数据

解决方法：运行 `npm run db:clean-settings` 自动清理。

### Q: 前端显示 `config_key` 原始名称而不是友好名称？

A: 检查 `SETTING_METADATA` 中是否定义了该配置项的元数据。

### Q: 验证脚本报告配置缺失？

A: 运行 `npm run db:clean-settings` 会自动添加缺失的配置。

### Q: 如何确保重建数据库后配置正确？

A: 重建后立即运行 `npm run db:verify-settings`，如果失败则运行 `npm run db:clean-settings` 修复。

## 最佳实践

### ✅ 应该做的

1. **修改配置前先备份数据库**
   ```bash
   npm run db:backup
   ```

2. **添加新配置后运行验证**
   ```bash
   npm run db:verify-settings
   ```

3. **定期检查配置一致性**（CI/CD流程中）
   ```bash
   npm run db:verify-settings || exit 1
   ```

4. **使用提供的工具而不是手动SQL**

### ❌ 不应该做的

1. ❌ 直接用SQL插入/修改 `system_settings`
2. ❌ 在 `init-database.ts` 之外定义默认配置
3. ❌ 跳过验证步骤就提交代码
4. ❌ 保留禁止的配置项

## 脚本文件说明

| 文件 | 用途 |
|------|------|
| `scripts/init-database.ts` | 数据库初始化（唯一数据源） |
| `scripts/verify-database-settings.ts` | 配置验证脚本 |
| `scripts/clean-database-settings.ts` | 配置清理脚本 |

## 相关文件

- 数据库初始化: `scripts/init-database.ts`
- 前端设置页: `src/app/(app)/settings/page.tsx`
- 设置API: `src/app/api/settings/route.ts`
- 设置库: `src/lib/settings.ts`
