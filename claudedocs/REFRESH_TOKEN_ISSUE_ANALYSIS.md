# Refresh Token 保存问题分析报告

**调查时间**: 2025-11-21
**调查人**: Claude Code
**问题**: OAuth授权完成后，refresh_token未能被keyword-planner.ts读取

---

## 🔍 问题根源

### 数据库表结构冲突

系统中存在**两个不同的表**用于存储Google Ads相关信息：

#### 表1: `google_ads_credentials` （OAuth流程使用）
```sql
CREATE TABLE google_ads_credentials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  refresh_token TEXT NOT NULL,        -- ✅ OAuth回调保存到这里
  access_token TEXT,
  developer_token TEXT NOT NULL,
  login_customer_id TEXT,
  access_token_expires_at TEXT,
  is_active INTEGER DEFAULT 1,
  last_verified_at TEXT,
  created_at TEXT,
  updated_at TEXT
);
```

#### 表2: `google_ads_accounts` （keyword-planner.ts读取）
```sql
CREATE TABLE google_ads_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  customer_id TEXT NOT NULL,          -- Google Ads账户ID
  descriptive_name TEXT,
  currency_code TEXT,
  time_zone TEXT,
  manager INTEGER DEFAULT 0,
  test_account INTEGER DEFAULT 0,
  refresh_token TEXT,                 -- ❌ keyword-planner在这里找
  access_token TEXT,
  token_expires_at TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT,
  updated_at TEXT
);
```

#### 表3: `system_settings` （加密存储基础配置）
```sql
-- category='google_ads' 的记录存储：
-- client_id (encrypted_value)
-- client_secret (encrypted_value)
-- developer_token (encrypted_value)
-- login_customer_id (config_value)
```

---

## 🔄 当前流程分析

### OAuth授权流程（正确）

1. **用户在/settings页面点击"启动 OAuth 授权"**
   - 文件: `src/app/(app)/settings/page.tsx:376-402`
   - 调用: `GET /api/google-ads/oauth/start?client_id=...`

2. **重定向到Google OAuth同意页面**
   - 文件: `src/app/api/google-ads/oauth/start/route.ts`
   - 生成state参数（包含user_id和timestamp）

3. **Google回调处理**
   - 文件: `src/app/api/google-ads/oauth/callback/route.ts:90-98`
   - 调用: `saveGoogleAdsCredentials(stateData.user_id, {...})`
   ```typescript
   const savedCredentials = saveGoogleAdsCredentials(stateData.user_id, {
     client_id: clientId,
     client_secret: clientSecret,
     refresh_token: tokens.refresh_token,  // ✅ 保存到google_ads_credentials表
     developer_token: developerToken,
     login_customer_id: loginCustomerId || undefined,
     access_token: tokens.access_token,
     access_token_expires_at: expiresAt,
   })
   ```

4. **实际保存位置**
   - 文件: `src/lib/google-ads-oauth.ts:25-93`
   - 表: `google_ads_credentials`
   - 验证结果:
   ```sql
   sqlite> SELECT id, user_id, SUBSTR(refresh_token,1,20), is_active
           FROM google_ads_credentials WHERE user_id=1;
   1|1|1//068U3e6o8A3fLCgYI|1  ✅ 已保存
   ```

### Keyword Planner读取流程（不完整）

1. **配置读取优先级**
   - 文件: `src/lib/keyword-planner.ts:29-102`
   - 优先级:
     ```
     1. system_settings (user_id=1, encrypted) ✅ 读取client_id/client_secret/developer_token
     2. system_settings (user_id=NULL, global) ✅ 作为备选
     3. google_ads_accounts表 ❌ 期望在这里读取refresh_token
     4. 环境变量 (.env) ❌ 没有配置
     ```

2. **refresh_token读取逻辑**
   ```typescript
   // src/lib/keyword-planner.ts:71-86
   let refreshToken = userConfigMap.refresh_token || process.env.GOOGLE_ADS_REFRESH_TOKEN || ''
   let customerId = userConfigMap.customer_id || process.env.GOOGLE_ADS_CUSTOMER_IDS?.split(',')[0] || ''

   if (!refreshToken || !customerId) {
     // ❌ 只查询google_ads_accounts表，不查询google_ads_credentials表
     const account = db.prepare(`
       SELECT customer_id, refresh_token
       FROM google_ads_accounts
       WHERE user_id = ? AND is_active = 1
       LIMIT 1
     `).get(autoadsUserId)
   }
   ```

3. **当前数据库状态**
   ```sql
   -- google_ads_credentials: 有refresh_token ✅
   sqlite> SELECT COUNT(*) FROM google_ads_credentials WHERE user_id=1 AND refresh_token IS NOT NULL;
   1

   -- google_ads_accounts: 无refresh_token ❌
   sqlite> SELECT COUNT(*) FROM google_ads_accounts WHERE user_id=1 AND refresh_token IS NOT NULL;
   0

   -- google_ads_accounts: 有30个账户，但都没有refresh_token
   sqlite> SELECT COUNT(*) FROM google_ads_accounts WHERE user_id=1;
   30
   ```

