import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/app/lib/cn';
import { SurfacePanel } from './SurfacePanel';

interface ChecklistPanelItem {
  id: string;
  label: ReactNode;
  completed?: boolean;
  icon?: ReactNode;
}

interface ChecklistPanelProps {
  title: string;
  items: ChecklistPanelItem[];
  variant?: 'progress' | 'tips';
  className?: string;
}

export function ChecklistPanel({
  title,
  items,
  variant = 'progress',
  className,
}: ChecklistPanelProps) {
  return (
    <section className={className}>
      <h4 className="mb-3 text-[13px] text-[var(--text-secondary)]">{title}</h4>
      <div className="space-y-2">
        {items.map((item) => (
          <SurfacePanel
            key={item.id}
            tone={variant === 'progress' ? 'default' : 'subtle'}
            className={cn(
              'p-3',
              variant === 'progress' &&
                'transition-all hover:border-[var(--button-primary-border-hover)]',
            )}
          >
            <div className="flex items-start gap-3">
              {variant === 'progress' ? (
                <div
                  className={cn(
                    'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
                    item.completed
                      ? 'bg-[var(--state-success)] text-white'
                      : 'bg-[var(--surface-panel-border)] text-transparent',
                  )}
                >
                  {item.completed ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
                </div>
              ) : (
                <div className="mt-0.5 shrink-0 text-[var(--brand-primary)]">
                  {item.icon}
                </div>
              )}

              <div
                className={cn(
                  'text-[12px] leading-relaxed',
                  variant === 'progress' && item.completed
                    ? 'text-[var(--text-secondary)] line-through'
                    : 'text-[var(--text-primary)]',
                )}
              >
                {item.label}
              </div>
            </div>
          </SurfacePanel>
        ))}
      </div>
    </section>
  );
}
