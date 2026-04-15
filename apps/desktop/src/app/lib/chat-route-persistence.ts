import { buildChatScopedStorageKey } from './chat-persistence-scope.ts';
import { readCacheJson, writeCacheJson } from './persistence/cache-store.ts';
import { buildStorageKey } from './storage.ts';

const LEGACY_ACTIVE_CHAT_ROUTE_STORAGE_KEY = 'iclaw.desktop.active-chat-route.v1';
const LEGACY_ACTIVE_CHAT_ROUTE_GLOBAL_STORAGE_KEY = 'iclaw.desktop.active-chat-route.global.v1';

export const ACTIVE_CHAT_ROUTE_STORAGE_KEY = buildStorageKey('desktop.active-chat-route.v1');
export const ACTIVE_CHAT_ROUTE_GLOBAL_STORAGE_KEY = buildStorageKey('desktop.active-chat-route.global.v1');

export type PersistedChatRouteSnapshot = {
  conversationId?: unknown;
  sessionKey?: unknown;
  initialPrompt?: unknown;
  initialPromptKey?: unknown;
  focusedTurnId?: unknown;
  focusedTurnKey?: unknown;
  initialAgentSlug?: unknown;
  initialSkillSlug?: unknown;
  initialSkillOption?: unknown;
  initialStockContext?: unknown;
};

function readPersistedSnapshotCandidate(key: string): PersistedChatRouteSnapshot | null {
  const snapshot = readCacheJson<PersistedChatRouteSnapshot>(key);
  return snapshot && typeof snapshot === 'object' ? snapshot : null;
}

export function readPersistedChatRouteSnapshot(): PersistedChatRouteSnapshot | null {
  const scopedSnapshot =
    readPersistedSnapshotCandidate(buildChatScopedStorageKey(ACTIVE_CHAT_ROUTE_STORAGE_KEY)) ??
    readPersistedSnapshotCandidate(buildChatScopedStorageKey(LEGACY_ACTIVE_CHAT_ROUTE_STORAGE_KEY));
  if (scopedSnapshot) {
    return scopedSnapshot;
  }

  return (
    readPersistedSnapshotCandidate(ACTIVE_CHAT_ROUTE_GLOBAL_STORAGE_KEY) ??
    readPersistedSnapshotCandidate(LEGACY_ACTIVE_CHAT_ROUTE_GLOBAL_STORAGE_KEY)
  );
}

export function writePersistedChatRouteSnapshot(snapshot: PersistedChatRouteSnapshot | null): void {
  const scopedStorageKey = buildChatScopedStorageKey(ACTIVE_CHAT_ROUTE_STORAGE_KEY);
  const legacyScopedStorageKey = buildChatScopedStorageKey(LEGACY_ACTIVE_CHAT_ROUTE_STORAGE_KEY);

  writeCacheJson(ACTIVE_CHAT_ROUTE_GLOBAL_STORAGE_KEY, snapshot);
  writeCacheJson(scopedStorageKey, snapshot);

  // Clear legacy generic keys so old cross-scope values stop shadowing the current brand/session.
  writeCacheJson(LEGACY_ACTIVE_CHAT_ROUTE_GLOBAL_STORAGE_KEY, null);
  writeCacheJson(legacyScopedStorageKey, null);
}
