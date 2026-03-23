import { cn } from '@/app/lib/cn';
import { INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE } from '@/app/lib/ui-interactions';

export function Switch({
  checked,
  onChange,
  disabled = false,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => {
        if (!disabled) {
          onChange(!checked);
        }
      }}
      className={cn(
        'relative h-6 w-12 cursor-pointer rounded-full border border-transparent',
        SPRING_PRESSABLE,
        INTERACTIVE_FOCUS_RING,
        checked
          ? 'bg-[var(--brand-primary)] shadow-[0_10px_22px_rgba(168,140,93,0.18)]'
          : 'bg-[var(--bg-hover)]',
        disabled &&
          'cursor-not-allowed opacity-60 hover:translate-y-0 active:scale-100',
        className,
      )}
    >
      <span
        className={cn(
          'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)] dark:bg-[var(--bg-card)]',
          checked ? 'translate-x-6' : 'translate-x-0',
        )}
      />
    </button>
  );
}
