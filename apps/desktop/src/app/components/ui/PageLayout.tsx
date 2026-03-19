import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/app/lib/cn';

interface PageSurfaceProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section' | 'main';
  children: ReactNode;
}

interface PageContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

interface PageHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrowClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  contentClassName?: string;
  actionsClassName?: string;
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

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
  eyebrowClassName,
  titleClassName,
  descriptionClassName,
  contentClassName,
  actionsClassName,
  ...props
}: PageHeaderProps) {
  return (
    <div
      className={cn('flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between', className)}
      {...props}
    >
      <div className={cn('min-w-0', contentClassName)}>
        {eyebrow ? (
          <div
            className={cn(
              'text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]',
              eyebrowClassName,
            )}
          >
            {eyebrow}
          </div>
        ) : null}
        <h1
          className={cn(
            'mt-1.5 text-[28px] font-semibold leading-tight tracking-[-0.05em] text-[var(--text-primary)]',
            titleClassName,
          )}
        >
          {title}
        </h1>
        {description ? (
          <p
            className={cn(
              'mt-1.5 max-w-[760px] text-[13px] leading-6 text-[var(--text-secondary)]',
              descriptionClassName,
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className={cn('flex flex-wrap items-center gap-2.5 xl:justify-end', actionsClassName)}>
          {actions}
        </div>
      ) : null}
    </div>
  );
}
