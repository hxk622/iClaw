import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/app/lib/cn';

export function DrawerSection({
  title,
  description,
  icon,
  headerAccessory,
  children,
  className,
  ...props
}: HTMLAttributes<HTMLElement> & {
  title?: string;
  description?: ReactNode;
  icon?: ReactNode;
  headerAccessory?: ReactNode;
}) {
  return (
    <section
      className={cn(
        'rounded-[24px] border border-[var(--border-default)] bg-white/76 p-[18px] shadow-[var(--pressable-card-rest-shadow)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.03)]',
        className,
      )}
      {...props}
    >
      {title || description || icon || headerAccessory ? (
        <div className="mb-[14px] flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {(icon || title) ? (
              <div className="flex items-center gap-2">
                {icon ? <span className="text-[var(--brand-primary)]">{icon}</span> : null}
                {title ? <div className="text-[16px] font-semibold text-[var(--text-primary)]">{title}</div> : null}
              </div>
            ) : null}
            {description ? <p className={cn('text-[13px] leading-6 text-[var(--text-secondary)]', title || icon ? 'mt-2' : '')}>{description}</p> : null}
          </div>
          {headerAccessory ? <div className="flex flex-wrap items-center gap-2">{headerAccessory}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
