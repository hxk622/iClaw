import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildKnowledgeLibraryContextPrompt,
  buildKnowledgeLibraryGraphQueryPrompt,
  buildKnowledgeLibraryNodeFocusPrompt,
  buildKnowledgeLibraryShortestPathPrompt,
} from './chat-context.ts';
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

test('buildKnowledgeLibraryGraphQueryPrompt appends graph query result', () => {
  installStorageShim();
  const prompt = buildKnowledgeLibraryGraphQueryPrompt({
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
    question: '什么连接资本开支和现金流？',
    queryResult: 'Traversal: BFS | Start: [资本开支] | 4 nodes',
  });

  assert.match(prompt, /Graphify 查询问题/);
  assert.match(prompt, /资本开支和现金流/);
  assert.match(prompt, /Traversal: BFS/);
});

test('buildKnowledgeLibraryNodeFocusPrompt includes node summary and neighbors', () => {
  installStorageShim();
  const prompt = buildKnowledgeLibraryNodeFocusPrompt({
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
    nodeLabel: '资本开支',
    nodeSummary: '资本开支节点摘要',
    neighbors: ['现金流', '产能扩张'],
  });

  assert.match(prompt, /当前聚焦节点：资本开支/);
  assert.match(prompt, /现金流、产能扩张/);
});

test('buildKnowledgeLibraryShortestPathPrompt includes path explanation context', () => {
  installStorageShim();
  const prompt = buildKnowledgeLibraryShortestPathPrompt({
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
    fromLabel: '资本开支',
    toLabel: '现金流',
    pathText: '资本开支 --mentions--> 产能扩张 --supports--> 现金流',
  });

  assert.match(prompt, /从「资本开支」到「现金流」/);
  assert.match(prompt, /产能扩张/);
});
