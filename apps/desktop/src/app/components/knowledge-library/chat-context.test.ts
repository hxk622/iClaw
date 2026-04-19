import test from 'node:test';
import assert from 'node:assert/strict';

import { buildKnowledgeLibraryContextPrompt } from './chat-context.ts';
import { upsertOutputArtifact } from './output-storage.ts';

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

test('buildKnowledgeLibraryContextPrompt includes graphify report summary for ontology items', () => {
  installStorageShim();
  upsertOutputArtifact({
    id: 'report_1',
    type: 'memo',
    title: '图谱报告',
    summary: 'Graphify 报告摘要',
    content: '# Graphify Report\n\n这是图谱报告正文。',
    content_format: 'markdown',
    source_raw_ids: ['raw_1'],
    source_ontology_ids: ['ontology_1'],
    status: 'draft',
    publish_targets: [],
    metadata: {
      dedupe_key: 'graphify-report::ontology_1',
    },
  });

  const prompt = buildKnowledgeLibraryContextPrompt({
    tab: 'graph',
    item: {
      id: 'ontology_1',
      title: '宁德时代图谱',
      subtitle: '本体图谱',
      summary: '图谱摘要',
      tags: ['图谱'],
      icon: (() => null) as never,
      meta: '刚刚编译',
      ontologyDocument: {
        id: 'ontology_1',
        title: '宁德时代图谱',
        summary: '图谱摘要',
        source_raw_ids: ['raw_1'],
        status: 'compiled',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        nodes: [],
        edges: [],
        metadata: null,
      },
    },
  });

  assert.match(prompt, /Graphify 导航摘要/);
  assert.match(prompt, /图谱报告正文/);
});
