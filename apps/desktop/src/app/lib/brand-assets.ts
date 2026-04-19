import { BRAND } from './brand';

export function resolveAssistantAvatarAssetSrc(): string {
  return BRAND.assets.brandMarkSrc || BRAND.assets.faviconPngSrc || '/brand/favicon.png';
}
