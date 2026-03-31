import { cn } from '@/app/lib/cn';
import { INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE } from '@/app/lib/ui-interactions';

export type CompactSegmentedOption<T extends string> = {
  value: T;
  label: string;
};

export function CompactSegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  itemClassName,
  activeItemClassName,
  inactiveItemClassName,
}: {
  options: Array<CompactSegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
  itemClassName?: string;
  activeItemClassName?: string;
  inactiveItemClassName?: string;
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 rounded-[10px] border border-[var(--border-default)] bg-[color-mix(in_srgb,var(--bg-hover)_70%,transparent)] p-1',
        'dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.04)]',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'relative inline-flex min-h-[36px] items-center justify-center rounded-[8px] px-4 py-2 text-[14px] font-medium',
              'cursor-pointer',
              SPRING_PRESSABLE,
              INTERACTIVE_FOCUS_RING,
              itemClassName,
              active
                ? cn(
                    'border border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--text-primary)] shadow-[var(--pressable-card-rest-shadow)]',
                    'dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.08)] dark:text-[var(--text-primary)]',
                    activeItemClassName,
                  )
                : cn(
                    'border border-transparent bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                    inactiveItemClassName,
                  ),
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
