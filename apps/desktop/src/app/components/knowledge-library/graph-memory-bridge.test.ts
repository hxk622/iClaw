import test from 'node:test';
import assert from 'node:assert/strict';

import {
  appendGraphContextMemoryPrompt,
  buildGraphContextMemoryEntry,
  parseGraphContextMemoryEntry,
  selectRelevantGraphContextMemoryCards,
} from './graph-memory-bridge.ts';
import type { OntologyDocument } from './ontology-types.ts';

function createOntologyFixture(input?: {
  revisionId?: string;
  graphIdentity?: string;
  sourceSignature?: string;
}): OntologyDocument {
  const revisionId = input?.revisionId || 'ontology::sample::rev::20260420::abcd1234';
  const graphIdentity = input?.graphIdentity || 'ontology::sample';
  const sourceSignature = input?.sourceSignature || 'abcd1234';
  return {
    id: revisionId,
    title: '宁德时代图谱',
    summary: '图谱摘要',
    source_raw_ids: ['raw_1'],
    status: 'compiled',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    nodes: [],
    edges: [],
    metadata: {
      graph_identity: graphIdentity,
      revision_id: revisionId,
      compiled_at: '2026-04-20T10:00:00.000Z',
      source_signature: sourceSignature,
    },
  };
}

test('buildGraphContextMemoryEntry captures graph identity and revision', () => {
  const entry = buildGraphContextMemoryEntry({
    ontologyDocument: createOntologyFixture(),
    kind: 'query',
    question: '什么连接资本开支和现金流？',
    answer: '资本开支 --mentions--> 产能扩张 --supports--> 现金流',
    focusedNodeLabels: ['资本开支'],
    sourceOutputIds: ['output_1'],
  });

  assert.match(entry.title, /图查询/);
  assert.match(entry.content, /ontology::sample/);
  assert.match(entry.content, /abcd1234/);
  assert.match(entry.content, /资本开支/);
  assert.equal(entry.domain, '研究');
  assert.equal(entry.type, '事实');
});

test('parseGraphContextMemoryEntry keeps focused nodes and outputs', () => {
  const parsed = parseGraphContextMemoryEntry(
    buildGraphContextMemoryEntry({
      ontologyDocument: createOntologyFixture(),
      kind: 'query',
      question: '什么连接资本开支和现金流？',
      answer: '资本开支 --mentions--> 产能扩张 --supports--> 现金流',
      focusedNodeLabels: ['资本开支'],
      sourceOutputIds: ['output_1'],
    }),
  );

  assert.ok(parsed);
  assert.equal(parsed?.graphIdentity, 'ontology::sample');
  assert.equal(parsed?.revisionId, 'ontology::sample::rev::20260420::abcd1234');
  assert.deepEqual(parsed?.focusedNodeLabels, ['资本开支']);
  assert.deepEqual(parsed?.sourceOutputIds, ['output_1']);
});

test('selectRelevantGraphContextMemoryCards filters by graph revision and picks newest cards first', () => {
  const currentRevisionCard = parseGraphContextMemoryEntry(
    buildGraphContextMemoryEntry({
      ontologyDocument: createOntologyFixture(),
      kind: 'query',
      question: '当前问题',
      answer: '当前答案',
      focusedNodeLabels: ['资本开支'],
    }),
  );
  const olderSameRevisionCard = parseGraphContextMemoryEntry(
    buildGraphContextMemoryEntry({
      ontologyDocument: createOntologyFixture(),
      kind: 'path',
      question: '旧路径问题',
      answer: '旧路径答案',
      focusedNodeLabels: ['现金流'],
    }),
  );
  const oldRevisionCard = parseGraphContextMemoryEntry(
    buildGraphContextMemoryEntry({
      ontologyDocument: createOntologyFixture({
        revisionId: 'ontology::sample::rev::20260419::oldrev',
        sourceSignature: 'oldrev',
      }),
      kind: 'query',
      question: '旧 revision 问题',
      answer: '旧 revision 答案',
      focusedNodeLabels: ['产能扩张'],
    }),
  );

  assert.ok(currentRevisionCard);
  assert.ok(olderSameRevisionCard);
  assert.ok(oldRevisionCard);

  const cards = [
    { ...olderSameRevisionCard!, updatedAt: '2026-04-20T09:00:00.000Z' },
    { ...oldRevisionCard!, updatedAt: '2026-04-20T11:00:00.000Z' },
    { ...currentRevisionCard!, updatedAt: '2026-04-20T10:00:00.000Z' },
  ];
  const selected = selectRelevantGraphContextMemoryCards(cards, {
    graphIdentity: 'ontology::sample',
    revisionId: 'ontology::sample::rev::20260420::abcd1234',
    limit: 2,
  });

  assert.deepEqual(
    selected.map((card) => card.question),
    ['当前问题', '旧路径问题'],
  );
});

test('appendGraphContextMemoryPrompt only appends matching memory cards when present', () => {
  const prompt = appendGraphContextMemoryPrompt('请继续分析宁德时代图谱。', []);
  assert.equal(prompt, '请继续分析宁德时代图谱。');

  const card = parseGraphContextMemoryEntry(
    buildGraphContextMemoryEntry({
      ontologyDocument: createOntologyFixture(),
      kind: 'query',
      question: '什么连接资本开支和现金流？',
      answer: '资本开支 --mentions--> 产能扩张 --supports--> 现金流',
      focusedNodeLabels: ['资本开支'],
    }),
  );

  assert.ok(card);
  const promptWithMemory = appendGraphContextMemoryPrompt('请继续分析宁德时代图谱。', [card!]);
  assert.match(promptWithMemory, /近期图谱工作记忆/);
  assert.match(promptWithMemory, /图谱上下文卡片 1/);
  assert.match(promptWithMemory, /资本开支/);
});
