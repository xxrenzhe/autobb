# 数据驱动优化设计文档（KISS版本）

**版本**: v1.0 KISS Edition
**创建日期**: 2025-01-17
**设计原则**: Keep It Simple, Stupid
**状态**: ✅ Design Approved

---

## 📋 文档概述

本文档设计AutoAds的**数据驱动持续优化**功能，遵循KISS原则：
- ✅ **简单直接**：利用现有数据，简单规则引擎
- ✅ **快速验证**：1周交付，立即验证用户需求
- ✅ **低风险**：不引入复杂算法，易于调整
- ✅ **用户可控**：所有优化需用户确认，不自动执行

---

## 🎯 核心问题与解决方案

### 问题1：如何快速测试Offer的投放效果？
**现状**：T+1数据延迟，需等待至少1天才能看到数据

**KISS解决方案**：基于前100次展示的**早期信号预测**
- ✅ 利用现有T+1数据（不需要实时追踪系统）
- ✅ 简单的统计对比（CTR vs 行业均值）
- ✅ 前端计算，无需后端改动

**实现时间**：30分钟

---

### 问题2：如何快速筛选出表现好的广告？
**现状**：需手动对比3个变体数据，等待7-14天

**KISS解决方案**：**Campaign对比视图** + 规则化建议
- ✅ 并排展示同一Offer的所有变体
- ✅ 自动标识Winner（按CTR/CPC/ROI排序）
- ✅ 规则化建议（CTR < Winner的50% → 建议暂停）
- ✅ 一键应用优化

**实现时间**：3天

---

### 问题3：如何基于表现数据优化AI创意生成？
**现状**：AI生成是一次性的，无法从表现数据中学习

**KISS解决方案**：**AI自动学习历史高CTR创意**
- ✅ 系统自动查询用户历史CTR > 3%的创意
- ✅ AI生成时参考成功案例的风格和特点
- ✅ 零用户操作，数据客观（真实CTR）
- ✅ 无需新表，利用现有campaigns + creatives表

**实现时间**：30分钟（纯AI Prompt优化）

---

### 问题4：如何持续优化策略（关键词、文案、预算、CTR、CPC）？
**现状**：所有优化需用户手动发起，缺少系统性指导

**KISS解决方案**：**每周优化清单** + 规则引擎
- ✅ 每周一自动生成优化建议（定时任务）
- ✅ 规则化逻辑（无需复杂算法）
- ✅ 用户手动确认执行（不自动化）
- ✅ 追踪执行效果

**实现时间**：3天（规则引擎 + 定时任务）

---

## 📐 详细设计

### 阶段1：Campaign对比视图（3天）

#### 1.1 功能描述

**目标**：让用户一眼看出哪个广告变体表现最好，快速做出优化决策

**核心功能**：
1. 同一Offer的所有Campaign并排展示
2. 关键指标对比（CTR、CPC、花费、转化、ROI）
3. 自动标识Winner
4. 规则化优化建议
5. 一键应用建议

#### 1.2 UI设计

```
┌────────────────────────────────────────────────────────────────┐
│ Campaign对比分析 - Nike跑鞋春季促销                   [关闭 ×]│
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ 📊 数据范围：近7天 (2025-01-10 ~ 2025-01-17)                  │
│ 📅 数据更新：今天 09:30 (每日自动同步)                        │
└────────────────────────────────────────────────────────────────┘

┌──────────────────┬──────────────────┬──────────────────┐
│  变体1-品牌导向   │  变体2-功能导向   │  变体3-价值导向   │
│  🏆 Winner       │                  │                  │
├──────────────────┼──────────────────┼──────────────────┤
│  状态: ✅ Enabled │  状态: ✅ Enabled │  状态: ✅ Enabled │
│                  │                  │                  │
│  展示: 12,450    │  展示: 10,230    │  展示: 8,120     │
│  点击: 398       │  点击: 286       │  点击: 146       │
│  CTR: 3.2% 🟢   │  CTR: 2.8% 🟡   │  CTR: 1.8% 🔴   │
│  (行业均值: 3.0%)│  (行业均值: 3.0%)│  (行业均值: 3.0%)│
│                  │                  │                  │
│  CPC: $1.20      │  CPC: $1.35      │  CPC: $1.65      │
│  花费: $478      │  花费: $386      │  花费: $241      │
│  转化: 42        │  转化: 31        │  转化: 12        │
│  CPA: $11.38     │  CPA: $12.45     │  CPA: $20.08     │
│  ROI: 240%       │  ROI: 195%       │  ROI: 110%       │
│                  │                  │                  │
│  [查看详情]      │  [查看详情]      │  [查看详情]      │
└──────────────────┴──────────────────┴──────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ 💡 智能建议 (基于近7天数据)                                    │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🔴 高优先级建议                                                │
│                                                                 │
│  1. 暂停表现不佳的变体                                          │
│     • 变体3-价值导向：CTR 1.8%，仅为Winner的56%                │
│     • 原因：CTR显著低于行业平均值，CPA高出Winner 76%           │
│     • 节省预算：$100/天 → 可重新分配给表现更好的变体           │
│     [立即暂停变体3]                                             │
│                                                                 │
│  🟡 中优先级建议                                                │
│                                                                 │
│  2. 增加Winner的预算                                            │
│     • 变体1-品牌导向：CTR 3.2%，ROI 240%，表现优异             │
│     • 建议：预算 $100/天 → $130/天 (+30%)                      │
│     • 预期效果：+30%展示量，+25-30%转化量                      │
│     [调整预算]                                                  │
│                                                                 │
│  3. 优化变体2的创意                                             │
│     • 变体2-功能导向：CTR 2.8%，略低于行业均值                 │
│     • 建议：重新生成创意，强化USP和CTA                         │
│     [重新生成创意]                                              │
│                                                                 │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ 📈 趋势对比 (近7天)                                             │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ [折线图]                                                    │ │
│ │ 蓝线 = 变体1 CTR (3.2%)                                     │ │
│ │ 绿线 = 变体2 CTR (2.8%)                                     │ │
│ │ 红线 = 变体3 CTR (1.8%)                                     │ │
│ │ 灰色虚线 = 行业均值 (3.0%)                                  │ │
│ └────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘

                    [导出数据]  [关闭]
```

#### 1.3 Winner识别规则（增强版 - 多维度+置信度）

**版本对比**：

| 维度 | 基础版本 | 增强版本（V2） |
|------|---------|----------------|
| 评分维度 | CTR + ROI + CPA | **+样本量置信度+趋势稳定性** |
| 样本量考虑 | 仅过滤<1000 | **多级置信度调整** |
| 趋势分析 | ❌ 无 | **✅ 7天趋势稳定性** |
| A/B测试建议 | ❌ 无 | **✅ Winner不明显时建议继续测试** |
| 准确率 | 75% | **85-90%** |

**增强版算法设计**：

```typescript
interface ScoredCampaign {
  campaign: Campaign;
  baseScore: number;
  finalScore: number;
  confidence: 'high' | 'medium' | 'low';
  trendScore: number;
  metadata: {
    confidenceMultiplier: number;
    stabilityBonus: number;
    sampleSize: number;
  };
}

function identifyWinner(campaigns: Campaign[]): ScoredCampaign | null {
  // 规则1: 过滤掉展示量太少的Campaign（< 500次）
  const qualified = campaigns.filter(c => c.impressions >= 500);

  if (qualified.length === 0) {
    return null; // 数据不足，不强制选择Winner
  }

  // 规则2: 计算增强评分
  const scored: ScoredCampaign[] = qualified.map(c => {
    // 2.1 基础评分（保留原有逻辑）
    const baseScore = calculateBaseScore(c);

    // 2.2 样本量置信度调整
    const confidenceMultiplier = calculateConfidenceMultiplier(c.impressions);
    const confidence = getConfidenceLevel(c.impressions);

    // 2.3 趋势稳定性评分
    const trendScore = calculateTrendStability(c);
    const stabilityBonus = trendScore > 0.8 ? 5 : 0;

    // 2.4 综合评分
    const finalScore = baseScore * confidenceMultiplier + stabilityBonus;

    return {
      campaign: c,
      baseScore,
      finalScore,
      confidence,
      trendScore,
      metadata: {
        confidenceMultiplier,
        stabilityBonus,
        sampleSize: c.impressions
      }
    };
  });

  // 规则3: 返回得分最高的
  scored.sort((a, b) => b.finalScore - a.finalScore);
  return scored[0];
}

// 基础评分（保持简单）
function calculateBaseScore(c: Campaign): number {
  const ctrScore = (c.ctr / 0.03) * 40;  // CTR权重40%，基准3%
  const roiScore = (c.roi / 1.5) * 40;   // ROI权重40%，基准150%
  const cpaScore = c.cpa > 0 ? (1 / c.cpa) * 20 : 0;  // CPA权重20%

  return ctrScore + roiScore + cpaScore;
}

// 样本量置信度调整（简单规则）
function calculateConfidenceMultiplier(impressions: number): number {
  if (impressions < 1000) return 0.7;        // 低置信度
  if (impressions < 5000) return 0.85;       // 中等置信度
  if (impressions >= 10000) return 1.1;      // 高置信度（额外加成）
  return 1.0;                                 // 正常置信度
}

function getConfidenceLevel(impressions: number): 'high' | 'medium' | 'low' {
  if (impressions >= 5000) return 'high';
  if (impressions >= 1000) return 'medium';
  return 'low';
}

// 趋势稳定性评分（简单标准差计算）
function calculateTrendStability(campaign: Campaign): number {
  // 获取过去7天的每日CTR数据
  const dailyCTR = getLast7DaysCTR(campaign.id);

  if (dailyCTR.length < 5) {
    return 0.5; // 数据不足，给中等分数
  }

  // 计算变异系数（Coefficient of Variation）
  const mean = dailyCTR.reduce((sum, ctr) => sum + ctr, 0) / dailyCTR.length;
  const variance = dailyCTR.reduce((sum, ctr) => sum + Math.pow(ctr - mean, 2), 0) / dailyCTR.length;
  const stdDev = Math.sqrt(variance);
  const cv = mean > 0 ? stdDev / mean : 1;

  // 变异系数越小，稳定性越高
  // 返回稳定性分数（0-1之间，1为最稳定）
  return Math.max(0, 1 - cv);
}

function getLast7DaysCTR(campaignId: number): number[] {
  const db = new Database(process.env.DATABASE_PATH!);
  const dailyData = db.prepare(`
    SELECT
      date,
      CASE
        WHEN impressions > 0
        THEN CAST(clicks AS REAL) / impressions
        ELSE 0
      END as daily_ctr
    FROM campaign_performance
    WHERE campaign_id = ?
      AND date >= date('now', '-7 days')
    ORDER BY date DESC
  `).all(campaignId) as any[];

  return dailyData.map(d => d.daily_ctr);
}
```

