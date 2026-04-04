import { buildChatScopedStorageKey } from './chat-persistence-scope.ts';
import { readCacheJson, writeCacheJson } from './persistence/cache-store.ts';
import { resolveInitialPrimaryView, resolveRequestedPrimaryViewFromUrl } from './chat-navigation-resolution.ts';

export const ACTIVE_WORKSPACE_SCENE_STORAGE_KEY = 'iclaw.desktop.active-workspace-scene.v1';

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
  if (!snapshot || typeof snapshot !== 'object') {
    return {
      primaryView: null,
      selectedConversationId: null,
    };
  }
  return {
    primaryView: normalizeOptionalText(snapshot.primaryView),
    selectedConversationId:
      normalizeOptionalText(snapshot.selectedConversationId) ?? normalizeOptionalText(snapshot.selectedTurnId),
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
  if (!next.primaryView && !next.selectedConversationId) {
    writeCacheJson(buildChatScopedStorageKey(ACTIVE_WORKSPACE_SCENE_STORAGE_KEY), null);
    return;
  }
  writeCacheJson(buildChatScopedStorageKey(ACTIVE_WORKSPACE_SCENE_STORAGE_KEY), {
    ...(next.primaryView ? {primaryView: next.primaryView} : {}),
    ...(next.selectedConversationId ? {selectedConversationId: next.selectedConversationId} : {}),
  });
}

export { resolveInitialPrimaryView, resolveRequestedPrimaryViewFromUrl };
