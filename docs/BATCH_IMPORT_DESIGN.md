# 批量导入Offer功能设计

**文档版本**: v2.0（简化版）
**更新日期**: 2025-01-18
**负责人**: AutoAds Engineering Team
**状态**: ✅ Ready for Implementation

---

## 📋 功能概述

### 目标

支持用户通过CSV文件批量导入Offer，提高大批量Offer创建的效率。

### 核心特性

- ✅ **仅支持CSV格式**（Excel支持延后至V2.0）
- ✅ **仅新建Offer**（不支持更新现有Offer）
- ✅ **部分导入**（错误行跳过，有效行导入成功）
- ✅ **标准模板下载**（确保用户使用正确格式）
- ✅ **导入预览**（导入前验证数据）
- ✅ **详细错误报告**（逐行验证结果）
- ✅ **自动生成字段**（Offer ID、语言、产品信息由AI自动生成）
- ✅ **异步抓取处理**（后台自动抓取产品信息）

### 设计原则

遵循**KISS原则**（Keep It Simple, Stupid）：
- **极简输入**：用户只需提供4个核心字段
- **智能自动化**：其他字段全部由AI和规则自动生成
- **清晰反馈**：详细的错误提示和抓取进度

---

## 一、CSV模板定义

### 1.1 简化CSV模板（4列）

**文件名**: `autoads_offer_import_template.csv`

**列定义**（仅4列，全部英文列名）:

| 列名 | 中文说明 | 必填 | 数据类型 | 最大长度 | 示例值 |
|------|---------|------|---------|---------|-------|
| `affiliate_link` | 推广链接 | ✅ 是 | URL | 500字符 | https://pboost.me/UKTs4I6 |
| `brand_name` | 品牌名称 | ✅ 是 | 文本 | 25字符 | Reolink |
| `target_country` | 推广国家 | ✅ 是 | 国家代码 | 2字符 | US |
| `shop_url` | 店铺或商品落地页 | ✅ 是 | URL | 500字符 | https://www.amazon.com/stores/page/... |

### 1.2 CSV模板示例

```csv
affiliate_link,brand_name,target_country,shop_url
https://pboost.me/UKTs4I6,Reolink,US,https://www.amazon.com/stores/page/201E3A4F-C63F-48A6-87B7-524F985330DA
https://pboost.me/XYZ123,Anker,US,https://www.amazon.com/Anker-PowerCore/dp/B01CU1EC6Y
https://pboost.me/ABC456,Eufy,GE,https://www.amazon.de/eufy-Security/dp/B08XYZ789
https://pboost.me/DEF789,TP-Link,FR,https://www.amazon.fr/TP-Link-Camera/dp/B09ABC123
https://pboost.me/GHI012,Ring,UK,https://www.amazon.co.uk/Ring-Video-Doorbell/dp/B0XYZ456
```

### 1.3 字段详细说明

#### 必填字段（仅4个）

**1. affiliate_link（推广链接）**
- **用途**: Affiliate跟踪链接，广告点击后跳转的最终URL
- **验证规则**:
  - 不能为空
  - 必须是有效的HTTP或HTTPS URL
  - 格式：`https?://[域名]/[路径]`
  - 最大500字符
- **正确示例**:
  - ✅ https://pboost.me/UKTs4I6
  - ✅ https://example.com/track?id=12345
  - ✅ http://tracking-domain.com/offer/xyz
- **错误示例**:
  - ❌ pboost.me/UKTs4I6（缺少协议）
  - ❌ ftp://example.com（不支持FTP）
  - ❌ 空值

**2. brand_name（品牌名称）**
- **用途**: 产品品牌名称，用于Offer ID生成、广告素材
- **验证规则**:
  - 不能为空
  - 1-25字符（Google Ads限制）
  - 允许中英文、数字、空格
  - 不允许特殊符号（除了连字符-和&）
- **正确示例**:
  - ✅ Reolink
  - ✅ TP-Link
  - ✅ H&M
- **错误示例**:
  - ❌ 空值
  - ❌ 超过25字符的品牌名
  - ❌ 包含特殊符号: `Brand@Name`

