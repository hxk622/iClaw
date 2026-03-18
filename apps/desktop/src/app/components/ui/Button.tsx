import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/app/lib/cn';
import { APPLE_FLAT_SURFACE, INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE } from '@/app/lib/ui-interactions';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'success' | 'danger' | 'ink' | 'accent';
type ButtonSize = 'sm' | 'md';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'border border-[rgba(168,140,93,0.24)] bg-[linear-gradient(180deg,rgba(222,208,179,0.96),rgba(205,183,138,0.96))] text-[#2b2113] shadow-[0_10px_22px_rgba(168,140,93,0.12),inset_0_1px_0_rgba(255,255,255,0.38)] hover:border-[rgba(143,119,81,0.32)] hover:bg-[linear-gradient(180deg,rgba(214,196,161,0.98),rgba(191,165,118,0.98))] hover:text-[#231a0f] hover:shadow-[0_14px_28px_rgba(168,140,93,0.16),inset_0_1px_0_rgba(255,255,255,0.42)] dark:border-[rgba(180,154,112,0.28)] dark:bg-[linear-gradient(180deg,rgba(187,165,126,0.92),rgba(164,139,95,0.92))] dark:text-[#17110a] dark:shadow-[0_12px_26px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.06)] dark:hover:border-[rgba(194,170,130,0.36)] dark:hover:bg-[linear-gradient(180deg,rgba(176,154,115,0.94),rgba(152,128,87,0.94))] dark:hover:text-[#100b06] dark:hover:shadow-[0_16px_32px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.08)]',
  secondary:
    'border border-[rgba(15,23,42,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(250,248,243,0.96))] text-[var(--text-primary)] hover:border-[rgba(201,169,97,0.20)] hover:bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(252,249,241,0.98))] hover:text-[var(--text-primary)] hover:shadow-[0_12px_28px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.04))] dark:text-[var(--text-primary)] dark:hover:border-[rgba(201,169,97,0.18)] dark:hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.06))] dark:hover:shadow-[0_12px_28px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.06)]',
  ghost:
    'border border-transparent bg-transparent text-[var(--text-secondary)] shadow-none hover:bg-[rgba(201,169,97,0.08)] hover:text-[var(--text-primary)] dark:hover:bg-[rgba(201,169,97,0.10)] dark:hover:text-[var(--text-primary)]',
  success:
    'border border-[rgba(34,197,94,0.18)] bg-[rgba(34,197,94,0.10)] text-[rgb(21,128,61)] shadow-[0_10px_22px_rgba(34,197,94,0.10),inset_0_1px_0_rgba(255,255,255,0.3)] hover:border-[rgba(34,197,94,0.28)] hover:bg-[rgba(34,197,94,0.15)] hover:shadow-[0_14px_28px_rgba(34,197,94,0.14),inset_0_1px_0_rgba(255,255,255,0.34)] dark:border-[rgba(111,221,149,0.24)] dark:bg-[rgba(34,197,94,0.18)] dark:text-[#c7f9d7] dark:shadow-[0_10px_22px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.06)] dark:hover:border-[rgba(134,239,172,0.32)] dark:hover:bg-[rgba(34,197,94,0.24)] dark:hover:shadow-[0_14px_28px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.08)]',
  danger:
    'border border-[rgba(239,68,68,0.16)] bg-[rgba(239,68,68,0.10)] text-[rgb(185,28,28)] shadow-[0_10px_22px_rgba(239,68,68,0.08),inset_0_1px_0_rgba(255,255,255,0.28)] hover:border-[rgba(239,68,68,0.28)] hover:bg-[rgba(239,68,68,0.15)] hover:shadow-[0_14px_28px_rgba(239,68,68,0.12),inset_0_1px_0_rgba(255,255,255,0.32)] dark:border-[rgba(248,113,113,0.24)] dark:bg-[rgba(239,68,68,0.18)] dark:text-[#fecaca] dark:shadow-[0_10px_22px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.06)] dark:hover:border-[rgba(252,165,165,0.32)] dark:hover:bg-[rgba(239,68,68,0.24)] dark:hover:shadow-[0_14px_28px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.08)]',
  ink:
    'border border-[var(--lobster-ink-border)] bg-[var(--lobster-ink)] text-[var(--lobster-ink-foreground)] shadow-[var(--lobster-shadow-button)] hover:border-[var(--lobster-ink-border-strong)] hover:bg-[var(--lobster-ink-strong)] hover:shadow-[0_14px_30px_rgba(18,15,11,0.12)] dark:hover:shadow-[0_16px_34px_rgba(0,0,0,0.32)]',
  accent:
    'border border-[var(--lobster-gold-border)] bg-[var(--lobster-gold-soft)] text-[var(--lobster-gold-strong)] shadow-[var(--lobster-shadow-button)] hover:border-[var(--lobster-gold-border-strong)] hover:bg-[var(--lobster-gold-soft-strong)] hover:shadow-[0_14px_30px_rgba(168,140,93,0.14)] dark:hover:shadow-[0_16px_34px_rgba(0,0,0,0.28)]',
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
        APPLE_FLAT_SURFACE,
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
