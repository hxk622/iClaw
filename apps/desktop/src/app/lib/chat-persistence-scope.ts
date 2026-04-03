import { readCacheString, writeCacheString } from './persistence/cache-store';
import { buildStorageKey } from './storage';

const CHAT_PERSISTENCE_USER_SCOPE_STORAGE_KEY = buildStorageKey('chat.user_scope');
const GUEST_CHAT_PERSISTENCE_SCOPE = 'guest';

function normalizeChatPersistenceScope(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function serializeChatPersistenceScope(value: string | null): string {
  return value ? encodeURIComponent(value) : GUEST_CHAT_PERSISTENCE_SCOPE;
}

export function readCurrentChatPersistenceUserScope(): string | null {
  return normalizeChatPersistenceScope(readCacheString(CHAT_PERSISTENCE_USER_SCOPE_STORAGE_KEY));
}

export function writeCurrentChatPersistenceUserScope(userScope: string | null): void {
  writeCacheString(CHAT_PERSISTENCE_USER_SCOPE_STORAGE_KEY, normalizeChatPersistenceScope(userScope));
}

export function buildChatScopedStorageKey(baseKey: string): string {
  return `${baseKey}:scope:${serializeChatPersistenceScope(readCurrentChatPersistenceUserScope())}`;
}

export function buildChatScopedStoragePrefix(basePrefix: string): string {
  return `${basePrefix}:scope:${serializeChatPersistenceScope(readCurrentChatPersistenceUserScope())}`;
}
