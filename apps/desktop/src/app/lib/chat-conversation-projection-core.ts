import {
  buildCreditBlockedTurnMessage,
  isCreditBlockedTurnError,
} from './chat-credit-block.ts';

export type ChatConversationProjectionConversation = {
  id: string;
  title: string | null;
  summary: string | null;
  activeSessionKey: string;
  updatedAt: string;
};

export type ChatConversationProjectionTurn = {
  conversationId: string;
  sessionKey: string;
  title: string | null;
  summary: string | null;
  prompt: string;
  source: 'chat' | 'cron';
  status?: 'running' | 'completed' | 'failed';
  lastError?: string | null;
};

export type ChatConversationProjectionSnapshot = {
  messages: unknown[];
} | null;

export type ChatConversationProjection = {
  conversationId: string;
  activeSessionKey: string;
  updatedAt: string;
  displayTitle: string;
  displaySummary: string;
  titleSource: 'conversation' | 'snapshot-user' | 'turn' | 'fallback';
  summarySource: 'snapshot-assistant' | 'snapshot-user' | 'conversation' | 'turn' | 'fallback';
};

const SIDEBAR_CONVERSATION_SUMMARY_FALLBACK = '继续查看这条对话的上下文与结果。';
const UPSTREAM_STARTER_MESSAGE_MARKERS = [
  'ready to chat',
  'what can you do?',
  'summarize my recent sessions',
  'help me configure a channel',
  'check system health',
  'type a message below',
] as const;

function normalizeText(value: string | null | undefined): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function clampText(value: string, limit: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, limit - 1)).trim()}…`;
}

function extractRenderableMessageText(message: unknown): string | null {
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    return null;
  }

  const record = message as Record<string, unknown>;
  if (typeof record.content === 'string' && record.content.trim()) {
    return record.content.trim();
  }

  if (!Array.isArray(record.content)) {
    return null;
  }

  const text = record.content
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return '';
      }
      const block = item as Record<string, unknown>;
      return typeof block.text === 'string' ? block.text.trim() : '';
    })
    .filter(Boolean)
    .join(' ')
    .trim();

  return text || null;
}

function isUpstreamStarterSnapshot(messages: unknown[]): boolean {
  const texts = messages
    .map((message) => extractRenderableMessageText(message))
    .filter((value): value is string => Boolean(value))
    .map((value) => value.replace(/\s+/g, ' ').trim().toLowerCase());

  if (texts.length < 2 || texts.length > 8) {
    return false;
  }

  const markerMatches = texts.filter((text) =>
    UPSTREAM_STARTER_MESSAGE_MARKERS.some((marker) => text.includes(marker)),
  );

  return markerMatches.length === texts.length;
}

function readLatestSnapshotRoleText(
  messages: unknown[],
  role: 'user' | 'assistant',
): string | null {
  if (isUpstreamStarterSnapshot(messages)) {
    return null;
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || typeof message !== 'object' || Array.isArray(message)) {
      continue;
    }
    const record = message as Record<string, unknown>;
    const rawRole = String(record.role || '').trim().toLowerCase();
    if (rawRole !== role) {
      continue;
    }
    const text = extractRenderableMessageText(record);
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

function readLatestChatTurnForConversation(
  turns: ChatConversationProjectionTurn[],
  conversation: ChatConversationProjectionConversation,
): ChatConversationProjectionTurn | null {
  const candidates = turns.filter(
    (turn) => turn.source === 'chat' && turn.conversationId === conversation.id,
  );
  if (candidates.length === 0) {
    return null;
  }

  const activeSessionMatch = candidates.find(
    (turn) => turn.sessionKey === conversation.activeSessionKey,
  );
  if (activeSessionMatch) {
    return activeSessionMatch;
  }
  return candidates[0] ?? null;
}

export function buildConversationProjectionsCore(input: {
  conversations: ChatConversationProjectionConversation[];
  turns: ChatConversationProjectionTurn[];
  getSnapshot: (conversation: ChatConversationProjectionConversation) => ChatConversationProjectionSnapshot;
}): ChatConversationProjection[] {
  return input.conversations
    .map((conversation) => {
      const snapshot = input.getSnapshot(conversation);
      const latestTurn = readLatestChatTurnForConversation(input.turns, conversation);
      const snapshotUserText = readLatestSnapshotRoleText(snapshot?.messages ?? [], 'user');
      const snapshotAssistantText = readLatestSnapshotRoleText(snapshot?.messages ?? [], 'assistant');
      const creditBlockedSummary =
        latestTurn?.status === 'failed' && isCreditBlockedTurnError(latestTurn.lastError)
          ? buildCreditBlockedTurnMessage(latestTurn.lastError)
          : null;

      const displayTitle =
        normalizeText(conversation.title) ||
        snapshotUserText ||
        normalizeText(latestTurn?.title) ||
        normalizeText(latestTurn?.prompt) ||
        '未命名对话';
      const displaySummary =
        snapshotAssistantText ||
        creditBlockedSummary ||
        snapshotUserText ||
        normalizeText(conversation.summary) ||
        normalizeText(latestTurn?.summary) ||
        normalizeText(latestTurn?.prompt) ||
        SIDEBAR_CONVERSATION_SUMMARY_FALLBACK;

      const titleSource: ChatConversationProjection['titleSource'] =
        normalizeText(conversation.title)
          ? 'conversation'
          : snapshotUserText
            ? 'snapshot-user'
            : normalizeText(latestTurn?.title) || normalizeText(latestTurn?.prompt)
              ? 'turn'
              : 'fallback';

      const summarySource: ChatConversationProjection['summarySource'] =
        snapshotAssistantText
          ? 'snapshot-assistant'
          : creditBlockedSummary
            ? 'turn'
            : snapshotUserText
            ? 'snapshot-user'
            : normalizeText(conversation.summary)
              ? 'conversation'
              : normalizeText(latestTurn?.summary) || normalizeText(latestTurn?.prompt)
                ? 'turn'
                : 'fallback';

      return {
        conversationId: conversation.id,
        activeSessionKey: conversation.activeSessionKey,
        updatedAt: conversation.updatedAt,
        displayTitle: displayTitle!,
        displaySummary: displaySummary!,
        titleSource,
        summarySource,
      };
    })
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
}
