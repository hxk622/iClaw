import type { HTMLAttributes, KeyboardEvent, ReactNode } from 'react';
import { cn } from '@/app/lib/cn';
import { INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE } from '@/app/lib/ui-interactions';

interface PressableCardProps extends HTMLAttributes<HTMLElement> {
  as?: 'article' | 'div' | 'section';
  interactive?: boolean;
  children: ReactNode;
}

export function PressableCard({
  as = 'article',
  interactive = false,
  className,
  children,
  onClick,
  onKeyDown,
  ...props
}: PressableCardProps) {
  const Component = as;

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    onKeyDown?.(event);
    if (!interactive || event.defaultPrevented) {
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && onClick) {
      event.preventDefault();
      onClick(event as never);
    }
  };

  return (
    <Component
      role={interactive ? 'button' : props.role}
      tabIndex={interactive ? 0 : props.tabIndex}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'relative overflow-hidden rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-card)] shadow-[var(--shadow-sm)]',
        interactive
          ? cn(
              'cursor-pointer hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)] hover:shadow-[0_18px_32px_rgba(15,23,42,0.08)] dark:hover:shadow-[0_20px_36px_rgba(0,0,0,0.30)]',
              SPRING_PRESSABLE,
              INTERACTIVE_FOCUS_RING,
            )
          : '',
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
