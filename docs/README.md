# AutoAds 项目文档

> **一键上广告** - Google Ads自动化创建与管理系统

欢迎来到AutoAds项目文档中心！本文档体系包含产品需求、设计方案、技术规格、开发计划、测试策略、部署指南和用户手册的完整内容。

---

## 📋 文档导航

### 🎯 产品与设计

#### [📄 产品需求文档 (PRD.md)](./PRD.md)
**适合阅读对象**：产品经理、项目经理、开发团队

**核心内容**：
- ✅ 6大核心功能详细说明
- ✅ 用户故事和使用场景
- ✅ 功能优先级和MVP范围
- ✅ 成功指标和验收标准
- ✅ 4阶段产品路线图

**关键亮点**：
- AI创意生成3级Fallback策略
- 一键上线10步自动化流程
- 前端IndexedDB无后端架构
- 高价值关键词智能推荐
- 同Offer多广告系列对比分析

**文档大小**：~5000字 | 预计阅读时间：20分钟

---

#### [🎨 产品设计文档 (PRODUCT_DESIGN.md)](./PRODUCT_DESIGN.md)
**适合阅读对象**：UI/UX设计师、前端开发、产品经理

**核心内容**：
- ✅ 完整的信息架构和导航结构
- ✅ 6个核心页面的详细设计
- ✅ ASCII布局原型图
- ✅ 组件设计规范
- ✅ 用户流程图
- ✅ 响应式设计方案

**关键页面设计**：
1. Dashboard数据大盘（KPI卡片 + 趋势图 + 智能洞察）
2. Offer列表和创建表单
3. AI创意生成界面
4. Campaign创建进度条
5. 成功页面与提示

**文档大小**：~4000字 | 预计阅读时间：15分钟

---

### 💻 技术与开发

#### [⚙️ 技术方案文档 (TECHNICAL_SPEC.md)](./TECHNICAL_SPEC.md)
**适合阅读对象**：技术架构师、后端开发、前端开发

**核心内容**：
- ✅ 系统架构设计（前端IndexedDB架构）
- ✅ IndexedDB完整Schema（7张表）
- ✅ 核心模块设计（AI生成、数据同步、Campaign创建）
- ✅ API集成方案（Google Ads API、Gemini 2.5、Claude 4.5）
- ✅ 安全实现（Token加密、CSP策略）
- ✅ Docker容器化部署方案

**技术栈**：
- Next.js 14+ (App Router)
- IndexedDB (idb库)
- Shadcn/ui + Tailwind CSS
- Zustand + TanStack Query
- Docker + GitHub Actions + ClawCloud

**文档大小**：~6000字 | 预计阅读时间：25分钟

---

#### [🔌 API集成文档 (API_INTEGRATION.md)](./API_INTEGRATION.md)
**适合阅读对象**：后端开发、API集成工程师

**核心内容**：
- ✅ Google Ads API完整集成（OAuth、Campaign创建、性能查询）
- ✅ AI API集成（Gemini + Claude）
- ✅ Token管理和刷新机制
- ✅ 错误处理和重试策略
- ✅ 完整的代码示例

**关键流程**：
1. OAuth 2.0认证完整流程
2. Campaign创建10步API调用
3. 性能数据GAQL查询
4. Recommendations API智能优化
5. AI创意生成Prompt工程

**文档大小**：~7000字 | 预计阅读时间：30分钟

---

#### [📅 开发计划 (DEVELOPMENT_PLAN.md)](./DEVELOPMENT_PLAN.md)
**适合阅读对象**：项目经理、开发团队、测试团队

**核心内容**：
- ✅ 12周开发周期规划（4个Phase）
- ✅ 10个Sprint详细任务分解
- ✅ 80+个具体任务（工时估算、责任人）
- ✅ 里程碑和验收标准
- ✅ 风险管理和资源需求

**开发阶段**：
- **Phase 1**（4周）：MVP核心功能
- **Phase 2**（3周）：数据同步与可视化
- **Phase 3**（3周）：增强功能
- **Phase 4**（2周）：优化与上线

**总工时**：200人日 | 团队配置：2个全职开发 + 3个兼职

**文档大小**：~8000字 | 预计阅读时间：35分钟

