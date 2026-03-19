import { Activity, CheckCircle2, Clock3, Database, Hash, TriangleAlert, Zap } from 'lucide-react';
import type { MemoryRuntimeStatus } from '@/app/lib/tauri-memory';
import { Chip } from '@/app/components/ui/Chip';
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
  const indexTone = statusSummary.indexHealth === '健康' ? 'success' : runtimeError ? 'danger' : 'accent';

  return (
    <SurfacePanel className="rounded-[20px] border-[var(--border-default)] bg-[var(--bg-card)]">
      <div className="grid gap-1 border-b border-[var(--border-default)] px-3 py-2 md:grid-cols-4">
        <SummaryMetricItem
          label="总量"
          value={`${statusSummary.total}`}
          note={`${statusSummary.indexedFiles} 文件已索引`}
          icon={Database}
          tone="brand"
          first
          className="px-1.5 py-1"
        />
        <SummaryMetricItem
          label="自动捕获"
          value={`${statusSummary.autoCaptured}`}
          note="自动沉淀"
          icon={Zap}
          tone="success"
          className="px-1.5 py-1"
        />
        <SummaryMetricItem
          label="累计召回"
          value={`${statusSummary.totalRecalls}`}
          note={`${statusSummary.recalled} 条已用过`}
          icon={Activity}
          tone="neutral"
          className="px-1.5 py-1"
        />
        <SummaryMetricItem
          label="待检查"
          value={`${statusSummary.pendingReview}`}
          note={runtimeError ? '索引异常' : '等待确认'}
          icon={runtimeError ? TriangleAlert : CheckCircle2}
          tone={runtimeError ? 'warning' : 'neutral'}
          className="px-1.5 py-1"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <Chip tone="outline" className="rounded-full px-2.5 py-1 text-[11px]">
          引擎 · {resolveEngineLabel(runtimeStatus)}
        </Chip>
        <Chip tone={indexTone} className="rounded-full px-2.5 py-1 text-[11px]">
          {runtimeError ? '索引异常' : `索引 ${statusSummary.indexHealth}`}
        </Chip>
        <Chip tone="outline" className="rounded-full px-2.5 py-1 text-[11px]">
          分块 {statusSummary.indexedChunks}
        </Chip>
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
          <Clock3 className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          <span>{resolveLatestSyncLabel(latestUpdatedAt)}</span>
        </div>

        <div className="ml-auto flex min-w-0 items-center gap-2">
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
            <Hash className="h-3.5 w-3.5" />
            高频标签
          </div>
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {topTags.length > 0 ? (
              topTags.slice(0, 4).map(([tag, count]) => (
                <Chip key={tag} tone="accent" className="rounded-full px-2.5 py-1 text-[11px]">
                  {tag} · {count}
                </Chip>
              ))
            ) : (
              <span className="text-[11px] text-[var(--text-muted)]">暂无标签</span>
            )}
          </div>
        </div>
      </div>
    </SurfacePanel>
  );
}
