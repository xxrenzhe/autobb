# Google Ads 凭证重新配置功能

## 问题
用户反馈：已配置凭证后，在 `/settings/google-ads-credentials` 页面看不到 OAuth 授权流程或重新配置选项。

## 原因
原有设计只在**未配置凭证**时显示配置表单（OAuth 和手动配置）。一旦用户配置完成后（`has_credentials: true`），这些配置选项就会被隐藏，用户无法更新或重新配置凭证。

## 解决方案

### 新增功能
在已配置凭证的状态下，添加了**"更新凭证"**按钮和重新配置表单。

### 实现细节

#### 1. 新增状态变量
```typescript
const [showReconfigureSection, setShowReconfigureSection] = useState(false)
```

#### 2. 添加"更新凭证"按钮
在已配置凭证的操作按钮区域（验证凭证、查看账户、删除凭证），新增：
```typescript
<Button
  onClick={() => setShowReconfigureSection(!showReconfigureSection)}
  variant="outline"
  className="flex items-center gap-2"
>
  <Key className="h-4 w-4" />
  {showReconfigureSection ? '隐藏配置' : '更新凭证'}
</Button>
```

#### 3. 重新配置表单部分
点击"更新凭证"后，在账户列表下方展开配置区域，包含：

**警告提示**：
```
⚠️ 注意：更新凭证将覆盖现有配置。请确保新凭证正确有效。
```

**方式1: OAuth授权流程（推荐）**
- "开始OAuth授权流程"按钮
- Client ID 输入框
- "启动OAuth授权"按钮（跳转到 Google 授权页面）

**方式2: 手动输入凭证**
- Client ID 输入框
- Client Secret 输入框（带显示/隐藏切换）
- Refresh Token 输入框（带显示/隐藏切换）
- Developer Token 输入框（带显示/隐藏切换）
- Manager Customer ID 输入框（可选）
- "保存配置"按钮

### 用户体验优化

1. **按钮状态切换**
   - 未展开：显示"更新凭证"
   - 已展开：显示"隐藏配置"

2. **视觉区分**
   - 使用 amber 色警告框提醒用户更新操作的影响
   - OAuth 表单使用 indigo 色背景突出推荐选项
   - 手动配置使用默认白色背景

3. **表单重用**
   - 重用现有的 OAuth 和手动配置表单逻辑
   - 重用相同的保存、验证函数
   - 保存成功后自动隐藏重新配置区域

## 完整用户流程

### 场景1: 首次配置凭证
1. 访问 `/settings/google-ads-credentials`
2. 看到"未配置 Google Ads API 凭证"提示
3. 选择 OAuth 授权或手动输入凭证
4. 完成配置

### 场景2: 已配置用户更新凭证
1. 访问 `/settings/google-ads-credentials`
2. 看到"已配置 Google Ads API 凭证"及当前状态
3. 点击"更新凭证"按钮
4. 展开重新配置区域，看到警告提示
5. 选择 OAuth 授权或手动输入凭证
6. 完成更新，新凭证覆盖旧凭证

### 场景3: 查看可访问账户
1. 访问 `/settings/google-ads-credentials`
2. 点击"查看可访问账户"按钮
3. 系统调用 `/api/google-ads/credentials/accounts` 获取账户列表
4. 显示所有可访问的 Google Ads 账户，包括：
   - 账户名称
   - Customer ID
   - Manager/Test 账户标识
   - 货币、时区
   - 账户状态

## 代码修改

### 文件：`src/app/(app)/settings/google-ads-credentials/page.tsx`

**修改位置1**: 添加状态变量（第65行）
```typescript
const [showReconfigureSection, setShowReconfigureSection] = useState(false)
```

**修改位置2**: 添加"更新凭证"按钮（第383-390行）
```typescript
<Button
  onClick={() => setShowReconfigureSection(!showReconfigureSection)}
  variant="outline"
  className="flex items-center gap-2"
>
  <Key className="h-4 w-4" />
  {showReconfigureSection ? '隐藏配置' : '更新凭证'}
</Button>
```

**修改位置3**: 添加重新配置表单（第480-676行）
- 警告提示框
- OAuth 授权流程表单
- 手动输入凭证表单

## 测试验证

### 功能测试清单
- [x] 未配置凭证时，显示配置选项
- [x] 已配置凭证时，显示当前状态和操作按钮
- [x] 点击"更新凭证"展开重新配置区域
- [x] OAuth 授权流程正常工作
- [x] 手动输入凭证表单验证正确
- [x] 保存凭证成功后隐藏重新配置区域
- [x] 查看可访问账户功能正常
- [x] 表单取消按钮清空输入并隐藏表单

### 边界情况测试
- [ ] 更新凭证时，OAuth 授权失败的处理
- [ ] 更新凭证时，手动输入无效凭证的错误提示
- [ ] 同时打开 OAuth 和手动配置表单（应该各自独立）
- [ ] 更新凭证后，原有可访问账户是否变化

## 相关文档

- [Google Ads Setup Guide](./GOOGLE_ADS_SETUP.md) - 完整配置指南
- [API Reference](./GOOGLE_ADS_USER_SETUP_COMPLETE.md) - API 端点文档
- [Verification Script](../scripts/verify-google-ads-config.ts) - 配置验证脚本

## 总结

通过添加"更新凭证"功能，解决了已配置用户无法重新配置的问题。用户现在可以：

1. **随时更新凭证** - 不需要先删除再重新配置
2. **使用 OAuth 授权** - 即使已有凭证，也可以通过 OAuth 重新获取 refresh_token
3. **手动更新** - 可以单独更新某个字段（如更换 Developer Token）

这样的设计既保持了系统的安全性，又提供了更好的用户体验。
