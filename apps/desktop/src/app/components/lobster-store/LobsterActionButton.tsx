import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/app/lib/cn';
import { APPLE_FLAT_SURFACE, INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE } from '@/app/lib/ui-interactions';

type LobsterActionButtonVariant = 'primary' | 'secondary' | 'accent' | 'danger';

const VARIANT_CLASS_NAMES: Record<LobsterActionButtonVariant, string> = {
  primary:
    'border border-[var(--lobster-gold-border)] bg-[linear-gradient(180deg,rgba(234,225,208,0.98),rgba(224,212,191,0.96))] text-[var(--lobster-gold-strong)] hover:border-[var(--lobster-gold-border-strong)] hover:bg-[linear-gradient(180deg,rgba(224,212,191,1),rgba(216,201,176,0.98))] hover:text-[var(--lobster-gold-strong)] dark:border-[rgba(196,166,122,0.38)] dark:bg-[linear-gradient(180deg,#b99b70_0%,#a7865c_100%)] dark:!text-[#120e09] dark:shadow-[0_10px_18px_rgba(0,0,0,0.22)] dark:hover:border-[rgba(215,187,143,0.5)] dark:hover:bg-[linear-gradient(180deg,#c6a87a_0%,#b28f63_100%)] dark:hover:!text-[#0f0b07]',
  secondary:
    'border border-[var(--lobster-border)] bg-[var(--lobster-card-bg)] text-[var(--lobster-text-primary)] hover:border-[var(--lobster-border-strong)] hover:bg-[var(--lobster-surface-hover)] hover:text-[var(--lobster-text-primary)] dark:border-[rgba(194,170,130,0.16)] dark:bg-[rgba(255,255,255,0.025)] dark:text-[var(--lobster-text-primary)] dark:hover:border-[rgba(194,170,130,0.28)] dark:hover:bg-[rgba(255,255,255,0.05)] dark:hover:text-[var(--lobster-text-primary)]',
  accent:
    'border border-[var(--lobster-gold-border)] bg-[var(--lobster-gold-soft)] text-[var(--lobster-gold-strong)] hover:border-[var(--lobster-gold-border-strong)] hover:bg-[var(--lobster-gold-soft-strong)] hover:text-[var(--lobster-gold-strong)] dark:border-[rgba(194,170,130,0.22)] dark:bg-[rgba(180,154,112,0.16)] dark:text-[#dcc49c] dark:hover:border-[rgba(214,190,151,0.34)] dark:hover:bg-[rgba(180,154,112,0.24)] dark:hover:text-[#ead7b6]',
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
