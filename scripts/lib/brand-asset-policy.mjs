function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function inspectBrandAssetPolicy(profile) {
  const assets = profile && typeof profile === 'object' && profile.assets && typeof profile.assets === 'object'
    ? profile.assets
    : {};

  const normalizedAssets = {
    assistantAvatar: trimString(assets.assistantAvatar),
    faviconPng: trimString(assets.faviconPng),
    homeLogo: trimString(assets.homeLogo),
    logoMaster: trimString(assets.logoMaster),
  };

  const errors = [];
  const advisories = [];

  if (!normalizedAssets.assistantAvatar) {
    errors.push('assets.assistantAvatar is required for chat assistant avatar surfaces');
  }
  if (!normalizedAssets.faviconPng) {
    errors.push('assets.faviconPng is required for favicon and small brand-mark surfaces');
  }
  if (!normalizedAssets.homeLogo) {
    errors.push('assets.homeLogo is required for home/marketing logo surfaces');
  }
  if (!normalizedAssets.logoMaster) {
    errors.push('assets.logoMaster is required for desktop icon generation');
  }

  const selections = {
    assistantAvatar: {
      sourceKey: 'assistantAvatar',
      path: normalizedAssets.assistantAvatar,
    },
    brandMark: {
      sourceKey: 'faviconPng',
      path: normalizedAssets.faviconPng,
    },
    homeLogo: {
      sourceKey: 'homeLogo',
      path: normalizedAssets.homeLogo,
    },
    logoMaster: {
      sourceKey: 'logoMaster',
      path: normalizedAssets.logoMaster,
    },
  };

  if (
    normalizedAssets.assistantAvatar &&
    normalizedAssets.logoMaster &&
    normalizedAssets.assistantAvatar === normalizedAssets.logoMaster
  ) {
    advisories.push('assets.assistantAvatar matches assets.logoMaster; verify the image is tightly cropped for circular chat surfaces');
  }

  return {
    assets: normalizedAssets,
    selections,
    errors,
    advisories,
  };
}

export function assertBrandAssetPolicy(profile) {
  const report = inspectBrandAssetPolicy(profile);
  if (report.errors.length > 0) {
    throw new Error(report.errors.join('; '));
  }
  return report;
}
