import { cn } from '@/app/lib/cn';
import { APPLE_FLAT_SURFACE, INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE } from '@/app/lib/ui-interactions';
import { Chip } from '@/app/components/ui/Chip';
import type { LobsterStoreTab } from '@/app/lib/lobster-store';

export function LobsterStoreTabs({
  storeLabel,
  activeTab,
  installedCount,
  onChange,
}: {
  storeLabel: string;
  activeTab: LobsterStoreTab;
  installedCount: number;
  onChange: (tab: LobsterStoreTab) => void;
}) {
  const tabs: Array<{ id: LobsterStoreTab; label: string; badge?: number }> = [
    { id: 'shop', label: storeLabel },
    { id: 'my-lobster', label: '我的龙虾', badge: installedCount },
  ];

  return (
    <div className="flex items-center gap-2 border-b border-[var(--lobster-border)] pb-3">
      {tabs.map((tab) => {
        const active = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-[14px] border px-3.5 py-2 text-[14px] font-medium transition-all',
              SPRING_PRESSABLE,
              INTERACTIVE_FOCUS_RING,
              APPLE_FLAT_SURFACE,
              active
                ? 'border-[var(--lobster-gold-border)] bg-[var(--lobster-gold-soft)] text-[var(--lobster-gold-strong)] shadow-[0_12px_24px_rgba(168,140,93,0.12)] dark:border-[rgba(194,170,130,0.22)] dark:bg-[rgba(180,154,112,0.14)] dark:text-[#ddc79f] dark:shadow-[0_10px_20px_rgba(0,0,0,0.18)]'
                : 'border-transparent bg-transparent text-[var(--lobster-text-secondary)] hover:border-[var(--lobster-border)] hover:bg-[var(--lobster-surface-hover)] hover:text-[var(--lobster-text-primary)] dark:hover:border-[rgba(194,170,130,0.14)] dark:hover:bg-[rgba(255,255,255,0.03)]',
            )}
          >
            <span>{tab.label}</span>
            {typeof tab.badge === 'number' ? (
              <Chip
                tone={active ? 'accent' : 'outline'}
                className="px-2 py-0.5 text-[11px] leading-none shadow-none"
              >
                {tab.badge}
              </Chip>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
