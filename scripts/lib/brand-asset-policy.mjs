function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function inspectBrandAssetPolicy(profile) {
  const assets = profile && typeof profile === 'object' && profile.assets && typeof profile.assets === 'object'
    ? profile.assets
    : {};

  const normalizedAssets = {
    assistantAvatar: trimString(assets.assistantAvatar),
    brandMark: trimString(assets.brandMark),
    desktopLogo: trimString(assets.desktopLogo),
    faviconPng: trimString(assets.faviconPng),
    homeLogo: trimString(assets.homeLogo),
    logoMaster: trimString(assets.logoMaster),
  };

  const errors = [];
  const advisories = [];

  if (!normalizedAssets.assistantAvatar) {
    errors.push('assets.assistantAvatar is required for chat assistant avatar surfaces');
  }
  if (!normalizedAssets.brandMark) {
    errors.push('assets.brandMark is required for sidebar/header brand-mark surfaces');
  }
  if (!normalizedAssets.faviconPng) {
    errors.push('assets.faviconPng is required for favicon surfaces');
  }
  if (!normalizedAssets.homeLogo) {
    errors.push('assets.homeLogo is required for home/marketing logo surfaces');
  }
  if (!normalizedAssets.desktopLogo) {
    errors.push('assets.desktopLogo is required for desktop icon generation');
  }
  if (!normalizedAssets.logoMaster) {
    errors.push('assets.logoMaster is required as the untouched original logo master');
  }

  const selections = {
    assistantAvatar: {
      sourceKey: 'assistantAvatar',
      path: normalizedAssets.assistantAvatar,
    },
    brandMark: {
      sourceKey: 'brandMark',
      path: normalizedAssets.brandMark,
    },
    homeLogo: {
      sourceKey: 'homeLogo',
      path: normalizedAssets.homeLogo,
    },
    desktopLogo: {
      sourceKey: 'desktopLogo',
      path: normalizedAssets.desktopLogo,
    },
    logoMaster: {
      sourceKey: 'logoMaster',
      path: normalizedAssets.logoMaster,
    },
  };

  if (
    normalizedAssets.desktopLogo &&
    normalizedAssets.logoMaster &&
    normalizedAssets.desktopLogo === normalizedAssets.logoMaster
  ) {
    advisories.push('assets.desktopLogo matches assets.logoMaster; keep them separate if desktop icon crops should not touch the original master');
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
