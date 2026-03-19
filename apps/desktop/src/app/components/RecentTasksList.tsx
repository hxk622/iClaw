import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Clock3, FileText, Globe, MoreHorizontal, PencilLine, Pin, Presentation, Table2, Trash2, X } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { Chip } from '@/app/components/ui/Chip';
import { cn } from '@/app/lib/cn';
import {
  deleteRecentTask,
  type RecentTaskArtifact,
  RECENT_TASK_ARTIFACT_LABELS,
  renameRecentTask,
  type RecentTaskRecord,
  formatRecentTaskRelativeTime,
  setRecentTaskPinned,
  useRecentTasks,
} from '@/app/lib/recent-tasks';
import { INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE } from '@/app/lib/ui-interactions';

const SIDEBAR_TASK_LIMIT = 5;

const statusConfig: Record<
  RecentTaskRecord['status'],
  { label: string; tone: 'brand' | 'success' | 'danger' }
> = {
  running: {
    label: '进行中',
    tone: 'brand',
  },
  completed: {
    label: '已完成',
    tone: 'success',
  },
  failed: {
    label: '失败',
    tone: 'danger',
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
  const [activeMenuTaskId, setActiveMenuTaskId] = useState<string | null>(null);
  const [renameTask, setRenameTask] = useState<RecentTaskRecord | null>(null);
  const [deleteTaskRecord, setDeleteTaskRecord] = useState<RecentTaskRecord | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const menuRef = useRef<HTMLDivElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!activeMenuTaskId) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setActiveMenuTaskId(null);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveMenuTaskId(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [activeMenuTaskId]);

  useEffect(() => {
    if (!renameTask) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [renameTask]);

  useEffect(() => {
    if (activeMenuTaskId && !tasks.some((task) => task.id === activeMenuTaskId)) {
      setActiveMenuTaskId(null);
    }
    if (renameTask && !tasks.some((task) => task.id === renameTask.id)) {
      setRenameTask(null);
      setRenameValue('');
    }
    if (deleteTaskRecord && !tasks.some((task) => task.id === deleteTaskRecord.id)) {
      setDeleteTaskRecord(null);
    }
  }, [activeMenuTaskId, deleteTaskRecord, renameTask, tasks]);

  useEffect(() => {
    if (!renameTask && !deleteTaskRecord) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      if (renameTask) {
        closeRenameDialog();
        return;
      }
      if (deleteTaskRecord) {
        closeDeleteDialog();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [deleteTaskRecord, renameTask]);

  const openRenameDialog = (task: RecentTaskRecord) => {
    setActiveMenuTaskId(null);
    setRenameTask(task);
    setRenameValue(task.title);
  };

  const closeRenameDialog = () => {
    setRenameTask(null);
    setRenameValue('');
  };

  const handleRenameSubmit = () => {
    if (!renameTask) {
      return;
    }

    const nextTitle = renameValue.trim();
    if (!nextTitle) {
      renameInputRef.current?.focus();
      return;
    }

    renameRecentTask(renameTask.id, nextTitle);
    closeRenameDialog();
  };

  const closeDeleteDialog = () => {
    setDeleteTaskRecord(null);
  };

  return (
    <>
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between px-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)]">历史任务</span>
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
              发起一次真实对话后，这里会自动记录历史任务。
            </button>
          </div>
        ) : (
          <div className="space-y-2 px-2">
            {visibleTasks.map((task) => {
              const isSelected = task.id === selectedTaskId;
              const isMenuOpen = task.id === activeMenuTaskId;
              const isPinned = Boolean(task.pinnedAt);

              return (
                <div key={task.id} className={cn('group relative', isMenuOpen ? 'z-20' : '')}>
                  <button
                    type="button"
                    onClick={() => onSelectTask?.(task.id)}
                    className={cn(
                      'relative w-full cursor-pointer overflow-hidden rounded-[18px] border p-3 pr-12 text-left',
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
                          <Chip tone={statusConfig[task.status].tone} className="shrink-0 px-1.5 py-0.5 text-[10px] font-medium">
                            {statusConfig[task.status].label}
                          </Chip>
                        </div>

                        <div className="mt-2 line-clamp-2 text-[11px] leading-5 text-[var(--text-secondary)]">
                          {task.summary}
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-[var(--text-muted)]">
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="h-3 w-3" />
                            {formatRecentTaskRelativeTime(task.updatedAt)}
                          </span>
                          <span className="truncate">智能对话</span>
                          {isPinned ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(168,140,93,0.18)] bg-[rgba(168,140,93,0.10)] px-1.5 py-0.5 text-[var(--brand-primary)]">
                              <Pin className="h-3 w-3" />
                              置顶
                            </span>
                          ) : null}
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

                  <div
                    ref={isMenuOpen ? menuRef : null}
                    className="absolute right-3 top-3"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      aria-label={`${task.title} 更多操作`}
                      aria-haspopup="menu"
                      aria-expanded={isMenuOpen}
                      onClick={(event) => {
                        event.stopPropagation();
                        setActiveMenuTaskId((current) => (current === task.id ? null : task.id));
                      }}
                      className={cn(
                        'flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-transparent bg-[var(--bg-elevated)] text-[var(--text-muted)] shadow-[var(--shadow-sm)]',
                        'transition-[transform,opacity,color,background-color,border-color] duration-[var(--motion-panel)]',
                        'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
                        isMenuOpen
                          ? 'border-[var(--border-default)] opacity-100 text-[var(--text-primary)]'
                          : 'hover:border-[var(--border-default)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
                        SPRING_PRESSABLE,
                        INTERACTIVE_FOCUS_RING,
                      )}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>

                    {isMenuOpen ? (
                      <div
                        role="menu"
                        aria-label={`${task.title} 任务操作`}
                        className="absolute right-0 top-10 w-[172px] rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-1.5 shadow-[var(--shadow-popover)] backdrop-blur-[12px]"
                      >
                        <TaskMenuItem
                          icon={<Pin className="h-4 w-4" />}
                          label={isPinned ? '取消置顶' : '置顶'}
                          onClick={() => {
                            setRecentTaskPinned(task.id, !isPinned);
                            setActiveMenuTaskId(null);
                          }}
                        />
                        <TaskMenuItem
                          icon={<PencilLine className="h-4 w-4" />}
                          label="重命名"
                          onClick={() => openRenameDialog(task)}
                        />
                        <TaskMenuItem
                          icon={<Trash2 className="h-4 w-4" />}
                          label="删除"
                          danger
                          onClick={() => {
                            setActiveMenuTaskId(null);
                            setDeleteTaskRecord(task);
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {renameTask ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(8,12,20,0.24)] px-4 backdrop-blur-[4px] dark:bg-[rgba(0,0,0,0.42)]"
          onClick={closeRenameDialog}
        >
          <form
            className="w-full max-w-[420px] rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-5 shadow-[0_24px_60px_rgba(15,23,42,0.18)]"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              handleRenameSubmit();
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[15px] font-semibold text-[var(--text-primary)]">重命名任务</div>
                <div className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">
                  修改展示名称，不影响任务内容和状态记录。
                </div>
              </div>
              <button
                type="button"
                onClick={closeRenameDialog}
                className={cn(
                  'flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
                  INTERACTIVE_FOCUS_RING,
                )}
                aria-label="关闭重命名弹层"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="mt-4 block">
              <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
                任务名称
              </span>
              <input
                ref={renameInputRef}
                type="text"
                value={renameValue}
                maxLength={48}
                onChange={(event) => setRenameValue(event.target.value)}
                placeholder="输入新的任务名称"
                className="min-h-[44px] w-full rounded-[16px] border border-[var(--border-default)] bg-[var(--bg-card)] px-4 text-[14px] text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--border-strong)] focus:ring-2 focus:ring-[var(--brand-primary)]/18"
              />
            </label>

            <div className="mt-4 flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" type="button" onClick={closeRenameDialog}>
                取消
              </Button>
              <Button variant="primary" size="sm" type="submit">
                保存
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {deleteTaskRecord ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(8,12,20,0.28)] px-4 backdrop-blur-[4px] dark:bg-[rgba(0,0,0,0.46)]"
          onClick={closeDeleteDialog}
        >
          <div
            className="w-full max-w-[420px] rounded-[24px] border border-[rgba(239,68,68,0.12)] bg-[var(--bg-elevated)] p-5 shadow-[0_24px_60px_rgba(15,23,42,0.20)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[rgba(239,68,68,0.10)] text-[rgb(185,28,28)] dark:bg-[rgba(239,68,68,0.16)] dark:text-[#fecaca]">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold text-[var(--text-primary)]">删除这条历史任务？</div>
                <div className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">
                  删除后不会影响原始对话，只会从历史任务列表中移除。
                </div>
                <div className="mt-3 rounded-[16px] border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2 text-[13px] text-[var(--text-primary)]">
                  {deleteTaskRecord.title}
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={closeDeleteDialog}>
                取消
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  deleteRecentTask(deleteTaskRecord.id);
                  closeDeleteDialog();
                }}
              >
                删除
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function TaskMenuItem({
  icon,
  label,
  danger = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full cursor-pointer items-center gap-3 rounded-[14px] px-3 py-2.5 text-left text-[13px] transition-[transform,color,background-color] duration-[var(--motion-panel)]',
        danger
          ? 'text-[var(--state-error)] hover:bg-[rgba(239,68,68,0.08)]'
          : 'text-[var(--text-primary)] hover:bg-[var(--bg-hover)]',
        SPRING_PRESSABLE,
        INTERACTIVE_FOCUS_RING,
      )}
    >
      <span className={cn('shrink-0', danger ? 'text-[var(--state-error)]' : 'text-[var(--text-secondary)]')}>
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}
