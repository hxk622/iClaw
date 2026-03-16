import { Download, RefreshCw, Sparkles } from 'lucide-react';
import type { DesktopUpdateHint } from '@iclaw/sdk';
import { cn } from '@/app/lib/cn';
import { formatDesktopUpdateVersion } from '@/app/lib/desktop-updates';

interface DesktopUpdateCardProps {
  hint: DesktopUpdateHint;
  busy?: boolean;
  error?: string | null;
  opened?: boolean;
  onUpgrade: () => void;
  onSkip?: () => void;
}

export function DesktopUpdateCard({
  hint,
  busy = false,
  error = null,
  opened = false,
  onUpgrade,
  onSkip,
}: DesktopUpdateCardProps) {
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
          <div className="text-[14px] font-semibold tracking-[0.01em] text-white">新版本可用</div>
          <div className="mt-1 text-[12px] text-white/58">版本 {formatDesktopUpdateVersion(hint.latestVersion)}</div>
          <div className="mt-2 text-[12px] leading-5 text-white/72">
            {hint.mandatory ? '当前版本需要升级后继续使用。' : '桌面端已发现更新，可随时升级。'}
          </div>
          {opened ? <div className="mt-2 text-[12px] text-emerald-300">已打开下载链接。</div> : null}
          {error ? <div className="mt-2 text-[12px] text-rose-300">{error}</div> : null}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-white/8 bg-[rgba(255,255,255,0.03)] px-3 py-2.5">
        {!hint.mandatory && onSkip ? (
          <button
            type="button"
            onClick={onSkip}
            className="inline-flex h-8 items-center justify-center rounded-[10px] px-3 text-[12px] font-medium text-white/68 transition hover:bg-white/8 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy}
          >
            跳过
          </button>
        ) : null}
        <button
          type="button"
          onClick={onUpgrade}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[10px] bg-[rgba(255,255,255,0.12)] px-3 text-[12px] font-medium text-white transition hover:bg-[rgba(255,255,255,0.18)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={busy}
        >
          {busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          {busy ? '处理中…' : hint.mandatory ? '立即升级' : '升级'}
        </button>
      </div>
    </section>
  );
}
