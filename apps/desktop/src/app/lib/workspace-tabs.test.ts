import test from 'node:test';
import assert from 'node:assert/strict';

import { writeCurrentChatPersistenceUserScope } from './chat-persistence-scope.ts';
import {
  ACTIVE_WORKSPACE_TABS_STORAGE_KEY,
  createWorkspaceTabRecord,
  readPersistedWorkspaceTabsSnapshot,
  reorderWorkspaceTabs,
  writePersistedWorkspaceTabsSnapshot,
} from './workspace-tabs.ts';
import { readCacheJson } from './persistence/cache-store.ts';

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

test('writePersistedWorkspaceTabsSnapshot stores snapshot in scoped storage key', () => {
  const tab = createWorkspaceTabRecord({
    id: 'tab-1',
    title: 'A股研究',
    route: {
      conversationId: 'conv-1',
      sessionKey: 'agent:main:a-share',
      initialPrompt: null,
      initialPromptKey: null,
      focusedTurnId: null,
      focusedTurnKey: null,
      initialAgentSlug: null,
      initialSkillSlug: null,
      initialSkillOption: null,
      initialStockContext: null,
    },
  });

  writePersistedWorkspaceTabsSnapshot({
    version: 1,
    activeTabId: tab.id,
    tabs: [tab],
  });

  assert.deepEqual(readCacheJson(`${ACTIVE_WORKSPACE_TABS_STORAGE_KEY}:scope:scope-a`), {
    version: 1,
    activeTabId: 'tab-1',
    tabs: [tab],
  });
});

test('readPersistedWorkspaceTabsSnapshot normalizes invalid active tab to first tab', () => {
  const tab = createWorkspaceTabRecord({
    id: 'tab-1',
    title: '新对话',
    route: {
      conversationId: null,
      sessionKey: 'agent:main:general',
      initialPrompt: null,
      initialPromptKey: null,
      focusedTurnId: null,
      focusedTurnKey: null,
      initialAgentSlug: null,
      initialSkillSlug: null,
      initialSkillOption: null,
      initialStockContext: null,
    },
  });

  writePersistedWorkspaceTabsSnapshot({
    version: 1,
    activeTabId: 'missing-tab',
    tabs: [tab],
  });

  const snapshot = readPersistedWorkspaceTabsSnapshot();
  assert.ok(snapshot);
  assert.equal(snapshot.activeTabId, 'tab-1');
  assert.equal(snapshot.tabs.length, 1);
});

test('readPersistedWorkspaceTabsSnapshot returns null for malformed route records', () => {
  writePersistedWorkspaceTabsSnapshot({
    version: 1,
    activeTabId: 'tab-1',
    tabs: [
      {
        id: 'tab-1',
        title: '坏数据',
      },
    ] as any,
  });

  const snapshot = readPersistedWorkspaceTabsSnapshot();
  assert.ok(snapshot);
  assert.equal(snapshot.tabs.length, 0);
  assert.equal(snapshot.activeTabId, null);
});

test('reorderWorkspaceTabs moves the dragged tab before the drop target', () => {
  const createTab = (id: string) =>
    createWorkspaceTabRecord({
      id,
      title: id,
      route: {
        conversationId: id,
        sessionKey: `agent:main:${id}`,
        initialPrompt: null,
        initialPromptKey: null,
        focusedTurnId: null,
        focusedTurnKey: null,
        initialAgentSlug: null,
        initialSkillSlug: null,
        initialSkillOption: null,
        initialStockContext: null,
      },
    });

  const tabs = [createTab('tab-a'), createTab('tab-b'), createTab('tab-c')];
  const reordered = reorderWorkspaceTabs(tabs, 'tab-c', 'tab-a');

  assert.deepEqual(
    reordered.map((tab) => tab.id),
    ['tab-c', 'tab-a', 'tab-b'],
  );
});

test('reorderWorkspaceTabs returns original array when source or target is missing', () => {
  const tab = createWorkspaceTabRecord({
    id: 'tab-a',
    title: 'A',
    route: {
      conversationId: 'conv-a',
      sessionKey: 'agent:main:a',
      initialPrompt: null,
      initialPromptKey: null,
      focusedTurnId: null,
      focusedTurnKey: null,
      initialAgentSlug: null,
      initialSkillSlug: null,
      initialSkillOption: null,
      initialStockContext: null,
    },
  });

  const tabs = [tab];
  assert.equal(reorderWorkspaceTabs(tabs, 'missing', 'tab-a'), tabs);
  assert.equal(reorderWorkspaceTabs(tabs, 'tab-a', 'missing'), tabs);
});
