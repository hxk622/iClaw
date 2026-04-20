import test from 'node:test';
import assert from 'node:assert/strict';

import { buildGraphReasoningOutputArtifactInput } from './chat-feedback.ts';

test('buildGraphReasoningOutputArtifactInput creates revision-aware graph output artifact metadata', () => {
  const artifact = buildGraphReasoningOutputArtifactInput({
    selectedItem: {
      id: 'ontology::sample::rev::20260420::abcd1234',
      title: '宁德时代图谱',
      subtitle: '本体图谱',
      summary: '图谱摘要',
      tags: ['图谱'],
      icon: (() => null) as never,
      meta: '刚刚更新',
      ontologyDocument: {
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
        },
      },
    },
    ontologyDocument: {
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
      },
    },
    question: '什么连接资本开支和现金流？',
    answer: '资本开支 --mentions--> 产能扩张 --supports--> 现金流',
    queryType: 'path_query',
    sourceNodes: ['资本开支', '现金流'],
    savedPath: '/tmp/graph-memory.md',
  });

  assert.equal(artifact.type, 'graph_path_note');
  assert.match(artifact.title, /图路径笔记/);
  assert.deepEqual(artifact.source_ontology_ids, ['ontology::sample::rev::20260420::abcd1234']);
  const metadata = artifact.metadata as Record<string, unknown>;
  assert.equal(metadata.generated_from, 'graph-reasoning');
  assert.equal(metadata.source_surface, 'knowledge_graph');
  assert.match(String(metadata.dedupe_key || ''), /graph-reasoning-output::ontology::sample::path_query/);
  const lineage = metadata.lineage as Record<string, unknown>;
  assert.equal(lineage.source, 'graph_reasoning');
  assert.deepEqual(lineage.artifact_kinds, ['graph_path']);
});
