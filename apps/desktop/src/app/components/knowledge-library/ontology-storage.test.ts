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

test('ontology storage keeps latest pointer per graph identity', async () => {
  installStorageShim();
  const { listOntologyDocuments, getOntologyDocumentById, upsertOntologyDocument } = await import('./ontology-storage.ts');

  const first = upsertOntologyDocument({
    id: 'ontology::sample',
    title: '示例图谱',
    summary: '第一版',
    source_raw_ids: ['raw_1'],
    status: 'compiled',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    nodes: [],
    edges: [],
    metadata: {
      graph_identity: 'ontology::sample',
      compiled_at: '2026-04-20T00:00:00.000Z',
      source_signature: 'sig1',
    },
  });

  const second = upsertOntologyDocument({
    id: 'ontology::sample',
    title: '示例图谱',
    summary: '第二版',
    source_raw_ids: ['raw_1'],
    status: 'compiled',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    nodes: [],
    edges: [],
    metadata: {
      graph_identity: 'ontology::sample',
      compiled_at: '2026-04-20T01:00:00.000Z',
      source_signature: 'sig2',
    },
  });

  const list = listOntologyDocuments();
  assert.equal(list.length, 1);
  assert.equal(list[0]?.summary, '第二版');
  assert.notEqual(first.id, second.id);
  assert.equal(getOntologyDocumentById('ontology::sample')?.summary, '第二版');
  assert.equal(getOntologyDocumentById(first.id)?.summary, '第一版');
});
