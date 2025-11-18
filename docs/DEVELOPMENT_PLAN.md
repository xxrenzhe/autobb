# 开发计划 (Development Plan)

## 文档概述

本文档详细规划AutoAds系统的开发实施计划，包括阶段划分、任务分解、时间估算、资源配置和风险管理。

---

## 一、总体规划

### 1.1 开发模式

- **开发方法**：敏捷开发（2周Sprint）
- **总周期**：12周（3个月）
- **团队配置**：
  - 前端开发：1人
  - 后端开发：1人（兼API集成）
  - UI/UX设计：0.5人（兼职）
  - QA测试：0.5人（兼职）
  - 产品经理：0.5人（兼职）

### 1.2 开发阶段

```
Phase 1: MVP核心功能 (5周)
  ├─ Sprint 1-2: 基础架构 + 用户认证 + Offer管理
  ├─ Sprint 3: AI创意生成服务
  └─ Sprint 4-5: Launch Score + Campaign创建 + A/B测试

Phase 2: 数据同步与可视化 (3周)
  ├─ Sprint 6: 后端数据同步服务
  └─ Sprint 7-8: Dashboard数据大盘

Phase 3: 增强功能 (3周)
  ├─ Sprint 9: 内容编辑 + 版本管理
  └─ Sprint 10: 合规检查 + 优化建议

Phase 4: 优化与上线 (2周)
  ├─ Sprint 11: 性能优化 + Bug修复
  └─ Sprint 12: 生产部署 + 文档完善
```

**重要更新**：
- 增加用户认证系统（Google OAuth + JWT + 数据隔离）
- 增加Launch Score投放评分功能（5维度评分）
- 所有数据改为后端SQLite存储，前端通过API调用
- 增加后端API开发任务（每个Sprint）

### 1.3 里程碑

| 里程碑 | 目标 | 完成日期 | 交付物 |
|--------|------|----------|--------|
| M1 | MVP功能完成 | Week 5 | 用户认证、Offer创建、AI生成、Launch Score、Campaign上线 |
| M2 | 数据能力完成 | Week 8 | 后端数据同步、Dashboard可视化 |
| M3 | 增强功能完成 | Week 11 | 编辑、版本、合规、优化 |
| M4 | 生产就绪 | Week 13 | 性能优化、部署上线 |

---

## 二、Phase 1: MVP核心功能 (5周)

### Sprint 1-2: 基础架构 + Offer管理 (2周)

#### Sprint 1.1: 项目初始化 (Week 1, Day 1-3)

**任务清单**：
- [ ] **T1.1.1** - 创建Next.js项目骨架
  - 初始化Next.js 14+ (App Router)
  - 配置TypeScript + ESLint + Prettier
  - 集成Tailwind CSS
  - 安装Shadcn/ui组件库
  - **工时**：0.5天
  - **负责人**：前端开发

- [ ] **T1.1.2** - 设置后端SQLite数据库
  - 安装SQLite3库（Go: github.com/mattn/go-sqlite3 或 Node.js: better-sqlite3）
  - 定义数据库Schema（用户表 + 7张业务表）
  - 创建数据库迁移脚本（golang-migrate或类似工具）
  - 实现数据库连接池和查询封装
  - **工时**：1.5天
  - **负责人**：后端开发

- [ ] **T1.1.2a** - 实现用户认证系统
  - 实现Google OAuth 2.0登录流程
  - JWT token生成和验证中间件
  - bcrypt密码加密（如支持邮箱登录）
  - AES-256-GCM OAuth令牌加密存储
  - 用户表CRUD API（/api/users）
  - **工时**：2天
  - **负责人**：后端开发

- [ ] **T1.1.2b** - 实现用户权限和数据隔离
  - 基于user_id的数据隔离中间件
  - 角色权限控制（admin/user）
  - API速率限制中间件
  - 套餐类型管理（年卡/终身/私有化/试用）
  - **工时**：1.5天
  - **负责人**：后端开发

- [ ] **T1.1.2c** - 前端认证状态管理
  - 实现登录/注册页面UI
  - JWT token存储和自动刷新
  - 认证状态管理（Zustand或Context）
  - 受保护路由组件（ProtectedRoute）
  - **工时**：1天
  - **负责人**：前端开发

