import type { ReactNode } from 'react';
import { Chip } from '@/app/components/ui/Chip';

type SettingsBadgeTone = 'gold' | 'green' | 'red' | 'blue';

interface SettingsBadgeProps {
  tone?: SettingsBadgeTone;
  children: ReactNode;
  className?: string;
}

const toneMap: Record<SettingsBadgeTone, 'accent' | 'success' | 'danger' | 'brand'> = {
  gold: 'accent',
  green: 'success',
  red: 'danger',
  blue: 'brand',
};

export function SettingsBadge({ tone = 'gold', children, className }: SettingsBadgeProps) {
  return (
    <Chip tone={toneMap[tone]} className={className}>
      {children}
    </Chip>
  );
}
