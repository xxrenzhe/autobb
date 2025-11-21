# 广告创意生成功能测试指南

**测试日期**: 2025-11-21
**测试目标**: 验证AI广告创意生成功能完整性和准确性
**预计时长**: 30-45分钟

---

## 📋 前置条件检查

### 1. AI配置验证

访问 http://localhost:3001/settings

**检查项**:
- [ ] **AI引擎配置** - "AI引擎"部分存在
- [ ] **Vertex AI配置** (推荐):
  - GCP项目ID: 已配置
  - GCP区域: 已配置
  - Service Account JSON: 已配置
- [ ] **或 Gemini API配置** (备选):
  - Gemini API密钥: 已配置
  - Gemini模型: gemini-2.5-pro 或 gemini-2.5-flash

**验证命令**:
```bash
# 检查system_settings表中的AI配置
sqlite3 /Users/jason/Documents/Kiro/autobb/data/autoads.db "
SELECT config_key, config_value
FROM system_settings
WHERE category = 'ai' AND user_id = 1
ORDER BY config_key;
"
```

**预期结果**: 至少配置了Vertex AI或Gemini API其中之一

---

### 2. 测试Offer准备

访问 http://localhost:3001/offers

**选择测试Offer**:
- 推荐使用 Offer ID: 29 (Reolink US)
- 或任意 `scrape_status = 'completed'` 的Offer

**验证Offer数据完整性**:
```bash
sqlite3 /Users/jason/Documents/Kiro/autobb/data/autoads.db "
SELECT
  id,
  offer_name,
  brand,
  scrape_status,
  length(unique_selling_points) as usps_len,
  length(product_highlights) as highlights_len
FROM offers
WHERE id = 29;
"
```

**预期结果**:
```
id: 29
offer_name: Reolink_US_01
brand: Reolink
scrape_status: completed
usps_len: >100 (有内容)
highlights_len: >100 (有内容)
```

---

## 🧪 测试用例执行

### TC-13-1: 单次创意生成

**目标**: 验证基础创意生成功能

**步骤**:
1. 访问 http://localhost:3001/offers
2. 找到测试Offer (ID: 29)
3. 点击"生成广告创意"按钮
4. 等待生成完成（预计30-60秒）

**API测试命令**:
```bash
curl -X POST http://localhost:3001/api/offers/29/generate-ad-creative \
  -H "Content-Type: application/json" \
  -H "Cookie: $(cat /tmp/autoads-cookie.txt)" \
  -d '{
    "theme": "品牌导向",
    "count": 1,
    "batch": false
  }' | jq '.'
```

**验证点**:
- [ ] **Headlines** (标题):
  - 数量: 15个
  - 长度: 每个 ≤30字符
  - 包含数字/百分比: ≥3个
  - 包含紧迫感词汇 (Limited, Now, Today, Save): ≥2个
- [ ] **Descriptions** (描述):
  - 数量: 4个
  - 长度: 每个 ≤90字符
  - 包含CTA词汇 (Shop, Buy, Get, Order): ≥2个
- [ ] **Keywords** (关键词):
  - 数量: 10-15个
  - 包含品牌词: Reolink 相关
  - 包含产品词: security camera, home security 等
- [ ] **Callouts** (附加信息):
  - 数量: 4-6个
  - 长度: 每个 ≤25字符
  - 内容真实有效 (如: Free Shipping, 2-Year Warranty)
- [ ] **Sitelinks** (站点链接):
  - 数量: 4个
  - text长度: ≤25字符
  - description长度: ≤35字符

**评分验证**:
- [ ] **总分**: 60-100分（低于60分需要重新生成）
- [ ] **评分细分**:
  - Relevance (相关性): 20-30分
  - Quality (质量): 18-25分
  - Engagement (吸引力): 15-25分
  - Diversity (多样性): 7-10分
  - Clarity (清晰度): 8-10分

**数据库验证**:
```bash
sqlite3 /Users/jason/Documents/Kiro/autobb/data/autoads.db "
SELECT
  id,
  offer_id,
  theme,
  score,
  ai_model,
  generation_round,
  json_array_length(headlines) as headline_count,
  json_array_length(descriptions) as desc_count,
  json_array_length(keywords) as keyword_count,
  creation_status
FROM ad_creatives
WHERE offer_id = 29
ORDER BY id DESC
LIMIT 1;
"
```

**预期结果**:
```
headline_count: 15
desc_count: 4
keyword_count: 10-15
score: 60-100
creation_status: draft
ai_model: vertex-ai:gemini-2.0-flash 或 gemini-api:gemini-2.5-pro
```

---

### TC-13-2: 批量创意生成（3个变体）

**目标**: 验证批量生成功能和多样性

**步骤**:
1. 在Offer详情页点击"批量生成"
2. 选择数量: 3
3. 选择不同主题:
   - 变体1: "品牌导向"
   - 变体2: "促销导向"
   - 变体3: "功能导向"
4. 点击生成

