# Offer删除与Ads账号管理功能设计

**创建日期**: 2025-01-18
**版本**: 1.0
**状态**: 设计完成，待开发

---

## 目录

1. [功能概述](#功能概述)
2. [数据库设计](#数据库设计)
3. [业务逻辑](#业务逻辑)
4. [API设计](#api设计)
5. [前端UI设计](#前端ui设计)
6. [技术实现细节](#技术实现细节)
7. [安全考虑](#安全考虑)
8. [测试计划](#测试计划)
9. [实施计划](#实施计划)

---

## 功能概述

### 1. Offer一键删除

**用户场景**: 用户不再需要某个Offer，希望删除但保留历史数据用于分析

**核心功能**:
- ✅ 软删除机制（保留所有历史数据）
- ✅ 自动解除与Google Ads账号的关联关系
- ✅ 防止误删的二次确认机制
- ✅ 已删除Offer不在列表中显示（可选择查看）
- ✅ 支持恢复已删除的Offer

**业务价值**:
- 📊 保留完整的历史数据用于分析和审计
- 🔄 自动化关联关系清理，减少手动操作
- 🛡️ 防止误删导致的数据丢失
- 💰 释放Google Ads账号资源供其他Offer使用

### 2. 手动解除Ads账号关联

**用户场景**: 用户希望更换Offer使用的Google Ads账号，或者暂停某个Offer的投放但保留Offer数据

**核心功能**:
- ✅ 手动解除Offer与Google Ads账号的关联
- ✅ 解除关联后账号自动进入"闲置账号列表"
- ✅ 闲置账号可被其他Offer重新关联
- ✅ 无需重复OAuth认证流程
- ✅ 支持查看账号的使用历史

**业务价值**:
- 🔄 灵活的账号资源调配
- ⚡ 避免重复认证，提升效率
- 📈 最大化利用有限的Google Ads账号资源
- 🎯 支持A/B测试（同一产品使用不同账号）

---

## 数据库设计

### 1. offers表扩展

**新增字段**:

```sql
-- 在现有offers表基础上添加以下字段
ALTER TABLE offers ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE offers ADD COLUMN deleted_at TEXT;
ALTER TABLE offers ADD COLUMN deleted_by INTEGER;

-- 添加索引
CREATE INDEX idx_offers_is_deleted ON offers(is_deleted);
CREATE INDEX idx_offers_deleted_at ON offers(deleted_at);
```

**字段说明**:
- `is_deleted`: 软删除标记（0=未删除，1=已删除）
- `deleted_at`: 删除时间（ISO 8601格式）
- `deleted_by`: 删除操作的用户ID（未来多用户支持）

### 2. google_ads_accounts表扩展

**新增字段**:

```sql
-- 在现有google_ads_accounts表基础上添加以下字段
ALTER TABLE google_ads_accounts ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE google_ads_accounts ADD COLUMN last_disconnected_at TEXT;
ALTER TABLE google_ads_accounts ADD COLUMN disconnected_from_offer_id INTEGER;
ALTER TABLE google_ads_accounts ADD COLUMN disconnected_reason TEXT;

-- 添加索引
CREATE INDEX idx_ads_accounts_status ON google_ads_accounts(status);
CREATE INDEX idx_ads_accounts_last_disconnected ON google_ads_accounts(last_disconnected_at);
```

**字段说明**:
- `status`: 账号状态
  - `active`: 已关联到Offer，正在使用
  - `idle`: 闲置状态，未关联任何Offer
  - `disabled`: 已禁用（用户手动禁用或账号异常）
- `last_disconnected_at`: 最后一次解除关联的时间
- `disconnected_from_offer_id`: 解除关联前关联的Offer ID
- `disconnected_reason`: 解除关联的原因（manual | offer_deleted | user_action）

### 3. offer_ads_account_history表（新建）

**用途**: 记录Offer与Ads账号的关联历史，用于审计和分析

```sql
CREATE TABLE offer_ads_account_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  offer_id INTEGER NOT NULL,
  ads_account_id INTEGER NOT NULL,
  action TEXT NOT NULL,                    -- connected | disconnected
  reason TEXT,                              -- manual | offer_deleted | account_changed | campaign_ended
  campaign_id TEXT,                         -- 关联时创建的Campaign ID
  campaign_status TEXT,                     -- Campaign状态快照
  budget_spent REAL,                        -- 解除关联时的累计消费
  impressions INTEGER,                      -- 累计展示
  clicks INTEGER,                           -- 累计点击
  conversions REAL,                         -- 累计转化
  action_by INTEGER,                        -- 操作的用户ID
  action_at TEXT NOT NULL DEFAULT (datetime('now')),
  metadata TEXT,                            -- JSON格式的额外信息
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE,
  FOREIGN KEY (ads_account_id) REFERENCES google_ads_accounts(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX idx_history_offer_id ON offer_ads_account_history(offer_id);
CREATE INDEX idx_history_ads_account_id ON offer_ads_account_history(ads_account_id);
CREATE INDEX idx_history_action_at ON offer_ads_account_history(action_at);
```

**关键设计**:
- 📝 记录每次关联和解除关联的操作
- 📊 保存解除关联时的性能数据快照
- 🔍 支持审计和分析（哪些账号效果最好）
- 🕐 完整的时间线追溯

---

## 业务逻辑

### 1. Offer删除流程

```
用户点击"删除Offer"
  ↓
【前端】显示二次确认对话框
  - 提示: "删除后Offer将不再显示，但历史数据会保留"
  - 提示: "已关联的Google Ads账号将自动解除关联"
  - 选项: [取消] [确认删除]
  ↓
【后端】开始事务处理
  ↓
Step 1: 检查Offer状态
  - 检查offer是否已删除（防止重复操作）
  - 检查用户权限
  ↓
Step 2: 检查是否有关联的Ads账号
  - 查询offers.ads_account_id
  - 如果有关联 → 执行解除关联流程
  ↓
Step 3: 更新Offer状态
  - 设置is_deleted = 1
  - 设置deleted_at = 当前时间
  - 设置deleted_by = 当前用户ID
  - 保持ad_status不变（保留历史状态）
  ↓
Step 4: 记录删除历史
  - 在offer_ads_account_history表记录disconnected事件
  - reason = 'offer_deleted'
  - 保存当前Campaign性能数据快照
  ↓
Step 5: 提交事务
  ↓
【前端】显示删除成功消息
  - "Offer已删除，历史数据已保留"
  - 刷新Offer列表
```

### 2. 手动解除Ads账号关联流程

```
用户点击"解除关联"
  ↓
【前端】显示确认对话框
  - 提示: "解除关联后，该账号将进入闲置列表"
  - 提示: "Campaign将被暂停，不会自动删除"
  - 选项: [取消] [确认解除]
  ↓
【后端】开始事务处理
  ↓
Step 1: 检查当前状态
  - 检查Offer是否已关联账号
  - 检查用户权限
  - 检查Campaign状态
  ↓
Step 2: 暂停Google Ads Campaign
  - 调用Google Ads API
  - 设置Campaign.status = 'PAUSED'
  - 获取Campaign性能数据（消费、点击、转化等）
  ↓
Step 3: 更新Offer表
  - 设置ads_account_id = NULL
  - 设置ad_status = 'disconnected'（新状态）
  - 设置last_ads_account_id（记录上一个关联的账号）
  ↓
Step 4: 更新Ads账号表
  - 设置status = 'idle'
  - 设置last_disconnected_at = 当前时间
  - 设置disconnected_from_offer_id = 当前Offer ID
  - 设置disconnected_reason = 'manual'
  ↓
Step 5: 记录历史
  - 在offer_ads_account_history表记录disconnected事件
  - 保存Campaign性能数据快照
  ↓
Step 6: 提交事务
  ↓
【前端】显示成功消息
  - "已解除关联，账号已进入闲置列表"
  - 刷新Offer详情页面
```

### 3. 重新关联闲置账号流程

```
用户在Offer详情页点击"关联Ads账号"
  ↓
【前端】显示闲置账号列表
  - 显示所有status='idle'的账号
  - 显示账号名称、最后使用时间、历史性能数据
  - 用户选择一个账号
  ↓
【后端】开始事务处理
  ↓
Step 1: 验证账号状态
  - 检查账号是否仍然是idle状态
  - 检查账号是否属于当前用户
  - 检查账号是否有效（调用Google Ads API测试连接）
  ↓
Step 2: 创建新的Campaign
  - 调用"一键上广告"流程
  - 生成关键词、广告创意、设置预算
  - 创建新的Campaign
  ↓
Step 3: 更新Offer表
  - 设置ads_account_id = 选中的账号ID
  - 设置ad_status = 'active'
  - 设置campaign_id = 新创建的Campaign ID
  ↓
Step 4: 更新Ads账号表
  - 设置status = 'active'
  - 清空last_disconnected_at等字段
  ↓
Step 5: 记录历史
  - 在offer_ads_account_history表记录connected事件
  - reason = 'manual'
  ↓
Step 6: 提交事务
  ↓
【前端】显示成功消息
  - "已成功关联账号并创建Campaign"
  - 跳转到Offer详情页面
```

### 4. Offer恢复流程（扩展功能）

```
用户在"已删除Offer"列表中点击"恢复"
  ↓
【后端】开始事务处理
  ↓
Step 1: 检查Offer状态
  - 确认is_deleted = 1
  - 检查用户权限
  ↓
Step 2: 恢复Offer
  - 设置is_deleted = 0
  - 清空deleted_at和deleted_by
  - ad_status保持原状态（可能是disconnected）
  ↓
Step 3: 提交事务
  ↓
【前端】显示成功消息
  - "Offer已恢复"
  - 提示用户重新关联Ads账号（如果之前有关联）
```

---

## API设计

### 1. DELETE /api/offers/[id] - 软删除Offer

**请求**:
```typescript
DELETE /api/offers/123
Authorization: Bearer <token>
```

**响应成功 (200)**:
```json
{
  "success": true,
  "message": "Offer已删除",
  "data": {
    "offer_id": 123,
    "deleted_at": "2025-01-18T12:00:00Z",
    "disconnected_account": {
      "account_id": 456,
      "account_name": "My Ads Account",
      "status": "idle"
    }
  }
}
```

**响应失败 (400)**:
```json
{
  "success": false,
  "error": "Offer已被删除",
  "code": "ALREADY_DELETED"
}
```

**后端实现**:
```typescript
// app/api/offers/[id]/route.ts
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const offerId = parseInt(params.id);
  const userId = session.user.id;

  // Step 1: 获取Offer信息
  const offer = db.prepare(`
    SELECT id, user_id, ads_account_id, is_deleted, offer_name
    FROM offers WHERE id = ? AND user_id = ?
  `).get(offerId, userId);

  if (!offer) {
    return NextResponse.json({ success: false, error: 'Offer不存在' }, { status: 404 });
  }

  if (offer.is_deleted) {
    return NextResponse.json({ success: false, error: 'Offer已被删除', code: 'ALREADY_DELETED' }, { status: 400 });
  }

  // Step 2: 开始事务
  const result = db.transaction(() => {
    let disconnectedAccount = null;

    // Step 3: 如果有关联的Ads账号，先解除关联
    if (offer.ads_account_id) {
      disconnectedAccount = disconnectAdsAccount(offerId, offer.ads_account_id, userId, 'offer_deleted');
    }

    // Step 4: 软删除Offer
    db.prepare(`
      UPDATE offers SET
        is_deleted = 1,
        deleted_at = datetime('now'),
        deleted_by = ?
      WHERE id = ?
    `).run(userId, offerId);

    return { offer, disconnectedAccount };
  })();

  return NextResponse.json({
    success: true,
    message: 'Offer已删除',
    data: {
      offer_id: offerId,
      deleted_at: new Date().toISOString(),
      disconnected_account: result.disconnectedAccount
    }
  });
}
```

### 2. POST /api/offers/[id]/disconnect - 手动解除Ads账号关联

**请求**:
```typescript
POST /api/offers/123/disconnect
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "切换账号测试"  // 可选
}
```

**响应成功 (200)**:
```json
{
  "success": true,
  "message": "已解除关联",
  "data": {
    "offer_id": 123,
    "ads_account": {
      "account_id": 456,
      "account_name": "My Ads Account",
      "status": "idle",
      "campaign_paused": true,
      "performance_snapshot": {
        "budget_spent": 150.50,
        "impressions": 12500,
        "clicks": 340,
        "conversions": 12
      }
    }
  }
}
```

**后端实现**:
```typescript
// app/api/offers/[id]/disconnect/route.ts
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const offerId = parseInt(params.id);
  const userId = session.user.id;
  const body = await request.json();
  const reason = body.reason || '手动解除';

  const offer = db.prepare(`
    SELECT id, user_id, ads_account_id, campaign_id
    FROM offers WHERE id = ? AND user_id = ? AND is_deleted = 0
  `).get(offerId, userId);

  if (!offer) {
    return NextResponse.json({ success: false, error: 'Offer不存在或已删除' }, { status: 404 });
  }

  if (!offer.ads_account_id) {
    return NextResponse.json({ success: false, error: 'Offer未关联Ads账号' }, { status: 400 });
  }

  // 获取Ads账号信息
  const adsAccount = db.prepare(`
    SELECT id, account_name, customer_id, encrypted_refresh_token
    FROM google_ads_accounts WHERE id = ?
  `).get(offer.ads_account_id);

  // 开始事务
  const result = db.transaction(async () => {
    // Step 1: 暂停Campaign
    let performanceSnapshot = null;
    if (offer.campaign_id) {
      performanceSnapshot = await pauseCampaignAndGetPerformance(
        adsAccount.customer_id,
        adsAccount.encrypted_refresh_token,
        offer.campaign_id
      );
    }

    // Step 2: 解除关联
    const disconnectResult = disconnectAdsAccount(offerId, offer.ads_account_id, userId, 'manual', reason, performanceSnapshot);

    return { adsAccount, performanceSnapshot, disconnectResult };
  })();

  return NextResponse.json({
    success: true,
    message: '已解除关联',
    data: {
      offer_id: offerId,
      ads_account: {
        account_id: adsAccount.id,
        account_name: adsAccount.account_name,
        status: 'idle',
        campaign_paused: true,
        performance_snapshot: result.performanceSnapshot
      }
    }
  });
}
```

### 3. GET /api/ads-accounts/idle - 获取闲置账号列表

**请求**:
```typescript
GET /api/ads-accounts/idle
Authorization: Bearer <token>
```

**响应成功 (200)**:
```json
{
  "success": true,
  "data": {
    "accounts": [
      {
        "id": 456,
        "account_name": "My Ads Account",
        "customer_id": "123-456-7890",
        "status": "idle",
        "last_disconnected_at": "2025-01-15T10:30:00Z",
        "last_used_offer": {
          "offer_id": 123,
          "offer_name": "OFF-2025-001",
          "product_name": "Reolink Camera"
        },
        "historical_performance": {
          "total_budget_spent": 1250.00,
          "total_impressions": 125000,
          "total_clicks": 3400,
          "total_conversions": 120,
          "avg_ctr": 2.72,
          "avg_conversion_rate": 3.53
        }
      }
    ]
  }
}
```

**后端实现**:
```typescript
// app/api/ads-accounts/idle/route.ts
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  const accounts = db.prepare(`
    SELECT
      gaa.id,
      gaa.account_name,
      gaa.customer_id,
      gaa.status,
      gaa.last_disconnected_at,
      gaa.disconnected_from_offer_id
    FROM google_ads_accounts gaa
    WHERE gaa.user_id = ? AND gaa.status = 'idle'
    ORDER BY gaa.last_disconnected_at DESC
  `).all(userId);

  const accountsWithDetails = accounts.map(account => {
    // 获取最后使用的Offer信息
    const lastOffer = db.prepare(`
      SELECT id, offer_name, product_name
      FROM offers WHERE id = ?
    `).get(account.disconnected_from_offer_id);

    // 获取历史性能数据
    const historicalPerformance = db.prepare(`
      SELECT
        SUM(budget_spent) as total_budget_spent,
        SUM(impressions) as total_impressions,
        SUM(clicks) as total_clicks,
        SUM(conversions) as total_conversions
      FROM offer_ads_account_history
      WHERE ads_account_id = ?
    `).get(account.id);

    return {
      id: account.id,
      account_name: account.account_name,
      customer_id: account.customer_id,
      status: account.status,
      last_disconnected_at: account.last_disconnected_at,
      last_used_offer: lastOffer ? {
        offer_id: lastOffer.id,
        offer_name: lastOffer.offer_name,
        product_name: lastOffer.product_name
      } : null,
      historical_performance: historicalPerformance
    };
  });

  return NextResponse.json({
    success: true,
    data: { accounts: accountsWithDetails }
  });
}
```

### 4. POST /api/offers/[id]/connect - 关联闲置账号

**请求**:
```typescript
POST /api/offers/123/connect
Authorization: Bearer <token>
Content-Type: application/json

{
  "ads_account_id": 456
}
```

**响应成功 (200)**:
```json
{
  "success": true,
  "message": "已成功关联账号",
  "data": {
    "offer_id": 123,
    "ads_account_id": 456,
    "campaign_id": "987654321",
    "campaign_status": "PAUSED"
  }
}
```

**后端实现**:
```typescript
// app/api/offers/[id]/connect/route.ts
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const offerId = parseInt(params.id);
  const userId = session.user.id;
  const body = await request.json();
  const adsAccountId = body.ads_account_id;

  // Step 1: 验证Offer状态
  const offer = db.prepare(`
    SELECT id, user_id, ads_account_id, offer_name, product_name, target_keywords, budget_daily
    FROM offers WHERE id = ? AND user_id = ? AND is_deleted = 0
  `).get(offerId, userId);

  if (!offer) {
    return NextResponse.json({ success: false, error: 'Offer不存在或已删除' }, { status: 404 });
  }

  if (offer.ads_account_id) {
    return NextResponse.json({ success: false, error: 'Offer已关联其他账号' }, { status: 400 });
  }

  // Step 2: 验证Ads账号状态
  const adsAccount = db.prepare(`
    SELECT id, user_id, account_name, customer_id, status, encrypted_refresh_token
    FROM google_ads_accounts WHERE id = ? AND user_id = ?
  `).get(adsAccountId, userId);

  if (!adsAccount) {
    return NextResponse.json({ success: false, error: 'Ads账号不存在' }, { status: 404 });
  }

  if (adsAccount.status !== 'idle') {
    return NextResponse.json({ success: false, error: 'Ads账号不是闲置状态' }, { status: 400 });
  }

  // Step 3: 创建Campaign（调用"一键上广告"流程）
  const campaignResult = await createCampaignForOffer(offer, adsAccount);

  // Step 4: 更新数据库
  const result = db.transaction(() => {
    // 更新Offer
    db.prepare(`
      UPDATE offers SET
        ads_account_id = ?,
        campaign_id = ?,
        ad_status = 'active'
      WHERE id = ?
    `).run(adsAccountId, campaignResult.campaign_id, offerId);

    // 更新Ads账号
    db.prepare(`
      UPDATE google_ads_accounts SET
        status = 'active',
        last_disconnected_at = NULL,
        disconnected_from_offer_id = NULL,
        disconnected_reason = NULL
      WHERE id = ?
    `).run(adsAccountId);

    // 记录历史
    db.prepare(`
      INSERT INTO offer_ads_account_history (
        user_id, offer_id, ads_account_id, action, reason, campaign_id, campaign_status, action_by
      ) VALUES (?, ?, ?, 'connected', 'manual', ?, 'PAUSED', ?)
    `).run(userId, offerId, adsAccountId, campaignResult.campaign_id, userId);

    return campaignResult;
  })();

  return NextResponse.json({
    success: true,
    message: '已成功关联账号',
    data: {
      offer_id: offerId,
      ads_account_id: adsAccountId,
      campaign_id: result.campaign_id,
      campaign_status: 'PAUSED'
    }
  });
}
```

### 5. POST /api/offers/[id]/restore - 恢复已删除Offer

**请求**:
```typescript
POST /api/offers/123/restore
Authorization: Bearer <token>
```

**响应成功 (200)**:
```json
{
  "success": true,
  "message": "Offer已恢复",
  "data": {
    "offer_id": 123,
    "offer_name": "OFF-2025-001",
    "ad_status": "disconnected",
    "needs_reconnection": true
  }
}
```

---

## 前端UI设计

### 1. Offer列表页面

**新增功能**:
- ✅ 每个Offer卡片右上角添加"删除"按钮（垃圾桶图标）
- ✅ 顶部添加筛选器：[全部] [活跃中] [已删除]
- ✅ 已删除的Offer显示灰色背景 + "已删除"标签

**删除按钮实现**:
```typescript
// components/offers/OfferCard.tsx
export function OfferCard({ offer }: { offer: Offer }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/offers/${offer.id}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (data.success) {
        toast.success('Offer已删除');
        router.refresh();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('删除失败');
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <Card className={offer.is_deleted ? 'bg-gray-100' : ''}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{offer.offer_name}</CardTitle>
            {offer.is_deleted && (
              <Badge variant="secondary">已删除</Badge>
            )}
          </div>
          {!offer.is_deleted && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowDeleteDialog(true)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  删除Offer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>

      {/* 删除确认对话框 */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除Offer？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后Offer将不再显示在列表中，但历史数据会保留用于分析。
              {offer.ads_account_id && (
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-sm text-yellow-800">
                    ⚠️ 此Offer已关联Google Ads账号，删除后将自动解除关联。
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
```

### 2. Offer详情页面 - Ads账号管理区域

**新增UI组件**:
```typescript
// components/offers/AdsAccountManager.tsx
export function AdsAccountManager({ offer }: { offer: Offer }) {
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [showIdleAccountsDialog, setShowIdleAccountsDialog] = useState(false);

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      const response = await fetch(`/api/offers/${offer.id}/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: '手动解除关联' })
      });
      const data = await response.json();

      if (data.success) {
        toast.success('已解除关联');
        router.refresh();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('解除关联失败');
    } finally {
      setIsDisconnecting(false);
      setShowDisconnectDialog(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Google Ads账号</CardTitle>
      </CardHeader>
      <CardContent>
        {offer.ads_account_id ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <ExternalLink className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium">{offer.ads_account.account_name}</p>
                  <p className="text-sm text-gray-500">Customer ID: {offer.ads_account.customer_id}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDisconnectDialog(true)}
              >
                <Unlink className="h-4 w-4 mr-2" />
                解除关联
              </Button>
            </div>

            {offer.campaign_id && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium mb-2">Campaign信息</p>
                <p className="text-sm text-gray-600">Campaign ID: {offer.campaign_id}</p>
                <p className="text-sm text-gray-600">状态: {offer.campaign_status}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">此Offer未关联Google Ads账号</p>
            <Button onClick={() => setShowIdleAccountsDialog(true)}>
              <Link2 className="h-4 w-4 mr-2" />
              关联闲置账号
            </Button>
          </div>
        )}

        {/* 解除关联确认对话框 */}
        <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认解除关联？</AlertDialogTitle>
              <AlertDialogDescription>
                解除关联后：
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Campaign将被暂停（不会删除）</li>
                  <li>账号将进入闲置列表</li>
                  <li>其他Offer可以使用此账号</li>
                </ul>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction onClick={handleDisconnect} disabled={isDisconnecting}>
                {isDisconnecting ? '解除中...' : '确认解除'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* 闲置账号列表对话框 */}
        <IdleAccountsDialog
          open={showIdleAccountsDialog}
          onOpenChange={setShowIdleAccountsDialog}
          offerId={offer.id}
        />
      </CardContent>
    </Card>
  );
}
```

### 3. 闲置账号列表对话框

```typescript
// components/offers/IdleAccountsDialog.tsx
export function IdleAccountsDialog({
  open,
  onOpenChange,
  offerId
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offerId: number;
}) {
  const [accounts, setAccounts] = useState<IdleAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (open) {
      fetchIdleAccounts();
    }
  }, [open]);

  const fetchIdleAccounts = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/ads-accounts/idle');
      const data = await response.json();
      if (data.success) {
        setAccounts(data.data.accounts);
      }
    } catch (error) {
      toast.error('获取闲置账号失败');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (accountId: number) => {
    setConnecting(true);
    try {
      const response = await fetch(`/api/offers/${offerId}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ads_account_id: accountId })
      });
      const data = await response.json();

      if (data.success) {
        toast.success('关联成功');
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('关联失败');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>选择闲置账号</DialogTitle>
          <DialogDescription>
            选择一个闲置的Google Ads账号关联到此Offer
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8">加载中...</div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">暂无闲置账号</p>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map(account => (
              <Card key={account.id} className="hover:border-blue-500 cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium">{account.account_name}</h4>
                        <Badge variant="secondary">闲置</Badge>
                      </div>
                      <p className="text-sm text-gray-500">Customer ID: {account.customer_id}</p>

                      {account.last_used_offer && (
                        <p className="text-sm text-gray-500 mt-1">
                          最后使用: {account.last_used_offer.product_name} ({formatDate(account.last_disconnected_at)})
                        </p>
                      )}

                      {account.historical_performance && (
                        <div className="mt-3 grid grid-cols-4 gap-2">
                          <div className="text-center p-2 bg-gray-50 rounded">
                            <p className="text-xs text-gray-500">消费</p>
                            <p className="text-sm font-medium">${account.historical_performance.total_budget_spent}</p>
                          </div>
                          <div className="text-center p-2 bg-gray-50 rounded">
                            <p className="text-xs text-gray-500">展示</p>
                            <p className="text-sm font-medium">{account.historical_performance.total_impressions.toLocaleString()}</p>
                          </div>
                          <div className="text-center p-2 bg-gray-50 rounded">
                            <p className="text-xs text-gray-500">点击</p>
                            <p className="text-sm font-medium">{account.historical_performance.total_clicks.toLocaleString()}</p>
                          </div>
                          <div className="text-center p-2 bg-gray-50 rounded">
                            <p className="text-xs text-gray-500">转化</p>
                            <p className="text-sm font-medium">{account.historical_performance.total_conversions}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <Button
                      onClick={() => handleConnect(account.id)}
                      disabled={connecting}
                    >
                      {connecting ? '关联中...' : '选择此账号'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

---

## 技术实现细节

### 1. 解除关联的核心函数

```typescript
// lib/ads-account/disconnect.ts
export function disconnectAdsAccount(
  offerId: number,
  adsAccountId: number,
  userId: number,
  reason: string,
  customReason?: string,
  performanceSnapshot?: any
): any {
  // Step 1: 获取Campaign性能数据
  const campaign = db.prepare(`
    SELECT campaign_id, campaign_status
    FROM offers WHERE id = ?
  `).get(offerId);

  // Step 2: 更新Offer
  db.prepare(`
    UPDATE offers SET
      ads_account_id = NULL,
      ad_status = 'disconnected',
      last_ads_account_id = ?
    WHERE id = ?
  `).run(adsAccountId, offerId);

  // Step 3: 更新Ads账号
  db.prepare(`
    UPDATE google_ads_accounts SET
      status = 'idle',
      last_disconnected_at = datetime('now'),
      disconnected_from_offer_id = ?,
      disconnected_reason = ?
    WHERE id = ?
  `).run(offerId, reason, adsAccountId);

  // Step 4: 记录历史
  db.prepare(`
    INSERT INTO offer_ads_account_history (
      user_id,
      offer_id,
      ads_account_id,
      action,
      reason,
      campaign_id,
      campaign_status,
      budget_spent,
      impressions,
      clicks,
      conversions,
      action_by,
      metadata
    ) VALUES (?, ?, ?, 'disconnected', ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    offerId,
    adsAccountId,
    customReason || reason,
    campaign?.campaign_id,
    campaign?.campaign_status,
    performanceSnapshot?.budget_spent || 0,
    performanceSnapshot?.impressions || 0,
    performanceSnapshot?.clicks || 0,
    performanceSnapshot?.conversions || 0,
    userId,
    JSON.stringify(performanceSnapshot || {})
  );

  return {
    account_id: adsAccountId,
    status: 'idle',
    disconnected_at: new Date().toISOString()
  };
}
```

### 2. 暂停Campaign并获取性能数据

```typescript
// lib/google-ads/pause-campaign.ts
export async function pauseCampaignAndGetPerformance(
  customerId: string,
  encryptedRefreshToken: string,
  campaignId: string
): Promise<any> {
  // Step 1: 解密Token
  const refreshToken = decryptToken(encryptedRefreshToken);

  // Step 2: 初始化Google Ads客户端
  const customer = googleAdsClient.Customer({
    customer_id: customerId,
    refresh_token: refreshToken
  });

  // Step 3: 获取Campaign性能数据
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.cost_micros
    FROM campaign
    WHERE campaign.id = ${campaignId}
  `;

  const results = await customer.query(query);
  const campaignData = results[0];

  // Step 4: 暂停Campaign
  await customer.campaigns.update([{
    update: {
      resource_name: `customers/${customerId}/campaigns/${campaignId}`,
      status: 'PAUSED'
    },
    update_mask: { paths: ['status'] }
  }]);

  // Step 5: 返回性能数据
  return {
    budget_spent: campaignData.metrics.cost_micros / 1_000_000,
    impressions: campaignData.metrics.impressions,
    clicks: campaignData.metrics.clicks,
    conversions: campaignData.metrics.conversions,
    campaign_status: 'PAUSED'
  };
}
```

### 3. Token加密解密（复用现有逻辑）

```typescript
// lib/encryption.ts
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!; // 32字节密钥
const ALGORITHM = 'aes-256-gcm';

export function encryptToken(token: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);

  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
}

export function decryptToken(encryptedToken: string): string {
  const [ivHex, encrypted, authTagHex] = encryptedToken.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

---

## 安全考虑

### 1. 权限验证

**所有API端点必须验证**:
```typescript
// 验证用户是否拥有此Offer
const offer = db.prepare(`
  SELECT id, user_id FROM offers WHERE id = ? AND user_id = ?
`).get(offerId, session.user.id);

if (!offer) {
  return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
}
```

### 2. 防止重复操作

**删除操作**:
```typescript
if (offer.is_deleted) {
  return NextResponse.json({
    success: false,
    error: 'Offer已被删除',
    code: 'ALREADY_DELETED'
  }, { status: 400 });
}
```

**解除关联操作**:
```typescript
if (!offer.ads_account_id) {
  return NextResponse.json({
    success: false,
    error: 'Offer未关联Ads账号'
  }, { status: 400 });
}
```

### 3. 事务完整性

**使用数据库事务确保数据一致性**:
```typescript
const result = db.transaction(() => {
  // Step 1: 更新Offer
  db.prepare('UPDATE offers SET ...').run(...);

  // Step 2: 更新Ads账号
  db.prepare('UPDATE google_ads_accounts SET ...').run(...);

  // Step 3: 记录历史
  db.prepare('INSERT INTO offer_ads_account_history ...').run(...);
})();
```

### 4. API调用失败处理

**Google Ads API调用失败不应阻止数据库更新**:
```typescript
try {
  // 尝试暂停Campaign
  await pauseCampaignAndGetPerformance(...);
} catch (error) {
  // 记录错误但继续执行
  console.error('Failed to pause campaign:', error);
  // 仍然执行数据库更新
}
```

---

## 测试计划

### 1. 单元测试

**测试文件**: `__tests__/lib/ads-account/disconnect.test.ts`

```typescript
describe('disconnectAdsAccount', () => {
  it('should disconnect ads account and update status to idle', () => {
    // 准备测试数据
    const offerId = createTestOffer({ ads_account_id: 1 });

    // 执行解除关联
    const result = disconnectAdsAccount(offerId, 1, userId, 'manual');

    // 验证结果
    expect(result.status).toBe('idle');

    // 验证Offer状态
    const offer = db.prepare('SELECT * FROM offers WHERE id = ?').get(offerId);
    expect(offer.ads_account_id).toBeNull();
    expect(offer.ad_status).toBe('disconnected');

    // 验证Ads账号状态
    const account = db.prepare('SELECT * FROM google_ads_accounts WHERE id = 1').get();
    expect(account.status).toBe('idle');

    // 验证历史记录
    const history = db.prepare('SELECT * FROM offer_ads_account_history WHERE offer_id = ?').get(offerId);
    expect(history.action).toBe('disconnected');
  });
});
```

### 2. 集成测试

**测试文件**: `__tests__/api/offers/delete.test.ts`

```typescript
describe('DELETE /api/offers/[id]', () => {
  it('should soft delete offer and disconnect ads account', async () => {
    // 创建测试Offer（已关联Ads账号）
    const offer = await createTestOffer({ ads_account_id: 1 });

    // 发送删除请求
    const response = await fetch(`http://localhost:3000/api/offers/${offer.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${testToken}` }
    });

    const data = await response.json();

    // 验证响应
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.disconnected_account).toBeDefined();

    // 验证数据库状态
    const deletedOffer = db.prepare('SELECT * FROM offers WHERE id = ?').get(offer.id);
    expect(deletedOffer.is_deleted).toBe(1);
    expect(deletedOffer.ads_account_id).toBeNull();

    const account = db.prepare('SELECT * FROM google_ads_accounts WHERE id = 1').get();
    expect(account.status).toBe('idle');
  });
});
```

### 3. E2E测试（Playwright）

**测试文件**: `e2e/offer-management.spec.ts`

```typescript
test('user can delete offer and see it in deleted list', async ({ page }) => {
  // 登录
  await page.goto('/login');
  await login(page);

  // 进入Offer列表
  await page.goto('/offers');

  // 点击第一个Offer的删除按钮
  await page.click('[data-testid="offer-card-1"] [data-testid="delete-button"]');

  // 确认删除对话框
  await page.click('[data-testid="confirm-delete"]');

  // 等待删除成功消息
  await expect(page.locator('text=Offer已删除')).toBeVisible();

  // 切换到"已删除"筛选器
  await page.click('[data-testid="filter-deleted"]');

  // 验证Offer显示在已删除列表中
  await expect(page.locator('[data-testid="offer-card-1"]')).toBeVisible();
  await expect(page.locator('[data-testid="offer-card-1"] [data-testid="deleted-badge"]')).toBeVisible();
});

