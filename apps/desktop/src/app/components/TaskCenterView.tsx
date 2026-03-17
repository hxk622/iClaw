import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileText,
  Globe,
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
  { label: string; icon: typeof CheckCircle2; tone: string; meta: string }
> = {
  running: {
    label: '进行中',
    icon: Clock3,
    tone:
      'border border-blue-500/18 bg-blue-500/10 text-blue-600 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-300',
    meta: '任务仍在处理中，完成后会自动更新结果类型。',
  },
  completed: {
    label: '已完成',
    icon: CheckCircle2,
    tone:
      'border border-emerald-500/18 bg-emerald-500/10 text-emerald-600 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300',
    meta: '这条记录已经完成，可以继续在对话里衔接下一个动作。',
  },
  failed: {
    label: '失败',
    icon: XCircle,
    tone:
      'border border-red-500/18 bg-red-500/10 text-red-600 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300',
    meta: '这条记录未顺利完成，建议返回对话继续处理。',
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
          : `${task.title} ${task.summary}`.toLowerCase().includes(normalizedQuery);
      return matchesFilter && matchesQuery;
    });
  }, [filter, query, tasks]);

  const selectedTask = filteredTasks.find((task) => task.id === selectedTaskId) || filteredTasks[0] || null;

  useEffect(() => {
    if (!selectedTaskId && filteredTasks[0]) {
      onSelectTask?.(filteredTasks[0].id);
      return;
    }

    if (selectedTaskId && !filteredTasks.some((task) => task.id === selectedTaskId) && filteredTasks[0]) {
      onSelectTask?.(filteredTasks[0].id);
    }
  }, [filteredTasks, onSelectTask, selectedTaskId]);

  const totalCount = tasks.length;
  const runningCount = tasks.filter((task) => task.status === 'running').length;
  const completedCount = tasks.filter((task) => task.status === 'completed').length;

  return (
    <div className="flex flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.10),transparent_28%),linear-gradient(180deg,#f4f6fb_0%,#f7f7f3_48%,#eef1f6_100%)] dark:bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_30%),linear-gradient(180deg,#0c0c0d_0%,#121212_40%,#101010_100%)]">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-4 px-6 py-5 lg:px-8">
        <section className="rounded-[24px] border border-[var(--border-default)] bg-[rgba(255,255,255,0.74)] p-5 shadow-[0_12px_28px_rgba(15,23,42,0.05)] dark:bg-[rgba(18,18,18,0.82)] dark:shadow-[0_16px_32px_rgba(0,0,0,0.22)]">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-hover)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
                <CalendarClock className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
                任务记录
              </div>
              <h1 className="mt-4 text-[30px] font-semibold tracking-[-0.06em] text-[var(--text-primary)]">全部任务</h1>
              <p className="mt-2 max-w-[760px] text-[14px] leading-7 text-[var(--text-secondary)]">
                这里保留你最近发起的真实任务记录，重点展示任务主题、最近更新、当前状态和结果类型，不打断当前工作流。
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <MetricCard label="任务总数" value={String(totalCount)} note="自动累计" />
                <MetricCard label="进行中" value={String(runningCount)} note="实时刷新" />
                <MetricCard label="已完成" value={String(completedCount)} note="可继续衔接" />
              </div>
            </div>

            <div className="rounded-[22px] border border-[var(--border-default)] bg-[rgba(255,255,255,0.58)] p-3 dark:bg-[rgba(255,255,255,0.03)]">
              <label className="flex items-center gap-3 rounded-[16px] border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-3">
                <Search className="h-4.5 w-4.5 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索任务主题或内容"
                  className="w-full bg-transparent text-[14px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                />
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                {(Object.keys(filterLabelMap) as TaskFilter[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setFilter(item)}
                    className={cn(
                      'cursor-pointer rounded-full border px-3 py-1.5 text-[12px] font-medium',
                      'transition-[transform,box-shadow,border-color,background-color,color] duration-[var(--motion-panel)]',
                      'hover:-translate-y-[1px] active:scale-[0.985]',
                      item === filter
                        ? 'border-[rgba(15,23,42,0.08)] bg-[rgba(15,23,42,0.88)] text-white shadow-[0_10px_20px_rgba(15,23,42,0.14)] dark:border-[rgba(255,255,255,0.12)] dark:bg-[rgba(255,255,255,0.10)]'
                        : 'border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
                    )}
                    style={{ transitionTimingFunction: 'var(--motion-spring)' }}
                  >
                    {filterLabelMap[item]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {tasks.length === 0 ? (
          <section className="rounded-[24px] border border-dashed border-[var(--border-default)] bg-[rgba(255,255,255,0.72)] px-6 py-10 text-center shadow-[0_10px_24px_rgba(15,23,42,0.04)] dark:bg-[rgba(18,18,18,0.72)] dark:shadow-[0_14px_28px_rgba(0,0,0,0.18)]">
            <div className="mx-auto max-w-[520px]">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-[16px] bg-[rgba(59,130,246,0.10)] text-[var(--brand-primary)]">
                <MessageSquare className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-[20px] font-semibold text-[var(--text-primary)]">还没有任务记录</h2>
              <p className="mt-2 text-[14px] leading-7 text-[var(--text-secondary)]">
                发起一次真实对话后，这里会自动生成任务记录，并持续更新状态和结果类型。
              </p>
              <div className="mt-5">
                <Button variant="primary" size="md" onClick={onOpenChat}>
                  回到智能对话
                </Button>
              </div>
            </div>
          </section>
        ) : (
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_400px]">
            <div className="space-y-3">
              {filteredTasks.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-[var(--border-default)] bg-[rgba(255,255,255,0.7)] px-5 py-8 text-[14px] text-[var(--text-secondary)] dark:bg-[rgba(18,18,18,0.76)]">
                  当前筛选下还没有匹配记录，可以换个关键词或状态看看。
                </div>
              ) : (
                filteredTasks.map((task) => {
                  const StatusIcon = statusConfig[task.status].icon;
                  const isSelected = task.id === selectedTask?.id;
                  return (
                    <PressableCard
                      key={task.id}
                      interactive
                      onClick={() => onSelectTask?.(task.id)}
                      className={cn(
                        'rounded-[24px] border bg-[rgba(255,255,255,0.72)] p-5 dark:bg-[rgba(18,18,18,0.76)]',
                        isSelected ? 'border-[var(--border-strong)] bg-[var(--bg-hover)]' : '',
                      )}
                    >
                      <div className="flex items-start gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium',
                                statusConfig[task.status].tone,
                              )}
                            >
                              <StatusIcon className="h-3.5 w-3.5" />
                              {statusConfig[task.status].label}
                            </span>
                            <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-card)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)]">
                              智能对话
                            </span>
                          </div>
                          <h2 className="mt-3 text-[20px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
                            {task.title}
                          </h2>
                          <p className="mt-2 text-[14px] leading-7 text-[var(--text-secondary)]">
                            {task.summary}
                          </p>
                          <div className="mt-4 flex flex-wrap items-center gap-3 text-[12px] text-[var(--text-muted)]">
                            <span className="inline-flex items-center gap-1">
                              <Clock3 className="h-3.5 w-3.5" />
                              最近更新 {formatRecentTaskRelativeTime(task.updatedAt)}
                            </span>
                            <span>创建于 {formatRecentTaskRelativeTime(task.createdAt)}</span>
                          </div>
                          {task.artifacts.length > 0 ? (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {task.artifacts.map((artifact) => {
                                const Icon = artifactIconMap[artifact];
                                return (
                                  <span
                                    key={artifact}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-1.5 text-[12px] text-[var(--text-secondary)]"
                                  >
                                    <Icon className="h-3.5 w-3.5" />
                                    {RECENT_TASK_ARTIFACT_LABELS[artifact]}
                                  </span>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>

                        <Button variant="secondary" size="sm" onClick={onOpenChat}>
                          继续对话
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </PressableCard>
                  );
                })
              )}
            </div>

            <aside className="xl:sticky xl:top-5 xl:self-start">
              <div className="rounded-[24px] border border-[var(--border-default)] bg-[rgba(255,255,255,0.74)] p-5 shadow-[0_12px_28px_rgba(15,23,42,0.05)] dark:bg-[rgba(18,18,18,0.82)] dark:shadow-[0_16px_32px_rgba(0,0,0,0.22)]">
                {selectedTask ? (
                  <>
                    <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">
                      当前查看
                    </div>
                    <h3 className="mt-3 text-[22px] font-semibold tracking-[-0.05em] text-[var(--text-primary)]">
                      {selectedTask.title}
                    </h3>
                    <p className="mt-2 text-[14px] leading-7 text-[var(--text-secondary)]">
                      {selectedTask.summary}
                    </p>

                    <div className="mt-5 space-y-3">
                      <InfoRow label="当前状态" value={statusConfig[selectedTask.status].label} />
                      <InfoRow label="最近更新" value={formatRecentTaskRelativeTime(selectedTask.updatedAt)} />
                      <InfoRow label="任务来源" value="智能对话" />
                      <InfoRow
                        label="结果类型"
                        value={
                          selectedTask.artifacts.length > 0
                            ? selectedTask.artifacts.map((artifact) => RECENT_TASK_ARTIFACT_LABELS[artifact]).join(' / ')
                            : '暂未识别'
                        }
                      />
                    </div>

                    <div className="mt-5 rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-3 text-[13px] leading-6 text-[var(--text-secondary)]">
                      {selectedTask.lastError || statusConfig[selectedTask.status].meta}
                    </div>

                    <div className="mt-5">
                      <Button variant="primary" size="md" block onClick={onOpenChat}>
                        返回智能对话
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-[14px] leading-7 text-[var(--text-secondary)]">
                    选择一条任务记录后，这里会展示更完整的状态和结果概览。
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

function MetricCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-[18px] border border-[var(--border-default)] bg-[rgba(255,255,255,0.58)] px-4 py-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] dark:bg-[rgba(255,255,255,0.03)] dark:shadow-[0_8px_18px_rgba(0,0,0,0.16)]">
      <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">{label}</div>
      <div className="mt-1.5 flex items-end gap-2">
        <div className="text-[22px] font-semibold tracking-[-0.05em] text-[var(--text-primary)]">{value}</div>
        <p className="pb-0.5 text-[12px] leading-5 text-[var(--text-secondary)]">{note}</p>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-[13px]">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="text-right leading-6 text-[var(--text-primary)]">{value}</span>
    </div>
  );
}
