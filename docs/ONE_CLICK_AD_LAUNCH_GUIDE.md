# "一键上广告"功能完整指南

## 📋 功能概述

"一键上广告"功能将广告创意生成、配置和发布整合为一个流畅的多步骤流程，帮助用户快速、高效地在Google Ads上投放广告。

## 🎯 四步流程

### 第一步：生成广告创意并评分

**功能描述**：
- AI自动分析Offer的产品信息、价格、评论、促销等数据
- 生成完整的广告创意：Headlines (15个) + Descriptions (4个) + Keywords + Callouts + Sitelinks
- 自动评分（0-100分）并解释评分依据
- 支持最多3轮生成，用户可对比选择最满意的创意

**AI模型优先级**：
1. **Vertex AI**（优先）- 企业级AI，更稳定
2. **Gemini API**（备选）- 若Vertex AI未配置
3. 若都未配置 → 提示用户前往设置页面配置

**评分维度**（满分100分）：
- **相关性** (30分): 与产品的匹配程度
- **质量** (25分): Headlines和Descriptions的专业度
- **吸引力** (25分): 用户点击意愿
- **多样性** (10分): 创意变化丰富程度
- **清晰度** (10分): 信息表达清晰度

**API接口**：
```typescript
// 生成广告创意
POST /api/offers/[id]/generate-ad-creative
{
  theme?: string,                    // 可选：指定主题
  generation_round?: number,         // 第几轮（1-3）
  reference_performance?: {          // 可选：参考历史数据
    best_headlines: string[],
    best_descriptions: string[],
    top_keywords: string[]
  }
}

// 获取广告创意列表
GET /api/offers/[id]/generate-ad-creative?generation_round=1

// 选择广告创意
POST /api/ad-creatives/[id]/select

// 对比广告创意
POST /api/ad-creatives/compare
{
  creative_ids: [1, 2, 3]           // 2-3个创意ID
}
```

**前端交互**：
1. 显示生成的广告创意内容（Headlines、Descriptions、Keywords等）
2. 显示评分（总分 + 5个维度的子分）
3. 显示评分说明
4. 提供"重新生成"按钮（最多3次）
5. 显示对比分析（如果有多个创意）
6. 用户选择满意的创意后进入第二步

---

### 第二步：配置广告系列参数

**功能描述**：
- 配置Campaign（广告系列）参数
- 配置Ad Group（广告组）参数
- 配置Ad（广告）参数
- 预览完整的广告配置

**配置项说明**：

#### Campaign（广告系列）级别
```typescript
{
  name: string,                      // 广告系列名称
  budget_amount_micros: number,      // 每日预算（微单位）
  target_country: string,            // 目标国家
  target_language: string,           // 目标语言
  bidding_strategy: string,          // 出价策略（如MAXIMIZE_CLICKS）
  final_url_suffix?: string,         // URL后缀（tracking参数）
  start_date?: string,               // 开始日期
  end_date?: string                  // 结束日期（可选）
}
```

#### Ad Group（广告组）级别
```typescript
{
  name: string,                      // 广告组名称
  cpc_bid_micros?: number,           // CPC出价（微单位）
  keywords: string[],                // 关键词列表
  negative_keywords?: string[]       // 否定关键词
}
```

#### Ad（广告）级别
```typescript
{
  headlines: string[],               // 从选中的创意中获取
  descriptions: string[],            // 从选中的创意中获取
  final_url: string,                 // 最终落地页URL（Ad层级）
  path1?: string,                    // URL显示路径1
  path2?: string,                    // URL显示路径2
  callouts?: string[],               // 标注
  sitelinks?: Array<{                // 站点链接
    text: string,
    url: string,
    description?: string
  }>
}
```

**重要提示**：
- **Final URL** 配置在 **Ad层级**
- **Final URL Suffix** 配置在 **Campaign层级**

**前端交互**：
1. 显示自动填充的默认配置（基于Offer和选中的创意）
2. 允许用户修改配置参数
3. 实时校验参数有效性
4. 显示预算估算和预期效果
5. 提供"预览广告"功能
6. 配置完成后进入第三步

---

### 第三步：关联Ads账号并授权

**功能描述**：
- 选择或创建Google Ads账号关联
- 完成OAuth2授权流程
- 验证账号权限
- 确保可以发布广告

**OAuth流程**：

#### 前置准备
用户需要提供：
- **Client ID** - 从Google Cloud Console获取
- **Client Secret** - 从Google Cloud Console获取
- **Developer Token** - 从Google Ads账户获取
- **Login Customer ID**（可选）- Manager账号ID

