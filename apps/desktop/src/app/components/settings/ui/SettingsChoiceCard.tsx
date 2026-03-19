import type { ComponentType } from 'react';
import { SelectionCard } from '@/app/components/ui/SelectionCard';
import { cn } from '@/app/lib/cn';
import { SettingsBadge } from './SettingsBadge';

interface SettingsChoiceCardProps {
  title: string;
  description: string;
  icon?: ComponentType<{ className?: string }>;
  active?: boolean;
  badge?: string;
  badgeTone?: 'gold' | 'green' | 'red' | 'blue';
  align?: 'center' | 'left';
  onClick: () => void;
}

export function SettingsChoiceCard({
  title,
  description,
  icon: Icon,
  active = false,
  badge,
  badgeTone = 'gold',
  align = 'center',
  onClick,
}: SettingsChoiceCardProps) {
  return (
    <SelectionCard
      as="button"
      onClick={onClick}
      selected={active}
      className={cn(
        'w-full bg-[var(--bg-card)] p-5',
        align === 'center' && 'flex flex-col items-center text-center',
      )}
    >
      {Icon ? (
        <div
          className={cn(
            'mb-3 flex h-12 w-12 items-center justify-center rounded-[14px]',
            active ? 'bg-[var(--bg-hover)] text-[var(--brand-primary)]' : 'bg-[var(--bg-hover)] text-[var(--text-secondary)]',
          )}
        >
          <Icon className="h-6 w-6" />
        </div>
      ) : null}
      <div className="text-sm font-medium text-[var(--text-primary)]">{title}</div>
      <div className="mt-1 text-xs leading-6 text-[var(--text-secondary)]">{description}</div>
      {badge ? (
        <div className={cn('mt-3', align === 'center' ? '' : 'self-start')}>
          <SettingsBadge tone={badgeTone}>{badge}</SettingsBadge>
        </div>
      ) : null}
    </SelectionCard>
  );
}
