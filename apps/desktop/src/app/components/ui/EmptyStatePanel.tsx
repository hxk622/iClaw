import type { ReactNode } from 'react';
import { cn } from '@/app/lib/cn';
import { PressableCard } from './PressableCard';

export function EmptyStatePanel({
  icon,
  title,
  description,
  action,
  compact = false,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  if (compact) {
    return (
      <div
        className={cn(
          'rounded-[18px] border border-dashed border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-5',
          className,
        )}
      >
        <div className="text-[13px] font-medium text-[var(--text-primary)]">{title}</div>
        <p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">{description}</p>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    );
  }

  return (
    <PressableCard
      className={cn(
        'border-dashed border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(247,247,244,0.88))] px-6 py-6 dark:bg-[linear-gradient(180deg,rgba(28,28,28,0.92),rgba(18,18,18,0.92))]',
        className,
      )}
    >
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="max-w-[640px]">
          {icon ? (
            <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[var(--chip-brand-bg)] text-[var(--chip-brand-text)]">
              {icon}
            </div>
          ) : null}
          <div className={cn('text-[22px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]', icon ? 'mt-3' : '')}>{title}</div>
          <p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">{description}</p>
        </div>
        {action ? <div className="flex items-center gap-3">{action}</div> : null}
      </div>
    </PressableCard>
  );
}
