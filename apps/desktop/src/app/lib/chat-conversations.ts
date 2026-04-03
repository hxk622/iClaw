import { useEffect, useState } from 'react';
import { readCacheJson, writeCacheJson } from './persistence/cache-store';
import { tryCanonicalizeChatSessionKey } from './chat-session';
import { buildChatScopedStorageKey } from './chat-persistence-scope';

export type ChatConversationKind =
  | 'general'
  | 'skill'
  | 'lobster'
  | 'investment-expert'
  | 'stock-research'
  | 'fund-research';

export type ChatConversationHandoffRecord = {
  id: string;
  fromSessionKey: string;
  toSessionKey: string;
  reason: string;
  summary: string | null;
  createdAt: string;
};

export type ChatConversationRecord = {
  id: string;
  kind: ChatConversationKind;
  title: string | null;
  activeSessionKey: string;
  sessionKeys: string[];
  createdAt: string;
  updatedAt: string;
  handoffs: ChatConversationHandoffRecord[];
};

type EnsureConversationInput = {
  conversationId?: string | null;
  sessionKey: string;
  kind?: ChatConversationKind;
  title?: string | null;
};

type LinkConversationSessionInput = {
  conversationId: string;
  fromSessionKey: string;
  toSessionKey: string;
  reason: string;
  summary?: string | null;
};

const CHAT_CONVERSATIONS_STORAGE_KEY = 'iclaw.chat.conversations.v1';
const CHAT_CONVERSATIONS_UPDATED_EVENT = 'iclaw:chat-conversations:updated';
const MAX_CONVERSATIONS = 240;
const MAX_HANDOFFS_PER_CONVERSATION = 32;

function resolveChatConversationsStorageKey(): string {
  return buildChatScopedStorageKey(CHAT_CONVERSATIONS_STORAGE_KEY);
}

function emitChatConversationsUpdated(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new CustomEvent(CHAT_CONVERSATIONS_UPDATED_EVENT));
}

function normalizeText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeSessionKey(value: unknown): string | null {
  const text = normalizeText(value);
  return text ? tryCanonicalizeChatSessionKey(text) : null;
}

function normalizeKind(value: unknown): ChatConversationKind {
  return value === 'general' ||
    value === 'skill' ||
    value === 'lobster' ||
    value === 'investment-expert' ||
    value === 'stock-research' ||
    value === 'fund-research'
    ? value
    : 'general';
}

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function dedupeSessionKeys(sessionKeys: string[], activeSessionKey: string): string[] {
  const normalized = Array.from(
    new Set(
      [activeSessionKey, ...sessionKeys]
        .map((value) => normalizeSessionKey(value))
        .filter((value): value is string => Boolean(value)),
    ),
  );
  return normalized;
}

function normalizeConversationRecord(value: unknown): ChatConversationRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const id = normalizeText(raw.id);
  const activeSessionKey = normalizeSessionKey(raw.activeSessionKey);
  if (!id || !activeSessionKey) {
    return null;
  }

  const rawSessionKeys = Array.isArray(raw.sessionKeys) ? raw.sessionKeys : [];
  const sessionKeys = dedupeSessionKeys(
    rawSessionKeys.map((item) => normalizeSessionKey(item)).filter((item): item is string => Boolean(item)),
    activeSessionKey,
  );

  const rawHandoffs = Array.isArray(raw.handoffs) ? raw.handoffs : [];
  const handoffs = rawHandoffs
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return null;
      }
      const entry = item as Record<string, unknown>;
      const handoffId = normalizeText(entry.id);
      const fromSessionKey = normalizeSessionKey(entry.fromSessionKey);
      const toSessionKey = normalizeSessionKey(entry.toSessionKey);
      const reason = normalizeText(entry.reason);
      if (!handoffId || !fromSessionKey || !toSessionKey || !reason) {
        return null;
      }
      return {
        id: handoffId,
        fromSessionKey,
        toSessionKey,
        reason,
        summary: normalizeText(entry.summary),
        createdAt: normalizeText(entry.createdAt) || new Date().toISOString(),
      } satisfies ChatConversationHandoffRecord;
    })
    .filter((item): item is ChatConversationHandoffRecord => Boolean(item))
    .slice(0, MAX_HANDOFFS_PER_CONVERSATION);

  return {
    id,
    kind: normalizeKind(raw.kind),
    title: normalizeText(raw.title),
    activeSessionKey,
    sessionKeys,
    createdAt: normalizeText(raw.createdAt) || new Date().toISOString(),
    updatedAt: normalizeText(raw.updatedAt) || normalizeText(raw.createdAt) || new Date().toISOString(),
    handoffs,
  };
}

function readConversationList(): ChatConversationRecord[] {
  const parsed = readCacheJson<unknown[]>(resolveChatConversationsStorageKey());
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed
    .map(normalizeConversationRecord)
    .filter((item): item is ChatConversationRecord => Boolean(item))
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .slice(0, MAX_CONVERSATIONS);
}

