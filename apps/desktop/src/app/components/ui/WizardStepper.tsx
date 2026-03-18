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
                  'bg-[#2F5D3E] shadow-sm dark:bg-[#3A6B4A]',
                step.status === 'current' &&
                  'bg-[#C9B896] shadow-md shadow-[#C9B896]/30 dark:bg-[#9D8B6F] dark:shadow-[#9D8B6F]/30',
                step.status === 'upcoming' && 'bg-[#E8E6E3] dark:bg-[#2D2C2A]',
              )}
            >
              {step.status === 'completed' ? (
                <Check className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
              ) : (
                <span
                  className={cn(
                    'text-[13px] font-medium',
                    step.status === 'current'
                      ? 'text-[#1A1916] dark:text-[#F5F4F2]'
                      : 'text-[#9B9691] dark:text-[#514E4A]',
                  )}
                >
                  {step.id}
                </span>
              )}
            </div>

            <span
              className={cn(
                'whitespace-nowrap text-[13px] transition-colors',
                step.status === 'current' &&
                  'font-medium text-[#1A1916] dark:text-[#F5F4F2]',
                step.status === 'completed' && 'text-[#6B6863] dark:text-[#A39F9A]',
                step.status === 'upcoming' && 'text-[#9B9691] dark:text-[#6B6863]',
              )}
            >
              {step.label}
            </span>
          </div>

          {index < steps.length - 1 ? (
            <div className="mx-3 h-px flex-1 bg-[#E8E6E3] dark:bg-[#2D2C2A]" />
          ) : null}
        </div>
      ))}
    </div>
  );
}
