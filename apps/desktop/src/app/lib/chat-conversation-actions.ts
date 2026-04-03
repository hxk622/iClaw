import { deleteStoredChatSnapshots } from './chat-history';
import { deleteChatConversation, readChatConversation } from './chat-conversations';
import { deleteChatTurnsByConversationId, readChatTurns } from './chat-turns';

function normalizeText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function deleteChatConversationThread(params: {
  appName: string;
  conversationId: string;
}): void {
  const normalizedConversationId = normalizeText(params.conversationId);
  if (!normalizedConversationId) {
    return;
  }

  const conversation = readChatConversation(normalizedConversationId);
  const relatedTurns = readChatTurns().filter((turn) => turn.conversationId === normalizedConversationId);
  const sessionKeys = Array.from(
    new Set(
      [
        ...(conversation?.sessionKeys ?? []),
        conversation?.activeSessionKey ?? null,
        ...relatedTurns.map((turn) => turn.sessionKey),
      ].filter((value): value is string => Boolean(normalizeText(value))),
    ),
  );

  deleteStoredChatSnapshots({
    appName: params.appName,
    sessionKeys,
    conversationId: normalizedConversationId,
  });
  deleteChatTurnsByConversationId(normalizedConversationId);
  deleteChatConversation(normalizedConversationId);
}