function writeConversationList(records: ChatConversationRecord[]): void {
  writeCacheJson(resolveChatConversationsStorageKey(), records.slice(0, MAX_CONVERSATIONS));
  emitChatConversationsUpdated();
}

function updateConversationList(
  updater: (records: ChatConversationRecord[]) => ChatConversationRecord[],
): ChatConversationRecord[] {
  const next = updater(readConversationList());
  writeConversationList(next);
  return next;
}

export function readChatConversations(): ChatConversationRecord[] {
  return readConversationList();
}

export function readChatConversation(conversationId: string): ChatConversationRecord | null {
  const normalizedConversationId = normalizeText(conversationId);
  if (!normalizedConversationId) {
    return null;
  }
  return readConversationList().find((record) => record.id === normalizedConversationId) ?? null;
}

export function findChatConversationBySessionKey(sessionKey: string): ChatConversationRecord | null {
  const normalizedSessionKey = normalizeSessionKey(sessionKey);
  if (!normalizedSessionKey) {
    return null;
  }
  return (
    readConversationList().find((record) => record.sessionKeys.includes(normalizedSessionKey)) ?? null
  );
}

export function ensureChatConversation(input: EnsureConversationInput): ChatConversationRecord {
  const sessionKey = normalizeSessionKey(input.sessionKey);
  if (!sessionKey) {
    throw new Error('sessionKey is required');
  }

  const kind = input.kind ?? 'general';
  const title = normalizeText(input.title);
  const requestedConversationId = normalizeText(input.conversationId);

  let resolvedConversationId: string | null = null;

  const records = updateConversationList((current) => {
    const byConversationId = requestedConversationId
      ? current.find((record) => record.id === requestedConversationId) ?? null
      : null;
    const bySessionKey = current.find((record) => record.sessionKeys.includes(sessionKey)) ?? null;
    const matched = byConversationId ?? bySessionKey;

    if (matched) {
      const updatedRecord: ChatConversationRecord = {
        ...matched,
        kind: matched.kind,
        title: matched.title || title,
        activeSessionKey: sessionKey,
        sessionKeys: dedupeSessionKeys(matched.sessionKeys, sessionKey),
        updatedAt: new Date().toISOString(),
      };
      resolvedConversationId = updatedRecord.id;
      return [updatedRecord, ...current.filter((record) => record.id !== matched.id)];
    }

    const createdRecord: ChatConversationRecord = {
      id: requestedConversationId || createId('conv'),
      kind,
      title,
      activeSessionKey: sessionKey,
      sessionKeys: [sessionKey],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      handoffs: [],
    };
    resolvedConversationId = createdRecord.id;
    return [createdRecord, ...current];
  });

  return records.find((record) => record.id === resolvedConversationId) ??
    records[0]!;
}

export function linkSessionToConversation(input: LinkConversationSessionInput): ChatConversationRecord | null {
  const conversationId = normalizeText(input.conversationId);
  const fromSessionKey = normalizeSessionKey(input.fromSessionKey);
  const toSessionKey = normalizeSessionKey(input.toSessionKey);
  const reason = normalizeText(input.reason);
  if (!conversationId || !fromSessionKey || !toSessionKey || !reason) {
    return null;
  }

  const updated = updateConversationList((current) =>
    current.map((record) => {
      if (record.id !== conversationId) {
        return record;
      }

      const existingHandoff =
        record.handoffs.find(
          (handoff) => handoff.fromSessionKey === fromSessionKey && handoff.toSessionKey === toSessionKey,
        ) ?? null;
      const nextHandoffs = existingHandoff
        ? record.handoffs
        : [
            {
              id: createId('handoff'),
              fromSessionKey,
              toSessionKey,
              reason,
              summary: normalizeText(input.summary),
              createdAt: new Date().toISOString(),
            },
            ...record.handoffs,
          ].slice(0, MAX_HANDOFFS_PER_CONVERSATION);

      return {
        ...record,
        activeSessionKey: toSessionKey,
        sessionKeys: dedupeSessionKeys(record.sessionKeys, toSessionKey),
        handoffs: nextHandoffs,
        updatedAt: new Date().toISOString(),
      };
    }),
  );

  return updated.find((record) => record.id === conversationId) ?? null;
}

export function subscribeChatConversations(listener: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key && event.key !== CHAT_CONVERSATIONS_STORAGE_KEY) {
      return;
    }
    listener();
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(CHAT_CONVERSATIONS_UPDATED_EVENT, listener);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(CHAT_CONVERSATIONS_UPDATED_EVENT, listener);
  };
}

export function useChatConversations(): ChatConversationRecord[] {
  const [conversations, setConversations] = useState<ChatConversationRecord[]>(() => readChatConversations());

  useEffect(() => {
    setConversations(readChatConversations());
    return subscribeChatConversations(() => {
      setConversations(readChatConversations());
    });
  }, []);

  return conversations;
}
