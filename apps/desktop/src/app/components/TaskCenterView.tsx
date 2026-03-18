import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileText,
  Globe,
  ListTodo,
  Loader2,
  MessageSquare,
  Presentation,
  Search,
  Table2,
  XCircle,
} from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { PressableCard } from '@/app/components/ui/PressableCard';
import { cn } from '@/app/lib/cn';
import {
  type RecentTaskArtifact,
  RECENT_TASK_ARTIFACT_LABELS,
  type RecentTaskRecord,
  formatRecentTaskRelativeTime,
  useRecentTasks,
} from '@/app/lib/recent-tasks';

type TaskFilter = 'all' | RecentTaskRecord['status'];

const filterLabelMap: Record<TaskFilter, string> = {
  all: '全部',
  running: '进行中',
  completed: '已完成',
  failed: '失败',
};

const artifactIconMap: Record<RecentTaskArtifact, typeof FileText> = {
  report: FileText,
  ppt: Presentation,
  webpage: Globe,
  pdf: FileText,
  sheet: Table2,
};

const statusConfig: Record<
  RecentTaskRecord['status'],
  {
    label: string;
    icon: typeof CheckCircle2;
    badgeTone: string;
    hintTone: string;
    helperText: string;
  }
> = {
  running: {
    label: '进行中',
    icon: Loader2,
    badgeTone:
      'border border-blue-500/16 bg-blue-500/10 text-blue-600 dark:border-blue-400/18 dark:bg-blue-400/10 dark:text-blue-300',
    hintTone:
      'border border-blue-500/14 bg-blue-500/8 text-blue-700 dark:border-blue-400/16 dark:bg-blue-400/10 dark:text-blue-200',
    helperText: '任务仍在处理中，完成后会自动更新。',
  },
  completed: {
    label: '已完成',
    icon: CheckCircle2,
    badgeTone:
      'border border-emerald-500/16 bg-emerald-500/10 text-emerald-600 dark:border-emerald-400/18 dark:bg-emerald-400/10 dark:text-emerald-300',
    hintTone:
      'border border-emerald-500/14 bg-emerald-500/8 text-emerald-700 dark:border-emerald-400/16 dark:bg-emerald-400/10 dark:text-emerald-200',
    helperText: '可以继续围绕这条任务补充问题或延展结果。',
  },
  failed: {
    label: '失败',
    icon: XCircle,
    badgeTone:
      'border border-red-500/16 bg-red-500/10 text-red-600 dark:border-red-400/18 dark:bg-red-400/10 dark:text-red-300',
    hintTone:
      'border border-red-500/14 bg-red-500/8 text-red-700 dark:border-red-400/16 dark:bg-red-400/10 dark:text-red-200',
    helperText: '任务未顺利完成，建议回到对话继续处理。',
  },
};

interface TaskCenterViewProps {
  selectedTaskId?: string | null;
  onSelectTask?: (taskId: string) => void;
  onOpenChat?: () => void;
}

