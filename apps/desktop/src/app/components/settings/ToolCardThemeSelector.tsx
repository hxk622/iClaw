import {
  type CSSProperties,
  type FocusEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, Sparkles, Zap } from 'lucide-react';
import type { ToolCardTone } from '@/app/lib/general-preferences';
import {
  TOOL_CARD_TONE_PRESETS,
  resolveToolCardTonePreset,
  type ToolCardTonePreviewTokens,
} from '@/app/lib/tool-card-tones';
import { cn } from '@/app/lib/cn';

interface ToolCardThemeSelectorProps {
  value: ToolCardTone;
  onChange: (value: ToolCardTone) => void;
}

type PreviewPlacement = {
  left: number;
  top: number;
  ready: boolean;
};

const PREVIEW_GAP = 14;
const VIEWPORT_PADDING = 16;

function resolvePreviewPlacement(anchor: DOMRect, width: number, height: number): PreviewPlacement {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left = anchor.left;
  if (left + width > viewportWidth - VIEWPORT_PADDING) {
    const leftCandidate = anchor.right - width;
    left = leftCandidate >= VIEWPORT_PADDING ? leftCandidate : viewportWidth - width - VIEWPORT_PADDING;
  }
  if (left < VIEWPORT_PADDING) {
    const rightCandidate = anchor.left;
    left = rightCandidate + width <= viewportWidth - VIEWPORT_PADDING ? rightCandidate : VIEWPORT_PADDING;
  }

  let top = anchor.bottom + PREVIEW_GAP;
  if (top + height > viewportHeight - VIEWPORT_PADDING) {
    const upwardCandidate = anchor.top - height - PREVIEW_GAP;
    top = upwardCandidate >= VIEWPORT_PADDING ? upwardCandidate : viewportHeight - height - VIEWPORT_PADDING;
  }
  if (top < VIEWPORT_PADDING) {
    const downwardCandidate = anchor.bottom + PREVIEW_GAP;
    top = downwardCandidate + height <= viewportHeight - VIEWPORT_PADDING ? downwardCandidate : VIEWPORT_PADDING;
  }

  return {
    left: Math.max(VIEWPORT_PADDING, Math.min(left, viewportWidth - width - VIEWPORT_PADDING)),
    top: Math.max(VIEWPORT_PADDING, Math.min(top, viewportHeight - height - VIEWPORT_PADDING)),
    ready: true,
  };
}