---

### ✅ 测试与质量

#### [🧪 测试计划 (TEST_PLAN.md)](./TEST_PLAN.md)
**适合阅读对象**：QA测试、开发团队、项目经理

**核心内容**：
- ✅ 完整的测试策略（单元、集成、E2E、性能、安全）
- ✅ 120+测试用例（含代码示例）
- ✅ 代码覆盖率目标（≥70%）
- ✅ CI/CD Pipeline集成
- ✅ 验收标准和Bug管理

**测试层次**：
```
        E2E测试 (10%)
    ┌─────────────┐
    │  Playwright │
    └─────────────┘

  集成测试 (30%)
┌─────────────────┐
│  Jest + MSW     │
└─────────────────┘

单元测试 (60%)
┌───────────────────────┐
│ Jest + RTL            │
└───────────────────────┘
```

**文档大小**：~6000字 | 预计阅读时间：25分钟

---

### 🚀 部署与运维

#### [📦 部署指南 (DEPLOYMENT.md)](./DEPLOYMENT.md)
**适合阅读对象**：DevOps工程师、系统管理员、开发团队

**核心内容**：
- ✅ Docker多阶段构建完整流程
- ✅ GitHub Actions CI/CD自动化
- ✅ ClawCloud服务器部署配置
- ✅ 环境变量配置详解
- ✅ Nginx反向代理 + SSL配置
- ✅ 监控、日志管理和故障恢复

**部署架构**：
- **开发环境**：localhost:3000
- **测试环境**：Docker容器（GitHub Actions CI）
- **生产环境**：ClawCloud服务器（Docker部署）

**部署流程**：
```
Push to main → GitHub Actions → Docker Build →
Push to ghcr.io → Manual Pull → Deploy to ClawCloud
```

**监控工具**：
- Docker logs + 日志聚合
- Health Check监控
- Nginx访问日志
- Lighthouse性能审计

**文档大小**：~7000字 | 预计阅读时间：30分钟

---

### 👤 用户文档

#### [📖 用户手册 (USER_GUIDE.md)](./USER_GUIDE.md)
**适合阅读对象**：终端用户、客户支持、产品培训

**核心内容**：
- ✅ 快速开始指南（15分钟上线首个广告）
- ✅ 完整功能使用教程（图文并茂）
- ✅ 常见问题FAQ
- ✅ 快捷键参考
- ✅ 更新日志

**主要章节**：
1. 连接Google Ads账号
2. 创建营销主张Offer
3. AI生成广告创意
4. 一键上线广告
5. 查看广告表现数据
6. 高级功能（合规检查、智能优化、高价值关键词）

**文档大小**：~7000字 | 预计阅读时间：30分钟

---

## 🗺️ 文档阅读路径

### 路径1：产品经理视角

```
1. PRD.md (了解产品需求和功能)
   ↓
2. PRODUCT_DESIGN.md (了解UI/UX设计)
   ↓
3. DEVELOPMENT_PLAN.md (了解开发计划和进度)
   ↓
4. USER_GUIDE.md (从用户视角理解产品)
```

**推荐阅读时长**：2-3小时

---

### 路径2：技术负责人视角

```
1. TECHNICAL_SPEC.md (了解系统架构)
   ↓
2. API_INTEGRATION.md (了解API集成方案)
   ↓
3. DEVELOPMENT_PLAN.md (了解开发任务分解)
   ↓
4. TEST_PLAN.md (了解质量保障)
   ↓
5. DEPLOYMENT.md (了解部署和运维)
```

**推荐阅读时长**：4-5小时

---

### 路径3：前端开发视角

```
1. PRODUCT_DESIGN.md (了解UI设计)
   ↓
2. TECHNICAL_SPEC.md (第三章：前端架构)
   ↓
3. API_INTEGRATION.md (前端部分)
   ↓
4. TEST_PLAN.md (单元测试和E2E测试)
```

**推荐阅读时长**：2-3小时

---

### 路径4：后端开发视角

```
1. TECHNICAL_SPEC.md (第四章：后端服务)
   ↓
2. API_INTEGRATION.md (完整阅读)
   ↓
3. TEST_PLAN.md (集成测试)
   ↓
4. DEPLOYMENT.md (Serverless Functions部署)
```

