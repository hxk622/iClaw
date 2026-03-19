import { Clock3, FileText, Globe, Presentation, Table2 } from 'lucide-react';
import { cn } from '@/app/lib/cn';
import {
  type RecentTaskArtifact,
  RECENT_TASK_ARTIFACT_LABELS,
  type RecentTaskRecord,
  formatRecentTaskRelativeTime,
  useRecentTasks,
} from '@/app/lib/recent-tasks';
import { INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE } from '@/app/lib/ui-interactions';

const SIDEBAR_TASK_LIMIT = 5;

const statusConfig: Record<
  RecentTaskRecord['status'],
  { label: string; className: string }
> = {
  running: {
    label: '进行中',
    className:
      'border border-[var(--chip-brand-border)] bg-[var(--chip-brand-bg)] text-[var(--chip-brand-text)]',
  },
  completed: {
    label: '已完成',
    className:
      'border border-emerald-500/18 bg-emerald-500/10 text-emerald-600 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300',
  },
  failed: {
    label: '失败',
    className:
      'border border-red-500/18 bg-red-500/10 text-red-600 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300',
  },
};

const artifactIconMap: Record<RecentTaskArtifact, typeof FileText> = {
  report: FileText,
  ppt: Presentation,
  webpage: Globe,
  pdf: FileText,
  sheet: Table2,
};

interface RecentTasksListProps {
  selectedTaskId?: string | null;
  onSelectTask?: (taskId: string) => void;
  onOpenAll?: () => void;
}

export function RecentTasksList({
  selectedTaskId = null,
  onSelectTask,
  onOpenAll,
}: RecentTasksListProps) {
  const tasks = useRecentTasks();
  const visibleTasks = tasks.slice(0, SIDEBAR_TASK_LIMIT);

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between px-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">近期任务</span>
          <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]">
            {Math.min(visibleTasks.length, SIDEBAR_TASK_LIMIT)}
          </span>
        </div>
        <button
          type="button"
          onClick={onOpenAll}
          className={cn(
            'cursor-pointer rounded-full px-2 py-1 text-[11px] text-[var(--text-muted)]',
            'transition-[transform,color,background-color] duration-[var(--motion-panel)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
            SPRING_PRESSABLE,
            INTERACTIVE_FOCUS_RING,
          )}
        >
          查看更多
        </button>
      </div>

      {visibleTasks.length === 0 ? (
        <div className="px-2">
          <button
            type="button"
            onClick={onOpenAll}
            className={cn(
              'w-full cursor-pointer rounded-[18px] border border-dashed border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-3 text-left',
              'text-[11px] leading-5 text-[var(--text-secondary)]',
              SPRING_PRESSABLE,
              INTERACTIVE_FOCUS_RING,
            )}
          >
            发起一次真实对话后，这里会自动记录最近任务。
          </button>
        </div>
      ) : (
        <div className="space-y-2 px-2">
          {visibleTasks.map((task) => {
            const isSelected = task.id === selectedTaskId;

            return (
              <button
                key={task.id}
                type="button"
                onClick={() => onSelectTask?.(task.id)}
                className={cn(
                  'group relative w-full cursor-pointer overflow-hidden rounded-[18px] border p-3 text-left',
                  'shadow-[0_8px_20px_rgba(15,23,42,0.05)] dark:shadow-[0_12px_24px_rgba(0,0,0,0.18)]',
                  SPRING_PRESSABLE,
                  INTERACTIVE_FOCUS_RING,
                  isSelected
                    ? 'border-[var(--border-strong)] bg-[var(--bg-hover)]'
                    : 'border-[var(--border-default)] bg-[var(--bg-card)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]',
                )}
              >
                {task.artifacts.length > 0 ? (
                  <div className="absolute bottom-0 left-0 top-0 w-1 rounded-l-[18px] bg-[linear-gradient(180deg,var(--brand-primary),rgba(168,140,93,0.08))] dark:bg-[linear-gradient(180deg,var(--brand-primary),rgba(180,154,112,0.18))]" />
                ) : null}

                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <div className="line-clamp-2 flex-1 text-[12px] font-medium leading-5 text-[var(--text-primary)]">
                        {task.title}
                      </div>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                          statusConfig[task.status].className,
                        )}
                      >
                        {statusConfig[task.status].label}
                      </span>
                    </div>

                    <div className="mt-2 line-clamp-2 text-[11px] leading-5 text-[var(--text-secondary)]">
                      {task.summary}
                    </div>

                    <div className="mt-3 flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="h-3 w-3" />
                        {formatRecentTaskRelativeTime(task.updatedAt)}
                      </span>
                      <span className="truncate">智能对话</span>
                    </div>

                    {task.artifacts.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {task.artifacts.slice(0, 2).map((artifact) => {
                          const Icon = artifactIconMap[artifact];
                          return (
                            <span
                              key={artifact}
                              className="inline-flex items-center gap-1 rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] px-1.5 py-1 text-[10px] text-[var(--text-secondary)]"
                            >
                              <Icon className="h-3 w-3" />
                              {RECENT_TASK_ARTIFACT_LABELS[artifact]}
                            </span>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
