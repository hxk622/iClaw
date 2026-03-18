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
          'border-[#E8E6E3] bg-white dark:border-[#2D2C2A] dark:bg-[#242320]',
        tone === 'subtle' &&
          'border-[#E8E6E3] bg-[#F5F4F2] dark:border-[#2D2C2A] dark:bg-[#1C1B19]',
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
