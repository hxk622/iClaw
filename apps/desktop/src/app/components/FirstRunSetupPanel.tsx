import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/app/components/ui/Button';
import { BRAND } from '@/app/lib/brand';
import { getResolvedThemeFromDom, THEME_CHANGE_EVENT, type ResolvedTheme } from '@/app/lib/theme';

interface FirstRunSetupPanelProps {
  state: 'loading' | 'error';
  title: string;
  subtitle: string;
  progress: number;
  stepLabel: string;
  stepDetail: string;
  errorMessage: string | null;
  onRetry: () => Promise<void>;
  presentation?: 'fullscreen' | 'embedded';
}

const PARTICLES = Array.from({ length: 16 }, (_, index) => ({
  id: index,
  left: `${8 + ((index * 17) % 84)}%`,
  top: `${10 + ((index * 23) % 76)}%`,
  delay: `${(index % 5) * 0.7}s`,
  duration: `${3.6 + (index % 4) * 0.65}s`,
}));

function panelThemeClasses(theme: ResolvedTheme, hasError: boolean) {
  if (theme === 'dark') {
    return {
      page: 'bg-[#11100f] text-white',
      gradient:
        'bg-[radial-gradient(circle_at_top,_rgba(180,154,112,0.18),transparent_28%),radial-gradient(circle_at_bottom,_rgba(42,31,10,0.22),transparent_40%),linear-gradient(180deg,#171513_0%,#11100f_58%,#090807_100%)]',
      title: 'text-white',
      subtitle: 'text-[#b9b0a5]',
      card: 'border-[var(--border-default)] bg-[rgba(33,30,27,0.78)] shadow-[0_32px_120px_rgba(0,0,0,0.42)]',
      ringBase: 'border-[rgba(255,255,255,0.10)]',
      meta: hasError ? 'text-[#c46b6b]' : 'text-[var(--brand-primary)]',
      track: 'bg-[rgba(255,255,255,0.08)]',
      info: 'text-[var(--text-primary)]',
      detail: 'text-[var(--text-secondary)]',
      stepCard: hasError ? 'border-[rgba(196,107,107,0.28)] bg-[rgba(196,107,107,0.08)]' : 'border-[var(--border-default)] bg-[rgba(0,0,0,0.18)]',
      errorBox: 'border-[rgba(196,107,107,0.28)] bg-[rgba(196,107,107,0.08)] text-[#ffd4d0]',
      particle: hasError ? 'bg-[#c46b6b]/26' : 'bg-[var(--brand-primary)]/22',
      scan: hasError ? 'via-[#c46b6b]/28' : 'via-[var(--brand-primary)]/24',
      glow: hasError ? 'bg-[#c46b6b]/22' : 'bg-[var(--brand-primary)]/16',
      percentage: hasError ? 'text-[#c46b6b]' : 'text-[var(--brand-primary)]',
    };
  }

  return {
    page: 'bg-[#fcfbf8] text-[#1d1b17]',
    gradient:
      'bg-[radial-gradient(circle_at_top,_rgba(255,147,81,0.22),transparent_26%),radial-gradient(circle_at_bottom,_rgba(255,236,214,0.9),transparent_44%),linear-gradient(180deg,#fffdf9_0%,#fff8f0_50%,#f6efe5_100%)]',
    title: 'text-[#171513]',
    subtitle: 'text-[#736a5d]',
    card: 'border-[var(--border-default)] bg-[rgba(255,255,255,0.78)] shadow-[0_32px_120px_rgba(170,122,61,0.14)]',
    ringBase: 'border-[var(--border-default)]',
    meta: hasError ? 'text-[var(--state-error)]' : 'text-[var(--brand-primary)]',
    track: 'bg-[var(--bg-hover)]',
    info: 'text-[var(--text-primary)]',
    detail: 'text-[var(--text-secondary)]',
    stepCard: hasError ? 'border-[rgba(184,79,79,0.22)] bg-[rgba(184,79,79,0.06)]' : 'border-[var(--border-default)] bg-[rgba(255,255,255,0.76)]',
    errorBox: 'border-[rgba(184,79,79,0.22)] bg-[rgba(184,79,79,0.06)] text-[#7d2f2a]',
    particle: hasError ? 'bg-[var(--state-error)]/18' : 'bg-[var(--brand-primary)]/22',
    scan: hasError ? 'via-[var(--state-error)]/24' : 'via-[var(--brand-primary)]/24',
    glow: hasError ? 'bg-[var(--state-error)]/16' : 'bg-[var(--brand-primary)]/18',
    percentage: hasError ? 'text-[var(--state-error)]' : 'text-[var(--brand-primary)]',
  };
}

