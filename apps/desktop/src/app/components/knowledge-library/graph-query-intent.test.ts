import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyGraphQueryIntent } from './graph-query-intent.ts';

test('classifyGraphQueryIntent detects path questions as dfs graph queries', () => {
  const result = classifyGraphQueryIntent({
    question: '什么连接资本开支和现金流？',
  });

  assert.equal(result.shouldUseGraph, true);
  assert.equal(result.useDfs, true);
  assert.equal(result.reason, 'path');
});

test('classifyGraphQueryIntent uses selected node as graph focus', () => {
  const result = classifyGraphQueryIntent({
    question: '讲讲它的作用',
    selectedNodeLabel: '宁德时代',
  });

  assert.equal(result.shouldUseGraph, true);
  assert.equal(result.useDfs, false);
  assert.equal(result.reason, 'node_focus');
  assert.match(result.rewrittenQuestion, /宁德时代/);
});

test('classifyGraphQueryIntent falls back for plain text questions without graph hints', () => {
  const result = classifyGraphQueryIntent({
    question: '把这段话改得更顺一点',
  });

  assert.equal(result.shouldUseGraph, false);
  assert.equal(result.reason, 'fallback_text');
});
