import type { ComposerSkillOption, ComposerStockContext } from '../components/RichChatComposer.tsx';
import { buildChatScopedStorageKey } from './chat-persistence-scope.ts';
import { readCacheJson, writeCacheJson } from './persistence/cache-store.ts';
import { buildStorageKey } from './storage.ts';

export const ACTIVE_WORKSPACE_TABS_STORAGE_KEY = buildStorageKey('desktop.workspace-tabs.v1');
export const MAX_WORKSPACE_TABS = 12;

export type WorkspaceTabKind = 'chat';
export type WorkspaceTabColor =
  | 'default'
  | 'gold'
  | 'olive'
  | 'teal'
  | 'slate'
  | 'rose'
  | 'charcoal';
export type WorkspaceTabTitleSource = 'auto' | 'user';

export type WorkspaceTabRouteSnapshot = {
  conversationId: string | null;
  sessionKey: string;
  initialPrompt: string | null;
  initialPromptKey: string | null;
  focusedTurnId: string | null;
  focusedTurnKey: string | null;
  initialAgentSlug: string | null;
  initialSkillSlug: string | null;
  initialSkillOption: ComposerSkillOption | null;
  initialStockContext: ComposerStockContext | null;
};

export type WorkspaceTabRecord = {
  id: string;
  kind: WorkspaceTabKind;
  color: WorkspaceTabColor;
  title: string;
  titleSource: WorkspaceTabTitleSource;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  lastVisitedAt: string;
  route: WorkspaceTabRouteSnapshot;
};

export type WorkspaceTabsSnapshot = {
  version: 1;
  activeTabId: string | null;
  tabs: WorkspaceTabRecord[];
  recentlyClosedTabIds?: string[];
};

export type WorkspaceTabRuntimeStatus = {
  busy: boolean;
  hasPendingBilling: boolean;
  hasUnsavedDraft: boolean;
  recovering: boolean;
  ready: boolean;
};

function resolveWorkspaceTabsStorageKey(): string {
  return buildChatScopedStorageKey(ACTIVE_WORKSPACE_TABS_STORAGE_KEY);
}

function normalizeOptionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeBoolean(value: unknown): boolean {
  return value === true;
}

function normalizeWorkspaceTabColor(value: unknown): WorkspaceTabColor {
  return value === 'gold' ||
    value === 'olive' ||
    value === 'teal' ||
    value === 'slate' ||
    value === 'rose' ||
    value === 'charcoal'
    ? value
    : 'default';
}

function normalizeWorkspaceTabTitleSource(value: unknown): WorkspaceTabTitleSource {
  return value === 'user' ? 'user' : 'auto';
}

function normalizeSkillOption(value: unknown): ComposerSkillOption | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const slug = normalizeOptionalText(raw.slug);
  const name = normalizeOptionalText(raw.name);
  const market = normalizeOptionalText(raw.market);
  const skillType = normalizeOptionalText(raw.skillType);
  const categoryLabel = normalizeOptionalText(raw.categoryLabel);
  if (!slug || !name || !market || !skillType || !categoryLabel) {
    return null;
  }
  return {
    slug,
    name,
    market,
    skillType,
    categoryLabel,
  };
}

function normalizeStockContext(value: unknown): ComposerStockContext | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const id = normalizeOptionalText(raw.id);
  const symbol = normalizeOptionalText(raw.symbol);
  const companyName = normalizeOptionalText(raw.companyName);
  const exchange = raw.exchange === 'sh' || raw.exchange === 'sz' || raw.exchange === 'bj' || raw.exchange === 'otc'
    ? raw.exchange
    : null;
  if (!id || !symbol || !companyName || !exchange) {
    return null;
  }
  return {
    id,
    symbol,
    companyName,
    exchange,
    board: normalizeOptionalText(raw.board),
    instrumentKind:
      raw.instrumentKind === 'stock' ||
      raw.instrumentKind === 'fund' ||
      raw.instrumentKind === 'etf' ||
      raw.instrumentKind === 'qdii'
        ? raw.instrumentKind
        : undefined,
    instrumentLabel: normalizeOptionalText(raw.instrumentLabel),
  };
}

function normalizeWorkspaceTabRoute(value: unknown): WorkspaceTabRouteSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const sessionKey = normalizeOptionalText(raw.sessionKey);
  if (!sessionKey) {
    return null;
  }
  return {
    conversationId: normalizeOptionalText(raw.conversationId),
    sessionKey,
    initialPrompt: normalizeOptionalText(raw.initialPrompt),
    initialPromptKey: normalizeOptionalText(raw.initialPromptKey),
    focusedTurnId: normalizeOptionalText(raw.focusedTurnId),
    focusedTurnKey: normalizeOptionalText(raw.focusedTurnKey),
    initialAgentSlug: normalizeOptionalText(raw.initialAgentSlug),
    initialSkillSlug: normalizeOptionalText(raw.initialSkillSlug),
    initialSkillOption: normalizeSkillOption(raw.initialSkillOption),
    initialStockContext: normalizeStockContext(raw.initialStockContext),
  };
}

