import type { ReactNode } from 'react';

interface SettingsPageHeaderProps {
  title: string;
  subtitle?: string;
  description: string;
  trailing?: ReactNode;
}

export function SettingsPageHeader({
  title,
  subtitle,
  description,
  trailing,
}: SettingsPageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="mb-2 flex items-center gap-3">
          <h1 className="text-[28px] font-medium tracking-tight text-[var(--text-primary)]">{title}</h1>
          {subtitle ? <span className="text-sm text-[var(--text-muted)]">{subtitle}</span> : null}
        </div>
        <p className="text-[15px] leading-7 text-[var(--text-secondary)]">{description}</p>
      </div>
      {trailing ? <div className="flex flex-wrap items-center gap-2">{trailing}</div> : null}
    </div>
  );
}
