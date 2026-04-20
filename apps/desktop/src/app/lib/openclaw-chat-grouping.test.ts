import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isLikelyInternalToolTraceText,
  resolveAssistantAnchorIndex,
} from './openclaw-chat-grouping.ts';

test('treats web fetch style tool traces as internal tool groups', () => {
  assert.equal(
    isLikelyInternalToolTraceText({
      text: 'Web Fetch with from https://fund.eastmoney.com/510300.html (mode text, max 5000 chars) Completed',
      groupIsTool: true,
    }),
    true,
  );
});

test('does not hide normal assistant prose as internal tool trace', () => {
  assert.equal(
    isLikelyInternalToolTraceText({
      text: '关于沪深300ETF的买入决策，我需要先说明：我不能提供具体的投资建议。',
      groupIsTool: false,
    }),
    false,
  );
});

test('prefers the last meaningful assistant answer as avatar anchor', () => {
  assert.equal(
    resolveAssistantAnchorIndex([
      { assistant: false, toolLike: true, hasVisibleContent: true },
      { assistant: true, toolLike: false, hasVisibleContent: true },
      { assistant: true, toolLike: false, hasVisibleContent: true },
    ]),
    2,
  );
});

test('falls back to first group when no plain assistant answer exists', () => {
  assert.equal(
    resolveAssistantAnchorIndex([
      { assistant: false, toolLike: true, hasVisibleContent: true },
      { assistant: false, toolLike: true, hasVisibleContent: true },
    ]),
    0,
  );
});
