import test from 'node:test';
import assert from 'node:assert/strict';

function installStorageShim(): void {
  const backingStore = new Map<string, string>();
  const storage = {
    getItem(key: string) {
      return backingStore.has(key) ? backingStore.get(key) ?? null : null;
    },
    setItem(key: string, value: string) {
      backingStore.set(key, String(value));
    },
    removeItem(key: string) {
      backingStore.delete(key);
    },
    clear() {
      backingStore.clear();
    },
    key(index: number) {
      return Array.from(backingStore.keys())[index] ?? null;
    },
    get length() {
      return backingStore.size;
    },
  } satisfies Storage;

  Object.defineProperty(globalThis, 'window', {
    value: {
      localStorage: storage,
      sessionStorage: storage,
    },
    configurable: true,
  });
}

test('buildOntologyDocumentFromOutputArtifact materializes Output nodes and lineage edges', async () => {
  installStorageShim();
  const { buildOntologyDocumentFromOutputArtifact } = await import('./output-ontology-pipeline.ts');

  const document = buildOntologyDocumentFromOutputArtifact({
    id: 'output_1',
    type: 'memo',
    title: '宁德时代投资备忘录',
    summary: '聚焦全球动力电池竞争力与资本开支纪律。',
    content: '# 宁德时代投资备忘录\n\n核心观点：关注全球市占率与现金流质量。',
    content_format: 'markdown',
    source_raw_ids: ['raw_1'],
    source_ontology_ids: ['graph_1'],
    status: 'draft',
    publish_targets: [],
    metadata: {
      generated_from: 'chat-turn',
      source_surface: 'chat',
      lineage: {
        source: 'chat-turn',
        turn_id: 'turn_1',
        conversation_id: 'conv_1',
        session_key: 'agent:main:main',
        prompt_excerpt: '请生成宁德时代投资备忘录',
        artifact_kinds: ['webpage'],
        artifact_refs: [],
        source_raw_ids: ['raw_1'],
        source_ontology_ids: ['graph_1'],
      },
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  assert.match(document.id, /ontology::output::output_1/);
  assert.equal(document.nodes.some((node) => node.node_type === 'Output' && node.label.includes('宁德时代')), true);
  assert.equal(document.edges.some((edge) => edge.relation_type === 'mentions'), true);
  assert.equal(document.edges.some((edge) => edge.relation_type === 'supports'), true);
  assert.equal(document.metadata?.generated_from, 'output');
});
