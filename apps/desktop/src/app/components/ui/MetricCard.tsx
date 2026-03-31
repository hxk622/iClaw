import type { ReactNode } from 'react';
import { cn } from '@/app/lib/cn';

export function MetricCard({
  label,
  value,
  icon,
  iconWrapClassName,
  iconClassName,
  className,
}: {
  label: string;
  value: number | string;
  icon: ReactNode;
  iconWrapClassName?: string;
  iconClassName?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-3.5',
        'dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.03)]',
        className,
      )}
      style={{ boxShadow: 'var(--shadow-sm)' }}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
            iconWrapClassName,
          )}
        >
          <span className={iconClassName}>{icon}</span>
        </div>
        <div className="min-w-0">
          <div className="mb-0.5 text-[12px] font-medium text-[var(--text-secondary)]">{label}</div>
          <div className="text-[20px] font-medium leading-none text-[var(--text-primary)]">{value}</div>
        </div>
      </div>
    </div>
  );
}
