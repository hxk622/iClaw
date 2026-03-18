import { INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE } from '@/app/lib/ui-interactions';
import { cn } from '@/app/lib/cn';

export interface SettingsSegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SettingsSegmentedControlProps<T extends string> {
  value: T;
  options: SettingsSegmentedOption<T>[];
  onChange: (value: T) => void;
}

export function SettingsSegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: SettingsSegmentedControlProps<T>) {
  return (
    <div className="flex gap-3">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'flex-1 rounded-[14px] border px-4 py-2.5 text-sm font-medium cursor-pointer',
              SPRING_PRESSABLE,
              INTERACTIVE_FOCUS_RING,
              active
                ? 'border-[var(--brand-primary)] bg-[var(--bg-card)] text-[var(--brand-primary)]'
                : 'border-[var(--border-default)] bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
