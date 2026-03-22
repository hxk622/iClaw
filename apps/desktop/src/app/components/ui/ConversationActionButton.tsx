import type { ButtonHTMLAttributes } from 'react';
import { MessageSquare } from 'lucide-react';

import { cn } from '@/app/lib/cn';
import { APPLE_FLAT_SURFACE, INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE } from '@/app/lib/ui-interactions';

type ConversationActionButtonVariant = 'secondary' | 'accent' | 'success';
type ConversationActionButtonSize = 'sm' | 'md';

const VARIANT_CLASS_NAMES: Record<ConversationActionButtonVariant, string> = {
  secondary:
    'border border-[var(--lobster-border)] bg-[var(--lobster-card-bg)] text-[var(--lobster-text-primary)] hover:border-[var(--lobster-border-strong)] hover:bg-[var(--lobster-surface-hover)] hover:text-[var(--lobster-text-primary)] dark:border-[rgba(194,170,130,0.16)] dark:bg-[rgba(255,255,255,0.025)] dark:text-[var(--lobster-text-primary)] dark:hover:border-[rgba(194,170,130,0.28)] dark:hover:bg-[rgba(255,255,255,0.05)] dark:hover:text-[var(--lobster-text-primary)]',
  accent:
    'border border-[var(--lobster-gold-border)] bg-[var(--lobster-gold-soft)] text-[var(--lobster-gold-strong)] hover:border-[var(--lobster-gold-border-strong)] hover:bg-[var(--lobster-gold-soft-strong)] hover:text-[var(--lobster-gold-strong)] dark:border-[rgba(194,170,130,0.22)] dark:bg-[rgba(180,154,112,0.16)] dark:text-[#dcc49c] dark:hover:border-[rgba(214,190,151,0.34)] dark:hover:bg-[rgba(180,154,112,0.24)] dark:hover:text-[#ead7b6]',
  success:
    'border border-[rgba(34,197,94,0.18)] bg-[rgba(34,197,94,0.10)] text-[rgb(21,128,61)] hover:border-[rgba(34,197,94,0.28)] hover:bg-[rgba(34,197,94,0.15)] dark:border-[rgba(111,221,149,0.20)] dark:bg-[rgba(34,197,94,0.18)] dark:text-[#c7f9d7] dark:hover:border-[rgba(134,239,172,0.32)] dark:hover:bg-[rgba(34,197,94,0.24)]',
};

const SIZE_CLASS_NAMES: Record<ConversationActionButtonSize, string> = {
  sm: 'min-h-[36px] rounded-[10px] px-3 text-[13px]',
  md: 'min-h-[44px] rounded-[16px] px-4 py-2.5 text-[14px]',
};

export interface ConversationActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ConversationActionButtonVariant;
  size?: ConversationActionButtonSize;
  block?: boolean;
  label?: string;
}

export function ConversationActionButton({
  variant = 'secondary',
  size = 'md',
  block = false,
  label = '对话',
  className,
  type = 'button',
  ...props
}: ConversationActionButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium shadow-[var(--lobster-shadow-button)]',
        APPLE_FLAT_SURFACE,
        SPRING_PRESSABLE,
        INTERACTIVE_FOCUS_RING,
        'cursor-pointer disabled:cursor-not-allowed disabled:transform-none disabled:opacity-60 disabled:shadow-none',
        block && 'w-full',
        VARIANT_CLASS_NAMES[variant],
        SIZE_CLASS_NAMES[size],
        className,
      )}
      {...props}
    >
      <MessageSquare className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} />
      <span>{label}</span>
    </button>
  );
}