function normalizeWorkspaceTabRecord(value: unknown): WorkspaceTabRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const id = normalizeOptionalText(raw.id);
  const route = normalizeWorkspaceTabRoute(raw.route);
  if (!id || !route) {
    return null;
  }
  const now = new Date().toISOString();
  return {
    id,
    kind: 'chat',
    color: normalizeWorkspaceTabColor(raw.color),
    title: normalizeOptionalText(raw.title) || '新对话',
    titleSource: normalizeWorkspaceTabTitleSource(raw.titleSource),
    pinned: normalizeBoolean(raw.pinned),
    createdAt: normalizeOptionalText(raw.createdAt) || now,
    updatedAt: normalizeOptionalText(raw.updatedAt) || now,
    lastVisitedAt: normalizeOptionalText(raw.lastVisitedAt) || now,
    route,
  };
}

export function createWorkspaceTabRecord(input: {
  id: string;
  route: WorkspaceTabRouteSnapshot;
  title?: string | null;
  titleSource?: WorkspaceTabTitleSource;
  color?: WorkspaceTabColor;
  pinned?: boolean;
  createdAt?: string;
}): WorkspaceTabRecord {
  const now = input.createdAt || new Date().toISOString();
  return {
    id: input.id,
    kind: 'chat',
    color: input.color || 'default',
    title: normalizeOptionalText(input.title) || '新对话',
    titleSource: input.titleSource || 'auto',
    pinned: input.pinned === true,
    createdAt: now,
    updatedAt: now,
    lastVisitedAt: now,
    route: {
      ...input.route,
    },
  };
}

export function readPersistedWorkspaceTabsSnapshot(): WorkspaceTabsSnapshot | null {
  const snapshot = readCacheJson<WorkspaceTabsSnapshot>(resolveWorkspaceTabsStorageKey());
  if (!snapshot || typeof snapshot !== 'object' || snapshot.version !== 1 || !Array.isArray(snapshot.tabs)) {
    return null;
  }

  const tabs = sortWorkspaceTabsByPinned(
    snapshot.tabs
    .map((tab) => normalizeWorkspaceTabRecord(tab))
    .filter((tab): tab is WorkspaceTabRecord => Boolean(tab))
    .slice(0, MAX_WORKSPACE_TABS),
  );

  const activeTabId = normalizeOptionalText(snapshot.activeTabId);
  const validActiveTabId = activeTabId && tabs.some((tab) => tab.id === activeTabId) ? activeTabId : tabs[0]?.id || null;

  return {
    version: 1,
    activeTabId: validActiveTabId,
    tabs,
    recentlyClosedTabIds: Array.isArray(snapshot.recentlyClosedTabIds)
      ? snapshot.recentlyClosedTabIds
          .map((value) => normalizeOptionalText(value))
          .filter((value): value is string => Boolean(value))
      : undefined,
  };
}

export function writePersistedWorkspaceTabsSnapshot(snapshot: WorkspaceTabsSnapshot | null): void {
  writeCacheJson(resolveWorkspaceTabsStorageKey(), snapshot);
}

export function reorderWorkspaceTabs(
  tabs: WorkspaceTabRecord[],
  fromTabId: string,
  toTabId: string,
): WorkspaceTabRecord[] {
  if (fromTabId === toTabId) {
    return tabs;
  }

  const fromIndex = tabs.findIndex((tab) => tab.id === fromTabId);
  const toIndex = tabs.findIndex((tab) => tab.id === toTabId);
  if (fromIndex < 0 || toIndex < 0) {
    return tabs;
  }
  if (tabs[fromIndex].pinned !== tabs[toIndex].pinned) {
    return tabs;
  }

  const nextTabs = [...tabs];
  const [movedTab] = nextTabs.splice(fromIndex, 1);
  nextTabs.splice(toIndex, 0, movedTab);
  return nextTabs;
}

export function sortWorkspaceTabsByPinned(tabs: WorkspaceTabRecord[]): WorkspaceTabRecord[] {
  const pinnedTabs = tabs.filter((tab) => tab.pinned);
  const unpinnedTabs = tabs.filter((tab) => !tab.pinned);
  return [...pinnedTabs, ...unpinnedTabs];
}

export function setWorkspaceTabPinned(
  tabs: WorkspaceTabRecord[],
  tabId: string,
  pinned: boolean,
): WorkspaceTabRecord[] {
  const nextTabs = sortWorkspaceTabsByPinned([...tabs]);
  const sourceIndex = nextTabs.findIndex((tab) => tab.id === tabId);
  if (sourceIndex < 0) {
    return tabs;
  }

  const sourceTab = nextTabs[sourceIndex];
  if (sourceTab.pinned === pinned) {
    return tabs;
  }

  const [movedTab] = nextTabs.splice(sourceIndex, 1);
  const updatedTab: WorkspaceTabRecord = {
    ...movedTab,
    pinned,
    updatedAt: new Date().toISOString(),
  };
  const pinnedCount = nextTabs.filter((tab) => tab.pinned).length;
  const targetIndex = pinned ? pinnedCount : pinnedCount;
  nextTabs.splice(targetIndex, 0, updatedTab);
  return nextTabs;
}
