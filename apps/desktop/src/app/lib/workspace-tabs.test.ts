import test from 'node:test';
import assert from 'node:assert/strict';

import { writeCurrentChatPersistenceUserScope } from './chat-persistence-scope.ts';
import {
  closeOtherWorkspaceTabs,
  closeWorkspaceTabsToRight,
  ACTIVE_WORKSPACE_TABS_STORAGE_KEY,
  createWorkspaceTabRecord,
  findReusableWorkspaceTab,
  readPersistedWorkspaceTabsSnapshot,
  renameWorkspaceTab,
  reorderWorkspaceTabs,
  setWorkspaceTabColor,
  setWorkspaceTabPinned,
  sortWorkspaceTabsByPinned,
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

test('findReusableWorkspaceTab reuses existing tab for the same conversation id', () => {
  const tabA = createWorkspaceTabRecord({
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
  const tabB = createWorkspaceTabRecord({
    id: 'tab-b',
    title: 'B',
    route: {
      conversationId: 'conv-b',
      sessionKey: 'agent:main:b',
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

  const existing = findReusableWorkspaceTab(
    [tabA, tabB],
    {
      conversationId: 'conv-b',
      sessionKey: 'agent:main:another',
      initialPrompt: null,
      initialPromptKey: null,
      focusedTurnId: null,
      focusedTurnKey: null,
      initialAgentSlug: null,
      initialSkillSlug: null,
      initialSkillOption: null,
      initialStockContext: null,
    },
  );

  assert.equal(existing?.id, 'tab-b');
});

test('findReusableWorkspaceTab falls back to session key only for draft routes without conversation id', () => {
  const tab = createWorkspaceTabRecord({
    id: 'tab-a',
    title: 'Draft',
    route: {
      conversationId: null,
      sessionKey: 'agent:main:draft-a',
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

  const existing = findReusableWorkspaceTab(
    [tab],
    {
      conversationId: null,
      sessionKey: 'agent:main:draft-a',
      initialPrompt: null,
      initialPromptKey: null,
      focusedTurnId: null,
      focusedTurnKey: null,
      initialAgentSlug: null,
      initialSkillSlug: null,
      initialSkillOption: null,
      initialStockContext: null,
    },
  );

  assert.equal(existing?.id, 'tab-a');
});

test('findReusableWorkspaceTab does not reuse by session key when route already has conversation id', () => {
  const tab = createWorkspaceTabRecord({
    id: 'tab-a',
    title: 'A',
    route: {
      conversationId: 'conv-a',
      sessionKey: 'agent:main:shared',
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

  const existing = findReusableWorkspaceTab(
    [tab],
    {
      conversationId: 'conv-b',
      sessionKey: 'agent:main:shared',
      initialPrompt: null,
      initialPromptKey: null,
      focusedTurnId: null,
      focusedTurnKey: null,
      initialAgentSlug: null,
      initialSkillSlug: null,
      initialSkillOption: null,
      initialStockContext: null,
    },
  );

  assert.equal(existing, null);
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

test('reorderWorkspaceTabs blocks dragging across pinned boundary', () => {
  const pinnedTab = createWorkspaceTabRecord({
    id: 'tab-a',
    title: 'Pinned',
    pinned: true,
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
  const freeTab = createWorkspaceTabRecord({
    id: 'tab-b',
    title: 'Free',
    route: {
      conversationId: 'conv-b',
      sessionKey: 'agent:main:b',
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
  const tabs = [pinnedTab, freeTab];

  assert.equal(reorderWorkspaceTabs(tabs, 'tab-b', 'tab-a'), tabs);
});

test('setWorkspaceTabPinned moves pinned tabs into the left pinned section', () => {
  const tabA = createWorkspaceTabRecord({
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
  const tabB = createWorkspaceTabRecord({
    id: 'tab-b',
    title: 'B',
    route: {
      conversationId: 'conv-b',
      sessionKey: 'agent:main:b',
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
  const tabC = createWorkspaceTabRecord({
    id: 'tab-c',
    title: 'C',
    pinned: true,
    route: {
      conversationId: 'conv-c',
      sessionKey: 'agent:main:c',
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

  const tabs = [tabA, tabB, tabC];
  const next = setWorkspaceTabPinned(tabs, 'tab-b', true);

  assert.deepEqual(
    next.map((tab) => [tab.id, tab.pinned]),
    [
      ['tab-c', true],
      ['tab-b', true],
      ['tab-a', false],
    ],
  );
});

test('setWorkspaceTabPinned moves unpinned tabs back into the normal section', () => {
  const tabA = createWorkspaceTabRecord({
    id: 'tab-a',
    title: 'A',
    pinned: true,
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
  const tabB = createWorkspaceTabRecord({
    id: 'tab-b',
    title: 'B',
    pinned: true,
    route: {
      conversationId: 'conv-b',
      sessionKey: 'agent:main:b',
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
  const tabC = createWorkspaceTabRecord({
    id: 'tab-c',
    title: 'C',
    route: {
      conversationId: 'conv-c',
      sessionKey: 'agent:main:c',
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

  const tabs = [tabA, tabB, tabC];
  const next = setWorkspaceTabPinned(tabs, 'tab-a', false);

  assert.deepEqual(
    next.map((tab) => [tab.id, tab.pinned]),
    [
      ['tab-b', true],
      ['tab-a', false],
      ['tab-c', false],
    ],
  );
});

test('sortWorkspaceTabsByPinned keeps pinned tabs before normal tabs', () => {
  const tabA = createWorkspaceTabRecord({
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
  const tabB = createWorkspaceTabRecord({
    id: 'tab-b',
    title: 'B',
    pinned: true,
    route: {
      conversationId: 'conv-b',
      sessionKey: 'agent:main:b',
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
  const tabC = createWorkspaceTabRecord({
    id: 'tab-c',
    title: 'C',
    route: {
      conversationId: 'conv-c',
      sessionKey: 'agent:main:c',
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

  const next = sortWorkspaceTabsByPinned([tabA, tabB, tabC]);
  assert.deepEqual(next.map((tab) => tab.id), ['tab-b', 'tab-a', 'tab-c']);
});

test('renameWorkspaceTab updates title and switches titleSource to user', () => {
  const tab = createWorkspaceTabRecord({
    id: 'tab-a',
    title: '旧标题',
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

  const next = renameWorkspaceTab([tab], 'tab-a', '新标题');
  assert.equal(next[0].title, '新标题');
  assert.equal(next[0].titleSource, 'user');
});

test('setWorkspaceTabColor updates the target tab color only', () => {
  const tabA = createWorkspaceTabRecord({
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
  const tabB = createWorkspaceTabRecord({
    id: 'tab-b',
    title: 'B',
    route: {
      conversationId: 'conv-b',
      sessionKey: 'agent:main:b',
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

  const next = setWorkspaceTabColor([tabA, tabB], 'tab-b', 'rose');
  assert.equal(next[0].color, 'default');
  assert.equal(next[1].color, 'rose');
});

test('closeOtherWorkspaceTabs keeps only the requested tab', () => {
  const tabA = createWorkspaceTabRecord({
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
  const tabB = createWorkspaceTabRecord({
    id: 'tab-b',
    title: 'B',
    route: {
      conversationId: 'conv-b',
      sessionKey: 'agent:main:b',
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
  const tabC = createWorkspaceTabRecord({
    id: 'tab-c',
    title: 'C',
    route: {
      conversationId: 'conv-c',
      sessionKey: 'agent:main:c',
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

  const next = closeOtherWorkspaceTabs([tabA, tabB, tabC], 'tab-b');
  assert.deepEqual(next.map((tab) => tab.id), ['tab-b']);
});

test('closeWorkspaceTabsToRight removes tabs after the target index only', () => {
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

  const next = closeWorkspaceTabsToRight(
    [createTab('tab-a'), createTab('tab-b'), createTab('tab-c'), createTab('tab-d')],
    'tab-b',
  );
  assert.deepEqual(next.map((tab) => tab.id), ['tab-a', 'tab-b']);
});
