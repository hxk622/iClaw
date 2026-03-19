import type { HTMLAttributes } from 'react';
import { cn } from '@/app/lib/cn';

interface SurfacePanelProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section' | 'article';
  tone?: 'default' | 'subtle';
}

export function SurfacePanel({
  as = 'section',
  tone = 'default',
  className,
  children,
  ...props
}: SurfacePanelProps) {
  const Component = as;

  return (
    <Component
      className={cn(
        'rounded-xl border',
        tone === 'default' &&
          'border-[var(--surface-panel-border)] bg-[var(--surface-panel-default-bg)]',
        tone === 'subtle' &&
          'border-[var(--surface-panel-border)] bg-[var(--surface-panel-subtle-bg)]',
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
