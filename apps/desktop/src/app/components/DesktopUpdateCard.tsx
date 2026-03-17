import { Download, RefreshCw, RotateCcw, Sparkles } from 'lucide-react';
import type { DesktopUpdateHint } from '@iclaw/sdk';
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
        'mb-3 overflow-hidden rounded-[18px] border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(46,46,53,0.98)_0%,rgba(32,32,38,0.98)_100%)] text-white shadow-[0_18px_36px_rgba(15,23,42,0.24)]',
        'transition-[transform,opacity] duration-[var(--motion-panel)]',
      )}
      style={{ transitionTimingFunction: 'var(--motion-spring)' }}
    >
      <div className="flex items-start gap-3 px-3.5 py-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,rgba(248,113,113,0.22)_0%,rgba(251,146,60,0.22)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]">
          <Sparkles className="h-4.5 w-4.5 text-[#ffb86c]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold tracking-[0.01em] text-white">{title}</div>
          <div className="mt-1 text-[12px] text-white/58">版本 {formatDesktopUpdateVersion(hint.latestVersion)}</div>
          <div className="mt-2 text-[12px] leading-5 text-white/72">{description}</div>
          {typeof progress === 'number' ? (
            <div className="mt-2">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-[#ffb86c]" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
              </div>
              <div className="mt-1 text-[11px] text-white/48">{Math.round(progress)}%</div>
            </div>
          ) : null}
          {opened ? <div className="mt-2 text-[12px] text-emerald-300">已打开下载链接。</div> : null}
          {error ? <div className="mt-2 text-[12px] text-rose-300">{error}</div> : null}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-white/8 bg-[rgba(255,255,255,0.03)] px-3 py-2.5">
        {status === 'available' && !hint.mandatory && onSkip ? (
          <button
            type="button"
            onClick={onSkip}
            className="inline-flex h-8 items-center justify-center rounded-[10px] px-3 text-[12px] font-medium text-white/68 transition hover:bg-white/8 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy}
          >
            跳过
          </button>
        ) : null}
        {status === 'ready-to-restart' && onRestart ? (
          <button
            type="button"
            onClick={onRestart}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[10px] bg-[rgba(255,255,255,0.12)] px-3 text-[12px] font-medium text-white transition hover:bg-[rgba(255,255,255,0.18)]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            重启应用
          </button>
        ) : (
          <button
            type="button"
            onClick={onUpgrade}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[10px] bg-[rgba(255,255,255,0.12)] px-3 text-[12px] font-medium text-white transition hover:bg-[rgba(255,255,255,0.18)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={busy || status === 'checking' || status === 'downloading'}
          >
            {busy || status === 'checking' || status === 'downloading' ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            {status === 'checking'
              ? '检查中…'
              : status === 'downloading'
                ? '下载中…'
                : hint.mandatory
                  ? '立即升级'
                  : '升级'}
          </button>
        )}
      </div>
    </section>
  );
}
