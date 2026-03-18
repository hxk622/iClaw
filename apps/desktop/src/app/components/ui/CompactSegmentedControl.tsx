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
                    'border border-[rgba(59,130,246,0.18)] bg-[rgba(59,130,246,0.10)] text-[rgb(29,78,216)] shadow-[0_10px_20px_rgba(59,130,246,0.08)]',
                    'dark:border-[rgba(201,169,97,0.20)] dark:bg-[rgba(201,169,97,0.16)] dark:text-[#f1d59c] dark:shadow-[0_10px_20px_rgba(0,0,0,0.18)]',
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
