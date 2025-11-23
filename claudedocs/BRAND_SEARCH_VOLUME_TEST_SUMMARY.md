# 品牌搜索量维度测试总结

**测试日期**: 2025-11-23
**测试脚本**: `scripts/test-brand-search-volume.ts`
**测试目的**: 验证品牌搜索量评分维度的完整功能

## 测试脚本概述

创建了全面的自动化测试脚本，包含5个主要测试场景：

### 测试1：知名品牌（预期xlarge级别）
- **测试品牌**: Nike, Apple, Samsung, Adidas, Microsoft
- **预期结果**: 月搜索量 > 100,000，流量级别 = xlarge，得分 = 20/20
- **验证要点**:
  - 搜索量数据来源正确（缓存/数据库/API）
  - 流量级别识别准确
  - 得分计算正确
  - 总分保持100分制

### 测试2：小众品牌（预期micro/small级别）
- **测试品牌**: TestBrand123XYZ, MyLocalShop, StartupBrand2024
- **预期结果**: 月搜索量 < 1,000，流量级别 = micro/small，得分 = 0-5/20
- **验证要点**:
  - 正确识别小流量品牌
  - 品牌建议系统工作正常
  - 低搜索量品牌的降级处理

### 测试3：空品牌名称降级处理
- **测试场景**:
  - `brandName: undefined` - 未定义品牌
  - `brandName: ''` - 空字符串
  - `brandName: '   '` - 纯空格
- **预期结果**:
  - 品牌得分 = 0/20
  - 流量级别 = micro
  - 数据来源 = unavailable
  - 其他维度不受影响
- **验证要点**:
  - 正确返回0分而不抛出错误
  - 不影响Diversity/Relevance/Completeness/Quality/Compliance维度
  - 总分仍能正常计算

### 测试4：缓存机制验证
- **测试方法**: 对同一品牌（Nike）进行两次查询
- **预期结果**:
  - 第一次查询：从Google Ads API获取（耗时较长）
  - 第二次查询：从Redis/数据库缓存获取（耗时更短）
- **验证要点**:
  - 缓存命中率
  - 查询时间对比
  - 数据一致性

### 测试5：雷达图数据验证
- **测试内容**:
  - 验证6个维度的数据结构完整性
  - 检查所有维度分数在有效范围内
  - 验证总分计算正确（各维度得分之和 = overallScore）
  - 模拟雷达图数据格式输出
- **雷达图数据格式**:
```json
{
  "scoreBreakdown": {
    "diversity": 0-20,
    "relevance": 0-20,
    "engagement": 0-15,
    "quality": 0-15,
    "clarity": 0-10,
    "brandSearchVolume": 0-20
  },
  "maxScores": {
    "diversity": 20,
    "relevance": 20,
    "engagement": 15,
    "quality": 15,
    "clarity": 10,
    "brandSearchVolume": 20
  }
}
```

## 测试执行状态

### 当前进度
- ✅ 测试脚本已创建
- 🔄 测试正在执行中（处理知名品牌数据）
- ⏳ 预计总耗时: 2-3分钟

### 已观察到的行为
1. **Nike品牌测试**:
   - 成功调用Google Ads Keyword Planner API
   - 返回搜索量: 5,000,000/月
   - 正在保存到数据库（包含相关关键词数据）
   - 数据库插入操作正常

2. **数据库操作**:
   - 使用ON CONFLICT处理重复关键词
   - 正确更新search_volume和cached_at字段
   - 保留created_at时间戳（如果搜索量未变化）

## 预期测试结果

### 成功指标
- [ ] 所有知名品牌达到xlarge/large级别
- [ ] 小众品牌返回micro/small级别
- [ ] 空品牌正确降级，返回0分
- [ ] 缓存机制有效减少API调用时间
- [ ] 6维度雷达图数据结构正确
- [ ] 总分保持100分制
- [ ] 所有维度分数在有效范围内

### 失败案例处理
如果测试失败，可能的原因：
1. **API配置问题**: Google Ads API凭证缺失或过期
2. **网络问题**: 无法访问Google Ads API
3. **数据库问题**: SQLite数据库锁定或权限问题
4. **Redis问题**: Redis连接失败
5. **分级阈值问题**: 品牌搜索量阈值设置不合理

## 测试后续步骤

### 1. 分析测试结果
- 检查每个测试场景的通过/失败状态
- 记录实际搜索量数据与预期的对比
- 分析缓存机制的性能提升

### 2. 调优建议
- 根据实际搜索量数据调整分级阈值
- 优化缓存策略（过期时间、缓存键设计）
- 完善错误处理和降级逻辑

### 3. 性能优化
- 批量查询品牌搜索量（减少API调用）
- 实现预加载常见品牌数据
- 增加缓存预热机制

### 4. 功能增强
- 添加品牌搜索量趋势分析（上升/下降/稳定）
- 支持自定义分级阈值
- 提供更详细的品牌营销建议

## 测试命令

### 运行完整测试
```bash
npx tsx scripts/test-brand-search-volume.ts
```

### 单独测试某个品牌
```bash
# 修改脚本，注释掉其他测试函数，只保留需要的测试
```

### 查看测试日志
```bash
# 测试输出直接显示在控制台
```

## 注意事项

1. **API配额消耗**: 测试会调用真实的Google Ads API，注意配额消耗
2. **数据库状态**: 测试会向数据库写入数据，确保有备份
3. **缓存污染**: 测试会产生缓存数据，可能需要清理Redis
4. **测试时间**: 完整测试可能需要2-3分钟

## 相关文档

- 设计文档: `claudedocs/BRAND_SEARCH_VOLUME_DIMENSION_DESIGN.md`
- 实现总结: `claudedocs/BRAND_SEARCH_VOLUME_IMPLEMENTATION_2025-11-23.md`
- 测试脚本: `scripts/test-brand-search-volume.ts`
