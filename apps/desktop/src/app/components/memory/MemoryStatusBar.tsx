import { Activity, CheckCircle2, Clock3, Database, Hash, TriangleAlert, Zap } from 'lucide-react';
import type { MemoryRuntimeStatus } from '@/app/lib/tauri-memory';
import { Chip } from '@/app/components/ui/Chip';
import { SummaryMetricItem } from '@/app/components/ui/SummaryMetricItem';
import { SurfacePanel } from '@/app/components/ui/SurfacePanel';
import type { MemoryStatusSummary } from './model';

function resolveLatestSyncLabel(latestUpdatedAt: string | null) {
  return latestUpdatedAt ?? '暂无更新';
}

function resolveSmartRecallState(runtimeStatus: MemoryRuntimeStatus | null, runtimeError: string | null) {
  if (!runtimeStatus?.embeddingConfigured) {
    return { label: '智能联想未开启', tone: 'warning' as const };
  }
  if (runtimeError || runtimeStatus.vectorError || runtimeStatus.vectorAvailable === false) {
    return { label: '智能联想需要检查', tone: 'danger' as const };
  }
  if (runtimeStatus.vectorAvailable === true) {
    return { label: '智能联想可用', tone: 'success' as const };
  }
  return { label: '智能联想准备中', tone: 'outline' as const };
}

function resolveSearchState(runtimeStatus: MemoryRuntimeStatus | null, runtimeError: string | null) {
  if (runtimeError || runtimeStatus?.ftsError) {
    return { label: '查找需要检查', tone: 'warning' as const };
  }
  if ((runtimeStatus?.files ?? 0) > 0 || (runtimeStatus?.scanTotalFiles ?? 0) > 0) {
    return { label: '可查找', tone: 'success' as const };
  }
  return { label: '等待整理', tone: 'outline' as const };
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
  const organizationTone = statusSummary.indexHealth === '健康' ? 'success' : runtimeError ? 'danger' : 'accent';
  const smartRecallState = resolveSmartRecallState(runtimeStatus, runtimeError);
  const searchState = resolveSearchState(runtimeStatus, runtimeError);
  const guidance = !runtimeStatus?.embeddingConfigured
    ? '现在已经可以新增、编辑和搜索记忆。更智能的联想稍后再补，不影响日常使用。'
    : runtimeError || runtimeStatus?.vectorError
      ? '智能联想暂时没有工作起来，但已有记忆仍然可以正常查看和搜索。'
      : null;

  return (
    <SurfacePanel className="rounded-[20px] border-[var(--border-default)] bg-[var(--bg-card)]">
      <div className="grid gap-1 border-b border-[var(--border-default)] px-3 py-2 md:grid-cols-4">
        <SummaryMetricItem
          label="总量"
          value={`${statusSummary.total}`}
          note={`${statusSummary.indexedFiles} 条已整理`}
          icon={Database}
          tone="brand"
          first
          className="px-1.5 py-1"
        />
        <SummaryMetricItem
          label="自动记录"
          value={`${statusSummary.autoCaptured}`}
          note="自动沉淀"
          icon={Zap}
          tone="success"
          className="px-1.5 py-1"
        />
        <SummaryMetricItem
          label="被用到"
          value={`${statusSummary.totalRecalls}`}
          note={`${statusSummary.recalled} 条被带出过`}
          icon={Activity}
          tone="neutral"
          className="px-1.5 py-1"
        />
        <SummaryMetricItem
          label="待检查"
          value={`${statusSummary.pendingReview}`}
          note={runtimeError ? '需要检查' : '等待确认'}
          icon={runtimeError ? TriangleAlert : CheckCircle2}
          tone={runtimeError ? 'warning' : 'neutral'}
          className="px-1.5 py-1"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <Chip tone="outline" className="rounded-full px-2.5 py-1 text-[11px]">
          {runtimeStatus ? '本地记忆已连接' : '本地记忆未连接'}
        </Chip>
        <Chip tone={organizationTone} className="rounded-full px-2.5 py-1 text-[11px]">
          {runtimeError ? '整理需要检查' : `整理 ${statusSummary.indexHealth}`}
        </Chip>
        <Chip tone={searchState.tone} className="rounded-full px-2.5 py-1 text-[11px]">
          {searchState.label}
        </Chip>
        <Chip tone={smartRecallState.tone} className="rounded-full px-2.5 py-1 text-[11px]">
          {smartRecallState.label}
        </Chip>
        <Chip tone="outline" className="rounded-full px-2.5 py-1 text-[11px]">
          内容片段 {statusSummary.indexedChunks}
        </Chip>
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
          <Clock3 className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          <span>最近更新：{resolveLatestSyncLabel(latestUpdatedAt)}</span>
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
      {guidance ? (
        <div className="border-t border-[var(--border-default)] px-3 py-2 text-[12px] leading-5 text-[var(--text-secondary)]">
          {guidance}
        </div>
      ) : null}
    </SurfacePanel>
  );
}
