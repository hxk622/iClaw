import { cn } from '@/app/lib/cn';
import { ProtectionSignal } from './ProtectionSignal';

type SecurityStatusBadgeState = 'protecting' | 'enabled' | 'disabled';
type SecurityStatusBadgeSize = 'sm' | 'md';

const STATE_STYLE: Record<
  SecurityStatusBadgeState,
  {
    defaultLabel: string;
    shell: string;
    dot: string;
  }
> = {
  protecting: {
    defaultLabel: '保护中',
    shell:
      'border-[var(--lobster-gold-border-strong)] bg-[linear-gradient(180deg,rgba(234,225,208,0.98),rgba(224,212,191,0.94))] text-[var(--lobster-gold-strong)] shadow-[0_10px_24px_rgba(168,140,93,0.16)]',
    dot: 'bg-[var(--lobster-gold-strong)]',
  },
  enabled: {
    defaultLabel: '已开启',
    shell:
      'border-[rgba(74,107,90,0.20)] bg-[linear-gradient(180deg,rgba(232,240,236,0.98),rgba(221,235,227,0.95))] text-[var(--state-success)] shadow-[0_10px_22px_rgba(74,107,90,0.14)]',
    dot: 'bg-[var(--state-success)]',
  },
  disabled: {
    defaultLabel: '已关闭',
    shell:
      'border-[rgba(154,146,136,0.16)] bg-[rgba(154,146,136,0.10)] text-[var(--text-muted)] shadow-none',
    dot: 'bg-[var(--text-muted)]',
  },
};

export function SecurityStatusBadge({
  state,
  label,
  size = 'sm',
  className,
}: {
  state: SecurityStatusBadgeState;
  label?: string;
  size?: SecurityStatusBadgeSize;
  className?: string;
}) {
  const style = STATE_STYLE[state];
  const isMedium = size === 'md';

  return (
    <span
      className={cn(
        isMedium
          ? 'inline-flex items-center gap-3 rounded-full border px-4 py-2 text-[14px] font-semibold leading-none tracking-tight'
          : 'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold leading-none',
        style.shell,
        className,
      )}
    >
      {state === 'protecting' ? (
        <ProtectionSignal
          size={isMedium ? 'sm' : 'xs'}
          tone="gold"
          className={cn(isMedium ? 'scale-100' : 'scale-[0.95]')}
        />
      ) : (
        <span className={cn('relative inline-flex shrink-0', isMedium ? 'h-3 w-3' : 'h-2.5 w-2.5')}>
          <span
            className={cn(
              'absolute inset-0 rounded-full opacity-60 motion-safe:animate-pulse',
              style.dot,
            )}
          />
          <span
            className={cn(
              'relative z-[1] inline-flex rounded-full',
              isMedium ? 'h-3 w-3' : 'h-2.5 w-2.5',
              style.dot,
            )}
          />
        </span>
      )}
      {label ?? style.defaultLabel}
    </span>
  );
}
