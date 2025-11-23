# Campaign创建修复方案
**日期**: 2025-11-22 下午
**状态**: ✅ 修复完成，待测试验证

---

## 根本原因确认

### 用户反馈（关键）
> "补充信息：广告的地理位置和语言需要和offer的信息保持一致"

**问题本质**: Campaign创建成功，但缺少必需的CampaignCriterion（地理位置和语言定位），导致Google Ads API拒绝创建。

---

## 修复实现

### 修改文件
`src/lib/google-ads-api.ts`

### 1. 添加地理位置和语言映射函数 (Lines 185-233)

```typescript
/**
 * 国家代码到Geo Target Constant ID的映射
 * 参考: https://developers.google.com/google-ads/api/reference/data/geotargets
 */
function getGeoTargetConstantId(countryCode: string): number | null {
  const geoTargetMap: Record<string, number> = {
    'US': 2840,   // United States
    'GB': 2826,   // United Kingdom
    'CA': 2124,   // Canada
    'AU': 2036,   // Australia
    'DE': 2276,   // Germany
    'FR': 2250,   // France
    'JP': 2392,   // Japan
    'CN': 2156,   // China
    'IN': 2356,   // India
    'BR': 2076,   // Brazil
    'MX': 2484,   // Mexico
    'ES': 2724,   // Spain
    'IT': 2380,   // Italy
    'KR': 2410,   // South Korea
    'RU': 2643,   // Russia
    'SG': 2702,   // Singapore
    'HK': 2344,   // Hong Kong
    'TW': 2158,   // Taiwan
  }

  return geoTargetMap[countryCode.toUpperCase()] || null
}

/**
 * 语言代码到Language Constant ID的映射
 * 参考: https://developers.google.com/google-ads/api/reference/data/codes-formats
 */
function getLanguageConstantId(languageCode: string): number | null {
  const languageMap: Record<string, number> = {
    'en': 1000,      // English
    'zh': 1017,      // Chinese (Simplified)
    'zh-CN': 1017,   // Chinese (Simplified)
    'zh-TW': 1018,   // Chinese (Traditional)
    'ja': 1005,      // Japanese
    'de': 1001,      // German
    'fr': 1002,      // French
    'es': 1003,      // Spanish
    'it': 1004,      // Italian
    'ko': 1012,      // Korean
    'ru': 1031,      // Russian
    'pt': 1014,      // Portuguese
    'ar': 1019,      // Arabic
    'hi': 1023,      // Hindi
  }

  return languageMap[languageCode.toLowerCase()] || null
}
```

### 2. Campaign创建后添加CampaignCriterion (Lines 271-328)

```typescript
// 4. 添加地理位置和语言定位条件（必需）
// 参考: https://developers.google.com/google-ads/api/docs/campaigns/search-campaigns/getting-started
const criteriaOperations: any[] = []

// 添加地理位置定位
if (params.targetCountry) {
  const geoTargetConstantId = getGeoTargetConstantId(params.targetCountry)
  if (geoTargetConstantId) {
    criteriaOperations.push({
      campaign: campaignResourceName,
      location: {
        geo_target_constant: `geoTargetConstants/${geoTargetConstantId}`
      }
    })
    console.log(`📍 添加地理位置定位: ${params.targetCountry} (${geoTargetConstantId})`)
  }
}

// 添加语言定位
if (params.targetLanguage) {
  const languageConstantId = getLanguageConstantId(params.targetLanguage)
  if (languageConstantId) {
    criteriaOperations.push({
      campaign: campaignResourceName,
      language: {
        language_constant: `languageConstants/${languageConstantId}`
      }
    })
    console.log(`🌐 添加语言定位: ${params.targetLanguage} (${languageConstantId})`)
  }
}

// 批量创建定位条件
if (criteriaOperations.length > 0) {
  try {
    await withRetry(
      () => customer.campaignCriteria.create(criteriaOperations),
      {
        maxRetries: 3,
        initialDelay: 1000,
        operationName: `Create Campaign Criteria for ${params.campaignName}`
      }
    )
    console.log(`✅ 成功添加${criteriaOperations.length}个定位条件`)
  } catch (error: any) {
    console.error('❌ 添加定位条件失败:', error.message)
    // 如果定位条件创建失败，删除已创建的Campaign以保持数据一致性
    try {
      await customer.campaigns.remove([campaignResourceName])
      console.log(`🗑️ 已删除Campaign ${campaignId}（因定位条件创建失败）`)
    } catch (rollbackError) {
      console.error('⚠️ Campaign删除失败:', rollbackError)
    }
    throw new Error(`Campaign定位条件创建失败: ${error.message}`)
  }
} else {
  console.warn('⚠️ 未提供地理位置或语言定位，Campaign可能无法正常投放')
}
```

