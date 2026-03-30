import { Clock3, RefreshCw, ShieldAlert, Sparkles } from 'lucide-react';
import type { DesktopUpdateHint } from '@iclaw/sdk';
import { Button } from '@/app/components/ui/Button';
import {
  formatDesktopUpdateVersion,
  type DesktopUpdateGateState,
  normalizeDesktopUpdateEnforcementState,
  resolveDesktopUpdatePolicyLabel,
} from '@/app/lib/desktop-updates';

interface DesktopUpdateGuardProps {
  hint: DesktopUpdateHint | null;
  gateState: DesktopUpdateGateState;
  busy: boolean;
  onUpgrade: () => void;
  onRestart: () => void;
}

export function DesktopUpdateGuard({
  hint,
  gateState,
  busy,
  onUpgrade,
  onRestart,
}: DesktopUpdateGuardProps) {
  if (!hint || gateState === 'none' || gateState === 'recommended') {
    return null;
  }

  const versionLabel = formatDesktopUpdateVersion(hint.latestVersion);
  const policyLabel = resolveDesktopUpdatePolicyLabel(hint);
  const reasonMessage = hint.reasonMessage?.trim() || null;
  const enforcementState = normalizeDesktopUpdateEnforcementState(hint);

  if (gateState === 'required_waiting_current_run') {
    return (
      <div className="pointer-events-none absolute inset-x-0 top-3 z-40 flex justify-center px-4">
        <div className="pointer-events-auto flex w-full max-w-[860px] items-start gap-3 rounded-[22px] border border-[rgba(215,145,36,0.18)] bg-[linear-gradient(180deg,rgba(255,250,241,0.98),rgba(250,243,228,0.96))] px-4 py-3 text-[var(--text-primary)] shadow-[0_18px_46px_rgba(30,22,12,0.14)] backdrop-blur-md dark:border-[rgba(245,191,85,0.18)] dark:bg-[linear-gradient(180deg,rgba(31,24,12,0.96),rgba(20,16,10,0.96))]">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[rgba(215,145,36,0.12)] text-[rgb(180,109,23)] dark:bg-[rgba(245,191,85,0.12)] dark:text-[rgb(245,191,85)]">
            <Clock3 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold">检测到桌面端强制更新</div>
            <div className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">
              当前版本需升级到 {versionLabel}。当前任务可以继续执行，但结束后将禁止发起新的对话或任务。
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)]">
              <span className="rounded-full bg-[rgba(215,145,36,0.10)] px-2.5 py-1">{policyLabel}</span>
              {reasonMessage ? <span>{reasonMessage}</span> : null}
            </div>
          </div>
          <Button
            variant="accent"
            size="sm"
            onClick={onUpgrade}
            disabled={busy}
            leadingIcon={busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          >
            {busy ? '处理中…' : '立即更新'}
          </Button>
        </div>
      </div>
    );
  }

  const title =
    gateState === 'ready_to_restart'
      ? '新版本已安装'
      : enforcementState === 'required_now'
        ? '需要立即升级'
        : '当前任务已结束，需要升级后继续';
  const description =
    gateState === 'ready_to_restart'
      ? `版本 ${versionLabel} 已准备完成，重启应用后生效。`
      : enforcementState === 'required_now'
        ? `当前版本需要升级到 ${versionLabel} 后才能继续使用。`
        : `当前版本需要升级到 ${versionLabel}。由于当前任务已经结束，新的对话和任务入口已暂停。`;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-[rgba(10,12,18,0.34)] px-4 py-8 backdrop-blur-[6px]">
      <div className="w-full max-w-[560px] rounded-[30px] border border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(252,251,248,0.98),rgba(244,240,233,0.96))] p-6 shadow-[0_34px_90px_rgba(14,18,28,0.28)] dark:bg-[linear-gradient(180deg,rgba(24,24,24,0.98),rgba(12,12,12,0.96))] md:p-7">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-[rgba(222,62,50,0.10)] text-[rgb(185,28,28)] dark:bg-[rgba(248,113,113,0.16)] dark:text-[#fecaca]">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="text-[12px] font-semibold tracking-[0.12em] text-[var(--text-muted)]">DESKTOP UPDATE</div>
            <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-[var(--text-primary)]">{title}</h2>
            <p className="mt-3 text-[14px] leading-7 text-[var(--text-secondary)]">{description}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 rounded-[22px] border border-[var(--border-default)] bg-[color:color-mix(in_srgb,var(--bg-card)_82%,transparent)] p-4">
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-[var(--text-secondary)]">
            <span className="rounded-full bg-[var(--chip-brand-bg)] px-2.5 py-1 text-[var(--chip-brand-text)]">目标版本 {versionLabel}</span>
            <span className="rounded-full bg-[var(--bg-hover)] px-2.5 py-1">{policyLabel}</span>
          </div>
          {reasonMessage ? (
            <div className="text-[13px] leading-6 text-[var(--text-secondary)]">{reasonMessage}</div>
          ) : null}
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          {gateState === 'ready_to_restart' ? (
            <Button
              variant="primary"
              size="md"
              onClick={onRestart}
              leadingIcon={<RefreshCw className="h-4 w-4" />}
            >
              立即重启
            </Button>
          ) : (
            <Button
              variant="primary"
              size="md"
              onClick={onUpgrade}
              disabled={busy}
              leadingIcon={busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            >
              {busy ? '处理中…' : '立即更新'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
