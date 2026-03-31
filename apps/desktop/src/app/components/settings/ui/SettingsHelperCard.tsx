import type { ComponentType } from 'react';
import { cn } from '@/app/lib/cn';
import { INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE } from '@/app/lib/ui-interactions';

interface SettingsHelperCardProps {
  title: string;
  description: string;
  icon?: ComponentType<{ className?: string }>;
  onClick?: () => void;
  tone?: 'neutral' | 'accent';
}

export function SettingsHelperCard({
  title,
  description,
  icon: Icon,
  onClick,
  tone = 'neutral',
}: SettingsHelperCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg border bg-[var(--bg-card)] p-3 text-left cursor-pointer',
        tone === 'accent'
          ? 'border-[var(--border-default)] hover:border-[color:color-mix(in_srgb,var(--brand-primary)_36%,var(--border-default))] hover:shadow-[0_8px_18px_rgba(0,0,0,0.06)]'
          : 'border-[var(--border-default)] hover:border-[var(--border-strong)] hover:shadow-[0_8px_18px_rgba(0,0,0,0.05)]',
        SPRING_PRESSABLE,
        INTERACTIVE_FOCUS_RING,
      )}
    >
      <div className={cn('flex items-start gap-2', !Icon && 'block')}>
        {Icon ? <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--text-muted)]" /> : null}
        <div>
          <div className="mb-1 text-[13px] font-medium text-[var(--text-primary)]">{title}</div>
          <div className="text-[12px] leading-5 text-[var(--text-secondary)]">{description}</div>
        </div>
      </div>
    </button>
  );
}
