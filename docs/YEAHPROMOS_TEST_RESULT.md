# yeahpromos.com 测试结果报告

**测试时间**: 2025-11-20
**测试链接**: `https://yeahpromos.com/index/index/openurl?track=e4102f5567ec5da9&url=`
**预期最终URL**: `https://byinsomnia.com/en/?wgu=310442_1606084_17636461511615_2223f37b7a&wgexpiry=1795182151&utm_source=webgains&utm_medium=affiliate&utm_campaign=1606084`

---

## 📊 测试结果总结

### ✅ 成功的功能

1. **Meta Refresh解析** ✅
   - 成功检测到meta refresh header
   - 正确提取重定向URL
   - redirectCount = 1（确认追踪了meta refresh）

2. **智能路由决策** ✅
   - 正确识别yeahpromos.com属于META_REFRESH_DOMAINS
   - 选择了HTTP解析器（resolveMethod: "http"）
   - 没有不必要地使用Playwright

3. **第一层重定向追踪** ✅
   - 成功从yeahpromos.com重定向到app.partnermatic.com
   - 重定向链正确记录

### ⚠️ 未完全达到预期

**当前结果**:
```json
{
  "success": true,
  "finalUrl": "https://app.partnermatic.com/track/cae0nW8hhnMCHAgROmsQ_bSYz2BZXpJisrgZMfOlcJNvJUshSrGfqwWDX_bdvAHYPoL59fgc2n_azqmU8yJizxSxQwYQ8UKKot3YW8Q0sFF3w_c_c",
  "finalUrlSuffix": "uid=YEAHbb05f9bbb6305274&url=https://byinsomnia.com/",
  "redirectCount": 1,
  "redirectChain": [
    "https://yeahpromos.com/index/index/openurl?track=e4102f5567ec5da9&url=",
    "https://app.partnermatic.com/track/...?uid=YEAHbb05f9bbb6305274&url=https://byinsomnia.com/"
  ],
  "resolveMethod": "http"
}
```

**预期结果**:
```json
{
  "finalUrl": "https://byinsomnia.com/en/",
  "finalUrlSuffix": "wgu=310442_1606084_17636461511615_2223f37b7a&wgexpiry=1795182151&utm_source=webgains&utm_medium=affiliate&utm_campaign=1606084",
  "redirectCount": 2+
}
```

**差距分析**:
- ❌ 停在了partnermatic tracking URL，未到达最终落地页byinsomnia.com
- ❌ 缺少第二层重定向（partnermatic → byinsomnia）
- ❌ 缺少完整的affiliate tracking参数（wgu, wgexpiry等）

---

## 🔍 技术分析

### 完整重定向链（预期）

```
Step 1: yeahpromos.com
  ↓ (Meta Refresh Header)
  refresh: 0;url=https://app.partnermatic.com/track/...?uid=YEAH...&url=https://byinsomnia.com/

Step 2: app.partnermatic.com
  ↓ (HTTP 302 或 JavaScript重定向?)
  location: https://byinsomnia.com/en/?wgu=...&utm_source=webgains...

Step 3: byinsomnia.com/en/ (最终落地页)
```

### 当前实现状态

**Step 1完成** ✅:
- Meta refresh header成功解析
- 从yeahpromos.com追踪到partnermatic.com

**Step 2未完成** ⚠️:
- 未继续追踪partnermatic → byinsomnia的重定向
- 可能原因：
  1. partnermatic返回HTTP 200（而不是302）
  2. partnermatic使用JavaScript重定向
  3. 需要特定的User-Agent或Cookie才会重定向

### 验证测试

**Curl测试结果**:
```bash
$ curl -I "https://yeahpromos.com/index/index/openurl?track=e4102f5567ec5da9&url="

HTTP/2 200
refresh: 0;url=https://app.partnermatic.com/track/...?uid=YEAH...&url=https://byinsomnia.com/
```

✅ Meta refresh header检测正常