**API测试命令**:
```bash
curl -X POST http://localhost:3001/api/offers/29/generate-ad-creative \
  -H "Content-Type: application/json" \
  -H "Cookie: $(cat /tmp/autoads-cookie.txt)" \
  -d '{
    "count": 3,
    "batch": true,
    "themes": ["品牌导向", "促销导向", "功能导向"]
  }' | jq '.'
```

**验证点**:
- [ ] **生成数量**: 3个创意
- [ ] **主题差异**: 每个创意主题明确不同
- [ ] **Headlines差异**: 3个创意的Headlines重复率 <30%
- [ ] **Descriptions差异**: 3个创意的Descriptions重复率 <30%
- [ ] **Keywords差异**: 每个创意的Keywords侧重点不同
  - 品牌导向: 更多品牌词 (Reolink + 品牌相关)
  - 促销导向: 更多价格/优惠词 (Discount, Deal, Save)
  - 功能导向: 更多功能词 (4K, Night Vision, Motion Detection)
- [ ] **评分范围**: 所有创意评分 ≥60分

**多样性验证SQL**:
```bash
sqlite3 /Users/jason/Documents/Kiro/autobb/data/autoads.db "
SELECT
  id,
  theme,
  score,
  generation_round,
  substr(json_extract(headlines, '$[0]'), 1, 30) as first_headline,
  substr(json_extract(descriptions, '$[0]'), 1, 50) as first_desc
FROM ad_creatives
WHERE offer_id = 29 AND generation_round = 1
ORDER BY id DESC
LIMIT 3;
"
```

**预期结果**: 3条记录，每条的theme、first_headline、first_desc均不同

---

### TC-13-3: 创意质量评分

**目标**: 验证评分系统准确性

**步骤**:
1. 查看生成的创意评分
2. 检查评分细分 (score_breakdown)
3. 阅读评分解释 (score_explanation)

**验证命令**:
```bash
sqlite3 /Users/jason/Documents/Kiro/autobb/data/autoads.db "
SELECT
  id,
  score,
  json_extract(score_breakdown, '$.relevance') as relevance,
  json_extract(score_breakdown, '$.quality') as quality,
  json_extract(score_breakdown, '$.engagement') as engagement,
  json_extract(score_breakdown, '$.diversity') as diversity,
  json_extract(score_breakdown, '$.clarity') as clarity,
  score_explanation
FROM ad_creatives
WHERE offer_id = 29
ORDER BY id DESC
LIMIT 1;
"
```

**验证点**:
- [ ] **评分合理性**:
  - relevance (相关性): 检查是否包含品牌词和产品关键词
  - quality (质量): 检查长度合规性和格式正确性
  - engagement (吸引力): 检查紧迫感词汇和促销元素
  - diversity (多样性): 检查Headlines和Descriptions的去重率
  - clarity (清晰度): 检查是否有违规项（超长、过多关键词）
- [ ] **评分解释**: score_explanation 包含具体扣分/加分原因

---

### TC-13-4: 重新生成（Generation Round 2）

**目标**: 验证重新生成功能和配额限制

**步骤**:
1. 对已生成创意不满意
2. 点击"重新生成"按钮
3. 增加generation_round参数

**API测试命令**:
```bash
# 第二轮生成
curl -X POST http://localhost:3001/api/offers/29/generate-ad-creative \
  -H "Content-Type: application/json" \
  -H "Cookie: $(cat /tmp/autoads-cookie.txt)" \
  -d '{
    "theme": "限时优惠",
    "count": 2,
    "batch": true,
    "generation_round": 2
  }' | jq '.'
```

**验证点**:
- [ ] **Round标记**: generation_round = 2
- [ ] **配额限制**: 每轮最多3个创意
- [ ] **历史保留**: Round 1的创意仍然存在
- [ ] **对比分析**: Round 2的评分 ≥ Round 1的评分（优化效果）

**配额测试**:
```bash
# 尝试超过配额（第4个应该失败）
for i in {1..4}; do
  echo "尝试生成第 $i 个创意..."
  curl -X POST http://localhost:3001/api/offers/29/generate-ad-creative \
    -H "Content-Type: application/json" \
    -H "Cookie: $(cat /tmp/autoads-cookie.txt)" \
    -d '{
      "generation_round": 2
    }' | jq '.error'
done
```

**预期结果**: 第4个请求返回错误: "已达到此轮生成次数上限 (最多3个)"

---

### TC-13-5: AI模型切换测试

**目标**: 验证Vertex AI和Gemini API的切换

**步骤**:
1. 在/settings修改AI配置
2. 从Vertex AI切换到Gemini API
3. 重新生成创意
4. 验证ai_model字段

**切换到Gemini API**:
```bash
# 临时禁用Vertex AI（通过修改配置）
sqlite3 /Users/jason/Documents/Kiro/autobb/data/autoads.db "
UPDATE system_settings
SET config_value = 'false'
WHERE category = 'ai' AND config_key = 'use_vertex_ai' AND user_id = 1;
"
```

**生成创意**:
```bash
curl -X POST http://localhost:3001/api/offers/29/generate-ad-creative \
  -H "Content-Type: application/json" \
  -H "Cookie: $(cat /tmp/autoads-cookie.txt)" \
  -d '{"generation_round": 3}' | jq '.data.ai_model'
```

