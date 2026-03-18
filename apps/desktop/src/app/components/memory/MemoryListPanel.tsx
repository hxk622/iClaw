import type { ReactNode } from 'react';
import { AlertCircle, Archive, CheckCircle2, Clock, SearchX, Sparkles, Star } from 'lucide-react';
import { cn } from '@/app/lib/cn';
import type { MemoryEntry } from './model';
import { getDomainBadgeClass, getTypeBadgeClass } from './model';

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
    <section className="flex min-h-0 flex-1 flex-col bg-[#F7F5F0]">
      <div className="border-b border-[#ECE7DE] bg-[#FCFBF8] px-6 py-3">
        <p className="text-[12px] text-[#6B655D]">
          当前显示 <span className="text-[#1A1A18]">{entries.length}</span> / <span className="text-[#1A1A18]">{totalCount}</span> 条记忆
        </p>
      </div>

      <div className="flex-1 overflow-auto px-6 py-3">
        {loading ? (
          <EmptyShell
            icon={<Sparkles size={48} className="text-[#DED7CC]" strokeWidth={1} />}
            title="正在读取真实记忆"
            description="正在从本地桌面工作区加载记忆与索引状态"
          />
        ) : entries.length === 0 ? (
          <EmptyShell
            icon={
              hasActiveFilters ? (
                <SearchX size={48} className="text-[#DED7CC]" strokeWidth={1} />
              ) : (
                <Archive size={48} className="text-[#DED7CC]" strokeWidth={1} />
              )
            }
            title={hasActiveFilters ? '未找到匹配的记忆' : '暂无记忆'}
            description={
              hasActiveFilters
                ? '尝试调整搜索关键词或筛选条件'
                : memoryDir
                  ? `当前真实记忆目录为 ${memoryDir}`
                  : '开始创建 AI 的第一条记忆'
            }
            runtimeError={runtimeError}
            action={
              hasActiveFilters ? (
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="cursor-pointer rounded-lg bg-[#1A1A18] px-4 py-2.5 text-[13px] text-white shadow-sm transition-all duration-200 hover:bg-[#2D2D2B]"
                >
                  清除所有筛选
                </button>
              ) : null
            }
          />
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => {
              const selected = selectedId === entry.id;
              return (
                <button
                  key={entry.id}
                  onClick={() => onSelect(entry.id)}
                  className={cn(
                    'w-full cursor-pointer rounded-lg border px-5 py-4 text-left transition-all duration-200',
                    selected
                      ? 'border-[#A88C5D] bg-[#F8F4ED] shadow-sm'
                      : 'border-[#ECE7DE] bg-white hover:-translate-y-0.5 hover:border-[#DED7CC] hover:shadow-sm',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="mb-2.5 line-clamp-2 text-[13px] leading-relaxed text-[#1A1A18]">{entry.summary}</p>

                      <div className="mb-2.5 flex flex-wrap items-center gap-2">
                        <Badge className={getDomainBadgeClass(entry.domain)}>{entry.domain}</Badge>
                        <Badge className={getTypeBadgeClass(entry.type)}>{entry.type}</Badge>
                        {entry.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} className="border-none bg-[#ECE7DE] text-[#6B655D]">
                            {tag}
                          </Badge>
                        ))}
                      </div>

                      <div className="flex items-center gap-2.5 text-[11px] text-[#9A9288]">
                        {getStatusBadge(entry.status)}
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

                    <div className="flex min-w-[100px] flex-col items-end gap-2">
                      <div className="flex items-center gap-1">{getImportanceIcon(entry.importance)}</div>
                      <div className="flex items-center gap-1.5 text-[11px] text-[#9A9288]">
                        <Clock size={11} strokeWidth={1.5} />
                        <span>{entry.createdAt}</span>
                      </div>
                      {entry.recallCount > 0 ? (
                        <div className="text-[11px] text-[#5B7C8D]">{entry.recallCount} 次召回</div>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
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
    <div className="flex min-h-full items-center justify-center bg-[#F7F5F0]">
      <div className="px-8 text-center">
        <div className="mx-auto mb-4 flex justify-center">{icon}</div>
        <p className="mb-1.5 text-[15px] text-[#1A1A18]">{title}</p>
        <p className="text-[13px] text-[#9A9288]">{description}</p>
        {runtimeError ? <p className="mt-3 text-[12px] leading-6 text-[#A0765C]">{runtimeError}</p> : null}
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
    <span className={cn('inline-flex items-center rounded px-2 py-0.5 text-[11px]', className)}>
      {children}
    </span>
  );
}

function getStatusBadge(status: MemoryEntry['status']) {
  const config =
    status === '已确认'
      ? { icon: CheckCircle2, label: '已确认', color: 'text-[#5A7860]' }
      : { icon: AlertCircle, label: '待检查', color: 'text-[#A0765C]' };
  const Icon = config.icon;

  return (
    <div className={cn('flex items-center gap-1', config.color)}>
      <Icon size={11} strokeWidth={1.5} />
      <span className="text-[11px]">{config.label}</span>
    </div>
  );
}

function getImportanceIcon(importance: MemoryEntry['importance']) {
  if (importance !== '高') return null;
  return <Star size={13} fill="#A88C5D" stroke="#A88C5D" strokeWidth={1.5} />;
}
