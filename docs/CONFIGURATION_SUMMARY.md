# 配置系统总结

**创建日期**: 2025-01-18
**版本**: 1.0
**状态**: ✅ 设计完成

---

## 📋 快速概览

### 统一配置页面

**页面路径**: `/settings`

**配置项**:
1. ✅ **Google Ads API** - 广告投放必需
2. ✅ **AI配置** - Gemini（主引擎）+ Claude（备用引擎）
3. ✅ **代理配置** - 数据爬取和链接检测

**设计理念**:
- 🎯 集中管理：所有配置在一个页面
- ✅ 状态清晰：每个配置项显示验证状态
- 🔒 安全存储：敏感信息加密保存
- 📊 实时验证：保存前验证配置正确性

---

## 🔧 配置项详解

### 1. Google Ads API配置

**必填字段**:
| 字段 | 说明 | 获取方式 |
|------|------|----------|
| Developer Token | Google Ads API开发者令牌 | [API Center](https://ads.google.com/aw/apicenter) |
| Client ID | OAuth 2.0客户端ID | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) |
| Client Secret | OAuth 2.0客户端密钥 | 同上 |

**可选字段**:
- Login Customer ID: MCC账号ID（格式: XXX-XXX-XXXX）

**验证方式**:
- 调用Google Ads API测试连接
- 验证Developer Token和OAuth凭据

**使用场景**:
- 创建Campaign
- 创建Ad Group
- 创建关键词和广告创意
- 获取广告性能数据

---

### 2. AI配置（Gemini + Claude）

#### 2.1 Gemini API配置（主引擎）