- [ ] **T1.1.3** - UI设计系统搭建
  - 配置Shadcn/ui主题
  - 创建自定义颜色变量
  - 实现Layout组件（Header、Sidebar、Main）
  - 创建通用Button、Input、Card组件
  - **工时**：1天
  - **负责人**：UI/UX + 前端开发

**Sprint 1.1交付物**：
- ✅ 可运行的Next.js项目
- ✅ 后端SQLite数据库（用户表 + 业务表）
- ✅ 完整的用户认证系统（Google OAuth + JWT）
- ✅ 用户权限和数据隔离中间件
- ✅ 登录/注册页面和认证状态管理
- ✅ 基础UI组件库

---

#### Sprint 1.2: Offer管理功能 (Week 1, Day 4-5 + Week 2, Day 1-2)

**任务清单**：
- [ ] **T1.2.1** - Offer后端API开发
  - 实现Offers表CRUD API
    - POST /api/offers - 创建Offer
    - GET /api/offers - 获取Offer列表（支持分页、筛选、搜索）
    - GET /api/offers/:id - 获取Offer详情
    - PUT /api/offers/:id - 更新Offer
    - DELETE /api/offers/:id - 删除Offer
  - 实现user_id数据隔离验证
  - 字段验证中间件（品牌名、URL、关键词）
  - **工时**：1.5天
  - **负责人**：后端开发

- [ ] **T1.2.2** - Offer列表页面
  - 创建`/offers`页面
  - 调用GET /api/offers获取Offer列表
  - 显示卡片列表（品牌、描述、关键词、状态）
  - 实现筛选（状态、日期）和搜索
  - 添加"新建Offer"按钮
  - 前端缓存策略（TanStack Query）
  - **工时**：1天
  - **负责人**：前端开发

- [ ] **T1.2.3** - 创建Offer表单
  - 创建`/offers/new`页面
  - 实现表单组件（React Hook Form）
  - 字段验证（品牌名、产品描述、URL、关键词）
  - 关键词输入组件（支持添加、删除、分类）
  - 调用POST /api/offers保存数据
  - 错误处理和成功提示
  - **工时**：1.5天
  - **负责人**：前端开发

- [ ] **T1.2.4** - Offer详情与编辑
  - 创建`/offers/[id]`页面
  - 调用GET /api/offers/:id获取Offer信息
  - 实现编辑模式切换
  - 调用PUT /api/offers/:id更新数据
  - 添加删除确认对话框（调用DELETE API）
  - **工时**：1天
  - **负责人**：前端开发

- [ ] **T1.2.5** - 关键词分类逻辑
  - 实现关键词自动分类算法（品牌/产品/长尾）
  - 品牌词 → EXACT
  - 产品词（2-3词）→ PHRASE
  - 长尾词（≥4词）→ BROAD
  - 支持用户手动覆盖分类
  - 集成到Offer API（自动分类或手动覆盖）
  - **工时**：0.5天
  - **负责人**：后端开发

**Sprint 1.2交付物**：
- ✅ Offer后端API（CRUD + 数据隔离）
- ✅ Offer前端CRUD页面（列表、创建、详情、编辑）
- ✅ 关键词智能分类功能
- ✅ API错误处理和缓存策略

---

### Sprint 3-4: AI创意生成 + Campaign创建 (2周)

#### Sprint 3.1: AI创意生成服务 (Week 3)

**任务清单**：
- [ ] **T3.1.1** - 网站爬取服务
  - 安装Cheerio + Axios
  - 实现网站内容提取（title、description、h1、nav、usps）
  - 错误处理（timeout、403、404）
  - 测试10+真实网站
  - **工时**：1.5天
  - **负责人**：后端开发

- [ ] **T3.1.2** - AI模板生成（Fallback Level 2）
  - 集成Gemini 2.5 API（主引擎） + Claude 4.5 API（备用）
  - 设计Prompt模板（基于行业生成内容摘要）
  - 实现JSON响应解析
  - 错误处理与重试逻辑
  - **工时**：1天
  - **负责人**：后端开发

- [ ] **T3.1.3** - AI创意生成核心服务
  - 设计主Prompt（生成15 headlines + 4 descriptions + callouts + sitelinks）
  - 实现字符限制验证（30/90/25字符）
  - 实现3级Fallback策略
  - 质量评分算法（4维度评分）
  - **工时**：2天
  - **负责人**：后端开发

