import { Activity, CheckCircle2, Clock3, Database, Hash, Sparkles, TriangleAlert, Zap } from 'lucide-react';
import type { MemoryRuntimeStatus } from '@/app/lib/tauri-memory';
import { Chip } from '@/app/components/ui/Chip';
import { StatCard } from '@/app/components/ui/StatCard';
import { SummaryMetricItem } from '@/app/components/ui/SummaryMetricItem';
import { SurfacePanel } from '@/app/components/ui/SurfacePanel';
import type { MemoryStatusSummary } from './model';

function resolveEngineLabel(runtimeStatus: MemoryRuntimeStatus | null) {
  if (!runtimeStatus?.backend) return '未连接';
  return runtimeStatus.backend === 'builtin' ? 'Builtin' : 'LanceDB';
}

function resolveLatestSyncLabel(latestUpdatedAt: string | null) {
  return latestUpdatedAt ?? '暂无同步';
}

export function MemoryStatusBar({
  runtimeStatus,
  runtimeError,
  statusSummary,
  topTags,
  latestUpdatedAt,
}: {
  runtimeStatus: MemoryRuntimeStatus | null;
  runtimeError: string | null;
  statusSummary: MemoryStatusSummary;
  topTags: Array<[string, number]>;
  latestUpdatedAt: string | null;
}) {
  const indexTone = statusSummary.indexHealth === '健康' ? 'success' : runtimeError ? 'danger' : 'warning';

  return (
    <SurfacePanel className="overflow-hidden rounded-[24px] border-[var(--border-default)] bg-[var(--bg-card)]">
      <div className="grid gap-3 border-b border-[var(--border-default)] p-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Database className="h-4 w-4" />}
          label="记忆总量"
          value={statusSummary.total}
          description={`${statusSummary.indexedFiles} 个文件已被索引`}
          tone="brand"
        />
        <StatCard
          icon={<Zap className="h-4 w-4" />}
          label="自动捕获"
          value={statusSummary.autoCaptured}
          description="系统自动沉淀的长期记忆"
          tone="success"
        />
        <StatCard
          icon={<Activity className="h-4 w-4" />}
          label="累计召回"
          value={statusSummary.totalRecalls}
          description={`${statusSummary.recalled} 条记忆至少被使用过一次`}
          tone="default"
        />
        <StatCard
          icon={<Sparkles className="h-4 w-4" />}
          label="待检查"
          value={statusSummary.pendingReview}
          description={runtimeError ? '当前存在索引异常，请优先处理' : '等待人工确认或整理'}
          tone={runtimeError ? 'warning' : 'default'}
        />
      </div>

      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2 rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-hover)] px-3 py-2.5">
          <Chip tone="outline" className="rounded-full px-3 py-1 text-[12px]">
            引擎 · {resolveEngineLabel(runtimeStatus)}
          </Chip>
          <Chip tone={indexTone} className="rounded-full px-3 py-1 text-[12px]">
            {runtimeError ? '索引异常' : `索引 ${statusSummary.indexHealth}`}
          </Chip>
          <Chip tone="outline" className="rounded-full px-3 py-1 text-[12px]">
            分块 {statusSummary.indexedChunks}
          </Chip>
          <Chip tone="outline" className="rounded-full px-3 py-1 text-[12px]">
            最后同步 {resolveLatestSyncLabel(latestUpdatedAt)}
          </Chip>
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="flex flex-wrap rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2 py-1.5">
            <SummaryMetricItem
              label="召回覆盖"
              value={`${statusSummary.recalled}`}
              note="被调用过的记忆条目"
              icon={Activity}
              tone="brand"
              first
              className="flex-1"
            />
            <SummaryMetricItem
              label="索引文件"
              value={`${statusSummary.indexedFiles}`}
              note="当前参与向量索引的文件数"
              icon={Database}
              tone="neutral"
              className="flex-1"
            />
            <SummaryMetricItem
              label="状态"
              value={runtimeError ? '异常' : statusSummary.indexHealth}
              note={runtimeError ?? '索引与本地文件状态正常'}
              icon={runtimeError ? TriangleAlert : CheckCircle2}
              tone={runtimeError ? 'warning' : 'success'}
              className="flex-1"
            />
          </div>

          <div className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-3">
            <div className="flex items-center gap-2 text-[12px] font-medium text-[var(--text-primary)]">
              <Hash className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              高频标签
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {topTags.length > 0 ? (
                topTags.slice(0, 6).map(([tag, count]) => (
                  <Chip key={tag} tone="accent" className="rounded-full px-3 py-1 text-[12px]">
                    {tag} · {count}
                  </Chip>
                ))
              ) : (
                <span className="text-[12px] text-[var(--text-muted)]">暂无高频标签</span>
              )}
            </div>
            <div className="mt-3 flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
              <Clock3 className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              最近同步时间：{resolveLatestSyncLabel(latestUpdatedAt)}
            </div>
          </div>
        </div>
      </div>
    </SurfacePanel>
  );
}
