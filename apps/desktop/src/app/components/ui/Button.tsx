import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/app/lib/cn';
import { APPLE_FLAT_SURFACE, INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE } from '@/app/lib/ui-interactions';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'success' | 'danger' | 'ink' | 'accent';
type ButtonSize = 'sm' | 'md';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'border border-[var(--button-primary-border)] bg-[var(--button-primary-bg)] text-[var(--button-primary-text)] shadow-[var(--button-primary-shadow)] hover:border-[var(--button-primary-border-hover)] hover:bg-[var(--button-primary-bg-hover)] hover:text-[var(--button-primary-text)] hover:shadow-[var(--button-primary-shadow-hover)]',
  secondary:
    'border border-[var(--button-secondary-border)] bg-[var(--button-secondary-bg)] text-[var(--button-secondary-text)] shadow-[var(--button-secondary-shadow)] hover:border-[var(--button-secondary-border-hover)] hover:bg-[var(--button-secondary-bg-hover)] hover:text-[var(--button-secondary-text)]',
  ghost:
    'border border-transparent bg-transparent text-[var(--text-primary)] shadow-none hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] dark:hover:bg-[rgba(255,255,255,0.08)] dark:hover:text-[var(--text-primary)]',
  success:
    'border border-[rgba(34,197,94,0.18)] bg-[rgba(34,197,94,0.10)] text-[rgb(21,128,61)] shadow-[0_10px_22px_rgba(34,197,94,0.10),inset_0_1px_0_rgba(255,255,255,0.3)] hover:border-[rgba(34,197,94,0.28)] hover:bg-[rgba(34,197,94,0.15)] hover:shadow-[0_14px_28px_rgba(34,197,94,0.14),inset_0_1px_0_rgba(255,255,255,0.34)] dark:border-[rgba(111,221,149,0.24)] dark:bg-[rgba(34,197,94,0.18)] dark:text-[#c7f9d7] dark:shadow-[0_10px_22px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.06)] dark:hover:border-[rgba(134,239,172,0.32)] dark:hover:bg-[rgba(34,197,94,0.24)] dark:hover:shadow-[0_14px_28px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.08)]',
  danger:
    'border border-[rgba(239,68,68,0.16)] bg-[rgba(239,68,68,0.10)] text-[rgb(185,28,28)] shadow-[0_10px_22px_rgba(239,68,68,0.08),inset_0_1px_0_rgba(255,255,255,0.28)] hover:border-[rgba(239,68,68,0.28)] hover:bg-[rgba(239,68,68,0.15)] hover:shadow-[0_14px_28px_rgba(239,68,68,0.12),inset_0_1px_0_rgba(255,255,255,0.32)] dark:border-[rgba(248,113,113,0.24)] dark:bg-[rgba(239,68,68,0.18)] dark:text-[#fecaca] dark:shadow-[0_10px_22px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.06)] dark:hover:border-[rgba(252,165,165,0.32)] dark:hover:bg-[rgba(239,68,68,0.24)] dark:hover:shadow-[0_14px_28px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.08)]',
  ink:
    'border border-[var(--lobster-ink-border)] bg-[var(--lobster-ink)] text-[var(--lobster-ink-foreground)] shadow-[var(--lobster-shadow-button)] hover:border-[var(--lobster-ink-border-strong)] hover:bg-[var(--lobster-ink-strong)] hover:text-[var(--lobster-ink-foreground)] hover:shadow-[0_14px_30px_rgba(18,15,11,0.12)] dark:hover:shadow-[0_16px_34px_rgba(0,0,0,0.32)]',
  accent:
    'border border-[var(--lobster-gold-border)] bg-[var(--lobster-gold-soft)] text-[var(--lobster-gold-strong)] shadow-[var(--lobster-shadow-button)] hover:border-[var(--lobster-gold-border-strong)] hover:bg-[var(--lobster-gold-soft-strong)] hover:text-[var(--lobster-gold-strong)] hover:shadow-[0_14px_30px_rgba(168,140,93,0.14)] dark:hover:shadow-[0_16px_34px_rgba(0,0,0,0.28)]',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'rounded-[14px] px-3.5 py-2 text-[13px]',
  md: 'rounded-[16px] px-4 py-3 text-[14px]',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: ReactNode;
  block?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  leadingIcon,
  block = false,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium',
        block && 'w-full',
        !['primary', 'secondary'].includes(variant) && APPLE_FLAT_SURFACE,
        SPRING_PRESSABLE,
        INTERACTIVE_FOCUS_RING,
        'cursor-pointer',
        'disabled:cursor-not-allowed disabled:transform-none disabled:opacity-100 disabled:saturate-[0.76] disabled:shadow-none disabled:hover:translate-y-0',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    >
      {leadingIcon ? <span className="shrink-0">{leadingIcon}</span> : null}
      {children}
    </button>
  );
}
