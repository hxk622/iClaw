import { cn } from '@/app/lib/cn';
import { APPLE_FLAT_SURFACE, INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE } from '@/app/lib/ui-interactions';

export type SegmentedTabItem<T extends string> = {
  id: T;
  label: string;
  badge?: number;
};

export function SegmentedTabs<T extends string>({
  items,
  activeId,
  onChange,
  className,
}: {
  items: Array<SegmentedTabItem<T>>;
  activeId: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'inline-flex flex-wrap items-center gap-1.5 rounded-[16px] border border-[var(--border-default)] bg-[color-mix(in_srgb,var(--bg-card)_82%,transparent)] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
        className,
      )}
    >
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={cn(
              'inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-[12px] border px-4 py-2 text-[14px] font-semibold transition-all duration-150',
              APPLE_FLAT_SURFACE,
              SPRING_PRESSABLE,
              INTERACTIVE_FOCUS_RING,
              active
                ? 'border-[var(--surface-active-border)] bg-[var(--surface-active-bg)] text-[var(--surface-active-text)] shadow-[var(--surface-active-shadow)]'
                : 'border-[color-mix(in_srgb,var(--border-default)_88%,transparent)] bg-[color-mix(in_srgb,var(--bg-card)_96%,transparent)] text-[var(--text-secondary)] shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-[var(--border-default)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] dark:bg-[color-mix(in_srgb,var(--bg-card)_88%,transparent)]',
            )}
          >
            <span>{item.label}</span>
            {typeof item.badge === 'number' ? (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px]',
                  active
                    ? 'bg-[rgba(255,255,255,0.22)] text-[var(--surface-active-text)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] dark:bg-[rgba(255,255,255,0.10)]'
                    : 'bg-[color-mix(in_srgb,var(--bg-elevated)_96%,transparent)] text-[var(--text-secondary)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] dark:bg-[rgba(255,255,255,0.06)]',
                )}
              >
                {item.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
