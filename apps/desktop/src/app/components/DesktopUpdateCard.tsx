import { Download, RefreshCw, RotateCcw, Sparkles } from 'lucide-react';
import type { DesktopUpdateHint } from '@iclaw/sdk';
import { Button } from '@/app/components/ui/Button';
import { cn } from '@/app/lib/cn';
import { formatDesktopUpdateVersion } from '@/app/lib/desktop-updates';

interface DesktopUpdateCardProps {
  hint: DesktopUpdateHint;
  status?: 'available' | 'checking' | 'downloading' | 'ready-to-restart';
  busy?: boolean;
  error?: string | null;
  opened?: boolean;
  progress?: number | null;
  detail?: string | null;
  onUpgrade: () => void;
  onRestart?: () => void;
  onSkip?: () => void;
}

export function DesktopUpdateCard({
  hint,
  status = 'available',
  busy = false,
  error = null,
  opened = false,
  progress = null,
  detail = null,
  onUpgrade,
  onRestart,
  onSkip,
}: DesktopUpdateCardProps) {
  const title =
    status === 'ready-to-restart'
      ? '新版本已就绪'
      : status === 'downloading'
        ? '正在下载更新'
        : status === 'checking'
          ? '正在检查更新'
          : '新版本可用';
  const description =
    detail ||
    (status === 'ready-to-restart'
      ? '安装已经完成，重启应用后生效。'
      : status === 'downloading'
        ? '正在应用内下载更新包。'
        : hint.mandatory
          ? '当前版本需要升级后继续使用。'
          : '桌面端已发现更新，可随时升级。');

  return (
    <section
      className={cn(
        'mb-3 overflow-hidden rounded-[18px] border border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(252,251,248,0.98),rgba(244,240,233,0.96))] text-[var(--text-primary)] shadow-[var(--pressable-card-rest-shadow)] dark:bg-[linear-gradient(180deg,rgba(31,29,27,0.98),rgba(22,20,18,0.96))]',
        'transition-[transform,opacity] duration-[var(--motion-panel)]',
      )}
      style={{ transitionTimingFunction: 'var(--motion-spring)' }}
    >
      <div className="flex items-start gap-3 px-3.5 py-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[var(--chip-brand-bg)] shadow-[var(--pressable-card-rest-shadow)]">
          <Sparkles className="h-4.5 w-4.5 text-[var(--brand-primary)]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold tracking-[0.01em] text-[var(--text-primary)]">{title}</div>
          <div className="mt-1 text-[12px] text-[var(--text-muted)]">版本 {formatDesktopUpdateVersion(hint.latestVersion)}</div>
          <div className="mt-2 text-[12px] leading-5 text-[var(--text-secondary)]">{description}</div>
          {typeof progress === 'number' ? (
            <div className="mt-2">
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-hover)]">
                <div className="h-full rounded-full bg-[var(--brand-primary)]" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
              </div>
              <div className="mt-1 text-[11px] text-[var(--text-muted)]">{Math.round(progress)}%</div>
            </div>
          ) : null}
          {opened ? <div className="mt-2 text-[12px] text-[var(--state-success)]">已打开下载链接。</div> : null}
          {error ? <div className="mt-2 text-[12px] text-[var(--state-error)]">{error}</div> : null}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-[var(--border-default)] bg-[rgba(255,255,255,0.28)] px-3 py-2.5 dark:bg-[rgba(255,255,255,0.03)]">
        {status === 'available' && !hint.mandatory && onSkip ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={onSkip}
            disabled={busy}
          >
            跳过
          </Button>
        ) : null}
        {status === 'ready-to-restart' && onRestart ? (
          <Button
            variant="success"
            size="sm"
            onClick={onRestart}
            leadingIcon={<RotateCcw className="h-3.5 w-3.5" />}
          >
            重启应用
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            onClick={onUpgrade}
            disabled={busy || status === 'checking' || status === 'downloading'}
            leadingIcon={
              busy || status === 'checking' || status === 'downloading' ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )
            }
          >
            {status === 'checking'
              ? '检查中…'
              : status === 'downloading'
                ? '下载中…'
                : hint.mandatory
                  ? '立即升级'
                  : '升级'}
          </Button>
        )}
      </div>
    </section>
  );
}
