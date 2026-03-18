import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/app/lib/cn';
import { APPLE_FLAT_SURFACE, INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE } from '@/app/lib/ui-interactions';

type LobsterActionButtonVariant = 'primary' | 'secondary' | 'accent' | 'danger';

const VARIANT_CLASS_NAMES: Record<LobsterActionButtonVariant, string> = {
  primary:
    'border border-[var(--lobster-ink-border)] bg-[var(--lobster-ink)] text-[var(--lobster-ink-foreground)] hover:border-[var(--lobster-ink-border-strong)] hover:bg-[var(--lobster-ink-strong)]',
  secondary:
    'border border-[var(--lobster-border)] bg-[var(--lobster-card-bg)] text-[var(--lobster-text-primary)] hover:border-[var(--lobster-border-strong)] hover:bg-[var(--lobster-surface-hover)]',
  accent:
    'border border-[var(--lobster-gold-border)] bg-[var(--lobster-gold-soft)] text-[var(--lobster-gold-strong)] hover:border-[var(--lobster-gold-border-strong)] hover:bg-[var(--lobster-gold-soft-strong)]',
  danger:
    'border border-[var(--lobster-danger-border)] bg-[var(--lobster-danger-soft)] text-[var(--lobster-danger-text)] hover:border-[var(--lobster-danger-border-strong)] hover:bg-[var(--lobster-danger-soft-strong)]',
};

export interface LobsterActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: LobsterActionButtonVariant;
  leadingIcon?: ReactNode;
  block?: boolean;
}

export function LobsterActionButton({
  variant = 'secondary',
  leadingIcon,
  block = false,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: LobsterActionButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[16px] px-4 py-2.5 text-[14px] font-medium',
        APPLE_FLAT_SURFACE,
        SPRING_PRESSABLE,
        INTERACTIVE_FOCUS_RING,
        block && 'w-full',
        VARIANT_CLASS_NAMES[variant],
        'shadow-[var(--lobster-shadow-button)]',
        'disabled:cursor-not-allowed disabled:transform-none disabled:opacity-60 disabled:shadow-none',
        className,
      )}
      {...props}
    >
      {leadingIcon ? <span className="shrink-0">{leadingIcon}</span> : null}
      {children}
    </button>
  );
}
