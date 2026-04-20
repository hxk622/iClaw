import test from 'node:test';
import assert from 'node:assert/strict';

import { buildGraphContextMemoryEntry } from './graph-memory-bridge.ts';
import type { OntologyDocument } from './ontology-types.ts';

const ontologyFixture: OntologyDocument = {
  id: 'ontology::sample::rev::20260420::abcd1234',
  title: '宁德时代图谱',
  summary: '图谱摘要',
  source_raw_ids: ['raw_1'],
  status: 'compiled',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  nodes: [],
  edges: [],
  metadata: {
    graph_identity: 'ontology::sample',
    revision_id: 'ontology::sample::rev::20260420::abcd1234',
    compiled_at: '2026-04-20T10:00:00.000Z',
    source_signature: 'abcd1234',
  },
};

test('buildGraphContextMemoryEntry captures graph identity and revision', () => {
  const entry = buildGraphContextMemoryEntry({
    ontologyDocument: ontologyFixture,
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
