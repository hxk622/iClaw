import { FileText, Monitor, Moon, RefreshCw, Sun } from 'lucide-react';
import { useSettings } from '@/app/contexts/settings-context';
import { Button } from '@/app/components/ui/Button';
import { SettingsBadge } from '@/app/components/settings/ui/SettingsBadge';
import { SettingsCard } from '@/app/components/settings/ui/SettingsCard';
import { SettingsChoiceCard } from '@/app/components/settings/ui/SettingsChoiceCard';
import { SettingsPageHeader } from '@/app/components/settings/ui/SettingsPageHeader';
import { SettingsSectionHeader } from '@/app/components/settings/ui/SettingsSectionHeader';
import { SettingsSegmentedControl } from '@/app/components/settings/ui/SettingsSegmentedControl';
import type { ThemeMode } from '@/app/lib/theme';

const themeOptions: Array<{
  value: ThemeMode;
  label: string;
  description: string;
  icon: typeof Sun;
}> = [
  { value: 'light', label: '浅色', description: '明亮清晰的界面风格', icon: Sun },
  { value: 'dark', label: '深色', description: '护眼的暗色主题', icon: Moon },
  { value: 'system', label: '跟随系统', description: '自动适配系统主题', icon: Monitor },
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
  const needsUpdate = Boolean(latestVersion && latestVersion !== currentVersion);
  const workspaceRoot = settings.workspaceDir || '~/Documents/iClaw/workspace';

  return (
    <div className="max-w-4xl space-y-8">
      <SettingsPageHeader
        title="通用设置"
        description="配置界面主题、工作区文件和应用更新策略"
      />

      <section className="space-y-4">
        <SettingsSectionHeader title="界面风格" description="选择您偏好的主题样式" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {themeOptions.map((option) => (
            <SettingsChoiceCard
              key={option.value}
              title={option.label}
              description={option.description}
              icon={option.icon}
              active={settings.general.themeMode === option.value}
              badge={settings.general.themeMode === option.value ? '当前选中' : undefined}
              badgeTone="gold"
              onClick={() => updateGeneral({ themeMode: option.value })}
            />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <SettingsSectionHeader title="工作区文件" description="设置页与本地工作区双向同步" />
        <SettingsCard>
          <div className="space-y-4">
            <div className="flex items-start gap-3 border-b border-[var(--border-default)] pb-4">
              <FileText className="mt-0.5 h-5 w-5 flex-shrink-0 text-[var(--text-secondary)]" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-[var(--text-primary)]">当前工作区</div>
                <div className="mt-1 break-all font-mono text-sm text-[var(--text-secondary)]">{workspaceRoot}</div>
              </div>
            </div>

            <div className="space-y-3">
              {[
                { name: 'Identity.md', description: '助手身份定义' },
                { name: 'User.md', description: '用户画像配置' },
                { name: 'Soul.md', description: '人格与风格' },
              ].map((file) => (
                <div key={file.name} className="flex items-center justify-between gap-4 py-2">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-[var(--text-primary)]">{file.name}</div>
                    <div className="text-xs text-[var(--text-secondary)]">{file.description}</div>
                  </div>
                  <SettingsBadge tone="blue">本地文件</SettingsBadge>
                </div>
              ))}
            </div>

            <div className="border-t border-[var(--border-default)] pt-3">
              <p className="text-xs text-[var(--text-secondary)]">保存后将直接覆盖本地工作区文件</p>
            </div>
          </div>
        </SettingsCard>
      </section>

      <section className="space-y-4">
        <SettingsSectionHeader title="桌面更新" description="管理应用版本和更新策略" />
        <SettingsCard>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="mb-1 text-sm text-[var(--text-secondary)]">当前版本</div>
                <div className="text-base font-medium text-[var(--text-primary)]">{currentVersion}</div>
              </div>
              <div>
                <div className="mb-1 text-sm text-[var(--text-secondary)]">最新版本</div>
                <div className="flex items-center gap-2 text-base font-medium text-[var(--text-primary)]">
                  {latestVersion || '暂未发现更新'}
                  {needsUpdate ? <SettingsBadge tone="gold">可更新</SettingsBadge> : null}
                </div>
              </div>
            </div>

            <div className="border-t border-[var(--border-default)] pt-4">
              <div className="mb-3 text-sm font-medium text-[var(--text-primary)]">更新策略</div>
              <SettingsSegmentedControl
                value={settings.general.updateStrategy}
                options={[
                  { value: 'notify', label: '常规提醒' },
                  { value: 'force', label: '强制更新' },
                ]}
                onChange={(value) => updateGeneral({ updateStrategy: value })}
              />
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-[var(--border-default)] pt-4">
              <Button
                variant="secondary"
                size="sm"
                leadingIcon={<RefreshCw className={checkingForUpdates ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />}
                onClick={onCheckForUpdates}
                disabled={checkingForUpdates}
              >
                {checkingForUpdates ? '检查中...' : '检查更新'}
              </Button>

              {needsUpdate || readyToRestart ? (
                <Button variant="primary" size="sm" onClick={onRestartToApply}>
                  重启应用
                </Button>
              ) : null}
            </div>

            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <span>服务器策略：{mandatory ? '强制更新' : '常规提醒'}</span>
              {statusMessage ? <span>{statusMessage}</span> : null}
            </div>
          </div>
        </SettingsCard>
      </section>
    </div>
  );
}