**3. target_country（推广国家）**
- **用途**: 广告投放的目标国家，用于地理定位、语言推导、关键词搜索量查询
- **验证规则**:
  - 不能为空
  - 必须是有效的国家代码（大写，2字符）
  - 支持的国家: US, GE, FR, UK, CA, AU, ES, IT, JP, BR
- **国家代码映射**:
  - US → 美国 (United States)
  - GE → 德国 (Germany)
  - FR → 法国 (France)
  - UK → 英国 (United Kingdom)
  - CA → 加拿大 (Canada)
  - AU → 澳大利亚 (Australia)
  - ES → 西班牙 (Spain)
  - IT → 意大利 (Italy)
  - JP → 日本 (Japan)
  - BR → 巴西 (Brazil)
- **正确示例**:
  - ✅ US
  - ✅ GE
  - ✅ FR
- **错误示例**:
  - ❌ us（小写）
  - ❌ USA（3字符）
  - ❌ CN（不支持的国家）
  - ❌ 空值

**4. shop_url（店铺或商品落地页）**
- **用途**: 产品的Amazon店铺页或详情页，用于AI抓取产品信息（产品名称、描述、特性等）
- **验证规则**:
  - 不能为空
  - 必须是有效的HTTP或HTTPS URL
  - 建议使用Amazon产品页或店铺页
  - 最大500字符
- **正确示例**:
  - ✅ https://www.amazon.com/stores/page/201E3A4F-C63F-48A6-87B7-524F985330DA
  - ✅ https://www.amazon.com/dp/B08XYZ123
  - ✅ https://www.amazon.com/Anker-PowerCore/dp/B01CU1EC6Y
  - ✅ https://www.amazon.de/eufy-Security/dp/B08XYZ789
- **错误示例**:
  - ❌ amazon.com/dp/B123（缺少协议）
  - ❌ 空值

#### 自动生成字段（用户无需提供）

以下字段将在导入后由系统自动生成，CSV模板中**不需要包含**这些列：

**5. offer_name（Offer ID）** - 自动生成
- **生成规则**: `[品牌名称]_[国家代号]_[序号]`
- **示例**: `Reolink_US_01`, `Anker_GE_02`

**6. target_language（推广语言）** - 自动推导
- **生成规则**: 根据`target_country`自动映射
- **示例**: US→English, GE→German, FR→French

**7. product_name（产品名称）** - AI抓取
- **生成方式**: 从`shop_url`页面AI抓取

**8. product_description（产品描述）** - AI抓取
- **生成方式**: 从`shop_url`页面AI抓取

**9. category（产品类目）** - AI抓取
- **生成方式**: 从`shop_url`页面AI抓取

**10. target_keywords（目标关键词）** - AI生成
- **生成方式**: 基于产品信息AI自动生成10-15个关键词

**11. budget_daily（每日预算）** - AI建议
- **生成方式**: 基于关键词竞争度自动计算建议值

**12. target_cpc（目标CPC）** - AI建议
- **生成方式**: 基于关键词建议出价自动计算

---

## 二、导入流程设计

### 2.1 整体流程图

```
┌─────────────────────────────────────────────────────────┐
│ 1. 用户下载CSV模板                                       │
│    GET /api/offers/import/template                      │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 2. 用户填写CSV文件                                       │
│    - 使用Excel/Google Sheets/文本编辑器                 │
│    - 填写必填字段                                        │
│    - 保存为CSV格式                                       │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 3. 用户上传CSV文件                                       │
│    POST /api/offers/import/preview                      │
│    - 前端：react-dropzone或<input type="file">          │
│    - Content-Type: multipart/form-data                  │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 4. 后端解析并验证CSV                                     │
│    - 使用csv-parse库解析文件                            │
│    - 逐行数据验证                                        │
│    - 重复Offer名称检测                                   │
│    - 生成验证报告                                        │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 5. 前端显示预览和验证结果                                │
│    - 总行数、有效行数、无效行数                         │
│    - 错误列表（行号+字段+错误信息）                     │
│    - 有效数据预览表格（前10行）                         │
│    - 用户确认或取消                                      │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 6. 用户确认导入                                          │
│    POST /api/offers/import/confirm                      │
│    - 传递validData（有效行数据）                        │
│    - skipErrors: true（跳过错误行）                     │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 7. 后端批量插入数据库                                    │
│    - 使用事务（Transaction）                            │
│    - 批量INSERT offers表                                │
│    - 捕获重复Offer名称错误                              │
│    - 返回导入结果                                        │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 8. 前端显示导入结果                                      │
│    - 成功导入数量                                        │
│    - 失败行详情                                          │
│    - 可下载错误报告CSV                                   │
└─────────────────────────────────────────────────────────┘
```