---

## 📊 问题总结

| 组件 | 期望位置 | 实际位置 | 状态 |
|------|---------|---------|------|
| client_id | system_settings (encrypted) | system_settings (encrypted) | ✅ 一致 |
| client_secret | system_settings (encrypted) | system_settings (encrypted) | ✅ 一致 |
| developer_token | system_settings (encrypted) | system_settings (encrypted) | ✅ 一致 |
| login_customer_id | system_settings (plaintext) | system_settings (plaintext) | ✅ 一致 |
| **refresh_token** | **google_ads_accounts** | **google_ads_credentials** | ❌ **不一致** |
| customer_id | google_ads_accounts | google_ads_accounts | ✅ 一致 |

**核心问题**: keyword-planner.ts 在 google_ads_accounts 表中查找 refresh_token，但 OAuth 回调将其保存到了 google_ads_credentials 表。

---

## 🛠️ 解决方案

### 方案1: 修改keyword-planner.ts读取逻辑（推荐）

**优点**:
- 不改变OAuth流程
- 兼容现有数据
- 最小化修改

**实现**:
```typescript
// src/lib/keyword-planner.ts:70-87
// 添加从google_ads_credentials表读取refresh_token的逻辑

let refreshToken = userConfigMap.refresh_token || process.env.GOOGLE_ADS_REFRESH_TOKEN || ''
let customerId = userConfigMap.customer_id || process.env.GOOGLE_ADS_CUSTOMER_IDS?.split(',')[0] || ''

if (!refreshToken || !customerId) {
  // Priority 1: Try google_ads_credentials table (OAuth saved data)
  const credentials = db.prepare(`
    SELECT refresh_token, login_customer_id
    FROM google_ads_credentials
    WHERE user_id = ? AND is_active = 1
  `).get(autoadsUserId) as { refresh_token: string; login_customer_id: string } | undefined

  if (credentials && credentials.refresh_token) {
    refreshToken = credentials.refresh_token
  }

  // Priority 2: Try google_ads_accounts table
  if (!customerId) {
    const account = db.prepare(`
      SELECT customer_id, refresh_token
      FROM google_ads_accounts
      WHERE user_id = ? AND is_active = 1
      LIMIT 1
    `).get(autoadsUserId) as { customer_id: string; refresh_token: string | null } | undefined

    if (account) {
      if (!customerId) customerId = account.customer_id
      if (!refreshToken && account.refresh_token) refreshToken = account.refresh_token
    }
  }
}
```

### 方案2: 修改OAuth回调保存逻辑

**优点**:
- 统一数据存储位置
- 符合表设计初衷

**缺点**:
- 需要customer_id才能保存到google_ads_accounts
- OAuth回调时可能还没有customer_id

### 方案3: 数据库迁移脚本

将google_ads_credentials表的refresh_token复制到google_ads_accounts表：

```sql
UPDATE google_ads_accounts
SET refresh_token = (
  SELECT refresh_token
  FROM google_ads_credentials
  WHERE google_ads_credentials.user_id = google_ads_accounts.user_id
  AND google_ads_credentials.is_active = 1
)
WHERE user_id = 1 AND is_active = 1;
```

**问题**: google_ads_accounts有30条记录，每个customer_id都需要独立的refresh_token吗？

---

## 🎯 推荐实施步骤

1. **立即修复（方案1）**: 更新keyword-planner.ts读取逻辑，优先从google_ads_credentials表读取
2. **验证修复**: 运行测试脚本确认能读取到refresh_token
3. **文档更新**: 更新GOOGLE_ADS_CONFIG_STATUS.md，说明refresh_token实际存储位置
4. **长期优化**: 评估是否需要统一表结构设计

---

## 📝 测试验证

### 修复前测试
```bash
npx tsx scripts/test-google-ads-config.ts
# 预期: ❌ Refresh Token
```

### 修复后测试
```bash
npx tsx scripts/test-google-ads-config.ts
# 预期: ✅ Refresh Token (从google_ads_credentials读取)
```

### API测试
```bash
curl "http://localhost:3001/api/keywords/volume?keywords=test&country=US&language=en"
# 预期: 返回真实搜索量数据，而不是错误
```

---

## 📚 相关文件

- `src/lib/keyword-planner.ts` - 需要修复的文件
- `src/lib/google-ads-oauth.ts` - OAuth保存逻辑
- `src/app/api/google-ads/oauth/callback/route.ts` - OAuth回调处理
- `src/app/(app)/settings/page.tsx` - 用户界面
- `scripts/test-google-ads-config.ts` - 测试脚本
- `claudedocs/GOOGLE_ADS_CONFIG_STATUS.md` - 配置状态文档

---

**结论**: refresh_token实际上已经被正确保存，只是keyword-planner.ts在错误的表中查找。实施方案1可以立即解决此问题。
