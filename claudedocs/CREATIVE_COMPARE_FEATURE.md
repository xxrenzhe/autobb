# Creative并排对比功能实现总结

## 功能概述

实现了多个Creative（最多3个）的Launch Score并排对比分析功能，帮助用户直观比较不同Creative版本的投放效果，选择最佳方案。

---

## 核心功能

### 1. Creative多选
- **多选UI**: Checkbox列表，最多选择3个Creative
- **视觉反馈**: 选中项高亮显示（蓝色边框 + 背景）
- **智能限制**: 达到3个上限后自动禁用未选中项
- **选择提示**: 实时显示"已选择 X/3 个Creative"

### 2. 并排雷达图对比
- **响应式布局**:
  - 2个Creative: `grid-cols-2`（大尺寸300px）
  - 3个Creative: `grid-cols-3`（中尺寸250px）
- **总分显示**: 顶部大字体展示，颜色编码（绿/蓝/红）
- **雷达图**: 5维度（关键词、市场、着陆页、预算、内容）可视化

### 3. 详细数据对比表格
- **7行指标**:
  1. 总分（颜色标注最优）
  2. 关键词分析（X/30）
  3. 市场契合（X/25）
  4. 着陆页质量（X/20）
  5. 预算效率（X/15）
  6. 内容创意（X/10）
  7. 质量评分（Creative本身的质量评分）

- **动态列数**: 根据选中Creative数量自动调整

### 4. 智能推荐
- 自动计算并标注最佳Creative
- 推荐卡片（绿色背景）
- 显示最佳版本号、标题和总分
- 给出明确建议："建议优先使用此Creative进行投放"

---

## 技术实现

### API端点
**文件**: `src/app/api/offers/[id]/launch-score/compare/route.ts`

```typescript
POST /api/offers/[id]/launch-score/compare
Body: { creativeIds: number[] }
```

**功能**:
1. 验证creativeIds数组（非空，最多5个）
2. 遍历每个creativeId，获取Creative详情和最新Launch Score
3. 返回对比数据数组

**数据结构**:
```typescript
{
  success: true,
  data: {
    offerId: number,
    comparisons: [
      {
        creativeId: number,
        creative: { id, version, headline1, headline2, description1, qualityScore, ... },
        score: {
          totalScore, calculatedAt,
          dimensions: { keyword, marketFit, landingPage, budget, content },
          analysis: { ... }
        } | null
      }
    ]
  }
}
```

**安全性**:
- 用户权限验证（x-user-id header）
- Creative所有权验证
- Offer归属验证

---

### 前端组件改造

**文件**: `src/components/LaunchScoreModal.tsx`

#### 1. 状态管理
```typescript
// 新增Tab类型
const [activeTab, setActiveTab] = useState<'current' | 'history' | 'compare'>('current')

// 对比相关状态
const [selectedCompareIds, setSelectedCompareIds] = useState<number[]>([])
const [compareData, setCompareData] = useState<any[]>([])
const [loadingCompare, setLoadingCompare] = useState(false)
```

#### 2. 数据加载逻辑
```typescript
const loadCompareData = async (creativeIds: number[]) => {
  if (creativeIds.length < 2) return

  const response = await fetch(`/api/offers/${offer.id}/launch-score/compare`, {
    method: 'POST',
    body: JSON.stringify({ creativeIds })
  })

  setCompareData(data.data.comparisons)
}
```

#### 3. 选择处理
```typescript
const handleCompareSelectionChange = (creativeId: number) => {
  setSelectedCompareIds(prev => {
    if (prev.includes(creativeId)) {
      return prev.filter(id => id !== creativeId) // 取消选择
    } else {
      if (prev.length >= 3) return prev // 达到上限
      return [...prev, creativeId] // 新增选择
    }
  })
}
```

#### 4. 自动触发加载
```typescript
useEffect(() => {
  if (selectedCompareIds.length >= 2 && isOpen && activeTab === 'compare') {
    loadCompareData(selectedCompareIds)
  }
}, [selectedCompareIds, activeTab])
```

---

## UI/UX设计

### Tab导航
```tsx
<button onClick={() => setActiveTab('compare')}>
  对比分析 ({creatives.length}个)
</button>
```

### Creative选择区
- 卡片式布局，每个Creative一个checkbox卡片
- 显示版本号、标题、描述、质量评分
- 最大高度240px，超出滚动
- 选中/未选中的边框和背景色区分

### 并排雷达图区
```tsx
<div className={`grid gap-6 ${
  compareData.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
}`}>
  {compareData.map(item => (
    <div key={item.creativeId}>
      <h5>v{item.creative.version}</h5>
      <div className="text-2xl font-bold">{item.score.totalScore}分</div>
      <RadarChart data={[...]} size={...} />
    </div>
  ))}
</div>
```

