import type { ReactNode } from 'react';
import { PressableCard } from '@/app/components/ui/PressableCard';
import { cn } from '@/app/lib/cn';

interface SettingsCardProps {
  children: ReactNode;
  className?: string;
}

export function SettingsCard({ children, className }: SettingsCardProps) {
  return (
    <PressableCard
      className={cn(
        'rounded-[20px] border-[var(--border-default)] bg-[var(--bg-card)] p-6 shadow-[0_1px_3px_rgba(15,23,42,0.05)]',
        className,
      )}
    >
      {children}
    </PressableCard>
  );
}
