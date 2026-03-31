import { Activity, CheckCircle2, Clock3, Database, Hash, TriangleAlert, Zap } from 'lucide-react';
import type { MemoryRuntimeStatus } from '@/app/lib/tauri-memory';
import { Chip } from '@/app/components/ui/Chip';
import { SummaryMetricItem } from '@/app/components/ui/SummaryMetricItem';
import { SurfacePanel } from '@/app/components/ui/SurfacePanel';
import type { MemoryStatusSummary } from './model';

function resolveEngineLabel(runtimeStatus: MemoryRuntimeStatus | null) {
  if (!runtimeStatus?.backend) return '未连接';
  if (runtimeStatus.backend === 'builtin') return 'Builtin';
  return runtimeStatus.backend;
}

function resolveLatestSyncLabel(latestUpdatedAt: string | null) {
  return latestUpdatedAt ?? '暂无同步';
}

function resolveVectorState(runtimeStatus: MemoryRuntimeStatus | null, runtimeError: string | null) {
  if (!runtimeStatus?.embeddingConfigured) {
    return {label: '向量未配置', tone: 'warning' as const};
  }
  if (runtimeError || runtimeStatus.vectorError || runtimeStatus.vectorAvailable === false) {
    return {label: '向量异常', tone: 'danger' as const};
  }
  if (runtimeStatus.vectorAvailable === true) {
    return {label: '向量可用', tone: 'success' as const};
  }
  return {label: '向量待检查', tone: 'outline' as const};
}

function resolveFtsState(runtimeStatus: MemoryRuntimeStatus | null) {
  if (runtimeStatus?.ftsAvailable === true) return {label: 'FTS 可用', tone: 'success' as const};
  if (runtimeStatus?.ftsAvailable === false || runtimeStatus?.ftsError) return {label: 'FTS 异常', tone: 'warning' as const};
  return {label: 'FTS 未知', tone: 'outline' as const};
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
  const vectorState = resolveVectorState(runtimeStatus, runtimeError);
  const ftsState = resolveFtsState(runtimeStatus);
  const configuredLabel =
    runtimeStatus?.embeddingConfigured
      ? `${runtimeStatus.configuredProvider || runtimeStatus.provider || 'unknown'} / ${runtimeStatus.configuredModel || runtimeStatus.model || 'unknown'}`
      : '未配置向量提供方';
  const guidance = !runtimeStatus?.embeddingConfigured
    ? '当前采用内置记忆后端。手动记忆、导入导出和基础索引可继续使用；如果需要语义召回，再补充向量提供方配置。'
    : runtimeError || runtimeStatus?.vectorError
      ? `向量提供方已配置，但当前不可用。${runtimeStatus?.vectorError || runtimeError || '请检查 API Key、Base URL 和模型配置。'}`
      : null;

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
        <Chip tone={vectorState.tone} className="rounded-full px-2.5 py-1 text-[11px]">
          {vectorState.label}
        </Chip>
        <Chip tone={ftsState.tone} className="rounded-full px-2.5 py-1 text-[11px]">
          {ftsState.label}
        </Chip>
        <Chip tone="outline" className="rounded-full px-2.5 py-1 text-[11px]">
          分块 {statusSummary.indexedChunks}
        </Chip>
        <Chip tone="outline" className="rounded-full px-2.5 py-1 text-[11px]">
          配置 · {configuredLabel}
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
      {guidance ? (
        <div className="border-t border-[var(--border-default)] px-3 py-2 text-[12px] leading-5 text-[var(--text-secondary)]">
          {guidance}
        </div>
      ) : null}
    </SurfacePanel>
  );
}
