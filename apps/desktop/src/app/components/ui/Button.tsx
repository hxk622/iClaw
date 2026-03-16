import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/app/lib/cn';
import { APPLE_FLAT_SURFACE, INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE } from '@/app/lib/ui-interactions';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'success' | 'danger';
type ButtonSize = 'sm' | 'md';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'border border-[rgba(59,130,246,0.22)] bg-[var(--brand-primary)] text-[var(--brand-on-primary)] shadow-[0_10px_24px_rgba(59,130,246,0.16),inset_0_1px_0_rgba(255,255,255,0.22)] hover:border-[rgba(37,99,235,0.28)] hover:bg-[var(--brand-primary-hover)] hover:shadow-[0_14px_30px_rgba(59,130,246,0.20),inset_0_1px_0_rgba(255,255,255,0.24)] dark:border-[rgba(201,169,97,0.24)] dark:bg-[var(--brand-primary)] dark:text-[#17120b] dark:shadow-[0_10px_24px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.08)] dark:hover:border-[rgba(201,169,97,0.30)] dark:hover:bg-[var(--brand-primary-hover)] dark:hover:shadow-[0_14px_30px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.10)]',
  secondary:
    'border border-[rgba(15,23,42,0.08)] bg-[rgba(255,255,255,0.92)] text-[var(--text-primary)] hover:border-[rgba(15,23,42,0.14)] hover:bg-[rgba(255,255,255,0.98)] hover:shadow-[0_12px_28px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.05)] dark:text-[var(--text-primary)] dark:hover:border-[rgba(255,255,255,0.14)] dark:hover:bg-[rgba(255,255,255,0.08)] dark:hover:shadow-[0_12px_28px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.06)]',
  ghost:
    'border border-transparent bg-transparent text-[var(--text-secondary)] shadow-none hover:bg-[rgba(15,23,42,0.05)] hover:text-[var(--text-primary)] dark:hover:bg-[rgba(255,255,255,0.07)] dark:hover:text-[var(--text-primary)]',
  success:
    'border border-[rgba(34,197,94,0.18)] bg-[rgba(34,197,94,0.10)] text-[rgb(21,128,61)] shadow-[0_10px_22px_rgba(34,197,94,0.10),inset_0_1px_0_rgba(255,255,255,0.3)] hover:border-[rgba(34,197,94,0.28)] hover:bg-[rgba(34,197,94,0.15)] hover:shadow-[0_14px_28px_rgba(34,197,94,0.14),inset_0_1px_0_rgba(255,255,255,0.34)] dark:border-[rgba(111,221,149,0.24)] dark:bg-[rgba(34,197,94,0.18)] dark:text-[#c7f9d7] dark:shadow-[0_10px_22px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.06)] dark:hover:border-[rgba(134,239,172,0.32)] dark:hover:bg-[rgba(34,197,94,0.24)] dark:hover:shadow-[0_14px_28px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.08)]',
  danger:
    'border border-[rgba(239,68,68,0.16)] bg-[rgba(239,68,68,0.10)] text-[rgb(185,28,28)] shadow-[0_10px_22px_rgba(239,68,68,0.08),inset_0_1px_0_rgba(255,255,255,0.28)] hover:border-[rgba(239,68,68,0.28)] hover:bg-[rgba(239,68,68,0.15)] hover:shadow-[0_14px_28px_rgba(239,68,68,0.12),inset_0_1px_0_rgba(255,255,255,0.32)] dark:border-[rgba(248,113,113,0.24)] dark:bg-[rgba(239,68,68,0.18)] dark:text-[#fecaca] dark:shadow-[0_10px_22px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.06)] dark:hover:border-[rgba(252,165,165,0.32)] dark:hover:bg-[rgba(239,68,68,0.24)] dark:hover:shadow-[0_14px_28px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.08)]',
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
