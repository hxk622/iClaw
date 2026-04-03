import {
  normalizeMessage,
  normalizeRoleForGrouping,
} from '@openclaw-ui/ui/chat/message-normalizer.ts';
import { readChatConversation } from './chat-conversations';
import { readCacheJson, removeCacheKeys, writeCacheJson } from './persistence/cache-store';
import { canonicalizeChatSessionKey } from './chat-session';
import { buildChatScopedStorageKey } from './chat-persistence-scope';

export type ChatSessionSnapshot = {
  sessionKey: string;
  savedAt: number;
  messages: unknown[];
  pendingUsageSettlements?: unknown[];
};

const CHAT_SESSION_SNAPSHOT_PREFIX = 'iclaw.chat.session.v1';
const CHAT_CONVERSATION_SNAPSHOT_PREFIX = 'iclaw.chat.conversation.v1';

function normalizeText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function clampText(value: string, limit: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, limit - 1)).trim()}…`;
}

function normalizeSnapshot(
  snapshot: ChatSessionSnapshot | null | undefined,
  sessionKey: string,
): ChatSessionSnapshot | null {
  if (!snapshot || !Array.isArray(snapshot.messages)) {
    return null;
  }
  return {
    sessionKey: canonicalizeChatSessionKey(sessionKey),
    savedAt: typeof snapshot.savedAt === 'number' ? snapshot.savedAt : Date.now(),
    messages: snapshot.messages,
    pendingUsageSettlements: Array.isArray(snapshot.pendingUsageSettlements) ? snapshot.pendingUsageSettlements : [],
  };
}

function measureSnapshotRichness(snapshot: ChatSessionSnapshot | null): {
  messageCount: number;
  textMessageCount: number;
  totalTextChars: number;
  assistantTextChars: number;
} {
  if (!snapshot) {
    return {
      messageCount: 0,
      textMessageCount: 0,
      totalTextChars: 0,
      assistantTextChars: 0,
    };
  }

  let textMessageCount = 0;
  let totalTextChars = 0;
  let assistantTextChars = 0;

  snapshot.messages.forEach((message) => {
    const normalized = normalizeMessage(message);
    const role = normalizeRoleForGrouping(normalized.role);
    const text = normalized.content
      .map((item) => (typeof item.text === 'string' ? item.text.trim() : ''))
      .filter(Boolean)
      .join(' ');

    if (!text) {
      return;
    }

    textMessageCount += 1;
    totalTextChars += text.length;
    if (role === 'assistant') {
      assistantTextChars += text.length;
    }
  });

  return {
    messageCount: snapshot.messages.length,
    textMessageCount,
    totalTextChars,
    assistantTextChars,
  };
}

function compareSnapshotRichness(
  left: ChatSessionSnapshot | null,
  right: ChatSessionSnapshot | null,
): number {
  const leftScore = measureSnapshotRichness(left);
  const rightScore = measureSnapshotRichness(right);

  if (leftScore.assistantTextChars !== rightScore.assistantTextChars) {
    return leftScore.assistantTextChars - rightScore.assistantTextChars;
  }
  if (leftScore.totalTextChars !== rightScore.totalTextChars) {
    return leftScore.totalTextChars - rightScore.totalTextChars;
  }
  if (leftScore.textMessageCount !== rightScore.textMessageCount) {
    return leftScore.textMessageCount - rightScore.textMessageCount;
  }
  if (leftScore.messageCount !== rightScore.messageCount) {
    return leftScore.messageCount - rightScore.messageCount;
  }
  return (left?.savedAt ?? 0) - (right?.savedAt ?? 0);
}

function choosePreferredSnapshot(
  primary: ChatSessionSnapshot | null,
  secondary: ChatSessionSnapshot | null,
): ChatSessionSnapshot | null {
  if (!primary) {
    return secondary;
  }
  if (!secondary) {
    return primary;
  }
  return compareSnapshotRichness(primary, secondary) >= 0 ? primary : secondary;
}

function buildConversationBoundaryMessage(params: {
  boundaryId: string;
  summary: string | null;
  timestamp: number;
}): Record<string, unknown> {
  return {
    role: 'system',
    content: [
      {
        type: 'text',
        text: params.summary ? `已延续上一段对话：${params.summary}` : '已延续上一段对话。',
      },
    ],
    timestamp: params.timestamp,
    __iclawConversationBoundaryId: params.boundaryId,
  };
}

function messageHasBoundaryId(message: unknown, boundaryId: string): boolean {
  return Boolean(
    message &&
      typeof message === 'object' &&
      '__iclawConversationBoundaryId' in message &&
      message.__iclawConversationBoundaryId === boundaryId,
  );
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

export function buildChatSessionSnapshotStorageKey(appName: string, sessionKey: string): string {
  const normalizedAppName = appName.trim().toLowerCase() || 'default';
  const normalizedSessionKey = canonicalizeChatSessionKey(sessionKey).toLowerCase();
  return buildChatScopedStorageKey(`${CHAT_SESSION_SNAPSHOT_PREFIX}:${normalizedAppName}:${normalizedSessionKey}`);
}

export function buildChatConversationSnapshotStorageKey(appName: string, conversationId: string): string {
  const normalizedAppName = appName.trim().toLowerCase() || 'default';
  const normalizedConversationId = conversationId.trim().toLowerCase();
  return buildChatScopedStorageKey(
    `${CHAT_CONVERSATION_SNAPSHOT_PREFIX}:${normalizedAppName}:${normalizedConversationId}`,
  );
}

export function readStoredChatSnapshot(params: {
  appName: string;
  sessionKey: string;
  conversationId?: string | null;
}): ChatSessionSnapshot | null {
  const sessionSnapshot = normalizeSnapshot(
    readCacheJson<ChatSessionSnapshot>(buildChatSessionSnapshotStorageKey(params.appName, params.sessionKey)),
    params.sessionKey,
  );
  const conversationSnapshot = normalizeSnapshot(
    typeof params.conversationId === 'string' && params.conversationId.trim()
      ? readCacheJson<ChatSessionSnapshot>(
          buildChatConversationSnapshotStorageKey(params.appName, params.conversationId),
        )
      : null,
    params.sessionKey,
  );
  return choosePreferredSnapshot(sessionSnapshot, conversationSnapshot);
}

export function writeStoredChatSnapshot(params: {
  appName: string;
  sessionKey: string;
  snapshot: ChatSessionSnapshot | null;
  conversationId?: string | null;
}): void {
  const sessionStorageKey = buildChatSessionSnapshotStorageKey(params.appName, params.sessionKey);
  const conversationStorageKey =
    typeof params.conversationId === 'string' && params.conversationId.trim()
      ? buildChatConversationSnapshotStorageKey(params.appName, params.conversationId)
      : null;

  const existingSessionSnapshot = normalizeSnapshot(
    readCacheJson<ChatSessionSnapshot>(sessionStorageKey),
    params.sessionKey,
  );
  const existingConversationSnapshot = normalizeSnapshot(
    conversationStorageKey ? readCacheJson<ChatSessionSnapshot>(conversationStorageKey) : null,
    params.sessionKey,
  );
  const preservedSnapshot = choosePreferredSnapshot(existingSessionSnapshot, existingConversationSnapshot);
  const incomingSnapshot = normalizeSnapshot(params.snapshot, params.sessionKey);
  const resolvedSnapshot = choosePreferredSnapshot(incomingSnapshot, preservedSnapshot);

  if (!resolvedSnapshot || resolvedSnapshot.messages.length === 0) {
    removeCacheKeys(conversationStorageKey ? [sessionStorageKey, conversationStorageKey] : [sessionStorageKey]);
    return;
  }

  writeCacheJson(sessionStorageKey, resolvedSnapshot);
  if (conversationStorageKey) {
    writeCacheJson(conversationStorageKey, resolvedSnapshot);
  }
}

export function deleteStoredChatSnapshots(params: {
  appName: string;
  sessionKeys?: string[] | null;
  conversationId?: string | null;
}): void {
  const keys = new Set<string>();

  (params.sessionKeys ?? []).forEach((sessionKey) => {
    const normalizedSessionKey = normalizeText(sessionKey);
    if (!normalizedSessionKey) {
      return;
    }
    keys.add(buildChatSessionSnapshotStorageKey(params.appName, normalizedSessionKey));
  });

  const normalizedConversationId = normalizeText(params.conversationId);
  if (normalizedConversationId) {
    keys.add(buildChatConversationSnapshotStorageKey(params.appName, normalizedConversationId));
  }

  if (keys.size === 0) {
    return;
  }
  removeCacheKeys(Array.from(keys));
}

export function deriveConversationHandoffSummary(params: {
  appName: string;
  sessionKey: string;
  conversationId?: string | null;
}): string | null {
  const snapshot = readStoredChatSnapshot(params);
  const messages = Array.isArray(snapshot?.messages) ? snapshot.messages : [];
  if (messages.length === 0) {
    return null;
  }

  const latestUserAsk = readLatestRoleText(messages, 'user');
  const latestAssistantReply = readLatestRoleText(messages, 'assistant');

  if (latestUserAsk && latestAssistantReply) {
    return `用户最近在问“${latestUserAsk}”，助手已推进到“${latestAssistantReply}”`;
  }
  if (latestUserAsk) {
    return `用户最近在问“${latestUserAsk}”`;
  }
  if (latestAssistantReply) {
    return `助手已推进到“${latestAssistantReply}”`;
  }
  return null;
}

export function hydrateChatSnapshotForRender(params: {
  appName: string;
  sessionKey: string;
  conversationId?: string | null;
}): ChatSessionSnapshot | null {
  const snapshot = readStoredChatSnapshot(params);
  if (!snapshot || !params.conversationId) {
    return snapshot;
  }

  const conversation = readChatConversation(params.conversationId);
  const latestHandoff =
    conversation?.handoffs
      .filter((entry) => entry.toSessionKey === params.sessionKey)
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0] ?? null;

  if (!latestHandoff) {
    return snapshot;
  }
  if (snapshot.messages.some((message) => messageHasBoundaryId(message, latestHandoff.id))) {
    return snapshot;
  }

  const withBoundary: ChatSessionSnapshot = {
    ...snapshot,
    messages: [
      ...snapshot.messages,
      buildConversationBoundaryMessage({
        boundaryId: latestHandoff.id,
        summary: normalizeText(latestHandoff.summary),
        timestamp: Date.parse(latestHandoff.createdAt) || snapshot.savedAt || Date.now(),
      }),
    ],
  };

  writeStoredChatSnapshot({
    appName: params.appName,
    sessionKey: params.sessionKey,
    conversationId: params.conversationId,
    snapshot: withBoundary,
  });

  return withBoundary;
}
