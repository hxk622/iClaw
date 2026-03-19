import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/app/lib/cn';

interface PageSurfaceProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section' | 'main';
  children: ReactNode;
}

interface PageContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function PageSurface({
  as = 'section',
  className,
  children,
  ...props
}: PageSurfaceProps) {
  const Component = as;
  return (
    <Component
      className={cn('flex min-h-0 min-w-0 flex-1 overflow-y-auto', className)}
      {...props}
    >
      {children}
    </Component>
  );
}

export function PageContent({
  className,
  children,
  ...props
}: PageContentProps) {
  return (
    <div
      className={cn('mx-auto w-full max-w-[1480px] px-6 py-7 lg:px-8', className)}
      {...props}
    >
      {children}
    </div>
  );
}
