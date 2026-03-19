import type { ComponentType, ReactNode } from 'react';
import { SelectionCard } from '@/app/components/ui/SelectionCard';
import { cn } from '@/app/lib/cn';
import { SettingsBadge } from './SettingsBadge';

interface SettingsChoiceCardProps {
  title: string;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
  illustration?: ReactNode;
  active?: boolean;
  badge?: string;
  badgeTone?: 'gold' | 'green' | 'red' | 'blue';
  align?: 'center' | 'left';
  className?: string;
  iconWrapperClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  selectedIndicator?: ReactNode;
  onClick: () => void;
}

export function SettingsChoiceCard({
  title,
  description,
  icon: Icon,
  illustration,
  active = false,
  badge,
  badgeTone = 'gold',
  align = 'center',
  className,
  iconWrapperClassName,
  titleClassName,
  descriptionClassName,
  selectedIndicator,
  onClick,
}: SettingsChoiceCardProps) {
  return (
    <SelectionCard
      as="button"
      onClick={onClick}
      selected={active}
      className={cn(
        'relative w-full bg-[var(--bg-card)] p-5',
        align === 'center' && 'flex flex-col items-center text-center',
        className,
      )}
    >
      {selectedIndicator && active ? (
        <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--chip-brand-bg)] text-[var(--chip-brand-text)]">
          {selectedIndicator}
        </div>
      ) : null}
      {illustration ? (
        <div
          className={cn(
            'mb-3 flex h-12 w-12 items-center justify-center rounded-[14px] bg-[var(--bg-hover)] text-[var(--text-secondary)]',
            active && 'text-[var(--brand-primary)]',
            iconWrapperClassName,
          )}
        >
          {illustration}
        </div>
      ) : null}
      {Icon ? (
        <div
          className={cn(
            'mb-3 flex h-12 w-12 items-center justify-center rounded-[14px] bg-[var(--bg-hover)] text-[var(--text-secondary)]',
            active && 'bg-[var(--bg-hover)] text-[var(--brand-primary)]',
            iconWrapperClassName,
          )}
        >
          <Icon className="h-6 w-6" />
        </div>
      ) : null}
      <div className={cn('text-sm font-medium text-[var(--text-primary)]', titleClassName)}>{title}</div>
      {description ? (
        <div className={cn('mt-1 text-xs leading-6 text-[var(--text-secondary)]', descriptionClassName)}>{description}</div>
      ) : null}
      {badge ? (
        <div className={cn('mt-3', align === 'center' ? '' : 'self-start')}>
          <SettingsBadge tone={badgeTone}>{badge}</SettingsBadge>
        </div>
      ) : null}
    </SelectionCard>
  );
}
