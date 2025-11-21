# "一键上广告"功能实现进度

## ✅ 已完成功能（Phase 1）

### 1. 数据库Schema设计与实现 ✅
**文件**: `scripts/migrate-add-ad-creative-tables.ts`

**新增表格**：
- ✅ `ad_creatives` - 存储AI生成的广告创意（15个headlines, 4个descriptions, keywords, callouts, sitelinks）
- ✅ `google_ads_credentials` - 存储Google Ads OAuth凭证（client_id, client_secret, refresh_token, developer_token）
- ✅ `ad_performance` - 存储广告表现数据（impressions, clicks, conversions, cost等）
- ✅ `campaigns`表扩展 - 新增6个字段（ad_creative_id, google_campaign_id, google_ad_group_id等）

**执行状态**: ✅ 已成功执行迁移

---

### 2. AI广告创意生成核心功能 ✅
**文件**:
- `src/lib/ad-creative.ts` - 广告创意数据模型和评分算法
- `src/lib/ad-creative-generator.ts` - AI生成器（支持Vertex AI和Gemini API）

**功能特性**：
- ✅ AI模型优先级：Vertex AI（优先）→ Gemini API（备选）
- ✅ 如果都未配置，提示用户前往设置页面
- ✅ 生成完整广告创意：Headlines (15个) + Descriptions (4个) + Keywords (10-15个) + Callouts + Sitelinks
- ✅ 自动验证字符长度（Headlines ≤30, Descriptions ≤90）
- ✅ 利用Offer的增强数据（pricing, reviews, promotions, competitive_edges）

---

### 3. 广告创意评分系统 ✅
**文件**: `src/lib/ad-creative.ts` (calculateAdCreativeScore函数)

**评分维度**（满分100分）：
- ✅ 相关性 (30分) - 基于Offer关键词匹配度
- ✅ 质量 (25分) - Headlines和Descriptions的专业度
- ✅ 吸引力 (25分) - 优惠词汇、紧迫感、行动号召
- ✅ 多样性 (10分) - 去重检查
- ✅ 清晰度 (10分) - 长度限制验证

**输出**：总分 + 5个维度子分 + 详细评分说明

---

### 4. 广告创意对比分析 ✅
**文件**: `src/lib/ad-creative.ts` (compareAdCreatives函数)

**功能**：
- ✅ 支持对比2-3个广告创意
- ✅ 自动识别综合最佳、相关性最佳、吸引力最佳
- ✅ 生成推荐说明

---

### 5. 广告创意API接口 ✅
**文件**:
- `src/app/api/offers/[id]/generate-ad-creative/route.ts` - 生成和列表API
- `src/app/api/ad-creatives/[id]/select/route.ts` - 选择API
- `src/app/api/ad-creatives/compare/route.ts` - 对比API

**接口列表**：
```typescript
POST /api/offers/[id]/generate-ad-creative  // 生成广告创意
GET  /api/offers/[id]/generate-ad-creative  // 获取广告创意列表
POST /api/ad-creatives/[id]/select          // 选择广告创意
POST /api/ad-creatives/compare              // 对比多个广告创意
```

**特性**：
- ✅ 支持最多3轮生成
- ✅ 支持指定主题
- ✅ 支持参考历史表现数据
- ✅ 自动保存到数据库
- ✅ 完整的错误处理

---

### 6. Google Ads OAuth2认证流程 ✅
**文件**:
- `src/lib/google-ads-oauth.ts` - OAuth核心库
- `src/app/api/google-ads/oauth/start/route.ts` - 启动OAuth
- `src/app/api/google-ads/oauth/callback/route.ts` - OAuth回调
- `src/app/api/google-ads/credentials/route.ts` - 凭证管理
- `src/app/api/google-ads/credentials/verify/route.ts` - 凭证验证

**OAuth功能**：
- ✅ 生成授权URL（带state防CSRF）
- ✅ 处理OAuth回调获取tokens
- ✅ 交换authorization code获取access_token和refresh_token
- ✅ 自动刷新access_token（提前5分钟）
- ✅ 验证凭证有效性（调用Google Ads API测试）
- ✅ 完整的凭证CRUD操作

**安全特性**：
- ✅ State参数（包含user_id和timestamp，10分钟有效期）
- ✅ HTTPS强制（生产环境）
- ✅ 凭证加密存储（推荐）

---

### 7. 完整技术文档 ✅
**文件**:
- `docs/ONE_CLICK_AD_LAUNCH_GUIDE.md` - 完整功能指南（200+行）
- `docs/ONE_CLICK_AD_LAUNCH_PROGRESS.md` - 实现进度跟踪

**文档内容**：
- ✅ 四步流程详细说明
- ✅ API接口完整文档
- ✅ 数据库Schema说明
- ✅ 技术实现要点
- ✅ 测试流程指南
- ✅ 最佳实践建议

---

## 🚧 待实现功能（Phase 2）