export function FirstRunSetupPanel({
  state,
  title,
  subtitle,
  progress,
  stepLabel,
  stepDetail,
  errorMessage,
  onRetry,
  presentation = 'fullscreen',
}: FirstRunSetupPanelProps) {
  const [theme, setTheme] = useState<ResolvedTheme>(() => getResolvedThemeFromDom());
  const clampedProgress = Math.max(0, Math.min(100, Math.round(progress)));
  const hasError = state === 'error';
  const palette = useMemo(() => panelThemeClasses(theme, hasError), [theme, hasError]);
  const installerHeroSrc = BRAND.assets.installerHeroSrc || BRAND.assets.faviconPngSrc;
  const installerHeroAlt = BRAND.assets.logoAlt || `${BRAND.displayName} logo`;

  useEffect(() => {
    const handleThemeChange = () => {
      setTheme(getResolvedThemeFromDom());
    };
    window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    };
  }, []);

  const containerClassName =
    presentation === 'embedded'
      ? `relative flex h-full min-h-0 items-center justify-center overflow-auto px-6 py-10 ${palette.page}`
      : `relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-10 ${palette.page}`;
  const cardClassName =
    presentation === 'embedded'
      ? `relative w-full max-w-[760px] overflow-hidden rounded-[32px] border px-8 py-9 backdrop-blur-2xl md:px-10 md:py-10 ${palette.card}`
      : `relative w-full max-w-[780px] overflow-hidden rounded-[36px] border px-8 py-10 backdrop-blur-2xl md:px-12 md:py-12 ${palette.card}`;

  return (
    <div className={containerClassName}>
      <div className={`pointer-events-none absolute inset-0 ${palette.gradient}`} />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {PARTICLES.map((particle) => (
          <span
            key={particle.id}
            className={`absolute h-1.5 w-1.5 rounded-full ${palette.particle}`}
            style={{
              left: particle.left,
              top: particle.top,
              animation: `installer-particle-float ${particle.duration} ease-in-out ${particle.delay} infinite`,
            }}
          />
        ))}
      </div>
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${palette.scan} to-transparent`}
        style={{ animation: 'installer-scan-line 4.6s linear infinite' }}
      />

      <div className={cardClassName}>
        <div className="text-center">
          <div className={`text-[11px] uppercase tracking-[0.34em] ${palette.meta}`}>
            Installation Sequence
          </div>
          <h1 className={`mt-4 text-[36px] font-semibold tracking-[-0.06em] md:text-[42px] ${palette.title}`}>{title}</h1>
          <p className={`mx-auto mt-3 max-w-[420px] text-sm leading-7 md:text-[15px] ${palette.subtitle}`}>{subtitle}</p>
        </div>

        <div className="relative mx-auto mt-10 h-[300px] w-[300px] md:h-[340px] md:w-[340px]">
          <div
            className={`absolute inset-[12%] rounded-full blur-3xl ${palette.glow}`}
            style={{ animation: hasError ? 'installer-glow 1.8s ease-in-out infinite' : 'installer-glow 3.2s ease-in-out infinite' }}
          />
          {!hasError && (
            <>
              <div
                className={`absolute inset-[6%] rounded-full border ${palette.ringBase}`}
                style={{ animation: 'installer-ripple 3s ease-out infinite' }}
              />
              <div
                className={`absolute inset-[10%] rounded-full border ${palette.ringBase}`}
                style={{ animation: 'installer-ripple 3s ease-out 1.2s infinite' }}
              />
            </>
          )}
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 340 340" aria-hidden="true">
            <circle cx="170" cy="170" r="156" className={palette.track} fill="none" strokeWidth="4" />
            <circle
              cx="170"
              cy="170"
              r="156"
              fill="none"
              stroke="url(#installer-progress-gradient)"
              strokeLinecap="round"
              strokeWidth="6"
              strokeDasharray={980.1769079201}
              strokeDashoffset={980.1769079201 * (1 - clampedProgress / 100)}
              style={{ transition: 'stroke-dashoffset 320ms ease-out', filter: 'drop-shadow(0 0 8px rgba(255,145,82,0.42))' }}
            />
            <defs>
              <linearGradient id="installer-progress-gradient" x1="0%" x2="100%" y1="0%" y2="0%">
                <stop offset="0%" stopColor={hasError ? '#ff655b' : '#ff7d47'} />
                <stop offset="100%" stopColor={hasError ? '#d83a3a' : '#ffb05b'} />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <img
              src={installerHeroSrc}
              alt={installerHeroAlt}
              className="relative z-10 h-[240px] w-[240px] object-contain md:h-[270px] md:w-[270px]"
              style={{ animation: hasError ? 'installer-wobble 1.6s ease-in-out infinite' : 'installer-float 3.6s ease-in-out infinite' }}
            />
          </div>
        </div>

        <div className="mx-auto mt-4 max-w-[560px] text-center">
          <div className={`text-[18px] font-medium tracking-[-0.03em] ${palette.info}`}>{stepLabel}</div>
          <div className={`mt-2 text-sm leading-7 ${palette.detail}`}>{stepDetail}</div>
        </div>

        <div className="mx-auto mt-8 max-w-[560px]">
          <div className={`relative h-2 overflow-hidden rounded-full ${palette.track}`}>
            {!hasError && (
              <div
                className="absolute inset-y-0 w-24 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.5),transparent)]"
                style={{
                  left: `${Math.max(0, clampedProgress - 8)}%`,
                  animation: 'installer-progress-shimmer 1.8s ease-in-out infinite',
                }}
              />
            )}
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${clampedProgress}%`,
                transition: 'width 260ms ease-out',
                background: hasError
                  ? 'linear-gradient(90deg, #ff665d 0%, #de3d3d 100%)'
                  : 'linear-gradient(90deg, #ff7d47 0%, #ffb05b 100%)',
                boxShadow: hasError
                  ? '0 0 16px rgba(255, 102, 93, 0.42)'
                  : '0 0 16px rgba(255, 143, 73, 0.42)',
              }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className={`text-[11px] uppercase tracking-[0.26em] ${palette.detail}`}>
              {hasError ? 'Installation Failed' : 'Installation Progress'}
            </div>
            <div className={`text-[18px] font-medium tabular-nums tracking-[0.12em] ${palette.percentage}`}>{clampedProgress}%</div>
          </div>
        </div>

        {hasError && (
          <div className="mx-auto mt-8 max-w-[560px] space-y-4">
            <div className={`rounded-[24px] border px-5 py-5 ${palette.stepCard}`}>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(255,101,91,0.12)] text-[#ff6a5f]">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-medium ${palette.info}`}>安装过程中断</div>
                  <div className={`mt-2 whitespace-pre-wrap break-words text-sm leading-7 ${palette.detail}`}>
                    {errorMessage}
                  </div>
                </div>
              </div>
            </div>
            <Button
              variant="primary"
              size="md"
              block
              leadingIcon={<RefreshCcw className="h-4 w-4" />}
              onClick={() => void onRetry()}
            >
              重新尝试
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
