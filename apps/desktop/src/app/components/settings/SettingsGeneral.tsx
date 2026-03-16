import { useSettings } from '@/app/contexts/settings-context';

export function SettingsGeneral() {
  const { settings } = useSettings();

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-8">
        <h1 className="mb-2 text-2xl text-[var(--text-primary)]">通用</h1>
        <p className="text-[var(--text-secondary)]">管理主题和全局偏好。</p>
      </div>

      <div className="space-y-8 rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
        <section>
          <h3 className="mb-3 text-sm text-[var(--text-primary)]">语言</h3>
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-hover)] p-4 text-sm text-[var(--text-secondary)]">
            {settings.general.language}（即将支持多语言）
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