### 1. 广告系列配置界面
**需要实现**：
- 📝 前端页面：`/offers/[id]/launch` （四步向导）
- 📝 Step 1: 生成广告创意 → 显示评分 → 对比选择
- 📝 Step 2: 配置Campaign/AdGroup/Ad参数
- 📝 Step 3: 关联Ads账号 → OAuth授权
- 📝 Step 4: 汇总确认 → 发布广告

**UI组件需求**：
- 步骤指示器（1/2/3/4）
- 广告创意卡片（显示headlines, descriptions, score）
- 对比视图（并排显示2-3个创意）
- 配置表单（Budget, CPC, Keywords等）
- OAuth授权弹窗
- 发布进度条

---

### 2. Offer与Ads账号关联
**需要实现**：
- 📝 关联界面（选择或创建Google Ads账号）
- 📝 账号列表展示（余额、状态、权限）
- 📝 账号管理功能（断开、重新授权）

---

### 3. 广告发布API（Google Ads API集成）
**需要实现**：
- 📝 `POST /api/offers/[id]/launch-ad` - 发布广告API
- 📝 创建Campaign Budget
- 📝 创建Campaign（设置final_url_suffix）
- 📝 创建Ad Group + Keywords
- 📝 创建Responsive Search Ad（设置final_url）
- 📝 启用Campaign和Ad Group

**技术要点**：
- 需要调用Google Ads API v16
- 使用Micro Units（金额×1,000,000）
- 正确配置Headers（Authorization, developer-token）
- 完整的错误处理和重试机制

