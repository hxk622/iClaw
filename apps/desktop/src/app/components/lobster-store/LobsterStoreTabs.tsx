import { cn } from '@/app/lib/cn';
import { INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE } from '@/app/lib/ui-interactions';
import type { LobsterStoreTab } from '@/app/lib/lobster-store';

export function LobsterStoreTabs({
  activeTab,
  installedCount,
  onChange,
}: {
  activeTab: LobsterStoreTab;
  installedCount: number;
  onChange: (tab: LobsterStoreTab) => void;
}) {
  const tabs: Array<{ id: LobsterStoreTab; label: string; badge?: number }> = [
    { id: 'shop', label: '龙虾商店' },
    { id: 'my-lobster', label: '我的龙虾', badge: installedCount },
  ];

  return (
    <div className="inline-flex rounded-[18px] border border-[var(--lobster-border)] bg-[var(--lobster-muted-bg)] p-1.5">
      {tabs.map((tab) => {
        const active = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative inline-flex min-h-[44px] items-center gap-2 rounded-[14px] px-4 py-2 text-[14px] font-medium transition-all',
              SPRING_PRESSABLE,
              INTERACTIVE_FOCUS_RING,
              active
                ? 'bg-[var(--lobster-card-bg)] text-[var(--lobster-gold-strong)] shadow-[var(--lobster-shadow-tab)]'
                : 'text-[var(--lobster-text-secondary)] hover:text-[var(--lobster-text-primary)]',
            )}
          >
            <span>{tab.label}</span>
            {typeof tab.badge === 'number' ? (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px]',
                  active
                    ? 'bg-[var(--lobster-gold-soft)] text-[var(--lobster-gold-strong)]'
                    : 'bg-[var(--lobster-card-bg)] text-[var(--lobster-text-muted)]',
                )}
              >
                {tab.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
