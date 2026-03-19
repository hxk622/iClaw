import type { ReactNode } from 'react';
import { DrawerSection } from '@/app/components/ui/DrawerSection';
import { cn } from '@/app/lib/cn';

interface SettingsCardProps {
  children: ReactNode;
  className?: string;
}

export function SettingsCard({ children, className }: SettingsCardProps) {
  return (
    <DrawerSection
      className={cn(
        'bg-[var(--bg-card)]',
        className,
      )}
    >
      {children}
    </DrawerSection>
  );
}
