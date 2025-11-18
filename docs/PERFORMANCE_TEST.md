# AutoAds 性能测试计划

**版本**: v1.0
**创建日期**: 2025-01-17
**状态**: ✅ Design Approved

---

## 📋 文档概述

本文档定义AutoAds系统的性能测试策略、测试场景、性能目标和测试脚本，确保系统在多用户并发访问时的稳定性和响应速度。

**核心目标**：
- 验证SQLite架构能否支撑< 100用户并发访问
- 识别性能瓶颈并优化
- 建立性能基线，用于持续监控

---

## 🎯 性能目标（待验证）

### 1. 响应时间目标

| API类型 | P50 | P95 | P99 | 说明 |
|---------|-----|-----|-----|------|
| **认证API** | < 100ms | < 200ms | < 300ms | JWT验证、登录 |
| **查询API** | < 50ms | < 150ms | < 200ms | 单条记录查询（带索引） |
| **列表API** | < 100ms | < 200ms | < 300ms | 分页查询（20条/页） |
| **创建API** | < 100ms | < 200ms | < 300ms | Offer/Campaign创建 |
| **AI API** | < 2s | < 3s | < 5s | Launch Score、创意生成 |
| **聚合查询** | < 100ms | < 200ms | < 300ms | Top创意、性能统计 |

### 2. 吞吐量目标

| 指标 | 目标值 | 说明 |
|------|--------|------|
| **并发用户** | 10用户 | 同时操作无明显延迟 |
| **API QPS** | 50 req/s | 单实例处理能力 |
| **数据库查询** | < 50ms | 带索引的SELECT查询 |

### 3. 资源使用目标

| 资源 | 限制 | 说明 |
|------|------|------|
| **内存** | < 512MB | Node.js进程内存占用 |
| **CPU** | < 80% | 正常负载下CPU使用率 |
| **数据库文件** | < 100MB | SQLite文件大小 |
| **响应时间稳定性** | ±10% | 连续请求响应时间波动 |

---

## 🧪 测试场景

### 场景1：单用户性能基线测试

**目的**：建立API响应时间基线，无并发压力

**测试步骤**：
1. 登录获取JWT token
2. 创建1个Offer
3. 查询Offer列表（10条）
4. 创建1个Campaign
5. 查询Campaign性能数据（7天）
6. 生成Launch Score
7. 生成AI创意（3个）
8. 查询每周优化建议

**性能断言**：
- 每个API调用 < 200ms (P95)
- AI API调用 < 3s (P95)

**k6脚本**：
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(95)<200'],
  },
};

const BASE_URL = 'http://localhost:3000';

