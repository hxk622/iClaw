import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect } from 'react';
import { useSettings } from '@/app/contexts/settings-context';

type ThemeMode = 'light' | 'dark' | 'system';

const options: Array<{ mode: ThemeMode; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { mode: 'light', label: '浅色', icon: Sun },
  { mode: 'dark', label: '深色', icon: Moon },
  { mode: 'system', label: '跟随系统', icon: Monitor },
];

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === 'dark') {
    root.classList.add('dark');
    return;
  }
  if (mode === 'light') {
    root.classList.remove('dark');
    return;
  }
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (prefersDark) root.classList.add('dark');
  else root.classList.remove('dark');
}

export function SettingsGeneral() {
  const { settings, updateGeneral } = useSettings();
  const themeMode = settings.general.themeMode;

  useEffect(() => {
    applyTheme(themeMode);
    localStorage.setItem('iclaw-theme-mode', themeMode);
  }, [themeMode]);

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-8">
        <h1 className="mb-2 text-2xl text-[var(--text-primary)]">通用</h1>
        <p className="text-[var(--text-secondary)]">管理主题和全局偏好。</p>
      </div>

      <div className="space-y-8 rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
        <section>
          <h3 className="mb-3 text-sm text-[var(--text-primary)]">主题模式</h3>
          <div className="grid grid-cols-3 gap-3">
            {options.map((item) => {
              const Icon = item.icon;
              const active = themeMode === item.mode;
              return (
                <button
                  key={item.mode}
                  onClick={() => updateGeneral({ themeMode: item.mode })}
                  className={`rounded-lg border p-4 transition-all ${
                    active
                      ? 'border-[var(--brand-primary)] bg-[var(--bg-hover)]'
                      : 'border-[var(--border-default)] bg-[var(--bg-card)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  <div
                    className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full ${
                      active
                        ? 'bg-[var(--brand-primary)] text-[var(--brand-on-primary)]'
                        : 'bg-[var(--bg-hover)] text-[var(--text-secondary)]'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-sm text-[var(--text-primary)]">{item.label}</p>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-[var(--text-muted)]">切换后立即生效。</p>
        </section>

        <section>
          <h3 className="mb-3 text-sm text-[var(--text-primary)]">语言</h3>
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-hover)] p-4 text-sm text-[var(--text-secondary)]">
            简体中文（即将支持多语言）
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm text-[var(--text-primary)]">启动行为</h3>
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-hover)] p-4 text-sm text-[var(--text-secondary)]">
            即将支持
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm text-[var(--text-primary)]">更新策略</h3>
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-hover)] p-4 text-sm text-[var(--text-secondary)]">
            即将支持
          </div>
        </section>
      </div>
    </div>
  );
}