### 对比表格
- 响应式表格，可横向滚动
- 交替行背景（灰白相间）
- 总分行颜色编码
- 空数据显示"-"

### 推荐卡片
```tsx
{(() => {
  const validScores = compareData.filter(item => item.score)
  const bestScore = Math.max(...validScores.map(item => item.score.totalScore))
  const bestCreative = validScores.find(item => item.score.totalScore === bestScore)

  return (
    <div className="bg-green-50 border border-green-200">
      <h4>推荐结论</h4>
      <p>最佳Creative: v{bestCreative.creative.version}</p>
      <p>总分: {bestScore}分 - 建议优先使用</p>
    </div>
  )
})()}
```

---

## 用户使用流程

1. **打开Launch Score Modal** → 点击"对比分析"Tab
2. **选择Creative** → 勾选2-3个要对比的Creative（最多3个）
3. **自动加载** → 系统自动调用API获取对比数据
4. **查看对比** →
   - 并排雷达图可视化各维度差异
   - 数据表格详细对比各指标
   - 推荐卡片标注最佳选择
5. **决策** → 基于对比结果选择最优Creative进行投放

---

## 边界情况处理

### 1. 数据缺失
- **无评分数据**: 显示"暂无评分数据"，不影响其他Creative显示
- **部分缺失**: 表格和雷达图显示"-"或空白区域

### 2. 选择限制
- **少于2个**: 提示"请至少选择2个Creative进行对比"
- **超过3个**: 自动禁用未选中项的checkbox

### 3. 加载状态
- **loading**: 显示spinner和"加载对比数据中..."
- **首次进入**: 显示"加载对比数据"按钮（可手动触发）

### 4. 推荐逻辑
- **无有效评分**: 不显示推荐卡片
- **多个相同最高分**: 取第一个（按API返回顺序）

---

## 性能优化

### 1. 按需加载
- 仅在切换到"对比分析"Tab且选择≥2个Creative时加载
- 避免不必要的API调用

### 2. 智能触发
```typescript
useEffect(() => {
  if (selectedCompareIds.length >= 2 && isOpen && activeTab === 'compare') {
    loadCompareData(selectedCompareIds)
  }
}, [selectedCompareIds, activeTab])
```

### 3. 缓存复用
- 可扩展：后续可将对比数据也加入缓存机制
- 当前实现：每次选择变化重新加载（确保数据最新）

---

## 未来增强方向

### 1. 更多对比维度
- 添加历史趋势对比
- 各维度子指标详细对比
- ROI预估对比

### 2. 导出功能
- 导出对比报告为PDF
- 导出数据为Excel

### 3. 批量操作
- 一键选择全部Creative
- 智能推荐选择（自动选前3名）

### 4. 可视化增强
- 堆叠柱状图对比
- 维度差异热力图
- 趋势线叠加

---

## 测试要点

### 功能测试
- [ ] 选择2个Creative，验证雷达图和表格正确显示
- [ ] 选择3个Creative，验证grid布局调整和雷达图尺寸
- [ ] 达到3个上限后，验证其他checkbox被禁用
- [ ] 取消选择，验证数据刷新
- [ ] 推荐逻辑验证（最高分Creative被正确标注）

### 边界测试
- [ ] 无评分数据的Creative，验证"-"显示
- [ ] 仅1个Creative，验证提示信息
- [ ] API错误，验证错误处理

### UI/UX测试
- [ ] 响应式布局（不同屏幕尺寸）
- [ ] 加载状态显示
- [ ] 选中/未选中视觉反馈
- [ ] 滚动区域（Creative列表超出240px）

---

## 文件清单

### 新增文件
1. `src/app/api/offers/[id]/launch-score/compare/route.ts` (139行)
   - Creative批量对比API端点

### 修改文件
1. `src/components/LaunchScoreModal.tsx` (+260行)
   - Tab类型扩展：`'compare'`
   - 对比状态管理
   - 对比数据加载逻辑
   - Creative多选UI
   - 并排雷达图对比视图
   - 对比数据表格
   - 智能推荐卡片

---

## 总结

Creative并排对比功能为Launch Score系统增加了强大的决策支持能力：

✅ **直观对比**: 雷达图 + 表格双重展示
✅ **智能推荐**: 自动标注最佳Creative
✅ **灵活选择**: 2-3个Creative自由组合
✅ **响应式设计**: 适配不同数量和屏幕尺寸

该功能与已实现的4项优化（Creative选择、缓存机制、雷达图、历史对比）完美集成，共同构成完整的Launch Score分析生态系统。
