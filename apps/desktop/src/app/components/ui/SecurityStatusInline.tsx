import { cn } from '@/app/lib/cn';
import { ProtectionSignal } from './ProtectionSignal';

type SecurityStatusInlineState = 'protecting' | 'enabled' | 'disabled';

const STATE_STYLE: Record<
  SecurityStatusInlineState,
  {
    defaultLabel: string;
    text: string;
    dot: string;
  }
> = {
  protecting: {
    defaultLabel: '安全防护中',
    text: 'text-[var(--lobster-gold-strong)]',
    dot: 'bg-[var(--state-success)]',
  },
  enabled: {
    defaultLabel: '已开启',
    text: 'text-[var(--state-success)]',
    dot: 'bg-[var(--state-success)]',
  },
  disabled: {
    defaultLabel: '已关闭',
    text: 'text-[var(--text-muted)]',
    dot: 'bg-[var(--text-muted)]',
  },
};

export function SecurityStatusInline({
  state,
  label,
  className,
}: {
  state: SecurityStatusInlineState;
  label?: string;
  className?: string;
}) {
  const style = STATE_STYLE[state];

  return (
    <div className={cn('inline-flex items-center gap-2.5 leading-none', style.text, className)}>
      {state === 'protecting' ? (
        <ProtectionSignal size="xs" tone="gold" emphasis="strong" className="scale-[1.02]" />
      ) : (
        <span className="relative inline-flex h-2.5 w-2.5 shrink-0">
          <span className={cn('absolute inset-0 rounded-full opacity-60 motion-safe:animate-pulse', style.dot)} />
          <span className={cn('relative z-[1] inline-flex h-2.5 w-2.5 rounded-full', style.dot)} />
        </span>
      )}
      <span className="text-[12px] font-semibold tracking-[0.01em]">{label ?? style.defaultLabel}</span>
    </div>
  );
}
