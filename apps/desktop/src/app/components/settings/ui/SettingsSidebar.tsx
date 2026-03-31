import { cn } from '@/app/lib/cn';
import { INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE } from '@/app/lib/ui-interactions';
import type { PersistableSettingsSection } from '@/app/contexts/settings-context';

const navigationItems: Array<{
  key: PersistableSettingsSection;
  label: string;
  sublabel?: string;
}> = [
  { key: 'general', label: '通用' },
  { key: 'identity', label: '身份设置', sublabel: 'Identity.md' },
  { key: 'user-profile', label: '用户画像', sublabel: 'User.md' },
  { key: 'soul-persona', label: '人格配置', sublabel: 'Soul.md' },
  { key: 'safety-defaults', label: '安全策略' },
];

interface SettingsSidebarProps {
  activeSection: PersistableSettingsSection;
  onSelect: (section: PersistableSettingsSection) => void;
}

export function SettingsSidebar({ activeSection, onSelect }: SettingsSidebarProps) {
  return (
    <aside className="flex w-[240px] flex-col border-r border-[var(--border-default)] bg-[color:color-mix(in_srgb,var(--bg-hover)_38%,transparent)] p-6">
      <div className="mb-8">
        <h2 className="text-[17px] font-semibold tracking-tight text-[var(--text-primary)]">iClaw 设置</h2>
      </div>

      <nav className="space-y-1">
        {navigationItems.map((item) => {
          const active = item.key === activeSection;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              className={cn(
                'w-full rounded-lg border px-3 py-3 text-left text-[14px] transition-colors cursor-pointer',
                SPRING_PRESSABLE,
                INTERACTIVE_FOCUS_RING,
                active
                  ? 'border-[color:color-mix(in_srgb,var(--brand-primary)_40%,var(--border-default))] bg-[var(--bg-card)] text-[var(--brand-primary)] shadow-[0_2px_10px_rgba(0,0,0,0.06)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-card)]/65 hover:text-[var(--text-primary)]',
              )}
            >
              <div className={cn('text-[14px] font-medium', active ? 'text-[var(--brand-primary)]' : 'text-[var(--text-primary)]')}>
                {item.label}
              </div>
              {item.sublabel ? (
                <div className="mt-1 text-[12px] text-[var(--text-secondary)]">{item.sublabel}</div>
              ) : null}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
