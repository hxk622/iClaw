import { BRAND } from './brand';

function normalizeAssetSrc(value: string | null | undefined): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}

export function resolveAssistantAvatarAssetSrc(): string {
  return (
    normalizeAssetSrc(BRAND.assets.assistantAvatarSrc) ||
    normalizeAssetSrc(BRAND.assets.brandMarkSrc) ||
    normalizeAssetSrc(BRAND.assets.faviconPngSrc) ||
    '/brand/favicon.png'
  );
}