- [ ] **T3.1.4** - 创意生成后端API
  - POST /api/creatives/generate - 生成创意
  - GET /api/creatives/:id - 获取创意详情
  - PUT /api/creatives/:id - 更新创意内容
  - POST /api/creatives/:id/score - 重新计算质量评分
  - 存储到creative_versions表（SQLite）
  - user_id数据隔离
  - **工时**：1.5天
  - **负责人**：后端开发

- [ ] **T3.1.5** - 创意生成UI
  - 创建`/offers/[id]/generate-creative`页面
  - 调用POST /api/creatives/generate触发生成
  - 显示生成进度（Level 1 → Level 2 → Level 3）
  - 展示生成结果（预览格式）
  - 显示质量评分（0-100分）
  - 添加"重新生成"按钮
  - 支持编辑（inline editing）并调用PUT API
  - **工时**：1.5天
  - **负责人**：前端开发

**Sprint 3.1交付物**：
- ✅ 完整的AI创意生成服务（3级Fallback）
- ✅ 质量评分系统
- ✅ 创意生成后端API和前端UI
- ✅ 创意版本存储（SQLite）

---

#### Sprint 3.2: Campaign创建 (Week 4, Day 1-3)

**任务清单**：
- [ ] **T3.2.1** - Google Ads API集成基础
  - 安装`google-ads-api` SDK
  - 配置API凭据（Developer Token、Client ID/Secret）
  - 实现Token刷新逻辑
  - 创建Customer客户端封装
  - **工时**：1天
  - **负责人**：后端开发

- [ ] **T3.2.2** - Campaign创建10步流程
  - 实现CampaignCreator类
  - Step 1-10完整实现（Budget → Campaign → AdGroup → RSA → Keywords → Assets）
  - 错误处理与回滚逻辑
  - 进度回调机制
  - **工时**：2天
  - **负责人**：后端开发

- [ ] **T3.2.3** - Campaign创建UI
  - 创建"一键上广告"弹窗
  - 显示10步进度条
  - 实时显示每步状态（loading/success/error）
  - A/B测试变体选择（1-3个）
  - 预算配置（固定100/day）
  - 成功页面（显示Campaign链接）
  - **工时**：1.5天
  - **负责人**：前端开发

**Sprint 3.2交付物**：
- ✅ Google Ads API完整集成
- ✅ Campaign创建10步自动化流程
- ✅ 一键上广告UI

---

#### Sprint 3.3: Launch Score投放评分 (Week 4, Day 4-5)

**背景**：PRD Section 3.10定义的核心功能，评估Offer投放成功概率（0-100分）

**任务清单**：
- [ ] **T3.3.1** - Keyword Planner API集成
  - 实现Google Ads Keyword Planner API调用
  - 获取关键词搜索量、CPC、竞争度数据
  - 批量查询优化（一次查询多个关键词）
  - 结果缓存策略（24小时）
  - **工时**：1天
  - **负责人**：后端开发

- [ ] **T3.3.2** - Launch Score评分算法
  - 实现5个维度评分算法：
    1. 关键词质量分（30分）：搜索量、竞争度、相关性
    2. 产品市场契合度（25分）：行业匹配、目标受众
    3. 着陆页质量（20分）：页面速度、内容质量、移动友好
    4. 预算竞争力（15分）：CPC vs 预算、市场竞争力
    5. 广告内容潜力（10分）：创意质量评分、品牌一致性
  - 加权计算总分（0-100分）
  - 分级评定（A/B/C/D级）
  - **工时**：1.5天
  - **负责人**：后端开发

- [ ] **T3.3.3** - Launch Score后端API
  - POST /api/launch-scores/calculate - 计算Launch Score
  - GET /api/launch-scores/:offer_id - 获取Offer的Launch Score
  - 存储到launch_scores表（SQLite）
  - 关联offer_id和user_id
  - **工时**：1天
  - **负责人**：后端开发

- [ ] **T3.3.4** - Launch Score前端UI
  - 在Offer详情页显示Launch Score卡片
  - 展示总分、等级、5个维度细分
  - 可视化图表（雷达图或柱状图）
  - 显示改进建议（针对低分维度）
  - "重新计算"按钮
  - **工时**：1天
  - **负责人**：前端开发

**Sprint 3.3交付物**：
- ✅ Keyword Planner API集成
- ✅ Launch Score 5维度评分算法
- ✅ Launch Score后端API和前端UI
- ✅ 评分结果存储（SQLite）

---

