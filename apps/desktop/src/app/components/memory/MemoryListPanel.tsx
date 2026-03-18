import type { ReactNode } from 'react';
import { Archive, CheckCircle2, Clock3, SearchX, Sparkles } from 'lucide-react';

import { PressableCard } from '@/app/components/ui/PressableCard';
import { cn } from '@/app/lib/cn';
import type { MemoryEntry } from './model';
import { getDomainBadgeClass, getImportanceBadgeClass, getTypeBadgeClass } from './model';

export function MemoryListPanel({
  entries,
  totalCount,
  selectedId,
  loading,
  hasActiveFilters,
  runtimeError,
  memoryDir,
  onSelect,
  onClearFilters,
}: {
  entries: MemoryEntry[];
  totalCount: number;
  selectedId: string | null;
  loading: boolean;
  hasActiveFilters: boolean;
  runtimeError: string | null;
  memoryDir: string;
  onSelect: (id: string) => void;
  onClearFilters: () => void;
}) {
  return (
    <section className="flex min-h-0 flex-1 flex-col bg-[var(--lobster-page-bg)]">
      <div className="border-b border-[var(--lobster-border)] bg-[var(--lobster-card-bg)] px-8 py-3.5">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between">
          <p className="text-[12px] text-[var(--lobster-text-secondary)]">
            当前显示 <span className="text-[var(--lobster-text-primary)]">{entries.length}</span> /{' '}
            <span className="text-[var(--lobster-text-primary)]">{totalCount}</span> 条记忆
          </p>
          <div className="rounded-full border border-[var(--lobster-border)] bg-[var(--lobster-muted-bg)] px-3 py-1 text-[11px] text-[var(--lobster-text-secondary)]">
            标签与来源已进入筛选
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-8 py-4">
        <div className="mx-auto w-full max-w-[1600px]">
          {loading ? (
            <EmptyShell
              icon={<Sparkles className="h-10 w-10" strokeWidth={1.35} />}
              title="正在读取真实记忆"
              description="正在从本地桌面工作区加载记忆与索引状态。"
            />
          ) : entries.length === 0 ? (
            <EmptyShell
              icon={
                hasActiveFilters ? (
                  <SearchX className="h-10 w-10" strokeWidth={1.35} />
                ) : (
                  <Archive className="h-10 w-10" strokeWidth={1.35} />
                )
              }
              title={hasActiveFilters ? '未找到匹配的记忆' : '还没有可展示的记忆'}
              description={
                hasActiveFilters
                  ? '试着放宽标签、来源或召回状态筛选，或者改用更宽泛的关键词。'
                  : memoryDir
                    ? `当前真实记忆目录为 ${memoryDir}。这里现在为空，说明还没有落盘的记忆文件。`
                    : '当前还没有读取到真实记忆目录。'
              }
              runtimeError={runtimeError}
              action={
                hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={onClearFilters}
                    className="inline-flex cursor-pointer items-center justify-center rounded-[14px] border border-[var(--lobster-ink-border)] bg-[var(--lobster-ink)] px-4 py-2.5 text-[13px] text-[var(--lobster-ink-foreground)] transition-colors hover:bg-[var(--lobster-ink-strong)]"
                  >
                    清除全部筛选
                  </button>
                ) : null
              }
            />
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => {
                const selected = entry.id === selectedId;
                return (
                  <PressableCard
                    key={entry.id}
                    interactive
                    onClick={() => onSelect(entry.id)}
                    className={cn(
                      'rounded-[22px] border-[var(--lobster-border)] bg-[var(--lobster-card-elevated)] px-5 py-4 shadow-none',
                      'hover:border-[var(--lobster-border-strong)] hover:bg-[var(--lobster-card-elevated)] hover:shadow-[var(--lobster-shadow-card)]',
                      selected &&
                        'border-[var(--lobster-gold-border-strong)] bg-[var(--lobster-gold-soft)] shadow-[0_14px_30px_rgba(18,15,11,0.08)]',
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-[14px] leading-6 text-[var(--lobster-text-primary)]">
                              {entry.summary}
                            </p>
                          </div>
                          {entry.importance === '高' ? (
                            <div className="rounded-full bg-[var(--lobster-gold-soft)] p-1 text-[var(--lobster-gold-strong)]">
                              <Sparkles className="h-3.5 w-3.5" />
                            </div>
                          ) : null}
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Badge className={getDomainBadgeClass(entry.domain)}>{entry.domain}</Badge>
                          <Badge className={getTypeBadgeClass(entry.type)}>{entry.type}</Badge>
                          {entry.tags.slice(0, 3).map((tag) => (
                            <Badge
                              key={tag}
                              className="border-[var(--lobster-border)] bg-[var(--lobster-muted-bg)] text-[var(--lobster-text-secondary)]"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2.5 text-[11px] text-[var(--lobster-text-muted)]">
                          <div className={cn('flex items-center gap-1', getStatusTone(entry.status))}>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>{entry.status}</span>
                          </div>
                          <span>·</span>
                          <span>{entry.sourceType}</span>
                          {entry.lastRecalledAt ? (
                            <>
                              <span>·</span>
                              <span>召回: {entry.lastRecalledAt}</span>
                            </>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex min-w-[116px] flex-col items-end gap-2">
                        <Badge className={getImportanceBadgeClass(entry.importance)}>{entry.importance}重要性</Badge>
                        <div className="flex items-center gap-1 text-[11px] text-[var(--lobster-text-muted)]">
                          <Clock3 className="h-3.5 w-3.5" />
                          <span>{entry.createdAt}</span>
                        </div>
                        {entry.recallCount > 0 ? (
                          <div className="text-[11px] text-[#5b7c8d]">{entry.recallCount} 次召回</div>
                        ) : null}
                      </div>
                    </div>
                  </PressableCard>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function EmptyShell({
  icon,
  title,
  description,
  runtimeError,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  runtimeError?: string | null;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[calc(100vh-360px)] items-center justify-center px-8">
      <div className="max-w-[460px] text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--lobster-muted-bg)] text-[var(--lobster-text-muted)]">
          {icon}
        </div>
        <div className="text-[18px] font-medium text-[var(--lobster-text-primary)]">{title}</div>
        <p className="mt-2 text-[13px] leading-7 text-[var(--lobster-text-secondary)]">{description}</p>
        {runtimeError ? <p className="mt-3 text-[12px] leading-6 text-[#a0765c]">{runtimeError}</p> : null}
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </div>
  );
}

function Badge({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium', className)}>
      {children}
    </span>
  );
}

function getStatusTone(status: MemoryEntry['status']) {
  return status === '已确认' ? 'text-[var(--lobster-success-text)]' : 'text-[#a0765c]';
}
