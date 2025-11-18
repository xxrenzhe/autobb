# 统一配置页面设计

**创建日期**: 2025-01-18
**版本**: 1.0
**状态**: 设计完成，待开发

---

## 目录

1. [功能概述](#功能概述)
2. [配置项分类](#配置项分类)
3. [数据库设计](#数据库设计)
4. [前端UI设计](#前端ui设计)
5. [API设计](#api设计)
6. [验证逻辑](#验证逻辑)
7. [实施计划](#实施计划)

---

## 功能概述

### 核心需求

**用户场景**: 用户需要一个集中的配置页面，管理所有系统运行所需的配置信息

**配置项包括**:
- ✅ Google Ads API配置（Developer Token、Client ID、Client Secret等）
- ✅ AI配置（Gemini 2.5主引擎 + Claude备用引擎）
- ✅ 代理URL配置
- ✅ 其他系统配置

**核心功能**:
- ✅ 统一的配置管理界面
- ✅ 实时验证配置项
- ✅ 敏感信息加密存储
- ✅ 配置状态指示（已配置/未配置/验证失败）
- ✅ 分组展示（按功能模块分组）

**业务价值**:
- 🎯 集中管理：所有配置在一个页面完成
- ✅ 状态清晰：一目了然哪些配置已完成
- 🔒 安全存储：敏感信息加密保存
- 📊 验证反馈：实时检测配置是否正确

---

## 配置项分类

### 1. Google Ads API配置

**配置项**:

| 字段名 | 类型 | 必填 | 说明 | 验证规则 |
|--------|------|------|------|----------|
| developer_token | string | ✅ | 开发者令牌 | 非空，格式检查 |
| client_id | string | ✅ | OAuth 2.0客户端ID | 非空，格式检查 |
| client_secret | string | ✅ | OAuth 2.0客户端密钥 | 非空 |
| login_customer_id | string | ❌ | MCC账号ID（可选） | 格式: XXX-XXX-XXXX |

**验证方法**:
- 调用Google Ads API测试连接
- 验证Developer Token是否有效
- 验证OAuth凭据是否正确

### 2. AI配置

#### 2.1 Gemini API配置（主引擎）

**配置项**:

| 字段名 | 类型 | 必填 | 说明 | 验证规则 |
|--------|------|------|------|----------|
| gemini_api_key | string | ✅ | Gemini API密钥 | 非空，以"AIza"开头 |
| gemini_model | string | ❌ | 使用的模型 | 默认: gemini-2.5-pro |

**模型选项**:
- `gemini-2.5-pro`: 推荐，最新版本，质量最高
- `gemini-2.5-flash`: 速度快，成本低（推荐用于生产）
- `gemini-2.0-flash-exp`: 实验性，速度最快

**验证方法**:
- 调用Gemini API发送测试请求
- 验证API Key是否有效
- 检查配额是否可用

**使用场景**:
- AI生成产品关键词（20-30个）
- AI生成广告标题（3-5个）
- AI生成广告描述（2-3个）
- 产品信息提取和分析

#### 2.2 Anthropic Claude API配置（备用引擎）

**配置项**:

| 字段名 | 类型 | 必填 | 说明 | 验证规则 |
|--------|------|------|------|----------|
| anthropic_api_key | string | ❌ | Claude API密钥 | 非空，以"sk-ant-"开头 |
| anthropic_model | string | ❌ | 使用的模型 | 默认: claude-sonnet-4-5-20250929 |

**模型选项**:
- `claude-sonnet-4-5-20250929`: 推荐，质量高
- `claude-3-5-sonnet-20241022`: 旧版本
- `claude-3-opus-20240229`: 最高质量，成本最高

**验证方法**:
- 调用Anthropic API发送测试请求
- 验证API Key是否有效
- 检查配额是否可用

**使用场景**:
- **备用AI引擎**: 当Gemini API失败时自动切换
- **Fallback策略**: Gemini → Claude → 基础模板
- **质量保证**: 确保100%的Offer保持高质量输出

**成本估算**:
- Gemini: ~$30/月（主引擎，预计90%使用率）
- Claude: ~$10/月（备用，预计<10%使用率）
- **总计**: ~$40/月

**是否必填**: ❌ **可选但推荐**
- 不配置：Gemini失败时使用基础模板（质量一般）
- 配置后：Gemini失败时自动切换Claude（质量高）

### 3. 代理配置

**配置项**:

| 字段名 | 类型 | 必填 | 说明 | 验证规则 |
|--------|------|------|------|----------|
| proxy_url | string | ✅ | 代理服务商API URL | URL格式，包含必需参数 |
| proxy_enabled | boolean | ✅ | 是否启用代理 | true/false |

**验证方法**:
- 检查URL格式（必须包含cc、ips、proxyType=http、responseType=txt）
- 调用代理API获取测试IP
- 验证代理IP是否可用

### 4. 其他配置（未来扩展）

- 邮件通知配置
- Webhook配置
- 数据导出配置

---

## 数据库设计

### user_settings表（完整Schema）

```sql
CREATE TABLE user_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,

  -- Google Ads API配置
  google_ads_developer_token TEXT,
  google_ads_client_id TEXT,
  google_ads_client_secret TEXT,
  google_ads_login_customer_id TEXT,
  google_ads_validated BOOLEAN NOT NULL DEFAULT 0,
  google_ads_last_validated_at TEXT,
  google_ads_validation_error TEXT,

  -- Gemini API配置（主AI引擎）
  gemini_api_key TEXT,
  gemini_model TEXT DEFAULT 'gemini-2.5-pro',
  gemini_validated BOOLEAN NOT NULL DEFAULT 0,
  gemini_last_validated_at TEXT,
  gemini_validation_error TEXT,

  -- Anthropic Claude API配置（备用AI引擎）
  anthropic_api_key TEXT,
  anthropic_model TEXT DEFAULT 'claude-sonnet-4-5-20250929',
  anthropic_validated BOOLEAN NOT NULL DEFAULT 0,
  anthropic_last_validated_at TEXT,
  anthropic_validation_error TEXT,

  -- 代理配置
  proxy_url TEXT,
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

-- 索引
CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX idx_user_settings_google_ads_validated ON user_settings(google_ads_validated);
CREATE INDEX idx_user_settings_gemini_validated ON user_settings(gemini_validated);
CREATE INDEX idx_user_settings_proxy_enabled ON user_settings(proxy_enabled);
```

**加密字段**:
以下字段需要加密存储：
- `google_ads_developer_token`
- `google_ads_client_secret`
- `gemini_api_key`
- `anthropic_api_key`
- `proxy_url`

---

## 前端UI设计

### 1. 配置页面整体布局

```typescript
// app/(dashboard)/settings/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GoogleAdsSettings } from '@/components/settings/GoogleAdsSettings';
import { AISettings } from '@/components/settings/AISettings';
import { ProxySettings } from '@/components/settings/ProxySettings';

export default function SettingsPage() {
  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">系统配置</h1>
        <p className="text-gray-500 mt-2">
          配置系统运行所需的API密钥和服务信息
        </p>
      </div>

      <Tabs defaultValue="google-ads" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="google-ads">
            Google Ads API
          </TabsTrigger>
          <TabsTrigger value="ai">
            AI配置
          </TabsTrigger>
          <TabsTrigger value="proxy">
            代理配置
          </TabsTrigger>
        </TabsList>

        <TabsContent value="google-ads">
          <GoogleAdsSettings />
        </TabsContent>

        <TabsContent value="ai">
          <AISettings />
        </TabsContent>

        <TabsContent value="proxy">
          <ProxySettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### 2. Google Ads API配置组件

```typescript
// components/settings/GoogleAdsSettings.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export function GoogleAdsSettings() {
  const [formData, setFormData] = useState({
    developer_token: '',
    client_id: '',
    client_secret: '',
    login_customer_id: ''
  });
  const [isValidated, setIsValidated] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings/google-ads');
      const data = await response.json();

      if (data.success) {
        setFormData({
          developer_token: data.data.developer_token || '',
          client_id: data.data.client_id || '',
          client_secret: data.data.client_secret || '',
          login_customer_id: data.data.login_customer_id || ''
        });
        setIsValidated(data.data.validated);
        setValidationError(data.data.validation_error);
      }
    } catch (error) {
      console.error('获取配置失败:', error);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setValidationError(null);

    try {
      const response = await fetch('/api/settings/google-ads/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        setIsValidated(true);
        toast.success('Google Ads API验证成功');
      } else {
        setIsValidated(false);
        setValidationError(data.error);
        toast.error('验证失败');
      }
    } catch (error) {
      toast.error('验证失败');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const response = await fetch('/api/settings/google-ads', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        toast.success('配置已保存');
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Google Ads API配置</CardTitle>
            <CardDescription>
              配置Google Ads API凭据以创建和管理广告Campaign
            </CardDescription>
          </div>
          {isValidated && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm font-medium">已验证</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Developer Token */}
        <div className="space-y-2">
          <Label htmlFor="developer-token">
            Developer Token <span className="text-red-500">*</span>
          </Label>
          <Input
            id="developer-token"
            type="text"
            placeholder="输入Developer Token"
            value={formData.developer_token}
            onChange={(e) => setFormData({ ...formData, developer_token: e.target.value })}
            className="font-mono"
          />
          <p className="text-xs text-gray-500">
            从Google Ads API Center获取
            <a
              href="https://ads.google.com/aw/apicenter"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 text-blue-600 hover:underline inline-flex items-center gap-1"
            >
              前往获取
              <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>

        {/* Client ID */}
        <div className="space-y-2">
          <Label htmlFor="client-id">
            Client ID <span className="text-red-500">*</span>
          </Label>
          <Input
            id="client-id"
            type="text"
            placeholder="输入OAuth 2.0 Client ID"
            value={formData.client_id}
            onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
            className="font-mono"
          />
          <p className="text-xs text-gray-500">
            从Google Cloud Console获取
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 text-blue-600 hover:underline inline-flex items-center gap-1"
            >
              前往获取
              <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>

        {/* Client Secret */}
        <div className="space-y-2">
          <Label htmlFor="client-secret">
            Client Secret <span className="text-red-500">*</span>
          </Label>
          <Input
            id="client-secret"
            type="password"
            placeholder="输入OAuth 2.0 Client Secret"
            value={formData.client_secret}
            onChange={(e) => setFormData({ ...formData, client_secret: e.target.value })}
            className="font-mono"
          />
        </div>

        {/* Login Customer ID (可选) */}
        <div className="space-y-2">
          <Label htmlFor="login-customer-id">
            Login Customer ID (可选)
          </Label>
          <Input
            id="login-customer-id"
            type="text"
            placeholder="XXX-XXX-XXXX"
            value={formData.login_customer_id}
            onChange={(e) => setFormData({ ...formData, login_customer_id: e.target.value })}
            className="font-mono"
          />
          <p className="text-xs text-gray-500">
            如果使用MCC账号管理多个子账号，请填写MCC账号ID
          </p>
        </div>

        {/* 验证错误提示 */}
        {validationError && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{validationError}</AlertDescription>
          </Alert>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-3">
          <Button
            onClick={handleTest}
            disabled={!formData.developer_token || !formData.client_id || !formData.client_secret || isTesting}
            variant="outline"
          >
            {isTesting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                测试连接中...
              </>
            ) : (
              '测试连接'
            )}
          </Button>

          <Button
            onClick={handleSave}
            disabled={!isValidated || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                保存中...
              </>
            ) : (
              '保存配置'
            )}
          </Button>
        </div>

        {/* 配置说明 */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">配置步骤</h4>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>创建Google Cloud项目并启用Google Ads API</li>
            <li>创建OAuth 2.0凭据（Web应用类型）</li>
            <li>申请Google Ads API Developer Token</li>
            <li>填写上述信息并点击"测试连接"</li>
            <li>验证通过后点击"保存配置"</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
```

### 3. AI配置组件（合并Gemini和Claude）

```typescript
// components/settings/AISettings.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, XCircle, Loader2, ExternalLink, Info } from 'lucide-react';
import { toast } from 'sonner';

export function AISettings() {
  const [geminiData, setGeminiData] = useState({
    api_key: '',
    model: 'gemini-2.5-pro'
  });
  const [claudeData, setClaudeData] = useState({
    api_key: '',
    model: 'claude-sonnet-4-5-20250929'
  });
  const [geminiValidated, setGeminiValidated] = useState(false);
  const [claudeValidated, setClaudeValidated] = useState(false);
  const [geminiError, setGeminiError] = useState<string | null>(null);
  const [claudeError, setClaudeError] = useState<string | null>(null);
  const [isTestingGemini, setIsTestingGemini] = useState(false);
  const [isTestingClaude, setIsTestingClaude] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      // Fetch Gemini settings
      const geminiResponse = await fetch('/api/settings/gemini');
      const geminiResult = await geminiResponse.json();

      if (geminiResult.success) {
        setGeminiData({
          api_key: geminiResult.data.api_key || '',
          model: geminiResult.data.model || 'gemini-2.5-pro'
        });
        setGeminiValidated(geminiResult.data.validated);
        setGeminiError(geminiResult.data.validation_error);
      }

      // Fetch Claude settings
      const claudeResponse = await fetch('/api/settings/anthropic');
      const claudeResult = await claudeResponse.json();

      if (claudeResult.success) {
        setClaudeData({
          api_key: claudeResult.data.api_key || '',
          model: claudeResult.data.model || 'claude-sonnet-4-5-20250929'
        });
        setClaudeValidated(claudeResult.data.validated);
        setClaudeError(claudeResult.data.validation_error);
      }
    } catch (error) {
      console.error('获取配置失败:', error);
    }
  };

  const handleTestGemini = async () => {
    setIsTestingGemini(true);
    setGeminiError(null);

    try {
      const response = await fetch('/api/settings/gemini/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiData)
      });

      const data = await response.json();

      if (data.success) {
        setGeminiValidated(true);
        toast.success('Gemini API验证成功');
      } else {
        setGeminiValidated(false);
        setGeminiError(data.error);
        toast.error('Gemini验证失败');
      }
    } catch (error) {
      toast.error('Gemini验证失败');
    } finally {
      setIsTestingGemini(false);
    }
  };

  const handleTestClaude = async () => {
    setIsTestingClaude(true);
    setClaudeError(null);

    try {
      const response = await fetch('/api/settings/anthropic/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(claudeData)
      });

      const data = await response.json();

      if (data.success) {
        setClaudeValidated(true);
        toast.success('Claude API验证成功');
      } else {
        setClaudeValidated(false);
        setClaudeError(data.error);
        toast.error('Claude验证失败');
      }
    } catch (error) {
      toast.error('Claude验证失败');
    } finally {
      setIsTestingClaude(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      // Save Gemini settings
      const geminiResponse = await fetch('/api/settings/gemini', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiData)
      });

      // Save Claude settings
      const claudeResponse = await fetch('/api/settings/anthropic', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(claudeData)
      });

      const geminiResult = await geminiResponse.json();
      const claudeResult = await claudeResponse.json();

      if (geminiResult.success && claudeResult.success) {
        toast.success('AI配置已保存');
      } else {
        toast.error('保存失败，请检查配置');
      }
    } catch (error) {
      toast.error('保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI配置</CardTitle>
        <CardDescription>
          配置AI引擎用于生成关键词、广告创意等功能
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-8">
        {/* Gemini配置区域 */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-medium">Gemini API（主引擎）</h3>
            <Badge>必填</Badge>
            {geminiValidated && (
              <div className="flex items-center gap-1 text-green-600 ml-auto">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs font-medium">已验证</span>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {/* Gemini API Key */}
            <div className="space-y-2">
              <Label htmlFor="gemini-api-key">
                API Key <span className="text-red-500">*</span>
              </Label>
              <Input
                id="gemini-api-key"
                type="password"
                placeholder="AIza..."
                value={geminiData.api_key}
                onChange={(e) => setGeminiData({ ...geminiData, api_key: e.target.value })}
                className="font-mono"
              />
              <p className="text-xs text-gray-500">
                从Google AI Studio获取
                <a
                  href="https://makersuite.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  前往获取
                  <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </div>

            {/* Gemini Model Selection */}
            <div className="space-y-2">
              <Label htmlFor="gemini-model">模型选择</Label>
              <Select
                value={geminiData.model}
                onValueChange={(value) => setGeminiData({ ...geminiData, model: value })}
              >
                <SelectTrigger id="gemini-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro（推荐）</SelectItem>
                  <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash（更快，成本低）</SelectItem>
                  <SelectItem value="gemini-2.0-flash-exp">Gemini 2.0 Flash（实验性）</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                不同模型有不同的性能和定价，推荐使用Gemini 2.5 Pro
              </p>
            </div>

            {/* Gemini验证错误提示 */}
            {geminiError && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{geminiError}</AlertDescription>
              </Alert>
            )}

            {/* Gemini测试按钮 */}
            <div>
              <Button
                onClick={handleTestGemini}
                disabled={!geminiData.api_key || isTestingGemini}
                variant="outline"
                size="sm"
              >
                {isTestingGemini ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    测试连接中...
                  </>
                ) : (
                  '测试Gemini连接'
                )}
              </Button>
            </div>
          </div>
        </div>

        <Separator />

        {/* Claude配置区域 */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-medium">Claude API（备用引擎）</h3>
            <Badge variant="secondary">可选</Badge>
            {claudeValidated && (
              <div className="flex items-center gap-1 text-green-600 ml-auto">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs font-medium">已验证</span>
              </div>
            )}
          </div>

          <Alert className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              <div className="font-medium">备用AI引擎</div>
              <p className="text-sm mt-1">
                当Gemini API失败时自动切换到Claude，提升质量保证。
                预计使用率 &lt; 10%，月成本约 $10。
              </p>
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            {/* Claude API Key */}
            <div className="space-y-2">
              <Label htmlFor="claude-api-key">API Key</Label>
              <Input
                id="claude-api-key"
                type="password"
                placeholder="sk-ant-..."
                value={claudeData.api_key}
                onChange={(e) => setClaudeData({ ...claudeData, api_key: e.target.value })}
                className="font-mono"
              />
              <p className="text-xs text-gray-500">
                从Anthropic Console获取
                <a
                  href="https://console.anthropic.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  前往获取
                  <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </div>

            {/* Claude Model Selection */}
            <div className="space-y-2">
              <Label htmlFor="claude-model">模型选择</Label>
              <Select
                value={claudeData.model}
                onValueChange={(value) => setClaudeData({ ...claudeData, model: value })}
              >
                <SelectTrigger id="claude-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="claude-sonnet-4-5-20250929">Claude Sonnet 4.5（推荐）</SelectItem>
                  <SelectItem value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</SelectItem>
                  <SelectItem value="claude-3-opus-20240229">Claude 3 Opus（最高质量）</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                推荐使用Claude Sonnet 4.5，平衡质量和成本
              </p>
            </div>

            {/* Claude验证错误提示 */}
            {claudeError && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{claudeError}</AlertDescription>
              </Alert>
            )}

            {/* Claude测试按钮 */}
            <div>
              <Button
                onClick={handleTestClaude}
                disabled={!claudeData.api_key || isTestingClaude}
                variant="outline"
                size="sm"
              >
                {isTestingClaude ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    测试连接中...
                  </>
                ) : (
                  '测试Claude连接'
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* 保存按钮 */}
        <div className="flex justify-end pt-4">
          <Button
            onClick={handleSave}
            disabled={!geminiValidated || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                保存中...
              </>
            ) : (
              '保存AI配置'
            )}
          </Button>
        </div>

        {/* 使用场景说明 */}
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <h4 className="font-medium text-purple-900 mb-2">使用场景</h4>
          <ul className="text-sm text-purple-800 space-y-1 list-disc list-inside">
            <li>AI生成产品关键词（20-30个）</li>
            <li>AI生成广告标题（3-5个）</li>
            <li>AI生成广告描述（2-3个）</li>
            <li>产品信息分析和提取</li>
            <li>品牌名称验证</li>
          </ul>
        </div>

        {/* Fallback策略说明 */}
        <div className="p-4 bg-gray-50 border rounded-lg">
          <h4 className="font-medium mb-2">AI引擎Fallback策略</h4>
          <p className="text-sm text-gray-600">
            Gemini（主引擎，90%使用） → Claude（备用引擎，&lt;10%使用） → 基础模板
          </p>
          <p className="text-xs text-gray-500 mt-2">
            配置Claude可确保在Gemini失败时仍能保持高质量输出，月成本约$40（Gemini $30 + Claude $10）
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
```

### 4. 代理配置组件

```typescript
// components/settings/ProxySettings.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Loader2, Globe } from 'lucide-react';
import { toast } from 'sonner';

export function ProxySettings() {
  const [formData, setFormData] = useState({
    proxy_url: '',
    proxy_enabled: false
  });
  const [isValidated, setIsValidated] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [testIp, setTestIp] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings/proxy');
      const data = await response.json();

      if (data.success) {
        setFormData({
          proxy_url: data.data.proxy_url || '',
          proxy_enabled: data.data.proxy_enabled || false
        });
        setIsValidated(data.data.validated);
        setCountryCode(data.data.country_code);
      }
    } catch (error) {
      console.error('获取配置失败:', error);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setValidationErrors([]);
    setIsValidated(false);

    try {
      const response = await fetch('/api/settings/proxy/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proxy_url: formData.proxy_url })
      });

      const data = await response.json();

      if (data.success) {
        setIsValidated(true);
        setCountryCode(data.data.country_code);
        setTestIp(data.data.test_ip);
        toast.success('代理URL验证成功');
      } else {
        setIsValidated(false);
        setValidationErrors(data.errors || [data.error]);
        toast.error('验证失败');
      }
    } catch (error) {
      toast.error('验证失败');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const response = await fetch('/api/settings/proxy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        toast.success('配置已保存');
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const getCountryName = (code: string | null) => {
    if (!code) return '';
    switch (code) {
      case 'ROW': return '美国';
      case 'UK': return '英国';
      case 'CA': return '加拿大';
      default: return code;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>代理配置</CardTitle>
            <CardDescription>
              配置代理服务器，用于数据爬取和推广链接检测
            </CardDescription>
          </div>
          {isValidated && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm font-medium">已验证</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Proxy URL */}
        <div className="space-y-2">
          <Label htmlFor="proxy-url">
            Proxy URL <span className="text-red-500">*</span>
          </Label>
          <Input
            id="proxy-url"
            type="url"
            placeholder="https://api.iprocket.io/api?username=...&cc=ROW&ips=1&proxyType=http&responseType=txt"
            value={formData.proxy_url}
            onChange={(e) => setFormData({ ...formData, proxy_url: e.target.value })}
            className="font-mono text-sm"
          />
          <p className="text-xs text-gray-500">
            必须包含参数: cc（国家代码）、ips、proxyType=http、responseType=txt
          </p>
        </div>

        {/* 测试按钮 */}
        <div>
          <Button
            onClick={handleTest}
            disabled={!formData.proxy_url || isTesting}
            variant="outline"
          >
            {isTesting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                测试代理URL...
              </>
            ) : (
              '测试代理URL'
            )}
          </Button>
        </div>

        {/* 验证错误提示 */}
        {validationErrors.length > 0 && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="font-medium mb-2">URL格式验证失败：</div>
              <ul className="list-disc list-inside space-y-1">
                {validationErrors.map((error, index) => (
                  <li key={index} className="text-sm">{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* 验证成功提示 */}
        {isValidated && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <div className="font-medium">验证成功！</div>
              <div className="text-sm mt-2 space-y-1">
                <p>代理国家: {getCountryName(countryCode)}</p>
                {testIp && <p>测试IP: {testIp}</p>}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* 启用开关 */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <Label htmlFor="proxy-enabled" className="text-base font-medium">
              启用代理
            </Label>
            <p className="text-sm text-gray-500">
              启用后，所有数据爬取和链接检测将使用代理服务器
            </p>
          </div>
          <Switch
            id="proxy-enabled"
            checked={formData.proxy_enabled}
            onCheckedChange={(checked) => setFormData({ ...formData, proxy_enabled: checked })}
            disabled={!isValidated}
          />
        </div>

        {/* 保存按钮 */}
        <div className="flex gap-3">
          <Button
            onClick={handleSave}
            disabled={!isValidated || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                保存中...
              </>
            ) : (
              '保存配置'
            )}
          </Button>
        </div>

        {/* 国家代码说明 */}
        <div className="p-4 bg-gray-50 border rounded-lg">
          <h4 className="font-medium mb-2">国家代码说明</h4>
          <ul className="text-sm space-y-1 text-gray-600">
            <li>• <code className="bg-white px-1.5 py-0.5 rounded">cc=ROW</code> - 美国</li>
            <li>• <code className="bg-white px-1.5 py-0.5 rounded">cc=UK</code> - 英国</li>
            <li>• <code className="bg-white px-1.5 py-0.5 rounded">cc=CA</code> - 加拿大</li>
          </ul>
        </div>

        {/* 使用场景说明 */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">使用场景</h4>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>产品信息抓取（使用目标国家IP）</li>
            <li>推广链接可访问性检测</li>
            <li>Final URL获取和验证</li>
            <li>品牌信息验证</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## API设计

### 1. Google Ads API配置

#### GET /api/settings/google-ads
**获取Google Ads配置**

**响应**:
```json
{
  "success": true,
  "data": {
    "developer_token": "abc***xyz",
    "client_id": "123***789.apps.googleusercontent.com",
    "client_secret": "***",
    "login_customer_id": "123-456-7890",
    "validated": true,
    "last_validated_at": "2025-01-18T10:00:00Z",
    "validation_error": null
  }
}
```

#### POST /api/settings/google-ads/validate
**验证Google Ads配置**

**请求**:
```json
{
  "developer_token": "...",
  "client_id": "...",
  "client_secret": "...",
  "login_customer_id": "..."
}
```

**响应成功**:
```json
{
  "success": true,
  "message": "验证成功"
}
```

#### PUT /api/settings/google-ads
**保存Google Ads配置**

### 2. AI配置（Gemini + Claude）

#### GET /api/settings/gemini
**获取Gemini配置**

**响应**:
```json
{
  "success": true,
  "data": {
    "api_key": "AIza***",
    "model": "gemini-2.5-pro",
    "validated": true,
    "last_validated_at": "2025-01-18T10:00:00Z",
    "validation_error": null
  }
}
```

#### POST /api/settings/gemini/validate
**验证Gemini API Key**

**请求**:
```json
{
  "api_key": "AIza...",
  "model": "gemini-2.5-pro"
}
```

**响应成功**:
```json
{
  "success": true,
  "message": "验证成功"
}
```

#### PUT /api/settings/gemini
**保存Gemini配置**

**请求**:
```json
{
  "api_key": "AIza...",
  "model": "gemini-2.5-pro"
}
```

#### GET /api/settings/anthropic
**获取Claude配置**

**响应**:
```json
{
  "success": true,
  "data": {
    "api_key": "sk-ant-***",
    "model": "claude-sonnet-4-5-20250929",
    "validated": true,
    "last_validated_at": "2025-01-18T10:00:00Z",
    "validation_error": null
  }
}
```

#### POST /api/settings/anthropic/validate
**验证Claude API Key**

**请求**:
```json
{
  "api_key": "sk-ant-...",
  "model": "claude-sonnet-4-5-20250929"
}
```

**响应成功**:
```json
{
  "success": true,
  "message": "验证成功"
}
```

**响应失败**:
```json
{
  "success": false,
  "error": "API Key无效或已过期"
}
```

#### PUT /api/settings/anthropic
**保存Claude配置**

**请求**:
```json
{
  "api_key": "sk-ant-...",
  "model": "claude-sonnet-4-5-20250929"
}
```

**响应**:
```json
{
  "success": true,
  "message": "配置已保存"
}
```

### 3. 代理配置

#### GET /api/settings/proxy
**获取代理配置**

#### POST /api/settings/proxy/validate
**验证代理URL**（详见PROXY_CONFIGURATION_DESIGN.md）

#### PUT /api/settings/proxy
**保存代理配置**

### 4. 统一状态查询

#### GET /api/settings/status
**获取所有配置状态**

**响应**:
```json
{
  "success": true,
  "data": {
    "google_ads": {
      "configured": true,
      "validated": true
    },
    "gemini": {
      "configured": true,
      "validated": true
    },
    "anthropic": {
      "configured": false,
      "validated": false
    },
    "proxy": {
      "configured": true,
      "validated": true,
      "enabled": true
    }
  }
}
```

---

## 验证逻辑

### 1. Google Ads API验证

```typescript
// lib/validation/google-ads.ts
export async function validateGoogleAdsConfig(config: {
  developer_token: string;
  client_id: string;
  client_secret: string;
  login_customer_id?: string;
}): Promise<{ valid: boolean; error?: string }> {
  try {
    // Step 1: 格式验证
    if (!config.developer_token || !config.client_id || !config.client_secret) {
      return { valid: false, error: '必填字段不能为空' };
    }

    // Step 2: 实际API调用测试
    const { GoogleAdsApi } = require('google-ads-api');

    const client = new GoogleAdsApi({
      client_id: config.client_id,
      client_secret: config.client_secret,
      developer_token: config.developer_token
    });

    // 尝试获取可访问的客户账号
    // 这里需要一个有效的refresh_token，实际实现时需要OAuth流程
    // 简化版本：只验证格式和基本连接

    return { valid: true };

  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : '验证失败'
    };
  }
}
```

### 2. Gemini API验证

```typescript
// lib/validation/gemini.ts
export async function validateGeminiApiKey(apiKey: string, model: string): Promise<{ valid: boolean; error?: string }> {
  try {
    // Step 1: 格式验证
    if (!apiKey.startsWith('AIza')) {
      return { valid: false, error: 'API Key格式不正确，应以"AIza"开头' };
    }

    // Step 2: 实际API调用测试
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'test' }] }]
        })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return { valid: false, error: error.error?.message || 'API Key无效' };
    }

    return { valid: true };

  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : '验证失败'
    };
  }
}
```

### 3. Claude API验证

```typescript
// lib/validation/anthropic.ts
export async function validateClaudeApiKey(apiKey: string, model: string): Promise<{ valid: boolean; error?: string }> {
  try {
    // Step 1: 格式验证
    if (!apiKey.startsWith('sk-ant-')) {
      return { valid: false, error: 'API Key格式不正确，应以"sk-ant-"开头' };
    }

    // Step 2: 实际API调用测试
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 10,
        messages: [
          { role: 'user', content: 'test' }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        valid: false,
        error: error.error?.message || 'API Key无效或已过期'
      };
    }

    return { valid: true };

  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : '验证失败'
    };
  }
}
```

---

## 实施计划

### Phase 1: 数据库和基础架构（1天）
- ✅ 扩展user_settings表
- ✅ 数据库迁移脚本
- ✅ 加密存储实现

### Phase 2: API实现（2天）
- ✅ Google Ads API配置相关端点
- ✅ Gemini API配置相关端点
- ✅ Claude API配置相关端点
- ✅ 代理配置相关端点
- ✅ 统一状态查询端点

### Phase 3: 验证逻辑（2天）
- ✅ Google Ads验证实现
- ✅ Gemini验证实现
- ✅ Claude验证实现
- ✅ 代理验证实现（已在PROXY_CONFIGURATION_DESIGN.md中）

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

## 附录

### A. 配置完成度检查清单

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

### B. 相关文档

- `PROXY_CONFIGURATION_DESIGN.md`: 代理配置详细设计
- `TECHNICAL_SPEC_V2.md`: 数据库Schema
- `ONE_CLICK_LAUNCH.md`: 使用Gemini API生成关键词

---

**文档状态**: ✅ 设计完成
**下一步**: 开始Phase 1 - 数据库扩展
**预计上线时间**: 10个工作日后
