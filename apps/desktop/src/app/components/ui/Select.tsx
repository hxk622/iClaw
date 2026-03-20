import { Check, ChevronDown } from 'lucide-react';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
} from 'react';
import { cn } from '@/app/lib/cn';
import {
  APPLE_FLAT_SURFACE,
  INTERACTIVE_FOCUS_RING,
  SPRING_PRESSABLE,
} from '@/app/lib/ui-interactions';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface SelectProps<T extends string = string> extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value: T | null;
  options: Array<SelectOption<T>>;
  onChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
  triggerClassName?: string;
  menuClassName?: string;
}

export function Select<T extends string = string>({
  value,
  options,
  onChange,
  placeholder = '请选择',
  disabled = false,
  className,
  triggerClassName,
  menuClassName,
  ...props
}: SelectProps<T>) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<'top' | 'bottom'>('bottom');

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const estimatedHeight = Math.min(Math.max(options.length * 44 + 16, 120), 280);
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    setSide(spaceBelow < estimatedHeight && spaceAbove > spaceBelow ? 'top' : 'bottom');
  }, [open, options.length]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const triggerLabel = selectedOption?.label ?? placeholder;
  const triggerDescription = selectedOption?.description ?? null;

  return (
    <div ref={rootRef} className={cn('relative', className)} {...props}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => {
          if (disabled) {
            return;
          }
          setOpen((current) => !current);
        }}
        className={cn(
          'flex w-full cursor-pointer items-center justify-between gap-3 rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-left text-[14px] text-[var(--text-primary)]',
          APPLE_FLAT_SURFACE,
          SPRING_PRESSABLE,
          INTERACTIVE_FOCUS_RING,
          'disabled:cursor-not-allowed disabled:transform-none disabled:opacity-70 disabled:shadow-none disabled:hover:translate-y-0',
          triggerClassName,
        )}
      >
        <span className="min-w-0">
          <span className={cn('block truncate', !selectedOption && 'text-[var(--text-muted)]')}>
            {triggerLabel}
          </span>
          {triggerDescription ? (
            <span className="mt-0.5 block truncate text-[11px] text-[var(--text-secondary)]">
              {triggerDescription}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform duration-[180ms]',
            open && 'rotate-180',
          )}
        />
      </button>

      {open ? (
        <div
          id={menuId}
          role="listbox"
          className={cn(
            'absolute left-0 right-0 z-50 max-h-[280px] overflow-y-auto rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-1.5 shadow-[var(--shadow-popover)]',
            side === 'top' ? 'bottom-[calc(100%+8px)]' : 'top-[calc(100%+8px)]',
            menuClassName,
          )}
        >
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                disabled={option.disabled}
                onClick={() => {
                  if (option.disabled) {
                    return;
                  }
                  onChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full cursor-pointer items-center justify-between gap-3 rounded-[14px] px-3 py-2.5 text-left',
                  SPRING_PRESSABLE,
                  INTERACTIVE_FOCUS_RING,
                  active
                    ? 'bg-[var(--chip-brand-bg)] text-[var(--chip-brand-text)]'
                    : 'text-[var(--text-primary)] hover:bg-[var(--bg-hover)]',
                  option.disabled &&
                    'cursor-not-allowed opacity-50 hover:translate-y-0 hover:bg-transparent active:scale-100',
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium">{option.label}</span>
                  {option.description ? (
                    <span className="mt-0.5 block truncate text-[11px] text-[var(--text-secondary)]">
                      {option.description}
                    </span>
                  ) : null}
                </span>
                {active ? <Check className="h-4 w-4 shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
