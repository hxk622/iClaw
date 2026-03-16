import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/app/lib/cn';
import { INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE } from '@/app/lib/ui-interactions';

type ChipTone = 'muted' | 'outline' | 'brand' | 'success' | 'warning' | 'danger';

const CHIP_TONE_CLASSES: Record<ChipTone, string> = {
  muted:
    'border border-transparent bg-[var(--bg-hover)] text-[var(--text-secondary)] dark:bg-[rgba(255,255,255,0.06)] dark:text-[var(--text-secondary)]',
  outline:
    'border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.03)] dark:text-[var(--text-secondary)]',
  brand:
    'border border-[rgba(59,130,246,0.14)] bg-[rgba(59,130,246,0.10)] text-[#2563eb] dark:border-[rgba(201,169,97,0.20)] dark:bg-[rgba(201,169,97,0.16)] dark:text-[#f2d9a4]',
  success:
    'border border-[rgba(34,197,94,0.16)] bg-[rgba(34,197,94,0.10)] text-[rgb(21,128,61)] dark:border-[rgba(111,221,149,0.20)] dark:bg-[rgba(34,197,94,0.18)] dark:text-[#c7f9d7]',
  warning:
    'border border-[rgba(245,158,11,0.18)] bg-[rgba(245,158,11,0.10)] text-[rgb(180,100,24)] dark:border-[rgba(251,191,36,0.20)] dark:bg-[rgba(245,158,11,0.18)] dark:text-[#f8d48f]',
  danger:
    'border border-[rgba(239,68,68,0.16)] bg-[rgba(239,68,68,0.10)] text-[rgb(185,28,28)] dark:border-[rgba(248,113,113,0.20)] dark:bg-[rgba(239,68,68,0.18)] dark:text-[#fecaca]',
};

const BASE_CHIP_CLASS =
  'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] leading-none shadow-none';

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
    active &&
      'border-[rgba(59,130,246,0.18)] bg-[var(--brand-primary)] text-[var(--brand-on-primary)] dark:border-[rgba(201,169,97,0.24)] dark:bg-[var(--brand-primary)] dark:text-[#17120b]',
    props.clickable &&
      cn(
        'cursor-pointer hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:transform-none disabled:opacity-70 disabled:hover:translate-y-0',
        SPRING_PRESSABLE,
        INTERACTIVE_FOCUS_RING,
      ),
    className,
  );

  if (props.clickable) {
    const buttonProps = rest as ButtonHTMLAttributes<HTMLButtonElement>;
    return (
      <button type={buttonProps.type || 'button'} className={classes} {...buttonProps}>
        {leadingIcon ? <span className="shrink-0">{leadingIcon}</span> : null}
        {children}
      </button>
    );
  }

  return (
    <span className={classes} {...(rest as HTMLAttributes<HTMLSpanElement>)}>
      {leadingIcon ? <span className="shrink-0">{leadingIcon}</span> : null}
      {children}
    </span>
  );
}
