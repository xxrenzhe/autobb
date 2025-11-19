# Alert 弹窗迁移指南

## 概述

将项目中所有原生 `alert()` 替换为美观的通知系统。

## 已完成的优化

### 1. RiskAlertPanel.tsx ✅
- **链接检查结果**：使用 AlertDialog 展示详细的检查结果（总计、可访问、失效、重定向、新提示）
- **更新状态**：使用 Toast 通知显示成功/失败消息

## 统一通知系统

### Toast 工具函数（/src/lib/toast-utils.ts）

```typescript
import { showSuccess, showError, showWarning, showInfo, showPromise } from '@/lib/toast-utils'

// 成功通知
showSuccess('操作成功', '详细描述（可选）')

// 错误通知
showError('操作失败', '错误详情（可选）')

// 警告通知
showWarning('请注意', '警告内容')

// 信息通知
showInfo('提示信息', '详细说明')

// Promise 通知（自动处理加载、成功、失败）
showPromise(
  fetch('/api/data'),
  {
    loading: '正在加载...',
    success: '加载成功',
    error: '加载失败'
  }
)
```

## 需要迁移的文件（共30+处）

### 高优先级（用户可见）

#### 1. LaunchAdModal.tsx (6处)
```typescript
// 当前
alert(`获取关键词建议失败: ${error.message || '请重试'}`)

// 替换为
showError('获取关键词建议失败', error.message || '请重试')
```

#### 2. OptimizationTaskList.tsx (3处)
```typescript
// 当前
alert(`成功生成 ${data.generatedTasks} 个优化任务`)

// 替换为
showSuccess('任务生成成功', `已生成 ${data.generatedTasks} 个优化任务`)
```

#### 3. ChangePasswordModal.tsx (1处)
```typescript
// 当前
alert('密码修改成功！请重新登录')

// 替换为
showSuccess('密码修改成功', '请重新登录')
```

#### 4. Creatives Page (8处)
```typescript
// 成功
alert(`成功生成${data.count}组创意！`)
→ showSuccess('创意生成成功', `已生成 ${data.count} 组创意`)

// 错误
alert(err.message)
→ showError('操作失败', err.message)

// 提示
alert('请选择一个Ad Group')
→ showWarning('请选择Ad Group', '需要先选择一个Ad Group才能继续')
```

#### 5. Campaigns Page (3处)
```typescript
alert('广告系列已成功同步到Google Ads！')
→ showSuccess('同步成功', '广告系列已成功同步到Google Ads')
```

#### 6. Ad Groups Page (5处)
```typescript
alert(`Ad Group和${data.syncedKeywordsCount}个关键词已成功同步到Google Ads！`)
→ showSuccess('同步成功', `Ad Group和${data.syncedKeywordsCount}个关键词已同步`)
```

### 中优先级（管理功能）

#### 7. UserEditModal.tsx (1处)
```typescript
alert('用户信息更新成功！')
→ showSuccess('更新成功', '用户信息已更新')
```

#### 8. Offers Page (3处)
```typescript
alert('产品信息抓取已启动，请稍后刷新页面查看结果')
→ showInfo('抓取已启动', '请稍后刷新页面查看结果')
```

### 低优先级（内部工具）

#### 9. export-utils.ts (1处)
```typescript
alert('没有可导出的数据')
→ showWarning('无法导出', '没有可导出的数据')
```

#### 10. Launch Score Page (1处)
```typescript
alert('Launch Score计算完成！')
→ showSuccess('计算完成', 'Launch Score已计算完成')
```

## 迁移步骤

### 1. 简单替换（文本通知）

**之前：**
```typescript
alert('操作成功')
```

**之后：**
```typescript
import { showSuccess } from '@/lib/toast-utils'
showSuccess('操作成功')
```

### 2. 带描述的通知

**之前：**
```typescript
alert(`删除失败：${err.message}`)
```

**之后：**
```typescript
import { showError } from '@/lib/toast-utils'
showError('删除失败', err.message)
```

### 3. 异步操作通知

**之前：**
```typescript
try {
  await fetch('/api/data')
  alert('成功')
} catch (error) {
  alert('失败')
}
```

**之后：**
```typescript
import { showPromise } from '@/lib/toast-utils'

showPromise(
  fetch('/api/data'),
  {
    loading: '正在处理...',
    success: '操作成功',
    error: '操作失败'
  }
)
```

### 4. 复杂结果展示（类似链接检查）

对于需要展示详细数据的场景，使用 AlertDialog：

