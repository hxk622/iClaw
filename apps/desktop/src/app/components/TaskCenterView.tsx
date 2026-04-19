import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock3,
  FileText,
  ListChecks,
  Loader2,
  MessageSquare,
  Pin,
  Search,
  XCircle,
} from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { FilterPill } from '@/app/components/ui/FilterPill';
import { PressableCard } from '@/app/components/ui/PressableCard';
import { cn } from '@/app/lib/cn';
import { useChatConversations } from '@/app/lib/chat-conversations';
import {
  CHAT_TURN_ARTIFACT_LABELS,
  type ChatTurnRecord,
  formatChatTurnRelativeTime,
  useChatTurns,
} from '@/app/lib/chat-turns';
import { resolveConversationFinanceDisclaimer as projectConversationFinanceDisclaimer } from '@/app/lib/finance-compliance-projection';

type ConversationFilter = 'all' | ChatTurnRecord['status'];

interface TaskCenterViewProps {
  selectedConversationId?: string | null;
  onSelectConversation?: (conversationId: string) => void;
  onOpenConversation?: (conversationId: string) => void;
  onBackToChat?: () => void;
  taskCenterLabel: string;
  chatMenuLabel: string;
}

interface ConversationViewModel {
  id: string;
  title: string;
  summary: string;
  status: ChatTurnRecord['status'];
  isPinned: boolean;
  resultTypes: string[];
  lastUpdated: string;
  createdAt: string;
  source: string;
  routeTarget: 'chat' | 'cron';
  statusMessage: string;
  financeDisclaimer?: string | null;
}

const FILTER_ITEMS: Array<{ value: ConversationFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'running', label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'failed', label: '失败' },
];

const STATUS_META: Record<
  ChatTurnRecord['status'],
  {
    label: string;
    toneClassName: string;
    icon: typeof Loader2;
    iconClassName?: string;
    messageClassName: string;
  }
> = {
  running: {
    label: '进行中',
    toneClassName:
      'bg-[rgba(168,140,93,0.12)] text-[var(--brand-primary)] dark:bg-[rgba(180,154,112,0.16)]',
    icon: Loader2,
    iconClassName: 'animate-spin',
    messageClassName:
      'border-[rgba(168,140,93,0.24)] bg-[rgba(168,140,93,0.10)] text-[var(--brand-primary)] dark:border-[rgba(180,154,112,0.30)] dark:bg-[rgba(180,154,112,0.12)]',
  },
  completed: {
    label: '已完成',
    toneClassName:
      'bg-[rgba(74,107,90,0.12)] text-[var(--state-success)] dark:bg-[rgba(127,192,169,0.16)]',
    icon: CheckCircle2,
    messageClassName:
      'border-[rgba(74,107,90,0.20)] bg-[rgba(74,107,90,0.08)] text-[var(--state-success)] dark:border-[rgba(127,192,169,0.24)] dark:bg-[rgba(127,192,169,0.10)]',
  },
  failed: {
    label: '失败',
    toneClassName:
      'bg-[rgba(184,79,79,0.12)] text-[var(--state-error)] dark:bg-[rgba(196,107,107,0.16)]',
    icon: XCircle,
    messageClassName:
      'border-[rgba(184,79,79,0.22)] bg-[rgba(184,79,79,0.08)] text-[var(--state-error)] dark:border-[rgba(196,107,107,0.26)] dark:bg-[rgba(196,107,107,0.10)]',
  },
};