### 2.2 错误处理策略

**部分导入模式**（Partial Import）:
- ✅ **有效行**: 导入成功，插入数据库
- ❌ **错误行**: 跳过，记录错误信息
- ⚠️ **重复行**: 视为错误，记录到错误报告

**示例**:
- 用户上传100行
- 95行有效 → 导入成功
- 3行格式错误 → 跳过
- 2行Offer名称重复 → 跳过
- **最终结果**: 95行成功，5行失败

---

## 三、API设计

### 3.1 下载CSV模板

#### GET /api/offers/import/template

**功能**: 返回标准CSV模板文件

**请求**:
```http
GET /api/offers/import/template
Authorization: Bearer <jwt_token>
```

**响应**:
```http
HTTP/1.1 200 OK
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="autoads_offer_import_template.csv"

affiliate_link,brand_name,target_country,shop_url
Example Link,Example Brand,US,https://www.amazon.com/example
```

**实现**:
```typescript
// app/api/offers/import/template/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  // CSV模板内容（仅4列）
  const csvTemplate = `affiliate_link,brand_name,target_country,shop_url
https://pboost.me/example1,Reolink,US,https://www.amazon.com/stores/page/201E3A4F-C63F-48A6-87B7-524F985330DA
https://pboost.me/example2,Anker,GE,https://www.amazon.de/Anker-PowerCore/dp/B01CU1EC6Y
`;

  // 返回CSV文件
  return new NextResponse(csvTemplate, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="autoads_offer_import_template.csv"'
    }
  });
}
```

---

### 3.2 预览导入

#### POST /api/offers/import/preview

**功能**: 解析CSV文件并验证数据，不写入数据库

**请求**:
```http
POST /api/offers/import/preview
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data

file: offers.csv
```

**响应** (成功):
```json
{
  "success": true,
  "preview": {
    "totalRows": 100,
    "validRows": 95,
    "invalidRows": 5,
    "validData": [
      {
        "rowNumber": 1,
        "offer_name": "Nike Air Max Campaign",
        "product_name": "Nike Air Max 2024",
        "brand_name": "Nike",
        "landing_page_url": "https://nike.com/air-max",
        "category": "Footwear > Running Shoes",
        "target_keywords": ["running shoes", "nike shoes", "air max"],
        "budget_daily": 50.00,
        "target_cpc": 1.50
      },
      // ... 前10行有效数据预览
    ],
    "errors": [
      {
        "rowNumber": 3,
        "offerName": "Invalid Offer",
        "field": "landing_page_url",
        "message": "无效的URL格式"
      },
      {
        "rowNumber": 15,
        "offerName": "",
        "field": "offer_name",
        "message": "Offer名称为必填项"
      },
      {
        "rowNumber": 25,
        "offerName": "Duplicate Offer",
        "field": "offer_name",
        "message": "Offer名称已存在"
      }
    ]
  }
}
```

**响应** (解析失败):
```json
{
  "success": false,
  "error": "CSV文件格式错误：缺少必需列 'offer_name'"
}
```

