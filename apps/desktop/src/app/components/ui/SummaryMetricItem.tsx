import type { ComponentType } from 'react';
import { cn } from '@/app/lib/cn';

type SummaryMetricTone = 'brand' | 'success' | 'warning' | 'neutral';

const TONE_CLASSES: Record<SummaryMetricTone, string> = {
  brand: 'bg-[var(--chip-brand-bg)] text-[var(--chip-brand-text)]',
  success: 'bg-[rgba(34,197,94,0.12)] text-[rgb(22,163,74)] dark:text-[#9af0c5]',
  warning: 'bg-[rgba(245,158,11,0.16)] text-[rgb(217,119,6)] dark:text-[#ffd49a]',
  neutral: 'bg-[var(--bg-hover)] text-[var(--text-secondary)]',
};

export function SummaryMetricItem({
  label,
  value,
  note,
  icon: Icon,
  tone,
  first = false,
  className,
}: {
  label: string;
  value: string;
  note: string;
  icon: ComponentType<{ className?: string }>;
  tone: SummaryMetricTone;
  first?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-2.5 px-2.5 py-1.5',
        !first && 'border-l border-[var(--border-default)]',
        className,
      )}
    >
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--bg-page)]',
          TONE_CLASSES[tone],
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <div className="text-[18px] font-semibold leading-none tracking-[-0.04em] text-[var(--text-primary)]">{value}</div>
          <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</div>
        </div>
        <p className="mt-1 text-[11px] leading-snug text-[var(--text-secondary)]">{note}</p>
      </div>
    </div>
  );
}
