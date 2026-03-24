import type { ReactNode } from 'react';
import { cn } from '@/app/lib/cn';

type InfoTileTone = 'neutral' | 'success' | 'warning';

const TONE_CLASS: Record<InfoTileTone, string> = {
  neutral:
    'border-[var(--border-default)] bg-[var(--bg-elevated)]',
  success:
    'border-[rgba(34,197,94,0.16)] bg-[rgba(34,197,94,0.08)] dark:bg-[rgba(34,197,94,0.12)]',
  warning:
    'border-[rgba(245,158,11,0.16)] bg-[rgba(245,158,11,0.08)] dark:bg-[rgba(245,158,11,0.12)]',
};

export function InfoTile({
  label,
  value,
  description,
  tone = 'neutral',
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  description?: ReactNode;
  tone?: InfoTileTone;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'min-w-0 overflow-hidden rounded-[18px] border px-4 py-3',
        TONE_CLASS[tone],
        className,
      )}
    >
      <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</div>
      <div className="mt-2 min-w-0 break-words text-[14px] font-medium text-[var(--text-primary)] [overflow-wrap:anywhere]">
        {value}
      </div>
      {description ? (
        <p className="mt-1.5 break-words text-[13px] leading-6 text-[var(--text-secondary)] [overflow-wrap:anywhere]">{description}</p>
      ) : null}
    </div>
  );
}
