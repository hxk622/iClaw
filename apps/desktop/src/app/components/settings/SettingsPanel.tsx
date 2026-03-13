import { type ComponentType, useEffect, useMemo, useState } from 'react';
import {
  MessageSquare,
  Palette,
  Shield,
  Sparkles,
  User,
  UserCircle,
  ChevronLeft,
  X,
  Settings2,
} from 'lucide-react';
import { type PersistableSettingsSection, useSettings } from '@/app/contexts/settings-context';
import { SettingsAppearance } from '@/app/components/settings/SettingsAppearance';
import { SettingsGeneral } from '@/app/components/settings/SettingsGeneral';
import { Identity } from '@/app/components/settings/Identity';
import { UserProfile } from '@/app/components/settings/UserProfile';
import { SoulPersona } from '@/app/components/settings/SoulPersona';
import { ChannelPreference } from '@/app/components/settings/ChannelPreference';
import { SafetyDefaults } from '@/app/components/settings/SafetyDefaults';

interface SettingsPanelProps {
  onClose: () => void;
  onSave: (section: PersistableSettingsSection) => Promise<void>;
}

const navItems: Array<{ key: PersistableSettingsSection; label: string; icon: ComponentType<{ className?: string }> }> = [
  { key: 'appearance', label: '风格', icon: Palette },
  { key: 'general', label: '通用', icon: Settings2 },
  { key: 'identity', label: '身份设置', icon: UserCircle },
  { key: 'user-profile', label: '用户资料', icon: User },
  { key: 'soul-persona', label: '人格配置', icon: Sparkles },
  { key: 'channel-preference', label: '渠道偏好', icon: MessageSquare },
  { key: 'safety-defaults', label: '安全策略', icon: Shield },
];

export function SettingsPanel({ onClose, onSave }: SettingsPanelProps) {
  const { hasUnsavedChangesForSection, resetSettings } = useSettings();
  const [activeSection, setActiveSection] = useState<PersistableSettingsSection>('general');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const hasUnsavedChanges = hasUnsavedChangesForSection(activeSection);
  const isSaving = saveState === 'saving';
  const canSave = hasUnsavedChanges && !isSaving;

  const content = useMemo(() => {
    switch (activeSection) {
      case 'appearance':
        return <SettingsAppearance />;
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
        return <SettingsGeneral />;
    }
  }, [activeSection]);

  useEffect(() => {
    setSaveState('idle');
    setSaveMessage(null);
  }, [activeSection]);

  const handleSave = async () => {
    setSaveState('saving');
    setSaveMessage(null);
    try {
      await onSave(activeSection);
      setSaveState('saved');
      setSaveMessage('当前页面更改已保存');
      window.setTimeout(() => {
        setSaveState((current) => (current === 'saved' ? 'idle' : current));
        setSaveMessage((current) => (current === '当前页面更改已保存' ? null : current));
      }, 1500);
    } catch (error) {
      setSaveState('error');
      setSaveMessage(error instanceof Error ? error.message : '保存失败，请稍后重试');
    }
  };

  const handleReset = () => {
    resetSettings(activeSection);
    setSaveState('idle');
    setSaveMessage(null);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(28,24,16,0.24)] px-5 py-5 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="flex h-full max-h-[920px] w-full max-w-7xl overflow-hidden rounded-[32px] border border-[var(--border-default)] bg-[var(--bg-page)] shadow-[0_28px_90px_rgba(42,31,10,0.18)]"
        onClick={(event) => event.stopPropagation()}
      >
      <aside className="flex w-56 flex-col border-r border-[var(--border-default)] bg-[var(--bg-card)]">
        <div className="border-b border-[var(--border-default)] p-4">
          <h1 className="text-lg text-[var(--text-primary)]">iClaw 设置</h1>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.key === activeSection;
            return (
              <button
                key={item.key}
                onClick={() => setActiveSection(item.key)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all ${
                  active
                    ? 'bg-[var(--brand-primary)] text-[var(--brand-on-primary)]'
                    : 'text-[var(--text-primary)] hover:translate-x-[2px] hover:bg-[var(--bg-hover)]'
                }`}
                style={{ transitionTimingFunction: 'var(--motion-spring)' }}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border-default)] px-6 py-3">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <ChevronLeft className="h-4 w-4" />
            返回
          </button>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <main className="flex-1 overflow-y-auto">{content}</main>

        <div className="border-t border-[var(--border-default)] bg-[var(--bg-card)] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-[var(--text-secondary)]">
              {saveState === 'saved'
                ? '当前页面已保存'
                : saveState === 'error'
                  ? '保存失败，请重试'
                  : hasUnsavedChanges
                    ? '当前页面有未保存更改'
                    : '当前页面无未保存更改'}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleReset}
                disabled={!hasUnsavedChanges || isSaving}
                className="rounded-lg border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:border-[color:rgba(148,163,184,0.35)] disabled:bg-[color:rgba(148,163,184,0.08)] disabled:text-[color:rgba(100,116,139,0.72)] disabled:hover:bg-[color:rgba(148,163,184,0.08)]"
              >
                重置
              </button>
              <button
                onClick={handleSave}
                disabled={!canSave}
                className="rounded-lg px-4 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:border disabled:border-[color:rgba(148,163,184,0.3)] disabled:bg-[color:rgba(148,163,184,0.12)] disabled:text-[color:rgba(100,116,139,0.78)]"
                style={
                  canSave
                    ? {
                        backgroundColor: 'var(--brand-primary)',
                        color: 'var(--brand-on-primary)',
                      }
                    : undefined
                }
              >
                {isSaving ? '保存中...' : saveState === 'saved' ? '已保存' : '保存'}
              </button>
            </div>
          </div>
          {saveMessage && (
            <p
              className={`mt-2 text-xs ${
                saveState === 'error' ? 'text-[var(--state-error)]' : 'text-[var(--state-info)]'
              }`}
            >
              {saveMessage}
            </p>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
