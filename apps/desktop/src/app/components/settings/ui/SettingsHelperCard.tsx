import type { ComponentType } from 'react';
import { cn } from '@/app/lib/cn';
import { INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE } from '@/app/lib/ui-interactions';

interface SettingsHelperCardProps {
  title: string;
  description: string;
  icon?: ComponentType<{ className?: string }>;
  onClick?: () => void;
}

export function SettingsHelperCard({
  title,
  description,
  icon: Icon,
  onClick,
}: SettingsHelperCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] p-3 text-left cursor-pointer hover:border-[color:color-mix(in_srgb,var(--brand-primary)_30%,var(--border-default))] hover:shadow-[0_8px_18px_rgba(0,0,0,0.06)]',
        SPRING_PRESSABLE,
        INTERACTIVE_FOCUS_RING,
      )}
    >
      <div className={cn('flex items-start gap-2', !Icon && 'block')}>
        {Icon ? <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--text-muted)]" /> : null}
        <div>
          <div className="mb-0.5 text-[12px] font-medium text-[var(--text-primary)]">{title}</div>
          <div className="text-[10px] text-[var(--text-muted)]">{description}</div>
        </div>
      </div>
    </button>
  );
}
