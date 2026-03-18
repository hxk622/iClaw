import { RefreshCw } from 'lucide-react';
import { useSettings } from '@/app/contexts/settings-context';
import { Button } from '@/app/components/ui/Button';
import { FormRow } from '@/app/components/settings/ui/FormRow';
import type { ThemeMode } from '@/app/lib/theme';

const themeOptions: Array<{ value: ThemeMode; label: string; note: string }> = [
  { value: 'light', label: '浅色', note: '明亮直接，适合白天与强光环境。' },
  { value: 'dark', label: '深色', note: '信息密度更稳，夜间阅读更克制。' },
  { value: 'system', label: '跟随系统', note: '自动继承 macOS 当前外观。' },
];

interface SettingsGeneralProps {
  currentVersion: string;
  latestVersion: string | null;
  mandatory: boolean;
  checkingForUpdates: boolean;
  readyToRestart: boolean;
  statusMessage: string | null;
  onCheckForUpdates: () => void;
  onRestartToApply: () => void;
}

export function SettingsGeneral({
  currentVersion,
  latestVersion,
  mandatory,
  checkingForUpdates,
  readyToRestart,
  statusMessage,
  onCheckForUpdates,
  onRestartToApply,
}: SettingsGeneralProps) {
  const { settings, updateGeneral } = useSettings();
  const themeMode = settings.general.themeMode;
  const workspaceFiles = [
    { label: '身份设置', file: 'IDENTITY.md' },
    { label: '用户画像', file: 'USER.md' },
    { label: '人格配置', file: 'SOUL.md' },
  ];

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-8">
        <h1 className="mb-2 text-2xl text-[var(--text-primary)]">通用</h1>
        <p className="text-[var(--text-secondary)]">集中管理桌面端的外观、工作区映射与版本更新能力。</p>
      </div>

      <div className="space-y-8 rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
        <section>
          <h3 className="mb-4 text-sm text-[var(--text-primary)]">界面风格</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {themeOptions.map((item) => {
              const active = themeMode === item.value;
              return (
                <button
                  key={item.value}
                  onClick={() => updateGeneral({ themeMode: item.value })}
                  className={`rounded-[20px] border p-5 text-left transition-all ${
                    active
                      ? 'border-[var(--brand-primary)] bg-[var(--bg-hover)] shadow-[var(--shadow-sm)]'
                      : 'border-[var(--border-default)] bg-[var(--bg-card)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  <div className="text-base text-[var(--text-primary)]">{item.label}</div>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{item.note}</p>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-[var(--text-muted)]">切换会立即预览，保存后写入本地默认设置。</p>
        </section>

        <section>
          <h3 className="mb-4 text-sm text-[var(--text-primary)]">工作区文件</h3>
          <div className="space-y-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-hover)] p-4">
            <FormRow label="工作区目录">
              <input value={settings.workspaceDir || '当前未连接到本地工作区'} readOnly />
            </FormRow>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {workspaceFiles.map((item) => (
                <div
                  key={item.file}
                  className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-3"
                >
                  <div className="text-sm text-[var(--text-primary)]">{item.label}</div>
                  <div className="mt-1 font-mono text-xs text-[var(--text-secondary)]">{item.file}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              这三份 Markdown 文件与设置页双向同步，保存后会直接回写本地工作区。
            </p>
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm text-[var(--text-primary)]">更新策略</h3>
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-hover)] p-4 text-sm text-[var(--text-secondary)]">
            <div className="flex flex-col gap-4">
              <div className="space-y-1">
                <div>当前版本：{currentVersion}</div>
                <div>最新版本：{latestVersion || '暂未发现更新'}</div>
                <div>更新策略：{mandatory ? '强制更新' : '常规提醒'}</div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  onClick={onCheckForUpdates}
                  variant="secondary"
                  size="sm"
                  className="rounded-lg text-sm"
                  disabled={checkingForUpdates}
                >
                  {checkingForUpdates ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                  {checkingForUpdates ? '检查中...' : '检查更新'}
                </Button>
                {readyToRestart ? (
                  <Button onClick={onRestartToApply} variant="primary" size="sm" className="rounded-lg text-sm">
                    重启应用
                  </Button>
                ) : null}
              </div>
              {statusMessage ? <div className="text-xs text-[var(--text-secondary)]">{statusMessage}</div> : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
