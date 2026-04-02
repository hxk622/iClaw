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
import {
  CHAT_TURN_ARTIFACT_LABELS,
  type ChatTurnRecord,
  formatChatTurnRelativeTime,
  useChatTurns,
} from '@/app/lib/chat-turns';

type TurnFilter = 'all' | ChatTurnRecord['status'];

interface TaskCenterViewProps {
  selectedTurnId?: string | null;
  onSelectTurn?: (turnId: string) => void;
  onOpenTurnChat?: (turnId: string) => void;
  onBackToChat?: () => void;
  taskCenterLabel: string;
  chatMenuLabel: string;
}

interface TurnViewModel {
  id: string;
  title: string;
  summary: string;
  status: ChatTurnRecord['status'];
  isPinned: boolean;
  resultTypes: string[];
  lastUpdated: string;
  createdAt: string;
  source: string;
  statusMessage: string;
}

const FILTER_ITEMS: Array<{ value: TurnFilter; label: string }> = [
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
  selectedTurnId = null,
  onSelectTurn,
  onOpenTurnChat,
  onBackToChat,
  taskCenterLabel,
  chatMenuLabel,
}: TaskCenterViewProps) {
  const turns = useChatTurns();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<TurnFilter>('all');

  const mappedTurns = useMemo(() => turns.map((turn) => mapTurnToViewModel(turn, chatMenuLabel)), [chatMenuLabel, turns]);

  const filteredTurns = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return mappedTurns.filter((turn, index) => {
      const sourceTurn = turns[index];
      const matchesFilter = filter === 'all' || turn.status === filter;
      const matchesQuery =
        normalizedQuery.length === 0
          ? true
          : `${turn.title} ${turn.summary} ${sourceTurn?.prompt ?? ''}`
              .toLowerCase()
              .includes(normalizedQuery);
      return matchesFilter && matchesQuery;
    });
  }, [filter, mappedTurns, query, turns]);

  const selectedTurn =
    filteredTurns.find((turn) => turn.id === selectedTurnId) ?? filteredTurns[0] ?? null;

  useEffect(() => {
    if (!filteredTurns.length) {
      return;
    }

    if (!selectedTurnId || !filteredTurns.some((turn) => turn.id === selectedTurnId)) {
      onSelectTurn?.(filteredTurns[0].id);
    }
  }, [filteredTurns, onSelectTurn, selectedTurnId]);

  const totalTurns = mappedTurns.length;
  const runningTurns = mappedTurns.filter((turn) => turn.status === 'running').length;
  const completedTurns = mappedTurns.filter((turn) => turn.status === 'completed').length;
  const hasNoTurns = totalTurns === 0;
  const hasNoSearchResults =
    !hasNoTurns && filteredTurns.length === 0 && (query.trim() !== '' || filter !== 'all');

  return (
    <div className="flex flex-1 overflow-y-auto bg-[var(--bg-page)]">
      <div className="mx-auto w-full max-w-[1440px] px-8 py-6">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="mb-2 text-[32px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
              {taskCenterLabel}
            </h1>
            <p className="text-[15px] text-[var(--text-secondary)]">
              查看历史任务、结果与更新状态
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

        {hasNoTurns ? (
          <section className="flex min-h-[600px] items-center justify-center">
            <div className="w-full max-w-[460px] rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-card)] p-12 text-center shadow-[var(--pressable-card-rest-shadow)]">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-[18px] bg-[var(--bg-hover)] text-[var(--text-muted)]">
                <MessageSquare className="h-8 w-8" />
              </div>
              <h2 className="mb-3 text-[20px] font-semibold text-[var(--text-primary)]">
                还没有任务记录
              </h2>
              <p className="mb-8 text-[15px] leading-7 text-[var(--text-secondary)]">
                从{chatMenuLabel}发起一次真实对话，创建你的第一个任务
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
                value={totalTurns}
              />
              <SummaryCard
                icon={<Clock3 className="h-4 w-4" />}
                label="进行中"
                value={runningTurns}
                tone="running"
              />
              <SummaryCard
                icon={<CheckCircle2 className="h-4 w-4" />}
                label="已完成"
                value={completedTurns}
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
                  未找到匹配的任务
                </h2>
                <p className="text-[14px] text-[var(--text-secondary)]">
                  尝试调整搜索关键词或筛选条件
                </p>
              </section>
            ) : (
              <section className="mt-5 flex gap-6">
                <div className="min-w-0 flex-1">
                  <div className="space-y-3">
                    {filteredTurns.map((turn) => (
                      <TurnCard
                        key={turn.id}
                        turn={turn}
                        isSelected={selectedTurn?.id === turn.id}
                        onSelect={() => onSelectTurn?.(turn.id)}
                        onOpenChat={() => onOpenTurnChat?.(turn.id)}
                      />
                    ))}
                  </div>
                </div>

                <aside className="w-[400px] shrink-0">
                  <div className="sticky top-8">
                    <TurnDetailPanel
                      turn={selectedTurn}
                      onOpenChat={selectedTurn ? () => onOpenTurnChat?.(selectedTurn.id) : undefined}
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

function TurnCard({
  turn,
  isSelected,
  onSelect,
  onOpenChat,
}: {
  turn: TurnViewModel;
  isSelected: boolean;
  onSelect?: () => void;
  onOpenChat?: () => void;
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
          <StatusBadge status={turn.status} />
          {turn.isPinned ? (
            <span className="inline-flex items-center gap-1 rounded-[6px] bg-[var(--bg-hover)] px-2.5 py-1 text-[12px] text-[var(--text-secondary)]">
              <Pin className="h-3 w-3" />
              已置顶
            </span>
          ) : null}
        </div>

        <h3 className="mb-2 text-[16px] font-semibold text-[var(--text-primary)]">
          {turn.title}
        </h3>

        <p className="mb-3 line-clamp-2 text-[14px] leading-6 text-[var(--text-secondary)]">
          {turn.summary}
        </p>

        {turn.resultTypes.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {turn.resultTypes.map((type) => (
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
            {turn.lastUpdated}
          </span>
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {turn.createdAt}
          </span>
        </div>

        <div
          className={cn(
            'overflow-hidden transition-[max-height,opacity,margin] duration-[180ms]',
            isSelected
              ? 'mt-3 max-h-16 opacity-100'
              : 'mt-0 max-h-0 opacity-0 group-hover:mt-3 group-hover:max-h-16 group-hover:opacity-100 group-focus-within:mt-3 group-focus-within:max-h-16 group-focus-within:opacity-100',
          )}
        >
          <div className="border-t border-[var(--border-default)] pt-3">
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<MessageSquare className="h-3.5 w-3.5" />}
              onClick={(event) => {
                event.stopPropagation();
                onOpenChat?.();
              }}
            >
              继续对话
            </Button>
          </div>
        </div>
      </div>
    </PressableCard>
  );
}

function TurnDetailPanel({
  turn,
  onOpenChat,
  chatMenuLabel,
}: {
  turn: TurnViewModel | null;
  onOpenChat?: () => void;
  chatMenuLabel: string;
}) {
  if (!turn) {
    return (
      <div className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-card)] p-8 text-center shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <FileText className="mx-auto mb-4 h-12 w-12 text-[var(--text-muted)]" />
        <p className="text-[15px] text-[var(--text-secondary)]">选择一个任务查看详情</p>
      </div>
    );
  }

  const meta = STATUS_META[turn.status];
  const StatusIcon = meta.icon;

  return (
    <div className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-card)] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge status={turn.status} />
        {turn.isPinned ? (
          <span className="inline-flex items-center gap-1 rounded-[6px] bg-[var(--bg-hover)] px-2.5 py-1 text-[12px] text-[var(--text-secondary)]">
            <Pin className="h-3 w-3" />
            已置顶
          </span>
          ) : null}
      </div>

      <h2 className="mb-3 text-[18px] font-semibold leading-7 text-[var(--text-primary)]">
        {turn.title}
      </h2>

      <p className="mb-6 text-[15px] leading-7 text-[var(--text-secondary)]">
        {turn.summary}
      </p>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <DetailInfoTile
          icon={<Clock3 className="h-4 w-4" />}
          label="最近更新"
          value={turn.lastUpdated}
        />
        <DetailInfoTile
          icon={<MessageSquare className="h-4 w-4" />}
          label="任务来源"
          value={turn.source}
        />
        <DetailInfoTile
          icon={<Calendar className="h-4 w-4" />}
          label="创建时间"
          value={turn.createdAt}
        />
        <DetailInfoTile
          icon={<FileText className="h-4 w-4" />}
          label="结果类型"
          value={`${turn.resultTypes.length} 个`}
        />
      </div>

      <div className="mb-6">
        <div className="mb-2 text-[13px] font-medium text-[var(--text-secondary)]">结果类型</div>
        <div className="flex flex-wrap gap-2">
          {turn.resultTypes.map((type) => (
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
          <p className="flex-1 text-[14px] leading-6">{turn.statusMessage}</p>
        </div>
      </div>

      <Button
        variant="primary"
        size="md"
        block
        leadingIcon={<MessageSquare className="h-4 w-4" />}
        onClick={onOpenChat}
      >
        返回{chatMenuLabel}
      </Button>
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

function mapTurnToViewModel(turn: ChatTurnRecord, chatMenuLabel: string): TurnViewModel {
  const resultTypes = turn.artifacts.map((artifact) => CHAT_TURN_ARTIFACT_LABELS[artifact]);

  return {
    id: turn.id,
    title: turn.title,
    summary: turn.summary,
    status: turn.status,
    isPinned: Boolean(turn.pinnedAt),
    resultTypes,
    lastUpdated: formatChatTurnRelativeTime(turn.updatedAt),
    createdAt: formatCompactDate(turn.createdAt),
    source: chatMenuLabel,
    statusMessage: buildStatusMessage(turn, resultTypes),
  };
}

function buildStatusMessage(turn: ChatTurnRecord, resultTypes: string[]): string {
  if (turn.status === 'failed') {
    return turn.lastError || '任务执行失败，可回到对话重试';
  }

  if (turn.status === 'running') {
    return '任务仍在处理中，完成后会自动更新状态与结果。';
  }

  if (resultTypes.length > 0) {
    return `已生成${resultTypes.join('、')}，可以继续围绕结果追问。`;
  }

  return '任务已完成，可继续围绕该任务对话。';
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
