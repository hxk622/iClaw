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
          <h1 className="text-[30px] font-semibold tracking-tight text-[var(--text-primary)]">{title}</h1>
          {subtitle ? <span className="text-[15px] text-[var(--text-secondary)]">{subtitle}</span> : null}
        </div>
        <p className="text-[16px] leading-8 text-[var(--text-secondary)]">{description}</p>
      </div>
      {trailing ? <div className="flex flex-wrap items-center gap-2">{trailing}</div> : null}
    </div>
  );
}