**参考文档**：
- [Google Ads API文档](https://developers.google.com/google-ads/api/docs/start)
- [创建Campaign](https://developers.google.com/google-ads/api/docs/campaigns/create-campaigns)
- [创建Ad Group](https://developers.google.com/google-ads/api/docs/campaigns/create-ad-groups)
- [创建Responsive Search Ad](https://developers.google.com/google-ads/api/docs/responsive-search-ads/create-responsive-search-ads)

---

### 4. 暂停旧广告系列功能
**需要实现**：
- 📝 查询所有ENABLED状态的Campaigns
- 📝 批量设置status为PAUSED
- 📝 提供UI复选框："是否暂停现有广告系列"

---

### 5. 异步数据同步（后台任务）
**需要实现**：
- 📝 Ads账号状态检测（余额、权限、是否暂停）
- 📝 广告表现数据同步（Impressions, Clicks, Conversions, Cost）
- 📝 计算派生指标（CTR, CPC, Conversion Rate）
- 📝 归属到关联的Offer
- 📝 为AI创意生成提供真实投放数据

**实现方式**：
- Cron Job或后台Worker
- 同步频率：每小时或每天
- 使用Google Ads API的Report功能

---

### 6. 前端页面优化

#### 6.1 广告系列页面（/campaigns）
**新增展示**：
- 📝 关联的Offer信息
- 📝 使用的广告创意摘要
- 📝 实时表现数据（从ad_performance表）
- 📝 Google Ads链接（跳转到管理后台）

#### 6.2 创意管理页面（/creatives）
**功能**：
- 📝 查看所有生成的广告创意
- 📝 查看评分和评分说明
- 📝 对比不同创意
- 📝 标记最佳创意
- 📝 查看创意使用情况

#### 6.3 投放评分页面（/launch-score）
**整合**：
- 📝 将广告创意评分整合到Launch Score
- 📝 综合评分（创意+关键词+着陆页+预算+内容）
- 📝 雷达图展示
- 📝 改进建议

#### 6.4 Google Ads账号管理页面（/google-ads/accounts）
**功能**：
- 📝 查看所有连接的Ads账号
- 📝 显示账号状态
- 📝 管理OAuth凭证
- 📝 连接新账号
- 📝 断开账号

#### 6.5 设置页面扩展（/settings）
**新增配置项**：
- 📝 Vertex AI配置
- 📝 Gemini API配置
- 📝 Google Ads OAuth配置

---

## 📊 实现统计

### 已完成
- ✅ 数据库表：4个（ad_creatives, google_ads_credentials, ad_performance, campaigns扩展）
- ✅ 核心库文件：3个（ad-creative.ts, ad-creative-generator.ts, google-ads-oauth.ts）
- ✅ API路由：7个（生成、列表、选择、对比、OAuth启动/回调、凭证管理/验证）
- ✅ 功能完整度：后端核心功能 100%

### 待实现
- 📝 前端页面：6个（一键上广告、广告系列、创意管理、投放评分、账号管理、设置）
- 📝 Google Ads API集成：广告发布功能
- 📝 后台任务：数据同步功能
- 📝 功能完整度：前端UI 0%，广告发布 0%，数据同步 0%

### 整体进度
**总体完成度：约40%**
- Phase 1（后端基础）：✅ 100%
- Phase 2（前端UI）：📝 0%
- Phase 3（广告发布）：📝 0%
- Phase 4（数据同步）：📝 0%

---

## 🧪 测试指南

### 测试广告创意生成

```bash
# 1. 配置AI（在settings表或设置页面）
# Vertex AI: PROJECT_ID, LOCATION, MODEL
# 或 Gemini API: API_KEY, MODEL

# 2. 确保Offer已完成数据抓取
curl http://localhost:3000/api/offers/1 -H "Cookie: auth_token=YOUR_TOKEN"

# 3. 生成第1个广告创意
curl -X POST http://localhost:3000/api/offers/1/generate-ad-creative \
  -H "Content-Type: application/json" \
  -H "Cookie: auth_token=YOUR_TOKEN" \
  -d '{"generation_round": 1}'

# 4. 生成第2个广告创意（不同主题）
curl -X POST http://localhost:3000/api/offers/1/generate-ad-creative \
  -H "Content-Type: application/json" \
  -H "Cookie: auth_token=YOUR_TOKEN" \
  -d '{"generation_round": 1, "theme": "Black Friday特惠"}'

# 5. 获取所有创意
curl http://localhost:3000/api/offers/1/generate-ad-creative \
  -H "Cookie: auth_token=YOUR_TOKEN"

# 6. 对比两个创意
curl -X POST http://localhost:3000/api/ad-creatives/compare \
  -H "Content-Type: application/json" \
  -H "Cookie: auth_token=YOUR_TOKEN" \
  -d '{"creative_ids": [1, 2]}'

# 7. 选择最满意的创意
curl -X POST http://localhost:3000/api/ad-creatives/1/select \
  -H "Cookie: auth_token=YOUR_TOKEN"
```

### 测试Google Ads OAuth

```bash
# 1. 启动OAuth流程
curl "http://localhost:3000/api/google-ads/oauth/start?client_id=YOUR_CLIENT_ID" \
  -H "Cookie: auth_token=YOUR_TOKEN"

# 响应包含auth_url，复制URL到浏览器访问

# 2. 完成授权后，保存完整凭证
curl -X POST http://localhost:3000/api/google-ads/credentials \
  -H "Content-Type: application/json" \
  -H "Cookie: auth_token=YOUR_TOKEN" \
  -d '{
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "refresh_token": "REFRESH_TOKEN_FROM_OAUTH",
    "developer_token": "YOUR_DEVELOPER_TOKEN",
    "login_customer_id": "1234567890"
  }'

# 3. 验证凭证
curl -X POST http://localhost:3000/api/google-ads/credentials/verify \
  -H "Cookie: auth_token=YOUR_TOKEN"

# 4. 获取凭证状态
curl http://localhost:3000/api/google-ads/credentials \
  -H "Cookie: auth_token=YOUR_TOKEN"

# 5. 删除凭证
curl -X DELETE http://localhost:3000/api/google-ads/credentials \
  -H "Cookie: auth_token=YOUR_TOKEN"
```

---

## 📝 下一步建议

### 优先级1（核心功能）
1. 实现"一键上广告"前端流程页面（4步向导）
2. 实现广告发布API（Google Ads API集成）
3. 完善错误处理和用户反馈

### 优先级2（用户体验）
1. 优化广告系列页面（显示创意和表现数据）
2. 创建创意管理页面
3. 扩展设置页面（AI和Google Ads配置）

### 优先级3（数据驱动）
1. 实现后台数据同步功能
2. 整合Launch Score
3. A/B测试广告创意效果

---

## 🎯 关键技术决策

### 1. AI模型选择
- **决策**：优先使用Vertex AI，其次Gemini API
- **理由**：Vertex AI更稳定，适合企业级应用；Gemini API作为备选，降低门槛

### 2. 广告创意存储
- **决策**：使用JSON存储headlines, descriptions等数组
- **理由**：灵活性高，易于扩展；SQLite支持JSON查询

### 3. OAuth流程
- **决策**：使用server-side OAuth flow
- **理由**：更安全，client_secret不暴露在客户端

### 4. 评分算法
- **决策**：基于规则的评分系统（不使用AI）
- **理由**：快速、可解释、可调整；后续可以基于真实数据优化权重

### 5. Google Ads API
- **决策**：使用REST API而非gRPC
- **理由**：Next.js环境更适合REST；文档更丰富

---

## 💡 重要提醒

1. **AI配置必须**：用户必须先配置Vertex AI或Gemini API才能生成广告创意
2. **OAuth复杂性**：Google Ads OAuth需要用户提供4个凭证（Client ID, Secret, Developer Token, 可选Login Customer ID）
3. **字符限制**：严格遵守Google Ads字符限制（Headlines ≤30, Descriptions ≤90）
4. **Micro Units**：Google Ads API的金额使用micro units（需要×1,000,000）
5. **Rate Limiting**：注意Google Ads API的速率限制
6. **测试环境**：建议使用Google Ads测试账号进行开发测试

---

## 📚 相关文档

- **功能指南**: `docs/ONE_CLICK_AD_LAUNCH_GUIDE.md`
- **数据库迁移**: `scripts/migrate-add-ad-creative-tables.ts`
- **优化总结**: `docs/OPTIMIZATION_SUMMARY.md`

---

**最后更新**: 2025-11-20
**当前状态**: Phase 1完成，Phase 2-4待实现
**下次任务**: 实现前端"一键上广告"流程页面
