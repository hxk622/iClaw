import { ChevronDown } from 'lucide-react';
import { cn } from '@/app/lib/cn';
import { INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE } from '@/app/lib/ui-interactions';

export function CompactDisclosure({
  title,
  summary,
  open,
  onToggle,
  className,
}: {
  title: string;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'flex w-full cursor-pointer items-center justify-between gap-3 rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-left',
        SPRING_PRESSABLE,
        INTERACTIVE_FOCUS_RING,
        className,
      )}
    >
      <div className="min-w-0">
        <div className="text-[12px] font-medium text-[var(--text-primary)]">{title}</div>
        {summary ? <div className="mt-0.5 text-[11px] text-[var(--text-secondary)]">{summary}</div> : null}
      </div>
      <ChevronDown
        className={cn(
          'h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform duration-200',
          open && 'rotate-180',
        )}
      />
    </button>
  );
}
