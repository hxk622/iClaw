import type { ReactNode } from 'react';
import { Activity, AlertTriangle, Database, FolderTree, Hash, ShieldCheck, Sparkles } from 'lucide-react';

import { Chip } from '@/app/components/ui/Chip';
import type { MemoryRuntimeStatus } from '@/app/lib/tauri-memory';
import type { MemoryStatusSummary } from './model';

function resolveEngineLabel(runtimeStatus: MemoryRuntimeStatus | null) {
  if (!runtimeStatus?.backend) return '未连接';
  return runtimeStatus.backend === 'builtin' ? 'Builtin' : 'LanceDB';
}

export function MemoryStatusBar({
  runtimeStatus,
  runtimeError,
  statusSummary,
  topTags,
}: {
  runtimeStatus: MemoryRuntimeStatus | null;
  runtimeError: string | null;
  statusSummary: MemoryStatusSummary;
  topTags: Array<[string, number]>;
}) {
  return (
    <section className="border-b border-[var(--lobster-border)] bg-[var(--lobster-card-bg)] px-8 py-3.5">
      <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-x-5 gap-y-3 text-[12px]">
        <StatusItem
          icon={<Database className="h-3.5 w-3.5 text-[var(--lobster-text-muted)]" />}
          label="记忆引擎"
          value={resolveEngineLabel(runtimeStatus)}
        />
        <Divider />
        <StatusItem
          icon={<Activity className="h-3.5 w-3.5 text-[var(--lobster-text-muted)]" />}
          label="最近召回"
          value={`${statusSummary.totalRecalls} 次`}
        />
        <Divider />
        <StatusItem
          icon={<Sparkles className="h-3.5 w-3.5 text-[var(--lobster-text-muted)]" />}
          label="自动捕获"
          value={`${statusSummary.autoCaptured} 条`}
        />
        <Divider />
        <StatusItem
          icon={<FolderTree className="h-3.5 w-3.5 text-[var(--lobster-text-muted)]" />}
          label="已索引"
          value={`${statusSummary.indexedFiles} 文件 / ${statusSummary.indexedChunks} 块`}
        />
        <Divider />
        <StatusItem
          icon={<ShieldCheck className="h-3.5 w-3.5 text-[var(--lobster-text-muted)]" />}
          label="索引状态"
          value={statusSummary.indexHealth}
          valueClassName={
            statusSummary.indexHealth === '健康' ? 'text-[var(--lobster-success-text)]' : 'text-[#a0765c]'
          }
        />

        <div className="ml-auto flex items-center gap-2">
          <Hash className="h-3.5 w-3.5 text-[var(--lobster-text-muted)]" />
          <span className="text-[var(--lobster-text-secondary)]">高频标签</span>
          <div className="flex items-center gap-1.5">
            {topTags.slice(0, 3).map(([tag]) => (
              <Chip key={tag} tone="accent" className="rounded-full px-2.5 py-1 text-[11px] font-medium">
                {tag}
              </Chip>
            ))}
          </div>
        </div>

        {runtimeError ? (
          <div className="flex w-full items-center gap-2 rounded-[14px] border border-[#eadfd4] bg-[#f5efe8] px-3 py-2 text-[#a0765c]">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">runtime: {runtimeError}</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function StatusItem({
  icon,
  label,
  value,
  valueClassName,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-[var(--lobster-text-secondary)]">{label}</span>
      <span className={valueClassName ?? 'text-[var(--lobster-text-primary)]'}>{value}</span>
    </div>
  );
}

function Divider() {
  return <div className="h-3.5 w-px bg-[var(--lobster-border)]" />;
}