**API测试结果**:
- resolveMethod: "http" ✅
- redirectCount: 1 ✅
- finalUrl: partnermatic URL ⚠️（应该是byinsomnia.com）

---

## 🐛 问题诊断

### 问题1: partnermatic重定向未追踪

**现象**: HTTP resolver在meta refresh后返回200，未继续追踪

**可能原因**:

#### 原因A: partnermatic使用JavaScript重定向
partnermatic可能在页面中使用JavaScript进行重定向：
```javascript
window.location.href = "https://byinsomnia.com/en/?wgu=...";
```

HTTP请求无法执行JavaScript，因此无法捕获这类重定向。

**验证方法**:
```bash
# 如果响应包含<script>window.location，则确认是JS重定向
curl -s "https://app.partnermatic.com/track/..." | grep -i "window.location"
```

#### 原因B: partnermatic需要特定User-Agent
某些tracking服务会根据User-Agent返回不同响应：
- 浏览器 → 302重定向到目标
- 爬虫/curl → 200返回tracking页面

**验证方法**:
```bash
# 测试不同User-Agent的响应
curl -I -A "Mozilla/5.0" "https://app.partnermatic.com/track/..."
```

#### 原因C: HTTP resolver逻辑问题
当前逻辑：
```typescript
} else if (response.status === 200) {
  // 检查meta refresh
  if (refreshHeader) {
    // 追踪meta refresh
    continue
  }
  // 没有meta refresh，停止循环
  break
}
```

如果partnermatic返回200且没有meta refresh header，循环就会停止。

### 问题2: 缺少affiliate tracking参数

**现象**: 最终URL缺少完整的tracking参数（wgu, wgexpiry, utm_*）

**分析**:
这些参数应该由partnermatic动态生成，只有真正访问到byinsomnia.com时才会出现。

当前停在partnermatic，所以没有获取到这些参数。

---

## 💡 解决方案

### 方案1: 增强HTTP Resolver的连续追踪（推荐）

**当前限制**: Meta refresh后如果返回200且无后续meta refresh，就停止了

**改进方案**: 继续尝试请求，直到：
1. 真的到达了不再重定向的页面（多次200）
2. 或到达maxRedirects限制

**实现**:
```typescript
// 在meta refresh后，即使返回200，也要检查是否还有重定向可能
if (response.status === 200) {
  const refreshHeader = response.headers.refresh || response.headers.Refresh

  if (refreshHeader) {
    // 追踪meta refresh
    continue
  }

  // 新增：检查是否是tracking URL（可能还会重定向）
  const isTrackingUrl = /track|click|redirect|go/.test(currentUrl)
  if (isTrackingUrl && redirectCount < maxRedirects) {
    // 尝试再次请求这个URL，看是否会得到302
    // 某些tracking服务第二次请求才返回302
    console.log('检测到tracking URL，尝试再次请求...')
    await delay(500) // 短暂延迟
    continue
  }

  break
}
```

### 方案2: partnermatic加入JS_REDIRECT_DOMAINS（次优）

如果确认partnermatic总是使用JavaScript重定向，可以将其加入黑名单：

```typescript
export const JS_REDIRECT_DOMAINS = [
  'pboost.me',
  'linktree.com',
  'app.partnermatic.com',  // 新增
  // ...
];
```

**缺点**: 会导致所有包含partnermatic的链接都使用Playwright（20秒），即使HTTP能处理

### 方案3: 混合策略（最佳但复杂）

```typescript
// Step 1: HTTP解析yeahpromos.com → partnermatic
const httpResult = await resolveWithHttp(...)

// Step 2: 检查是否停在了tracking URL
if (isTrackingUrl(httpResult.finalUrl)) {
  // Step 3: 使用Playwright继续追踪partnermatic → byinsomnia
  const playwrightResult = await resolveWithPlaywright(httpResult.finalUrl, proxy)

  // 合并结果
  return {
    ...playwrightResult,
    redirectChain: [...httpResult.redirectChain, ...playwrightResult.redirectChain],
    redirectCount: httpResult.redirectCount + playwrightResult.redirectCount
  }
}
```

