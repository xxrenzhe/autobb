# Google Ads API 配置指南

## 当前状态

✅ **已完成**: Keyword Planner集成代码已实现
⚠️ **待配置**: Google Ads API凭证

### 配置检查结果

```
✅ autoads用户已配置:
   - login_customer_id: 5010618892 (MCC账号)

❌ 缺失必需凭证:
   - client_id (OAuth 2.0客户端ID)
   - client_secret (OAuth 2.0客户端密钥)
   - developer_token (开发者令牌)
   - refresh_token (刷新令牌)
   - customer_id (广告账户ID)
```

## 配置优先级

系统会按以下顺序读取配置：

1. **autoads用户配置** (user_id=1) - 最高优先级
2. **全局配置** (user_id=NULL)
3. **环境变量** (.env)

## 获取Google Ads API凭证

### 前提条件

- ✅ 已有Google Cloud项目
- ✅ 已启用Google Ads API
- ✅ 已有MCC账号 (5010618892)

### 步骤1: 获取OAuth 2.0凭证

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 选择项目
3. 导航到 **APIs & Services** → **Credentials**
4. 点击 **Create Credentials** → **OAuth 2.0 Client ID**
5. 选择 **Web application**
6. 添加 Authorized redirect URIs:
   ```
   http://localhost:3001/api/auth/google/callback
   https://yourdomain.com/api/auth/google/callback
   ```
7. 保存并复制:
   - **Client ID**
   - **Client Secret**

### 步骤2: 获取Developer Token