**实现**:
```typescript
// app/api/offers/import/preview/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import { parse } from 'csv-parse/sync';
import Database from 'better-sqlite3';

const db = new Database(process.env.DATABASE_PATH!);

export async function POST(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const user = (request as AuthenticatedRequest).user!;

  try {
    // 1. 解析上传的文件
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: '未上传文件' },
        { status: 400 }
      );
    }

    // 2. 读取CSV内容
    const fileContent = await file.text();

    // 3. 解析CSV
    const records = parse(fileContent, {
      columns: true,  // 使用第一行作为列名
      skip_empty_lines: true,
      trim: true
    });

    // 4. 验证必需列
    const requiredColumns = ['offer_name', 'product_name', 'brand_name', 'landing_page_url'];
    const firstRow = records[0] || {};
    const missingColumns = requiredColumns.filter(col => !(col in firstRow));

    if (missingColumns.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `CSV文件缺少必需列: ${missingColumns.join(', ')}`
        },
        { status: 400 }
      );
    }

    // 5. 查询现有的Offer名称（用于检测重复）
    const existingOffers = db.prepare(`
      SELECT offer_name FROM offers WHERE user_id = ?
    `).all(user.userId) as Array<{ offer_name: string }>;

    const existingOfferNames = new Set(existingOffers.map(o => o.offer_name));

    // 6. 逐行验证
    const validData: any[] = [];
    const errors: any[] = [];

    records.forEach((row: any, index: number) => {
      const rowNumber = index + 2;  // CSV行号（+1为表头，+1为从1开始）
      const rowErrors = validateRow(row, rowNumber, existingOfferNames);

      if (rowErrors.length === 0) {
        // 有效行
        validData.push({
          rowNumber,
          ...processRow(row)
        });
      } else {
        // 错误行
        rowErrors.forEach(err => errors.push(err));
      }
    });

    // 7. 返回预览结果
    return NextResponse.json({
      success: true,
      preview: {
        totalRows: records.length,
        validRows: validData.length,
        invalidRows: errors.length,
        validData: validData.slice(0, 10),  // 仅返回前10行预览
        errors
      }
    });

  } catch (error: any) {
    console.error('CSV预览错误:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'CSV解析失败' },
      { status: 500 }
    );
  }
}

// 验证单行数据
function validateRow(row: any, rowNumber: number, existingOfferNames: Set<string>): any[] {
  const errors: any[] = [];

  // 1. 验证必填字段
  const requiredFields = [
    { key: 'offer_name', name: 'Offer名称' },
    { key: 'product_name', name: '产品名称' },
    { key: 'brand_name', name: '品牌名称' },
    { key: 'landing_page_url', name: '着陆页URL' }
  ];

  requiredFields.forEach(field => {
    if (!row[field.key] || row[field.key].trim() === '') {
      errors.push({
        rowNumber,
        offerName: row.offer_name || '',
        field: field.key,
        message: `${field.name}为必填项`
      });
    }
  });

  // 如果必填字段验证失败，跳过其他验证
  if (errors.length > 0) return errors;

  // 2. 验证offer_name长度
  if (row.offer_name.length > 100) {
    errors.push({
      rowNumber,
      offerName: row.offer_name,
      field: 'offer_name',
      message: 'Offer名称不能超过100字符'
    });
  }

  // 3. 验证offer_name重复
  if (existingOfferNames.has(row.offer_name)) {
    errors.push({
      rowNumber,
      offerName: row.offer_name,
      field: 'offer_name',
      message: 'Offer名称已存在'
    });
  }

  // 4. 验证URL格式
  const urlPattern = /^https?:\/\/.+/;
  if (!urlPattern.test(row.landing_page_url)) {
    errors.push({
      rowNumber,
      offerName: row.offer_name,
      field: 'landing_page_url',
      message: '必须是有效的HTTP或HTTPS URL'
    });
  }

  // 5. 验证数字字段（如果有值）
  if (row.budget_daily !== undefined && row.budget_daily !== '') {
    const budget = parseFloat(row.budget_daily);
    if (isNaN(budget) || budget <= 0) {
      errors.push({
        rowNumber,
        offerName: row.offer_name,
        field: 'budget_daily',
        message: '每日预算必须是正数'
      });
    }
  }

  if (row.target_cpc !== undefined && row.target_cpc !== '') {
    const cpc = parseFloat(row.target_cpc);
    if (isNaN(cpc) || cpc <= 0) {
      errors.push({
        rowNumber,
        offerName: row.offer_name,
        field: 'target_cpc',
        message: '目标CPC必须是正数'
      });
    }
  }

  // 6. 验证关键词数量
  if (row.target_keywords) {
    const keywords = row.target_keywords.split(';').map((k: string) => k.trim()).filter((k: string) => k);
    if (keywords.length > 20) {
      errors.push({
        rowNumber,
        offerName: row.offer_name,
        field: 'target_keywords',
        message: '最多支持20个关键词'
      });
    }
  }

  return errors;
}

// 处理行数据（转换格式）
function processRow(row: any) {
  // 解析关键词（分号分隔 → JSON数组）
  let keywords: string[] = [];
  if (row.target_keywords) {
    keywords = row.target_keywords
      .split(';')
      .map((k: string) => k.trim())
      .filter((k: string) => k);
  }

  return {
    offer_name: row.offer_name.trim(),
    product_name: row.product_name.trim(),
    brand_name: row.brand_name.trim(),
    landing_page_url: row.landing_page_url.trim(),
    category: row.category ? row.category.trim() : null,
    target_keywords: keywords,
    budget_daily: row.budget_daily ? parseFloat(row.budget_daily) : null,
    target_cpc: row.target_cpc ? parseFloat(row.target_cpc) : null
  };
}
```

