import { INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE } from '@/app/lib/ui-interactions';
import { cn } from '@/app/lib/cn';

interface SettingsSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function SettingsSwitch({ checked, onChange }: SettingsSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-12 rounded-full cursor-pointer',
        SPRING_PRESSABLE,
        INTERACTIVE_FOCUS_RING,
        checked ? 'bg-[var(--brand-primary)]' : 'bg-[var(--bg-hover)]',
      )}
    >
      <span
        className={cn(
          'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
          checked ? 'translate-x-6' : 'translate-x-0',
        )}
      />
    </button>
  );
}
