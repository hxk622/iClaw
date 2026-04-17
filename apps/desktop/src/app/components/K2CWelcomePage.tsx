import { useMemo, useState, type CSSProperties } from 'react';
import { BRAND } from '@/app/lib/brand';
import type { ResolvedWelcomePageConfig } from '@/app/lib/oem-runtime';

type WelcomeProfile = {
  expertName: string;
  slogan: string;
  avatarUrl: string;
  primaryColor: string;
};

const DEFAULT_PROFILE: WelcomeProfile = {
  expertName: '我是一只会赚钱的小龙虾',
  slogan: '干活是我核心能力，理财是我唯一使命，安全是我的责任底线',
  avatarUrl: BRAND.assets.brandMarkSrc || BRAND.assets.faviconPngSrc || '/brand/favicon.png',
  primaryColor: '#C4975F',
};

function resolveWelcomeProfile(config?: ResolvedWelcomePageConfig | null): WelcomeProfile {
  return {
    expertName: config?.expertName?.trim() || DEFAULT_PROFILE.expertName,
    slogan: config?.slogan?.trim() || DEFAULT_PROFILE.slogan,
    avatarUrl: config?.avatarUrl?.trim() || DEFAULT_PROFILE.avatarUrl,
    primaryColor: config?.primaryColor?.trim() || DEFAULT_PROFILE.primaryColor,
  };
}

function buildWelcomeVars(profile: WelcomeProfile): CSSProperties {
  return {
    '--iclaw-welcome-primary': profile.primaryColor,
    '--iclaw-welcome-primary-soft': `${profile.primaryColor}18`,
    '--iclaw-welcome-primary-border': `${profile.primaryColor}38`,
  } as CSSProperties;
}

function LogoAvatar({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  const [failed, setFailed] = useState(false);
  const fallbackSrc = BRAND.assets.brandMarkSrc || BRAND.assets.faviconPngSrc || '/brand/favicon.png';
  const resolvedSrc = !failed && src.trim() ? src : fallbackSrc;

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className="h-full w-full object-cover"
      onError={() => {
        if (resolvedSrc !== fallbackSrc) {
          setFailed(true);
        }
      }}
    />
  );
}

type K2CWelcomePageProps = {
  onStartChat: () => void;
  onFillPrompt: (prompt: string) => void;
  config?: ResolvedWelcomePageConfig | null;
  density?: 'default' | 'compact';
};

export function K2CWelcomePage({
  onStartChat: _onStartChat,
  onFillPrompt: _onFillPrompt,
  config,
  density = 'default',
}: K2CWelcomePageProps) {
  const profile = useMemo(() => resolveWelcomeProfile(config), [config]);
  const compact = density === 'compact';

  return (
    <div
      data-density={density}
      className="pointer-events-none absolute inset-x-0 top-0 z-10 overflow-hidden"
      style={{ bottom: 'calc(var(--iclaw-composer-height) + 18px)' }}
    >
      <div className={`flex h-full items-center justify-center ${compact ? 'px-3 py-3 lg:px-4' : 'px-6 py-6 lg:px-8'}`}>
        <section
          className={`flex h-full w-full flex-col items-center justify-center overflow-hidden text-center ${
            compact ? 'max-w-[560px]' : 'max-w-[720px]'
          }`}
          style={buildWelcomeVars(profile)}
        >
          <div className="relative">
            <div
              className={`absolute rounded-full bg-[radial-gradient(circle,rgba(196,151,95,0.18),transparent_68%)] dark:bg-[radial-gradient(circle,rgba(196,151,95,0.24),transparent_66%)] ${
                compact ? 'inset-[-12px]' : 'inset-[-18px]'
              }`}
            />
            <div
              className={`relative overflow-hidden rounded-full border border-[var(--iclaw-welcome-primary-border)] bg-[var(--chat-surface-panel)] shadow-[0_18px_44px_rgba(0,0,0,0.16)] ${
                compact ? 'h-[84px] w-[84px] md:h-[96px] md:w-[96px]' : 'h-[116px] w-[116px] md:h-[136px] md:w-[136px]'
              }`}
            >
              <LogoAvatar src={profile.avatarUrl} alt={profile.expertName} />
            </div>
          </div>

          <h1
            className={`whitespace-nowrap font-semibold tracking-[-0.06em] text-[var(--text-primary)] dark:text-[rgba(248,245,238,0.96)] ${
              compact ? 'mt-5 text-[clamp(24px,2.8vw,34px)]' : 'mt-8 text-[clamp(34px,4vw,46px)]'
            }`}
          >
            {profile.expertName}
          </h1>

          <p
            className={`text-[var(--text-secondary)] dark:text-[rgba(233,224,210,0.72)] ${
              compact
                ? 'mt-3 max-w-[420px] text-[13px] leading-6 md:text-[15px]'
                : 'mt-5 max-w-[560px] text-[15px] leading-8 md:text-[18px]'
            }`}
          >
            {profile.slogan}
          </p>
        </section>
      </div>
    </div>
  );
}