#### Sprint 4: A/B测试与成本预估UI (Week 5, Day 1-2)

**任务清单**：
- [ ] **T4.1** - A/B测试变体生成
  - 实现3种创意变体策略（品牌/功能/价值导向）
  - 为每个变体生成独立创意内容
  - 创建独立Campaigns（每个100/day预算）
  - **工时**：1天
  - **负责人**：后端开发

- [ ] **T4.2** - 手动配置提示
  - Campaign创建完成后显示提示弹窗
  - 提示用户上传Images和Logo
  - 显示Google Ads控制台链接
  - 提供图片上传教程链接
  - **工时**：0.5天
  - **负责人**：前端开发

- [ ] **T4.3** - 成本预估和ROI预测UI
  - 在Offer详情页显示成本预估卡片
  - 调用Keyword Planner API数据（复用Sprint 3.3）
  - 显示预估花费、展示量、点击量
  - ROI预测（基于行业平均转化率）
  - **工时**：1天
  - **负责人**：前端开发

**Sprint 4交付物**：
- ✅ A/B测试变体创建功能
- ✅ 手动配置指引
- ✅ 成本预估与ROI预测UI

---

**Phase 1 验收标准**：
- [x] 用户认证系统完整（Google OAuth + JWT + 数据隔离）
- [x] 用户可以创建Offer并管理关键词（后端API + SQLite存储）
- [x] AI可以自动生成15个Headlines和4个Descriptions（3级Fallback）
- [x] 质量评分达到60+分
- [x] Launch Score功能完整（5维度评分 + A/B/C/D等级）
- [x] 一键创建完整Campaign并成功上线到Google Ads
- [x] 支持创建1-3个A/B测试变体
- [x] 成本预估和ROI预测展示
- [x] 提示用户手动上传Images和Logo

---

## 三、Phase 2: 数据同步与可视化 (3周)

### Sprint 5: 数据同步服务 (Week 6)

**任务清单**：
- [ ] **T5.1** - 后端数据同步服务
  - 实现`DataSyncService`后端服务
  - 调用Google Ads API查询性能数据（GAQL）
  - 批量写入SQLite数据库（campaign_performance表）
  - 实现定时同步任务（cron: 每5分钟）
  - 同步历史数据（90天）
  - **工时**：2天
  - **负责人**：后端开发

- [ ] **T5.1a** - 数据同步API
  - POST /api/sync/trigger - 手动触发同步
  - GET /api/sync/status - 获取同步状态
  - GET /api/sync/logs - 获取同步日志
  - user_id数据隔离（只同步用户自己的Campaigns）
  - **工时**：1天
  - **负责人**：后端开发

- [ ] **T5.1b** - 前端同步状态管理
  - 调用POST /api/sync/trigger手动触发同步
  - 轮询GET /api/sync/status获取同步进度
  - 同步状态管理（Zustand）
  - 前端自动刷新逻辑（页面加载时检查同步）
  - **工时**：1天
  - **负责人**：前端开发

- [ ] **T5.2** - GAQL查询优化
  - 设计高效GAQL查询语句
  - 实现日期范围查询（昨天、近7天、近30天、近90天）
  - SQLite索引优化（user_id + date, campaign_id + date）
  - 数据去重和更新逻辑（upsert）
  - **工时**：1天
  - **负责人**：后端开发

- [ ] **T5.3** - 数据保留策略
  - 实现90天数据清理逻辑（后端定时任务）
  - 定期清理过期数据（每天凌晨执行）
  - 数据库存储空间监控
  - **工时**：0.5天
  - **负责人**：后端开发

- [ ] **T5.4** - 同步状态UI
  - Header显示"最后同步时间"（从GET /api/sync/status获取）
  - 同步中显示Loading动画
  - 同步失败显示错误提示
  - 手动刷新按钮（调用POST /api/sync/trigger）
  - **工时**：0.5天
  - **负责人**：前端开发

- [ ] **T5.5** - 同步日志记录和展示
  - 后端记录每次同步操作（时间、账号、记录数、状态）
  - 存储到`sync_logs`表（SQLite）
  - 前端创建同步历史页面（调用GET /api/sync/logs）
  - **工时**：1天
  - **负责人**：后端开发 + 前端开发