test('user can disconnect and reconnect ads account', async ({ page }) => {
  // 进入Offer详情页
  await page.goto('/offers/1');

  // 点击"解除关联"按钮
  await page.click('[data-testid="disconnect-account"]');

  // 确认解除关联
  await page.click('[data-testid="confirm-disconnect"]');

  // 等待成功消息
  await expect(page.locator('text=已解除关联')).toBeVisible();

  // 点击"关联闲置账号"按钮
  await page.click('[data-testid="connect-idle-account"]');

  // 选择一个闲置账号
  await page.click('[data-testid="idle-account-1"] [data-testid="select-account"]');

  // 等待关联成功
  await expect(page.locator('text=关联成功')).toBeVisible();

  // 验证账号已关联
  await expect(page.locator('[data-testid="connected-account"]')).toBeVisible();
});
```

---

## 实施计划

### Phase 1: 数据库迁移（1天）

**任务**:
- ✅ 创建数据库迁移脚本
- ✅ 添加offers表新字段（is_deleted, deleted_at, deleted_by）
- ✅ 添加google_ads_accounts表新字段（status, last_disconnected_at等）
- ✅ 创建offer_ads_account_history表
- ✅ 添加所有索引
- ✅ 测试迁移脚本

**迁移脚本**:
```sql
-- migrations/006_offer_deletion_and_account_management.sql

