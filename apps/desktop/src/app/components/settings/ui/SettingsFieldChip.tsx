import type { ReactNode } from 'react';
import { cn } from '@/app/lib/cn';
import { INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE } from '@/app/lib/ui-interactions';

interface SettingsFieldChipProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function SettingsFieldChip({ children, onClick, className }: SettingsFieldChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-1.5 text-[11px] text-[var(--text-secondary)] cursor-pointer hover:border-[color:color-mix(in_srgb,var(--brand-primary)_40%,var(--border-default))] hover:shadow-[0_6px_14px_rgba(0,0,0,0.05)]',
        SPRING_PRESSABLE,
        INTERACTIVE_FOCUS_RING,
        className,
      )}
    >
      {children}
    </button>
  );
}