### 3. 错误处理和数据一致性保护

**关键设计**:
- ✅ 如果CampaignCriterion创建失败，自动删除已创建的Campaign
- ✅ 确保数据库和Google Ads保持一致
- ✅ 带重试机制（最多3次）
- ✅ 详细的日志记录

---

## 参数测试页面

**目的**: 确定自动化上线广告需要配置哪些参数，哪些参数有默认值

**页面路径**: `/test/campaign-params`

**功能**:
1. 完整展示4个层级的参数：Campaign → Ad Group → Keywords → Ads
2. 明确标注必需参数、默认值参数、可选参数
3. 保存配置到 `/tmp/campaign-params-test.json`
4. 提供参数验证规则（如headlines 3-15个，每个最多30字符）

### 参数总结

#### 必需参数 (8个)
1. `campaignName` - 广告系列名称
2. `budgetAmount` - 预算金额（USD）
3. `budgetType` - 预算类型（DAILY/TOTAL）
4. `targetCountry` - 目标国家（2字母代码，如US）
5. `targetLanguage` - 目标语言（2字母代码，如en）
6. `adGroupName` - 广告组名称
7. `keywords` - 关键词列表（至少1个）
8. `finalUrls` - 最终链接

#### 默认值参数 (3个)
1. `status` - Campaign状态（默认: PAUSED，Google推荐）
2. `biddingStrategy` - 出价策略（默认: manual_cpc，Node.js库标准）
3. `adGroupStatus` - Ad Group状态（默认: ENABLED）

#### 可选参数 (5个)
1. `startDate` - 开始日期
2. `endDate` - 结束日期
3. `cpcBidMicros` - CPC手动出价
4. `path1` - 显示路径1
5. `path2` - 显示路径2

#### 验证规则
- **Headlines**: 3-15个，每个最多30字符
- **Descriptions**: 2-4个，每个最多90字符
- **Keywords**: 至少1个，支持BROAD/PHRASE/EXACT匹配类型

---

## 预期结果

✅ **Campaign创建**: 成功创建Campaign对象
✅ **定位条件**: 自动添加与offer一致的地理位置和语言定位
✅ **数据一致性**: 完整的错误回滚机制
✅ **日志记录**: 详细的创建过程日志

---

## 下一步测试

### 测试计划
1. 访问 `/test/campaign-params` 填写测试参数
2. 保存参数配置
3. 使用账号 5427414593 测试Campaign创建
4. 观察服务器日志确认：
   - ✅ Campaign创建成功
   - ✅ CampaignCriterion（geo + language）创建成功
   - ✅ 没有"required field not present"错误

### 验证清单
- [ ] Campaign在Google Ads中可见
- [ ] 地理位置定位正确（例如：United States）
- [ ] 语言定位正确（例如：English）
- [ ] Campaign状态为PAUSED
- [ ] 预算设置正确

---

## 技术债务清理

修复完成后需要清理的临时代码：

1. **删除调试日志** (`google-ads-api.ts` lines 246-250):
```typescript
// 🐛 DEBUG: 打印完整的Campaign对象用于调试
console.log('📋 创建Campaign的完整配置:', JSON.stringify(campaign, null, 2))
console.log('📋 Customer ID:', params.customerId)
console.log('📋 Target Country:', params.targetCountry)
console.log('📋 Target Language:', params.targetLanguage)
```

2. **更新TECHNICAL_SPEC.md**: 补充完整的Google Ads API集成流程

3. **添加错误排查指南**: 创建常见错误和解决方案文档
