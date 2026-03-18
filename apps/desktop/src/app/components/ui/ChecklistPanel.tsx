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
      <h4 className="mb-3 text-[13px] text-[#6B6863] dark:text-[#A39F9A]">{title}</h4>
      <div className="space-y-2">
        {items.map((item) => (
          <SurfacePanel
            key={item.id}
            tone={variant === 'progress' ? 'default' : 'subtle'}
            className={cn(
              'p-3',
              variant === 'progress' && 'transition-all hover:border-[#C9B896] dark:hover:border-[#9D8B6F]',
            )}
          >
            <div className="flex items-start gap-3">
              {variant === 'progress' ? (
                <div
                  className={cn(
                    'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
                    item.completed
                      ? 'bg-[#2F5D3E] text-white dark:bg-[#3A6B4A]'
                      : 'bg-[#E8E6E3] text-transparent dark:bg-[#2D2C2A]',
                  )}
                >
                  {item.completed ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
                </div>
              ) : (
                <div className="mt-0.5 shrink-0 text-[#9D8B6F] dark:text-[#C9B896]">
                  {item.icon}
                </div>
              )}

              <div
                className={cn(
                  'text-[12px] leading-relaxed',
                  variant === 'progress' && item.completed
                    ? 'text-[#6B6863] line-through dark:text-[#A39F9A]'
                    : 'text-[#3D3A36] dark:text-[#D4D2CE]',
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
