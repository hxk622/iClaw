import test from 'node:test';
import assert from 'node:assert/strict';

import { readGraphReasoningSession, writeGraphReasoningSession } from './graph-reasoning-session.ts';

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
      dispatchEvent() {
        return true;
      },
      addEventListener() {},
      removeEventListener() {},
    },
    configurable: true,
  });
}

test('writeGraphReasoningSession persists and reads revision-aware state', () => {
  installStorageShim();

  writeGraphReasoningSession({
    graphIdentity: 'ontology::sample',
    ontologyRevisionId: 'ontology::sample::rev::1',
    selectedNodeId: 'node_a',
    selectedEdgeId: 'edge_a',
    pathTargetNodeId: 'node_b',
    pathResult: 'A --mentions--> B',
    graphQueryText: '什么连接 A 和 B？',
    graphQueryUseDfs: true,
    graphQueryResult: 'Traversal: DFS',
    autoGraphQueryEnabled: true,
  });

  const result = readGraphReasoningSession('ontology::sample');
  assert.ok(result);
  assert.equal(result?.ontologyRevisionId, 'ontology::sample::rev::1');
  assert.equal(result?.selectedNodeId, 'node_a');
  assert.equal(result?.graphQueryUseDfs, true);
  assert.equal(result?.graphQueryResult, 'Traversal: DFS');
});
