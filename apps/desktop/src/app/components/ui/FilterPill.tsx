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
        'cursor-pointer rounded-md border px-3.5 py-2 text-[14px] transition-all duration-150',
        APPLE_FLAT_SURFACE,
        SPRING_PRESSABLE,
        INTERACTIVE_FOCUS_RING,
        active
          ? 'border-[var(--chip-brand-active-border)] bg-[linear-gradient(180deg,var(--chip-brand-bg-hover),var(--chip-brand-bg))] font-semibold text-[var(--chip-brand-text)] shadow-[0_0_0_1px_var(--chip-brand-active-border),0_12px_28px_rgba(168,140,93,0.16)] dark:shadow-[0_0_0_1px_var(--chip-brand-active-border),0_14px_30px_rgba(0,0,0,0.26)]'
          : 'border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] dark:bg-[rgba(255,255,255,0.03)]',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
