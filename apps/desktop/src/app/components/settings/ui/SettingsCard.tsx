import type { ReactNode } from 'react';
import { cn } from '@/app/lib/cn';

interface SettingsCardProps {
  children: ReactNode;
  className?: string;
}

export function SettingsCard({ children, className }: SettingsCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)]',
        className,
      )}
    >
      {children}
    </div>
  );
}
