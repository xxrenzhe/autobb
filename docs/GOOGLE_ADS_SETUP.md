# Google Ads API 配置指南

## 📋 配置概览

### 必需配置项

| 配置项 | 说明 | 如何获取 |
|--------|------|---------|
| `GOOGLE_ADS_CLIENT_ID` | OAuth 2.0 客户端ID | Google Cloud Console |
| `GOOGLE_ADS_CLIENT_SECRET` | OAuth 2.0 客户端密钥 | Google Cloud Console |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | 开发者令牌 | Google Ads MCC账户 |
| `GOOGLE_ADS_REFRESH_TOKEN` | OAuth刷新令牌 | OAuth授权流程 |

### 可选配置项

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | MCC Manager账户ID | - |
| `GOOGLE_ADS_CUSTOMER_IDS` | 广告账户ID列表 | - |
| `GOOGLE_ADS_API_VERSION` | API版本 | v16 |

---

## 🚀 快速开始

### Step 1: 创建Google Cloud项目

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 启用 **Google Ads API**
   - 在搜索栏搜索"Google Ads API"
   - 点击"启用"

### Step 2: 创建OAuth 2.0凭证

1. 进入 **APIs & Services** → **Credentials**
2. 点击 **Create Credentials** → **OAuth client ID**
3. 应用类型选择 **Web application**
4. 配置：
   - **Name**: AutoAds OAuth Client
   - **Authorized redirect URIs**:
     - 开发环境：`http://localhost:3000/api/google-ads/oauth/callback`
     - 生产环境：`https://yourdomain.com/api/google-ads/oauth/callback`
5. 保存后获得：
   - ✅ **Client ID** (以`.apps.googleusercontent.com`结尾)
   - ✅ **Client Secret** (以`GOCSPX-`开头)

### Step 3: 创建MCC账户并获取Developer Token

#### 3.1 创建MCC账户

