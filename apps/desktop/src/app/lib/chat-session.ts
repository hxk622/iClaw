import { readCacheString, writeCacheString } from './persistence/cache-store';

const ACTIVE_GENERAL_CHAT_SESSION_STORAGE_KEY = 'iclaw.desktop.active-general-chat-session.v1';
const GENERAL_CHAT_SESSION_PREFIX = 'chat-';
const LEGACY_MAIN_CHAT_SESSION_KEYS = new Set(['main', 'agent:main:main']);

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

function normalizeSessionKey(value?: string | null): string {
  return value?.trim() ?? '';
}

function createSessionEntropy(): string {
  return Math.random().toString(36).slice(2, 8);
}

export function createGeneralChatSessionKey(now = Date.now()): string {
  return `${GENERAL_CHAT_SESSION_PREFIX}${now}-${createSessionEntropy()}`;
}

export function createSuccessorGeneralChatSessionKey(currentSessionKey?: string | null): string {
  let next = createGeneralChatSessionKey();
  const current = normalizeSessionKey(currentSessionKey);
  while (current && next === current) {
    next = createGeneralChatSessionKey();
  }
  return next;
}

export function isGeneralChatSessionKey(value?: string | null): boolean {
  const normalized = normalizeSessionKey(value).toLowerCase();
  return normalized.startsWith(GENERAL_CHAT_SESSION_PREFIX);
}

export function isLegacyMainChatSessionKey(value?: string | null): boolean {
  const normalized = normalizeSessionKey(value).toLowerCase();
  return LEGACY_MAIN_CHAT_SESSION_KEYS.has(normalized);
}

export function readPersistedActiveGeneralChatSessionKey(): string | null {
  const stored = normalizeSessionKey(readCacheString(ACTIVE_GENERAL_CHAT_SESSION_STORAGE_KEY));
  if (!stored || isLegacyMainChatSessionKey(stored)) {
    return null;
  }
  return stored;
}

export function writePersistedActiveGeneralChatSessionKey(sessionKey: string | null): void {
  const normalized = normalizeSessionKey(sessionKey);
  if (!normalized || !isGeneralChatSessionKey(normalized) || isLegacyMainChatSessionKey(normalized)) {
    writeCacheString(ACTIVE_GENERAL_CHAT_SESSION_STORAGE_KEY, null);
    return;
  }
  writeCacheString(ACTIVE_GENERAL_CHAT_SESSION_STORAGE_KEY, normalized);
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
