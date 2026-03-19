import type { ReactNode } from 'react';
import { cn } from '@/app/lib/cn';
import { PressableCard } from './PressableCard';

export function PlatformCardShell({
  logo,
  logoAlt,
  logoClassName,
  title,
  description,
  badge,
  children,
  footer,
  onClick,
  className,
}: {
  logo: string;
  logoAlt: string;
  logoClassName?: string;
  title: string;
  description: string;
  badge?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <PressableCard
      interactive={Boolean(onClick)}
      onClick={onClick}
      className={cn(
        'flex h-full flex-col border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(246,247,244,0.92))] px-4 py-3.5 shadow-[var(--pressable-card-hover-shadow)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[linear-gradient(180deg,rgba(29,29,29,0.96),rgba(17,17,17,0.94))]',
        className,
      )}
    >
      <div className="flex min-h-[64px] items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[16px] border border-[var(--border-default)] bg-white shadow-[var(--lobster-shadow-button)] dark:bg-[rgba(255,255,255,0.04)]">
            <img src={logo} alt={logoAlt} className={cn('h-full w-full object-cover', logoClassName)} />
          </div>
          <div className="min-w-0">
            <div className="text-[17px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">{title}</div>
            <p
              className="mt-1 h-[40px] overflow-hidden text-[12px] leading-5 text-[var(--text-secondary)]"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {description}
            </p>
          </div>
        </div>
        {badge}
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
      {footer ? <div className="mt-auto pt-3">{footer}</div> : null}
    </PressableCard>
  );
}
