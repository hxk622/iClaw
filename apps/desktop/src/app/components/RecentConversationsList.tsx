import { Clock3, MessageSquareText } from 'lucide-react';
import { useMemo } from 'react';
import { cn } from '@/app/lib/cn';
import { formatChatTurnRelativeTime, useChatTurns } from '@/app/lib/chat-turns';
import { useChatConversations } from '@/app/lib/chat-conversations';
import { INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE } from '@/app/lib/ui-interactions';

const SIDEBAR_CONVERSATION_LIMIT = 5;

interface RecentConversationsListProps {
  title: string;
  selectedConversationId?: string | null;
  onSelectConversation?: (conversationId: string) => void;
}

export function RecentConversationsList({
  title,
  selectedConversationId = null,
  onSelectConversation,
}: RecentConversationsListProps) {
  const conversations = useChatConversations();
  const recentTurns = useChatTurns();

  const visibleConversations = useMemo(() => {
    const recentTurnByConversation = new Map<string, (typeof recentTurns)[number]>();
    recentTurns.forEach((turn) => {
      if (!recentTurnByConversation.has(turn.conversationId)) {
        recentTurnByConversation.set(turn.conversationId, turn);
      }
    });

    return conversations.slice(0, SIDEBAR_CONVERSATION_LIMIT).map((conversation) => {
      const matchedTurn = recentTurnByConversation.get(conversation.id) ?? null;
      const conversationTitle =
        conversation.title?.trim() ||
        matchedTurn?.title?.trim() ||
        matchedTurn?.prompt?.trim() ||
        '未命名对话';
      const conversationSummary =
        matchedTurn?.summary?.trim() ||
        matchedTurn?.prompt?.trim() ||
        '继续查看这条对话的上下文与结果。';
      const updatedAt = matchedTurn?.updatedAt || conversation.updatedAt;
      return {
        id: conversation.id,
        title: conversationTitle,
        summary: conversationSummary,
        updatedAt,
      };
    });
  }, [conversations, recentTurns]);

  return (
    <div className="mb-3">
      <div className="mb-2 flex items-center justify-between px-3">
        <div className="flex h-7 items-center gap-2">
          <span className="text-[13px] leading-none text-[var(--text-secondary)]">{title}</span>
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[11px] font-medium leading-none text-[var(--text-secondary)]">
            {Math.min(visibleConversations.length, SIDEBAR_CONVERSATION_LIMIT)}
          </span>
        </div>
      </div>

      {visibleConversations.length === 0 ? (
        <div className="px-2">
          <div className="w-full rounded-[18px] border border-dashed border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-3 text-left text-[12px] leading-6 text-[var(--text-secondary)]">
            发起一次真实对话后，这里会展示最近的对话窗口。
          </div>
        </div>
      ) : (
        <div className="space-y-1 px-2">
          {visibleConversations.map((conversation) => {
            const isSelected = conversation.id === selectedConversationId;
            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => onSelectConversation?.(conversation.id)}
                className={cn(
                  'relative flex w-full cursor-pointer items-center gap-3 rounded-[16px] px-3 py-2.5 text-left',
                  'transition-[background-color,border-color,color] duration-[var(--motion-panel)]',
                  SPRING_PRESSABLE,
                  INTERACTIVE_FOCUS_RING,
                  isSelected ? 'bg-[var(--bg-hover)]' : 'bg-transparent hover:bg-[var(--bg-hover)]',
                )}
              >
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[var(--text-secondary)]',
                    isSelected
                      ? 'border-[rgba(168,140,93,0.20)] bg-[rgba(168,140,93,0.12)] text-[var(--brand-primary)]'
                      : 'border-[var(--border-default)] bg-[var(--bg-card)]',
                  )}
                >
                  <MessageSquareText className="h-4 w-4" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-[var(--text-primary)]">
                    {conversation.title}
                  </span>
                  <span className="mt-1 block truncate text-[11px] text-[var(--text-muted)]">
                    {conversation.summary}
                  </span>
                  <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                    <Clock3 className="h-3 w-3 shrink-0" />
                    {formatChatTurnRelativeTime(conversation.updatedAt)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