export default function () {
  // 1. 登录
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    username: 'testuser',
    password: 'password123',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(loginRes, {
    'login success': (r) => r.status === 200,
    'login < 200ms': (r) => r.timings.duration < 200,
  });

  const token = loginRes.json('token');

  // 2. 创建Offer
  const offerRes = http.post(`${BASE_URL}/api/offers`, JSON.stringify({
    offerName: 'Test Offer',
    productName: 'Test Product',
    brandName: 'Test Brand',
    landingPageUrl: 'https://example.com',
  }), {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  check(offerRes, {
    'create offer success': (r) => r.status === 200,
    'create offer < 200ms': (r) => r.timings.duration < 200,
  });

  const offerId = offerRes.json('offerId');

  // 3. 查询Offer列表（分页）
  const listRes = http.get(`${BASE_URL}/api/offers?page=1&limit=10`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  check(listRes, {
    'list offers success': (r) => r.status === 200,
    'list offers < 150ms': (r) => r.timings.duration < 150,
  });

  // 4. 生成Launch Score
  const scoreRes = http.post(`${BASE_URL}/api/launch-score`, JSON.stringify({
    offerId: offerId,
  }), {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  check(scoreRes, {
    'launch score < 3s': (r) => r.timings.duration < 3000,
  });

  sleep(1);
}
```

### 场景2：并发用户测试

**目的**：验证10用户并发操作性能

**测试步骤**：
1. 10个虚拟用户同时登录
2. 每个用户执行：创建Offer → 查询列表 → 创建Campaign → 查询性能数据
3. 持续5分钟

**性能断言**：
- P95响应时间 < 300ms
- 错误率 < 1%
- 并发操作无死锁或竞态条件

**k6脚本**：
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 10 },  // 1分钟内增加到10用户
    { duration: '3m', target: 10 },  // 保持10用户3分钟
    { duration: '1m', target: 0 },   // 1分钟内降到0用户
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = 'http://localhost:3000';

export default function () {
  // 每个VU使用不同的用户账号
  const userId = `user${__VU}`;
  const password = 'password123';

  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    username: userId,
    password: password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (!loginRes || loginRes.status !== 200) {
    console.error(`Login failed for ${userId}`);
    return;
  }

  const token = loginRes.json('token');

  // 执行用户操作
  const offerRes = http.post(`${BASE_URL}/api/offers`, JSON.stringify({
    offerName: `Offer ${userId}`,
    productName: 'Product',
    brandName: 'Brand',
    landingPageUrl: 'https://example.com',
  }), {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  check(offerRes, {
    'concurrent create < 300ms': (r) => r.timings.duration < 300,
  });

  sleep(Math.random() * 2 + 1); // 1-3秒随机间隔
}
```

### 场景3：数据量测试

**目的**：验证大数据量下的查询性能

**数据规模**：
- 10个用户
- 每个用户100个Offers
- 每个Offer平均5个Campaigns
- 每个Campaign 90天性能数据
- **总计**：1000个Offers、5000个Campaigns、450,000条性能记录

**测试步骤**：
1. 预先生成测试数据
2. 查询Offer列表（分页，20条/页）
3. 查询Campaign性能数据（7天）
4. 聚合查询Top10创意
5. 每周建议生成

**性能断言**：
- 分页查询 < 150ms (P95)
- 聚合查询 < 200ms (P95)
- 数据库文件 < 100MB

**数据生成脚本**：
```javascript
// scripts/generate-test-data.js
const Database = require('better-sqlite3');
const db = new Database('./data/test-autoads.db');

function generateTestData() {
  console.log('Generating test data...');

  // 创建10个测试用户
  const userIds = [];
  for (let i = 1; i <= 10; i++) {
    const result = db.prepare(`
      INSERT INTO users (username, password_hash, display_name, package_type,
                        valid_from, valid_until, version)
      VALUES (?, ?, ?, 'annual', date('now'), date('now', '+365 days'), 1)
    `).run(`testuser${i}`, 'hashedpassword', `Test User ${i}`);
    userIds.push(result.lastInsertRowid);
  }

  // 每个用户生成100个Offers
  for (const userId of userIds) {
    for (let i = 1; i <= 100; i++) {
      const offerResult = db.prepare(`
        INSERT INTO offers (user_id, offer_name, product_name, brand_name,
                           landing_page_url, version)
        VALUES (?, ?, ?, ?, ?, 1)
      `).run(userId, `Offer ${i}`, `Product ${i}`, 'Brand', 'https://example.com');

      const offerId = offerResult.lastInsertRowid;

      // 每个Offer生成5个Campaigns
      for (let j = 1; j <= 5; j++) {
        const campaignResult = db.prepare(`
          INSERT INTO campaigns (user_id, offer_id, google_campaign_id,
                                google_campaign_name, campaign_type,
                                budget_daily, status, version)
          VALUES (?, ?, ?, ?, 'SEARCH', 50, 'ENABLED', 1)
        `).run(userId, offerId, `gad_${offerId}_${j}`, `Campaign ${j}`, j);

        const campaignId = campaignResult.lastInsertRowid;

        // 生成90天性能数据
        for (let day = 0; day < 90; day++) {
          db.prepare(`
            INSERT INTO campaign_performance (user_id, campaign_id, date,
                                              impressions, clicks, cost, conversions)
            VALUES (?, ?, date('now', '-${day} days'),
                    ?, ?, ?, ?)
          `).run(
            userId,
            campaignId,
            Math.floor(Math.random() * 10000) + 1000,  // impressions
            Math.floor(Math.random() * 300) + 50,      // clicks
            Math.random() * 100 + 10,                  // cost
            Math.floor(Math.random() * 10)             // conversions
          );
        }
      }
    }

    console.log(`Generated data for user ${userId}: 100 offers, 500 campaigns, 45000 performance records`);
  }

  console.log('Test data generation complete!');
  console.log(`Total: ${userIds.length * 100} offers, ${userIds.length * 500} campaigns, ${userIds.length * 45000} performance records`);
}

generateTestData();
```

### 场景4：长时间稳定性测试

**目的**：验证24小时连续运行稳定性

**测试步骤**：
1. 5个并发用户持续24小时
2. 每个用户每分钟执行10次API请求
3. 监控内存泄漏、文件句柄泄漏、数据库连接泄漏

**性能断言**：
- 内存占用保持稳定（< 512MB）
- 无错误或崩溃
- 响应时间稳定（±10%）

**k6脚本**：
```javascript
export const options = {
  vus: 5,
  duration: '24h',
  thresholds: {
    http_req_duration: ['p(95)<300'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  // 执行标准操作序列
  standardUserFlow();
  sleep(6); // 每分钟10次请求
}
```

---

## 🔧 测试环境设置

### 1. 本地测试环境

**硬件要求**：
- CPU: 2核心以上
- 内存: 4GB以上
- 磁盘: 10GB可用空间

**软件要求**：
```bash
# 安装k6
brew install k6  # macOS
# 或
curl -L https://github.com/grafana/k6/releases/latest/download/k6-linux-amd64.tar.gz | tar xvz
sudo mv k6 /usr/local/bin/

# 安装Node.js依赖
npm install
```

### 2. 测试数据库初始化

```bash
# 创建测试数据库
mkdir -p data/test
cp data/schema.sql data/test/schema.sql
sqlite3 data/test-autoads.db < data/test/schema.sql

# 生成测试数据
node scripts/generate-test-data.js
```

### 3. 启动测试服务器

```bash
# 使用测试数据库启动
DATABASE_PATH=./data/test-autoads.db npm run dev
```

---

## 📊 执行测试

### 运行单用户基线测试

```bash
k6 run tests/performance/baseline.js
```

**预期输出**：
```
     ✓ login success
     ✓ login < 200ms
     ✓ create offer < 200ms
     ✓ list offers < 150ms
     ✓ launch score < 3s

     http_req_duration..........: avg=145ms min=45ms med=120ms max=2.8s p(95)=180ms
     http_req_failed............: 0.00%
```

### 运行并发用户测试

```bash
k6 run tests/performance/concurrent.js
```

**预期输出**：
```
     running (5m00s), 00/10 VUs

     ✓ concurrent create < 300ms

     http_req_duration..........: avg=185ms p(95)=280ms
     http_req_failed............: 0.20%
     iterations.................: 2500
```

### 运行数据量测试

```bash
# 先生成数据
node scripts/generate-test-data.js

# 执行测试
k6 run tests/performance/large-data.js
```

### 运行稳定性测试

```bash
k6 run tests/performance/stability.js > stability.log 2>&1 &

# 监控内存
watch -n 60 'ps aux | grep "node.*next-server"'

# 监控数据库大小
watch -n 300 'ls -lh data/test-autoads.db'
```

---

## 📈 性能监控

### 1. k6指标收集

**关键指标**：
- `http_req_duration`: 请求响应时间分布（P50/P95/P99）
- `http_req_failed`: 请求失败率
- `http_reqs`: 总请求数和QPS
- `vus`: 虚拟用户数

### 2. 系统资源监控

**监控脚本**：
```bash
#!/bin/bash
# monitor.sh

echo "Monitoring system resources..."

while true; do
  echo "=== $(date) ==="

  # CPU和内存
  ps aux | grep "node.*next-server" | grep -v grep | awk '{print "CPU: "$3"% | Memory: "$4"%"}'

  # 数据库文件大小
  ls -lh data/test-autoads.db | awk '{print "Database: "$5}'

  # 进程数
  ps aux | grep "node" | grep -v grep | wc -l | awk '{print "Processes: "$1}'

  echo ""
  sleep 60
done
```

### 3. SQLite性能监控

```sql
-- 查询最慢的查询（需启用query logging）
.timer on
.stats on

-- 分析表大小
SELECT name, SUM(pgsize) as size
FROM dbstat
GROUP BY name
ORDER BY size DESC
LIMIT 10;

-- 检查索引使用情况
EXPLAIN QUERY PLAN
SELECT * FROM campaign_performance
WHERE campaign_id = 123 AND date >= date('now', '-7 days');
```

---

## ✅ 验收标准

### 通过标准

**功能性**：
- ✅ 所有API调用返回正确结果
- ✅ 并发操作无数据竞态条件
- ✅ 乐观锁正确处理并发更新冲突

**性能性**：
- ✅ P95响应时间符合目标（< 300ms）
- ✅ 10用户并发无明显延迟
- ✅ 错误率 < 1%
- ✅ 内存占用 < 512MB

**稳定性**：
- ✅ 24小时运行无崩溃
- ✅ 内存泄漏检测无增长
- ✅ 数据库文件大小合理（< 100MB for test data）

### 失败处理

**如果未达标**：
1. 分析k6报告，识别慢查询
2. 使用SQLite EXPLAIN QUERY PLAN分析查询计划
3. 添加缺失的索引
4. 优化SQL查询（避免全表扫描）
5. 考虑增加数据库连接池配置
6. 重新测试验证

---

## 🔍 性能优化建议

### 数据库优化

```sql
-- WAL模式（已启用）
PRAGMA journal_mode = WAL;

-- 增加缓存大小
PRAGMA cache_size = -64000;  -- 64MB

-- 内存临时表
PRAGMA temp_store = MEMORY;

-- 分析统计信息
ANALYZE;
```

### 索引优化

```sql
-- 确保所有外键都有索引
CREATE INDEX IF NOT EXISTS idx_offers_user_id ON offers(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_offer_id ON campaigns(offer_id);
CREATE INDEX IF NOT EXISTS idx_performance_campaign_date
  ON campaign_performance(campaign_id, date DESC);

-- 复合索引优化常见查询
CREATE INDEX IF NOT EXISTS idx_recommendations_user_status_date
  ON weekly_recommendations(user_id, status, created_at DESC);
```

### 应用层优化

```typescript
// 1. 使用数据库连接单例
import { getDatabase } from './database';
const db = getDatabase();  // 复用连接

// 2. 批量插入使用事务
const insertMany = db.transaction((records) => {
  for (const record of records) {
    db.prepare('INSERT INTO ...').run(record);
  }
});

// 3. 使用预编译语句
const stmt = db.prepare('SELECT * FROM offers WHERE user_id = ?');
const offers = stmt.all(userId);  // 复用预编译语句
```

---

## 📝 测试报告模板

### 测试执行报告

**测试日期**: 2025-01-17
**测试执行人**: [Name]
**测试环境**: macOS / Node.js 18 / SQLite 3

**测试结果**：

| 测试场景 | 通过/失败 | P95响应时间 | 错误率 | 备注 |
|---------|----------|------------|--------|------|
| 单用户基线 | ✅ 通过 | 165ms | 0% | 符合预期 |
| 10并发用户 | ✅ 通过 | 280ms | 0.1% | 符合预期 |
| 大数据量 | ⚠️ 部分通过 | 320ms | 0% | 聚合查询稍慢，需优化索引 |
| 24小时稳定性 | ✅ 通过 | 290ms | 0.05% | 内存稳定，无泄漏 |

**性能瓶颈**：
1. 聚合查询Top10创意 - 平均200ms（目标100ms）
2. 每周建议生成 - 单个用户600ms（目标500ms）

**优化建议**：
1. 为creatives表添加(user_id, campaign_id)复合索引
2. 优化Top创意查询，限制日期范围到30天
3. 建议生成使用批处理，避免N+1查询

**结论**：
系统整体性能符合预期，可支持< 100用户并发访问。部分聚合查询需要优化，但不影响MVP发布。

---

**文档版本**: v1.0
**最后更新**: 2025-01-17
**维护者**: AutoAds Engineering Team