---

### 3.3 确认导入

#### POST /api/offers/import/confirm

**功能**: 将有效数据批量插入数据库

**请求**:
```json
{
  "validData": [
    {
      "rowNumber": 1,
      "offer_name": "Nike Air Max Campaign",
      "product_name": "Nike Air Max 2024",
      "brand_name": "Nike",
      "landing_page_url": "https://nike.com/air-max",
      "category": "Footwear > Running Shoes",
      "target_keywords": ["running shoes", "nike shoes", "air max"],
      "budget_daily": 50.00,
      "target_cpc": 1.50
    },
    // ... 所有有效行
  ]
}
```

**响应**:
```json
{
  "success": true,
  "result": {
    "imported": 95,
    "failed": 0,
    "importedOffers": [
      {
        "rowNumber": 1,
        "offerName": "Nike Air Max Campaign",
        "offerId": 123
      },
      // ... 所有成功导入的Offer
    ],
    "failedRows": []  // 导入时失败的行（通常为空，因为已在preview验证）
  }
}
```

**实现**:
```typescript
// app/api/offers/import/confirm/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth/middleware';
import Database from 'better-sqlite3';

const db = new Database(process.env.DATABASE_PATH!);

export async function POST(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const user = (request as AuthenticatedRequest).user!;
  const { validData } = await request.json();

  if (!validData || !Array.isArray(validData)) {
    return NextResponse.json(
      { success: false, error: '无效的导入数据' },
      { status: 400 }
    );
  }

  const importedOffers: any[] = [];
  const failedRows: any[] = [];

  try {
    // 使用事务批量插入
    db.exec('BEGIN TRANSACTION');

    const insertStmt = db.prepare(`
      INSERT INTO offers (
        user_id, offer_name, product_name, brand_name, landing_page_url,
        category, target_keywords, budget_daily, target_cpc,
        status, is_archived, version,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 0, 1, datetime('now'), datetime('now'))
    `);

    validData.forEach(row => {
      try {
        const result = insertStmt.run(
          user.userId,
          row.offer_name,
          row.product_name,
          row.brand_name,
          row.landing_page_url,
          row.category || null,
          row.target_keywords ? JSON.stringify(row.target_keywords) : null,
          row.budget_daily || null,
          row.target_cpc || null
        );

        importedOffers.push({
          rowNumber: row.rowNumber,
          offerName: row.offer_name,
          offerId: result.lastInsertRowid
        });
      } catch (error: any) {
        // 捕获重复Offer名称等错误
        failedRows.push({
          rowNumber: row.rowNumber,
          offerName: row.offer_name,
          error: error.message
        });
      }
    });

    // 提交事务
    db.exec('COMMIT');

    return NextResponse.json({
      success: true,
      result: {
        imported: importedOffers.length,
        failed: failedRows.length,
        importedOffers,
        failedRows
      }
    });

  } catch (error: any) {
    // 回滚事务
    db.exec('ROLLBACK');

    console.error('批量导入错误:', error);
    return NextResponse.json(
      { success: false, error: error.message || '批量导入失败' },
      { status: 500 }
    );
  }
}
```