-- 1. 扩展offers表
ALTER TABLE offers ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE offers ADD COLUMN deleted_at TEXT;
ALTER TABLE offers ADD COLUMN deleted_by INTEGER;
ALTER TABLE offers ADD COLUMN last_ads_account_id INTEGER;

CREATE INDEX idx_offers_is_deleted ON offers(is_deleted);
CREATE INDEX idx_offers_deleted_at ON offers(deleted_at);

-- 2. 扩展google_ads_accounts表
ALTER TABLE google_ads_accounts ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE google_ads_accounts ADD COLUMN last_disconnected_at TEXT;
ALTER TABLE google_ads_accounts ADD COLUMN disconnected_from_offer_id INTEGER;
ALTER TABLE google_ads_accounts ADD COLUMN disconnected_reason TEXT;

CREATE INDEX idx_ads_accounts_status ON google_ads_accounts(status);
CREATE INDEX idx_ads_accounts_last_disconnected ON google_ads_accounts(last_disconnected_at);

-- 3. 创建历史记录表
CREATE TABLE offer_ads_account_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  offer_id INTEGER NOT NULL,
  ads_account_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  reason TEXT,
  campaign_id TEXT,
  campaign_status TEXT,
  budget_spent REAL,
  impressions INTEGER,
  clicks INTEGER,
  conversions REAL,
  action_by INTEGER,
  action_at TEXT NOT NULL DEFAULT (datetime('now')),
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE,
  FOREIGN KEY (ads_account_id) REFERENCES google_ads_accounts(id) ON DELETE CASCADE
);

