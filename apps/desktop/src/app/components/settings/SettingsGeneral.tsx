import { RefreshCw } from 'lucide-react';
import { useSettings } from '@/app/contexts/settings-context';
import { Button } from '@/app/components/ui/Button';

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
