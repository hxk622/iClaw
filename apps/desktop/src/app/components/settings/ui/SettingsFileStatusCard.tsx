import { Clock, FileText } from 'lucide-react';
import { SettingsBadge } from './SettingsBadge';
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
    <SettingsCard className="rounded-xl p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <FileText className="h-4 w-4 flex-shrink-0 text-[var(--text-muted)]" />
          <div className="min-w-0">
            <div className="mb-0.5 text-[12px] font-medium text-[var(--text-primary)]">{fileName}</div>
            <div className="truncate text-[11px] text-[var(--text-muted)]">{workspacePath}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          <span className="text-[11px] text-[var(--text-muted)]">{syncLabel}</span>
          <SettingsBadge tone="green" className="ml-2">
            本地文件
          </SettingsBadge>
        </div>
      </div>
    </SettingsCard>
  );
}