---

## 四、前端UI设计

### 4.1 导入页面组件

**页面路径**: `/app/offers/import/page.tsx`

**组件结构**:
```
<OfferImportPage>
  ├── <ImportInstructions>  # 导入说明和模板下载
  ├── <FileUploadZone>      # 文件上传区域
  ├── <PreviewResults>      # 预览验证结果
  │   ├── <ValidationSummary>  # 统计信息
  │   ├── <ErrorList>          # 错误列表
  │   └── <DataPreview>        # 数据预览表格
  └── <ImportResults>       # 导入结果展示
```

### 4.2 导入说明组件

```typescript
// components/offers/ImportInstructions.tsx
import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet } from 'lucide-react';

export function ImportInstructions() {
  const handleDownloadTemplate = async () => {
    const response = await fetch('/api/offers/import/template', {
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'autoads_offer_import_template.csv';
    a.click();
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
      <div className="flex items-start gap-4">
        <FileSpreadsheet className="w-8 h-8 text-blue-600 flex-shrink-0" />

        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            批量导入Offer
          </h3>

          <ul className="text-sm text-gray-700 space-y-1 mb-4">
            <li>• 支持CSV格式文件</li>
            <li>• 必填字段：Offer名称、产品名称、品牌名称、着陆页URL</li>
            <li>• 单次最多导入1000行</li>
            <li>• 错误行将被跳过，有效行导入成功</li>
          </ul>

          <Button onClick={handleDownloadTemplate} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            下载CSV模板
          </Button>
        </div>
      </div>
    </div>
  );
}
```

### 4.3 文件上传组件

