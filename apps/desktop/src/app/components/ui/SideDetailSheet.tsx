import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { cn } from '@/app/lib/cn';

export function SideDetailSheet({
  open,
  onClose,
  title,
  eyebrow,
  header,
  footer,
  children,
  panelClassName,
  bodyClassName,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  eyebrow?: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  panelClassName?: string;
  bodyClassName?: string;
}) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-[rgba(26,22,18,0.18)] backdrop-blur-[3px] dark:bg-[rgba(0,0,0,0.34)]"
      onClick={onClose}
    >
      <aside
        className={cn(
          'flex h-full w-full min-w-0 max-w-[560px] flex-col overflow-hidden border-l border-[var(--border-default)]',
          'bg-[linear-gradient(180deg,rgba(252,251,248,0.98),rgba(244,240,233,0.96))] shadow-[0_32px_90px_rgba(26,22,18,0.18)]',
          'dark:border-l-[rgba(255,255,255,0.08)] dark:bg-[linear-gradient(180deg,rgba(25,23,21,0.98),rgba(17,16,15,0.96))] dark:shadow-[0_30px_90px_rgba(0,0,0,0.44)]',
          panelClassName,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-[var(--border-default)] px-6 py-[18px] dark:border-b-[rgba(255,255,255,0.08)]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {eyebrow ? (
                <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-[var(--border-default)] bg-white/72 px-3 py-1 text-[11px] text-[var(--text-secondary)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.04)]">
                  {eyebrow}
                </div>
              ) : null}
              {title ? (
                <h2 className={cn('min-w-0 text-[22px] font-semibold tracking-[-0.03em] text-[var(--text-primary)]', eyebrow ? 'mt-3.5' : '')}>
                  {title}
                </h2>
              ) : null}
              {header ? <div className={cn(title || eyebrow ? 'mt-3.5' : '')}>{header}</div> : null}
            </div>
            <Button variant="ghost" size="sm" className="shrink-0 rounded-full" onClick={onClose} leadingIcon={<X className="h-4 w-4" />}>
              关闭
            </Button>
          </div>
        </div>

        <div className={cn('min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-5', bodyClassName)}>
          {children}
        </div>

        {footer ? (
          <div className="border-t border-[var(--border-default)] bg-[var(--bg-card)] px-6 py-4 dark:border-t-[rgba(255,255,255,0.08)] dark:bg-[var(--bg-page)]">
            {footer}
          </div>
        ) : null}
      </aside>
    </div>
  );
}