**Sprint 5交付物**：
- ✅ 后端数据同步服务（定时 + 手动触发）
- ✅ 数据同步API（trigger + status + logs）
- ✅ 前端同步状态UI和手动刷新
- ✅ 90天数据保留策略（后端定时清理）
- ✅ 同步日志记录和展示（SQLite）

---

### Sprint 6: Dashboard数据大盘 (Week 7-8)

**任务清单**：
- [ ] **T6.1** - Dashboard数据聚合API
  - GET /api/dashboard/kpis - 获取核心KPI指标（展示、点击、花费、转化）
  - GET /api/dashboard/trends - 获取趋势数据（支持日期范围）
  - GET /api/dashboard/campaigns - 获取Campaign列表（支持排序、筛选、分页）
  - 从SQLite聚合性能数据（campaign_performance表）
  - 计算总计、平均值、环比变化
  - user_id数据隔离
  - **工时**：2天
  - **负责人**：后端开发

- [ ] **T6.2** - KPI卡片组件
  - 调用GET /api/dashboard/kpis获取指标数据
  - 设计4个核心指标卡片（展示、点击、花费、转化）
  - 显示数值和环比变化（+15% ↗）
  - 响应式布局（Grid 4列）
  - 动画效果（数字滚动）
  - **工时**：1天
  - **负责人**：前端开发

- [ ] **T6.3** - 趋势图表
  - 调用GET /api/dashboard/trends获取趋势数据
  - 集成Recharts库
  - 实现折线图（展示、点击、花费趋势）
  - 支持日期范围切换（7天/30天/90天）
  - 多指标对比显示
  - Tooltip交互
  - **工时**：1.5天
  - **负责人**：前端开发

- [ ] **T6.4** - Campaign列表
  - 调用GET /api/dashboard/campaigns获取列表数据
  - 显示所有Campaign的关键指标
  - 表格排序（按花费、点击、转化）
  - 筛选（状态、日期范围）
  - 搜索功能
  - 点击进入Campaign详情
  - 前端分页和缓存（TanStack Query）
  - **工时**：1天
  - **负责人**：前端开发

- [ ] **T6.5** - 智能洞察
  - 后端分析数据并生成3-5条洞察
  - 示例："Campaign A的CTR下降20%，建议优化创意"
  - 基于规则引擎（CTR异常、花费超标、转化率低）
  - GET /api/dashboard/insights - 获取智能洞察API
  - 前端显示为Alert卡片
  - **工时**：1.5天
  - **负责人**：后端开发 + 前端开发

**Sprint 6交付物**：
- ✅ Dashboard数据聚合后端API（KPIs + Trends + Campaigns + Insights）
- ✅ 完整的Dashboard数据大盘前端
- ✅ KPI卡片 + 趋势图表 + Campaign列表
- ✅ 智能洞察功能（后端规则引擎 + 前端展示）

---

**Phase 2 验收标准**：
- [x] 后端数据自动同步（定时任务 + 手动触发）
- [x] 数据同步API完整（trigger + status + logs）
- [x] Dashboard显示完整KPI和趋势（后端聚合 + 前端展示）
- [x] 智能洞察提供有价值的建议（规则引擎）
- [x] 90天历史数据可查询（SQLite存储 + 定时清理）
- [x] 所有数据基于user_id隔离

---

## 四、Phase 3: 增强功能 (3周)

### Sprint 7: 内容编辑 + 版本管理 (Week 8-9)

**任务清单**：
- [ ] **T7.1** - Inline内容编辑
  - 实现Headlines和Descriptions的inline编辑
  - 实时字符计数（30/90字符限制）
  - 保存到`creative_versions`表
  - Undo/Redo功能
  - **工时**：1.5天
  - **负责人**：前端开发

- [ ] **T7.2** - 版本管理系统
  - 存储每次生成和编辑的版本
  - 版本列表UI（时间、质量评分、来源）
  - 版本对比功能（diff view）
  - 回滚到历史版本
  - **工时**：2天
  - **负责人**：前端开发

- [ ] **T7.3** - 质量重新评分
  - 编辑后重新计算质量评分
  - 显示评分变化（72分 → 85分）
  - 评分详情展开（4维度细分）
  - **工时**：1天
  - **负责人**：后端开发

- [ ] **T7.4** - 批量编辑
  - 选择多个Headlines进行批量操作（删除、替换）
  - 批量调整关键词匹配类型
  - **工时**：1天
  - **负责人**：前端开发

