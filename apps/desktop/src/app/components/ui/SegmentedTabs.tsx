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
                ? 'border-[rgba(59,130,246,0.18)] bg-[rgba(59,130,246,0.10)] text-[rgb(29,78,216)] shadow-[0_12px_24px_rgba(59,130,246,0.10)] dark:border-[rgba(201,169,97,0.20)] dark:bg-[rgba(201,169,97,0.16)] dark:text-[#f1d59c] dark:shadow-[0_12px_24px_rgba(0,0,0,0.18)]'
                : 'border-transparent bg-transparent text-[var(--text-secondary)] hover:border-[var(--border-default)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
            )}
          >
            <span>{item.label}</span>
            {typeof item.badge === 'number' ? (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px]',
                  active
                    ? 'bg-[rgba(59,130,246,0.14)] text-[rgb(29,78,216)] dark:bg-[rgba(201,169,97,0.24)] dark:text-[#f1d59c]'
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
