import { ModelBrandIcon } from './ModelBrandIcon';
import type { ModelFamily } from '../lib/model-catalog';

type ComposerModelLogoProps = {
  authBaseUrl: string;
  family: ModelFamily;
  logoPresetKey?: string | null;
  className?: string;
};

function buildModelLogoUrl(authBaseUrl: string, logoPresetKey: string): string {
  return `${authBaseUrl.replace(/\/+$/, '')}/portal/model-logo/file?preset_key=${encodeURIComponent(logoPresetKey)}`;
}

export function ComposerModelLogo({
  authBaseUrl,
  family,
  logoPresetKey,
  className,
}: ComposerModelLogoProps) {
  const resolvedPresetKey = typeof logoPresetKey === 'string' && logoPresetKey.trim() ? logoPresetKey.trim() : '';
  const resolvedAuthBaseUrl = authBaseUrl.trim();

  if (resolvedPresetKey && resolvedAuthBaseUrl) {
    return (
      <span className={className} data-has-remote-logo="true">
        <img
          src={buildModelLogoUrl(resolvedAuthBaseUrl, resolvedPresetKey)}
          alt=""
          loading="lazy"
          decoding="async"
          className="iclaw-composer__model-logo-image"
        />
      </span>
    );
  }

  return <ModelBrandIcon family={family} className={className} />;
}
