import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/app/lib/cn';

type ChipTone = 'muted' | 'outline' | 'brand' | 'success' | 'warning' | 'danger';

const CHIP_TONE_CLASSES: Record<ChipTone, string> = {
  muted: 'bg-[var(--bg-hover)] text-[var(--text-secondary)]',
  outline: 'border border-[var(--border-default)] text-[var(--text-muted)]',
  brand: 'bg-[rgba(201,169,97,0.14)] text-[var(--brand-primary)]',
  success: 'border border-[rgba(34,197,94,0.18)] bg-[rgba(34,197,94,0.10)] text-[var(--state-success)]',
  warning: 'border border-[rgba(245,158,11,0.2)] bg-[rgba(245,158,11,0.12)] text-[rgb(180,100,24)]',
  danger: 'border border-[rgba(239,68,68,0.18)] bg-[rgba(239,68,68,0.10)] text-[var(--state-error)]',
};

const BASE_CHIP_CLASS =
  'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] leading-none';

interface BaseChipProps {
  tone?: ChipTone;
  active?: boolean;
  leadingIcon?: ReactNode;
  className?: string;
  children?: ReactNode;
}

interface StaticChipProps extends BaseChipProps, Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  clickable?: false;
}

interface ClickableChipProps extends BaseChipProps, Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  clickable: true;
}

export function Chip(props: StaticChipProps | ClickableChipProps) {
  const {
    tone = 'muted',
    active = false,
    leadingIcon,
    className,
    children,
    ...rest
  } = props;

  const classes = cn(
    BASE_CHIP_CLASS,
    CHIP_TONE_CLASSES[tone],
    active && 'bg-[var(--brand-primary)] text-[var(--brand-on-primary)]',
    props.clickable &&
      'cursor-pointer transition-[transform,box-shadow,border-color,background-color,color] duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[1px] active:translate-y-0 active:scale-[0.985] disabled:cursor-not-allowed disabled:transform-none disabled:opacity-60',
    className,
  );

  if (props.clickable) {
    const buttonProps = rest as ButtonHTMLAttributes<HTMLButtonElement>;
    return (
      <button type={buttonProps.type || 'button'} className={classes} {...buttonProps}>
        {leadingIcon}
        {children}
      </button>
    );
  }

  return (
    <span className={classes} {...(rest as HTMLAttributes<HTMLSpanElement>)}>
      {leadingIcon}
      {children}
    </span>
  );
}
