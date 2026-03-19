import type { ComponentType } from 'react';
import { Brain, Settings, Shield, User, Users } from 'lucide-react';
import { cn } from '@/app/lib/cn';
import { INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE } from '@/app/lib/ui-interactions';
import type { PersistableSettingsSection } from '@/app/contexts/settings-context';

const navigationItems: Array<{
  key: PersistableSettingsSection;
  label: string;
  sublabel?: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { key: 'general', label: '通用', icon: Settings },
  { key: 'identity', label: '身份设置', sublabel: 'Identity.md', icon: User },
  { key: 'user-profile', label: '用户画像', sublabel: 'User.md', icon: Users },
  { key: 'soul-persona', label: '人格配置', sublabel: 'Soul.md', icon: Brain },
  { key: 'safety-defaults', label: '安全策略', icon: Shield },
];

interface SettingsSidebarProps {
  activeSection: PersistableSettingsSection;
  onSelect: (section: PersistableSettingsSection) => void;
}

export function SettingsSidebar({ activeSection, onSelect }: SettingsSidebarProps) {
  return (
    <aside className="flex w-64 flex-col border-r border-[var(--border-default)] bg-[color:color-mix(in_srgb,var(--bg-card)_82%,var(--bg-page))]">
      <div className="border-b border-[var(--border-default)] px-6 py-7">
        <h2 className="text-lg font-medium tracking-tight text-[var(--text-primary)]">iClaw 设置</h2>
      </div>

      <nav className="flex-1 space-y-1.5 px-4 py-5">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const active = item.key === activeSection;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              className={cn(
                'relative w-full rounded-[16px] px-3 py-2.5 text-left cursor-pointer',
                SPRING_PRESSABLE,
                INTERACTIVE_FOCUS_RING,
                active ? 'bg-[var(--bg-card)] shadow-[var(--pressable-card-rest-shadow)]' : 'hover:bg-[rgba(255,255,255,0.45)]',
              )}
            >
              <div
                className={cn(
                  'absolute inset-0 rounded-[16px] border',
                  active ? 'border-[var(--brand-primary)]' : 'border-transparent',
                )}
              />
              <div className="relative flex items-center gap-3">
                <Icon className={cn('h-4 w-4 flex-shrink-0', active ? 'text-[var(--brand-primary)]' : 'text-[var(--text-secondary)]')} />
                <div className="min-w-0 flex-1">
                  <div className={cn('text-sm font-medium', active ? 'text-[var(--brand-primary)]' : 'text-[var(--text-primary)]')}>
                    {item.label}
                  </div>
                  {item.sublabel ? <div className="mt-0.5 text-xs text-[var(--text-muted)]">{item.sublabel}</div> : null}
                </div>
              </div>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
