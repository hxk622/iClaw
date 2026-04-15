import test from 'node:test';
import assert from 'node:assert/strict';

import { writeCurrentChatPersistenceUserScope } from './chat-persistence-scope.ts';
import {
  ACTIVE_CHAT_ROUTE_GLOBAL_STORAGE_KEY,
  ACTIVE_CHAT_ROUTE_STORAGE_KEY,
  readPersistedChatRouteSnapshot,
  writePersistedChatRouteSnapshot,
} from './chat-route-persistence.ts';
import { readCacheJson, writeCacheJson } from './persistence/cache-store.ts';

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
  writeCurrentChatPersistenceUserScope('scope-a');
});

test.afterEach(() => {
  // @ts-expect-error test cleanup
  delete globalThis.window;
});

test('readPersistedChatRouteSnapshot prefers current scoped route over stale global route', () => {
  writeCacheJson(ACTIVE_CHAT_ROUTE_GLOBAL_STORAGE_KEY, {
    conversationId: 'conv-global',
    sessionKey: 'agent:main:global',
  });
  writeCacheJson(`iclaw.desktop.active-chat-route.v1:scope:scope-a`, {
    conversationId: 'conv-legacy-scoped',
    sessionKey: 'agent:main:scoped',
  });

  assert.deepEqual(readPersistedChatRouteSnapshot(), {
    conversationId: 'conv-legacy-scoped',
    sessionKey: 'agent:main:scoped',
  });
});

test('readPersistedChatRouteSnapshot falls back to global route when scope has no snapshot', () => {
  writeCacheJson(ACTIVE_CHAT_ROUTE_GLOBAL_STORAGE_KEY, {
    conversationId: 'conv-global',
    sessionKey: 'agent:main:global',
  });

  assert.deepEqual(readPersistedChatRouteSnapshot(), {
    conversationId: 'conv-global',
    sessionKey: 'agent:main:global',
  });
});

test('writePersistedChatRouteSnapshot writes brand-scoped keys and clears legacy generic keys', () => {
  writeCacheJson('iclaw.desktop.active-chat-route.global.v1', {
    conversationId: 'conv-legacy-global',
    sessionKey: 'agent:main:legacy-global',
  });
  writeCacheJson('iclaw.desktop.active-chat-route.v1:scope:scope-a', {
    conversationId: 'conv-legacy-scoped',
    sessionKey: 'agent:main:legacy-scoped',
  });

  writePersistedChatRouteSnapshot({
    conversationId: 'conv-current',
    sessionKey: 'agent:main:current',
  });

  assert.deepEqual(readCacheJson(ACTIVE_CHAT_ROUTE_GLOBAL_STORAGE_KEY), {
    conversationId: 'conv-current',
    sessionKey: 'agent:main:current',
  });
  assert.deepEqual(
    readCacheJson(`${ACTIVE_CHAT_ROUTE_STORAGE_KEY}:scope:scope-a`),
    {
      conversationId: 'conv-current',
      sessionKey: 'agent:main:current',
    },
  );
  assert.equal(readCacheJson('iclaw.desktop.active-chat-route.global.v1'), null);
  assert.equal(readCacheJson('iclaw.desktop.active-chat-route.v1:scope:scope-a'), null);
});
