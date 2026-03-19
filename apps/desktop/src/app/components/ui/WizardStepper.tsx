import { Check } from 'lucide-react';
import { cn } from '@/app/lib/cn';

export interface WizardStepItem {
  id: number | string;
  label: string;
  status: 'completed' | 'current' | 'upcoming';
}

interface WizardStepperProps {
  steps: WizardStepItem[];
  className?: string;
}

export function WizardStepper({ steps, className }: WizardStepperProps) {
  return (
    <div className={cn('flex items-center justify-between', className)}>
      {steps.map((step, index) => (
        <div key={step.id} className="flex flex-1 items-center">
          <div className="flex flex-1 items-center gap-3">
            <div
              className={cn(
                'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-300',
                step.status === 'completed' &&
                  'bg-[var(--state-success)] shadow-[var(--button-secondary-shadow)]',
                step.status === 'current' &&
                  'bg-[var(--brand-primary)] shadow-[var(--button-primary-shadow-hover)]',
                step.status === 'upcoming' && 'bg-[var(--surface-panel-border)] dark:bg-[var(--surface-panel-border)]',
              )}
            >
              {step.status === 'completed' ? (
                <Check className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
              ) : (
                <span
                  className={cn(
                    'text-[13px] font-medium',
                    step.status === 'current'
                      ? 'text-[var(--brand-on-primary)]'
                      : 'text-[var(--text-muted)] dark:text-[var(--text-disabled)]',
                  )}
                >
                  {step.id}
                </span>
              )}
            </div>

            <span
              className={cn(
                'whitespace-nowrap text-[13px] transition-colors',
                step.status === 'current' && 'font-medium text-[var(--text-primary)]',
                step.status === 'completed' && 'text-[var(--text-secondary)]',
                step.status === 'upcoming' && 'text-[var(--text-muted)]',
              )}
            >
              {step.label}
            </span>
          </div>

          {index < steps.length - 1 ? (
            <div className="mx-3 h-px flex-1 bg-[var(--surface-panel-border)]" />
          ) : null}
        </div>
      ))}
    </div>
  );
}