1. 访问 [Google Ads Manager Accounts](https://ads.google.com/home/tools/manager-accounts/)
2. 点击"Create manager account"
3. 填写账户信息并创建

#### 3.2 申请Developer Token

1. 登录MCC账户
2. 访问 [API Center](https://ads.google.com/aw/apicenter)
3. 填写申请表单：
   - **Developer Token Application**
   - 描述应用用途
   - 同意服务条款
4. 提交后等待审批（通常1-2个工作日）
5. 审批通过后获得：
   - ✅ **Developer Token**

> ⚠️ **注意**：开发阶段会获得"测试模式"的token，只能访问测试账户。生产环境需要升级为"基础"或"标准"访问级别。

### Step 4: 获取Refresh Token

有两种方式获取Refresh Token：

#### 方式1：使用本应用的OAuth流程（推荐）

1. 确保已在`.env`中配置：
   ```env
   GOOGLE_ADS_CLIENT_ID=your_client_id
   GOOGLE_ADS_CLIENT_SECRET=your_client_secret
   GOOGLE_ADS_DEVELOPER_TOKEN=your_developer_token
   ```

2. 启动开发服务器：
   ```bash
   npm run dev
   ```

3. 访问OAuth授权端点：
   ```
   http://localhost:3000/api/google-ads/oauth/start?client_id=YOUR_CLIENT_ID
   ```

4. 登录有MCC访问权限的Google账户

5. 授权后，系统会重定向回应用，并在URL中包含tokens

6. 将`refresh_token`填入`.env`文件：
   ```env
   GOOGLE_ADS_REFRESH_TOKEN=your_refresh_token_here
   ```

#### 方式2：使用OAuth Playground

1. 访问 [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)

2. 点击右上角⚙️图标，勾选：
   - ☑️ **Use your own OAuth credentials**
   - 填入你的Client ID和Client Secret

3. 在左侧"Step 1"中：
   - 搜索"Google Ads API"
   - 勾选：`https://www.googleapis.com/auth/adwords`
   - 点击"Authorize APIs"

4. 使用有MCC访问权限的Google账户登录并授权

5. 在"Step 2"中：
   - 点击"Exchange authorization code for tokens"
   - 获得 ✅ **Refresh Token**

6. 将获得的`refresh_token`填入`.env`：
   ```env
   GOOGLE_ADS_REFRESH_TOKEN=1//0g...your_long_refresh_token_here
   ```

---

## ✅ 验证配置

运行验证脚本检查配置是否正确：

```bash
npm run verify:google-ads
```

验证脚本会检查：
- ✅ 所有必需配置项是否已填写
- ✅ 配置格式是否正确
- ✅ OAuth Token是否有效
- ✅ Google Ads API连接是否正常
- ✅ 可访问的广告账户列表

### 预期输出（配置正确时）：

```
============================================================
Google Ads API配置验证
============================================================

📋 检查配置项:

✅ GOOGLE_ADS_CLIENT_ID: 644672509127-sj0oe3shl7nltvn...
✅ GOOGLE_ADS_CLIENT_SECRET: GOCSPX-0hHbs6ZsYwY7SSN32Rx...
✅ GOOGLE_ADS_DEVELOPER_TOKEN: lDeJ3piwcNBEhnWHL-s_Iw
✅ GOOGLE_ADS_REFRESH_TOKEN: 1//0gHmM5QZ_kpE7CgYIARAA...
✅ GOOGLE_ADS_LOGIN_CUSTOMER_ID: 5010618892
✅ GOOGLE_ADS_CUSTOMER_IDS: 4936310497,5427414593,5963351580

🔑 测试OAuth Token:

ℹ️  正在测试刷新Access Token...
✅ 成功刷新Access Token
ℹ️  Access Token: ya29.a0AfB_byC8xKj1...
ℹ️  有效期: 3599秒

🌐 测试Google Ads API:

ℹ️  正在测试Google Ads API连接...
✅ 成功连接Google Ads API
ℹ️  可访问的账户数量: 3
ℹ️  可访问的客户ID:
  - 4936310497
  - 5427414593
  - 5963351580

============================================================
验证结果总结
============================================================
✅ 配置检查通过
✅ OAuth Token测试通过
✅ Google Ads API连接测试通过

✨ 所有检查通过！Google Ads API配置完整且有效。
```

---

## 🔧 常见问题

### Q1: 为什么需要MCC账户？

虽然可以直接访问单个广告账户，但**获取Developer Token必须有MCC账户**。MCC账户还有以下优势：
- 集中管理多个广告账户
- 更高的API配额
- 便于批量操作

### Q2: Refresh Token为什么没有获取到？

确保OAuth授权时包含以下参数：
- `access_type=offline` - 获取refresh token
- `prompt=consent` - 强制显示同意页面

本应用的OAuth流程已自动包含这些参数。

### Q3: Developer Token申请被拒怎么办？

常见拒绝原因：
- 应用描述不清楚
- 未说明具体用途
- MCC账户没有关联任何广告账户

**解决方案**：
1. 完善应用描述，说明是用于广告投放自动化
2. 在MCC账户下创建或关联至少一个测试广告账户
3. 重新提交申请

### Q4: API调用返回AuthorizationError怎么办？

检查：
1. `GOOGLE_ADS_LOGIN_CUSTOMER_ID`是否正确配置
2. 使用的Google账户是否有权限访问该MCC账户
3. Developer Token是否已激活

### Q5: 如何从测试模式升级到生产模式？

测试模式限制：
- 只能访问测试账户
- API调用有限制

升级步骤：
1. 在API Center中申请升级为"基础访问"或"标准访问"
2. 提供应用使用案例和截图
3. 等待Google审核（7-14天）

---

## 📚 相关资源

- [Google Ads API官方文档](https://developers.google.com/google-ads/api/docs/start)
- [OAuth 2.0指南](https://developers.google.com/identity/protocols/oauth2)
- [Developer Token申请](https://developers.google.com/google-ads/api/docs/get-started/dev-token)
- [错误代码参考](https://developers.google.com/google-ads/api/docs/error-codes)

---

## 🆘 获取帮助

如果遇到问题：

1. **运行验证脚本**查看详细错误信息：
   ```bash
   npm run verify:google-ads
   ```

2. **检查日志**：
   ```bash
   tail -f logs/app.log
   ```

3. **查看环境变量**：
   ```bash
   cat .env | grep GOOGLE_ADS
   ```

4. **常见错误代码**：
   - `USER_PERMISSION_DENIED` → 检查login_customer_id配置
   - `DEVELOPER_TOKEN_NOT_APPROVED` → Developer Token未审批
   - `INVALID_CUSTOMER_ID` → 客户ID格式错误（应为10位数字，不含连字符）

---

## ✅ 配置完成检查清单

- [ ] 创建了Google Cloud项目并启用了Google Ads API
- [ ] 获得了OAuth 2.0 Client ID和Client Secret
- [ ] 创建了MCC账户
- [ ] 申请并获得了Developer Token
- [ ] 通过OAuth流程获得了Refresh Token
- [ ] 所有配置已填入`.env`文件
- [ ] 运行`npm run verify:google-ads`通过所有检查
- [ ] 能成功调用Google Ads API并获取账户列表

**恭喜！🎉 你的Google Ads API配置已完成，可以开始使用AutoAds的广告投放功能了！**
