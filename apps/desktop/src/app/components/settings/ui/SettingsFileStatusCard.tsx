import { Clock, FileText } from 'lucide-react';
import { SettingsCard } from './SettingsCard';

interface SettingsFileStatusCardProps {
  fileName: string;
  workspacePath: string;
  syncLabel: string;
}

export function SettingsFileStatusCard({
  fileName,
  workspacePath,
  syncLabel,
}: SettingsFileStatusCardProps) {
  return (
    <SettingsCard className="rounded-xl p-4 shadow-none">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <FileText className="h-4 w-4 flex-shrink-0 text-[var(--text-muted)]" />
          <div className="min-w-0">
            <div className="mb-0.5 text-[13px] font-medium text-[var(--text-primary)]">{fileName}</div>
            <div className="text-[12px] text-[var(--text-secondary)]">{workspacePath}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          <span className="text-[12px] text-[var(--text-secondary)]">{syncLabel}</span>
          <span className="ml-2 rounded-md bg-[rgba(34,197,94,0.12)] px-2 py-1 text-[11px] font-medium text-[rgb(21,128,61)] dark:bg-[rgba(34,197,94,0.18)] dark:text-[#86efac]">
            本地文件
          </span>
        </div>
      </div>
    </SettingsCard>
  );
}