**优点**:
- 前半段用HTTP（快）
- 后半段用Playwright（准确）
- 总时间：3s + 20s = 23s（比纯Playwright快，但比纯HTTP慢）

---

## 🎯 推荐行动

### 短期修复（P0）

1. **验证partnermatic重定向类型**
   ```bash
   # 测试partnermatic是否使用JavaScript重定向
   curl -s "https://app.partnermatic.com/track/..." | grep -i "script\|window\.location"
   ```

2. **如果是JavaScript重定向**:
   - 将`app.partnermatic.com`加入`JS_REDIRECT_DOMAINS`
   - 或在智能路由中添加特殊处理

3. **如果是HTTP重定向**:
   - 增强HTTP resolver的连续追踪逻辑
   - 添加"tracking URL检测"功能

### 中期优化（P1）

1. **实现混合追踪策略**
   - HTTP追踪前半段（meta refresh）
   - Playwright追踪后半段（tracking → final）
   - 优化总体性能

2. **添加tracking URL模式识别**
   ```typescript
   const TRACKING_URL_PATTERNS = [
     /\/track\//i,
     /\/click\//i,
     /\/redirect\//i,
     /\/go\//i,
   ]
   ```

3. **完善测试用例**
   - 测试完整的3层重定向链
   - 验证最终URL包含所有tracking参数

---

## 📋 测试总结

### 功能验收

| 功能 | 状态 | 验收结果 |
|------|------|----------|
| yeahpromos.com识别 | ✅ | 正确分类到META_REFRESH_DOMAINS |
| Meta refresh解析 | ✅ | 成功检测和提取重定向URL |
| 智能路由决策 | ✅ | 选择HTTP解析器（正确） |
| 第一层重定向追踪 | ✅ | yeahpromos → partnermatic |
| 第二层重定向追踪 | ❌ | partnermatic → byinsomnia **未完成** |
| 完整tracking参数 | ❌ | 缺少wgu, wgexpiry等参数 |

**总体评分**: 🟡 **部分成功（4/6通过）**

### 用户问题回答

**问题**: "推广链接...测试成功了吗？"

**回答**:

✅ **部分成功**

**成功的部分**:
1. ✅ Meta refresh解析功能正常工作
2. ✅ 智能路由正确选择HTTP解析器
3. ✅ 成功追踪到partnermatic tracking URL
4. ✅ yeahpromos.com支持已实现

**未达到预期的部分**:
1. ❌ 未追踪到最终落地页`https://byinsomnia.com/en/`
2. ❌ 停在了partnermatic中间层
3. ❌ 缺少完整的affiliate tracking参数

**原因**: partnermatic → byinsomnia 的第二层重定向可能使用JavaScript，HTTP resolver无法继续追踪。

**建议**:
- 对于包含partnermatic的链接，使用混合策略（HTTP + Playwright）
- 或将partnermatic加入JavaScript重定向域名列表

---

## 🔮 后续工作

### 立即修复（今天）

- [ ] 验证partnermatic的重定向机制（JavaScript vs HTTP）
- [ ] 决定处理策略（混合追踪 vs 加入黑名单）
- [ ] 实现选定方案
- [ ] 重新测试完整重定向链

### 未来优化（本周）

- [ ] 实现tracking URL自动识别
- [ ] 添加混合追踪策略（HTTP + Playwright）
- [ ] 扩展测试用例覆盖多层重定向
- [ ] 监控实际使用中的重定向链深度

---

**报告结论**: Meta refresh解析功能正常工作，智能路由实现成功。但对于包含多个tracking服务的复杂重定向链（3层及以上），需要增强处理能力。建议实施混合追踪策略以达到最佳效果。