CREATE INDEX idx_history_offer_id ON offer_ads_account_history(offer_id);
CREATE INDEX idx_history_ads_account_id ON offer_ads_account_history(ads_account_id);
CREATE INDEX idx_history_action_at ON offer_ads_account_history(action_at);

-- 4. 初始化现有数据的status字段
UPDATE google_ads_accounts SET status = 'active';
```

### Phase 2: 后端API实现（3天）

**Day 1**: 核心函数实现
- ✅ `lib/ads-account/disconnect.ts` - 解除关联核心函数
- ✅ `lib/google-ads/pause-campaign.ts` - 暂停Campaign函数
- ✅ 单元测试

**Day 2**: API端点实现
- ✅ `DELETE /api/offers/[id]` - 删除Offer
- ✅ `POST /api/offers/[id]/disconnect` - 解除关联
- ✅ `GET /api/ads-accounts/idle` - 获取闲置账号
- ✅ 集成测试

**Day 3**: 高级功能
- ✅ `POST /api/offers/[id]/connect` - 关联闲置账号
- ✅ `POST /api/offers/[id]/restore` - 恢复已删除Offer
- ✅ 错误处理和边界条件

### Phase 3: 前端UI实现（3天）

**Day 1**: Offer列表页面
- ✅ 删除按钮和确认对话框
- ✅ 筛选器（全部/活跃/已删除）
- ✅ 已删除Offer的样式

**Day 2**: Offer详情页面
- ✅ Ads账号管理组件
- ✅ 解除关联功能
- ✅ 闲置账号列表对话框

**Day 3**: 闲置账号管理
- ✅ 闲置账号卡片设计
- ✅ 历史性能数据展示
- ✅ 关联流程优化

### Phase 4: 测试和优化（2天）

**Day 1**: 测试
- ✅ E2E测试（Playwright）
- ✅ 性能测试
- ✅ 安全测试

**Day 2**: 优化和文档
- ✅ UI/UX优化
- ✅ 错误消息优化
- ✅ 用户文档编写

### Phase 5: 部署和验证（1天）

- ✅ 数据库迁移执行
- ✅ 功能验证
- ✅ 用户验收测试

**总工作量**: 10个工作日

---

## 附录

### A. 数据流图

```
┌─────────────────────────────────────────────────────────────┐
│                    Offer删除流程                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ↓
                    用户点击"删除Offer"
                              │
                              ↓
                    【前端】二次确认对话框
                              │
                              ↓
                    【后端】开始事务处理
                              │
                   ┌──────────┴──────────┐
                   │                     │
                   ↓                     ↓
          检查Offer状态        检查是否有关联账号
                   │                     │
                   │                     ↓
                   │          有关联 → 执行解除关联
                   │                     │
                   └──────────┬──────────┘
                              ↓
                   更新Offer (is_deleted=1)
                              │
                              ↓
                   记录历史到history表
                              │
                              ↓
                        提交事务
                              │
                              ↓
                   【前端】显示成功消息