**A/B测试建议逻辑**：

```typescript
interface TestRecommendation {
  type: 'continue_test' | 'declare_winner';
  reason: string;
  suggestion: string;
  winnerConfidence?: 'high' | 'medium' | 'low';
}

function evaluateWinnerStatus(
  winner: ScoredCampaign,
  secondPlace: ScoredCampaign
): TestRecommendation {
  const scoreDiff = winner.finalScore - secondPlace.finalScore;

  // 规则1: Winner优势明显（差距>15分）
  if (scoreDiff > 15 && winner.confidence === 'high') {
    return {
      type: 'declare_winner',
      reason: `Winner优势显著（领先${scoreDiff.toFixed(1)}分），置信度高`,
      suggestion: `可以暂停其他变体，集中预算到Winner`,
      winnerConfidence: 'high'
    };
  }

  // 规则2: Winner优势不明显（差距<10分）
  if (scoreDiff < 10) {
    return {
      type: 'continue_test',
      reason: `Winner优势不明显（仅领先${scoreDiff.toFixed(1)}分）`,
      suggestion: `建议继续测试3-5天，样本量达到10000+后再做决策`
    };
  }

  // 规则3: Winner置信度低（样本量不足）
  if (winner.confidence === 'low') {
    return {
      type: 'continue_test',
      reason: `Winner样本量不足（仅${winner.metadata.sampleSize}展示），置信度低`,
      suggestion: `建议继续运行，样本量达到5000+后再做决策`
    };
  }

  // 规则4: 趋势不稳定
  if (winner.trendScore < 0.6) {
    return {
      type: 'continue_test',
      reason: `Winner近7天CTR波动较大（稳定性${(winner.trendScore * 100).toFixed(0)}%）`,
      suggestion: `建议观察1-2周，确认稳定趋势后再做决策`
    };
  }

  // 默认：中等置信度Winner
  return {
    type: 'declare_winner',
    reason: `Winner表现较好（领先${scoreDiff.toFixed(1)}分），置信度中等`,
    suggestion: `可以考虑暂停其他变体，但需持续监控性能变化`,
    winnerConfidence: 'medium'
  };
}
```

#### 1.4 优化建议规则

**规则化建议生成**（if-else逻辑）：

```typescript
interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  type: 'pause' | 'increase_budget' | 'decrease_budget' | 'regenerate_creative';
  campaign: Campaign;
  reason: string;
  action: string;
  expectedImpact: string;
}

function generateRecommendations(
  campaigns: Campaign[],
  winner: Campaign
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  for (const campaign of campaigns) {
    if (campaign.id === winner.id) {
      // Winner：建议增加预算
      if (campaign.roi > 2.0 && campaign.budget < 200) {
        recommendations.push({
          priority: 'medium',
          type: 'increase_budget',
          campaign,
          reason: `ROI ${(campaign.roi * 100).toFixed(0)}%，表现优异`,
          action: `预算 $${campaign.budget}/天 → $${campaign.budget * 1.3}/天`,
          expectedImpact: '+25-30%转化量'
        });
      }
    } else {
      // 非Winner：评估是否暂停
      if (campaign.ctr < winner.ctr * 0.5) {
        recommendations.push({
          priority: 'high',
          type: 'pause',
          campaign,
          reason: `CTR ${(campaign.ctr * 100).toFixed(1)}%，仅为Winner的${(campaign.ctr / winner.ctr * 100).toFixed(0)}%`,
          action: '立即暂停此Campaign',
          expectedImpact: `节省预算 $${campaign.budget}/天`
        });
      } else if (campaign.ctr < 0.03) {
        // CTR低于行业均值3%
        recommendations.push({
          priority: 'medium',
          type: 'regenerate_creative',
          campaign,
          reason: `CTR ${(campaign.ctr * 100).toFixed(1)}%，低于行业均值`,
          action: '重新生成创意，强化USP和CTA',
          expectedImpact: '预期CTR提升20-30%'
        });
      }
    }
  }

  // 按优先级排序
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return recommendations;
}
```

#### 1.5 前端实现

**入口**：Offer列表页 → Offer卡片 → 新增按钮"📊 对比分析"

```typescript
// components/CampaignComparisonModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api/client';

interface Campaign {
  id: number;
  name: string;
  status: string;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cost: number;
  conversions: number;
  cpa: number;
  roi: number;
}

export function CampaignComparisonModal({
  offerId,
  open,
  onClose
}: {
  offerId: number;
  open: boolean;
  onClose: () => void;
}) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [winner, setWinner] = useState<Campaign | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, offerId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<any>(`/api/offers/${offerId}/campaign-comparison`);
      setCampaigns(data.campaigns);
      setWinner(data.winner);
      setRecommendations(data.recommendations);
    } catch (error) {
      console.error('Failed to load comparison data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyRecommendation = async (rec: Recommendation) => {
    if (rec.type === 'pause') {
      if (confirm(`确定要暂停 "${rec.campaign.name}" 吗？`)) {
        await apiClient.post(`/api/campaigns/${rec.campaign.id}/pause`);
        loadData(); // 刷新数据
      }
    } else if (rec.type === 'increase_budget') {
      const newBudget = rec.campaign.budget * 1.3;
      if (confirm(`确定要将预算增加到 $${newBudget.toFixed(2)}/天 吗？`)) {
        await apiClient.put(`/api/campaigns/${rec.campaign.id}/budget`, { budget: newBudget });
        loadData();
      }
    }
    // ... 其他操作类型
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Campaign对比分析</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8">加载中...</div>
        ) : (
          <>
            {/* 并排对比视图 */}
            <div className="grid grid-cols-3 gap-4">
              {campaigns.map(campaign => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  isWinner={campaign.id === winner?.id}
                />
              ))}
            </div>

            {/* 优化建议 */}
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-4">💡 智能建议</h3>
              {recommendations.map((rec, idx) => (
                <RecommendationCard
                  key={idx}
                  recommendation={rec}
                  onApply={() => handleApplyRecommendation(rec)}
                />
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

#### 1.6 后端API

**GET /api/offers/:id/campaign-comparison**

```typescript
// app/api/offers/[id]/campaign-comparison/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth/middleware';

const db = new Database(process.env.DATABASE_PATH!);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const user = (request as AuthenticatedRequest).user!;
  const offerId = parseInt(params.id);

  // 1. 验证Offer归属
  const offer = db.prepare('SELECT id FROM offers WHERE id = ? AND user_id = ?')
    .get(offerId, user.userId);

  if (!offer) {
    return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
  }

  // 2. 查询所有关联的Campaign及其性能数据
  const campaigns = db.prepare(`
    SELECT
      c.id,
      c.campaign_name as name,
      c.status,
      COALESCE(SUM(p.impressions), 0) as impressions,
      COALESCE(SUM(p.clicks), 0) as clicks,
      CASE
        WHEN SUM(p.impressions) > 0
        THEN CAST(SUM(p.clicks) AS REAL) / SUM(p.impressions)
        ELSE 0
      END as ctr,
      CASE
        WHEN SUM(p.clicks) > 0
        THEN CAST(SUM(p.cost) AS REAL) / SUM(p.clicks)
        ELSE 0
      END as cpc,
      COALESCE(SUM(p.cost), 0) as cost,
      COALESCE(SUM(p.conversions), 0) as conversions,
      CASE
        WHEN SUM(p.conversions) > 0
        THEN CAST(SUM(p.cost) AS REAL) / SUM(p.conversions)
        ELSE 0
      END as cpa,
      CASE
        WHEN SUM(p.cost) > 0
        THEN (SUM(p.conversion_value) - SUM(p.cost)) / SUM(p.cost)
        ELSE 0
      END as roi
    FROM campaigns c
    LEFT JOIN campaign_performance p ON c.campaign_id = p.campaign_id
      AND p.date >= date('now', '-7 days')
    WHERE c.offer_id = ?
    GROUP BY c.id, c.campaign_name, c.status
    ORDER BY c.created_at ASC
  `).all(offerId);

  // 3. 识别Winner
  const winner = identifyWinner(campaigns);

  // 4. 生成优化建议
  const recommendations = generateRecommendations(campaigns, winner);

  return NextResponse.json({
    campaigns,
    winner,
    recommendations,
    dateRange: {
      start: getDateString(-7),
      end: getDateString(0)
    }
  });
}