**预期结果**: ai_model = "gemini-api:gemini-2.5-pro" 或 "gemini-api:gemini-2.5-flash"

**切换回Vertex AI**:
```bash
sqlite3 /Users/jason/Documents/Kiro/autobb/data/autoads.db "
UPDATE system_settings
SET config_value = 'true'
WHERE category = 'ai' AND config_key = 'use_vertex_ai' AND user_id = 1;
"
```

---

## 🔍 进阶测试

### TC-13-6: 不同Offer类型测试

**测试不同类型的Offer**:

1. **亚马逊店铺** (多商品):
   - Offer ID: 29 (Reolink Store)
   - 验证: Keywords包含店铺相关词

2. **独立站店铺**:
   - 创建德国站独立站Offer
   - 验证: 推广语言=German，内容为德语

3. **单个商品**:
   - 创建单一商品Offer
   - 验证: Keywords更聚焦单一产品

**验证要点**:
- [ ] 不同类型Offer生成的创意风格匹配其类型
- [ ] 语言设置正确影响创意内容语言
- [ ] 关键词策略适配Offer类型

---

### TC-13-7: 错误处理测试

**测试场景1: Offer未完成抓取**
```bash
curl -X POST http://localhost:3001/api/offers/999/generate-ad-creative \
  -H "Content-Type: application/json" \
  -H "Cookie: $(cat /tmp/autoads-cookie.txt)"
```
**预期**: 返回 400 错误 "Offer信息抓取未完成"

**测试场景2: AI配置缺失**
```bash
# 临时清空AI配置
sqlite3 /Users/jason/Documents/Kiro/autobb/data/autoads.db "
UPDATE system_settings
SET config_value = NULL
WHERE category = 'ai' AND user_id = 1;
"

curl -X POST http://localhost:3001/api/offers/29/generate-ad-creative \
  -H "Content-Type: application/json" \
  -H "Cookie: $(cat /tmp/autoads-cookie.txt)"
```
**预期**: 返回错误 "AI配置未设置"，提示前往/settings配置

**测试场景3: 无效JSON响应**
- AI返回非JSON格式
- 预期: parseAIResponse() 处理markdown代码块并提取JSON

---

## 📊 测试结果汇总

### 通过标准

| 测试项 | 通过条件 |
|--------|---------|
| Headlines数量 | 15个 |
| Headlines长度 | 每个≤30字符 |
| Headlines质量 | 包含数字≥3个，紧迫感词汇≥2个 |
| Descriptions数量 | 4个 |
| Descriptions长度 | 每个≤90字符 |
| Keywords数量 | 10-15个 |
| Callouts数量 | 4-6个 |
| Sitelinks数量 | 4个 |
| 创意评分 | ≥60分 |
| 批量生成 | 3个变体，主题差异明显 |
| 多样性 | Headlines重复率<30% |
| 配额限制 | 每轮最多3个，第4个拒绝 |
| AI模型切换 | 正确识别并使用配置的AI |
| 错误处理 | 返回清晰错误提示 |

---

## 🐛 问题记录

### 发现的问题

| 问题ID | 严重级别 | 描述 | 状态 |
|--------|---------|------|------|
| | P0/P1/P2 | | 待修复/已修复 |

**问题模板**:
```
问题ID: CG-001
严重级别: P1
描述: Headlines包含中文字符超过30字符限制
复现步骤:
  1. 使用中文Offer生成创意
  2. 检查Headlines长度
预期: ≤30字符
实际: 35字符
状态: 待修复
```

---

## ✅ 测试完成检查清单

- [ ] TC-13-1: 单次创意生成 ✅
- [ ] TC-13-2: 批量创意生成 ✅
- [ ] TC-13-3: 创意质量评分 ✅
- [ ] TC-13-4: 重新生成和配额 ✅
- [ ] TC-13-5: AI模型切换 ✅
- [ ] TC-13-6: 不同Offer类型 ✅
- [ ] TC-13-7: 错误处理 ✅
- [ ] 所有通过标准达成 ✅
- [ ] 问题记录已整理 ✅
- [ ] 测试报告已生成 ✅

---

## 📝 测试报告生成

**生成测试报告命令**:
```bash
cat > /Users/jason/Documents/Kiro/autobb/claudedocs/CREATIVE_GENERATION_TEST_REPORT_$(date +%Y%m%d).md << 'EOF'
# 广告创意生成功能测试报告

**测试日期**: $(date +%Y-%m-%d)
**测试人员**: [Your Name]
**测试环境**: Local Development (localhost:3001)

## 测试结果汇总

| 测试用例 | 状态 | 备注 |
|---------|------|------|
| TC-13-1 | ✅ PASS |  |
| TC-13-2 | ✅ PASS |  |
| TC-13-3 | ✅ PASS |  |
| TC-13-4 | ✅ PASS |  |
| TC-13-5 | ✅ PASS |  |
| TC-13-6 | ✅ PASS |  |
| TC-13-7 | ✅ PASS |  |

## 问题列表
[记录发现的问题]

## 结论
[测试总结]

EOF
```

---

**最后更新**: 2025-11-21
**文档版本**: 1.0
