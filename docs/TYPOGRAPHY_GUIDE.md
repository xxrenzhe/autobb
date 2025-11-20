# 字体大小规范指南

## 概述

统一的字体大小系统可确保整个应用的视觉一致性和可读性。所有页面必须遵循此规范，避免字体大小忽大忽小影响用户体验。

## 字体层级系统

### 标题层级 (Headers)

| 类名 | 尺寸 | 用途 | 示例 |
|------|------|------|------|
| `.text-display` | 48px (3rem) | 超大展示标题 | Landing页面主标题 |
| `.text-h1` | 30px (1.875rem) | 页面主标题 | "用户管理"、"系统设置" |
| `.text-h2` | 24px (1.5rem) | 二级标题/区块标题 | "基本信息"、"配置选项" |
| `.text-h3` | 20px (1.25rem) | 三级标题/卡片标题 | 卡片顶部标题 |
| `.text-h4` | 18px (1.125rem) | 四级标题/小节标题 | 表单分组标题 |
| `.text-h5` | 16px (1rem) | 五级标题 | 列表项标题 |

### 正文层级 (Body Text)

| 类名 | 尺寸 | 用途 | 示例 |
|------|------|------|------|
| `.text-body-lg` | 18px (1.125rem) | 大正文/强调内容 | 重要说明、引导文本 |
| `.text-body` | 16px (1rem) | 标准正文 | 默认文本、表单标签 |
| `.text-body-sm` | 14px (0.875rem) | 小正文/次要信息 | 描述文本、次要内容 |

### 辅助文本层级 (Supporting Text)

| 类名 | 尺寸 | 用途 | 示例 |
|------|------|------|------|
| `.text-caption` | 12px (0.75rem) | 注释/标签/帮助文本 | 时间戳、提示信息 |
| `.text-overline` | 10px (0.625rem) | 超小标签/分类标识 | 分类标签、状态徽章 |

### 组合样式 (Combined Styles)

快捷类，包含字体大小、颜色、间距等完整样式：

| 类名 | 说明 | 包含样式 |
|------|------|----------|
| `.page-title` | 页面主标题 | text-h1 + 前景色 + 底部间距 |
| `.page-subtitle` | 页面副标题 | text-body + 弱化色 |
| `.section-title` | 区块标题 | text-h2 + 前景色 + 底部间距 |
| `.card-title` | 卡片标题 | text-h3 + 前景色 + 底部间距 |
| `.label-text` | 表单标签 | text-body-sm + 中等字重 + 前景色 |
| `.helper-text` | 帮助文本 | text-caption + 弱化色 |

## 使用指南

### ✅ 正确用法

#### 页面结构
```tsx
export default function Page() {
  return (
    <div>
      {/* 页面标题 */}
      <h1 className="page-title">用户管理</h1>
      <p className="page-subtitle">管理系统用户和权限配置</p>

      {/* 区块标题 */}
      <h2 className="section-title">活跃用户</h2>

      {/* 卡片 */}
      <div className="card">
        <h3 className="card-title">用户详情</h3>
        <p className="text-body">这是标准正文内容</p>
        <span className="helper-text">最后更新: 2分钟前</span>
      </div>
    </div>
  )
}
```

#### 表单
```tsx
<div>
  <label className="label-text">
    用户名 <span className="text-caption text-red-500">*</span>
  </label>
  <input className="text-body" />
  <p className="helper-text">请输入3-20个字符</p>
</div>
```

#### 列表
```tsx
<div>
  <div className="text-h4">张三</div>
  <div className="text-body-sm text-muted-foreground">admin@example.com</div>
  <div className="text-caption text-muted-foreground">2024-01-15 加入</div>
</div>
```

### ❌ 错误用法

**不要使用任意字体大小**：
```tsx
{/* ❌ 错误 - 使用任意大小 */}
<h1 className="text-4xl">标题</h1>
<p className="text-[15px]">内容</p>

{/* ✅ 正确 - 使用规范类 */}
<h1 className="text-h1">标题</h1>
<p className="text-body">内容</p>
```

