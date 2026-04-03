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
  onOpenMore?: () => void;
}

export function RecentConversationsList({
  title,
  selectedConversationId = null,
  onSelectConversation,
  onOpenMore,
}: RecentConversationsListProps) {
  const conversations = useChatConversations();
  const recentTurns = useChatTurns();

  const visibleConversations = useMemo(() => {
    const parseTimestamp = (value: string) => {
      const parsed = new Date(value).getTime();
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const recentTurnByConversation = new Map<string, (typeof recentTurns)[number]>();
    recentTurns.forEach((turn) => {
      if (!recentTurnByConversation.has(turn.conversationId)) {
        recentTurnByConversation.set(turn.conversationId, turn);
      }
    });

    return conversations
      .map((conversation) => {
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
      })
      .sort((left, right) => parseTimestamp(right.updatedAt) - parseTimestamp(left.updatedAt))
      .slice(0, SIDEBAR_CONVERSATION_LIMIT);
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
        {onOpenMore ? (
          <button
            type="button"
            onClick={() => onOpenMore?.()}
            className={cn(
              'inline-flex h-7 items-center rounded-[10px] px-2 text-[13px] font-medium text-[var(--brand-primary)]',
              'transition-[background-color,color] duration-[var(--motion-panel)] hover:bg-[var(--bg-hover)]',
              INTERACTIVE_FOCUS_RING,
            )}
          >
            历史对话
          </button>
        ) : null}
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
                  'relative flex w-full cursor-pointer items-center gap-2.5 rounded-[16px] border px-3 py-2.5 text-left shadow-[0_10px_24px_rgba(16,24,40,0.04)]',
                  'transition-[background-color,border-color,color,box-shadow,transform] duration-[var(--motion-panel)]',
                  SPRING_PRESSABLE,
                  INTERACTIVE_FOCUS_RING,
                  isSelected
                    ? 'border-[rgba(168,140,93,0.24)] bg-[color-mix(in_srgb,var(--bg-card)_82%,var(--bg-hover))] shadow-[0_14px_28px_rgba(168,140,93,0.10)]'
                    : 'border-[var(--border-default)] bg-[color-mix(in_srgb,var(--bg-card)_94%,var(--bg-page))] hover:border-[color-mix(in_srgb,var(--brand-primary)_22%,var(--border-default))] hover:bg-[var(--bg-hover)] hover:shadow-[0_12px_26px_rgba(16,24,40,0.06)]',
                )}
              >
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[var(--text-secondary)]',
                    isSelected
                      ? 'border-[rgba(168,140,93,0.20)] bg-[rgba(168,140,93,0.12)] text-[var(--brand-primary)] dark:text-white'
                      : 'border-[var(--border-default)] bg-[var(--bg-card)] dark:text-white',
                  )}
                >
                  <MessageSquareText className="h-3.5 w-3.5" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-[12px] font-medium text-[var(--text-primary)]">
                      {conversation.title}
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-[var(--text-muted)]">
                      <Clock3 className="h-3 w-3 shrink-0" />
                      {formatChatTurnRelativeTime(conversation.updatedAt)}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-[var(--text-muted)]">
                    {conversation.summary}
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