```typescript
// components/offers/FileUploadZone.tsx
'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FileUploadZoneProps {
  onFileSelect: (file: File) => void;
  loading?: boolean;
}

export function FileUploadZone({ onFileSelect, loading }: FileUploadZoneProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setSelectedFile(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv']
    },
    maxFiles: 1,
    disabled: loading
  });

  const handleUpload = () => {
    if (selectedFile) {
      onFileSelect(selectedFile);
    }
  };

  const handleRemove = () => {
    setSelectedFile(null);
  };

  return (
    <div className="space-y-4">
      {/* 拖拽上传区域 */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${loading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />

        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />

        {isDragActive ? (
          <p className="text-blue-600 font-medium">释放文件以上传</p>
        ) : (
          <div>
            <p className="text-gray-700 font-medium mb-1">
              拖拽CSV文件到此处，或点击选择文件
            </p>
            <p className="text-sm text-gray-500">
              仅支持.csv格式，最大10MB
            </p>
          </div>
        )}
      </div>

      {/* 已选择的文件 */}
      {selectedFile && (
        <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <File className="w-5 h-5 text-gray-500" />
            <div>
              <p className="text-sm font-medium text-gray-900">
                {selectedFile.name}
              </p>
              <p className="text-xs text-gray-500">
                {(selectedFile.size / 1024).toFixed(2)} KB
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleUpload}
              disabled={loading}
              size="sm"
            >
              {loading ? '解析中...' : '开始验证'}
            </Button>

            <Button
              onClick={handleRemove}
              variant="ghost"
              size="sm"
              disabled={loading}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

### 4.4 预览结果组件

```typescript
// components/offers/PreviewResults.tsx
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PreviewResultsProps {
  preview: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    validData: any[];
    errors: any[];
  };
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function PreviewResults({ preview, onConfirm, onCancel, loading }: PreviewResultsProps) {
  return (
    <div className="space-y-6">
      {/* 统计信息 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-gray-500" />
            <span className="text-sm text-gray-600">总行数</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{preview.totalRows}</p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-sm text-green-700">有效行</span>
          </div>
          <p className="text-2xl font-bold text-green-900">{preview.validRows}</p>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-5 h-5 text-red-600" />
            <span className="text-sm text-red-700">错误行</span>
          </div>
          <p className="text-2xl font-bold text-red-900">{preview.invalidRows}</p>
        </div>
      </div>

      {/* 错误列表 */}
      {preview.errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-red-900 mb-3">
            错误详情（{preview.errors.length}个错误）
          </h4>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {preview.errors.map((error, index) => (
              <div key={index} className="text-sm text-red-800">
                <span className="font-medium">第{error.rowNumber}行</span>
                {error.offerName && <span> ({error.offerName})</span>}
                <span className="text-red-600"> - {error.field}</span>: {error.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 数据预览表格 */}
      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-3">
          有效数据预览（前10行）
        </h4>

        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    行号
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Offer名称
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    产品名称
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    品牌
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    每日预算
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {preview.validData.map((row, index) => (
                  <tr key={index}>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {row.rowNumber}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {row.offer_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {row.product_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {row.brand_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {row.budget_daily ? `$${row.budget_daily}` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center justify-end gap-3">
        <Button onClick={onCancel} variant="outline" disabled={loading}>
          取消
        </Button>

        <Button
          onClick={onConfirm}
          disabled={loading || preview.validRows === 0}
        >
          {loading ? '导入中...' : `确认导入（${preview.validRows}行）`}
        </Button>
      </div>
    </div>
  );
}
```

---

## 五、实施计划

### 5.1 后端开发

**任务清单**:
- [x] 安装依赖：`npm install csv-parse`
- [ ] 实现 GET /api/offers/import/template
- [ ] 实现 POST /api/offers/import/preview
- [ ] 实现 POST /api/offers/import/confirm
- [ ] 编写单元测试

**工作量**: 6小时

### 5.2 前端开发

**任务清单**:
- [x] 安装依赖：`npm install react-dropzone`
- [ ] 创建 /app/offers/import/page.tsx
- [ ] 实现 ImportInstructions 组件
- [ ] 实现 FileUploadZone 组件
- [ ] 实现 PreviewResults 组件
- [ ] 实现 ImportResults 组件

**工作量**: 4小时

### 5.3 测试

**测试用例**:
1. ✅ 正常导入（100行有效数据）
2. ✅ 部分错误（95行有效，5行错误）
3. ✅ 全部错误（0行有效）
4. ✅ 重复Offer名称检测
5. ✅ 必填字段验证
6. ✅ URL格式验证
7. ✅ 数字字段验证
8. ✅ 关键词数量验证

**工作量**: 2小时

---

## 六、注意事项

### 6.1 性能限制

- **单次导入限制**: 最多1000行（防止内存溢出）
- **文件大小限制**: 最大10MB
- **超时时间**: 预览60秒，导入120秒

### 6.2 数据一致性

- **事务处理**: 使用SQLite事务确保批量插入的原子性
- **错误回滚**: 如果导入过程中发生严重错误，回滚所有变更

### 6.3 用户体验

- **即时反馈**: 上传后立即显示预览结果
- **详细错误**: 每个错误行都显示行号、字段、错误信息
- **可下载错误报告**: 用户可以下载错误列表CSV文件

---

## 七、与"一键上广告"的衔接

### 7.1 导入后的Offer状态

批量导入完成后，所有Offer的状态为：
- `ad_status = 'not_launched'`：表示Offer已创建，但尚未执行"一键上广告"

**重要说明**：
- ✅ **Offer创建完成**：导入的Offer是完整有效的，用户可以在Offer列表中看到
- ⏳ **等待AI处理**：产品信息、关键词、预算等字段为空，等待"一键上广告"时填充
- 🚀 **准备投放**：用户可以随时点击"一键上广告"按钮来完成AI处理和Google Ads Campaign创建

### 7.2 延迟生成字段说明

**CSV导入时不需要的字段**（在"一键上广告"时自动生成）：

| 字段 | 生成方式 | 生成时机 | 说明 |
|------|---------|---------|------|
| `product_name` | AI抓取 | 一键上广告 | 从shop_url页面抓取产品名称 |
| `product_description` | AI抓取 | 一键上广告 | 从shop_url页面抓取产品描述 |
| `category` | AI抓取 | 一键上广告 | 从shop_url页面抓取产品类目 |
| `target_keywords` | AI生成 | 一键上广告 | 基于产品信息生成10-15个关键词，通过Keyword Planner API验证搜索量 |
| `budget_daily` | 自动计算 | 一键上广告 | 根据target_cpc × 30次点击计算，范围$10-$500 |
| `target_cpc` | 自动计算 | 一键上广告 | 基于Keyword Planner API的建议CPC计算 |

### 7.3 "一键上广告"流程概览

用户在批量导入Offer后，可以执行以下操作：

```
┌─────────────────────────────────────────────────────────┐
│ 批量导入Offer（CSV）                                     │
│ - 4个必填字段                                            │
│ - ad_status = 'not_launched'                            │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ Offer列表页面                                            │
│ - 显示所有导入的Offer                                   │
│ - ad_status显示"未上广告"                               │
│ - 每个Offer旁边显示"一键上广告"按钮                     │
└─────────────────────────────────────────────────────────┘
                        ↓ 用户点击"一键上广告"
┌─────────────────────────────────────────────────────────┐
│ "一键上广告"流程（详见ONE_CLICK_LAUNCH.md）              │
│ Step 1: 验证前置条件                                    │
│ Step 2: AI抓取产品信息（Playwright + 代理）             │
│ Step 3: AI生成关键词（GPT-4o + Keyword Planner API）    │
│ Step 4: 自动设置预算和出价                               │
│ Step 5: AI生成广告创意（15 Headlines + 4 Descriptions） │
│ Step 6-9: 创建Google Ads Campaign                      │
│ Step 10: 更新ad_status = 'active'                      │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ Campaign创建成功                                         │
│ - ad_status = 'active'                                  │
│ - Campaign.status = 'PAUSED'（等待用户上传Logo/Images）│
│ - 所有AI生成字段已填充                                   │
└─────────────────────────────────────────────────────────┘
```

### 7.4 用户体验流程

**典型使用场景**：

1. **批量导入Offer**（5分钟）
   - 用户准备CSV文件，填写4个必填字段（affiliate_link, brand_name, target_country, shop_url）
   - 上传CSV文件
   - 预览验证结果，确认导入
   - ✅ 50个Offer快速创建完成

2. **等待合适时机**（可选）
   - Offer已创建，用户可以先准备其他素材（Logo、产品图片）
   - Offer状态为`not_launched`，不会产生任何费用

3. **执行"一键上广告"**（每个Offer约50秒）
   - 用户选择要投放的Offer
   - 点击"一键上广告"按钮
   - AI自动处理：抓取产品信息 → 生成关键词 → 计算预算 → 生成广告创意 → 创建Campaign
   - ✅ Campaign创建成功，状态为PAUSED

4. **激活Campaign**（在Google Ads后台）
   - 用户上传Logo和产品图片到Google Ads后台
   - 将Campaign状态从PAUSED改为ENABLED
   - 🚀 广告开始投放

### 7.5 设计优势

**分离关注点**：
- ✅ **Offer创建**: 快速、轻量级，专注于基础信息录入
- ✅ **一键上广告**: 重量级AI处理，完成Google Ads投放准备

**提升效率**：
- ⚡ **批量导入**: 50个Offer < 1分钟完成创建
- 🤖 **按需处理**: 只有用户真正要投放时才触发AI处理
- 💰 **节省资源**: 避免为暂时不投放的Offer浪费AI调用成本

**灵活性**：
- 🔄 **分批投放**: 用户可以先导入所有Offer，然后选择性投放
- 📊 **测试优化**: 可以先投放部分Offer测试效果，再决定是否投放其他Offer
- 🎯 **精准控制**: 每个Offer的投放时机完全由用户控制

### 7.6 相关文档

- **OFFER_CREATION_DESIGN.md**: 手动创建Offer的设计文档（同样遵循4+2字段设计）
- **ONE_CLICK_LAUNCH.md**: "一键上广告"完整流程设计（10步骤详细说明）
- **ONE_CLICK_LAUNCH_IMPROVEMENTS.md**: "一键上广告"相对于PRD的改进说明

---

**文档结束**

**下一步**: 开始后端API实现
**预计完成时间**: 2个工作日