**推荐阅读时长**：3-4小时

---

### 路径5：QA测试视角

```
1. PRD.md (了解功能需求)
   ↓
2. TEST_PLAN.md (完整阅读)
   ↓
3. USER_GUIDE.md (理解用户使用流程)
   ↓
4. DEPLOYMENT.md (了解测试环境配置)
```

**推荐阅读时长**：2-3小时

---

### 路径6：终端用户视角

```
1. USER_GUIDE.md (完整阅读)
   ↓
2. PRD.md (可选：了解产品功能全貌)
```

**推荐阅读时长**：30-60分钟

---

## 📊 项目概览

### 核心功能

| 功能模块 | 说明 | 自动化程度 |
|---------|------|-----------|
| **Offer管理** | 创建和管理营销主张 | 半自动（需用户输入） |
| **AI创意生成** | 自动生成15个Headlines + 4个Descriptions | 全自动（3级Fallback） |
| **Campaign创建** | 10步自动创建完整Google Ads广告系列 | 全自动（仅图片需手动） |
| **数据同步** | 从Google Ads同步性能数据 | 自动（页面加载时） |
| **数据可视化** | Dashboard展示KPI、趋势图、洞察 | 全自动 |
| **智能优化** | 基于Google Ads Recommendations API | 半自动（需确认应用） |
| **高价值关键词** | 自动识别和推荐高ROI关键词 | 全自动 |
| **一键下线** | 自动检测并下线表现差的广告 | 半自动（需确认） |

### 技术亮点

1. **无后端数据库架构**
   - 所有数据存储在用户浏览器IndexedDB
   - 降低成本（无数据库服务费）
   - 数据隐私（不上传服务器）

2. **3级Fallback AI生成**
   - Level 1: 网站爬取分析
   - Level 2: AI模板生成
   - Level 3: 用户手动输入
   - 保证100%生成成功率

3. **智能关键词管理**
   - 自动分类（品牌词/产品词/长尾词）
   - 自动匹配类型（EXACT/PHRASE/BROAD）
   - 高价值关键词自动保存和推荐

4. **全自动Campaign创建**
   - 10步API调用自动化
   - 错误处理和重试机制
   - 实时进度显示

### 性能指标

| 指标 | 目标值 | 实现方式 |
|------|--------|----------|
| **首屏加载时间** | <2秒 | Next.js SSG + CDN |
| **AI生成速度** | <30秒 | 并行调用 + 缓存 |
| **Campaign创建** | <30秒 | Google Ads批量API |
| **数据同步** | <10秒 | GAQL查询优化 |
| **代码覆盖率** | ≥70% | Jest + Playwright |
| **Lighthouse评分** | ≥90 | 性能优化 |

### 成本估算

**开发成本**：
- 人力：2个全职开发 × 3个月 = 6人月
- 外包设计：约¥20,000
- 总成本：约¥150,000