**必填字段**:
| 字段 | 说明 | 获取方式 |
|------|------|----------|
| API Key | Gemini API密钥 | [Google AI Studio](https://makersuite.google.com/app/apikey) |

**可选字段**:
- Model: 使用的模型（默认: gemini-2.5-pro）
  - `gemini-2.5-pro`: 推荐，最新版本，质量最高
  - `gemini-2.5-flash`: 更快，成本低（推荐用于生产）
  - `gemini-2.0-flash-exp`: 实验性，速度最快

**验证方式**:
- 检查API Key格式（以"AIza"开头）
- 发送测试请求验证可用性

**使用场景**:
- AI生成产品关键词（20-30个）
- AI生成广告标题（3-5个）
- AI生成广告描述（2-3个）
- 产品信息提取和分析
- 品牌名称验证

#### 2.2 Claude API配置（备用引擎）

**可选字段**:
| 字段 | 说明 | 获取方式 |
|------|------|----------|
| API Key | Claude API密钥 | [Anthropic Console](https://console.anthropic.com/) |

**可选字段**:
- Model: 使用的模型（默认: claude-sonnet-4-5-20250929）
  - `claude-sonnet-4-5-20250929`: 推荐，质量高
  - `claude-3-5-sonnet-20241022`: 旧版本
  - `claude-3-opus-20240229`: 最高质量，成本最高

**验证方式**:
- 检查API Key格式（以"sk-ant-"开头）
- 发送测试请求验证可用性

**使用场景**:
- 备用AI引擎：当Gemini API失败时自动切换
- Fallback策略：Gemini → Claude → 基础模板
- 质量保证：确保100%的Offer保持高质量输出

**成本估算**:
- Gemini: ~$30/月（主引擎，90%使用率）
- Claude: ~$10/月（备用，<10%使用率）
- 总计: ~$40/月

**是否必填**: ❌ 可选但推荐
- 不配置：Gemini失败时使用基础模板（质量一般）
- 配置后：Gemini失败时自动切换Claude（质量高）

---

### 3. 代理配置

**必填字段**:
| 字段 | 说明 | 示例 |
|------|------|------|
| Proxy URL | 代理服务商API URL | `https://api.iprocket.io/api?username=...&cc=ROW&ips=1&proxyType=http&responseType=txt` |

**Proxy URL格式要求**:
- ✅ 必须包含 `cc` 参数（国家代码: ROW/UK/CA）
- ✅ 必须包含 `ips=1` 参数
- ✅ 必须包含 `proxyType=http` 参数
- ✅ 必须包含 `responseType=txt` 参数

**国家代码说明**:
- `cc=ROW`: 美国（Rest of World）
- `cc=UK`: 英国
- `cc=CA`: 加拿大

**启用开关**:
- `proxy_enabled`: 只有验证通过后才能启用

**验证方式**:
1. 检查URL格式和必需参数
2. 调用代理API获取测试IP
3. 验证返回格式（host:port:username:password）

**使用场景**:
- Playwright浏览器自动化（数据爬取）
- 推广链接可访问性检测
- Final URL获取
- 品牌信息验证
- 风险检测（每日定时任务）

**代理IP格式**:
```
15.235.13.80:5959:com49692430-res-row-sid-867994980:Qxi9V59e3kNOW6pnRi3i
```
- 字段1: host（15.235.13.80）
- 字段2: port（5959）
- 字段3: username（com49692430-res-row-sid-867994980）
- 字段4: password（Qxi9V59e3kNOW6pnRi3i）

---

## 🗄️ 数据库Schema

### user_settings表

```sql
CREATE TABLE user_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,

  -- Google Ads API配置
  google_ads_developer_token TEXT,           -- 加密存储
  google_ads_client_id TEXT,
  google_ads_client_secret TEXT,             -- 加密存储
  google_ads_login_customer_id TEXT,
  google_ads_validated BOOLEAN NOT NULL DEFAULT 0,
  google_ads_last_validated_at TEXT,
  google_ads_validation_error TEXT,

  -- Gemini API配置（主AI引擎）
  gemini_api_key TEXT,                       -- 加密存储
  gemini_model TEXT DEFAULT 'gemini-2.5-pro',
  gemini_validated BOOLEAN NOT NULL DEFAULT 0,
  gemini_last_validated_at TEXT,
  gemini_validation_error TEXT,

  -- Anthropic Claude API配置（备用AI引擎）
  anthropic_api_key TEXT,                    -- 加密存储
  anthropic_model TEXT DEFAULT 'claude-sonnet-4-5-20250929',
  anthropic_validated BOOLEAN NOT NULL DEFAULT 0,
  anthropic_last_validated_at TEXT,
  anthropic_validation_error TEXT,

  -- 代理配置
  proxy_url TEXT,                            -- 加密存储
  proxy_country_code TEXT,
  proxy_enabled BOOLEAN NOT NULL DEFAULT 0,
  proxy_validated BOOLEAN NOT NULL DEFAULT 0,
  proxy_last_validated_at TEXT,
  proxy_validation_error TEXT,

  -- 元数据
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**加密字段**:
- `google_ads_developer_token`
- `google_ads_client_secret`
- `gemini_api_key`
- `anthropic_api_key`
- `proxy_url`

**加密算法**: AES-256-GCM

---

## 🎨 前端UI结构

### 页面布局

```
/settings
├── Tab: Google Ads API
│   ├── Developer Token输入
│   ├── Client ID输入
│   ├── Client Secret输入
│   ├── Login Customer ID输入（可选）
│   ├── [测试连接] 按钮
│   ├── [保存配置] 按钮
│   └── 验证状态指示器
│
├── Tab: AI配置
│   ├── Gemini API（主引擎）[必填]
│   │   ├── API Key输入
│   │   ├── Model选择
│   │   └── [测试Gemini连接] 按钮
│   │
│   ├── Separator（分隔线）
│   │
│   ├── Claude API（备用引擎）[可选]
│   │   ├── 备用引擎说明（蓝色提示框）
│   │   ├── API Key输入
│   │   ├── Model选择
│   │   └── [测试Claude连接] 按钮
│   │
│   ├── [保存AI配置] 按钮
│   └── 验证状态指示器
│
└── Tab: 代理配置
    ├── Proxy URL输入
    ├── [测试代理URL] 按钮
    ├── 启用开关
    ├── [保存配置] 按钮
    ├── 验证状态指示器
    └── 国家代码说明
```

### 组件文件

```
app/
└── (dashboard)/
    └── settings/
        └── page.tsx              # 主页面（Tab导航）

components/
└── settings/
    ├── GoogleAdsSettings.tsx    # Google Ads配置组件
    ├── AISettings.tsx           # AI配置组件（合并Gemini + Claude）
    └── ProxySettings.tsx        # 代理配置组件
```

---

## 🔌 API端点

### Google Ads API

| 方法 | 端点 | 功能 |
|------|------|------|
| GET | `/api/settings/google-ads` | 获取配置 |
| POST | `/api/settings/google-ads/validate` | 验证配置 |
| PUT | `/api/settings/google-ads` | 保存配置 |

### AI配置（Gemini + Claude）

**Gemini API**:
| 方法 | 端点 | 功能 |
|------|------|------|
| GET | `/api/settings/gemini` | 获取Gemini配置 |
| POST | `/api/settings/gemini/validate` | 验证Gemini API Key |
| PUT | `/api/settings/gemini` | 保存Gemini配置 |

**Claude API**:
| 方法 | 端点 | 功能 |
|------|------|------|
| GET | `/api/settings/anthropic` | 获取Claude配置 |
| POST | `/api/settings/anthropic/validate` | 验证Claude API Key |
| PUT | `/api/settings/anthropic` | 保存Claude配置 |

### 代理配置

| 方法 | 端点 | 功能 |
|------|------|------|
| GET | `/api/settings/proxy` | 获取配置 |
| POST | `/api/settings/proxy/validate` | 验证Proxy URL |
| PUT | `/api/settings/proxy` | 保存配置 |
| GET | `/api/settings/proxy/status` | 获取代理状态 |

### 统一状态

| 方法 | 端点 | 功能 |
|------|------|------|
| GET | `/api/settings/status` | 获取所有配置状态 |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "google_ads": { "configured": true, "validated": true },
    "gemini": { "configured": true, "validated": true },
    "anthropic": { "configured": false, "validated": false },
    "proxy": { "configured": true, "validated": true, "enabled": true }
  }
}
```

---

## ✅ 验证流程

### 1. Google Ads API验证流程

```
用户填写配置信息
  ↓
点击"测试连接"
  ↓
【前端】发送POST /api/settings/google-ads/validate
  ↓
【后端】格式验证
  - Developer Token非空
  - Client ID非空
  - Client Secret非空
  - Login Customer ID格式（如有）
  ↓
【后端】API调用测试
  - 初始化Google Ads API客户端
  - 尝试连接验证
  ↓
【后端】返回验证结果
  ↓
【前端】显示验证状态
  - ✅ 成功：绿色提示 + "已验证"标记
  - ❌ 失败：红色错误提示
  ↓
验证成功后才能保存配置
```

### 2. Gemini API验证流程

```
用户填写API Key
  ↓
点击"测试Gemini连接"
  ↓
【前端】发送POST /api/settings/gemini/validate
  ↓
【后端】格式验证
  - API Key以"AIza"开头
  ↓
【后端】API调用测试
  - 调用Gemini API发送测试请求
  - 检查响应状态
  ↓
【后端】返回验证结果
  ↓
【前端】显示验证状态
  ↓
验证成功后才能保存配置
```

### 3. Claude API验证流程

```
用户填写API Key（可选）
  ↓
点击"测试Claude连接"
  ↓
【前端】发送POST /api/settings/anthropic/validate
  ↓
【后端】格式验证
  - API Key以"sk-ant-"开头
  ↓
【后端】API调用测试
  - 调用Anthropic API发送测试请求
  - 检查响应状态
  ↓
【后端】返回验证结果
  ↓
【前端】显示验证状态
  ↓
验证成功或跳过后可保存配置
```

### 4. 代理URL验证流程

```
用户填写Proxy URL
  ↓
点击"测试代理URL"
  ↓
【前端】发送POST /api/settings/proxy/validate
  ↓
【后端】格式验证
  - 检查URL格式
  - 验证必需参数（cc、ips、proxyType、responseType）
  ↓
【后端】实际测试
  - 调用代理API获取IP
  - 解析返回的代理IP（host:port:username:password）
  ↓
【后端】返回验证结果
  - 国家代码
  - 测试IP地址
  ↓
【前端】显示验证状态
  - ✅ 成功：绿色提示 + 国家名称 + 测试IP
  - ❌ 失败：红色错误列表
  ↓
验证成功后才能启用代理
```

---

## 🔒 安全考虑

### 1. 敏感信息加密

**加密字段**:
- Google Ads Developer Token
- Google Ads Client Secret
- Gemini API Key
- Claude API Key
- Proxy URL

**加密方案**:
```typescript
// lib/encryption.ts
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!; // 32字节
const ALGORITHM = 'aes-256-gcm';

export function encryptSensitiveData(data: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);

  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
}

export function decryptSensitiveData(encryptedData: string): string {
  const [ivHex, encrypted, authTagHex] = encryptedData.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

### 2. 日志脱敏

**原则**: 日志中不应暴露敏感信息

```typescript
// 示例：代理URL脱敏
export function maskProxyUrl(proxyUrl: string): string {
  try {
    const url = new URL(proxyUrl);
    const params = new URLSearchParams(url.search);
    const cc = params.get('cc');
    return `${url.origin}${url.pathname}?cc=${cc}&...`;
  } catch (error) {
    return '[INVALID_URL]';
  }
}

// 日志记录
console.log('使用代理:', maskProxyUrl(proxyUrl));
// 输出: "https://api.iprocket.io/api?cc=ROW&..."
```

### 3. 权限验证

**所有API端点必须验证用户身份**:

```typescript
// 示例
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // 继续处理...
}
```

---

## 🚀 实施计划

### Phase 1: 数据库（1天）
- ✅ 扩展user_settings表
- ✅ 数据库迁移脚本
- ✅ 加密存储实现

### Phase 2: API实现（2天）
- ✅ Google Ads API端点
- ✅ Gemini API端点
- ✅ Claude API端点
- ✅ 代理API端点
- ✅ 统一状态端点

### Phase 3: 验证逻辑（2天）
- ✅ Google Ads验证
- ✅ Gemini验证
- ✅ Claude验证
- ✅ 代理验证

### Phase 4: 前端UI（3天）
- ✅ Tab导航布局
- ✅ Google Ads配置组件
- ✅ AI配置组件（合并Gemini + Claude）
- ✅ 代理配置组件

### Phase 5: 测试和部署（2天）
- ✅ 集成测试
- ✅ E2E测试
- ✅ 部署验证

**总工作量**: 10个工作日

---

## 📊 配置完成度检查

### 系统就绪检查

```typescript
// lib/config/checklist.ts
export interface ConfigStatus {
  google_ads: boolean;
  gemini: boolean;
  anthropic: boolean;
  proxy: boolean;
}

export async function getConfigStatus(userId: number): Promise<ConfigStatus> {
  const settings = db.prepare(`
    SELECT
      google_ads_validated,
      gemini_validated,
      anthropic_validated,
      proxy_validated
    FROM user_settings
    WHERE user_id = ?
  `).get(userId);

  return {
    google_ads: settings?.google_ads_validated === 1,
    gemini: settings?.gemini_validated === 1,
    anthropic: settings?.anthropic_validated === 1,
    proxy: settings?.proxy_validated === 1
  };
}

export function isSystemReady(status: ConfigStatus): boolean {
  // Claude是可选的，不影响系统就绪状态
  return status.google_ads && status.gemini && status.proxy;
}

export function hasFullAICapability(status: ConfigStatus): boolean {
  // 是否具备完整AI能力（包括备用引擎）
  return status.gemini && status.anthropic;
}
```

### 配置状态指示器

在Dashboard顶部显示配置完成度：

```tsx
// components/dashboard/ConfigStatusBanner.tsx
export function ConfigStatusBanner() {
  const [status, setStatus] = useState<ConfigStatus | null>(null);

  useEffect(() => {
    fetch('/api/settings/status').then(res => res.json()).then(data => {
      setStatus(data.data);
    });
  }, []);

  if (!status) return null;

  const isReady = isSystemReady(status);

  if (isReady) {
    return null; // 全部配置完成，不显示Banner
  }

  const missingConfigs = [];
  if (!status.google_ads) missingConfigs.push('Google Ads API');
  if (!status.gemini) missingConfigs.push('Gemini API');
  if (!status.proxy) missingConfigs.push('代理配置');

  return (
    <Alert variant="warning">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        系统配置未完成，请先完成以下配置：{missingConfigs.join('、')}
        <Link href="/settings" className="ml-2 underline">
          前往配置
        </Link>
      </AlertDescription>
    </Alert>
  );
}
```

---

## 📚 相关文档

### 详细设计文档

1. **SETTINGS_PAGE_DESIGN.md** - 统一配置页面完整设计
   - 页面布局和Tab结构
   - 三个配置组件的完整实现
   - API端点详细设计

2. **PROXY_CONFIGURATION_DESIGN.md** - 代理配置详细设计
   - Proxy URL格式规范
   - 代理IP获取机制
   - 业务场景集成（Playwright、HTTP请求、风险检测）
   - 错误处理和安全考虑

### 业务功能文档

- **ONE_CLICK_LAUNCH.md** - 使用Gemini API生成关键词和广告创意
- **RISK_ALERT_DESIGN.md** - 使用代理进行链接检测
- **API_INTEGRATION_V2.md** - 使用Google Ads API创建Campaign

---

## ✨ 关键要点

### 配置前置要求

**用户必须完成所有三项配置才能使用系统核心功能**:

1. ❌ 未配置Google Ads API → 无法创建Campaign
2. ❌ 未配置Gemini API → 无法生成关键词和广告创意
3. ❌ 未配置代理 → 无法进行数据爬取和链接检测

### 用户体验流程

```
新用户注册
  ↓
首次登录Dashboard
  ↓
显示"系统配置未完成"Banner
  ↓
点击"前往配置"链接 → 跳转到/settings
  ↓
依次完成三项配置（Google Ads、Gemini、代理）
  - 每项都需要验证通过才能保存
  - 验证状态实时显示
  ↓
所有配置完成 → Banner消失
  ↓
系统功能全部可用
```

### 代理使用原则

**关键原则**: 绝不降级为直连访问

```typescript
// ❌ 错误示例：降级为直连
try {
  const proxy = await getProxyIp(proxyUrl);
  await fetchWithProxy(url, proxy);
} catch (error) {
  // 不要这样做！
  await fetchDirectly(url);  // ❌ 降级为直连
}

// ✅ 正确示例：失败即报错
try {
  const proxy = await getProxyIp(proxyUrl);
  await fetchWithProxy(url, proxy);
} catch (error) {
  throw new Error('代理服务不可用，无法执行操作'); // ✅ 抛出错误
}
```

---

**文档状态**: ✅ 设计完成
**主要文档**: SETTINGS_PAGE_DESIGN.md, PROXY_CONFIGURATION_DESIGN.md
**预计上线时间**: 10个工作日后
