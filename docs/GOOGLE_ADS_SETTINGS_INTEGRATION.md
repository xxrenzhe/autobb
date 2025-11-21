# Google Ads 配置整合到 Settings 页面

## 变更概述

将独立的 `/settings/google-ads-credentials` 页面的所有功能整合到主设置页面 `/settings` 的 "Google Ads API" 配置部分。

## 修改内容

### 1. 删除独立页面
- ✅ 删除 `src/app/(app)/settings/google-ads-credentials/page.tsx`
- ✅ 删除整个 `google-ads-credentials` 目录

### 2. 更新主设置页面 (`src/app/(app)/settings/page.tsx`)

#### 新增导入
```typescript
import { Key, RefreshCw, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react'
```

#### 新增接口
```typescript
interface GoogleAdsAccount {
  customer_id: string
  descriptive_name: string
  currency_code: string
  time_zone: string
  manager: boolean
  test_account: boolean
  status?: string
}

interface GoogleAdsCredentialStatus {
  has_credentials: boolean
  login_customer_id?: string
  last_verified_at?: string
  is_active?: boolean
}
```

#### 新增状态变量
- `googleAdsCredentialStatus` - 凭证状态
- `googleAdsAccounts` - 账户列表
- `loadingGoogleAdsAccounts` - 加载状态
- `showGoogleAdsAccounts` - 显示账户
- `verifyingGoogleAds` - 验证状态
- `startingOAuth` - OAuth 启动状态

#### 新增函数
- `fetchGoogleAdsCredentialStatus()` - 获取凭证状态
- `handleStartGoogleAdsOAuth()` - 启动 OAuth 授权（使用已配置的 Client ID）
- `handleVerifyGoogleAdsCredentials()` - 验证完整凭证
- `handleFetchGoogleAdsAccounts()` - 获取可访问账户

### 3. Google Ads 配置部分 UI 结构

```
┌─ Google Ads API 配置卡片
│
├─ 凭证状态显示
│  ├─ 已配置 / 未配置状态指示
│  ├─ Manager Customer ID (如果有)
│  └─ 最后验证时间 (如果有)
│
├─ 基础配置字段
│  ├─ Client ID
│  ├─ Client Secret
│  └─ Developer Token
│
├─ OAuth 授权流程（获取 Refresh Token）
│  ├─ 说明文字：请先填写并保存上方配置
│  └─ [启动 OAuth 授权] 按钮
│
├─ Google Ads 账户 (仅已配置凭证时显示)
│  ├─ [查看可访问账户] 按钮
│  └─ 账户列表卡片
│     ├─ 账户名称 + Manager/测试账户标签
│     └─ Customer ID + 货币 + 时区
│
└─ 操作按钮
   ├─ [保存配置]
   ├─ [验证基础配置]
   └─ [验证完整凭证] (仅已配置完整凭证时显示)
```

## 功能特性

### 1. 凭证状态实时显示
- 自动获取并显示用户的 Google Ads 凭证状态
- 区分显示"已配置"和"未配置"状态
- 显示 Manager Customer ID 和最后验证时间

### 2. 分离的配置流程

**基础配置**：
- Client ID
- Client Secret
- Developer Token
- 保存在 `settings` 表中

**完整凭证**：
- 基础配置 + Refresh Token + Login Customer ID
- 保存在 `google_ads_credentials` 表中（加密存储）

### 3. OAuth 授权流程获取 Refresh Token

**统一的 OAuth 授权流程**
- 使用已配置的 Client ID、Client Secret、Developer Token
- 一键启动 OAuth 授权
- 自动获取并保存 Refresh Token
- 简化配置流程，避免重复输入

### 4. 账户管理功能
- 查看所有可访问的 Google Ads 账户
- 显示账户详细信息：
  - 账户名称
  - Customer ID
  - Manager/测试账户标识
  - 货币、时区等元数据

### 5. 双重验证机制

**验证基础配置**：
- 验证 Client ID, Client Secret, Developer Token 格式
- 调用 `/api/settings/validate` 端点

**验证完整凭证**：
- 验证完整的 API 连接性
- 测试 Refresh Token 有效性
- 调用 `/api/google-ads/credentials/verify` 端点
- 返回 Customer ID 等详细信息

## 用户操作流程

### 首次配置

1. 访问 `/settings`
2. 找到 "Google Ads API" 配置部分
3. 填写 Client ID, Client Secret, Developer Token
4. 点击 [保存配置]
5. 点击 [启动 OAuth 授权] 按钮
6. 完成 Google OAuth 授权
7. 系统自动保存 Refresh Token
8. 点击 [验证完整凭证] 确认配置成功
9. 点击 [查看可访问账户] 查看所有账户

### 更新凭证

1. 访问 `/settings`
2. 找到 "Google Ads API" 配置部分
3. 修改需要更新的字段
4. 点击 [保存配置]
5. 如需更新 Refresh Token，点击 [启动 OAuth 授权] 重新授权
6. 点击 [验证完整凭证] 确认更新成功

### 验证现有配置

1. 访问 `/settings`
2. 查看凭证状态显示（绿色=已配置，黄色=未配置）
3. 点击 [验证完整凭证] 测试 API 连接
4. 点击 [查看可访问账户] 查看账户列表

## API 端点

