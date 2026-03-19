import type { HTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/app/lib/cn';
import { INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE } from '@/app/lib/ui-interactions';

type SharedSelectionCardProps = {
  selected?: boolean;
  children: ReactNode;
  className?: string;
};

type DivSelectionCardProps = SharedSelectionCardProps &
  HTMLAttributes<HTMLDivElement> & {
    as?: 'div';
  };

type ButtonSelectionCardProps = SharedSelectionCardProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    as: 'button';
  };

export function SelectionCard(props: DivSelectionCardProps | ButtonSelectionCardProps) {
  const selected = props.selected ?? false;
  const className = cn(
    'rounded-[20px] border p-4 text-left',
    selected
      ? 'border-[var(--button-primary-border-hover)] bg-[var(--chip-brand-bg)] shadow-[var(--button-primary-shadow-hover)]'
      : 'border-[var(--border-default)] bg-[var(--bg-card)]',
    classNameFromProps(props),
  );

  if (props.as === 'button') {
    const { as, className: _className, selected: _selected, type = 'button', children, ...rest } = props;
    return (
      <button
        type={type}
        className={cn(
          className,
          'cursor-pointer hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]',
          SPRING_PRESSABLE,
          INTERACTIVE_FOCUS_RING,
        )}
        {...rest}
      >
        {children}
      </button>
    );
  }

  const { as: _as, className: _className, selected: _selected, children, ...rest } = props;
  return (
    <div className={className} {...rest}>
      {children}
    </div>
  );
}

function classNameFromProps(props: { className?: string }) {
  return props.className;
}