**运营成本**（月）：
- ClawCloud VPS (2核4GB): $15-25
- Gemini 2.5 API: ~$30（100次生成/天）
- Claude 4.5 API: ~$10（<10%使用率，备用）
- 域名 + SSL (Let's Encrypt): $1/月
- GitHub (代码仓库 + CI/CD): $0（免费）
- **总计**: ~$56-66/月（约¥400-470/月）

**成本优化**：
- Gemini比OpenAI节省~70%（$30 vs $100+）
- 自托管比Vercel Pro灵活且成本相近
- 总成本相比原方案节省~50%

**ROI预估**：
- 节省人工广告创建时间：80%
- 提升广告质量评分：平均+15%
- 降低平均CPC：约10-15%

---

## 🔄 更新记录

### 文档版本历史

| 版本 | 日期 | 更新内容 | 更新人 |
|------|------|----------|--------|
| **v1.2.0** | 2024-02-01 | 新增5项功能需求（Offer对比、高价值关键词、一键下线、移除定时同步、AI改为Gemini+Claude） | 产品团队 |
| **v1.1.0** | 2024-01-15 | 完善测试计划和部署指南 | 技术团队 |
| **v1.0.0** | 2024-01-01 | 初始版本发布 | 全体团队 |

### 最新更新（v1.2.0）

**新增功能**：
1. ✨ **同Offer多广告系列对比**：Dashboard新增趋势图，对比同一Offer下多个Campaign的CTR、CPC、转化率
2. ✨ **高价值关键词库**：自动识别CTR≥5%且CPC低的关键词，保存到品牌关键词库，创建新Offer时智能推荐
3. ✨ **一键下线表现差的广告**：自动检测CTR<1.5%或CPC过高的Campaign，支持一键暂停投放
4. 🔧 **优化数据同步机制**：移除5分钟定时同步，改为仅页面加载时同步，避免频繁调用Google Ads API
5. 🔧 **AI生成引擎升级**：改用Gemini 2.5（主引擎）+ Claude 4.5（备用），成本降低70%，质量更稳定
6. 🚀 **部署架构升级**：从Vercel改为Docker + GitHub Actions + ClawCloud，更灵活可控

**文档更新**：
- 更新PRD.md：新增3项辅助功能
- 更新TECHNICAL_SPEC.md：调整数据同步架构，更新AI配置和部署方案
- 更新API_INTEGRATION.md：完整重写AI集成章节（Gemini 2.5 + Claude 4.5）
- 更新DEPLOYMENT.md：完整重写为Docker容器化部署方案
- 更新DEVELOPMENT_PLAN.md：更新Sprint 10部署任务和成本估算
- 更新TEST_PLAN.md：新增Docker构建和部署测试流程
- 更新USER_GUIDE.md：新增高价值关键词和一键下线使用教程

---

## 📞 联系方式

### 项目团队

| 角色 | 负责人 | 联系方式 |
|------|--------|----------|
| **产品经理** | Jason | product@autoads.com |
| **技术负责人** | TechLead | tech@autoads.com |
| **UI/UX设计** | Designer | design@autoads.com |
| **QA负责人** | QA Lead | qa@autoads.com |

### 获取帮助

- 📧 **技术支持**: support@autoads.com
- 💬 **用户反馈**: feedback@autoads.com
- 🐛 **Bug报告**: https://github.com/autoads/issues
- 📚 **在线文档**: https://docs.autoads.com

### 贡献指南

欢迎贡献代码和文档！

**贡献流程**：
1. Fork项目仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建Pull Request

**文档贡献**：
- 发现错别字或表述不清？提交Issue或PR修正
- 有更好的示例代码？欢迎贡献
- 补充缺失的说明？非常感谢

---

## 📜 许可证

本项目采用 MIT License

Copyright (c) 2024 AutoAds Team

---

## 🎯 下一步行动

### 对于项目经理：
1. ✅ 阅读PRD.md了解完整需求
2. ✅ 审查DEVELOPMENT_PLAN.md确认开发计划
3. ✅ 与团队沟通资源配置
4. ✅ 确认各阶段验收标准

### 对于开发团队：
1. ✅ 阅读TECHNICAL_SPEC.md理解系统架构
2. ✅ 阅读API_INTEGRATION.md了解API集成方案
3. ✅ 搭建本地开发环境
4. ✅ 按照DEVELOPMENT_PLAN.md开始Sprint 1

### 对于QA团队：
1. ✅ 阅读TEST_PLAN.md理解测试策略
2. ✅ 准备测试环境和数据
3. ✅ 编写测试用例
4. ✅ 配置CI/CD Pipeline

### 对于运维团队：
1. ✅ 阅读DEPLOYMENT.md了解Docker部署流程
2. ✅ 准备ClawCloud服务器和环境变量
3. ✅ 配置Nginx反向代理和SSL证书
4. ✅ 配置监控、日志聚合和告警
5. ✅ 制定应急预案和回滚策略

---

## 🙏 致谢

感谢所有为AutoAds项目做出贡献的团队成员！

特别感谢：
- Google Ads API团队提供强大的广告管理API
- Google AI团队提供高性价比的Gemini 2.5模型
- Anthropic团队提供高质量的Claude 4.5模型
- Docker和GitHub Actions提供优秀的CI/CD工具
- 开源社区提供丰富的工具和库

---

**AutoAds - 让Google Ads广告创建变得简单！🚀**

*最后更新时间：2024-02-01*