**不要混合使用不同的大小逻辑**：
```tsx
{/* ❌ 错误 - 同一层级不一致 */}
<h2 className="text-2xl">标题1</h2>
<h2 className="text-xl">标题2</h2>

{/* ✅ 正确 - 同一层级一致 */}
<h2 className="text-h2">标题1</h2>
<h2 className="text-h2">标题2</h2>
```

## 迁移指南

### 字体大小映射表

从现有Tailwind类迁移到规范类：

| 旧类名 | 新类名 | 说明 |
|--------|--------|------|
| `text-5xl`, `text-6xl` | `text-display` | 超大标题 |
| `text-4xl` | `text-h1` | 主标题 |
| `text-3xl` | `text-h1` | 主标题 |
| `text-2xl` | `text-h2` | 二级标题 |
| `text-xl` | `text-h3` | 三级标题 |
| `text-lg` | `text-h4` 或 `text-body-lg` | 根据用途选择 |
| `text-base` | `text-body` | 标准正文 |
| `text-sm` | `text-body-sm` | 小正文 |
| `text-xs` | `text-caption` | 注释 |

### 批量迁移步骤

1. **查找所有字体大小使用**
   ```bash
   grep -r "text-\[" src/
   grep -r "text-[2-6]xl\|text-lg\|text-base\|text-sm\|text-xs" src/
   ```

2. **按页面逐个迁移**
   - 从用户最常访问的页面开始
   - Dashboard > Offers > Settings > Admin

3. **验证视觉一致性**
   - 同层级元素大小是否一致
   - 层级关系是否清晰
   - 阅读体验是否流畅

## 响应式设计

虽然基础规范不包含响应式变化，但在必要时可以添加：

```tsx
{/* 在小屏幕上略微缩小主标题 */}
<h1 className="text-h1 sm:text-h2">标题</h1>

{/* 在移动端使用更小的正文 */}
<p className="text-body md:text-body-lg">内容</p>
```

**注意**：只在确实需要响应式调整时使用，保持简单。

## 特殊场景

### 数字和指标
大数字展示（如KPI卡片）可以使用：
```tsx
<div className="text-4xl font-bold">1,234</div>
<div className="text-caption text-muted-foreground">总用户数</div>
```

### 按钮文本
按钮内文本使用 `text-body-sm` 或 `text-body`：
```tsx
<button className="px-4 py-2 text-body-sm">保存</button>
```

### 表格
- 表头：`text-body-sm font-medium`
- 单元格：`text-body-sm`
- 辅助信息：`text-caption`

## 检查清单

在提交代码前，确认：

- [ ] 页面主标题使用 `page-title` 或 `text-h1`
- [ ] 区块标题使用 `section-title` 或 `text-h2`
- [ ] 正文内容使用 `text-body`
- [ ] 辅助信息使用 `text-body-sm` 或 `text-caption`
- [ ] 没有使用 `text-[自定义px]` 语法
- [ ] 同层级元素字体大小一致
- [ ] 层级关系清晰合理

## 常见问题

### Q: 什么时候可以不用这些类？
A: 只在非常特殊的场景（如特殊设计的Landing页面）可以自定义，但必须在团队讨论后决定。

### Q: 如果觉得某个规范类不合适怎么办？
A: 先使用最接近的类，然后在团队中提出修改规范的建议，而不是单独使用自定义大小。

### Q: 可以在规范类基础上添加其他样式吗？
A: 可以，比如 `text-h2 text-blue-600` 是允许的，只要字体大小来自规范类。

## 相关资源

- 源码位置: `src/app/globals.css`
- 设计规范: 遵循主流设计系统（Material Design, Tailwind默认scale等）
- 可访问性: 所有字体大小符合WCAG 2.1标准
