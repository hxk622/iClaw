import { Clock3, MoreVertical, MessageSquareText, PencilLine, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/app/components/ui/Button';
import { cn } from '@/app/lib/cn';
import { formatChatTurnRelativeTime, useChatTurns } from '@/app/lib/chat-turns';
import {
  renameChatConversation,
  useChatConversations,
} from '@/app/lib/chat-conversations';
import { deleteChatConversationThread } from '@/app/lib/chat-conversation-actions';
import { INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE } from '@/app/lib/ui-interactions';
import { BRAND } from '@/app/lib/brand';

const SIDEBAR_CONVERSATION_LIMIT = 5;

interface RecentConversationsListProps {
  title: string;
  selectedConversationId?: string | null;
  onSelectConversation?: (conversationId: string) => void;
  onDeleteConversation?: (conversationId: string) => void;
  onOpenMore?: () => void;
}

export function RecentConversationsList({
  title,
  selectedConversationId = null,
  onSelectConversation,
  onDeleteConversation,
  onOpenMore,
}: RecentConversationsListProps) {
  const conversations = useChatConversations();
  const recentTurns = useChatTurns();
  const [menuConversationId, setMenuConversationId] = useState<string | null>(null);
  const [renamingConversationId, setRenamingConversationId] = useState<string | null>(null);
  const [pendingSelectionConversationId, setPendingSelectionConversationId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [pendingDeleteConversation, setPendingDeleteConversation] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const activeConversationRef = useRef<HTMLDivElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const [portalReady, setPortalReady] = useState(false);

  const visibleConversations = useMemo(() => {
    const parseTimestamp = (value: string) => {
      const parsed = new Date(value).getTime();
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const recentTurnByConversation = new Map<string, (typeof recentTurns)[number]>();
    recentTurns
      .filter((turn) => turn.source === 'chat')
      .forEach((turn) => {
      if (!recentTurnByConversation.has(turn.conversationId)) {
        recentTurnByConversation.set(turn.conversationId, turn);
      }
      });

    return conversations
      .map((conversation) => {
        const matchedTurn = recentTurnByConversation.get(conversation.id) ?? null;
        const hasDisplayableMetadata = Boolean(
          conversation.title?.trim() ||
          conversation.summary?.trim() ||
          matchedTurn?.title?.trim() ||
          matchedTurn?.summary?.trim() ||
          matchedTurn?.prompt?.trim(),
        );
        if (!hasDisplayableMetadata) {
          return null;
        }
        const conversationTitle =
          conversation.title?.trim() ||
          matchedTurn?.title?.trim() ||
          matchedTurn?.prompt?.trim() ||
          '未命名对话';
        const conversationSummary =
          conversation.summary?.trim() ||
          matchedTurn?.summary?.trim() ||
          matchedTurn?.prompt?.trim() ||
          '继续查看这条对话的上下文与结果。';
        return {
          id: conversation.id,
          title: conversationTitle,
          summary: conversationSummary,
          updatedAt: conversation.updatedAt,
        };
      })
      .filter((conversation): conversation is { id: string; title: string; summary: string; updatedAt: string } => Boolean(conversation))
      .sort((left, right) => parseTimestamp(right.updatedAt) - parseTimestamp(left.updatedAt))
      .slice(0, SIDEBAR_CONVERSATION_LIMIT);
  }, [conversations, recentTurns]);

  useEffect(() => {
    if (!menuConversationId && !renamingConversationId) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (activeConversationRef.current?.contains(target)) {
        return;
      }
      setMenuConversationId(null);
      setRenamingConversationId(null);
      setDraftTitle('');
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [menuConversationId, renamingConversationId]);

  useEffect(() => {
    if (!renamingConversationId) {
      return;
    }
    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [renamingConversationId]);

  useEffect(() => {
    setPendingSelectionConversationId(null);
  }, [selectedConversationId]);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!pendingDeleteConversation) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPendingDeleteConversation(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [pendingDeleteConversation]);

  const handleStartRename = (conversationId: string, currentTitle: string) => {
    setMenuConversationId(null);
    setRenamingConversationId(conversationId);
    setDraftTitle(currentTitle);
  };

  const handleCommitRename = (conversationId: string) => {
    const nextTitle = draftTitle.trim();
    if (!nextTitle) {
      setRenamingConversationId(null);
      setDraftTitle('');
      return;
    }
    renameChatConversation(conversationId, nextTitle);
    setRenamingConversationId(null);
    setDraftTitle('');
  };

  const handleDeleteConversation = (conversationId: string) => {
    deleteChatConversationThread({
      appName: BRAND.brandId,
      conversationId,
    });
    setMenuConversationId(null);
    setRenamingConversationId(null);
    setDraftTitle('');
    setPendingDeleteConversation(null);
    onDeleteConversation?.(conversationId);
  };

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
        <div className="space-y-[6px] px-2">
          {visibleConversations.map((conversation) => {
            const isSelected = conversation.id === (pendingSelectionConversationId ?? selectedConversationId);
            const menuOpen = menuConversationId === conversation.id;
            const renaming = renamingConversationId === conversation.id;
            return (
              <div
                key={conversation.id}
                ref={menuOpen || renaming ? activeConversationRef : null}
                className={cn(
                  'group relative flex h-[68px] w-full items-stretch overflow-visible rounded-[16px] border px-2.5 py-1.5 text-left shadow-[0_10px_24px_rgba(16,24,40,0.04)]',
                  'transition-[background-color,border-color,color,box-shadow,transform] duration-[var(--motion-panel)]',
                  SPRING_PRESSABLE,
                  INTERACTIVE_FOCUS_RING,
                  menuOpen ? 'z-30' : 'z-0',
                  isSelected
                    ? 'border-[rgba(37,99,235,0.42)] bg-[rgba(37,99,235,0.08)] ring-1 ring-[rgba(37,99,235,0.10)] shadow-[0_12px_28px_rgba(16,24,40,0.08)]'
                    : 'border-[var(--border-default)] bg-[color-mix(in_srgb,var(--bg-card)_94%,var(--bg-page))] hover:border-[color-mix(in_srgb,var(--brand-primary)_22%,var(--border-default))] hover:bg-[var(--bg-hover)] hover:shadow-[0_12px_26px_rgba(16,24,40,0.06)]',
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    setPendingSelectionConversationId(conversation.id);
                    onSelectConversation?.(conversation.id);
                  }}
                  className="relative flex h-full min-w-0 flex-1 items-stretch gap-2 overflow-hidden pr-11 text-left"
                >
                  <span className="flex w-7 shrink-0 flex-col items-center justify-between py-0.5">
                    <span
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-full border text-[var(--text-secondary)]',
                        isSelected
                          ? 'border-[rgb(37,99,235)] bg-[rgb(37,99,235)] text-white shadow-[0_10px_22px_rgba(37,99,235,0.24)]'
                          : 'border-[var(--border-default)] bg-[var(--bg-card)] dark:text-white',
                      )}
                    >
                      <MessageSquareText className="h-3.5 w-3.5" />
                    </span>
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        isSelected ? 'bg-[rgb(34,197,94)]' : 'bg-[var(--border-default)]',
                      )}
                    />
                  </span>

                  <span className="flex min-w-0 flex-1 flex-col justify-start gap-[1px] py-0.5">
                    <span className="min-w-0 overflow-hidden pr-0.5">
                      {renaming ? (
                        <input
                          ref={renameInputRef}
                          value={draftTitle}
                          onChange={(event) => setDraftTitle(event.target.value)}
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              handleCommitRename(conversation.id);
                            }
                            if (event.key === 'Escape') {
                              event.preventDefault();
                              setRenamingConversationId(null);
                              setDraftTitle('');
                            }
                          }}
                          onBlur={() => handleCommitRename(conversation.id)}
                          className="min-w-0 w-full rounded-[10px] border border-[rgb(37,99,235)] bg-[var(--bg-card)] px-2 py-1 text-[12px] font-medium text-[var(--text-primary)] outline-none"
                          maxLength={48}
                        />
                      ) : (
                        <span
                          className={cn(
                            'block truncate text-[13px] font-semibold leading-[18px]',
                            isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--text-primary)]',
                          )}
                        >
                          {conversation.title}
                        </span>
                      )}
                    </span>

                    <span
                      className={cn(
                        'block min-w-0 max-h-[30px] overflow-hidden pr-0 text-[11px] leading-[15px] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]',
                        isSelected ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]',
                      )}
                    >
                      {conversation.summary}
                    </span>
                  </span>

                  <span
                    className={cn(
                      'pointer-events-none absolute bottom-0.5 right-0 inline-flex max-w-[88px] items-center gap-1 whitespace-nowrap text-right text-[10px] leading-[15px] transition-opacity duration-[var(--motion-panel)]',
                      isSelected ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]',
                      menuOpen
                        ? 'opacity-0'
                        : isSelected
                          ? 'opacity-100'
                          : 'opacity-100 group-hover:opacity-0 group-focus-within:opacity-0',
                    )}
                  >
                    <Clock3 className="h-2.5 w-2.5 shrink-0" />
                    {formatChatTurnRelativeTime(conversation.updatedAt)}
                  </span>
                </button>

                <div className="absolute right-1.5 top-1.5 z-40 flex flex-col items-end">
                  <button
                    type="button"
                    aria-label={`更多操作：${conversation.title}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setRenamingConversationId(null);
                      setDraftTitle('');
                      setMenuConversationId((current) => current === conversation.id ? null : conversation.id);
                    }}
                    className={cn(
                      'absolute right-0 top-0 inline-flex h-6 w-6 items-center justify-center rounded-[9px] border border-transparent bg-[color-mix(in_srgb,var(--bg-card)_92%,transparent)] text-[var(--text-muted)] transition-[background-color,color,border-color] duration-[var(--motion-panel)]',
                      menuOpen
                        ? 'border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--text-primary)] shadow-[0_8px_18px_rgba(16,24,40,0.10)]'
                        : 'opacity-100 hover:border-[var(--border-default)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]',
                    )}
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </button>

                  {menuOpen ? (
                    <div className="absolute right-0 top-8 z-50 min-w-[132px] rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-card)] p-1.5 shadow-[0_16px_36px_rgba(16,24,40,0.14)]">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleStartRename(conversation.id, conversation.title);
                        }}
                        className="flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-[12px] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
                      >
                        <PencilLine className="h-3.5 w-3.5 shrink-0" />
                        重命名
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setMenuConversationId(null);
                          setPendingDeleteConversation({
                            id: conversation.id,
                            title: conversation.title,
                          });
                        }}
                        className="flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-[12px] text-[var(--state-danger,#c2410c)] transition-colors hover:bg-[var(--bg-hover)]"
                      >
                        <Trash2 className="h-3.5 w-3.5 shrink-0" />
                        删除
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {portalReady && pendingDeleteConversation
        ? createPortal(
            <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/42 px-4 backdrop-blur-[6px]">
              <div
                className="absolute inset-0"
                onClick={() => setPendingDeleteConversation(null)}
                aria-hidden="true"
              />
              <div className="relative z-[161] w-full max-w-[420px] rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-card)] p-6 shadow-[0_28px_80px_rgba(15,23,42,0.24)]">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-[14px] border border-[rgba(239,68,68,0.18)] bg-[rgba(239,68,68,0.10)] text-[rgb(185,28,28)] dark:border-[rgba(248,113,113,0.24)] dark:bg-[rgba(239,68,68,0.18)] dark:text-[#fecaca]">
                  <Trash2 className="h-5 w-5" />
                </div>
                <h3 className="text-[18px] font-semibold text-[var(--text-primary)]">删除这条对话？</h3>
                <p className="mt-2 text-[14px] leading-6 text-[var(--text-secondary)]">
                  <span className="font-medium text-[var(--text-primary)]">“{pendingDeleteConversation.title}”</span>
                  将从当前账号的本地对话记录中移除，关联的会话快照也会一起删除。
                </p>
                <p className="mt-2 text-[13px] leading-6 text-[var(--text-muted)]">
                  这个操作不可撤销。
                </p>
                <div className="mt-6 flex items-center justify-end gap-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPendingDeleteConversation(null)}
                  >
                    取消
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    leadingIcon={<Trash2 className="h-3.5 w-3.5" />}
                    onClick={() => handleDeleteConversation(pendingDeleteConversation.id)}
                  >
                    删除对话
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
