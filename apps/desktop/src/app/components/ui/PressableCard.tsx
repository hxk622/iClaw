import type { HTMLAttributes, KeyboardEvent, ReactNode } from 'react';
import { cn } from '@/app/lib/cn';

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
          ? 'cursor-pointer transition-[transform,box-shadow,border-color,background-color] duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[1px] hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)] active:translate-y-0 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]/40'
          : '',
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
