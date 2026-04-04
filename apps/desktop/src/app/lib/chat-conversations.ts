import { useEffect, useState } from 'react';
import {
  normalizeMessage,
  normalizeRoleForGrouping,
} from '@openclaw-ui/ui/chat/message-normalizer.ts';
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
  summary: string | null;
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
  summary?: string | null;
};

type SyncConversationMetadataInput = {
  conversationId?: string | null;
  sessionKey: string;
  kind?: ChatConversationKind;
  title?: string | null;
  summary?: string | null;
};

type LinkConversationSessionInput = {
  conversationId: string;
  fromSessionKey: string;
  toSessionKey: string;
  reason: string;
  summary?: string | null;
};

const CHAT_CONVERSATIONS_STORAGE_KEY = 'iclaw.chat.conversations.v1';
const CHAT_TURNS_STORAGE_KEY = 'iclaw.chat.turns.v1';
const CHAT_CONVERSATION_SNAPSHOT_PREFIX = 'iclaw.chat.conversation.v1';
const CHAT_CONVERSATIONS_UPDATED_EVENT = 'iclaw:chat-conversations:updated';
const MAX_CONVERSATIONS = 240;
const MAX_HANDOFFS_PER_CONVERSATION = 32;

function resolveChatConversationsStorageKey(): string {
  return buildChatScopedStorageKey(CHAT_CONVERSATIONS_STORAGE_KEY);
}

function resolveChatTurnsStorageKey(): string {
  return buildChatScopedStorageKey(CHAT_TURNS_STORAGE_KEY);
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

function isSeededTestValue(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.toLowerCase().includes('seeded-');
}

function isSeededConversationRecord(record: ChatConversationRecord): boolean {
  return (
    isSeededTestValue(record.id) ||
    isSeededTestValue(record.activeSessionKey) ||
    record.sessionKeys.some((sessionKey) => isSeededTestValue(sessionKey))
  );
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
    summary: normalizeText(raw.summary),
    activeSessionKey,
    sessionKeys,
    createdAt: normalizeText(raw.createdAt) || new Date().toISOString(),
    updatedAt: normalizeText(raw.updatedAt) || normalizeText(raw.createdAt) || new Date().toISOString(),
    handoffs,
  };
}

type LatestChatTurnMetadata = {
  conversationId: string;
  sessionKey: string | null;
  title: string | null;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
};

type SnapshotConversationMetadata = {
  conversationId: string;
  sessionKey: string | null;
  title: string | null;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
};

