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
        'flex h-full flex-col rounded-[22px] border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,245,239,0.94))] px-4 py-3.5 shadow-[var(--pressable-card-rest-shadow)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[linear-gradient(180deg,rgba(31,29,27,0.96),rgba(22,20,18,0.94))]',
        className,
      )}
    >
      <div className="flex min-h-[58px] items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[14px] border border-[var(--border-default)] bg-white shadow-[var(--pressable-card-rest-shadow)] dark:bg-[rgba(255,255,255,0.04)]">
            <img src={logo} alt={logoAlt} className={cn('h-full w-full object-cover', logoClassName)} />
          </div>
          <div className="min-w-0">
            <div className="text-[16px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">{title}</div>
            <p
              className="mt-1 h-[42px] overflow-hidden text-[13px] leading-[22px] text-[var(--text-secondary)]"
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
        {badge ? <div className="shrink-0 self-start">{badge}</div> : null}
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
      {footer ? <div className="mt-auto pt-3">{footer}</div> : null}
    </PressableCard>
  );
}
