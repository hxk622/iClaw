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
    <div className={cn('flex items-center gap-2', className)}>
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={cn(
              'inline-flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-[14px] font-medium transition-all',
              APPLE_FLAT_SURFACE,
              SPRING_PRESSABLE,
              INTERACTIVE_FOCUS_RING,
              active
                ? 'border-[var(--chip-brand-border-strong)] bg-[var(--chip-brand-bg)] text-[var(--chip-brand-text)] shadow-[var(--button-secondary-shadow)]'
                : 'border-transparent bg-transparent text-[var(--text-secondary)] hover:border-[var(--border-default)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
            )}
          >
            <span>{item.label}</span>
            {typeof item.badge === 'number' ? (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px]',
                  active
                    ? 'bg-[var(--chip-brand-bg-hover)] text-[var(--chip-brand-text)]'
                    : 'bg-[var(--bg-card)] text-[var(--text-muted)] dark:bg-[rgba(255,255,255,0.05)]',
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
