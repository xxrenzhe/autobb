# CPC建议功能实现报告

## 功能概述

实现了完整的CPC（Cost Per Click）建议功能，通过产品价格和佣金比例自动计算建议最大CPC，帮助用户优化广告投放成本。

**计算公式**: 最大CPC = 产品价格 × 佣金比例 ÷ 50（按50个点击出一单计算）

## 实现内容

### 1. 数据库更新

**文件**: `scripts/migrations/003_add_offer_pricing_fields.sql`

```sql
ALTER TABLE offers ADD COLUMN product_price TEXT;
ALTER TABLE offers ADD COLUMN commission_payout TEXT;
ALTER TABLE offers ADD COLUMN product_currency TEXT DEFAULT 'USD';
```

**字段说明**:
- `product_price`: 产品价格（字符串格式，如"$699.00"或"699.00"）
- `commission_payout`: 佣金比例（字符串格式，如"6.75%"或"6.75"）
- `product_currency`: 价格货币代码（默认USD）

### 2. 货币转换库

**文件**: `src/lib/currency.ts` (243行)

**核心功能**:
- **20种货币支持**: USD, CNY, EUR, GBP, JPY, KRW, AUD, CAD, HKD, TWD, SGD, INR, BRL, MXN, THB, VND, IDR, PHP, MYR, RUB
- **汇率转换**: `convertCurrency(amount, from, to)`
- **货币格式化**: `formatCurrency(amount, currency)` - 带货币符号
- **价格解析**: `parsePrice(priceString)` - 支持带货币符号
- **佣金解析**: `parseCommission(commissionString)` - 支持百分号
- **CPC计算**: `calculateMaxCPC()` - 完整计算逻辑

**特殊处理**:
- JPY和KRW不显示小数位
- 自动货币转换（产品货币 → 广告账号货币）

### 3. 后端API更新

#### 3.1 Offer接口和库

**文件**: `src/lib/offers.ts`

**更新内容**:
- `Offer` 接口添加3个定价字段
- `CreateOfferInput` 接口添加可选定价字段
- `UpdateOfferInput` 接口添加可选定价字段
- `createOffer()` 支持存储定价信息
- `updateOffer()` 支持更新定价信息

#### 3.2 单个Offer端点

**文件**: `src/app/api/offers/route.ts`, `src/app/api/offers/[id]/route.ts`

**更新内容**:
- Zod验证模式添加定价字段
- GET/POST/PUT响应包含定价信息
- 所有字段均为可选，不影响现有流程

#### 3.3 批量创建端点（新建）

**文件**: `src/app/api/offers/batch/route.ts` (124行)

**功能**:
- `POST /api/offers/batch` - 批量创建Offers
- 支持CSV格式数据
- 单次最多100条
- 逐条验证和创建
- 返回详细的成功/失败结果

### 4. 前端实现

#### 4.1 Offer创建表单

**文件**: `src/app/offers/new/page.tsx`

**新增内容**:
- 新增"定价信息"表单区域
- 3个输入字段：
  - 产品价格（支持货币符号）
  - 价格货币（7种常用货币）
  - 佣金比例（支持百分号）
- 蓝色提示框说明用途和计算公式

#### 4.2 批量上传页面（新建）

**文件**: `src/app/offers/batch/page.tsx` (342行)

**功能**:
- CSV文件上传界面
- CSV模板下载（包含示例数据）
- 完整的字段说明文档
- CSV解析器
- 上传结果展示：
  - 汇总统计（总计/成功/失败）
  - 详细结果表格
  - 失败原因显示
  - 成功链接跳转

**CSV模板示例**:
```csv
url,brand,category,target_country,affiliate_link,product_price,commission_payout,product_currency,brand_description,unique_selling_points,product_highlights,target_audience
https://www.amazon.com/stores/page/xxx,Reolink,安防监控,US,https://pboost.me/xxx,$699.00,6.75%,USD,专业安防品牌,4K高清 夜视,POE供电 防水,家庭用户
```

#### 4.3 Campaign创建页面

**文件**: `src/app/campaigns/new/page.tsx`

**新增内容**:
- 导入 `calculateMaxCPC` 函数
- Offer接口添加定价字段
- CPC输入区域添加建议提示框（条件渲染）:
  - 仅当有定价数据时显示
  - 根据选择的广告账号货币自动转换
  - 显示建议CPC金额（带货币符号）
  - 显示计算公式详情

**示例显示**:
```
💡 建议最大CPC
按照50个点击出一单计算，建议最大CPC为 ¥6.68
计算公式：产品价格 × 佣金比例 ÷ 50 = 699.00 × 6.75% ÷ 50
```

#### 4.4 Offer列表页面

**文件**: `src/app/offers/page.tsx`

**更新**:
- 添加"📤 批量上传"按钮入口

## 测试计划

### 1. 单元测试

#### 货币转换函数
- [ ] `convertCurrency()` - 各币种转换准确性
- [ ] `formatCurrency()` - 货币符号和格式正确
- [ ] `parsePrice()` - 各种价格格式解析
- [ ] `parseCommission()` - 百分号处理
- [ ] `calculateMaxCPC()` - 完整计算流程

