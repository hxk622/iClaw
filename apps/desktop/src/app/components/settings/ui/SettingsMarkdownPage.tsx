import type { ReactNode } from 'react';
import { FileText } from 'lucide-react';
import { SettingsBadge } from './SettingsBadge';
import { SettingsCard } from './SettingsCard';
import { SettingsPageHeader } from './SettingsPageHeader';

interface SettingsMarkdownPageProps {
  title: string;
  fileName: string;
  description: string;
  workspacePath: string;
  value: string;
  placeholder: string;
  help: string;
  badges?: Array<{ label: string; tone: 'gold' | 'green' | 'red' | 'blue' }>;
  rows?: number;
  onChange: (value: string) => void;
  disabled?: boolean;
  headerExtra?: ReactNode;
}

export function SettingsMarkdownPage({
  title,
  fileName,
  description,
  workspacePath,
  value,
  placeholder,
  help,
  badges = [],
  rows = 22,
  onChange,
  disabled = false,
  headerExtra,
}: SettingsMarkdownPageProps) {
  return (
    <div className="max-w-4xl space-y-6">
      <SettingsPageHeader
        title={title}
        subtitle={fileName}
        description={description}
        trailing={
          <>
            {badges.map((badge) => (
              <SettingsBadge key={badge.label} tone={badge.tone}>
                {badge.label}
              </SettingsBadge>
            ))}
            {headerExtra}
          </>
        }
      />

      <SettingsCard>
        <div className="mb-4 flex items-center gap-3 border-b border-[var(--border-default)] pb-4">
          <FileText className="h-5 w-5 flex-shrink-0 text-[var(--text-secondary)]" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-[var(--text-primary)]">当前工作区路径</div>
            <div className="mt-0.5 break-all font-mono text-sm text-[var(--text-secondary)]">{workspacePath}</div>
          </div>
        </div>

        <textarea
          value={value}
          disabled={disabled}
          rows={rows}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          className="h-[480px] w-full resize-none rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-hover)] p-4 font-mono text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--border-strong)] focus:ring-2 focus:ring-[var(--brand-primary)]/18 disabled:cursor-not-allowed"
        />

        <div className="mt-4 border-t border-[var(--border-default)] pt-4">
          <p className="text-xs text-[var(--text-secondary)]">
            <span className="text-[var(--brand-primary)]">提示：</span>
            {help}
          </p>
        </div>
      </SettingsCard>
    </div>
  );
}
