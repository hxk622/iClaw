import { Monitor, Moon, Sun } from 'lucide-react';
import type { ThemeMode } from '@/app/lib/theme';
import { useSettings } from '@/app/contexts/settings-context';

const options: Array<{ mode: ThemeMode; label: string; note: string; icon: React.ComponentType<{ className?: string }> }> = [
  { mode: 'light', label: '浅色', note: '明亮、轻盈，适合白天使用。', icon: Sun },
  { mode: 'dark', label: '深色', note: '沉浸、克制，也会同步到安装页。', icon: Moon },
  { mode: 'system', label: '跟随系统', note: '自动匹配 macOS 当前外观设置。', icon: Monitor },
];

export function SettingsAppearance() {
  const { settings, updateAppearance } = useSettings();
  const themeMode = settings.appearance.themeMode;

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-8">
        <h1 className="mb-2 text-2xl text-[var(--text-primary)]">风格</h1>
        <p className="text-[var(--text-secondary)]">控制应用整体观感，包含安装页面与主界面。</p>
      </div>

      <div className="space-y-6 rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
        <section>
          <h3 className="mb-3 text-sm text-[var(--text-primary)]">界面风格</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {options.map((item) => {
              const Icon = item.icon;
              const active = themeMode === item.mode;
              return (
                <button
                  key={item.mode}
                  onClick={() => updateAppearance({ themeMode: item.mode })}
                  className={`rounded-[20px] border p-5 text-left transition-all ${
                    active
                      ? 'border-[var(--brand-primary)] bg-[var(--bg-hover)] shadow-[var(--shadow-sm)]'
                      : 'border-[var(--border-default)] bg-[var(--bg-card)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  <div
                    className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${
                      active
                        ? 'bg-[var(--brand-primary)] text-[var(--brand-on-primary)]'
                        : 'bg-[var(--bg-hover)] text-[var(--text-secondary)]'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="text-base text-[var(--text-primary)]">{item.label}</div>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{item.note}</p>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-[var(--text-muted)]">切换会立即预览，保存后作为全局默认值。</p>
        </section>
      </div>
    </div>
  );
}
