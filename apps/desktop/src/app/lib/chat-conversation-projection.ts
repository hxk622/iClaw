import { useMemo } from 'react';
import {
  type ChatConversationRecord,
  readChatConversations,
  useChatConversations,
} from './chat-conversations.ts';
import { readStoredChatSnapshot } from './chat-history.ts';
import { readChatTurns, type ChatTurnRecord, useChatTurns } from './chat-turns.ts';
import {
  buildConversationProjectionsCore,
  type ChatConversationProjection as ChatConversationProjectionCore,
} from './chat-conversation-projection-core.ts';

type ProjectionInput = {
  appName: string;
  conversations: ChatConversationRecord[];
  turns: ChatTurnRecord[];
};

export type ChatConversationProjection = ChatConversationProjectionCore & {
  conversation: ChatConversationRecord;
};

export function buildConversationProjections(
  input: ProjectionInput,
): ChatConversationProjection[] {
  return buildConversationProjectionsCore({
    conversations: input.conversations,
    turns: input.turns,
    getSnapshot: (conversation) =>
      readStoredChatSnapshot({
        appName: input.appName,
        sessionKey: conversation.activeSessionKey,
        conversationId: conversation.id,
      }),
  }).map((projection) => ({
    ...projection,
    conversation:
      input.conversations.find((conversation) => conversation.id === projection.conversationId) ??
      input.conversations[0]!,
  }));
}

export function readConversationProjections(appName: string): ChatConversationProjection[] {
  return buildConversationProjections({
    appName,
    conversations: readChatConversations(),
    turns: readChatTurns(),
  });
}

export function useChatConversationProjections(appName: string): ChatConversationProjection[] {
  const conversations = useChatConversations();
  const turns = useChatTurns();

  return useMemo(
    () =>
      buildConversationProjections({
        appName,
        conversations,
        turns,
      }),
    [appName, conversations, turns],
  );
}