#### 授权步骤
1. 用户点击"连接Google Ads"
2. 系统生成OAuth授权URL
3. 跳转到Google授权页面
4. 用户同意授权
5. 回调并获取tokens（access_token + refresh_token）
6. 保存凭证到数据库
7. 验证凭证有效性

**API接口**：
```typescript
// 启动OAuth流程
GET /api/google-ads/oauth/start?client_id=xxx

// OAuth回调（自动处理）
GET /api/google-ads/oauth/callback?code=xxx&state=xxx

// 保存凭证
POST /api/google-ads/credentials
{
  client_id: string,
  client_secret: string,
  refresh_token: string,
  developer_token: string,
  login_customer_id?: string,
  access_token?: string
}

// 验证凭证
POST /api/google-ads/credentials/verify

// 获取凭证状态
GET /api/google-ads/credentials

// 删除凭证
DELETE /api/google-ads/credentials
```

**前端交互**：
1. 显示已连接的Ads账号列表
2. 提供"连接新账号"按钮
3. 显示授权进度
4. 显示授权状态（成功/失败）
5. 允许测试API连接
6. 授权成功后进入第四步

---

### 第四步：汇总并发布广告

**功能描述**：
- 汇总所有配置信息
- 提供"是否暂停现有广告系列"选项
- 点击"发布广告"执行以下操作：
  1. （可选）暂停该Ads账号下的所有现有广告系列
  2. 创建新的Campaign
  3. 创建Ad Group并添加Keywords
  4. 创建Responsive Search Ad
  5. 启用Campaign和Ad Group
- 显示发布进度和结果

**API接口**（待实现）：
```typescript
// 发布广告
POST /api/offers/[id]/launch-ad
{
  ad_creative_id: number,            // 选中的广告创意ID
  campaign_config: {
    name: string,
    budget_amount_micros: number,
    target_country: string,
    target_language: string,
    bidding_strategy: string,
    final_url_suffix?: string
  },
  ad_group_config: {
    name: string,
    cpc_bid_micros?: number,
    keywords: string[],
    negative_keywords?: string[]
  },
  pause_old_campaigns: boolean,      // 是否暂停旧广告系列
  google_ads_account_id: number      // 使用的Ads账号ID
}
```

**发布流程**（Google Ads API操作）：
1. 验证Ads账号凭证
2. 获取有效的Access Token
3. 如果 `pause_old_campaigns = true`:
   - 查询所有ENABLED状态的Campaigns
   - 批量设置status为PAUSED
4. 创建Campaign Budget
5. 创建Campaign（设置final_url_suffix）
6. 创建Ad Group
7. 添加Keywords到Ad Group
8. 创建Responsive Search Ad（设置final_url）
9. 启用Campaign和Ad Group
10. 保存关联关系到数据库

**前端交互**：
1. 显示完整的配置汇总
2. 显示"暂停现有广告系列"复选框
3. 显示风险提示
4. 提供"发布广告"按钮
5. 显示发布进度条
6. 显示发布结果（成功/失败/部分成功）
7. 提供查看已发布广告的链接
8. 显示后续操作建议

---

## 🔄 后续异步操作

### 1. Ads账号状态检测
- 定期检查账号余额
- 检查账号是否被暂停
- 检查API权限是否有效
- 归属到关联的Offer

### 2. 广告表现数据同步
- 每小时/每天同步广告数据
- 同步指标：Impressions、Clicks、Conversions、Cost
- 计算CTR、CPC、Conversion Rate
- 归属到关联的Offer
- 为AI创意生成提供真实投放数据

**数据库表**：
```sql
CREATE TABLE ad_performance (
  id INTEGER PRIMARY KEY,
  campaign_id INTEGER,              -- 关联campaigns表
  offer_id INTEGER,                 -- 归属Offer
  user_id INTEGER,
  google_campaign_id TEXT,          -- Google Ads Campaign ID
  google_ad_group_id TEXT,
  google_ad_id TEXT,
  date TEXT,                        -- 数据日期
  impressions INTEGER,
  clicks INTEGER,
  conversions REAL,
  cost_micros INTEGER,
  ctr REAL,                         -- 计算得出
  cpc_micros INTEGER,               -- 计算得出
  conversion_rate REAL,             -- 计算得出
  raw_data TEXT,                    -- 完整JSON数据
  synced_at TEXT,
  created_at TEXT
)
```

---

## 📊 数据库Schema

