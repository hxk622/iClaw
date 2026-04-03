import { getSessionIdFromKey, toCanonicalSessionKey } from '@iclaw/shared';
import { readCacheString, writeCacheString } from './persistence/cache-store';
import { buildChatScopedStorageKey } from './chat-persistence-scope';

const ACTIVE_GENERAL_CHAT_SESSION_STORAGE_KEY = 'iclaw.desktop.active-general-chat-session.v1';
const GENERAL_CHAT_SESSION_PREFIX = 'chat-';

export const CRON_SYSTEM_SESSION_KEY = 'system-cron';
export const GENERAL_CHAT_SESSION_MAX_TOTAL_TOKENS = 24_000;
export const GENERAL_CHAT_SESSION_MAX_MESSAGE_GROUPS = 24;

export type ChatSessionPressureSnapshot = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  messageGroups: number;
  hasPersistedHistory: boolean;
  overloaded: boolean;
};

function createSessionEntropy(): string {
  return Math.random().toString(36).slice(2, 8);
}

export function canonicalizeChatSessionKey(value?: string | null): string {
  return toCanonicalSessionKey(value);
}

export function tryCanonicalizeChatSessionKey(value?: string | null): string | null {
  try {
    return canonicalizeChatSessionKey(value);
  } catch {
    return null;
  }
}

export function getChatSessionId(value?: string | null): string {
  return getSessionIdFromKey(value);
}

export function createScopedChatSessionKey(sessionId: string): string {
  return canonicalizeChatSessionKey(sessionId);
}

export function createGeneralChatSessionKey(now = Date.now()): string {
  return createScopedChatSessionKey(`${GENERAL_CHAT_SESSION_PREFIX}${now}-${createSessionEntropy()}`);
}

export function createSuccessorGeneralChatSessionKey(currentSessionKey?: string | null): string {
  let next = createGeneralChatSessionKey();
  const current = canonicalizeChatSessionKey(currentSessionKey);
  while (next === current) {
    next = createGeneralChatSessionKey();
  }
  return next;
}

export function isGeneralChatSessionKey(value?: string | null): boolean {
  return getChatSessionId(value).toLowerCase().startsWith(GENERAL_CHAT_SESSION_PREFIX);
}

function isMainChatSessionKey(value?: string | null): boolean {
  return getChatSessionId(value).toLowerCase() === 'main';
}

function resolveActiveGeneralChatSessionStorageKey(): string {
  return buildChatScopedStorageKey(ACTIVE_GENERAL_CHAT_SESSION_STORAGE_KEY);
}

export function readPersistedActiveGeneralChatSessionKey(): string | null {
  const stored = readCacheString(resolveActiveGeneralChatSessionStorageKey());
  if (!stored) {
    return null;
  }
  const sessionKey = tryCanonicalizeChatSessionKey(stored);
  if (!sessionKey) {
    return null;
  }
  if (isMainChatSessionKey(sessionKey)) {
    return null;
  }
  return sessionKey;
}

export function writePersistedActiveGeneralChatSessionKey(sessionKey: string | null): void {
  if (!sessionKey) {
    writeCacheString(resolveActiveGeneralChatSessionStorageKey(), null);
    return;
  }
  const canonicalSessionKey = canonicalizeChatSessionKey(sessionKey);
  if (!isGeneralChatSessionKey(canonicalSessionKey) || isMainChatSessionKey(canonicalSessionKey)) {
    writeCacheString(resolveActiveGeneralChatSessionStorageKey(), null);
    return;
  }
  writeCacheString(resolveActiveGeneralChatSessionStorageKey(), canonicalSessionKey);
}

export function resolveInitialGeneralChatSessionKey(): string {
  return readPersistedActiveGeneralChatSessionKey() ?? createGeneralChatSessionKey();
}

export function buildChatSessionPressureSnapshot(input: {
  inputTokens?: number | null;
  outputTokens?: number | null;
  messageGroups?: number | null;
  hasPersistedHistory?: boolean;
}): ChatSessionPressureSnapshot {
  const inputTokens = Math.max(0, Number(input.inputTokens ?? 0) || 0);
  const outputTokens = Math.max(0, Number(input.outputTokens ?? 0) || 0);
  const messageGroups = Math.max(0, Number(input.messageGroups ?? 0) || 0);
  const totalTokens = inputTokens + outputTokens;
  const hasPersistedHistory = Boolean(input.hasPersistedHistory ?? (totalTokens > 0 || messageGroups > 0));

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    messageGroups,
    hasPersistedHistory,
    overloaded:
      hasPersistedHistory &&
      (totalTokens >= GENERAL_CHAT_SESSION_MAX_TOTAL_TOKENS ||
        messageGroups >= GENERAL_CHAT_SESSION_MAX_MESSAGE_GROUPS),
  };
}