```typescript
// 1. 添加状态
const [showResultDialog, setShowResultDialog] = useState(false)
const [result, setResult] = useState<ResultType | null>(null)

// 2. 触发时设置状态
setResult(data)
setShowResultDialog(true)

// 3. 创建弹窗组件
<AlertDialog open={showResultDialog} onOpenChange={setShowResultDialog}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>操作结果</AlertDialogTitle>
    </AlertDialogHeader>
    {/* 展示详细数据 */}
    <AlertDialogFooter>
      <Button onClick={() => setShowResultDialog(false)}>确定</Button>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

## 通知类型选择指南

| 场景 | 使用方法 | 示例 |
|------|---------|------|
| 操作成功 | `showSuccess()` | 保存成功、同步成功 |
| 操作失败 | `showError()` | 网络错误、验证失败 |
| 警告提示 | `showWarning()` | 缺少必填项、即将过期 |
| 信息提示 | `showInfo()` | 后台处理中、提示说明 |
| 异步操作 | `showPromise()` | API调用、文件上传 |
| 详细结果 | `AlertDialog` | 检查报告、批量结果 |

## 迁移优先级

### P0 - 紧急（用户体验严重影响）✅ 已完成
1. ✅ RiskAlertPanel.tsx - 链接检查结果
2. ✅ LaunchAdModal.tsx - 广告创建流程
3. ✅ ChangePasswordModal.tsx - 密码修改

### P1 - 高优先级（核心功能）✅ 100% 完成
4. ✅ OptimizationTaskList.tsx (3/3) - 优化任务
5. ✅ Creatives Page (11/11) - 创意管理
6. ✅ Campaigns Page (4/4) - 广告系列管理
7. ✅ Ad Groups Page (5/5) - 广告组管理

### P2 - 中优先级（常用功能）✅ 100% 完成
8. ✅ Offers Detail Page (4/4) - Offer管理
9. ✅ UserEditModal.tsx (1/1) - 用户管理
10. ✅ Launch Score Page (1/1) - 评分系统

### P3 - 低优先级（工具功能）✅ 100% 完成
11. ✅ export-utils.ts (1/1) - 导出工具

## 最佳实践

### ✅ 推荐
```typescript
// 明确的成功/失败消息
showSuccess('广告系列已创建', '系统正在同步到Google Ads')

// 使用描述字段提供详细信息
showError('同步失败', `错误代码: ${error.code}`)

// 异步操作使用 Promise 通知
showPromise(promise, { loading, success, error })
```

### ❌ 避免
```typescript
// 不要使用模糊的消息
showSuccess('完成')  // ❌ 不清楚完成了什么

// 不要在 Toast 中放太多信息
showSuccess('标题', '一段很长很长的详细说明...')  // ❌ 使用 AlertDialog

// 不要混用原生 alert
alert('这样不好')  // ❌ 统一使用 Toast 系统
```

## 进度跟踪

- ✅ 创建统一通知系统 (toast-utils.ts)
- ✅ RiskAlertPanel.tsx (2/2)
- ✅ LaunchAdModal.tsx (6/6) - P0 完成
- ✅ ChangePasswordModal.tsx (1/1) - P0 完成
- ✅ OptimizationTaskList.tsx (3/3) - P1 完成
- ✅ Creatives Page (11/11) - P1 完成 *(实际有11处，比预期的8处多3处)*
- ✅ Campaigns Page (4/4) - P1 完成 *(实际有4处，比预期的3处多1处)*
- ✅ Ad Groups Page (5/5) - P1 完成
- ✅ Offers Detail Page (4/4) - P2 完成 *(实际有4处，比预期的3处多1处)*
- ✅ UserEditModal.tsx (1/1) - P2 完成
- ✅ Launch Score Page (1/1) - P2 完成
- ✅ Admin Backups Page (3/3) - Final 10% 完成 *(实际有3处，比预期的2处多1处)*
- ✅ Campaigns New Page (1/1) - Final 10% 完成
- ✅ Change Password Page (1/1) - Final 10% 完成
- ✅ export-utils.ts (1/1) - P3 完成

**总进度：42/42 (100%) 🎉**
**P0 紧急项：2/2 (100%) ✅**
**P1 高优先级：4/4 (100%) ✅**
**P2 中优先级：3/3 (100%) ✅**
**P3 低优先级：1/1 (100%) ✅**
**Final 10%：4/4 (100%) ✅ 全部完成！**

## 🎉 迁移完成总结

### 最终统计
- **总计迁移**: 42个 alert/confirm 调用
- **涉及文件**: 15个文件
- **完成率**: 100%
- **零原生弹窗**: 代码库中不再有任何 alert() 或 confirm() 调用

### 迁移成果
1. **用户体验提升**: 从原生浏览器弹窗升级到现代化 Toast 通知系统
2. **一致性**: 所有通知使用统一的 toast-utils 工具函数
3. **可维护性**: 集中管理通知逻辑，易于后续调整样式和行为
4. **无障碍性**: Sonner Toast 支持更好的无障碍访问

### 技术要点
- **Toast 库**: Sonner (React Toast 通知库)
- **工具函数**: showSuccess, showError, showWarning, showInfo, showConfirm, showPromise
- **统一导入**: `import { ... } from '@/lib/toast-utils'`

### 发现和修复
- **Bug 修复**: Launch Score Page token 参数错误
- **实际数量**: 多个文件的 alert 数量比预期多
  - Creatives: 11个 (预期8个)
  - Campaigns: 4个 (预期3个)
  - Offers: 4个 (预期3个)
  - Backups: 3个 (预期2个)

### 迁移日期
2025年完成
