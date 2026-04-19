import { Download, Info, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { SettingsBadge } from '@/app/components/settings/ui/SettingsBadge';
import { SettingsCard } from '@/app/components/settings/ui/SettingsCard';

export type DesktopUpdateCheckOutcome = 'busy' | 'up_to_date' | 'update_available' | 'failed';

interface SettingsVersionProps {
  currentVersion: string;
  latestVersion: string | null;
  mandatory: boolean;
  enforcementState: 'recommended' | 'required_after_run' | 'required_now';
  policyLabel: string;
  checkingForUpdates: boolean;
  upgrading: boolean;
  readyToRestart: boolean;
  statusMessage: string | null;
  onCheckForUpdates: () => Promise<DesktopUpdateCheckOutcome>;
  onUpgradeNow: () => void;
  onRestartToApply: () => void;
  onShowToast: (input: { tone: 'success' | 'error' | 'info'; title: string; text: string }) => void;
}

function formatReleaseVersionLabel(version: string | null): string | null {
  const normalized = String(version || '').trim();
  if (!normalized) {
    return null;
  }
  return normalized.includes('+') ? normalized.replace('+', '.') : normalized;
}

export function SettingsVersion({
  currentVersion,
  latestVersion,
  mandatory,
  enforcementState,
  policyLabel,
  checkingForUpdates,
  upgrading,
  readyToRestart,
  statusMessage,
  onCheckForUpdates,
  onUpgradeNow,
  onRestartToApply,
  onShowToast,
}: SettingsVersionProps) {
  const displayCurrentVersion = formatReleaseVersionLabel(currentVersion) || currentVersion;
  const displayLatestVersion = formatReleaseVersionLabel(latestVersion);
  const needsUpdate = Boolean(displayLatestVersion && displayLatestVersion !== displayCurrentVersion);

  const handleCheckForUpdates = async () => {
    const outcome = await onCheckForUpdates();
    if (outcome === 'up_to_date') {
      onShowToast({
        tone: 'info',
        title: '当前已是最新版本',
        text: `你正在使用 ${displayCurrentVersion}，目前没有可安装的新版本。`,
      });
    }
  };

  return (
    <div className="max-w-[720px] space-y-8">
      <header className="space-y-2">
        <h1 className="text-[24px] font-semibold tracking-tight text-[var(--text-primary)]">版本</h1>
        <p className="text-[15px] leading-7 text-[var(--text-secondary)]">
          查看当前桌面端版本、升级策略与可用更新。检查更新后，如果已经是最新版本，会直接给出轻量提示。
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SettingsCard className="rounded-[18px] p-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-[14px] bg-[color:color-mix(in_srgb,var(--brand-primary)_14%,transparent)] text-[var(--brand-primary)]">
              <Info className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">Current</div>
              <div className="text-[20px] font-semibold tracking-[-0.03em] text-[var(--text-primary)]">{displayCurrentVersion}</div>
              <div className="text-[13px] leading-6 text-[var(--text-secondary)]">当前安装在本机上的桌面端版本。</div>
            </div>
          </div>
        </SettingsCard>

        <SettingsCard className="rounded-[18px] p-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-[14px] bg-[color:color-mix(in_srgb,var(--state-info)_14%,transparent)] text-[var(--state-info)]">
              <Download className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0 space-y-2">
              <div>
                <div className="text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">Latest</div>
                <div className="text-[20px] font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                  {displayLatestVersion || '暂未发现更新'}
                </div>
              </div>
              {needsUpdate ? <SettingsBadge tone="gold">发现新版本</SettingsBadge> : <SettingsBadge tone="green">已同步</SettingsBadge>}
            </div>
          </div>
        </SettingsCard>
      </section>

      <section className="space-y-4">
        <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">升级策略</h2>
        <SettingsCard className="rounded-[18px] p-5">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-[14px] bg-[color:color-mix(in_srgb,var(--brand-primary)_14%,transparent)] text-[var(--brand-primary)]">
                <ShieldCheck className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0 space-y-2">
                <div className="text-[14px] font-medium text-[var(--text-primary)]">当前由服务器策略统一控制</div>
                <div className="text-[13px] leading-6 text-[var(--text-secondary)]">
                  版本是否提醒、何时拦截，以及是否允许当前任务先完成，当前都由服务端策略下发。
                </div>
                <div className="flex flex-wrap gap-2 text-[12px] text-[var(--text-secondary)]">
                  <SettingsBadge tone="blue">{policyLabel}</SettingsBadge>
                  {mandatory ? (
                    <SettingsBadge tone="gold">
                      {enforcementState === 'required_now' ? '立即拦截' : '任务完成后升级'}
                    </SettingsBadge>
                  ) : (
                    <SettingsBadge tone="green">常规提醒</SettingsBadge>
                  )}
                </div>
              </div>
            </div>

            {statusMessage ? (
              <div className="rounded-[14px] border border-[var(--border-default)] bg-[color:color-mix(in_srgb,var(--bg-hover)_72%,transparent)] px-4 py-3 text-[13px] leading-6 text-[var(--text-secondary)]">
                {statusMessage}
              </div>
            ) : null}
          </div>
        </SettingsCard>
      </section>

      <section className="space-y-4">
        <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">检查更新</h2>
        <SettingsCard className="rounded-[18px] p-5">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<RefreshCw className={checkingForUpdates ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />}
              onClick={handleCheckForUpdates}
              disabled={checkingForUpdates || upgrading}
            >
              {checkingForUpdates ? '检查中...' : '检查更新'}
            </Button>

            {readyToRestart ? (
              <Button variant="primary" size="sm" onClick={onRestartToApply}>
                重启应用
              </Button>
            ) : needsUpdate ? (
              <Button
                variant="primary"
                size="sm"
                leadingIcon={upgrading ? <RefreshCw className="h-4 w-4 animate-spin" /> : undefined}
                onClick={onUpgradeNow}
                disabled={checkingForUpdates || upgrading}
              >
                {upgrading ? '升级中...' : mandatory ? '立即升级' : '开始升级'}
              </Button>
            ) : null}
          </div>
        </SettingsCard>
      </section>
    </div>
  );
}
