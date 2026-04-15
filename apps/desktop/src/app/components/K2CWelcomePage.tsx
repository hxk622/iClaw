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
  avatarUrl: BRAND.assets.faviconPngSrc || '/brand/favicon.png',
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
  const fallbackSrc = BRAND.assets.faviconPngSrc || '/brand/favicon.png';
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
};

export function K2CWelcomePage({
  onStartChat: _onStartChat,
  onFillPrompt: _onFillPrompt,
  config,
}: K2CWelcomePageProps) {
  const profile = useMemo(() => resolveWelcomeProfile(config), [config]);

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-10 overflow-hidden"
      style={{ bottom: 'calc(var(--iclaw-composer-height) + 18px)' }}
    >
      <div className="flex h-full items-center justify-center px-6 py-6 lg:px-8">
        <section
          className="flex h-full w-full max-w-[720px] flex-col items-center justify-center overflow-hidden text-center"
          style={buildWelcomeVars(profile)}
        >
          <div className="relative">
            <div className="absolute inset-[-18px] rounded-full bg-[radial-gradient(circle,rgba(196,151,95,0.18),transparent_68%)] dark:bg-[radial-gradient(circle,rgba(196,151,95,0.24),transparent_66%)]" />
            <div className="relative h-[116px] w-[116px] overflow-hidden rounded-full border border-[var(--iclaw-welcome-primary-border)] bg-[var(--chat-surface-panel)] shadow-[0_18px_44px_rgba(0,0,0,0.16)] md:h-[136px] md:w-[136px]">
              <LogoAvatar src={profile.avatarUrl} alt={profile.expertName} />
            </div>
          </div>

          <h1 className="mt-8 max-w-[14ch] text-[34px] font-semibold tracking-[-0.06em] text-[var(--text-primary)] dark:text-[rgba(248,245,238,0.96)] md:text-[46px]">
            {profile.expertName}
          </h1>

          <p className="mt-5 max-w-[560px] text-[15px] leading-8 text-[var(--text-secondary)] dark:text-[rgba(233,224,210,0.72)] md:text-[18px]">
            {profile.slogan}
          </p>
        </section>
      </div>
    </div>
  );
}