function clampText(value: string, limit: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, limit - 1)).trim()}…`;
}

function readLatestRoleText(messages: unknown[], role: 'user' | 'assistant'): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const normalized = normalizeMessage(messages[index]);
    if (normalizeRoleForGrouping(normalized.role) !== role) {
      continue;
    }
    const text = normalized.content
      .map((item) => (typeof item.text === 'string' ? item.text.trim() : ''))
      .filter(Boolean)
      .join(' ');
    if (!text) {
      continue;
    }
    if (role === 'assistant' && /^error:/i.test(text)) {
      continue;
    }
    return clampText(text, role === 'user' ? 48 : 72);
  }
  return null;
}

function extractSnapshotConversationMetadata(
  conversationId: string,
  snapshot: unknown,
): SnapshotConversationMetadata | null {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return null;
  }

  const raw = snapshot as Record<string, unknown>;
  const sessionKey = normalizeSessionKey(raw.sessionKey);
  const messages = Array.isArray(raw.messages) ? raw.messages : [];
  if (!sessionKey || messages.length === 0) {
    return null;
  }

  const updatedAtNumber =
    typeof raw.savedAt === 'number' && Number.isFinite(raw.savedAt) ? raw.savedAt : Date.now();
  const updatedAt = new Date(updatedAtNumber).toISOString();
  const latestUserAsk = readLatestRoleText(messages, 'user');
  const latestAssistantReply = readLatestRoleText(messages, 'assistant');

  return {
    conversationId,
    sessionKey,
    title: latestUserAsk,
    summary: latestAssistantReply || latestUserAsk,
    createdAt: updatedAt,
    updatedAt,
  };
}

function readSnapshotConversationMetadataByConversation(): Map<string, SnapshotConversationMetadata> {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return new Map();
  }

  const storage = window.localStorage;
  const scopeSuffix = resolveChatConversationsStorageKey().replace(CHAT_CONVERSATIONS_STORAGE_KEY, '');
  const metadataByConversation = new Map<string, SnapshotConversationMetadata>();

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key || !key.startsWith(`${CHAT_CONVERSATION_SNAPSHOT_PREFIX}:`) || !key.endsWith(scopeSuffix)) {
      continue;
    }

    const match = key.match(/^iclaw\.chat\.conversation\.v1:[^:]+:([^:]+):scope:/);
    const conversationId = normalizeText(match?.[1]);
    if (!conversationId || isSeededTestValue(conversationId)) {
      continue;
    }

    const metadata = extractSnapshotConversationMetadata(
      conversationId,
      readCacheJson<unknown>(key),
    );
    if (!metadata) {
      continue;
    }

    const current = metadataByConversation.get(conversationId);
    if (current && new Date(current.updatedAt).getTime() >= new Date(metadata.updatedAt).getTime()) {
      continue;
    }
    metadataByConversation.set(conversationId, metadata);
  }

  return metadataByConversation;
}

function readLatestTurnMetadataByConversation(): Map<string, LatestChatTurnMetadata> {
  const parsed = readCacheJson<unknown[]>(resolveChatTurnsStorageKey());
  if (!Array.isArray(parsed)) {
    return new Map();
  }

  const latestTurnByConversation = new Map<string, LatestChatTurnMetadata>();
  parsed.forEach((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return;
    }

    const raw = item as Record<string, unknown>;
    const source = normalizeText(raw.source) ?? 'chat';
    if (source !== 'chat') {
      return;
    }

    const conversationId = normalizeText(raw.conversationId);
    const sessionKey = normalizeSessionKey(raw.sessionKey);
    const updatedAt = normalizeText(raw.updatedAt) || normalizeText(raw.createdAt) || new Date(0).toISOString();
    const createdAt = normalizeText(raw.createdAt) || updatedAt;
    if (!conversationId || isSeededTestValue(conversationId) || isSeededTestValue(sessionKey)) {
      return;
    }

    const current = latestTurnByConversation.get(conversationId);
    if (current && new Date(current.updatedAt).getTime() >= new Date(updatedAt).getTime()) {
      return;
    }

    latestTurnByConversation.set(conversationId, {
      conversationId,
      sessionKey,
      title: normalizeText(raw.title) || normalizeText(raw.prompt),
      summary: normalizeText(raw.summary) || normalizeText(raw.prompt),
      createdAt,
      updatedAt,
    });
  });

  return latestTurnByConversation;
}

function repairConversationList(records: ChatConversationRecord[]): ChatConversationRecord[] {
  const latestTurnMetadataByConversation = readLatestTurnMetadataByConversation();
  const snapshotMetadataByConversation = readSnapshotConversationMetadataByConversation();
  let changed = false;
  const knownConversationIds = new Set(records.map((record) => record.id));
  const repairedRecords = records.map((record) => {
    const latestTurn = latestTurnMetadataByConversation.get(record.id);
    const snapshotMetadata = snapshotMetadataByConversation.get(record.id);
    if (!latestTurn && !snapshotMetadata) {
      return record;
    }

    const nextTitle = record.title || latestTurn?.title || snapshotMetadata?.title || null;
    const nextSummary = latestTurn?.summary || snapshotMetadata?.summary || record.summary || null;
    const nextActiveSessionKey = latestTurn?.sessionKey || snapshotMetadata?.sessionKey || record.activeSessionKey;
    const nextSessionKeys = dedupeSessionKeys(
      [
        ...record.sessionKeys,
        latestTurn?.sessionKey ?? null,
        snapshotMetadata?.sessionKey ?? null,
      ].filter((value): value is string => Boolean(value)),
      nextActiveSessionKey,
    );
    const nextUpdatedAt =
      [record.updatedAt, latestTurn?.updatedAt, snapshotMetadata?.updatedAt]
        .filter((value): value is string => Boolean(value))
        .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? record.updatedAt;

    if (
      nextTitle === record.title &&
      nextSummary === record.summary &&
      nextUpdatedAt === record.updatedAt &&
      nextActiveSessionKey === record.activeSessionKey &&
      nextSessionKeys.length === record.sessionKeys.length &&
      nextSessionKeys.every((value, currentIndex) => value === record.sessionKeys[currentIndex])
    ) {
      return record;
    }

    changed = true;
    return {
      ...record,
      title: nextTitle,
      summary: nextSummary,
      activeSessionKey: nextActiveSessionKey,
      sessionKeys: nextSessionKeys,
      updatedAt: nextUpdatedAt,
    };
  });

  const discoveredConversationIds = new Set<string>([
    ...latestTurnMetadataByConversation.keys(),
    ...snapshotMetadataByConversation.keys(),
  ]);

  discoveredConversationIds.forEach((conversationId) => {
    if (knownConversationIds.has(conversationId)) {
      return;
    }

    const latestTurn = latestTurnMetadataByConversation.get(conversationId) ?? null;
    const snapshotMetadata = snapshotMetadataByConversation.get(conversationId) ?? null;
    const sessionKey = latestTurn?.sessionKey || snapshotMetadata?.sessionKey || null;
    if (!sessionKey) {
      return;
    }

    changed = true;
    repairedRecords.push({
      id: conversationId,
      kind: 'general',
      title: latestTurn?.title || snapshotMetadata?.title || null,
      summary: latestTurn?.summary || snapshotMetadata?.summary || null,
      activeSessionKey: sessionKey,
      sessionKeys: dedupeSessionKeys(
        [latestTurn?.sessionKey ?? null, snapshotMetadata?.sessionKey ?? null].filter(
          (value): value is string => Boolean(value),
        ),
        sessionKey,
      ),
      createdAt: latestTurn?.createdAt || snapshotMetadata?.createdAt || new Date().toISOString(),
      updatedAt: latestTurn?.updatedAt || snapshotMetadata?.updatedAt || new Date().toISOString(),
      handoffs: [],
    });
  });

  repairedRecords.sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());

  if (changed) {
    writeConversationList(repairedRecords);
  }

  return repairedRecords;
}

function readConversationList(): ChatConversationRecord[] {
  const parsed = readCacheJson<unknown[]>(resolveChatConversationsStorageKey());
  if (!Array.isArray(parsed)) {
    return [];
  }
  const records = parsed
    .map(normalizeConversationRecord)
    .filter((item): item is ChatConversationRecord => Boolean(item))
    .filter((record) => !isSeededConversationRecord(record))
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .slice(0, MAX_CONVERSATIONS);
  return repairConversationList(records);
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
  const summary = normalizeText(input.summary);
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
        summary: summary || matched.summary,
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
      summary,
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

export function syncChatConversationMetadata(input: SyncConversationMetadataInput): ChatConversationRecord | null {
  const sessionKey = normalizeSessionKey(input.sessionKey);
  if (!sessionKey) {
    return null;
  }

  const conversationId = normalizeText(input.conversationId);
  const title = normalizeText(input.title);
  const summary = normalizeText(input.summary);
  const kind = input.kind ?? 'general';
  let resolvedConversationId: string | null = null;

  const updated = updateConversationList((current) => {
    const matched =
      (conversationId ? current.find((record) => record.id === conversationId) ?? null : null) ??
      current.find((record) => record.sessionKeys.includes(sessionKey)) ??
      null;

    if (!matched) {
      if (!conversationId) {
        return current;
      }
      const createdAt = new Date().toISOString();
      const createdRecord: ChatConversationRecord = {
        id: conversationId,
        kind,
        title,
        summary,
        activeSessionKey: sessionKey,
        sessionKeys: [sessionKey],
        createdAt,
        updatedAt: createdAt,
        handoffs: [],
      };
      resolvedConversationId = createdRecord.id;
      return [createdRecord, ...current];
    }

    const nextTitle = matched.title || title;
    const nextSummary = summary || matched.summary;
    const nextSessionKeys = dedupeSessionKeys(matched.sessionKeys, sessionKey);
    const hasChanges =
      nextTitle !== matched.title ||
      nextSummary !== matched.summary ||
      matched.activeSessionKey !== sessionKey ||
      nextSessionKeys.length !== matched.sessionKeys.length ||
      nextSessionKeys.some((value, index) => value !== matched.sessionKeys[index]);

    resolvedConversationId = matched.id;
    if (!hasChanges) {
      return current;
    }

    const updatedRecord: ChatConversationRecord = {
      ...matched,
      title: nextTitle,
      summary: nextSummary,
      activeSessionKey: sessionKey,
      sessionKeys: nextSessionKeys,
      updatedAt: new Date().toISOString(),
    };

    return [updatedRecord, ...current.filter((record) => record.id !== matched.id)];
  });

  return updated.find((record) => record.id === resolvedConversationId) ?? null;
}

export function renameChatConversation(conversationId: string, title: string): ChatConversationRecord | null {
  const normalizedConversationId = normalizeText(conversationId);
  const normalizedTitle = normalizeText(title);
  if (!normalizedConversationId || !normalizedTitle) {
    return null;
  }

  const updated = updateConversationList((current) =>
    current.map((record) =>
      record.id === normalizedConversationId
        ? {
            ...record,
            title: normalizedTitle.slice(0, 48),
            updatedAt: new Date().toISOString(),
          }
        : record,
    ),
  );

  return updated.find((record) => record.id === normalizedConversationId) ?? null;
}

export function deleteChatConversation(conversationId: string): void {
  const normalizedConversationId = normalizeText(conversationId);
  if (!normalizedConversationId) {
    return;
  }

  updateConversationList((current) =>
    current.filter((record) => record.id !== normalizedConversationId)
  );
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
