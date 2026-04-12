import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveInitialPrimaryView, resolveRequestedPrimaryViewFromUrl } from './chat-navigation-resolution.ts';
import { readPersistedWorkspaceScene, writePersistedWorkspaceScene } from './chat-navigation.ts';
import { writeCurrentChatPersistenceUserScope } from './chat-persistence-scope.ts';

function createMockStorage() {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

test.beforeEach(() => {
  const localStorage = createMockStorage();
  const sessionStorage = createMockStorage();
  Object.defineProperty(globalThis, 'window', {
    value: { localStorage, sessionStorage },
    configurable: true,
    writable: true,
  });
  writeCurrentChatPersistenceUserScope(null);
});

test.afterEach(() => {
  // @ts-expect-error test cleanup
  delete globalThis.window;
});

test('resolveRequestedPrimaryViewFromUrl forces chat for explicit /chat entry', () => {
  assert.equal(resolveRequestedPrimaryViewFromUrl('http://127.0.0.1:1520/chat?session=main'), 'chat');
  assert.equal(resolveRequestedPrimaryViewFromUrl('http://127.0.0.1:1520/cron'), null);
});

test('resolveInitialPrimaryView prefers explicit chat url over persisted non-chat scene', () => {
  assert.equal(
    resolveInitialPrimaryView({
      persistedPrimaryView: 'cron',
      fallbackPrimaryView: 'chat',
      availablePrimaryViews: ['chat', 'cron', 'task-center'],
      location: 'http://127.0.0.1:1520/chat?session=main',
    }),
    'chat',
  );
});

test('resolveInitialPrimaryView restores persisted supported view when url does not override it', () => {
  assert.equal(
    resolveInitialPrimaryView({
      persistedPrimaryView: 'task-center',
      fallbackPrimaryView: 'chat',
      availablePrimaryViews: ['chat', 'cron', 'task-center'],
      location: 'http://127.0.0.1:1520/',
    }),
    'task-center',
  );
});

test('resolveInitialPrimaryView falls back when persisted view is unsupported', () => {
  assert.equal(
    resolveInitialPrimaryView({
      persistedPrimaryView: 'unknown',
      fallbackPrimaryView: 'chat',
      availablePrimaryViews: ['chat', 'cron', 'task-center'],
      location: 'http://127.0.0.1:1520/',
    }),
    'chat',
  );
});

test('workspace primary view persists across chat scope changes while selected conversation stays scoped', () => {
  writeCurrentChatPersistenceUserScope('user-a');
  writePersistedWorkspaceScene({
    primaryView: 'memory',
    selectedConversationId: 'conv-a',
  });

  writeCurrentChatPersistenceUserScope('user-b');
  writePersistedWorkspaceScene({
    selectedConversationId: 'conv-b',
  });

  assert.deepEqual(readPersistedWorkspaceScene(), {
    primaryView: 'memory',
    selectedConversationId: 'conv-b',
  });

  writeCurrentChatPersistenceUserScope('user-a');
  assert.deepEqual(readPersistedWorkspaceScene(), {
    primaryView: 'memory',
    selectedConversationId: 'conv-a',
  });
});