┌─────────────────────────────────────────────────────────────┐
│                 解除关联与闲置账号管理流程                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ↓
                   用户点击"解除关联"
                              │
                              ↓
                    【后端】开始事务处理
                              │
                   ┌──────────┴──────────┐
                   │                     │
                   ↓                     ↓
          暂停Campaign            获取性能数据
                   │                     │
                   └──────────┬──────────┘
                              ↓
                   更新Offer (ads_account_id=NULL)
                              │
                              ↓
                   更新Ads账号 (status='idle')
                              │
                              ↓
                   记录历史到history表
                              │
                              ↓
                        提交事务
                              │
                              ↓
                   【前端】显示闲置账号列表
                              │
                              ↓
                   用户选择账号并关联
                              │
                              ↓
                   创建新Campaign（一键上广告）
                              │
                              ↓
                   更新Offer和账号状态
```

### B. 状态流转图

**Offer.ad_status状态流转**:
```
not_launched → active → disconnected → active
     ↓             ↓          ↓
  (删除)        (删除)     (删除)
     ↓             ↓          ↓
  deleted       deleted    deleted
     ↓             ↓          ↓
  (恢复)        (恢复)     (恢复)
     ↓             ↓          ↓
not_launched  disconnected disconnected
```

**google_ads_accounts.status状态流转**:
```
active → idle → active
  ↓       ↓       ↓
disabled disabled disabled
```

### C. 相关文档

- `TECHNICAL_SPEC_V2.md`: 数据库Schema完整定义
- `API_INTEGRATION_V2.md`: Google Ads API集成
- `ONE_CLICK_LAUNCH.md`: "一键上广告"流程
- `RISK_ALERT_DESIGN.md`: 风险提示功能

---

**文档状态**: ✅ 设计完成
**下一步**: 开始Phase 1 - 数据库迁移
**预计上线时间**: 10个工作日后