### ad_creatives（广告创意表）
```sql
CREATE TABLE ad_creatives (
  id INTEGER PRIMARY KEY,
  offer_id INTEGER,
  user_id INTEGER,
  headlines TEXT,                   -- JSON数组
  descriptions TEXT,                -- JSON数组
  keywords TEXT,                    -- JSON数组
  callouts TEXT,                    -- JSON数组
  sitelinks TEXT,                   -- JSON数组
  final_url TEXT,
  final_url_suffix TEXT,
  score REAL,                       -- 总评分
  score_breakdown TEXT,             -- JSON: 5个维度评分
  score_explanation TEXT,           -- 评分说明
  generation_round INTEGER,         -- 第几轮生成
  theme TEXT,                       -- 广告主题
  ai_model TEXT,                    -- 使用的AI模型
  is_selected INTEGER,              -- 是否被选中
  created_at TEXT,
  updated_at TEXT
)
```

### google_ads_credentials（OAuth凭证表）
```sql
CREATE TABLE google_ads_credentials (
  id INTEGER PRIMARY KEY,
  user_id INTEGER UNIQUE,
  client_id TEXT,
  client_secret TEXT,
  refresh_token TEXT,
  access_token TEXT,
  developer_token TEXT,
  login_customer_id TEXT,
  access_token_expires_at TEXT,
  is_active INTEGER,
  last_verified_at TEXT,
  created_at TEXT,
  updated_at TEXT
)
```

### campaigns表（扩展字段）
新增字段：
- `ad_creative_id` - 关联的广告创意ID
- `google_campaign_id` - Google Ads Campaign ID
- `google_ad_group_id` - Google Ads Ad Group ID
- `google_ad_id` - Google Ads Ad ID
- `campaign_config` - Campaign配置（JSON）
- `pause_old_campaigns` - 是否暂停旧广告系列

---

## 🛠️ 技术实现要点

### 1. AI创意生成
- **优先级**: Vertex AI > Gemini API
- **配置检查**: 启动前验证AI配置是否存在
- **Prompt工程**: 详细的产品信息 + 增强数据（pricing, reviews, promotions）
- **输出验证**: 严格校验字符长度限制（Headlines ≤ 30, Descriptions ≤ 90）

### 2. 评分算法
- 基于Offer数据计算相关性
- 分析文案质量（长度、关键词、特殊符号）
- 评估吸引力（优惠词汇、紧迫感、行动号召）
- 检查多样性（去重）
- 验证清晰度（长度限制）

### 3. OAuth安全
- 使用state参数防止CSRF攻击
- State包含user_id和timestamp，10分钟有效期
- Tokens存储加密（生产环境建议加密）
- Access Token自动刷新机制（提前5分钟）

### 4. Google Ads API调用
- 遵循Google Ads API v16规范
- 正确配置Headers：Authorization、developer-token
- 使用Micro Units（金额 × 1,000,000）
- 错误处理和重试机制

---

## 📝 前端页面优化建议

### 1. "一键上广告"主流程页面
路径：`/offers/[id]/launch`

**页面结构**：
- 步骤指示器（Step 1/2/3/4）
- 当前步骤内容区域
- 操作按钮（下一步、上一步、取消）
- 右侧预览面板（实时显示配置）

### 2. 广告系列页面优化
路径：`/campaigns`

**新增展示**：
- 关联的Offer信息
- 使用的广告创意摘要
- 实时表现数据（从ad_performance表）
- Google Ads链接（跳转到Google Ads管理后台）

### 3. 创意管理页面
路径：`/creatives` 或 `/offers/[id]/creatives`

**功能**：
- 查看所有生成的广告创意
- 查看评分和评分说明
- 对比不同创意
- 标记最佳创意
- 查看创意使用情况（哪些Campaign使用了）

### 4. 投放评分页面
路径：`/launch-score`

**整合**：
- 将广告创意评分整合到Launch Score
- 综合考虑创意质量、关键词质量、着陆页质量等
- 提供改进建议

### 5. Google Ads账号管理页面
路径：`/google-ads/accounts`

**功能**：
- 查看所有连接的Ads账号
- 显示账号状态（余额、权限、最后同步时间）
- 管理OAuth凭证
- 连接新账号
- 断开账号

### 6. 设置页面扩展
路径：`/settings`

**新增配置项**：
- Vertex AI配置（Project ID、Location、Model）
- Gemini API配置（API Key、Model）
- Google Ads OAuth配置（Client ID、Client Secret、Developer Token）

---

## ✅ 已完成功能

1. ✅ 数据库Schema设计和迁移
2. ✅ AI广告创意生成核心库
3. ✅ 广告创意评分算法
4. ✅ 广告创意对比分析
5. ✅ 广告创意生成API
6. ✅ 广告创意选择API
7. ✅ 广告创意对比API
8. ✅ Google Ads OAuth核心库
9. ✅ Google Ads OAuth流程API
10. ✅ Google Ads凭证管理API