export function TaskCenterView({
  selectedTaskId = null,
  onSelectTask,
  onOpenChat,
}: TaskCenterViewProps) {
  const tasks = useRecentTasks();
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [query, setQuery] = useState('');

  const filteredTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return tasks.filter((task) => {
      const matchesFilter = filter === 'all' ? true : task.status === filter;
      const matchesQuery =
        normalizedQuery.length === 0
          ? true
          : `${task.title} ${task.summary} ${task.prompt}`.toLowerCase().includes(normalizedQuery);
      return matchesFilter && matchesQuery;
    });
  }, [filter, query, tasks]);

  const selectedTask =
    filteredTasks.find((task) => task.id === selectedTaskId) ?? filteredTasks[0] ?? null;

  useEffect(() => {
    if (!selectedTaskId && filteredTasks[0]) {
      onSelectTask?.(filteredTasks[0].id);
      return;
    }

    if (selectedTaskId && !filteredTasks.some((task) => task.id === selectedTaskId) && filteredTasks[0]) {
      onSelectTask?.(filteredTasks[0].id);
    }
  }, [filteredTasks, onSelectTask, selectedTaskId]);

  const stats = {
    total: tasks.length,
    running: tasks.filter((task) => task.status === 'running').length,
    completed: tasks.filter((task) => task.status === 'completed').length,
  };

  return (
    <div className="flex flex-1 overflow-y-auto bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50 transition-colors dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-8 py-8">
        <section>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                历史任务
              </h1>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                查看最近发起的任务、结果与更新状态
              </p>
            </div>

            <button
              type="button"
              onClick={onOpenChat}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-blue-500 px-5 py-2.5 text-sm font-medium text-white transition-[transform,background-color] duration-[var(--motion-panel)] hover:-translate-y-[1px] hover:bg-blue-600 active:scale-[0.985]"
              style={{ transitionTimingFunction: 'var(--motion-spring)' }}
            >
              <ArrowLeft className="h-4 w-4" />
              返回智能对话
            </button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
            <MetricCard
              label="任务总数"
              value={String(stats.total)}
              note="自动累计"
              icon={ListTodo}
              tone="neutral"
            />
            <MetricCard
              label="进行中"
              value={String(stats.running)}
              note="实时刷新"
              icon={Loader2}
              tone="running"
            />
            <MetricCard
              label="已完成"
              value={String(stats.completed)}
              note="可继续衔接"
              icon={CheckCircle2}
              tone="completed"
            />
        </section>

        <section className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="搜索任务主题或内容"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-12 pr-4 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/50 dark:border-gray-700/50 dark:bg-gray-800/50 dark:text-gray-100 dark:placeholder:text-gray-500"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            {(Object.keys(filterLabelMap) as TaskFilter[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={cn(
                  'inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium',
                  'transition-[transform,box-shadow,border-color,background-color,color] duration-[var(--motion-panel)] hover:-translate-y-[1px] active:scale-[0.985]',
                  item === filter
                    ? 'border-blue-500 bg-blue-500 text-white shadow-md dark:border-blue-500 dark:bg-blue-500 dark:text-white'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300 dark:border-gray-700/50 dark:bg-gray-800/50 dark:text-gray-300 dark:hover:border-blue-500/50',
                )}
                style={{ transitionTimingFunction: 'var(--motion-spring)' }}
              >
                <span>{filterLabelMap[item]}</span>
                <span className={cn('text-xs', item === filter ? 'opacity-80' : 'opacity-50')}>
                  {item === 'all'
                    ? tasks.length
                    : tasks.filter((task) => task.status === item).length}
                </span>
              </button>
            ))}
          </div>
        </section>

        {tasks.length === 0 ? (
          <section className="rounded-2xl border border-gray-200/60 bg-white px-8 py-12 text-center dark:border-gray-700/50 dark:bg-gray-800/50">
            <div className="mx-auto max-w-[520px]">
              <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-[18px] bg-blue-50 text-blue-500 dark:bg-blue-950/30 dark:text-blue-400">
                <MessageSquare className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-[22px] font-semibold text-gray-900 dark:text-gray-100">还没有任务记录</h2>
              <p className="mt-2 text-sm leading-7 text-gray-600 dark:text-gray-400">
                发起一次真实对话后，这里会自动生成任务记录，并持续更新状态与结果类型。
              </p>
              <div className="mt-5">
                <button
                  type="button"
                  onClick={onOpenChat}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-blue-500 px-5 py-2.5 text-sm font-medium text-white transition-[transform,background-color] duration-[var(--motion-panel)] hover:-translate-y-[1px] hover:bg-blue-600 active:scale-[0.985]"
                  style={{ transitionTimingFunction: 'var(--motion-spring)' }}
                >
                  返回智能对话
                </button>
              </div>
            </div>
          </section>
        ) : (
          <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
            <div className="space-y-4">
              {filteredTasks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200/60 bg-white px-6 py-9 text-sm text-gray-600 dark:border-gray-700/50 dark:bg-gray-800/50 dark:text-gray-400">
                  未找到匹配的任务，可以换个关键词或状态看看。
                </div>
              ) : (
                filteredTasks.map((task) => {
                  const status = statusConfig[task.status];
                  const StatusIcon = status.icon;
                  const isSelected = selectedTask?.id === task.id;

                  return (
                    <PressableCard
                      key={task.id}
                      interactive
                      onClick={() => onSelectTask?.(task.id)}
                      className={cn(
                        'group rounded-2xl border bg-white p-5 dark:bg-gray-800/50',
                        isSelected
                          ? 'border-2 border-blue-400 bg-blue-50/50 shadow-md dark:border-blue-500 dark:bg-blue-950/20'
                          : 'border-gray-200/60 hover:border-gray-300 dark:border-gray-700/50 dark:hover:border-gray-600',
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium',
                                status.badgeTone,
                              )}
                            >
                              <StatusIcon className={cn('h-3.5 w-3.5', task.status === 'running' ? 'animate-spin' : '')} />
                              {status.label}
                            </span>
                          </div>

                          <h2 className="mt-3 text-base font-semibold text-gray-900 dark:text-gray-100">
                            {task.title}
                          </h2>

                          <p className="mt-2 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
                            {task.summary}
                          </p>

                          {task.artifacts.length > 0 ? (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {task.artifacts.map((artifact) => {
                                const Icon = artifactIconMap[artifact];
                                return (
                                  <span
                                    key={artifact}
                                    className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-2.5 py-1 text-xs text-gray-700 dark:bg-gray-700/50 dark:text-gray-300"
                                  >
                                    <Icon className="h-3.5 w-3.5" />
                                    {RECENT_TASK_ARTIFACT_LABELS[artifact]}
                                  </span>
                                );
                              })}
                            </div>
                          ) : null}

                          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                            <span className="inline-flex items-center gap-1.5">
                              <Clock3 className="h-3.5 w-3.5" />
                              {formatRecentTaskRelativeTime(task.updatedAt)}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <CalendarClock className="h-3.5 w-3.5" />
                              {formatAbsoluteDate(task.createdAt)}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onOpenChat?.();
                            }}
                            className={cn(
                              'rounded-lg px-3 py-1 text-xs font-medium text-blue-600 transition-[transform,opacity,background-color] duration-[var(--motion-panel)] hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30',
                              'pointer-events-none translate-y-1 opacity-0 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100',
                              isSelected ? 'pointer-events-auto translate-y-0 opacity-100' : '',
                            )}
                            style={{ transitionTimingFunction: 'var(--motion-spring)' }}
                          >
                            继续对话
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </PressableCard>
                  );
                })
              )}
            </div>

            <aside className="xl:sticky xl:top-6 xl:self-start">
              <div className="rounded-2xl border border-gray-200/60 bg-white p-6 dark:border-gray-700/50 dark:bg-gray-800/50">
                {selectedTask ? (
                  <TaskSummaryPanel task={selectedTask} onOpenChat={onOpenChat} />
                ) : (
                  <div className="flex min-h-[360px] items-center justify-center text-center text-sm leading-7 text-gray-500 dark:text-gray-400">
                    选择一条任务记录后，这里会展示更完整的任务摘要。
                  </div>
                )}
              </div>
            </aside>
          </section>
        )}
      </div>
    </div>
  );
}

