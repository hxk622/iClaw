import type { ReactNode } from 'react';
import { Shield } from 'lucide-react';
import { cn } from '@/app/lib/cn';

type ProtectionSignalTone = 'gold' | 'success';
type ProtectionSignalSize = 'xs' | 'sm' | 'md';
type ProtectionSignalEmphasis = 'default' | 'strong';

const SIZE_CLASSES: Record<
  ProtectionSignalSize,
  { frame: string; core: string; icon: string; inset: string[] }
> = {
  xs: {
    frame: 'h-5 w-5',
    core: 'h-3.5 w-3.5',
    icon: 'h-2.25 w-2.25',
    inset: ['inset-[10%]', 'inset-0', '-inset-[14%]'],
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
    halo: string;
    core: string;
    icon: string;
  }
> = {
  gold: {
    ring:
      'border-[rgba(168,140,93,0.26)] bg-[rgba(201,169,97,0.04)] shadow-[0_0_0_1px_rgba(168,140,93,0.03)] dark:border-[rgba(245,205,118,0.58)] dark:bg-[rgba(201,169,97,0.14)] dark:shadow-[0_0_20px_rgba(245,205,118,0.24)]',
    halo:
      'bg-[radial-gradient(circle,rgba(201,169,97,0.22)_0%,rgba(201,169,97,0.08)_42%,transparent_72%)] opacity-70 blur-[4px] dark:bg-[radial-gradient(circle,rgba(245,205,118,0.48)_0%,rgba(201,169,97,0.18)_44%,transparent_76%)] dark:opacity-100 dark:blur-[6px]',
    core:
      'border-[rgba(168,140,93,0.28)] bg-[linear-gradient(180deg,rgba(234,225,208,0.98),rgba(224,212,191,0.94))] shadow-[0_0_0_1px_rgba(168,140,93,0.08),0_10px_22px_rgba(168,140,93,0.18)] dark:border-[rgba(245,205,118,0.34)] dark:bg-[linear-gradient(180deg,rgba(107,78,24,0.98),rgba(64,47,17,0.96))] dark:shadow-[0_0_0_1px_rgba(245,205,118,0.16),0_0_22px_rgba(245,205,118,0.22),0_10px_24px_rgba(0,0,0,0.34)]',
    icon: 'text-[var(--lobster-gold-strong)] dark:text-[#f6d38d]',
  },
  success: {
    ring:
      'border-[rgba(74,107,90,0.24)] bg-[rgba(74,107,90,0.03)] shadow-[0_0_0_1px_rgba(74,107,90,0.03)] dark:border-[rgba(104,201,136,0.42)] dark:bg-[rgba(74,107,90,0.10)] dark:shadow-[0_0_18px_rgba(86,190,122,0.18)]',
    halo:
      'bg-[radial-gradient(circle,rgba(74,107,90,0.18)_0%,rgba(74,107,90,0.05)_42%,transparent_72%)] opacity-65 blur-[4px] dark:bg-[radial-gradient(circle,rgba(104,201,136,0.28)_0%,rgba(74,107,90,0.12)_44%,transparent_76%)] dark:opacity-100 dark:blur-[6px]',
    core:
      'border-[rgba(74,107,90,0.24)] bg-[linear-gradient(180deg,rgba(232,240,236,0.98),rgba(221,235,227,0.95))] shadow-[0_0_0_1px_rgba(74,107,90,0.08),0_10px_22px_rgba(74,107,90,0.16)] dark:border-[rgba(104,201,136,0.28)] dark:bg-[linear-gradient(180deg,rgba(23,74,45,0.98),rgba(16,49,31,0.96))] dark:shadow-[0_0_0_1px_rgba(104,201,136,0.12),0_0_20px_rgba(86,190,122,0.16),0_10px_24px_rgba(0,0,0,0.32)]',
    icon: 'text-[var(--state-success)] dark:text-[#a7efbe]',
  },
};

export function ProtectionSignal({
  tone = 'gold',
  size = 'sm',
  animated = true,
  emphasis = 'default',
  icon,
  className,
}: {
  tone?: ProtectionSignalTone;
  size?: ProtectionSignalSize;
  animated?: boolean;
  emphasis?: ProtectionSignalEmphasis;
  icon?: ReactNode;
  className?: string;
}) {
  const sizeClasses = SIZE_CLASSES[size];
  const toneClasses = TONE_CLASSES[tone];
  const isStrong = emphasis === 'strong';

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
                isStrong && 'opacity-90 saturate-[1.04]',
                insetClassName,
                toneClasses.ring,
              )}
              style={{
                animationDuration: isStrong ? '2400ms' : '2600ms',
                animationDelay: `${index * (isStrong ? 360 : 420)}ms`,
              }}
            />
          ))
        : null}
      <span
        className={cn(
          'pointer-events-none absolute inset-[18%] rounded-full',
          isStrong && 'opacity-100 blur-[5px] scale-[1.08] dark:blur-[7px]',
          toneClasses.halo,
        )}
      />
      <span
        className={cn(
          'relative z-[1] inline-flex items-center justify-center rounded-full border',
          isStrong && 'shadow-[0_0_0_1px_rgba(255,255,255,0.22),0_0_16px_rgba(201,169,97,0.24),0_10px_24px_rgba(168,140,93,0.2)] dark:shadow-[0_0_0_1px_rgba(245,205,118,0.2),0_0_22px_rgba(245,205,118,0.26),0_10px_24px_rgba(0,0,0,0.34)]',
          sizeClasses.core,
          toneClasses.core,
        )}
      >
        {icon ?? <Shield className={cn(isStrong ? 'stroke-[2.45]' : 'stroke-[2.1]', sizeClasses.icon, toneClasses.icon)} />}
      </span>
    </span>
  );
}
