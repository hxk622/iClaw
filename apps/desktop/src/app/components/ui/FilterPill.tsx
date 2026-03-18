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
          ? 'border-[rgba(59,130,246,0.18)] bg-[rgba(59,130,246,0.10)] font-medium text-[rgb(29,78,216)] shadow-[0_10px_22px_rgba(59,130,246,0.08)] dark:border-[rgba(201,169,97,0.20)] dark:bg-[rgba(201,169,97,0.16)] dark:text-[#f1d59c] dark:shadow-[0_10px_22px_rgba(0,0,0,0.18)]'
          : 'border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] dark:bg-[rgba(255,255,255,0.03)]',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