**Sprint 7交付物**：
- ✅ 内容inline编辑功能
- ✅ 完整的版本管理系统
- ✅ 版本对比与回滚

---

### Sprint 8: 合规检查 + 优化建议 (Week 9-10)

**任务清单**：
- [ ] **T8.1** - 合规性检查规则引擎
  - 定义Google Ads政策违规规则（20+条）
  - 检查禁用词汇（夸大、绝对化、医疗声明）
  - 检查格式要求（大写、标点、符号）
  - 检查品牌一致性
  - **工时**：2天
  - **负责人**：后端开发

- [ ] **T8.2** - 合规检查UI
  - 生成创意后自动检查
  - 显示违规项列表（严重性：高/中/低）
  - 提供修正建议
  - 一键修复（自动替换违规内容）
  - **工时**：1天
  - **负责人**：前端开发

- [ ] **T8.3** - Google Ads Recommendations API集成
  - 实现`RecommendationsAPI`类
  - 获取智能优化建议
  - 分类（关键词、创意、出价、预算）
  - 存储到`optimization_recommendations`表
  - **工时**：1.5天
  - **负责人**：后端开发

- [ ] **T8.4** - 优化建议UI
  - 创建"优化建议"页面
  - 显示建议列表（类型、影响、操作）
  - 预估影响（+15% 点击，+¥500 花费）
  - 一键应用建议
  - 忽略/延后功能
  - **工时**：1.5天
  - **负责人**：前端开发

**Sprint 8交付物**：
- ✅ 合规性自动检查
- ✅ 智能优化建议（基于Google Ads API）
- ✅ 一键应用优化

---

**Phase 3 验收标准**：
- [x] 支持编辑所有创意内容
- [x] 版本历史完整可追溯
- [x] 自动检测政策违规
- [x] 显示Google Ads官方优化建议

---

## 五、Phase 4: 优化与上线 (2周)

### Sprint 9: 性能优化 + Bug修复 (Week 11)

**任务清单**：
- [ ] **T9.1** - 性能优化
  - 后端API响应优化（SQLite查询索引、连接池）
  - 前端大数据量分页加载
  - 图片懒加载
  - Code Splitting（路由级别）
  - Bundle Size优化（<500KB）
  - **工时**：2天
  - **负责人**：前端开发 + 后端开发

- [ ] **T9.2** - 缓存策略
  - TanStack Query配置（staleTime、cacheTime）
  - API响应缓存（后端Redis或内存缓存）
  - Google Ads API响应缓存（1小时）
  - **工时**：1天
  - **负责人**：前端开发 + 后端开发

- [ ] **T9.3** - 错误边界和日志
  - 实现React Error Boundary
  - 全局错误处理
  - 前端日志收集（可选：Sentry）
  - API错误重试机制
  - **工时**：1天
  - **负责人**：前端开发

- [ ] **T9.4** - Bug修复
  - 修复测试中发现的所有P0/P1 Bug
  - 回归测试
  - **工时**：1天
  - **负责人**：全员

**Sprint 9交付物**：
- ✅ 性能优化（首屏<2秒）
- ✅ 错误处理完善
- ✅ 所有P0/P1 Bug修复

---

### Sprint 10: 生产部署 + 文档完善 (Week 12)

**任务清单**：
- [ ] **T10.1** - 数据导出/导入功能
  - 实现完整数据导出（JSON格式）
  - 实现数据导入与合并逻辑
  - 验证数据完整性
  - UI提示（定期备份建议）
  - **工时**：1.5天
  - **负责人**：前端开发

- [ ] **T10.2** - 生产环境配置（Docker + GitHub Actions + ClawCloud）
  - Dockerfile多阶段构建配置
  - GitHub Actions CI/CD工作流设置
  - Docker镜像标签策略实现（prod-latest/prod-commitid/prod-tag）
  - 环境变量配置（.env.production）
  - ClawCloud服务器准备（Nginx反向代理 + SSL）
  - 健康检查端点实现（/api/health）
  - **工时**：2天
  - **负责人**：DevOps + 后端开发

- [ ] **T10.3** - 用户引导与帮助
  - 首次使用引导流程（Onboarding）
  - 帮助文档嵌入（每页Help按钮）
  - 视频教程录制（3-5分钟）
  - **工时**：1天
  - **负责人**：产品经理 + 前端开发