## 🚧 待实现功能

1. ⏳ 广告系列配置界面（Campaign/AdGroup/Ad参数）
2. ⏳ Offer与Ads账号关联功能
3. ⏳ 广告发布API（调用Google Ads API创建Campaign/AdGroup/Ad）
4. ⏳ 暂停旧广告系列功能
5. ⏳ 异步数据同步（Ads账号状态、广告表现数据）
6. ⏳ 前端"一键上广告"流程页面
7. ⏳ 前端广告系列、创意管理等页面优化

---

## 🧪 测试流程

### 测试准备
1. 配置Vertex AI或Gemini API（在settings表）
2. 准备Google Cloud OAuth Client ID和Secret
3. 准备Google Ads Developer Token
4. 创建测试Offer并完成数据抓取

### 测试步骤

#### 第一步：测试广告创意生成
```bash
# 生成第1轮创意
curl -X POST http://localhost:3000/api/offers/1/generate-ad-creative \
  -H "Content-Type: application/json" \
  -H "Cookie: auth_token=YOUR_TOKEN" \
  -d '{"generation_round": 1}'

# 生成第2轮创意（不同主题）
curl -X POST http://localhost:3000/api/offers/1/generate-ad-creative \
  -H "Content-Type: application/json" \
  -H "Cookie: auth_token=YOUR_TOKEN" \
  -d '{"generation_round": 2, "theme": "节日促销"}'

# 获取所有创意
curl http://localhost:3000/api/offers/1/generate-ad-creative \
  -H "Cookie: auth_token=YOUR_TOKEN"

# 对比创意
curl -X POST http://localhost:3000/api/ad-creatives/compare \
  -H "Content-Type: application/json" \
  -H "Cookie: auth_token=YOUR_TOKEN" \
  -d '{"creative_ids": [1, 2]}'

# 选择创意
curl -X POST http://localhost:3000/api/ad-creatives/1/select \
  -H "Cookie: auth_token=YOUR_TOKEN"
```

#### 第二步：测试Google Ads OAuth
```bash
# 获取OAuth授权URL
curl "http://localhost:3000/api/google-ads/oauth/start?client_id=YOUR_CLIENT_ID" \
  -H "Cookie: auth_token=YOUR_TOKEN"

# 访问返回的auth_url，完成授权后会自动回调

# 保存完整凭证
curl -X POST http://localhost:3000/api/google-ads/credentials \
  -H "Content-Type: application/json" \
  -H "Cookie: auth_token=YOUR_TOKEN" \
  -d '{
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "refresh_token": "YOUR_REFRESH_TOKEN",
    "developer_token": "YOUR_DEVELOPER_TOKEN",
    "login_customer_id": "1234567890"
  }'

# 验证凭证
curl -X POST http://localhost:3000/api/google-ads/credentials/verify \
  -H "Cookie: auth_token=YOUR_TOKEN"

# 获取凭证状态
curl http://localhost:3000/api/google-ads/credentials \
  -H "Cookie: auth_token=YOUR_TOKEN"
```

---

## 📚 参考文档

- [Google Ads API文档](https://developers.google.com/google-ads/api/docs/start)
- [Responsive Search Ads创建指南](https://developers.google.com/google-ads/api/docs/responsive-search-ads/create-responsive-search-ads)
- [Google OAuth 2.0文档](https://developers.google.com/identity/protocols/oauth2)
- [Vertex AI文档](https://cloud.google.com/vertex-ai/docs)
- [Gemini API文档](https://ai.google.dev/gemini-api/docs)

---

## 💡 最佳实践

### 1. AI创意生成
- 提供详细的产品信息（使用增强数据）
- 设置合理的temperature（0.8-1.0）以保证创意性
- 验证输出格式和字符长度
- 保存生成历史用于优化

### 2. 评分算法
- 基于实际投放数据持续优化评分权重
- 结合用户反馈调整评分标准
- 提供详细的评分说明帮助用户理解

### 3. OAuth安全
- 永远不要在客户端暴露client_secret
- 使用HTTPS进行所有OAuth通信
- 定期刷新access_token
- 提供撤销授权功能

### 4. 广告发布
- 在发布前进行完整的参数验证
- 提供详细的错误信息
- 支持部分成功的情况（如Campaign创建成功但Ad创建失败）
- 记录完整的操作日志用于问题排查

### 5. 数据同步
- 使用批量API减少请求次数
- 设置合理的同步频率（避免超出配额）
- 处理API限流和重试
- 归档历史数据以节省存储空间