export function ToolCardThemeSelector({ value, onChange }: ToolCardThemeSelectorProps) {
  const [hoveredTone, setHoveredTone] = useState<ToolCardTone | null>(null);
  const [activeAnchor, setActiveAnchor] = useState<HTMLElement | null>(null);
  const [previewHovered, setPreviewHovered] = useState(false);
  const [placement, setPlacement] = useState<PreviewPlacement>({ left: 0, top: 0, ready: false });
  const previewRef = useRef<HTMLDivElement | null>(null);
  const leaveTimerRef = useRef<number | null>(null);

  const activePreset = hoveredTone ? resolveToolCardTonePreset(hoveredTone) : null;

  const cancelScheduledClose = () => {
    if (leaveTimerRef.current !== null) {
      window.clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    cancelScheduledClose();
    leaveTimerRef.current = window.setTimeout(() => {
      setHoveredTone(null);
      setActiveAnchor(null);
      setPreviewHovered(false);
    }, 60);
  };

  const handlePointerEnter = (tone: ToolCardTone, element: HTMLElement) => {
    cancelScheduledClose();
    setHoveredTone(tone);
    setActiveAnchor(element);
  };

  const handlePointerLeave = () => {
    if (!previewHovered) {
      scheduleClose();
    }
  };

  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    const next = event.relatedTarget;
    if (next instanceof Node && (event.currentTarget.contains(next) || previewRef.current?.contains(next))) {
      return;
    }
    scheduleClose();
  };

  useLayoutEffect(() => {
    if (!activeAnchor || !activePreset || !previewRef.current) {
      setPlacement((current) => (current.ready ? { left: 0, top: 0, ready: false } : current));
      return;
    }

    const updatePlacement = () => {
      if (!activeAnchor || !previewRef.current) {
        return;
      }
      const anchorRect = activeAnchor.getBoundingClientRect();
      const previewRect = previewRef.current.getBoundingClientRect();
      setPlacement(resolvePreviewPlacement(anchorRect, previewRect.width, previewRect.height));
    };

    updatePlacement();
    const handleScroll = () => updatePlacement();
    const handleResize = () => updatePlacement();

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [activeAnchor, activePreset]);

  useEffect(() => {
    return () => {
      cancelScheduledClose();
    };
  }, []);

  const preview = useMemo(() => {
    if (!activePreset || typeof document === 'undefined') {
      return null;
    }

    return createPortal(
      <div
        ref={previewRef}
        className={cn(
          'fixed z-[140] w-[min(540px,calc(100vw-32px))] rounded-[24px] border border-[var(--border-default)] bg-[color:color-mix(in_srgb,var(--bg-card)_96%,transparent)] p-4 shadow-[0_26px_64px_rgba(15,23,42,0.20)] backdrop-blur-xl',
          placement.ready ? 'opacity-100' : 'opacity-0',
        )}
        style={
          {
            left: placement.left,
            top: placement.top,
          } satisfies CSSProperties
        }
        onMouseEnter={() => {
          cancelScheduledClose();
          setPreviewHovered(true);
        }}
        onMouseLeave={() => {
          setPreviewHovered(false);
          scheduleClose();
        }}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-[14px] font-semibold text-[var(--text-primary)]">{activePreset.label}</div>
            <div className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">{activePreset.description}</div>
          </div>
          <div className="rounded-full border border-[var(--border-default)] bg-[var(--bg-hover)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
            hover 预览
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <ToolCardThemePreviewPane label="浅色" scheme={activePreset.light} mode="light" />
          <ToolCardThemePreviewPane label="深色" scheme={activePreset.dark} mode="dark" />
        </div>
      </div>,
      document.body,
    );
  }, [activePreset, placement.left, placement.ready, placement.top]);

  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {TOOL_CARD_TONE_PRESETS.map((preset) => {
          const active = preset.value === value;
          return (
            <button
              key={preset.value}
              type="button"
              onClick={() => onChange(preset.value)}
              onMouseEnter={(event) => handlePointerEnter(preset.value, event.currentTarget)}
              onMouseLeave={handlePointerLeave}
              onFocus={(event) => handlePointerEnter(preset.value, event.currentTarget)}
              onBlur={handleBlur}
              className={cn(
                'group relative overflow-hidden rounded-[20px] border p-4 text-left transition-all duration-200',
                active
                  ? 'border-[var(--surface-active-border)] bg-[var(--surface-active-bg)] shadow-[var(--surface-active-shadow)]'
                  : 'border-[var(--border-default)] bg-[var(--bg-card)] hover:-translate-y-[1px] hover:border-[var(--border-strong)] hover:shadow-[0_14px_30px_rgba(15,23,42,0.08)]',
              )}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-[14px] font-semibold text-[var(--text-primary)]">{preset.label}</div>
                    {preset.badge ? (
                      <span className="rounded-full border border-[var(--chip-brand-border)] bg-[var(--chip-brand-bg)] px-2 py-0.5 text-[10px] font-medium text-[var(--chip-brand-text)]">
                        {preset.badge}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">{preset.description}</div>
                </div>
                {active ? (
                  <div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--chip-brand-bg)] text-[var(--chip-brand-text)]">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                ) : (
                  <div className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-hover)] text-[var(--text-muted)] transition group-hover:text-[var(--text-primary)]">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>

              <div className="rounded-[16px] border border-[var(--border-default)] bg-[color:color-mix(in_srgb,var(--bg-hover)_78%,transparent)] p-3">
                <div className="mb-3 flex items-center gap-2">
                  {preset.swatches.map((color, index) => (
                    <span
                      key={`${preset.value}:${index}`}
                      className="h-5 w-5 rounded-full border border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]"
                      style={{ background: color }}
                    />
                  ))}
                </div>
                <div className="grid gap-2">
                  <div className="h-9 rounded-[14px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-[6px] bg-black/10 text-black/60 dark:bg-white/10 dark:text-white/70">
                        <Zap className="h-3 w-3" />
                      </span>
                      <span className="h-2.5 w-20 rounded-full bg-black/12 dark:bg-white/12" />
                      <span className="ml-auto h-5 w-12 rounded-full bg-black/10 dark:bg-white/10" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {preset.swatches.slice(1, 4).map((color, index) => (
                      <span
                        key={`${preset.value}:chip:${index}`}
                        className="h-6 flex-1 rounded-full border border-white/10"
                        style={{ background: `${color}26` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {preview}
    </>
  );
}

function ToolCardThemePreviewPane({
  label,
  scheme,
  mode,
}: {
  label: string;
  scheme: ToolCardTonePreviewTokens;
  mode: 'light' | 'dark';
}) {
  return (
    <div
      className="rounded-[20px] border p-3"
      style={{
        background: scheme.pageBg,
        borderColor: scheme.pageBorder,
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-[12px] font-semibold" style={{ color: scheme.pageText }}>
          {label}
        </div>
        <div className="text-[11px]" style={{ color: scheme.pageMuted }}>
          {mode === 'light' ? 'Light' : 'Dark'}
        </div>
      </div>
      <ExecPreviewCard scheme={scheme} />
    </div>
  );
}

function ExecPreviewCard({ scheme }: { scheme: ToolCardTonePreviewTokens }) {
  return (
    <div
      className="rounded-[18px] border p-3 shadow-[0_14px_28px_var(--preview-shadow)]"
      style={
        {
          background: scheme.cardBg,
          borderColor: scheme.cardBorder,
          ['--preview-shadow' as string]: scheme.cardShadow,
        } as CSSProperties
      }
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-[12px] border"
            style={{ background: scheme.subtleBg, borderColor: scheme.pageBorder, color: scheme.runningIcon }}
          >
            <Zap className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold" style={{ color: scheme.title }}>
              Exec
            </div>
            <div className="truncate text-[11px]" style={{ color: scheme.secondary }}>
              find …/artifact-preview-self-test*
            </div>
          </div>
        </div>
        <div
          className="rounded-full border px-2 py-1 text-[10px] font-semibold"
          style={{
            background: scheme.runningBadgeBg,
            borderColor: scheme.runningBorder,
            color: scheme.runningBadgeText,
          }}
        >
          running
        </div>
      </div>

      <div
        className="rounded-[12px] border px-3 py-2 text-[11px] leading-5"
        style={{
          background: scheme.subtleBg,
          borderColor: scheme.pageBorder,
          color: scheme.secondary,
        }}
      >
        find files named "artifact-preview-self-test*" → show first 20 lines
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <StatusChip tone="running" scheme={scheme}>
          running
        </StatusChip>
        <StatusChip tone="success" scheme={scheme}>
          completed
        </StatusChip>
        <StatusChip tone="error" scheme={scheme}>
          error
        </StatusChip>
      </div>
    </div>
  );
}

function StatusChip({
  tone,
  scheme,
  children,
}: {
  tone: 'running' | 'success' | 'error';
  scheme: ToolCardTonePreviewTokens;
  children: string;
}) {
  const toneStyle =
    tone === 'running'
      ? {
          background: scheme.runningBadgeBg,
          borderColor: scheme.runningBorder,
          color: scheme.runningBadgeText,
          dot: scheme.runningIcon,
        }
      : tone === 'success'
        ? {
            background: scheme.successBadgeBg,
            borderColor: scheme.successBorder,
            color: scheme.successBadgeText,
            dot: scheme.successIcon,
          }
        : {
            background: scheme.errorBadgeBg,
            borderColor: scheme.errorBorder,
            color: scheme.errorBadgeText,
            dot: scheme.errorIcon,
          };

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold"
      style={{
        background: toneStyle.background,
        borderColor: toneStyle.borderColor,
        color: toneStyle.color,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: toneStyle.dot }} />
      <span>{children}</span>
    </div>
  );
}
