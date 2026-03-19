import type { ReactNode } from 'react';
import { cn } from '@/app/lib/cn';
import { APPLE_FLAT_SURFACE } from '@/app/lib/ui-interactions';
import { PressableCard } from './PressableCard';

type StatCardTone = 'default' | 'success' | 'warning' | 'brand';

const TONE_CLASSES: Record<StatCardTone, { border: string; iconWrap: string; icon: string }> = {
  default: {
    border: 'border-[var(--border-default)]',
    iconWrap: 'bg-[var(--bg-hover)] border-[var(--border-default)] dark:bg-[rgba(255,255,255,0.05)]',
    icon: 'text-[var(--text-primary)]',
  },
  success: {
    border: 'border-[rgba(34,197,94,0.16)]',
    iconWrap: 'bg-[rgba(34,197,94,0.10)] border-[rgba(34,197,94,0.12)] dark:bg-[rgba(34,197,94,0.18)]',
    icon: 'text-[rgb(21,128,61)] dark:text-[#c7f9d7]',
  },
  warning: {
    border: 'border-[rgba(245,158,11,0.18)]',
    iconWrap: 'bg-[rgba(245,158,11,0.10)] border-[rgba(245,158,11,0.12)] dark:bg-[rgba(245,158,11,0.18)]',
    icon: 'text-[rgb(180,100,24)] dark:text-[#f8d48f]',
  },
  brand: {
    border: 'border-[rgba(201,169,97,0.18)]',
    iconWrap: 'bg-[rgba(201,169,97,0.10)] border-[rgba(201,169,97,0.14)] dark:bg-[rgba(201,169,97,0.16)]',
    icon: 'text-[rgb(155,112,39)] dark:text-[#f1d59c]',
  },
};

export function StatCard({
  icon,
  label,
  value,
  description,
  tone = 'default',
  className,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  description?: ReactNode;
  tone?: StatCardTone;
  className?: string;
  onClick?: () => void;
}) {
  const toneClasses = TONE_CLASSES[tone];

  return (
    <PressableCard
      interactive={Boolean(onClick)}
      onClick={onClick}
      className={cn(
        'rounded-[10px] px-3.5 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]',
        toneClasses.border,
        'dark:border-[rgba(255,255,255,0.08)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.24)]',
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border',
            toneClasses.iconWrap,
          )}
        >
          <span className={toneClasses.icon}>{icon}</span>
        </div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">{label}</div>
          <div className="mt-0.5 text-[18px] font-semibold leading-tight text-[var(--text-primary)]">{value}</div>
          {description ? (
            <div className="mt-0.5 text-[10px] leading-4 text-[var(--text-muted)]">{description}</div>
          ) : null}
        </div>
      </div>
    </PressableCard>
  );
}
