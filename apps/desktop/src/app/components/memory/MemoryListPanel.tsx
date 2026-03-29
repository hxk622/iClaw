import type { ReactNode } from 'react';
import { AlertCircle, Archive, CalendarClock, CheckCircle2, Clock3, FolderTree, SearchX, Sparkles, Star } from 'lucide-react';
import { cn } from '@/app/lib/cn';
import { Button } from '@/app/components/ui/Button';
import { Chip } from '@/app/components/ui/Chip';
import { EmptyStatePanel } from '@/app/components/ui/EmptyStatePanel';
import { PressableCard } from '@/app/components/ui/PressableCard';
import { SurfacePanel } from '@/app/components/ui/SurfacePanel';
import type { MemoryRuntimeStatus } from '@/app/lib/tauri-memory';
import type { MemoryEntry } from './model';
import {
  getDomainBadgeClass,
  getImportanceBadgeClass,
  getStatusBadgeClass,
  getTypeBadgeClass,
} from './model';

export function MemoryListPanel({
  entries,
  totalCount,
  selectedId,
  loading,
  hasActiveFilters,
  runtimeError,
  runtimeStatus,
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
  runtimeStatus: MemoryRuntimeStatus | null;
  memoryDir: string;
  onSelect: (id: string) => void;
  onClearFilters: () => void;
}) {
  const configHint = !runtimeStatus?.embeddingConfigured
    ? '当前未配置记忆 Embedding；手动记忆可以继续使用，但向量召回不会启动。'
    : runtimeError || runtimeStatus?.vectorError
      ? `当前记忆 Embedding 已配置，但运行异常：${runtimeStatus?.vectorError || runtimeError}`
      : null;
  return (
    <SurfacePanel className="overflow-hidden rounded-[24px] border-[var(--border-default)] bg-[var(--bg-card)]">
      <div className="flex flex-col gap-3 border-b border-[var(--border-default)] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-[15px] font-medium text-[var(--text-primary)]">记忆列表</div>
          <p className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">
            当前显示 <span className="text-[var(--text-primary)]">{entries.length}</span> /{' '}
            <span className="text-[var(--text-primary)]">{totalCount}</span> 条记忆
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {memoryDir ? (
            <Chip tone="outline" className="rounded-full px-3 py-1 text-[12px]">
              <FolderTree className="h-3.5 w-3.5" />
              {memoryDir}
            </Chip>
          ) : null}
          {runtimeError ? (
            <Chip tone="danger" className="rounded-full px-3 py-1 text-[12px]">
              <AlertCircle className="h-3.5 w-3.5" />
              {runtimeError}
            </Chip>
          ) : null}
          {configHint ? (
            <Chip tone="warning" className="rounded-full px-3 py-1 text-[12px]">
              <AlertCircle className="h-3.5 w-3.5" />
              {configHint}
            </Chip>
          ) : null}
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <EmptyShell
            icon={<Sparkles className="h-5 w-5" strokeWidth={1.5} />}
            title="正在读取真实记忆"
            description="正在从本地桌面工作区加载记忆与索引状态"
          />
        ) : entries.length === 0 ? (
          <EmptyShell
            icon={
              hasActiveFilters ? (
                <SearchX className="h-5 w-5" strokeWidth={1.5} />
              ) : (
                <Archive className="h-5 w-5" strokeWidth={1.5} />
              )
            }
            title={hasActiveFilters ? '未找到匹配的记忆' : '暂无记忆'}
            description={
              hasActiveFilters
                ? '尝试调整搜索关键词或筛选条件'
                : memoryDir
                  ? '当前目录已经连接，可继续创建、导入或等待自动沉淀'
                  : '开始创建 AI 的第一条记忆'
            }
            action={
              hasActiveFilters ? (
                <Button onClick={onClearFilters} variant="primary" size="sm" className="px-4 py-2.5 text-[13px]">
                  清除所有筛选
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => {
              const selected = selectedId === entry.id;
              return (
                <PressableCard
                  key={entry.id}
                  interactive
                  onClick={() => onSelect(entry.id)}
                  className={cn(
                    'w-full rounded-[20px] border px-5 py-4 text-left shadow-[var(--shadow-sm)]',
                    selected
                      ? 'border-[var(--chip-brand-border-strong)] bg-[var(--chip-brand-bg)]'
                      : 'border-[var(--border-default)] bg-[var(--bg-elevated)] hover:border-[var(--border-strong)]',
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="line-clamp-1 text-[15px] font-medium text-[var(--text-primary)]">{entry.title}</p>
                          <p className="mt-1.5 line-clamp-2 text-[13px] leading-6 text-[var(--text-secondary)]">{entry.summary}</p>
                        </div>
                        {entry.recallCount > 0 ? (
                          <Chip tone="accent" className="rounded-full px-3 py-1 text-[12px]">
                            <Sparkles className="h-3.5 w-3.5" />
                            {entry.recallCount} 次召回
                          </Chip>
                        ) : null}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Badge className={getDomainBadgeClass(entry.domain)}>{entry.domain}</Badge>
                        <Badge className={getTypeBadgeClass(entry.type)}>{entry.type}</Badge>
                        <Badge className={getImportanceBadgeClass(entry.importance)}>{entry.importance} 重要性</Badge>
                        <Badge className={getStatusBadgeClass(entry.status)}>{entry.status}</Badge>
                        {entry.tags.slice(0, 3).map((tag) => (
                          <Chip key={tag} tone="outline" className="rounded-full px-3 py-1 text-[12px]">
                            {tag}
                          </Chip>
                        ))}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px] text-[var(--text-muted)]">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock3 size={13} strokeWidth={1.6} />
                          来源：{entry.sourceType}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarClock size={13} strokeWidth={1.6} />
                          更新：{entry.updatedAt}
                        </span>
                        {entry.lastRecalledAt ? (
                          <span className="inline-flex items-center gap-1.5">
                            <CheckCircle2 size={13} strokeWidth={1.6} />
                            最近召回：{entry.lastRecalledAt}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex min-w-[108px] flex-col items-end gap-2">
                      <div className="flex items-center gap-1">{getImportanceIcon(entry.importance)}</div>
                      <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                        <Clock3 size={11} strokeWidth={1.5} />
                        <span>{entry.createdAt}</span>
                      </div>
                    </div>
                  </div>
                </PressableCard>
              );
            })}
          </div>
        )}
      </div>
    </SurfacePanel>
  );
}

function EmptyShell({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <EmptyStatePanel
      className="min-h-[280px] rounded-[20px] border-[var(--border-default)]"
      icon={icon}
      title={title}
      description={description}
      action={action}
    />
  );
}

function Badge({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  return <span className={cn('inline-flex items-center rounded-full border px-3 py-1 text-[12px]', className)}>{children}</span>;
}

function getImportanceIcon(importance: MemoryEntry['importance']) {
  if (importance !== '高') return null;
  return <Star size={13} fill="#A88C5D" stroke="#A88C5D" strokeWidth={1.5} />;
}
