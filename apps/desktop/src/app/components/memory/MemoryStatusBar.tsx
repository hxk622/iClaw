import { Activity, Clock, Database, Hash, Zap } from 'lucide-react';
import type { MemoryRuntimeStatus } from '@/app/lib/tauri-memory';
import { PageContent } from '@/app/components/ui/PageLayout';
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
  const indexTone =
    statusSummary.indexHealth === '健康' ? 'text-[#5A7860]' : runtimeError ? 'text-[#9A5956]' : 'text-[#A0765C]';

  return (
    <section className="border-b border-[#ECE7DE] bg-[#FCFBF8] py-2.5">
      <PageContent className="max-w-[1480px] py-0">
        <div className="flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Database size={13} strokeWidth={1.5} className="text-[#9A9288]" />
              <span className="text-[#6B655D]">引擎:</span>
              <span className="text-[#1A1A18]">{resolveEngineLabel(runtimeStatus)}</span>
            </div>
            <div className="h-3.5 w-px bg-[#DED7CC]" />
            <div className="flex items-center gap-1.5">
              <Activity size={13} strokeWidth={1.5} className="text-[#9A9288]" />
              <span className="text-[#6B655D]">最近召回:</span>
              <span className="text-[#1A1A18]">{statusSummary.totalRecalls} 次</span>
            </div>
            <div className="h-3.5 w-px bg-[#DED7CC]" />
            <div className="flex items-center gap-1.5">
              <Zap size={13} strokeWidth={1.5} className="text-[#9A9288]" />
              <span className="text-[#6B655D]">自动捕获:</span>
              <span className="text-[#1A1A18]">{statusSummary.autoCaptured} 条</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-[#6B655D]">索引状态:</span>
              <span className={indexTone}>{runtimeError ? '异常' : statusSummary.indexHealth}</span>
            </div>
            <div className="h-3.5 w-px bg-[#DED7CC]" />
            <div className="flex items-center gap-1.5">
              <Hash size={13} strokeWidth={1.5} className="text-[#9A9288]" />
              <span className="text-[#6B655D]">高频标签:</span>
              <div className="flex gap-2">
                {topTags.slice(0, 3).map(([tag]) => (
                  <span key={tag} className="rounded bg-[#F8F4ED] px-2 py-0.5 text-[11px] text-[#6B655D]">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Clock size={13} strokeWidth={1.5} className="text-[#9A9288]" />
            <span className="text-[#6B655D]">最后同步:</span>
            <span className={runtimeError ? 'text-[#9A5956]' : 'text-[#1A1A18]'}>{resolveLatestSyncLabel(latestUpdatedAt)}</span>
          </div>
        </div>
      </PageContent>
    </section>
  );
}
