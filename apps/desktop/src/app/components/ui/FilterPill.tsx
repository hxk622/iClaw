import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/app/lib/cn';
import { APPLE_FLAT_SURFACE, INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE } from '@/app/lib/ui-interactions';

export function FilterPill({
  active = false,
  children,
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type={type}
      className={cn(
        'cursor-pointer rounded-md border px-3.5 py-1.5 text-[13px] transition-all',
        APPLE_FLAT_SURFACE,
        SPRING_PRESSABLE,
        INTERACTIVE_FOCUS_RING,
        active
          ? 'border-[var(--chip-brand-border-strong)] bg-[var(--chip-brand-bg)] font-medium text-[var(--chip-brand-text)] shadow-[var(--button-secondary-shadow)]'
          : 'border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] dark:bg-[rgba(255,255,255,0.03)]',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