**测试用例**:
```javascript
// 测试1: 基本计算
calculateMaxCPC("$699.00", "6.75%", "USD", "USD")
// 预期: { maxCPC: 0.94365, maxCPCFormatted: "$0.94", ... }

// 测试2: 货币转换
calculateMaxCPC("$699.00", "6.75%", "USD", "CNY")
// 预期: { maxCPC: 6.70, maxCPCFormatted: "¥6.70", ... }

// 测试3: 无百分号
calculateMaxCPC("699.00", "6.75", "USD", "USD")
// 预期: 同测试1

// 测试4: 日元（无小数）
calculateMaxCPC("69900", "6.75", "JPY", "JPY")
// 预期: { maxCPC: 94, maxCPCFormatted: "¥94", ... }
```

### 2. API测试

#### 2.1 单个Offer创建/更新
```bash
# 创建带定价信息的Offer
curl -X POST http://localhost:3000/api/offers \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/product",
    "brand": "TestBrand",
    "target_country": "US",
    "product_price": "$699.00",
    "commission_payout": "6.75%",
    "product_currency": "USD"
  }'

# 更新定价信息
curl -X PUT http://localhost:3000/api/offers/1 \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "product_price": "799.00",
    "commission_payout": "7.5"
  }'
```

#### 2.2 批量创建
```bash
curl -X POST http://localhost:3000/api/offers/batch \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "offers": [
      {
        "url": "https://example.com/1",
        "brand": "Brand1",
        "target_country": "US",
        "product_price": "$699.00",
        "commission_payout": "6.75%",
        "product_currency": "USD"
      },
      {
        "url": "https://example.com/2",
        "brand": "Brand2",
        "target_country": "CN",
        "product_price": "4999",
        "commission_payout": "10",
        "product_currency": "CNY"
      }
    ]
  }'
```

### 3. 前端集成测试

#### 3.1 Offer创建表单
- [ ] 所有定价字段可正常输入
- [ ] 货币选择器工作正常
- [ ] 提交后数据正确保存
- [ ] 不填定价字段也能正常创建

#### 3.2 批量上传
- [ ] CSV模板下载正常
- [ ] CSV文件上传验证
- [ ] 解析各种CSV格式
- [ ] 上传结果正确显示
- [ ] 失败记录显示错误原因
- [ ] 成功记录可跳转查看

#### 3.3 Campaign创建页面
- [ ] 无定价数据时不显示提示框
- [ ] 有定价数据时自动计算
- [ ] 货币转换正确
- [ ] 切换广告账号时重新计算
- [ ] 显示格式正确

### 4. 边界情况测试

- [ ] 空字符串处理
- [ ] 无效价格格式
- [ ] 负数价格
- [ ] 超大数值
- [ ] 不支持的货币
- [ ] 汇率为0的情况
- [ ] CSV文件超过100行
- [ ] CSV文件格式错误
- [ ] CSV字段不全

### 5. 用户体验测试

- [ ] 提示信息清晰易懂
- [ ] 错误消息有帮助性
- [ ] 页面加载速度
- [ ] 响应式布局
- [ ] 无障碍访问

## 代码统计

| 类别 | 文件数 | 新增行数 | 修改行数 |
|------|--------|----------|----------|
| 数据库 | 1 | 18 | 0 |
| 后端库 | 2 | 366 | 87 |
| 后端API | 3 | 124 | 76 |
| 前端页面 | 3 | 428 | 12 |
| **总计** | **9** | **936** | **175** |

## 部署注意事项

### 1. 数据库迁移
```bash
npx tsx scripts/run-migrations.ts
```

### 2. 汇率更新
- 当前汇率为静态配置（2025-11-18）
- 建议定期更新 `src/lib/currency.ts` 中的 `EXCHANGE_RATES`
- 生产环境可考虑接入实时汇率API

### 3. 环境变量
无需新增环境变量

### 4. 依赖
无需新增依赖

## 已知限制

1. **汇率静态**: 需手动更新汇率数据
2. **CSV格式**: 仅支持标准逗号分隔CSV
3. **批量限制**: 单次最多100条Offer
4. **货币支持**: 仅20种主流货币

## 后续优化建议

1. **实时汇率**: 接入汇率API（如exchangerate-api.com）
2. **Excel支持**: 支持.xlsx格式上传
3. **CSV预览**: 上传前预览解析结果
4. **批量编辑**: 支持批量更新定价信息
5. **汇率缓存**: 添加汇率缓存机制
6. **自定义公式**: 允许用户自定义点击/转化率

## 完成状态

✅ **所有功能已完成并ready for测试**

- [x] 数据库迁移
- [x] 货币转换库
- [x] 后端API更新
- [x] 批量创建API
- [x] Offer创建表单
- [x] 批量上传页面
- [x] Campaign CPC建议
- [x] 用户入口
- [ ] 测试验证（待进行）

---

**创建时间**: 2025-11-18
**最后更新**: 2025-11-18
**状态**: ✅ 开发完成，待测试