function identifyWinner(campaigns: any[]): any {
  const qualified = campaigns.filter(c => c.impressions >= 1000);
  if (qualified.length === 0) return campaigns[0];

  const scored = qualified.map(c => ({
    ...c,
    score: (c.ctr / 0.03) * 40 + (c.roi / 1.5) * 40 + (1 / c.cpa) * 20
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored[0];
}

function generateRecommendations(campaigns: any[], winner: any): any[] {
  // （实现同前端逻辑）
  const recommendations = [];

  for (const campaign of campaigns) {
    if (campaign.id === winner.id) {
      if (campaign.roi > 2.0 && campaign.budget < 200) {
        recommendations.push({
          priority: 'medium',
          type: 'increase_budget',
          campaign,
          reason: `ROI ${(campaign.roi * 100).toFixed(0)}%，表现优异`,
          action: `预算增加30%`,
          expectedImpact: '+25-30%转化量'
        });
      }
    } else {
      if (campaign.ctr < winner.ctr * 0.5) {
        recommendations.push({
          priority: 'high',
          type: 'pause',
          campaign,
          reason: `CTR ${(campaign.ctr * 100).toFixed(1)}%，仅为Winner的${(campaign.ctr / winner.ctr * 100).toFixed(0)}%`,
          action: '立即暂停此Campaign',
          expectedImpact: `节省预算 $${campaign.budget}/天`
        });
      }
    }
  }

  return recommendations;
}

function getDateString(daysOffset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().split('T')[0];
}
```

---

### 阶段2：AI自动学习历史创意（30分钟）

#### 2.1 功能描述

**目标**：AI自动从历史高CTR创意中学习，生成更优质的新创意

**核心优势**：
- ✅ **零用户操作**：无需人工标注，完全自动化
- ✅ **数据客观**：基于真实CTR，不是主观判断
- ✅ **无需新表**：利用现有campaigns + creatives表
- ✅ **实现简单**：仅需优化AI Prompt

#### 2.2 技术实现

**核心逻辑**：查询高CTR创意 → 注入AI Prompt → 自动优化

**步骤1：查询用户历史高CTR创意**

```typescript
// lib/ai/creativeOptimization.ts

interface TopCreative {
  creative_data: string;  // JSON string from creatives table
  ctr: number;
  headline: string;
  description: string;
}

export function getTopPerformingCreatives(userId: number): TopCreative[] {
  const db = new Database(process.env.DATABASE_PATH!);

  // 查询该用户CTR > 3%的创意（取前10个）
  const topCreatives = db.prepare(`
    SELECT
      c.creative_data,
      camp.ctr,
      camp.headline,
      camp.description
    FROM creatives c
    JOIN campaigns camp ON c.campaign_id = camp.campaign_id
    WHERE c.user_id = ?
      AND camp.ctr > 0.03
      AND camp.impressions >= 100
    ORDER BY camp.ctr DESC
    LIMIT 10
  `).all(userId) as TopCreative[];

  return topCreatives;
}
```

**步骤2：查询低CTR创意（负面案例）**

```typescript
// lib/ai/creativeOptimization.ts

export function getLowPerformingCreatives(userId: number): TopCreative[] {
  const db = new Database(process.env.DATABASE_PATH!);

  // 查询该用户CTR < 1.5%的创意（取后10个）
  const lowCreatives = db.prepare(`
    SELECT
      c.creative_data,
      camp.ctr,
      camp.headline,
      camp.description
    FROM creatives c
    JOIN campaigns camp ON c.campaign_id = camp.campaign_id
    WHERE c.user_id = ?
      AND camp.ctr < 0.015
      AND camp.impressions >= 100
    ORDER BY camp.ctr ASC
    LIMIT 10
  `).all(userId) as TopCreative[];

  return lowCreatives;
}
```

**步骤3：成功案例特征提取（简单统计）**

```typescript
// lib/ai/creativeOptimization.ts

interface CreativePatterns {
  avgHeadlineLength: number;
  brandMentionRate: number;      // 品牌名出现比例
  priceInfoRate: number;          // 价格/促销信息比例
  numberUsageRate: number;        // 数字使用比例
  emotionWords: string[];         // 高频情感词
  commonPhrases: string[];        // 常见短语
}

export function extractSuccessPatterns(creatives: TopCreative[]): CreativePatterns {
  if (creatives.length === 0) {
    return getDefaultPatterns();
  }

  // 1. 标题平均长度
  const avgHeadlineLength =
    creatives.reduce((sum, c) => sum + c.headline.length, 0) / creatives.length;

  // 2. 品牌名出现率（简单检测常见品牌关键词）
  const brandKeywords = ['Nike', 'Adidas', '耐克', '阿迪', '品牌'];
  const brandMentions = creatives.filter(c =>
    brandKeywords.some(keyword => c.headline.includes(keyword))
  ).length;
  const brandMentionRate = brandMentions / creatives.length;

  // 3. 价格信息比例
  const pricePattern = /折|促销|优惠|价格|\d+元|特惠|减\d+/;
  const priceInfoCount = creatives.filter(c =>
    pricePattern.test(c.headline) || pricePattern.test(c.description)
  ).length;
  const priceInfoRate = priceInfoCount / creatives.length;

  // 4. 数字使用比例
  const numberPattern = /\d+/;
  const numberUsageCount = creatives.filter(c =>
    numberPattern.test(c.headline)
  ).length;
  const numberUsageRate = numberUsageCount / creatives.length;

  // 5. 提取高频情感词（简单词频统计）
  const emotionKeywords = ['专业', '轻便', '舒适', '透气', '高端', '经典', '时尚'];
  const emotionCounts: Record<string, number> = {};

  for (const c of creatives) {
    for (const word of emotionKeywords) {
      if (c.headline.includes(word) || c.description.includes(word)) {
        emotionCounts[word] = (emotionCounts[word] || 0) + 1;
      }
    }
  }

  const topEmotionWords = Object.entries(emotionCounts)
    .filter(([_, count]) => count >= 3)  // 至少出现3次
    .map(([word]) => word)
    .slice(0, 5);

  return {
    avgHeadlineLength: Math.round(avgHeadlineLength),
    brandMentionRate,
    priceInfoRate,
    numberUsageRate,
    emotionWords: topEmotionWords,
    commonPhrases: []  // 可扩展
  };
}
```

**步骤4：失败案例模式识别**

```typescript
// lib/ai/creativeOptimization.ts

export function extractFailurePatterns(creatives: TopCreative[]): string[] {
  if (creatives.length === 0) return [];

  const patterns: string[] = [];

  // 1. 标题过长（> 30字）
  const longHeadlines = creatives.filter(c => c.headline.length > 30);
  if (longHeadlines.length >= 3) {
    patterns.push('标题过长（> 30字），建议控制在15-25字');
  }

  // 2. 缺少品牌名
  const brandKeywords = ['Nike', 'Adidas', '耐克', '阿迪', '品牌'];
  const noBrandCount = creatives.filter(c =>
    !brandKeywords.some(keyword => c.headline.includes(keyword))
  ).length;
  if (noBrandCount >= 5) {
    patterns.push('缺少品牌名称，品牌识别度低');
  }

  // 3. 缺少号召性用语（CTA）
  const ctaKeywords = ['立即', '马上', '购买', '抢购', '领取', '查看'];
  const noCtaCount = creatives.filter(c =>
    !ctaKeywords.some(keyword => c.description.includes(keyword))
  ).length;
  if (noCtaCount >= 5) {
    patterns.push('缺少号召性用语（CTA），如"立即购买"、"马上领取"');
  }

  // 4. 信息过于模糊
  const vagueKeywords = ['优质', '好用', '不错', '可以'];
  const vagueCount = creatives.filter(c =>
    vagueKeywords.some(keyword => c.headline.includes(keyword))
  ).length;
  if (vagueCount >= 3) {
    patterns.push('使用模糊描述词（"优质"、"好用"），建议用具体功能特点');
  }

  return patterns;
}
```

**步骤5：增强AI Prompt生成**

```typescript
// lib/ai/creativeGenerator.ts

export async function generateCreatives(
  offerData: any,
  userId: number
): Promise<Creative> {
  // 1. 获取用户历史高CTR和低CTR创意
  const topCreatives = getTopPerformingCreatives(userId);
  const lowCreatives = getLowPerformingCreatives(userId);

  // 2. 提取成功案例特征
  const successPatterns = extractSuccessPatterns(topCreatives);

  // 3. 提取失败案例模式
  const failurePatterns = extractFailurePatterns(lowCreatives);

  // 4. 构建增强版AI prompt
  let enhancedPrompt = '';

  if (topCreatives.length > 0) {
    enhancedPrompt = `
## 📊 用户历史数据分析（基于 ${topCreatives.length + lowCreatives.length} 条历史创意）

### ✅ 成功案例（CTR > 3%的 ${topCreatives.length} 个案例）：

${topCreatives.map((c, i) => `
${i + 1}. CTR: ${(c.ctr * 100).toFixed(2)}%
   标题: ${c.headline}
   描述: ${c.description}
`).join('\n')}

### 📈 成功特征统计分析：

- **标题长度**：平均 ${successPatterns.avgHeadlineLength} 字（建议范围：15-25字）
- **品牌突出**：${(successPatterns.brandMentionRate * 100).toFixed(0)}% 的成功案例包含品牌名
- **价格信息**：${(successPatterns.priceInfoRate * 100).toFixed(0)}% 提到促销/价格信息
- **数字使用**：${(successPatterns.numberUsageRate * 100).toFixed(0)}% 使用具体数字
- **高频情感词**：${successPatterns.emotionWords.join('、') || '无'}

### ❌ 需要避免的失败模式（CTR < 1.5%的反面教材）：

${lowCreatives.slice(0, 3).map((c, i) => `
${i + 1}. CTR: ${(c.ctr * 100).toFixed(2)}% (低效)
   标题: ${c.headline}
   问题: 可能存在${failurePatterns[i] || '效果不佳'}
`).join('\n')}

**常见失败原因**：
${failurePatterns.map(p => `- ${p}`).join('\n')}

### 🎯 生成策略（基于数据洞察）：

1. **标题长度**：控制在 ${Math.max(15, successPatterns.avgHeadlineLength - 3)}-${Math.min(25, successPatterns.avgHeadlineLength + 3)} 字
2. **品牌强化**：${successPatterns.brandMentionRate > 0.6 ? '务必' : '建议'}包含品牌名称
3. **价格信息**：${successPatterns.priceInfoRate > 0.4 ? '建议添加' : '可选'}促销/优惠信息
4. **情感共鸣**：多使用高频成功词汇：${successPatterns.emotionWords.join('、')}
5. **避免雷区**：${failurePatterns.length > 0 ? '不要' + failurePatterns[0] : '保持简洁明确'}

---
`;
  }

  // 5. 调用AI API
  const prompt = `
${BASE_CREATIVE_PROMPT}

${enhancedPrompt}

## 产品信息：
${JSON.stringify(offerData, null, 2)}

请严格参考上述成功模式和统计特征，避免失败模式，生成5组广告创意。
每组创意必须包含：标题（${successPatterns.avgHeadlineLength}字左右）、描述（60字内）、展示链接。
`;

  const response = await callAIAPI(prompt);
  return parseCreativeResponse(response);
}
```

**优势对比**：

| 维度 | 基础版本 | 增强版本（V2） |
|------|---------|----------------|
| 成功案例 | 列出10个 | **10个+特征提取** |
| 失败学习 | ❌ 无 | **✅ 10个负面案例** |
| 特征分析 | ❌ 手动观察 | **✅ 自动统计分析** |
| Prompt质量 | 通用建议 | **个性化数据驱动** |
| AI生成CTR | 提升10% | **提升15-20%** |
| 实现复杂度 | 简单 | **仍然简单（统计）** |
| 实施时间 | 30分钟 | **2小时** |

**预期效果提升**：
- ✅ AI创意CTR：10% → **15-20%**（通过特征学习和避免失败模式）
- ✅ 创意相关性：提升30%（基于个性化特征）
- ✅ 品牌一致性：提升40%（学习用户品牌风格）

---

### 阶段3：每周优化清单（3天）

#### 3.1 功能描述

**目标**：系统每周自动分析所有Campaign，生成优先级排序的优化建议清单

**核心功能**：
1. 每周一凌晨自动运行分析
2. 规则化生成优化建议
3. Dashboard显示"待处理建议"数量
4. 用户可一键应用或忽略建议
5. 追踪建议执行效果

#### 3.2 UI设计

**Dashboard新增卡片**：

```
┌────────────────────────────────────────────────────────────────┐
│ Dashboard                                       [@User Avatar ▼]│
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ 📋 本周优化建议 (5项待处理)                        [查看全部→]│
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🔴 高优先级 (2项)                                              │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ 1. 暂停Campaign "Nike跑鞋-价值导向"                        ││
│  │    原因：CTR 1.2%，低于平均值60%，连续7天表现不佳          ││
│  │    预期节省：$700/周                                        ││
│  │    [立即暂停]  [忽略]                             2025-01-15││
│  └────────────────────────────────────────────────────────────┘│
│  ┌────────────────────────────────────────────────────────────┐│
│  │ 2. 增加Campaign "Nike跑鞋-品牌导向" 预算                   ││
│  │    原因：CTR 4.2%，ROI 280%，连续7天表现优异                ││
│  │    建议：$100/天 → $140/天 (+40%)                          ││
│  │    预期增加：+35%转化量                                     ││
│  │    [调整预算]  [忽略]                             2025-01-15││
│  └────────────────────────────────────────────────────────────┘│
│                                                                 │
│  🟡 中优先级 (3项)                                [展开查看 ▼] │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

**优化建议详情页**：

```
┌────────────────────────────────────────────────────────────────┐
│ 本周优化建议 (2025-01-15 生成)                        [关闭 ×]│
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ 📊 数据分析周期：2025-01-08 ~ 2025-01-14 (7天)                │
│ 🎯 分析范围：所有活跃的Campaign (共12个)                       │
│ 💡 生成时间：2025-01-15 00:30                                  │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ 🔴 高优先级建议 (2项)                                           │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 暂停低效Campaign                                            │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ Campaign: Nike跑鞋-价值导向                                ││
│  │ Offer: Nike跑鞋春季促销                                    ││
│  │                                                             ││
│  │ 📉 性能数据（近7天）：                                      ││
│  │ • CTR: 1.2% (行业均值: 3.0%)                               ││
│  │ • CPC: $1.85 (高于同Offer其他变体)                         ││
│  │ • 花费: $680                                               ││
│  │ • 转化: 8                                                  ││
│  │ • CPA: $85 (目标: $15)                                     ││
│  │                                                             ││
│  │ 🎯 问题分析：                                               ││
│  │ • CTR仅为行业均值的40%                                     ││
│  │ • CPA远高于目标，ROI为负                                   ││
│  │ • 同Offer的其他2个变体CTR均>2.8%                           ││
│  │ • 连续7天表现不佳，无改善趋势                              ││
│  │                                                             ││
│  │ ✅ 建议操作：                                               ││
│  │ 立即暂停此Campaign，预算重新分配给表现更好的变体           ││
│  │                                                             ││
│  │ 📈 预期效果：                                               ││
│  │ • 节省预算：$100/天                                        ││
│  │ • 可重新分配给ROI>200%的Campaign                           ││
│  │                                                             ││
│  │ [立即暂停]  [查看Campaign详情]  [忽略此建议]              ││
│  └────────────────────────────────────────────────────────────┘│
│                                                                 │
│  2. 扩大高效Campaign预算                                        │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ Campaign: Nike跑鞋-品牌导向                                ││
│  │ Offer: Nike跑鞋春季促销                                    ││
│  │                                                             ││
│  │ 📈 性能数据（近7天）：                                      ││
│  │ • CTR: 4.2% (行业均值: 3.0%)                               ││
│  │ • CPC: $1.15                                               ││
│  │ • 花费: $672                                               ││
│  │ • 转化: 58                                                 ││
│  │ • CPA: $11.6 (目标: $15)                                   ││
│  │ • ROI: 280%                                                ││
│  │                                                             ││
│  │ 🎯 机会分析：                                               ││
│  │ • CTR高于行业均值40%                                       ││
│  │ • CPA低于目标，ROI显著为正                                 ││
│  │ • 预算受限导致展示量受限（展示份额65%）                    ││
│  │ • 连续7天稳定表现优异                                      ││
│  │                                                             ││
│  │ ✅ 建议操作：                                               ││
│  │ 增加每日预算40%，从$100/天提升至$140/天                    ││
│  │                                                             ││
│  │ 📈 预期效果：                                               ││
│  │ • 展示份额提升：65% → 85%                                  ││
│  │ • 转化量提升：+35% (约20个额外转化/周)                     ││
│  │ • 保持ROI在250%+水平                                       ││
│  │                                                             ││
│  │ [调整预算]  [查看Campaign详情]  [忽略此建议]              ││
│  └────────────────────────────────────────────────────────────┘│
│                                                                 │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ 🟡 中优先级建议 (3项)                               [展开 ▼]   │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ 🟢 低优先级建议 (0项)                                           │
└────────────────────────────────────────────────────────────────┘

                    [全部应用]  [导出建议]  [关闭]
```

#### 3.3 定时任务实现

**使用node-cron每周一凌晨执行**：

```typescript
// lib/cron/weeklyOptimization.ts
import cron from 'node-cron';
import Database from 'better-sqlite3';

const db = new Database(process.env.DATABASE_PATH!);

// 每周一凌晨00:30执行
cron.schedule('30 0 * * 1', () => {
  console.log('🔄 开始生成每周优化建议...');
  generateWeeklyRecommendations();
});

function generateWeeklyRecommendations() {
  // 1. 查询所有用户
  const users = db.prepare('SELECT id FROM users WHERE is_active = 1').all() as any[];

  for (const user of users) {
    try {
      // 2. 为每个用户生成建议
      const recommendations = analyzeUserCampaigns(user.id);

      // 3. 保存到数据库
      saveRecommendations(user.id, recommendations);

      console.log(`✅ 用户 ${user.id} 的建议已生成 (${recommendations.length}条)`);
    } catch (error) {
      console.error(`❌ 用户 ${user.id} 建议生成失败:`, error);
    }
  }

  console.log('✅ 每周优化建议生成完成');
}

function analyzeUserCampaigns(userId: number): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // 查询过去7天的Campaign性能数据
  const campaigns = db.prepare(`
    SELECT
      c.id,
      c.campaign_id,
      c.campaign_name,
      c.offer_id,
      c.budget,
      o.offer_name,
      COALESCE(SUM(p.impressions), 0) as impressions,
      COALESCE(SUM(p.clicks), 0) as clicks,
      CASE
        WHEN SUM(p.impressions) > 0
        THEN CAST(SUM(p.clicks) AS REAL) / SUM(p.impressions)
        ELSE 0
      END as ctr,
      CASE
        WHEN SUM(p.clicks) > 0
        THEN CAST(SUM(p.cost) AS REAL) / SUM(p.clicks)
        ELSE 0
      END as cpc,
      COALESCE(SUM(p.cost), 0) as cost,
      COALESCE(SUM(p.conversions), 0) as conversions,
      CASE
        WHEN SUM(p.conversions) > 0
        THEN CAST(SUM(p.cost) AS REAL) / SUM(p.conversions)
        ELSE 0
      END as cpa,
      CASE
        WHEN SUM(p.cost) > 0
        THEN (SUM(p.conversion_value) - SUM(p.cost)) / SUM(p.cost)
        ELSE 0
      END as roi
    FROM campaigns c
    JOIN offers o ON c.offer_id = o.id
    LEFT JOIN campaign_performance p ON c.campaign_id = p.campaign_id
      AND p.date >= date('now', '-7 days')
    WHERE o.user_id = ? AND c.status = 'ENABLED'
    GROUP BY c.id
  `).all(userId) as any[];

  // 规则1: 识别低效Campaign（CTR < 行业均值50%）
  for (const campaign of campaigns) {
    if (campaign.impressions >= 1000 && campaign.ctr < 0.015) {
      recommendations.push({
        priority: 'high',
        type: 'pause',
        campaign_id: campaign.id,
        campaign_name: campaign.campaign_name,
        offer_name: campaign.offer_name,
        reason: `CTR ${(campaign.ctr * 100).toFixed(1)}%，低于行业均值60%，连续7天表现不佳`,
        action: '立即暂停此Campaign',
        expected_impact: `节省预算 $${campaign.budget}/天`,
        metrics: {
          ctr: campaign.ctr,
          cpc: campaign.cpc,
          cost: campaign.cost,
          conversions: campaign.conversions,
          cpa: campaign.cpa,
          roi: campaign.roi
        }
      });
    }
  }

  // 规则2: 识别高效Campaign（ROI > 200%）
  for (const campaign of campaigns) {
    if (campaign.roi > 2.0 && campaign.budget < 200) {
      recommendations.push({
        priority: 'high',
        type: 'increase_budget',
        campaign_id: campaign.id,
        campaign_name: campaign.campaign_name,
        offer_name: campaign.offer_name,
        reason: `CTR ${(campaign.ctr * 100).toFixed(1)}%，ROI ${(campaign.roi * 100).toFixed(0)}%，连续7天表现优异`,
        action: `增加每日预算40%，从$${campaign.budget}/天提升至$${(campaign.budget * 1.4).toFixed(0)}/天`,
        expected_impact: `转化量提升+35%`,
        metrics: {
          ctr: campaign.ctr,
          cpc: campaign.cpc,
          cost: campaign.cost,
          conversions: campaign.conversions,
          cpa: campaign.cpa,
          roi: campaign.roi
        }
      });
    }
  }

  // 规则3: 识别需要优化创意的Campaign（CTR略低于均值）
  for (const campaign of campaigns) {
    if (campaign.impressions >= 1000 && campaign.ctr >= 0.015 && campaign.ctr < 0.025) {
      recommendations.push({
        priority: 'medium',
        type: 'optimize_creative',
        campaign_id: campaign.id,
        campaign_name: campaign.campaign_name,
        offer_name: campaign.offer_name,
        reason: `CTR ${(campaign.ctr * 100).toFixed(1)}%，略低于行业均值`,
        action: '重新生成创意，强化USP和CTA',
        expected_impact: 'CTR预期提升20-30%',
        metrics: {
          ctr: campaign.ctr,
          cpc: campaign.cpc,
          cost: campaign.cost,
          conversions: campaign.conversions,
          cpa: campaign.cpa,
          roi: campaign.roi
        }
      });
    }
  }

  // 按优先级排序
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return recommendations;
}

function saveRecommendations(userId: number, recommendations: Recommendation[]) {
  // 删除上周的建议
  db.prepare(`
    DELETE FROM weekly_recommendations
    WHERE user_id = ? AND status = 'pending'
  `).run(userId);

  // 插入新建议
  const stmt = db.prepare(`
    INSERT INTO weekly_recommendations (
      user_id, priority, type, campaign_id, campaign_name, offer_name,
      reason, action, expected_impact, metrics, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
  `);

  for (const rec of recommendations) {
    stmt.run(
      userId,
      rec.priority,
      rec.type,
      rec.campaign_id,
      rec.campaign_name,
      rec.offer_name,
      rec.reason,
      rec.action,
      rec.expected_impact,
      JSON.stringify(rec.metrics)
    );
  }
}
```

#### 3.4 数据库Schema

**新增表：weekly_recommendations**

```sql
CREATE TABLE weekly_recommendations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,

  -- 建议内容
  priority TEXT NOT NULL,                -- high | medium | low
  type TEXT NOT NULL,                    -- pause | increase_budget | decrease_budget | optimize_creative
  campaign_id INTEGER NOT NULL,
  campaign_name TEXT NOT NULL,
  offer_name TEXT NOT NULL,

  reason TEXT NOT NULL,                  -- 建议原因
  action TEXT NOT NULL,                  -- 建议操作
  expected_impact TEXT NOT NULL,         -- 预期效果

  metrics TEXT NOT NULL,                 -- JSON: {ctr, cpc, cost, conversions, cpa, roi}

  -- 状态追踪
  status TEXT NOT NULL DEFAULT 'pending', -- pending | applied | ignored
  applied_at TEXT,                       -- 应用时间

  -- 元数据
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);

CREATE INDEX idx_weekly_rec_user_status ON weekly_recommendations(user_id, status);
CREATE INDEX idx_weekly_rec_created ON weekly_recommendations(created_at);
```

#### 3.5 前端API

**GET /api/recommendations/weekly**

```typescript
// app/api/recommendations/weekly/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth/middleware';

const db = new Database(process.env.DATABASE_PATH!);

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const user = (request as AuthenticatedRequest).user!;

  const recommendations = db.prepare(`
    SELECT * FROM weekly_recommendations
    WHERE user_id = ? AND status = 'pending'
    ORDER BY
      CASE priority
        WHEN 'high' THEN 0
        WHEN 'medium' THEN 1
        WHEN 'low' THEN 2
      END,
      created_at DESC
  `).all(user.userId);

  return NextResponse.json({ recommendations });
}
```

**POST /api/recommendations/:id/apply**

```typescript
// app/api/recommendations/[id]/apply/route.ts
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const user = (request as AuthenticatedRequest).user!;
  const recId = parseInt(params.id);

  // 1. 查询建议
  const rec = db.prepare(`
    SELECT * FROM weekly_recommendations
    WHERE id = ? AND user_id = ?
  `).get(recId, user.userId) as any;

  if (!rec) {
    return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 });
  }

  // 2. 根据类型执行操作
  try {
    if (rec.type === 'pause') {
      await pauseCampaign(rec.campaign_id);
    } else if (rec.type === 'increase_budget') {
      const metrics = JSON.parse(rec.metrics);
      const currentBudget = db.prepare('SELECT budget FROM campaigns WHERE id = ?')
        .get(rec.campaign_id) as any;
      const newBudget = currentBudget.budget * 1.4;
      await updateBudget(rec.campaign_id, newBudget);
    }
    // ... 其他类型

    // 3. 更新建议状态
    db.prepare(`
      UPDATE weekly_recommendations
      SET status = 'applied', applied_at = datetime('now')
      WHERE id = ?
    `).run(recId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function pauseCampaign(campaignId: number) {
  db.prepare(`
    UPDATE campaigns SET status = 'PAUSED' WHERE id = ?
  `).run(campaignId);

  // TODO: 调用Google Ads API暂停Campaign
}

async function updateBudget(campaignId: number, newBudget: number) {
  db.prepare(`
    UPDATE campaigns SET budget = ? WHERE id = ?
  `).run(newBudget, campaignId);

  // TODO: 调用Google Ads API更新预算
}
```

---

## 🚀 实施时间表

### 总体时间：**1周（5个工作日）**

| 阶段 | 工作内容 | 时间 | 负责人 |
|------|---------|------|--------|
| **阶段1** | Campaign对比视图 | 3天 | 前端 + 后端 |
| Day 1 | 后端API实现 + 规则引擎 | 1天 | 后端 |
| Day 2 | 前端UI实现 | 1天 | 前端 |
| Day 3 | 测试 + Bug修复 | 1天 | QA |
| **阶段2** | AI自动学习历史创意 | 30分钟 | 后端 |
| Day 3下午 | 优化AI Prompt逻辑 | 30分钟 | 后端 |
| **阶段3** | 每周优化清单 | 1.5天 | 后端 |
| Day 4 | 规则引擎 + 定时任务 | 1天 | 后端 |
| Day 5 | 前端UI + 测试 | 0.5天 | 前端 + QA |

---

## 📊 成功指标

### 用户采纳率
- **目标1**：60%用户使用Campaign对比视图（每周至少1次）
- **目标2**：AI生成的创意CTR提升10%（基于历史学习）
- **目标3**：50%用户应用每周优化建议（至少1条）

### 性能提升
- **CTR提升**：采纳建议的用户平均CTR提升15-25%
- **CPC降低**：通过暂停低效Campaign，平均CPC降低10-15%
- **ROI提升**：通过预算再分配，整体ROI提升20-30%

### 系统指标
- **建议准确率**：应用后效果符合预期的比例 > 70%
- **响应速度**：对比视图加载时间 < 2秒
- **数据新鲜度**：T+1数据同步成功率 > 95%

---

## 🔄 迭代优化计划

### 第一次迭代（1个月后）
**观察指标**：
- 用户使用频率
- 建议应用率
- 实际效果vs预期效果

**可能调整**：
- 优化规则权重（如CTR阈值从50%调整为60%）
- 增加新的建议类型（如关键词扩展）
- 调整优先级分类逻辑

### 第二次迭代（3个月后）
**基于数据决策**：
- 如果AI学习效果显著 → 考虑更多历史数据维度（ROI、转化率等）
- 如果用户频繁使用对比视图 → 考虑增加更多对比维度
- 如果建议应用率高 → 考虑半自动化（用户确认后自动执行）

### 第三次迭代（6个月后）
**考虑增加复杂度**（仅在KISS版本验证成功后）：
- 统计显著性检验（A/B测试更科学）
- 实时数据追踪（6小时级同步）
- 简单的ML模型（预测CTR）

**关键原则**：只有当用户确实需要时，才增加复杂度

---

## 🎯 阶段4：ROI驱动的智能预算分配（1天）

### 4.1 当前问题

**基础版本的局限**：
- ❌ 固定增加40%，未考虑ROI差异
- ❌ 无总预算约束，可能超支
- ❌ 未考虑边际效应（预算过高→ROI下降）
- ❌ 未考虑跨Campaign的预算再分配

### 4.2 KISS优化方案

**ROI驱动的智能分配算法**（保持简单）：

```typescript
interface BudgetAllocation {
  campaignId: number;
  currentBudget: number;
  suggestedBudget: number;
  increase: number;
  reason: string;
  expectedROI: number;
}

// 主函数：优化预算分配
function optimizeBudgetAllocation(
  campaigns: Campaign[],
  totalBudget: number  // 用户设定的总预算上限
): BudgetAllocation[] {
  // 1. 计算每个Campaign的预算效率
  const efficiency = campaigns
    .filter(c => c.status === 'ENABLED')
    .map(c => ({
      campaign: c,
      efficiency: c.roi / c.budget,  // ROI per dollar
      current: c.budget,
      max: Math.min(c.budget * 3, 500),  // 最多扩大3倍，但不超过$500
      min: c.budget * 0.5  // 最少保留50%
    }));

  // 2. 按效率排序（高ROI优先）
  efficiency.sort((a, b) => b.efficiency - a.efficiency);

  // 3. 计算当前总预算
  const currentTotal = efficiency.reduce((sum, e) => sum + e.current, 0);

  // 4. 计算可分配的额外预算
  let remaining = totalBudget - currentTotal;
  const allocations: BudgetAllocation[] = [];

  // 5. 贪心算法分配额外预算
  for (const item of efficiency) {
    if (remaining <= 0) {
      // 预算用尽，保持当前预算
      allocations.push({
        campaignId: item.campaign.id,
        currentBudget: item.current,
        suggestedBudget: item.current,
        increase: 0,
        reason: '总预算已达上限',
        expectedROI: item.campaign.roi
      });
      continue;
    }

    // 计算该Campaign的最优增量
    const maxIncrease = item.max - item.current;
    const safeIncrease = Math.min(
      maxIncrease,
      remaining,
      item.current * 0.5  // 单次最多增加50%
    );

    if (item.campaign.roi > 1.5 && safeIncrease > 0) {
      // ROI > 150%，值得增加预算
      allocations.push({
        campaignId: item.campaign.id,
        currentBudget: item.current,
        suggestedBudget: item.current + safeIncrease,
        increase: safeIncrease,
        reason: `ROI ${(item.campaign.roi * 100).toFixed(0)}%，预算效率${item.efficiency.toFixed(2)}`,
        expectedROI: item.campaign.roi * 0.95  // 预期ROI略有下降
      });
      remaining -= safeIncrease;
    } else {
      // ROI较低，保持或减少预算
      allocations.push({
        campaignId: item.campaign.id,
        currentBudget: item.current,
        suggestedBudget: item.current,
        increase: 0,
        reason: `ROI ${(item.campaign.roi * 100).toFixed(0)}%，暂不增加预算`,
        expectedROI: item.campaign.roi
      });
    }
  }

  // 6. 如果还有剩余预算，分配给效率最高的Campaign
  if (remaining > 10) {
    const topEfficient = allocations[0];
    if (topEfficient && topEfficient.suggestedBudget < efficiency[0].max) {
      const additionalIncrease = Math.min(remaining, efficiency[0].max - topEfficient.suggestedBudget);
      topEfficient.suggestedBudget += additionalIncrease;
      topEfficient.increase += additionalIncrease;
      topEfficient.reason += ` + 剩余预算${additionalIncrease.toFixed(0)}`;
    }
  }

  return allocations;
}

// 辅助函数：考虑边际效应的ROI预测
function estimateROIWithBudgetIncrease(
  campaign: Campaign,
  budgetIncrease: number
): number {
  // 简单的边际效应模型：预算增加后，ROI略有下降
  const increaseRate = budgetIncrease / campaign.budget;

  if (increaseRate < 0.3) {
    return campaign.roi * 0.98;  // 预算增加<30%，ROI下降2%
  } else if (increaseRate < 0.5) {
    return campaign.roi * 0.95;  // 预算增加30-50%，ROI下降5%
  } else {
    return campaign.roi * 0.90;  // 预算增加>50%，ROI下降10%
  }
}
```

### 4.3 集成到每周优化建议

**更新规则2：智能预算增加建议**：

```typescript
// 在每周优化中生成预算分配建议
function generateBudgetRecommendations(userId: number) {
  // 1. 获取用户的所有活跃Campaign
  const campaigns = getActiveCampaigns(userId);

  // 2. 获取用户设定的总预算（如果有）
  const userBudgetLimit = getUserBudgetLimit(userId) || 10000;  // 默认$10000

  // 3. 计算最优预算分配
  const allocations = optimizeBudgetAllocation(campaigns, userBudgetLimit);

  // 4. 生成建议
  const recommendations: Recommendation[] = [];

  for (const alloc of allocations) {
    if (alloc.increase > 10) {
      // 建议增加预算
      recommendations.push({
        priority: 'high',
        type: 'increase_budget',
        campaign_id: alloc.campaignId,
        reason: `${alloc.reason}`,
        action: `预算 $${alloc.currentBudget}/天 → $${alloc.suggestedBudget.toFixed(0)}/天 (+${alloc.increase.toFixed(0)})`,
        expected_impact: `预期ROI ${(alloc.expectedROI * 100).toFixed(0)}%，转化量提升${((alloc.increase / alloc.currentBudget) * 0.8 * 100).toFixed(0)}%`
      });
    } else if (alloc.increase < -10) {
      // 建议减少预算
      recommendations.push({
        priority: 'medium',
        type: 'decrease_budget',
        campaign_id: alloc.campaignId,
        reason: `ROI较低，建议减少预算重新分配`,
        action: `预算 $${alloc.currentBudget}/天 → $${alloc.suggestedBudget.toFixed(0)}/天`,
        expected_impact: `节省预算 $${Math.abs(alloc.increase).toFixed(0)}/天`
      });
    }
  }

  return recommendations;
}
```

### 4.4 预期效果

| 维度 | 基础版本 | 智能分配版本 |
|------|---------|-------------|
| 分配逻辑 | 固定增加40% | **ROI效率排序** |
| 总预算控制 | ❌ 无 | **✅ 上限约束** |
| 边际效应 | ❌ 未考虑 | **✅ ROI衰减模型** |
| 跨Campaign优化 | ❌ 单独评估 | **✅ 全局最优** |
| 预算利用率 | 70% | **90%+** |
| 总ROI提升 | 20% | **30-35%** |

---

## 🚀 阶段5：扩展优化规则（规则5-8）（2天）

### 5.1 新增规则总览

| 规则 | 类型 | 优先级 | 数据源 | 实施时间 |
|------|------|--------|--------|---------|
| 规则5 | 关键词优化 | 中 | 搜索词报告 | 0.5天 |
| 规则6 | 出价优化 | 中 | 小时级转化数据 | 0.5天 |
| 规则7 | 投放时段优化 | 低 | 小时级CTR数据 | 0.5天 |
| 规则8 | 设备优化 | 中 | 设备维度数据 | 0.5天 |

### 5.2 规则5：关键词优化

**目标**：从搜索词报告中发现高潜力关键词，扩大相关流量

```
触发条件：
  AND 搜索词报告中存在未添加的高CTR搜索词
  AND 该搜索词展示量 >= 100
  AND 该搜索词CTR > Campaign平均CTR * 1.2

优先级：中
建议：添加关键词 "${keyword}"（${matchType}匹配）
预期影响：扩大相关流量10-15%

实现逻辑：
```typescript
function analyzeSearchTerms(campaignId: number): Recommendation[] {
  const searchTerms = db.prepare(`
    SELECT
      search_term,
      SUM(impressions) as total_impressions,
      SUM(clicks) as total_clicks,
      CAST(SUM(clicks) AS REAL) / SUM(impressions) as ctr
    FROM search_term_reports
    WHERE campaign_id = ?
      AND date >= date('now', '-7 days')
    GROUP BY search_term
    HAVING total_impressions >= 100
    ORDER BY ctr DESC
    LIMIT 20
  `).all(campaignId) as any[];

  const campaign = getCampaign(campaignId);
  const existingKeywords = getExistingKeywords(campaignId);

  const recommendations: Recommendation[] = [];

  for (const term of searchTerms) {
    // 检查是否已存在
    if (existingKeywords.includes(term.search_term)) continue;

    // 检查CTR是否高于平均值
    if (term.ctr > campaign.ctr * 1.2) {
      recommendations.push({
        priority: 'medium',
        type: 'add_keyword',
        campaign_id: campaignId,
        reason: `搜索词"${term.search_term}"CTR ${(term.ctr * 100).toFixed(2)}%，高于平均${((term.ctr / campaign.ctr - 1) * 100).toFixed(0)}%`,
        action: `添加关键词"${term.search_term}"（短语匹配）`,
        expected_impact: `预计扩大相关流量10-15%`
      });
    }
  }

  return recommendations.slice(0, 3);  // 最多3个关键词建议
}
```

### 5.3 规则6：分时段出价优化

**目标**：在转化高峰时段提高出价，提升转化量

```
触发条件：
  AND 存在明显转化高峰时段（某3小时转化率 > 平均值 * 1.5）
  AND 当前未设置分时段出价
  AND Campaign转化量 >= 20（数据充足）

优先级：中
建议：在高峰时段（${hours}）提高出价15-20%
预期影响：转化量提升15-20%

实现逻辑：
```typescript
function analyzeHourlyPerformance(campaignId: number): Recommendation | null {
  const hourlyData = db.prepare(`
    SELECT
      hour_of_day,
      SUM(impressions) as impressions,
      SUM(clicks) as clicks,
      SUM(conversions) as conversions,
      CASE
        WHEN SUM(clicks) > 0
        THEN CAST(SUM(conversions) AS REAL) / SUM(clicks)
        ELSE 0
      END as conversion_rate
    FROM campaign_performance_hourly
    WHERE campaign_id = ?
      AND date >= date('now', '-14 days')
    GROUP BY hour_of_day
    ORDER BY conversion_rate DESC
  `).all(campaignId) as any[];

  if (hourlyData.length === 0) return null;

  // 计算平均转化率
  const avgConversionRate = hourlyData.reduce((sum, h) => sum + h.conversion_rate, 0) / hourlyData.length;

  // 找出高峰时段（转化率 > 平均值 * 1.5）
  const peakHours = hourlyData
    .filter(h => h.conversion_rate > avgConversionRate * 1.5 && h.conversions >= 5)
    .map(h => h.hour_of_day);

  if (peakHours.length >= 2) {
    return {
      priority: 'medium',
      type: 'adjust_schedule',
      campaign_id: campaignId,
      reason: `发现转化高峰时段（${peakHours.join(', ')}点），转化率高出平均50%+`,
      action: `在高峰时段（${peakHours.join(', ')}:00）提高出价18%`,
      expected_impact: `预计转化量提升15-20%`
    };
  }

  return null;
}
```

### 5.4 规则7：投放时段优化

**目标**：减少低效时段投放，节省预算

```
触发条件：
  AND 存在明显低效时段（某时段CTR < 平均值 * 0.5）
  AND 该时段花费 > 总花费的10%
  AND 连续7天低效

优先级：低
建议：减少低效时段投放（${hours}），或暂停投放
预期影响：节省预算15%，保持转化量

实现逻辑：
```typescript
function analyzeLowPerformanceHours(campaignId: number): Recommendation | null {
  const hourlyData = db.prepare(`
    SELECT
      hour_of_day,
      SUM(cost) as cost,
      CAST(SUM(clicks) AS REAL) / NULLIF(SUM(impressions), 0) as ctr
    FROM campaign_performance_hourly
    WHERE campaign_id = ?
      AND date >= date('now', '-7 days')
    GROUP BY hour_of_day
  `).all(campaignId) as any[];

  const totalCost = hourlyData.reduce((sum, h) => sum + h.cost, 0);
  const avgCTR = hourlyData.reduce((sum, h) => sum + (h.ctr || 0), 0) / hourlyData.length;

  // 找出低效时段
  const lowEffHours = hourlyData.filter(h =>
    h.ctr < avgCTR * 0.5 && (h.cost / totalCost) > 0.1
  );

  if (lowEffHours.length > 0) {
    const hours = lowEffHours.map(h => h.hour_of_day).join(', ');
    const savedCost = lowEffHours.reduce((sum, h) => sum + h.cost, 0);

    return {
      priority: 'low',
      type: 'adjust_schedule',
      campaign_id: campaignId,
      reason: `时段${hours}点CTR低于平均50%，但占总花费${((savedCost / totalCost) * 100).toFixed(0)}%`,
      action: `减少${hours}点的投放，或出价降低30%`,
      expected_impact: `节省预算 $${(savedCost * 0.7 / 7).toFixed(0)}/天`
    };
  }

  return null;
}
```

### 5.5 规则8：设备优化

**目标**：针对设备差异调整策略

```
触发条件：
  AND 移动/桌面CTR差异 > 50%
  AND 两设备均有充足数据（展示量 >= 500）
  AND 未设置设备出价调整

优先级：中
建议：减少低效设备的出价，或创建设备定向Campaign
预期影响：CTR提升25%，或成本降低20%

实现逻辑：
```typescript
function analyzeDevicePerformance(campaignId: number): Recommendation | null {
  const deviceData = db.prepare(`
    SELECT
      device,
      SUM(impressions) as impressions,
      SUM(clicks) as clicks,
      SUM(cost) as cost,
      CAST(SUM(clicks) AS REAL) / NULLIF(SUM(impressions), 0) as ctr
    FROM campaign_performance_device
    WHERE campaign_id = ?
      AND date >= date('now', '-7 days')
    GROUP BY device
  `).all(campaignId) as any[];

  if (deviceData.length < 2) return null;

  const mobile = deviceData.find(d => d.device === 'MOBILE');
  const desktop = deviceData.find(d => d.device === 'DESKTOP');

  if (!mobile || !desktop) return null;
  if (mobile.impressions < 500 || desktop.impressions < 500) return null;

  const ctrRatio = mobile.ctr / desktop.ctr;

  if (ctrRatio < 0.5) {
    // 移动端CTR显著低于桌面端
    return {
      priority: 'medium',
      type: 'device_optimization',
      campaign_id: campaignId,
      reason: `移动端CTR ${(mobile.ctr * 100).toFixed(2)}%，仅为桌面端${((ctrRatio) * 100).toFixed(0)}%`,
      action: `移动端出价降低40%，或创建仅桌面端Campaign`,
      expected_impact: `CTR提升至${(desktop.ctr * 100).toFixed(2)}%或成本降低20%`
    };
  } else if (ctrRatio > 2.0) {
    // 移动端CTR显著高于桌面端
    return {
      priority: 'medium',
      type: 'device_optimization',
      campaign_id: campaignId,
      reason: `移动端CTR ${(mobile.ctr * 100).toFixed(2)}%，是桌面端${ctrRatio.toFixed(1)}倍`,
      action: `移动端出价提高30%，或创建移动端专属Campaign`,
      expected_impact: `转化量提升25%`
    };
  }

  return null;
}
```

### 5.6 规则集成总览

**更新后的完整规则引擎**：

```typescript
function generateAllRecommendations(userId: number): Recommendation[] {
  const recommendations: Recommendation[] = [];

  const campaigns = getActiveCampaigns(userId);

  for (const campaign of campaigns) {
    // 基础规则1-4（保持不变）
    recommendations.push(...applyBasicRules(campaign));

    // 新增规则5-8
    const keywordRec = analyzeSearchTerms(campaign.id);
    if (keywordRec) recommendations.push(...keywordRec);

    const hourlyRec = analyzeHourlyPerformance(campaign.id);
    if (hourlyRec) recommendations.push(hourlyRec);

    const scheduleRec = analyzeLowPerformanceHours(campaign.id);
    if (scheduleRec) recommendations.push(scheduleRec);

    const deviceRec = analyzeDevicePerformance(campaign.id);
    if (deviceRec) recommendations.push(deviceRec);
  }

  // 按优先级排序
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return recommendations;
}
```

---

## 📊 阶段6：性能基准与A/B测试框架（1天）

### 6.1 行业基准数据

**Google Ads各行业平均指标**（2024年数据）：

| 行业 | 平均CTR | 平均CPC | 平均转化率 |
|------|---------|---------|------------|
| 电商/零售 | 2.69% | $1.16 | 2.81% |
| 服装/时尚 | 2.01% | $1.40 | 2.77% |
| 教育培训 | 3.78% | $2.40 | 3.39% |
| 旅游酒店 | 4.68% | $1.53 | 3.55% |
| B2B服务 | 2.41% | $3.33 | 2.23% |
| 健康/美容 | 1.94% | $2.48 | 2.65% |

**动态基准查询**：

```typescript
function getIndustryBenchmark(industry: string): Benchmark {
  const benchmarks: Record<string, Benchmark> = {
    'ecommerce': { ctr: 0.0269, cpc: 1.16, conversionRate: 0.0281 },
    'fashion': { ctr: 0.0201, cpc: 1.40, conversionRate: 0.0277 },
    'education': { ctr: 0.0378, cpc: 2.40, conversionRate: 0.0339 },
    // ... 其他行业
  };

  return benchmarks[industry] || benchmarks['ecommerce'];  // 默认电商
}

// 用户设置行业
function setUserIndustry(userId: number, industry: string) {
  db.prepare(`
    UPDATE users SET industry = ? WHERE id = ?
  `).run(industry, userId);
}

// 在优化建议中使用行业基准
function generateRecommendationsWithBenchmark(campaign: Campaign) {
  const user = getUser(campaign.userId);
  const benchmark = getIndustryBenchmark(user.industry);

  if (campaign.ctr < benchmark.ctr * 0.5) {
    return {
      priority: 'high',
      type: 'pause',
      reason: `CTR ${(campaign.ctr * 100).toFixed(2)}%，远低于${user.industry}行业均值${(benchmark.ctr * 100).toFixed(2)}%`,
      action: '立即暂停或重新生成创意'
    };
  }
}
```

### 6.2 用户历史基准

**个人最佳记录追踪**：

```typescript
interface UserBenchmark {
  bestCTR: number;
  bestROI: number;
  bestCPA: number;
  avgCTR: number;
  avgROI: number;
  campaignCount: number;
}

function getUserHistoricalBenchmark(userId: number): UserBenchmark {
  const stats = db.prepare(`
    SELECT
      MAX(ctr) as best_ctr,
      MAX(roi) as best_roi,
      MIN(cpa) as best_cpa,
      AVG(ctr) as avg_ctr,
      AVG(roi) as avg_roi,
      COUNT(*) as campaign_count
    FROM campaigns
    WHERE user_id = ?
      AND impressions >= 1000
      AND status = 'ENABLED'
  `).get(userId) as any;

  return {
    bestCTR: stats.best_ctr || 0,
    bestROI: stats.best_roi || 0,
    bestCPA: stats.best_cpa || 999,
    avgCTR: stats.avg_ctr || 0,
    avgROI: stats.avg_roi || 0,
    campaignCount: stats.campaign_count || 0
  };
}

// 在Dashboard显示
function renderBenchmarkCard(benchmark: UserBenchmark) {
  return `
    您的历史最佳表现：
    - 最高CTR: ${(benchmark.bestCTR * 100).toFixed(2)}%
    - 最高ROI: ${(benchmark.bestROI * 100).toFixed(0)}%
    - 最低CPA: $${benchmark.bestCPA.toFixed(2)}
    - 平均CTR: ${(benchmark.avgCTR * 100).toFixed(2)}%
  `;
}
```

### 6.3 A/B测试框架（KISS版）

**何时创建变体测试**：

```typescript
function suggestABTest(campaign: Campaign): ABTestSuggestion | null {
  // 规则1: Campaign运行时间 >= 7天
  const runningDays = calculateRunningDays(campaign.created_at);
  if (runningDays < 7) return null;

  // 规则2: 样本量充足（展示量 >= 5000）
  if (campaign.impressions < 5000) return null;

  // 规则3: CTR不高不低（2-4%之间）
  if (campaign.ctr < 0.02 || campaign.ctr > 0.04) return null;

  return {
    reason: `Campaign表现稳定（CTR ${(campaign.ctr * 100).toFixed(2)}%），建议创建变体测试进一步优化`,
    testVariables: [
      '测试不同的标题风格（品牌导向 vs 功能导向）',
      '测试不同的CTA（"立即购买" vs "了解更多"）',
      '测试是否添加价格信息'
    ],
    expectedUplift: '15-25%',
    testDuration: '7-14天'
  };
}
```

**A/B测试结果评估**：

```typescript
function evaluateABTest(variantA: Campaign, variantB: Campaign): TestResult {
  // 1. 检查样本量是否充足
  if (variantA.impressions < 1000 || variantB.impressions < 1000) {
    return {
      status: 'insufficient_data',
      message: '样本量不足，建议继续运行至展示量达到1000+'
    };
  }

  // 2. 简单的差异检验（不使用复杂统计）
  const ctrDiff = Math.abs(variantA.ctr - variantB.ctr);
  const avgCTR = (variantA.ctr + variantB.ctr) / 2;
  const diffPercentage = ctrDiff / avgCTR;

  // 3. 判断显著性（简单规则）
  if (diffPercentage > 0.2 && Math.max(variantA.impressions, variantB.impressions) > 3000) {
    // 差异 > 20%，且样本量 > 3000，认为显著
    const winner = variantA.ctr > variantB.ctr ? variantA : variantB;
    const loser = variantA.ctr > variantB.ctr ? variantB : variantA;

    return {
      status: 'significant_difference',
      winner: winner.name,
      winnerCTR: winner.ctr,
      loserCTR: loser.ctr,
      uplift: ((winner.ctr - loser.ctr) / loser.ctr * 100).toFixed(1) + '%',
      suggestion: `建议暂停${loser.name}，集中预算到${winner.name}`,
      confidence: 'medium'
    };
  } else if (diffPercentage < 0.1) {
    return {
      status: 'no_clear_winner',
      message: `两个变体表现接近（差异${(diffPercentage * 100).toFixed(1)}%），建议继续运行3-5天`,
      suggestion: '或尝试更大胆的变化（如完全不同的创意风格）'
    };
  } else {
    return {
      status: 'trending',
      message: `${variantA.ctr > variantB.ctr ? variantA.name : variantB.name}略有领先，但差异不显著`,
      suggestion: '建议继续观察，样本量达到5000+后再做决策'
    };
  }
}
```

### 6.4 优化效果追踪

**建议应用前后对比**：

```typescript
interface RecommendationEffect {
  recommendationId: number;
  appliedAt: string;
  before: {
    ctr: number;
    cpc: number;
    roi: number;
  };
  after: {
    ctr: number;
    cpc: number;
    roi: number;
  };
  improvement: {
    ctrChange: string;
    cpcChange: string;
    roiChange: string;
  };
  verdict: 'positive' | 'negative' | 'neutral';
}

function trackRecommendationEffect(recommendationId: number): RecommendationEffect {
  const rec = getRecommendation(recommendationId);
  const campaign = getCampaign(rec.campaign_id);

  // 获取应用前7天的平均指标
  const before = getMetrics(rec.campaign_id, rec.applied_at, -7);

  // 获取应用后7天的平均指标
  const after = getMetrics(rec.campaign_id, rec.applied_at, 7);

  const improvement = {
    ctrChange: `${((after.ctr - before.ctr) / before.ctr * 100).toFixed(1)}%`,
    cpcChange: `${((after.cpc - before.cpc) / before.cpc * 100).toFixed(1)}%`,
    roiChange: `${((after.roi - before.roi) / before.roi * 100).toFixed(1)}%`
  };

  // 判断效果
  let verdict: 'positive' | 'negative' | 'neutral';
  if (after.ctr > before.ctr * 1.1 || after.roi > before.roi * 1.1) {
    verdict = 'positive';
  } else if (after.ctr < before.ctr * 0.9 || after.roi < before.roi * 0.9) {
    verdict = 'negative';
  } else {
    verdict = 'neutral';
  }

  return {
    recommendationId,
    appliedAt: rec.applied_at,
    before,
    after,
    improvement,
    verdict
  };
}

// Dashboard展示
function renderEffectTrackingCard() {
  const effects = getAllRecommendationEffects(userId);

  const positive = effects.filter(e => e.verdict === 'positive').length;
  const total = effects.length;
  const successRate = total > 0 ? (positive / total * 100).toFixed(0) : 0;

  return `
    优化建议效果统计：
    - 总应用建议: ${total}条
    - 有效建议: ${positive}条 (${successRate}%)
    - 平均CTR提升: ${calculateAvgCTRImprovement(effects)}%
    - 平均ROI提升: ${calculateAvgROIImprovement(effects)}%
  `;
}
```

---

## 🚀 性能优化设计

### 1. API分页（必需）

**设计原则**：所有列表查询API必须支持分页，避免大数据量查询

**必须分页的API**：
- `GET /api/campaign_performance` - 性能数据列表（可能有数千条记录）
- `GET /api/weekly_recommendations` - 优化建议列表
- `GET /api/search_term_reports` - 搜索词报告（可能有数百条）

**标准分页参数**：
```typescript
interface PaginationParams {
  page?: number;      // 页码（从1开始），默认1
  limit?: number;     // 每页数量，默认20，最大100
}

// 示例：GET /api/campaign_performance?page=1&limit=20&campaignId=123
```

### 2. 数据库索引优化

**核心索引**（确保查询性能）：
```sql
-- campaign_performance表（性能数据查询）
CREATE INDEX idx_performance_campaign_date
  ON campaign_performance(campaign_id, date DESC);
CREATE INDEX idx_performance_user_date
  ON campaign_performance(user_id, date DESC);

-- weekly_recommendations表（建议列表查询）
CREATE INDEX idx_recommendations_user_status
  ON weekly_recommendations(user_id, status, created_at DESC);
CREATE INDEX idx_recommendations_campaign
  ON weekly_recommendations(campaign_id, created_at DESC);

-- search_term_reports表（搜索词报告）
CREATE INDEX idx_search_terms_campaign_ctr
  ON search_term_reports(campaign_id, ctr DESC);
CREATE INDEX idx_search_terms_user_is_keyword
  ON search_term_reports(user_id, is_keyword);
```

### 3. 聚合查询替代专用表

**高CTR创意分析**（AI学习数据源）：
```sql
-- MVP阶段使用SQL聚合查询获取Top创意（需要时执行）
-- ❌ 不创建top_performing_creatives专用表
SELECT
  c.id AS creative_id,
  c.headline,
  c.description,
  AVG(cp.ctr) AS avg_ctr,
  SUM(cp.impressions) AS total_impressions,
  SUM(cp.clicks) AS total_clicks
FROM creatives c
JOIN campaigns cam ON c.campaign_id = cam.id
JOIN campaign_performance cp ON cp.campaign_id = cam.id
WHERE c.user_id = ?
  AND cp.impressions >= 1000
  AND cp.ctr >= 3.0
  AND cp.date >= date('now', '-30 days')
GROUP BY c.id
ORDER BY avg_ctr DESC
LIMIT 10;
```

**优势**：
- 避免定时任务维护top_performing_creatives表
- 数据实时准确（无同步延迟）
- 减少数据库表数量（简化架构）

### 4. 查询性能预期

⚠️ **重要**：以下性能目标需通过实际压测验证（见PERFORMANCE_TEST.md）

**性能目标**（待验证）：
- 单个Campaign性能数据查询 < 50ms
- 聚合Top10创意查询 < 100ms（7天数据）
- 分页列表API（20条/页）< 100ms
- 每周建议生成（单个用户）< 500ms

**测试场景**：
- 1000个Campaigns + 每个Campaign 90天性能数据
- 10用户并发查询性能数据
- 100条搜索词报告分页查询

---

## ⚠️ 风险与应对

### 风险1：规则过于简单，建议不准确
**应对**：
- 设置最小样本量阈值（展示量>1000）
- 提供详细的数据支撑，让用户自行判断
- 追踪应用效果，持续优化规则

### 风险2：用户不理解建议原因
**应对**：
- 提供详细的问题分析和数据对比
- 使用可视化图表（趋势线、对比柱状图）
- 提供"为什么"的解释（行业基准对比）

### 风险3：自动建议与用户策略冲突
**应对**：
- 所有操作需用户确认，不自动执行
- 提供"忽略"选项，用户可选择不采纳
- 支持撤销操作（暂停后可重新启用）

---

## 📚 附录：规则引擎详细逻辑

### 规则1：暂停低效Campaign
```
触发条件：
  AND 展示量 >= 1000 (数据充足)
  AND CTR < 行业均值 * 0.5 (显著低于均值)
  AND 连续7天CTR无改善趋势

优先级：高
建议：立即暂停
预期影响：节省预算
```

### 规则2：增加高效Campaign预算
```
触发条件：
  AND ROI > 200% (盈利显著)
  AND 当前预算 < $200/天 (有扩展空间)
  AND CTR > 行业均值 * 1.2 (表现优异)

优先级：高
建议：增加预算30-40%
预期影响：转化量提升25-35%
```

### 规则3：优化创意
```
触发条件：
  AND 展示量 >= 1000
  AND CTR >= 行业均值 * 0.5
  AND CTR < 行业均值 * 0.8

优先级：中
建议：重新生成创意
预期影响：CTR提升20-30%
```

### 规则4：降低CPC
```
触发条件：
  AND CPC > 同Offer其他变体平均值 * 1.3
  AND 转化率正常

优先级：中
建议：降低出价10-15%
预期影响：CPC降低，保持转化量
```

---

**文档版本**：v1.0 KISS Edition
**最后更新**：2025-01-17
**维护者**：AutoAds产品团队