- [ ] **T10.4** - 最终测试
  - 完整端到端测试（E2E）
  - 多浏览器兼容性测试
  - 安全扫描
  - 性能压力测试
  - **工时**：1.5天
  - **负责人**：QA测试

- [ ] **T10.5** - 文档完善
  - 完善README.md
  - API文档补充
  - 部署文档更新
  - 用户手册最终版
  - **工时**：1天
  - **负责人**：产品经理

**Sprint 10交付物**：
- ✅ 生产环境部署完成
- ✅ 数据导出/导入功能
- ✅ 完整文档和教程
- ✅ 通过最终验收测试

---

**Phase 4 验收标准**：
- [x] 性能达标（首屏<2秒，交互<200ms）
- [x] 所有功能通过E2E测试
- [x] 生产环境稳定运行
- [x] 文档完整齐全

---

## 六、风险管理

### 6.1 技术风险

| 风险项 | 概率 | 影响 | 缓解措施 |
|--------|------|------|----------|
| Google Ads API配额限制 | 中 | 高 | 实现智能缓存和批量操作，申请更高配额 |
| SQLite数据库性能 | 低 | 中 | 优化索引和查询，实现90天数据保留 |
| AI API不稳定 | 高 | 中 | 3级Fallback策略，支持手动输入 |
| OAuth Token过期 | 中 | 高 | 自动刷新机制，失效后提示重新授权 |
| 浏览器兼容性问题 | 低 | 中 | 测试主流浏览器，提供降级方案 |

### 6.2 进度风险

| 风险项 | 概率 | 影响 | 缓解措施 |
|--------|------|------|----------|
| AI生成质量不达标 | 中 | 高 | 提前优化Prompt，增加测试样本 |
| Google Ads API文档不足 | 中 | 中 | 加入官方社区，查找示例代码 |
| 需求变更 | 中 | 中 | 控制范围，变更需经过评估 |
| 人力不足 | 低 | 高 | 优先级管理，必要时调整计划 |

### 6.3 业务风险

| 风险项 | 概率 | 影响 | 缓解措施 |
|--------|------|------|----------|
| Google政策变更 | 低 | 高 | 关注官方公告，快速适配 |
| 用户数据安全 | 低 | 高 | 加密存储，安全审计 |
| 用户接受度低 | 中 | 高 | Beta测试，收集反馈迭代 |

---

## 七、资源需求

### 7.1 人力资源

| 角色 | 投入时间 | 关键职责 |
|------|----------|----------|
| 前端开发 | 12周 × 5天/周 | UI开发、API调用、前端逻辑 |
| 后端开发 | 12周 × 5天/周 | API集成、AI服务、数据处理 |
| UI/UX设计 | 6周 × 2.5天/周 | 界面设计、交互设计 |
| QA测试 | 6周 × 2.5天/周 | 测试用例、质量保障 |
| 产品经理 | 12周 × 2.5天/周 | 需求管理、进度协调 |

### 7.2 技术资源

| 资源类型 | 用途 | 成本估算 |
|----------|------|----------|
| ClawCloud VPS | Docker托管（2核4GB） | $15-25/月 |
| Google Ads API | 必需 | 免费（Standard Access需申请） |
| Gemini 2.5 API | AI创意生成（主引擎） | ~$30/月（100创意/天） |
| Claude 4.5 API | AI创意生成（备用引擎） | ~$10/月（<10%使用率） |
| 域名 + SSL | 生产域名（Let's Encrypt） | ~$12/年 |
| GitHub | 代码仓库 + CI/CD | 免费（公开仓库） |
| 总计 | - | **~$55-65/月** + $12/年 |

**成本优化亮点**：
- Gemini 2.5比OpenAI GPT-4节省~70%成本（$30 vs $100+）
- ClawCloud比Vercel Pro更灵活且成本相近
- 总月度成本：**~$60**（vs原方案$135，节省55%）

### 7.3 时间资源

| 阶段 | 工时估算 | 日历时间 |
|------|----------|----------|
| Phase 1 | 80人日 | 4周 |
| Phase 2 | 45人日 | 3周 |
| Phase 3 | 45人日 | 3周 |
| Phase 4 | 30人日 | 2周 |
| **总计** | **200人日** | **12周** |

---

## 八、质量保证

### 8.1 代码质量标准

- **代码覆盖率**：≥70%（单元测试）
- **TypeScript**：100%类型覆盖
- **ESLint**：0 errors, <10 warnings
- **Performance Budget**：
  - FCP (First Contentful Paint) <1.5s
  - LCP (Largest Contentful Paint) <2.5s
  - TTI (Time to Interactive) <3.5s