function TaskSummaryPanel({
  task,
  onOpenChat,
}: {
  task: RecentTaskRecord;
  onOpenChat?: () => void;
}) {
  const status = statusConfig[task.status];
  const StatusIcon = status.icon;

  return (
    <div className="flex flex-col">
      <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
        当前查看
      </div>

      <h3 className="mt-3 text-xl font-semibold text-gray-900 dark:text-gray-100">
        {task.title}
      </h3>

      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        {task.summary}
      </p>

      <div className="mt-5 inline-flex w-fit items-center gap-2 rounded-full text-sm font-medium">
        <span className={cn('inline-flex items-center gap-1 rounded-full px-3 py-1', status.badgeTone)}>
          <StatusIcon className={cn('h-3.5 w-3.5', task.status === 'running' ? 'animate-spin' : '')} />
          {status.label}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <SummaryMetaCard label="最近更新" value={formatRecentTaskRelativeTime(task.updatedAt)} />
        <SummaryMetaCard label="任务来源" value="智能对话" />
        <SummaryMetaCard label="创建时间" value={formatAbsoluteDate(task.createdAt)} />
        <SummaryMetaCard
          label="结果类型"
          value={
            task.artifacts.length > 0
              ? task.artifacts.map((artifact) => RECENT_TASK_ARTIFACT_LABELS[artifact]).join(' / ')
              : '暂未识别'
          }
        />
      </div>

      {task.artifacts.length > 0 ? (
        <div className="mt-5">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400">结果类型</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {task.artifacts.map((artifact) => {
              const Icon = artifactIconMap[artifact];
              return (
                <span
                  key={artifact}
                  className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700/50 dark:text-gray-300"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {RECENT_TASK_ARTIFACT_LABELS[artifact]}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className={cn('mt-5 rounded-xl border px-4 py-4 text-sm', status.hintTone)}>
        <div className="flex items-start gap-3">
          <StatusIcon className={cn('mt-0.5 h-4 w-4 shrink-0', task.status === 'running' ? 'animate-spin' : '')} />
          <p>{task.lastError || status.helperText}</p>
        </div>
      </div>

      <div className="mt-5">
        <div className="text-xs font-medium text-gray-500 dark:text-gray-400">简短说明</div>
        <p className="mt-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
          {task.summary}
        </p>
      </div>

      <div className="mt-6">
        <button
          type="button"
          onClick={onOpenChat}
          className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-500 px-6 py-3 text-sm font-medium text-white transition-[transform,background-color] duration-[var(--motion-panel)] hover:-translate-y-[1px] hover:bg-blue-600 active:scale-[0.985]"
          style={{ transitionTimingFunction: 'var(--motion-spring)' }}
        >
          返回智能对话
        </button>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  note,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  icon: typeof ListTodo;
  tone: 'neutral' | 'running' | 'completed';
}) {
  const iconTone =
    tone === 'running'
      ? 'bg-[rgba(59,130,246,0.14)] text-[rgb(37,99,235)] dark:bg-[rgba(59,130,246,0.18)] dark:text-[rgb(147,197,253)]'
      : tone === 'completed'
        ? 'bg-[rgba(16,185,129,0.14)] text-[rgb(5,150,105)] dark:bg-[rgba(16,185,129,0.18)] dark:text-[rgb(110,231,183)]'
        : 'bg-[rgba(15,23,42,0.08)] text-[rgb(51,65,85)] dark:bg-[rgba(255,255,255,0.08)] dark:text-[rgb(203,213,225)]';

  return (
    <div className="flex cursor-pointer items-center gap-4 rounded-2xl border border-gray-200/60 bg-white px-6 py-5 transition-[transform,box-shadow] duration-[var(--motion-panel)] hover:-translate-y-[1px] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] dark:border-gray-700/50 dark:bg-gray-800/50">
      <div className={cn('flex h-11 w-11 items-center justify-center rounded-[16px]', iconTone)}>
        <Icon className={cn('h-5 w-5', tone === 'running' ? 'animate-spin' : '')} />
      </div>
      <div className="min-w-0">
        <div className="text-sm text-gray-500 dark:text-gray-400">{label}</div>
        <div className="mt-1 flex items-end gap-2">
          <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{value}</div>
          <div className="pb-1 text-xs text-gray-500 dark:text-gray-400">{note}</div>
        </div>
      </div>
    </div>
  );
}

function SummaryMetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200/60 bg-gray-50 px-4 py-3 dark:border-gray-700/50 dark:bg-gray-900/30">
      <div className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-1 text-sm text-gray-900 dark:text-gray-100">{value}</div>
    </div>
  );
}

function formatAbsoluteDate(dateString: string): string {
  const timestamp = new Date(dateString).getTime();
  if (!Number.isFinite(timestamp)) {
    return '刚刚';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
  }).format(new Date(timestamp));
}
