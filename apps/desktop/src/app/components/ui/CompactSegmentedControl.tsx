import { cn } from '@/app/lib/cn';
import { APPLE_FLAT_SURFACE, INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE } from '@/app/lib/ui-interactions';

export type CompactSegmentedOption<T extends string> = {
  value: T;
  label: string;
};

export function CompactSegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: Array<CompactSegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-hover)] p-1',
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
              'relative inline-flex min-h-[34px] items-center justify-center rounded-[11px] px-3.5 text-[13px] font-medium',
              'cursor-pointer',
              SPRING_PRESSABLE,
              INTERACTIVE_FOCUS_RING,
              active
                ? cn(
                    APPLE_FLAT_SURFACE,
                    'border border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--text-primary)]',
                    'dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.06)]',
                  )
                : 'border border-transparent bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
