import test from 'node:test';
import assert from 'node:assert/strict';

import { buildConversationProjectionsCore } from './chat-conversation-projection-core.ts';

test('conversation projection prefers active session snapshot for summary consistency', () => {
  const projections = buildConversationProjectionsCore({
    conversations: [
      {
        id: 'conv-a-share',
        title: 'A股价值投资专家',
        summary: '旧摘要',
        activeSessionKey: 'agent:main:stock-600001',
        updatedAt: '2026-04-15T10:00:00.000Z',
      },
    ],
    turns: [
      {
        conversationId: 'conv-a-share',
        sessionKey: 'agent:main:old-session',
        title: '旧标题',
        summary: '早上好！新的一天开始了，有什么我可以帮您',
        prompt: '你好',
        source: 'chat',
      },
    ],
    getSnapshot: () => ({
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: '帮我分析智能股份 600001 的长期价值。' }],
          timestamp: Date.now() - 1000,
        },
        {
          role: 'assistant',
          content: [{ type: 'text', text: '智能股份护城河一般，但当前估值具备一定观察价值。' }],
          timestamp: Date.now(),
        },
      ],
    }),
  });

  assert.equal(projections[0]?.displayTitle, 'A股价值投资专家');
  assert.equal(projections[0]?.displaySummary, '智能股份护城河一般，但当前估值具备一定观察价值。');
  assert.equal(projections[0]?.summarySource, 'snapshot-assistant');
});

test('conversation projection surfaces a dedicated summary for credit-blocked failed turns', () => {
  const projections = buildConversationProjectionsCore({
    conversations: [
      {
        id: 'conv-credit-blocked',
        title: '沪深300ETF',
        summary: null,
        activeSessionKey: 'agent:main:chat-credit',
        updatedAt: '2026-04-20T10:00:00.000Z',
      },
    ],
    turns: [
      {
        conversationId: 'conv-credit-blocked',
        sessionKey: 'agent:main:chat-credit',
        title: '沪深300ETF',
        summary: '现在是否建议买入沪深300ETF？如果可以，请告诉我应该怎么加仓',
        prompt: '现在是否建议买入沪深300ETF？如果可以，请告诉我应该怎么加仓',
        source: 'chat',
        status: 'failed',
        lastError: '当前积分余额已为 -74，账号已暂停发送。新积分将在次日发放。请先前往充值中心充值后再继续。',
      },
    ],
    getSnapshot: () => ({
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: '现在是否建议买入沪深300ETF？如果可以，请告诉我应该怎么加仓' }],
          timestamp: Date.now(),
        },
      ],
    }),
  });

  assert.equal(
    projections[0]?.displaySummary,
    '积分校验未通过：当前积分余额已为 -74，账号已暂停发送。新积分将在次日发放。请先前往充值中心充值后再继续。',
  );
  assert.equal(projections[0]?.summarySource, 'turn');
});
