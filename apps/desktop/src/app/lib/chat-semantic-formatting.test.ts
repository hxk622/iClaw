import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isChatSemanticDirectiveClose,
  matchChatSemanticLead,
  parseChatSemanticDirective,
  resolveChatSemanticDefaultTitle,
} from './chat-semantic-formatting.ts';

test('parseChatSemanticDirective parses explicit semantic fences', () => {
  assert.deepEqual(parseChatSemanticDirective(':::insight 核心架构设计原则'), {
    tone: 'insight',
    title: '核心架构设计原则',
  });
  assert.deepEqual(parseChatSemanticDirective(':::warning'), {
    tone: 'warning',
    title: null,
  });
  assert.equal(parseChatSemanticDirective('::warning'), null);
});

test('isChatSemanticDirectiveClose detects fence close marker', () => {
  assert.equal(isChatSemanticDirectiveClose(':::'), true);
  assert.equal(isChatSemanticDirectiveClose(' ::: '), true);
  assert.equal(isChatSemanticDirectiveClose(':::insight'), false);
});

test('matchChatSemanticLead matches standalone semantic headings', () => {
  assert.deepEqual(matchChatSemanticLead('关键结论：'), {
    tone: 'insight',
    title: '关键结论',
    label: '关键结论',
    matchedPrefix: '关键结论：',
    remainder: '',
    standalone: true,
  });
  assert.deepEqual(matchChatSemanticLead('建议操作'), {
    tone: 'action',
    title: '建议操作',
    label: '建议操作',
    matchedPrefix: '建议操作',
    remainder: '',
    standalone: true,
  });
});

test('matchChatSemanticLead matches semantic prefixes with body content', () => {
  assert.deepEqual(matchChatSemanticLead('注意：避免缓存雪崩。'), {
    tone: 'warning',
    title: '注意',
    label: '注意',
    matchedPrefix: '注意：',
    remainder: '避免缓存雪崩。',
    standalone: false,
  });
  assert.deepEqual(matchChatSemanticLead('补充资料：建议同时配置监控告警。'), {
    tone: 'note',
    title: '补充资料',
    label: '补充资料',
    matchedPrefix: '补充资料：',
    remainder: '建议同时配置监控告警。',
    standalone: false,
  });
  assert.equal(matchChatSemanticLead('建议我们今天上线'), null);
});

test('resolveChatSemanticDefaultTitle returns stable fallbacks', () => {
  assert.equal(resolveChatSemanticDefaultTitle('insight'), '关键结论');
  assert.equal(resolveChatSemanticDefaultTitle('danger'), '风险提示');
});
