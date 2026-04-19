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
      className={cn('inline-flex flex-wrap items-center gap-1.5 rounded-[16px] border p-1.5', className)}
      style={{
        borderColor: 'var(--segmented-rail-border)',
        background: 'var(--segmented-rail-bg)',
        boxShadow: 'var(--segmented-rail-shadow)',
      }}
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
                : 'border-[var(--segmented-item-border)] bg-[var(--segmented-item-bg)] text-[var(--text-secondary)] shadow-[var(--segmented-item-shadow)] hover:border-[var(--border-default)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
            )}
          >
            <span>{item.label}</span>
            {typeof item.badge === 'number' ? (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px]',
                  active
                    ? 'bg-[var(--segmented-badge-active-bg)] text-[var(--surface-active-text)] shadow-[var(--segmented-badge-active-shadow)]'
                    : 'bg-[var(--segmented-badge-bg)] text-[var(--text-secondary)] shadow-[var(--segmented-badge-shadow)]',
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