### 使用的现有端点
- `GET /api/google-ads/credentials` - 获取凭证状态
- `POST /api/google-ads/credentials` - 保存凭证
- `POST /api/google-ads/credentials/verify` - 验证完整凭证
- `GET /api/google-ads/credentials/accounts` - 获取账户列表
- `GET /api/google-ads/oauth/start` - 启动 OAuth 授权
- `GET /api/google-ads/oauth/callback` - OAuth 回调

### Settings API
- `GET /api/settings` - 获取所有配置（包括 google_ads 基础配置）
- `PUT /api/settings` - 保存配置
- `POST /api/settings/validate` - 验证配置

## 数据存储

### settings 表
```sql
category = 'google_ads'
key IN ('client_id', 'client_secret', 'developer_token')
value = '...'  -- 敏感字段加密存储
```

### google_ads_credentials 表
```sql
user_id = ...
client_id = '...'
client_secret = '...'  -- AES-256-GCM 加密
developer_token = '...'  -- AES-256-GCM 加密
refresh_token = '...'  -- AES-256-GCM 加密
login_customer_id = '...'  -- 可选
last_verified_at = ...
is_active = 1
```

## 兼容性说明

### 向后兼容
- 现有 API 端点保持不变
- 数据库表结构未改动
- OAuth 流程完全兼容

### 迁移影响
- 用户无需重新配置凭证
- 现有凭证自动显示在新界面
- 功能增强，无功能减少

## 测试清单

- [ ] 基础配置保存和加载
- [ ] OAuth 授权流程
- [ ] 手动输入 Refresh Token
- [ ] 验证基础配置
- [ ] 验证完整凭证
- [ ] 查看可访问账户
- [ ] 账户列表显示
- [ ] 凭证状态实时更新
- [ ] 敏感数据显示/隐藏切换
- [ ] 错误处理和提示

## 文档更新

需要更新的文档：
- [x] `GOOGLE_ADS_SETTINGS_INTEGRATION.md` - 本文档
- [ ] `GOOGLE_ADS_SETUP.md` - 更新页面路径说明
- [ ] `GOOGLE_ADS_USER_SETUP_COMPLETE.md` - 更新 UI 截图和说明

## 相关文件

### 修改的文件
- `src/app/(app)/settings/page.tsx` - 主设置页面（+257 行）

### 删除的文件
- `src/app/(app)/settings/google-ads-credentials/page.tsx`
- `src/app/(app)/settings/google-ads-credentials/` 目录

### API 文件（未改动）
- `src/app/api/google-ads/credentials/route.ts`
- `src/app/api/google-ads/credentials/verify/route.ts`
- `src/app/api/google-ads/credentials/accounts/route.ts`
- `src/app/api/google-ads/oauth/start/route.ts`
- `src/app/api/google-ads/oauth/callback/route.ts`
- `src/lib/google-ads-oauth.ts`

## 优势

### 1. 统一的配置体验
- 所有系统配置集中在一个页面
- 用户不需要跳转多个页面
- 更好的用户体验

### 2. 更清晰的配置流程
- 区分基础配置和完整凭证
- 两种获取 Refresh Token 的方式
- 实时状态反馈

### 3. 更强大的功能
- 凭证状态实时显示
- 双重验证机制
- 账户列表查看

### 4. 更好的代码维护性
- 减少重复代码
- 统一的 UI 组件
- 更清晰的代码结构

## 优化历史

### 2024年优化：简化 OAuth 流程

**优化内容**：
1. **移除手动凭证输入方式** - 删除了"方式2: 手动输入凭证"选项，简化用户决策
2. **整合 OAuth 流程** - OAuth 授权直接使用基础配置中的 Client ID，避免重复输入
3. **减少状态管理** - 删除了 7 个不必要的状态变量，提高代码可维护性

**影响**：
- 减少了 ~50 行代码
- 简化了用户操作流程，从 5 个步骤减少到 4 个步骤
- 降低了配置出错的可能性
- 提高了代码可维护性

**删除的状态变量**：
- `showOAuthForm` - OAuth 表单显示状态
- `oauthClientId` - 独立的 OAuth Client ID 输入
- `showManualCredentialForm` - 手动凭证表单状态
- `manualRefreshToken` - 手动输入的 Refresh Token
- `manualLoginCustomerId` - 手动输入的 Manager Customer ID
- `showRefreshToken` - Refresh Token 显示/隐藏状态
- `savingManualCredentials` - 手动凭证保存状态

**删除的函数**：
- `handleSaveManualGoogleAdsCredentials()` - 保存手动输入的凭证

## 总结

通过将 Google Ads 配置功能整合到主设置页面并持续优化，我们实现了：

✅ **简化导航** - 用户无需离开设置页面即可完成所有配置
✅ **增强功能** - 添加了凭证状态显示、双重验证、账户列表等功能
✅ **统一体验** - 与其他配置项保持一致的用户界面和交互方式
✅ **保持兼容** - 所有现有 API 和数据结构保持不变
✅ **减少维护** - 删除了冗余代码，提高了代码复用率
✅ **优化流程** - 简化了 OAuth 授权流程，减少用户操作步骤

用户现在可以在 `/settings` 页面通过更简洁的流程完成所有 Google Ads API 的配置、验证和账户管理操作！
