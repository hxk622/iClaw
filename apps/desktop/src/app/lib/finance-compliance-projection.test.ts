import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveConversationFinanceDisclaimer, resolveNotificationFinanceDisclaimer } from './finance-compliance-projection.ts';

test('resolveConversationFinanceDisclaimer uses explicit snapshot for chat turn', () => {
  const result = resolveConversationFinanceDisclaimer({
    source: 'chat',
    financeCompliance: {
      domain: 'finance',
      inputClassification: 'research_request',
      outputClassification: 'investment_view',
      riskLevel: 'medium',
      showDisclaimer: true,
      disclaimerText: '对话显式 disclaimer',
      requiresRiskSection: false,
      blocked: false,
      degraded: false,
      reasons: ['explicit'],
      usedCapabilities: [],
      usedModel: null,
      sourceAttributionRequired: false,
      timestampRequired: false,
    },
    title: '标题',
    prompt: '分析一下宁德时代',
    summary: '给出研究摘要',
    model: null,
  });

  assert.equal(result, '对话显式 disclaimer');
});

test('resolveNotificationFinanceDisclaimer falls back to finance result text when explicit snapshot missing', () => {
  const result = resolveNotificationFinanceDisclaimer({
    source: 'cron',
    title: '定时任务已完成',
    text: '已生成金融研究结果，请打开查看详情。',
    metadata: {
      taskName: '晨报',
      model: 'bailian/qwen3.5-plus',
      result: '建议关注高股息方向并控制仓位。',
      financeCompliance: null,
    },
  });

  assert.ok(result);
  assert.match(result || '', /谨慎投资/);
});