1. 访问 [Google Ads API Center](https://ads.google.com/aw/apicenter)
2. 使用MCC账号登录 (5010618892)
3. 申请Developer Token
4. 等待审批（可能需要1-2天）
5. 复制Developer Token

### 步骤3: 获取Refresh Token

使用OAuth Playground或内置OAuth流程：

#### 方法A: 使用OAuth Playground

1. 访问 [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
2. 点击右上角设置图标
3. 勾选 "Use your own OAuth credentials"
4. 输入Client ID和Client Secret
5. 在左侧选择 **Google Ads API v16** → `https://www.googleapis.com/auth/adwords`
6. 点击 "Authorize APIs"
7. 登录Google账号并授权
8. 点击 "Exchange authorization code for tokens"
9. 复制 **Refresh Token**

#### 方法B: 使用内置OAuth流程

1. 启动应用: `npm run dev`
2. 访问: `http://localhost:3001/api/google-ads/oauth/start`
3. 完成Google授权
4. 从返回结果中获取Refresh Token

### 步骤4: 获取Customer ID

Customer ID是具体的Google Ads账户ID（10位数字，无连字符）

1. 登录 [Google Ads](https://ads.google.com/)
2. 查看右上角账户ID
3. 去除连字符，例如: `123-456-7890` → `1234567890`

## 配置方式

### 选项1: 通过UI配置（推荐）

1. 访问 `http://localhost:3001/settings`
2. 导航到 **Google Ads API** 部分
3. 输入凭证:
   ```
   Client ID: [您的Client ID]
   Client Secret: [您的Client Secret]
   Developer Token: [您的Developer Token]
   Refresh Token: [您的Refresh Token]
   Login Customer ID: 5010618892 (已配置)
   Customer ID: [您的广告账户ID]
   ```
4. 点击保存

### 选项2: 通过SQL配置

```sql
-- 更新autoads用户的Google Ads配置
UPDATE system_settings
SET config_value = 'YOUR_CLIENT_ID'
WHERE user_id = 1 AND category = 'google_ads' AND config_key = 'client_id';

UPDATE system_settings
SET config_value = 'YOUR_CLIENT_SECRET'
WHERE user_id = 1 AND category = 'google_ads' AND config_key = 'client_secret';

UPDATE system_settings
SET config_value = 'YOUR_DEVELOPER_TOKEN'
WHERE user_id = 1 AND category = 'google_ads' AND config_key = 'developer_token';

-- 添加refresh_token配置（如果不存在）
INSERT INTO system_settings (user_id, category, config_key, config_value, is_sensitive, description)
VALUES (1, 'google_ads', 'refresh_token', 'YOUR_REFRESH_TOKEN', 1, 'OAuth 2.0 Refresh Token')
ON CONFLICT(user_id, category, config_key) DO UPDATE SET config_value = excluded.config_value;

-- 添加customer_id配置（如果不存在）
INSERT INTO system_settings (user_id, category, config_key, config_value, is_sensitive, description)
VALUES (1, 'google_ads', 'customer_id', 'YOUR_CUSTOMER_ID', 0, 'Google Ads Customer ID')
ON CONFLICT(user_id, category, config_key) DO UPDATE SET config_value = excluded.config_value;
```

### 选项3: 通过环境变量配置

编辑 `.env` 文件:

```env
GOOGLE_ADS_CLIENT_ID=your_client_id
GOOGLE_ADS_CLIENT_SECRET=your_client_secret
GOOGLE_ADS_DEVELOPER_TOKEN=your_developer_token
GOOGLE_ADS_REFRESH_TOKEN=your_refresh_token
GOOGLE_ADS_LOGIN_CUSTOMER_ID=5010618892
GOOGLE_ADS_CUSTOMER_IDS=your_customer_id
```

## 验证配置

### 方法1: 运行验证脚本

```bash
npx tsx scripts/verify-google-ads-user-config.ts
```

期望输出:
```
✅ User found: autoads (ID: 1)
✅ client_id            [SET: ...]
✅ client_secret        [SET: ...]
✅ developer_token      [SET: ...]
✅ login_customer_id    [SET: 5010618892]
✅ All required fields are configured
```

### 方法2: 测试API调用

```bash
# 测试关键词搜索量API
curl "http://localhost:3001/api/keywords/volume?keywords=security+camera&country=US&language=en"
```

期望响应:
```json
{
  "success": true,
  "keywords": [
    {
      "keyword": "security camera",
      "searchVolume": 74000,
      "competition": "HIGH"
    }
  ]
}
```

### 方法3: 通过UI测试

1. 访问 `http://localhost:3001/offers`
2. 选择一个Offer
3. 点击 "生成新创意"
4. 检查生成的创意是否显示关键词搜索量

## 常见问题

### Q: Developer Token申请需要多久？
A: 通常1-2个工作日，测试环境可立即使用，生产环境需要审批。

### Q: 测试环境和生产环境的区别？
A: 测试环境可能有以下限制：
- 每日API调用限制更低
- 数据可能不准确
- 某些高级功能不可用

### Q: Refresh Token过期了怎么办？
A: Refresh Token通常不会过期，除非：
- 用户撤销授权
- 6个月未使用
- 重新生成了Client Secret

如果过期，重新执行步骤3获取新的Refresh Token。

### Q: 配置后仍然显示searchVolume: 0？
A: 可能原因：
1. 配置未生效（重启服务）
2. Redis缓存了旧数据（清除缓存）
3. API凭证无效（检查日志）
4. API限额已用完（检查配额）

### Q: 如何清除Redis缓存？
```bash
redis-cli FLUSHDB
```

## 安全建议

1. **不要将凭证提交到Git**
   - Client Secret
   - Developer Token
   - Refresh Token

2. **使用加密存储**
   - system_settings表的`encrypted_value`字段
   - 启用`is_sensitive`标记

3. **定期轮换凭证**
   - 每6个月更新Client Secret
   - 每年重新生成Refresh Token

4. **限制API权限**
   - 仅授予必要的OAuth scope
   - 使用MCC账号限制访问范围

## 下一步

配置完成后，系统将自动：

1. ✅ 从Redis缓存中快速获取关键词搜索量
2. ✅ 当缓存未命中时，自动查询global_keywords表
3. ✅ 当数据库也未命中时，调用Google Ads API
4. ✅ 自动缓存结果到Redis和数据库（7天TTL）
5. ✅ 在创意生成时展示真实搜索量数据

查看完整功能说明: `claudedocs/KEYWORD_VOLUME_FEATURE.md`