### 8.2 测试策略

| 测试类型 | 覆盖范围 | 工具 |
|----------|----------|------|
| 单元测试 | 核心业务逻辑 | Jest + React Testing Library |
| 集成测试 | API调用、数据流 | Jest |
| E2E测试 | 关键用户流程 | Playwright |
| 性能测试 | 页面加载、交互响应 | Lighthouse |
| 安全测试 | XSS、CSRF、Token泄露 | OWASP ZAP |

### 8.3 发布检查清单

**Pre-Release Checklist**:
- [ ] 所有P0/P1 Bug已修复
- [ ] E2E测试通过率100%
- [ ] 性能指标达标
- [ ] 安全扫描无高危漏洞
- [ ] 生产环境配置验证
- [ ] 备份与回滚方案就绪
- [ ] 用户文档完善
- [ ] 监控和日志配置完成

---

## 九、发布计划

### 9.1 发布策略

- **Alpha版本** (Week 4): 内部团队测试
- **Beta版本** (Week 8): 邀请5-10个早期用户
- **RC版本** (Week 11): 功能冻结，仅修复Bug
- **正式版本** (Week 12): 公开发布

### 9.2 发布后计划

**Week 13-14: 监控与快速迭代**
- 收集用户反馈
- 修复紧急Bug
- 性能优化调整

**Week 15-16: 功能增强**
- 基于反馈优化功能
- 补充缺失功能
- 提升用户体验

---

## 十、成功指标

### 10.1 技术指标

- **系统稳定性**：99.5%可用性
- **API成功率**：≥95%
- **数据同步延迟**：<5分钟
- **页面性能**：Lighthouse Score ≥90

### 10.2 业务指标

- **用户激活率**：首次使用完成Offer创建 ≥80%
- **功能使用率**：AI生成使用率 ≥90%
- **Campaign成功率**：创建成功率 ≥95%
- **用户留存率**：7日留存 ≥60%

### 10.3 用户满意度

- **NPS (Net Promoter Score)**：≥50
- **用户反馈评分**：≥4.0/5.0
- **问题解决时间**：<24小时

---

## 附录：任务依赖图

```
Phase 1 Dependencies:
T1.1.1 (项目初始化)
  └─→ T1.1.2 (后端SQLite数据库设置)
  └─→ T1.1.2a (用户认证系统)
  └─→ T1.1.2b (用户权限和数据隔离)
  └─→ T1.1.2c (前端认证状态管理)
  └─→ T1.1.3 (UI设计系统)
      └─→ T1.2.1 (Offer后端API)
          └─→ T1.2.2 (Offer列表)
          └─→ T1.2.2 (创建Offer)
              └─→ T1.2.4 (关键词分类)
              └─→ T3.1.1 (网站爬取)
                  └─→ T3.1.2 (AI模板)
                      └─→ T3.1.3 (AI创意生成)
                          └─→ T3.1.4 (创意生成UI)
                              └─→ T3.2.1 (Google Ads API)
                                  └─→ T3.2.2 (Campaign创建)
                                      └─→ T3.2.3 (Campaign UI)

Phase 2 Dependencies:
T5.1 (同步服务) + T5.2 (GAQL优化)
  └─→ T6.1-T6.5 (Dashboard组件)

Phase 3 Dependencies:
T7.1 (Inline编辑)
  └─→ T7.2 (版本管理)
  └─→ T7.3 (质量评分)

T8.1 (合规规则)
  └─→ T8.2 (合规UI)

T8.3 (Recommendations API)
  └─→ T8.4 (优化建议UI)
```

---

## 总结

本开发计划覆盖AutoAds系统从MVP到生产上线的完整12周开发周期，包含：

1. **4个阶段**：MVP → 数据能力 → 增强功能 → 优化上线
2. **10个Sprint**：每个2周，明确交付物
3. **80+个任务**：详细时间估算和责任人
4. **风险管理**：识别12项关键风险并制定缓解措施
5. **质量保证**：完整的测试策略和发布检查清单

关键成功因素：
- ✅ 严格的进度管理和风险控制
- ✅ 高质量的代码和测试覆盖
- ✅ 及时的沟通和问题解决
- ✅ 用户反馈驱动的迭代优化
