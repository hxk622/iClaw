import type { ReactNode } from 'react';

import { cn } from '@/app/lib/cn';

type LobsterBadgeTone = 'featured' | 'installed' | 'category';

const TONE_CLASS_NAMES: Record<LobsterBadgeTone, string> = {
  featured:
    'border-[var(--lobster-gold-border)] bg-[var(--lobster-gold-soft)] text-[var(--lobster-gold-strong)]',
  installed:
    'border-[var(--lobster-success-border)] bg-[var(--lobster-success-soft)] text-[var(--lobster-success-text)]',
  category:
    'border-[var(--lobster-border)] bg-[var(--lobster-muted-bg)] text-[var(--lobster-text-secondary)]',
};

export function LobsterBadge({
  tone,
  children,
  className,
}: {
  tone: LobsterBadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium',
        TONE_CLASS_NAMES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
