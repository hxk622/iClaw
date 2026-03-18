import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/app/lib/cn';
import { APPLE_FLAT_SURFACE, INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE } from '@/app/lib/ui-interactions';

type LobsterActionButtonVariant = 'primary' | 'secondary' | 'accent' | 'danger';

const VARIANT_CLASS_NAMES: Record<LobsterActionButtonVariant, string> = {
  primary:
    'border border-[var(--lobster-gold-border)] bg-[linear-gradient(180deg,rgba(234,225,208,0.98),rgba(224,212,191,0.96))] text-[var(--lobster-gold-strong)] hover:border-[var(--lobster-gold-border-strong)] hover:bg-[linear-gradient(180deg,rgba(224,212,191,1),rgba(216,201,176,0.98))] hover:text-[var(--lobster-gold-strong)] dark:border-[rgba(201,169,97,0.22)] dark:bg-[var(--brand-primary)] dark:text-[#17110a] dark:hover:border-[rgba(201,169,97,0.30)] dark:hover:bg-[var(--brand-primary-hover)] dark:hover:text-[#120d08]',
  secondary:
    'border border-[var(--lobster-border)] bg-[var(--lobster-card-bg)] text-[var(--lobster-text-primary)] hover:border-[var(--lobster-border-strong)] hover:bg-[var(--lobster-surface-hover)] hover:text-[var(--lobster-text-primary)]',
  accent:
    'border border-[var(--lobster-gold-border)] bg-[var(--lobster-gold-soft)] text-[var(--lobster-gold-strong)] hover:border-[var(--lobster-gold-border-strong)] hover:bg-[var(--lobster-gold-soft-strong)] hover:text-[var(--lobster-gold-strong)]',
  danger:
    'border border-[var(--lobster-danger-border)] bg-[var(--lobster-danger-soft)] text-[var(--lobster-danger-text)] hover:border-[var(--lobster-danger-border-strong)] hover:bg-[var(--lobster-danger-soft-strong)] hover:text-[var(--lobster-danger-text)]',
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
        'cursor-pointer',
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