export function TaskCenterView({
  selectedConversationId = null,
  onSelectConversation,
  onOpenConversation,
  onBackToChat,
  taskCenterLabel,
  chatMenuLabel,
}: TaskCenterViewProps) {
  const conversations = useChatConversations();
  const turns = useChatTurns();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ConversationFilter>('all');

  const conversationViewModels = useMemo(() => {
    const latestTurnByConversation = new Map<string, ChatTurnRecord>();
    turns.forEach((turn) => {
      if (!latestTurnByConversation.has(turn.conversationId)) {
        latestTurnByConversation.set(turn.conversationId, turn);
      }
    });

    return Array.from(latestTurnByConversation.values())
      .map((latestTurn) =>
        mapConversationToViewModel({
          turn: latestTurn,
          chatMenuLabel,
          conversationExists: conversations.some((conversation) => conversation.id === latestTurn.conversationId),
        }),
      )
      .filter((conversation): conversation is ConversationViewModel => conversation !== null);
  }, [chatMenuLabel, conversations, turns]);

  const filteredConversations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return conversationViewModels.filter((conversation) => {
      const matchesFilter = filter === 'all' || conversation.status === filter;
      const matchesQuery =
        normalizedQuery.length === 0
          ? true
          : `${conversation.title} ${conversation.summary}`.toLowerCase().includes(normalizedQuery);
      return matchesFilter && matchesQuery;
    });
  }, [conversationViewModels, filter, query]);

  const selectedConversation =
    filteredConversations.find((conversation) => conversation.id === selectedConversationId) ??
    filteredConversations[0] ??
    null;

  useEffect(() => {
    if (!filteredConversations.length) {
      return;
    }

    if (
      !selectedConversationId ||
      !filteredConversations.some((conversation) => conversation.id === selectedConversationId)
    ) {
      onSelectConversation?.(filteredConversations[0].id);
    }
  }, [filteredConversations, onSelectConversation, selectedConversationId]);

  const totalConversations = conversationViewModels.length;
  const runningConversations = conversationViewModels.filter((conversation) => conversation.status === 'running').length;
  const completedConversations = conversationViewModels.filter(
    (conversation) => conversation.status === 'completed',
  ).length;
  const hasNoConversations = totalConversations === 0;
  const hasNoSearchResults =
    !hasNoConversations && filteredConversations.length === 0 && (query.trim() !== '' || filter !== 'all');

  return (
    <div className="flex flex-1 overflow-y-auto bg-[var(--bg-page)]">
      <div className="mx-auto w-full max-w-[1440px] px-8 py-6">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="mb-2 text-[32px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
              {taskCenterLabel}
            </h1>
            <p className="text-[15px] text-[var(--text-secondary)]">
              查看历史对话、结果与更新状态
            </p>
          </div>

          <Button
            variant="primary"
            size="md"
            leadingIcon={<MessageSquare className="h-4 w-4" />}
            onClick={onBackToChat}
            className="shrink-0"
          >
            返回{chatMenuLabel}
          </Button>
        </header>

        {hasNoConversations ? (
          <section className="flex min-h-[600px] items-center justify-center">
            <div className="w-full max-w-[460px] rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-card)] p-12 text-center shadow-[var(--pressable-card-rest-shadow)]">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-[18px] bg-[var(--bg-hover)] text-[var(--text-muted)]">
                <MessageSquare className="h-8 w-8" />
              </div>
              <h2 className="mb-3 text-[20px] font-semibold text-[var(--text-primary)]">
                还没有任务记录
              </h2>
              <p className="mb-8 text-[15px] leading-7 text-[var(--text-secondary)]">
                从{chatMenuLabel}发起一次真实对话，或者完成一次定时任务后，这里会出现对应记录
              </p>
              <div className="flex justify-center">
                <Button
                  variant="primary"
                  size="md"
                  leadingIcon={<MessageSquare className="h-4 w-4" />}
                  onClick={onBackToChat}
                >
                  返回{chatMenuLabel}
                </Button>
              </div>
            </div>
          </section>
        ) : (
          <>
            <section className="grid grid-cols-3 gap-3">
              <SummaryCard
                icon={<ListChecks className="h-4 w-4" />}
                label="任务总数"
                value={totalConversations}
              />
              <SummaryCard
                icon={<Clock3 className="h-4 w-4" />}
                label="进行中"
                value={runningConversations}
                tone="running"
              />
              <SummaryCard
                icon={<CheckCircle2 className="h-4 w-4" />}
                label="已完成"
                value={completedConversations}
                tone="completed"
              />
            </section>

            <section className="mt-5 flex items-center gap-4">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder="搜索任务标题或内容..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className={cn(
                    'h-11 w-full rounded-[12px] border border-[var(--border-default)] bg-[var(--bg-card)] pl-10 pr-4 text-[14px] text-[var(--text-primary)] outline-none transition-[border-color,box-shadow,background-color]',
                    'placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:bg-[var(--bg-elevated)] focus:shadow-[0_0_0_3px_rgba(168,140,93,0.10)] dark:focus:shadow-[0_0_0_3px_rgba(180,154,112,0.14)]',
                  )}
                />
              </div>

              <div className="flex items-center gap-2">
                {FILTER_ITEMS.map((item) => (
                  <FilterPill
                    key={item.value}
                    active={filter === item.value}
                    onClick={() => setFilter(item.value)}
                  >
                    {item.label}
                  </FilterPill>
                ))}
              </div>
            </section>

            {hasNoSearchResults ? (
              <section className="mt-5 rounded-[16px] border-2 border-dashed border-[var(--border-default)] bg-[var(--bg-card)] p-12 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-hover)] text-[var(--text-muted)]">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <h2 className="mb-2 text-[18px] font-semibold text-[var(--text-primary)]">
                  未找到匹配的对话
                </h2>
                <p className="text-[14px] text-[var(--text-secondary)]">
                  尝试调整搜索关键词或筛选条件
                </p>
              </section>
            ) : (
              <section className="mt-5 flex gap-6">
                <div className="min-w-0 flex-1">
                  <div className="space-y-6">
                    {filteredConversations.map((conversation) => (
                      <ConversationCard
                        key={conversation.id}
                        conversation={conversation}
                        isSelected={selectedConversation?.id === conversation.id}
                        onSelect={() => onSelectConversation?.(conversation.id)}
                        onOpenTarget={
                          conversation.routeTarget === 'chat'
                            ? () => onOpenConversation?.(conversation.id)
                            : undefined
                        }
                      />
                    ))}
                  </div>
                </div>

                <aside className="w-[400px] shrink-0">
                  <div className="sticky top-8">
                    <ConversationDetailPanel
                      conversation={selectedConversation}
                      onOpenTarget={
                        selectedConversation?.routeTarget === 'chat'
                          ? () => onOpenConversation?.(selectedConversation.id)
                          : undefined
                      }
                      chatMenuLabel={chatMenuLabel}
                    />
                  </div>
                </aside>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  tone = 'default',
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone?: 'default' | 'running' | 'completed';
}) {
  const iconClassName =
    tone === 'running'
      ? 'bg-[rgba(168,140,93,0.12)] text-[var(--brand-primary)] dark:bg-[rgba(180,154,112,0.16)]'
      : tone === 'completed'
        ? 'bg-[rgba(74,107,90,0.10)] text-[var(--state-success)] dark:bg-[rgba(127,192,169,0.14)]'
        : 'bg-[var(--bg-hover)] text-[var(--text-secondary)]';

  return (
    <div className="rounded-[12px] border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-3 shadow-[var(--pressable-card-rest-shadow)]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px]', iconClassName)}>
            {icon}
          </div>
          <span className="truncate text-[13px] font-medium text-[var(--text-secondary)]">{label}</span>
        </div>
        <div className="text-[22px] font-semibold leading-none text-[var(--text-primary)]">
          {value}
        </div>
      </div>

      {tone === 'running' && value > 0 ? (
        <div className="mt-2 inline-flex items-center gap-1 rounded-[6px] bg-[var(--bg-hover)] px-2 py-0.5 text-[11px] font-medium text-[var(--brand-primary)]">
          <span className="h-1 w-1 rounded-full bg-[var(--brand-primary)] animate-pulse" />
          处理中
        </div>
      ) : null}
    </div>
  );
}

function ConversationCard({
  conversation,
  isSelected,
  onSelect,
  onOpenTarget,
}: {
  conversation: ConversationViewModel;
  isSelected: boolean;
  onSelect?: () => void;
  onOpenTarget?: () => void;
}) {
  return (
    <PressableCard
      interactive
      onClick={onSelect}
      className={cn(
        'group rounded-[18px] bg-[var(--bg-card)] p-5',
        isSelected
          ? 'border-2 border-[var(--brand-primary)] bg-[var(--bg-elevated)] shadow-[0_4px_12px_rgba(168,140,93,0.15)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.24)]'
          : 'border border-[var(--border-default)] shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.05)]',
      )}
      aria-pressed={isSelected}
    >
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <StatusBadge status={conversation.status} />
          {conversation.isPinned ? (
            <span className="inline-flex items-center gap-1 rounded-[6px] bg-[var(--bg-hover)] px-2.5 py-1 text-[12px] text-[var(--text-secondary)]">
              <Pin className="h-3 w-3" />
              已置顶
            </span>
          ) : null}
        </div>

        <h3 className="mb-2 text-[16px] font-semibold text-[var(--text-primary)]">
          {conversation.title}
        </h3>

        <p className="mb-3 line-clamp-2 text-[14px] leading-6 text-[var(--text-secondary)]">
          {conversation.summary}
        </p>

        {conversation.resultTypes.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {conversation.resultTypes.map((type) => (
              <span
                key={type}
                className="rounded-[6px] border border-[var(--border-default)] bg-[var(--bg-hover)] px-2 py-0.5 text-[12px] text-[var(--text-secondary)]"
              >
                {type}
              </span>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-4 text-[13px] text-[var(--text-secondary)]">
          <span className="inline-flex items-center gap-1">
            <Clock3 className="h-3 w-3" />
            {conversation.lastUpdated}
          </span>
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {conversation.createdAt}
          </span>
        </div>

        {conversation.routeTarget === 'chat' ? (
          <div className="mt-3 border-t border-[var(--border-default)] pt-3">
            <Button
              variant={isSelected ? 'primary' : 'secondary'}
              size="sm"
              leadingIcon={<MessageSquare className="h-3.5 w-3.5" />}
              onClick={(event) => {
                event.stopPropagation();
                onOpenTarget?.();
              }}
            >
              进入对话
            </Button>
          </div>
        ) : null}
      </div>
    </PressableCard>
  );
}

function ConversationDetailPanel({
  conversation,
  onOpenTarget,
  chatMenuLabel,
}: {
  conversation: ConversationViewModel | null;
  onOpenTarget?: () => void;
  chatMenuLabel: string;
}) {
  if (!conversation) {
    return (
      <div className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-card)] p-8 text-center shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <FileText className="mx-auto mb-4 h-12 w-12 text-[var(--text-muted)]" />
        <p className="text-[15px] text-[var(--text-secondary)]">选择一个对话查看详情</p>
      </div>
    );
  }

  const meta = STATUS_META[conversation.status];
  const StatusIcon = meta.icon;

  return (
    <div className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-card)] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge status={conversation.status} />
        {conversation.isPinned ? (
          <span className="inline-flex items-center gap-1 rounded-[6px] bg-[var(--bg-hover)] px-2.5 py-1 text-[12px] text-[var(--text-secondary)]">
            <Pin className="h-3 w-3" />
            已置顶
          </span>
        ) : null}
      </div>

      <h2 className="mb-3 text-[18px] font-semibold leading-7 text-[var(--text-primary)]">
        {conversation.title}
      </h2>

      <p className="mb-6 text-[15px] leading-7 text-[var(--text-secondary)]">
        {conversation.summary}
      </p>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <DetailInfoTile
          icon={<Clock3 className="h-4 w-4" />}
          label="最近更新"
          value={conversation.lastUpdated}
        />
        <DetailInfoTile
          icon={<MessageSquare className="h-4 w-4" />}
          label="对话来源"
          value={conversation.source}
        />
        <DetailInfoTile
          icon={<Calendar className="h-4 w-4" />}
          label="创建时间"
          value={conversation.createdAt}
        />
        <DetailInfoTile
          icon={<FileText className="h-4 w-4" />}
          label="结果类型"
          value={`${conversation.resultTypes.length} 个`}
        />
      </div>

      <div className="mb-6">
        <div className="mb-2 text-[13px] font-medium text-[var(--text-secondary)]">结果类型</div>
        <div className="flex flex-wrap gap-2">
          {conversation.resultTypes.map((type) => (
            <span
              key={type}
              className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-1.5 text-[14px] text-[var(--text-primary)]"
            >
              {type}
            </span>
          ))}
        </div>
      </div>

      <div className={cn('mb-6 rounded-[12px] border p-4', meta.messageClassName)}>
        <div className="flex items-start gap-2">
          <StatusIcon className={cn('mt-0.5 h-4 w-4 shrink-0', meta.iconClassName)} />
          <p className="flex-1 text-[14px] leading-6">{conversation.statusMessage}</p>
        </div>
      </div>

      {conversation.financeDisclaimer ? (
        <div className="mb-6 rounded-[12px] border border-[rgba(168,140,93,0.20)] bg-[rgba(168,140,93,0.08)] px-4 py-3 text-[13px] leading-6 text-[var(--brand-primary)]">
          {conversation.financeDisclaimer}
        </div>
      ) : null}

      {conversation.routeTarget === 'chat' ? (
        <Button
          variant="primary"
          size="md"
          block
          leadingIcon={<MessageSquare className="h-4 w-4" />}
          onClick={onOpenTarget}
        >
          进入{chatMenuLabel}
        </Button>
      ) : (
        <div className="rounded-[12px] border border-[var(--border-default)] bg-[var(--bg-hover)] px-4 py-3 text-[13px] leading-6 text-[var(--text-secondary)]">
          这是定时任务的最新结果摘要。进一步管理这个任务，请在左侧进入“定时任务”页。
        </div>
      )}
    </div>
  );
}

function DetailInfoTile({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[12px] border border-[var(--border-default)] bg-[var(--bg-hover)] p-3.5">
      <div className="mb-1 flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)]">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-[15px] font-medium text-[var(--text-primary)]">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: ChatTurnRecord['status'] }) {
  const meta = STATUS_META[status];

  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1 text-[13px] font-medium', meta.toneClassName)}>
      {status === 'running' ? <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" /> : null}
      {meta.label}
    </span>
  );
}

function mapConversationToViewModel(params: {
  turn: ChatTurnRecord;
  chatMenuLabel: string;
  conversationExists: boolean;
}): ConversationViewModel | null {
  const latestTurn = params.turn;
  if (latestTurn.source === 'chat' && !params.conversationExists) {
    return null;
  }
  const resultTypes = latestTurn.artifacts.map((artifact) => CHAT_TURN_ARTIFACT_LABELS[artifact]);

  return {
    id: latestTurn.conversationId,
    title: latestTurn.title,
    summary: latestTurn.summary,
    status: latestTurn.status,
    isPinned: Boolean(latestTurn.pinnedAt),
    resultTypes,
    lastUpdated: formatChatTurnRelativeTime(latestTurn.updatedAt),
    createdAt: formatCompactDate(latestTurn.createdAt),
    source: latestTurn.source === 'cron' ? latestTurn.sourceLabel || '定时任务' : params.chatMenuLabel,
    routeTarget: latestTurn.routeTarget === 'cron' ? 'cron' : 'chat',
    statusMessage: buildStatusMessage(latestTurn, resultTypes),
    financeDisclaimer: resolveConversationFinanceDisclaimer(latestTurn),
  };
}

function resolveConversationFinanceDisclaimer(turn: ChatTurnRecord): string | null {
  return projectConversationFinanceDisclaimer(turn);
}

function buildStatusMessage(turn: ChatTurnRecord, resultTypes: string[]): string {
  if (turn.source === 'cron') {
    if (turn.status === 'failed') {
      return turn.lastError || '最近一次定时执行失败，请打开任务查看详情。';
    }
    if (turn.status === 'running') {
      return '这个定时任务正在执行中，完成后会自动更新到任务中心。';
    }
    const modelLine =
      turn.provider || turn.model
        ? `本次运行使用 ${[turn.provider, turn.model].filter(Boolean).join(' / ')}。`
        : '';
    return `${turn.summary}${modelLine ? ` ${modelLine}` : ''}`.trim();
  }

  if (turn.status === 'failed') {
    return turn.lastError || '本轮对话执行失败，可回到对话重试';
  }

  if (turn.status === 'running') {
    return '这条对话仍在处理中，完成后会自动更新状态与结果。';
  }

  if (resultTypes.length > 0) {
    return `最近一轮已生成${resultTypes.join('、')}，可以继续围绕结果追问。`;
  }

  return '最近一轮已完成，可继续围绕该对话追问。';
}

function formatCompactDate(dateString: string): string {
  const timestamp = new Date(dateString).getTime();
  if (!Number.isFinite(timestamp)) {
    return '刚刚';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(timestamp));
}
