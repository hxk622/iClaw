import type {ChangeEventHandler, ReactNode} from 'react';
import {Search} from 'lucide-react';

import {MetricCard} from '@/app/components/ui/MetricCard';
import {cn} from '@/app/lib/cn';
import {INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE} from '@/app/lib/ui-interactions';

export type WorkspaceMetricItem = {
  label: string;
  value: number | string;
  icon: ReactNode;
  iconWrapClassName?: string;
  iconClassName?: string;
};

export function WorkspaceSearchControls({
  value,
  onChange,
  placeholder,
  secondaryControl,
}: {
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  placeholder: string;
  secondaryControl?: ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className={cn('grid gap-3', secondaryControl ? 'grid-cols-1 xl:grid-cols-[minmax(0,1fr)_220px]' : 'grid-cols-1')}>
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] py-2.5 pl-11 pr-4 text-[12px] text-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[rgba(201,169,97,0.24)] focus:ring-2 dark:bg-[rgba(255,255,255,0.03)]"
            style={{['--tw-ring-color' as string]: 'rgba(201,169,97,0.12)'}}
          />
        </label>
        {secondaryControl}
      </div>
    </div>
  );
}

export function WorkspaceMetricGrid({items}: {items: WorkspaceMetricItem[]}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
      {items.map((item) => (
        <MetricCard
          key={item.label}
          label={item.label}
          value={item.value}
          icon={item.icon}
          iconWrapClassName={item.iconWrapClassName}
          iconClassName={item.iconClassName}
        />
      ))}
    </div>
  );
}

export function WorkspaceSectionCard({
  title,
  description,
  icon,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-sm)] dark:bg-[rgba(255,255,255,0.03)]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[15px] font-medium text-[var(--text-primary)]">{title}</div>
          {description ? <div className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">{description}</div> : null}
        </div>
        {icon ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-[rgba(201,169,97,0.18)] bg-[rgba(201,169,97,0.10)] text-[rgb(155,112,39)] dark:text-[#f1d59c]">
            {icon}
          </div>
        ) : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function buildMonogram(label: string): string {
  const compact = label.replace(/\s+/g, '');
  return compact.slice(0, Math.min(2, compact.length)) || '--';
}

export function InstrumentIdentityBadge({
  label,
  symbol,
  tone = 'slate',
}: {
  label: string;
  symbol?: string | null;
  tone?: 'slate' | 'blue';
}) {
  return (
    <div
      className={cn(
        'flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] border text-[15px] font-semibold tracking-[0.08em]',
        tone === 'blue'
          ? 'border-[rgba(42,74,111,0.16)] bg-[rgba(42,74,111,0.10)] text-[#2A4A6F] dark:border-[rgba(90,124,166,0.28)] dark:bg-[rgba(42,74,111,0.22)] dark:text-[#c7d9ee]'
          : 'border-[rgba(120,130,148,0.14)] bg-[rgba(99,102,241,0.06)] text-[var(--text-primary)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.05)] dark:text-[var(--text-primary)]',
      )}
      aria-label={symbol ? `${label} ${symbol}` : label}
      title={symbol ? `${label} · ${symbol}` : label}
    >
      {buildMonogram(label)}
    </div>
  );
}

export function WorkspaceFilterPill({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] transition-all',
        SPRING_PRESSABLE,
        INTERACTIVE_FOCUS_RING,
        active
          ? 'border-[var(--chip-brand-active-border)] bg-[var(--brand-primary)] text-[var(--brand-on-primary)]'
          : 'border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] dark:bg-[rgba(255,255,255,0.03)]',
      )}
    >
      {children}
    </button>
  );
}
