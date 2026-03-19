import type { ReactNode } from 'react';
import { Shield } from 'lucide-react';
import { cn } from '@/app/lib/cn';

type ProtectionSignalTone = 'gold' | 'success';
type ProtectionSignalSize = 'xs' | 'sm' | 'md';

const SIZE_CLASSES: Record<
  ProtectionSignalSize,
  { frame: string; core: string; icon: string; inset: string[] }
> = {
  xs: {
    frame: 'h-4 w-4',
    core: 'h-2.5 w-2.5',
    icon: 'h-1.5 w-1.5',
    inset: ['inset-0', 'inset-[16%]', 'inset-[30%]'],
  },
  sm: {
    frame: 'h-7 w-7',
    core: 'h-4.5 w-4.5',
    icon: 'h-2.5 w-2.5',
    inset: ['inset-0', 'inset-[15%]', 'inset-[28%]'],
  },
  md: {
    frame: 'h-11 w-11',
    core: 'h-7 w-7',
    icon: 'h-3.5 w-3.5',
    inset: ['inset-0', 'inset-[14%]', 'inset-[26%]'],
  },
};

const TONE_CLASSES: Record<
  ProtectionSignalTone,
  {
    ring: string;
    core: string;
    icon: string;
  }
> = {
  gold: {
    ring: 'border-[rgba(168,140,93,0.26)]',
    core:
      'border-[rgba(168,140,93,0.28)] bg-[linear-gradient(180deg,rgba(234,225,208,0.98),rgba(224,212,191,0.94))] shadow-[0_0_0_1px_rgba(168,140,93,0.08),0_10px_22px_rgba(168,140,93,0.18)]',
    icon: 'text-[var(--lobster-gold-strong)]',
  },
  success: {
    ring: 'border-[rgba(74,107,90,0.24)]',
    core:
      'border-[rgba(74,107,90,0.24)] bg-[linear-gradient(180deg,rgba(232,240,236,0.98),rgba(221,235,227,0.95))] shadow-[0_0_0_1px_rgba(74,107,90,0.08),0_10px_22px_rgba(74,107,90,0.16)]',
    icon: 'text-[var(--state-success)]',
  },
};

export function ProtectionSignal({
  tone = 'gold',
  size = 'sm',
  animated = true,
  icon,
  className,
}: {
  tone?: ProtectionSignalTone;
  size?: ProtectionSignalSize;
  animated?: boolean;
  icon?: ReactNode;
  className?: string;
}) {
  const sizeClasses = SIZE_CLASSES[size];
  const toneClasses = TONE_CLASSES[tone];

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-visible',
        sizeClasses.frame,
        className,
      )}
      aria-hidden="true"
    >
      {animated
        ? sizeClasses.inset.map((insetClassName, index) => (
            <span
              key={insetClassName}
              className={cn(
                'pointer-events-none absolute rounded-full border motion-safe:animate-ping',
                insetClassName,
                toneClasses.ring,
              )}
              style={{
                animationDuration: '2600ms',
                animationDelay: `${index * 420}ms`,
              }}
            />
          ))
        : null}
      <span
        className={cn(
          'relative z-[1] inline-flex items-center justify-center rounded-full border',
          sizeClasses.core,
          toneClasses.core,
        )}
      >
        {icon ?? <Shield className={cn('stroke-[2.1]', sizeClasses.icon, toneClasses.icon)} />}
      </span>
    </span>
  );
}
