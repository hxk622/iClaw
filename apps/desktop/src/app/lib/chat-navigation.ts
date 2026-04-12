import { buildChatScopedStorageKey } from './chat-persistence-scope.ts';
import { readCacheJson, writeCacheJson } from './persistence/cache-store.ts';
import { resolveInitialPrimaryView, resolveRequestedPrimaryViewFromUrl } from './chat-navigation-resolution.ts';

export const ACTIVE_WORKSPACE_SCENE_STORAGE_KEY = 'iclaw.desktop.active-workspace-scene.v1';
export const ACTIVE_WORKSPACE_PRIMARY_VIEW_STORAGE_KEY = 'iclaw.desktop.primary-view.v1';
export const ACTIVE_WORKSPACE_SELECTED_CONVERSATION_STORAGE_KEY = 'iclaw.desktop.selected-conversation.v1';

type PersistedWorkspaceSceneSnapshot = {
  primaryView?: unknown;
  selectedTurnId?: unknown;
  selectedConversationId?: unknown;
};

export type PersistedWorkspaceScene = {
  primaryView: string | null;
  selectedConversationId: string | null;
};

function normalizeOptionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function readPersistedWorkspaceScene(): PersistedWorkspaceScene {
  const snapshot = readCacheJson<PersistedWorkspaceSceneSnapshot>(
    buildChatScopedStorageKey(ACTIVE_WORKSPACE_SCENE_STORAGE_KEY),
  );
  const primaryViewSnapshot = readCacheJson<{ primaryView?: unknown }>(ACTIVE_WORKSPACE_PRIMARY_VIEW_STORAGE_KEY);
  const selectedConversationSnapshot = readCacheJson<{ selectedConversationId?: unknown }>(
    buildChatScopedStorageKey(ACTIVE_WORKSPACE_SELECTED_CONVERSATION_STORAGE_KEY),
  );
  if (!snapshot || typeof snapshot !== 'object') {
    return {
      primaryView: normalizeOptionalText(primaryViewSnapshot?.primaryView),
      selectedConversationId: normalizeOptionalText(selectedConversationSnapshot?.selectedConversationId),
    };
  }
  return {
    primaryView: normalizeOptionalText(primaryViewSnapshot?.primaryView) ?? normalizeOptionalText(snapshot.primaryView),
    selectedConversationId:
      normalizeOptionalText(selectedConversationSnapshot?.selectedConversationId) ??
      normalizeOptionalText(snapshot.selectedConversationId) ??
      normalizeOptionalText(snapshot.selectedTurnId),
  };
}

export function writePersistedWorkspaceScene(input: {
  primaryView?: string | null;
  selectedConversationId?: string | null;
}): void {
  const current = readPersistedWorkspaceScene();
  const next = {
    primaryView: input.primaryView === undefined ? current.primaryView : normalizeOptionalText(input.primaryView),
    selectedConversationId:
      input.selectedConversationId === undefined
        ? current.selectedConversationId
        : normalizeOptionalText(input.selectedConversationId),
  };
  writeCacheJson(
    ACTIVE_WORKSPACE_PRIMARY_VIEW_STORAGE_KEY,
    next.primaryView ? { primaryView: next.primaryView } : null,
  );
  writeCacheJson(
    buildChatScopedStorageKey(ACTIVE_WORKSPACE_SELECTED_CONVERSATION_STORAGE_KEY),
    next.selectedConversationId ? { selectedConversationId: next.selectedConversationId } : null,
  );

  // Keep legacy snapshot updated for backward compatibility with older builds.
  if (!next.primaryView && !next.selectedConversationId) {
    writeCacheJson(buildChatScopedStorageKey(ACTIVE_WORKSPACE_SCENE_STORAGE_KEY), null);
  } else {
    writeCacheJson(buildChatScopedStorageKey(ACTIVE_WORKSPACE_SCENE_STORAGE_KEY), {
      ...(next.primaryView ? { primaryView: next.primaryView } : {}),
      ...(next.selectedConversationId ? { selectedConversationId: next.selectedConversationId } : {}),
    });
  }
}

export { resolveInitialPrimaryView, resolveRequestedPrimaryViewFromUrl };
