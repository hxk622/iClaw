import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/app/lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'success' | 'danger';
type ButtonSize = 'sm' | 'md';

const SPRING_INTERACTION =
  'transition-[transform,box-shadow,border-color,background-color,color,filter] duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)]';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'border border-[rgba(201,169,97,0.18)] bg-[linear-gradient(180deg,rgba(214,181,108,0.98),rgba(191,149,56,0.96))] text-[var(--brand-on-primary)] shadow-[0_1px_0_rgba(255,255,255,0.3)_inset,0_14px_28px_rgba(163,116,29,0.18)] hover:brightness-[1.02]',
  secondary:
    'border border-[rgba(15,23,42,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(246,247,244,0.92))] text-[var(--text-primary)] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_10px_24px_rgba(15,23,42,0.08)] hover:border-[rgba(15,23,42,0.12)] hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,248,246,0.96))]',
  ghost:
    'border border-transparent bg-transparent text-[var(--text-secondary)] shadow-none hover:bg-[rgba(15,23,42,0.05)] hover:text-[var(--text-primary)]',
  success:
    'border border-[rgba(34,197,94,0.18)] bg-[linear-gradient(180deg,rgba(220,252,231,0.98),rgba(240,253,244,0.9))] text-[var(--state-success)] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_12px_26px_rgba(34,197,94,0.10)] hover:border-[rgba(34,197,94,0.28)] hover:bg-[linear-gradient(180deg,rgba(232,255,239,0.98),rgba(242,255,246,0.94))]',
  danger:
    'border border-[rgba(239,68,68,0.16)] bg-[linear-gradient(180deg,rgba(254,226,226,0.98),rgba(254,242,242,0.9))] text-[var(--state-error)] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_12px_26px_rgba(239,68,68,0.10)] hover:border-[rgba(239,68,68,0.28)] hover:bg-[linear-gradient(180deg,rgba(255,236,236,0.98),rgba(255,245,245,0.94))]',
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
        'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium backdrop-blur-[10px]',
        block && 'w-full',
        SPRING_INTERACTION,
        'cursor-pointer hover:-translate-y-[1px] active:translate-y-0 active:scale-[0.985]',
        'disabled:cursor-not-allowed disabled:transform-none disabled:opacity-60 disabled:shadow-none disabled:saturate-[0.85]',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    >
      {leadingIcon}
      {children}
    </button>
  );
}
