import { type ComponentType, useMemo, useState } from 'react';
import {
  LayoutGrid,
  MessageSquare,
  Shield,
  Sparkles,
  User,
  UserCircle,
  ChevronLeft,
  X,
  Settings2,
} from 'lucide-react';
import { useSettings } from '@/app/contexts/settings-context';
import { SettingsOverview, type SettingsSection } from '@/app/components/settings/SettingsOverview';
import { SettingsGeneral } from '@/app/components/settings/SettingsGeneral';
import { Identity } from '@/app/components/settings/Identity';
import { UserProfile } from '@/app/components/settings/UserProfile';
import { SoulPersona } from '@/app/components/settings/SoulPersona';
import { ChannelPreference } from '@/app/components/settings/ChannelPreference';
import { SafetyDefaults } from '@/app/components/settings/SafetyDefaults';

interface SettingsPanelProps {
  onClose: () => void;
  onSave: () => Promise<void>;
}

const navItems: Array<{ key: SettingsSection; label: string; icon: ComponentType<{ className?: string }> }> = [
  { key: 'overview', label: '概览', icon: LayoutGrid },
  { key: 'general', label: '通用', icon: Settings2 },
  { key: 'identity', label: '身份设置', icon: UserCircle },
  { key: 'user-profile', label: '用户资料', icon: User },
  { key: 'soul-persona', label: '人格配置', icon: Sparkles },
  { key: 'channel-preference', label: '渠道偏好', icon: MessageSquare },
  { key: 'safety-defaults', label: '安全策略', icon: Shield },
];

export function SettingsPanel({ onClose, onSave }: SettingsPanelProps) {
  const { settings, resetSettings } = useSettings();
  const [activeSection, setActiveSection] = useState<SettingsSection>('overview');
  const [saving, setSaving] = useState(false);

  const content = useMemo(() => {
    switch (activeSection) {
      case 'general':
        return <SettingsGeneral />;
      case 'identity':
        return <Identity />;
      case 'user-profile':
        return <UserProfile />;
      case 'soul-persona':
        return <SoulPersona />;
      case 'channel-preference':
        return <ChannelPreference />;
      case 'safety-defaults':
        return <SafetyDefaults />;
      default:
        return <SettingsOverview onNavigate={setActiveSection} />;
    }
  }, [activeSection]);

  return (
    <div className="flex h-screen bg-white dark:bg-zinc-950">
      <aside className="flex w-[220px] flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
          <h1 className="text-lg text-zinc-900 dark:text-zinc-100">iClaw 设置</h1>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.key === activeSection;
            return (
              <button
                key={item.key}
                onClick={() => setActiveSection(item.key)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100'
                    : 'text-zinc-600 hover:bg-white/80 dark:text-zinc-300 dark:hover:bg-zinc-800/70'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <ChevronLeft className="h-4 w-4" />
            返回
          </button>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <main className="flex-1 overflow-y-auto">{content}</main>

        <div className="border-t border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between">
            <div className="text-sm text-zinc-500 dark:text-zinc-400">
              {settings.hasUnsavedChanges ? '有未保存更改' : '所有更改已保存'}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={resetSettings}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                重置
              </button>
              <button
                onClick={async () => {
                  setSaving(true);
                  try {
                    await onSave();
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={!settings.hasUnsavedChanges || saving}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
