import test from 'node:test';
import assert from 'node:assert/strict';

import { promoteChatTurnToOutputArtifact } from './chat-output-promotion.ts';
import { listOutputArtifacts } from './output-storage.ts';

function installLocalStorageShim(): void {
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

test('promoteChatTurnToOutputArtifact upserts by turn dedupe key', async () => {
  installLocalStorageShim();
  const first = await promoteChatTurnToOutputArtifact({
    turn: {
      id: 'turn_promote_1',
      conversationId: 'conv_promote_1',
      sessionKey: 'agent:main:main',
      prompt: '生成一份晨报网页稿',
      title: '晨报任务',
      artifacts: ['webpage'],
      financeCompliance: null,
    },
    answer: '第一次结果',
    artifactRef: {
      kind: 'webpage',
      path: '/tmp/morning-brief.html',
      title: '晨报网页稿',
      previewKind: 'html',
    },
  });

  const second = await promoteChatTurnToOutputArtifact({
    turn: {
      id: 'turn_promote_1',
      conversationId: 'conv_promote_1',
      sessionKey: 'agent:main:main',
      prompt: '生成一份晨报网页稿',
      title: '晨报任务',
      artifacts: ['webpage'],
      financeCompliance: null,
    },
    answer: '第二次结果',
    artifactRef: {
      kind: 'webpage',
      path: '/tmp/morning-brief-v2.html',
      title: '晨报网页稿 V2',
      previewKind: 'html',
    },
  });

  assert.equal(first.id, second.id);
  const stored = listOutputArtifacts().find((item) => item.id === first.id) ?? null;
  assert.ok(stored);
  assert.match(stored?.content || '', /第二次结果/);
  assert.match(stored?.content || '', /V2/);
});
