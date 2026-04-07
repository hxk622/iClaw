import {asArray, asObject, deepMerge, normalizeTemplateKey, trimString} from './renderers/shared.js';

function resolveAssetUrl(rawAssets, candidates, fallback = '') {
  for (const candidate of candidates) {
    const raw = rawAssets[candidate];
    if (typeof raw === 'string' && raw.trim()) {
      return raw.trim();
    }
    const nested = asObject(raw);
    const url = trimString(nested.url || nested.publicUrl || nested.public_url || nested.src);
    if (url) {
      return url;
    }
  }
  return fallback;
}

function defaultSiteShell(runtimeBrand, templateKey) {
  const isWealth = templateKey === 'wealth-premium';
  return {
    themeKey: isWealth ? 'wealth-gold' : 'classic-default',
    header: {
      enabled: true,
      variant: isWealth ? 'finance-header' : 'default-header',
      props: {
        brandLabel: runtimeBrand.website.brandLabel || runtimeBrand.displayName,
        primaryCta: {
          label: runtimeBrand.website.topCtaLabel || '下载',
          href: '#download',
        },
        navItems: isWealth
          ? [
              {label: '核心能力', href: '#capabilities'},
              {label: '适用场景', href: '#scenes'},
              {label: '安全合规', href: '#security'},
            ]
          : [],
      },
    },
    footer: {
      enabled: true,
      variant: isWealth ? 'finance-legal-footer' : 'default-footer',
      props: {
        columns: [
          {
            title: '站点',
            links: [
              {label: '首页', href: '/'},
              {label: runtimeBrand.website.downloadTitle || '下载', href: '#download'},
            ],
          },
        ],
        legalLinks: [
          {label: '隐私政策', href: '/privacy'},
          {label: '用户协议', href: '/terms'},
        ],
        copyrightText: `© ${new Date().getFullYear()} ${runtimeBrand.displayName}`,
      },
    },
  };
}

function defaultPages(runtimeBrand, templateKey) {
  const isWealth = templateKey === 'wealth-premium';
  return [
    {
      pageKey: 'home',
      path: '/',
      enabled: true,
      seo: {
        title: runtimeBrand.website.homeTitle,
        description: runtimeBrand.website.metaDescription,
      },
      blocks: isWealth
        ? [
            {blockKey: 'hero.wealth', enabled: true, sortOrder: 10, props: {}},
            {blockKey: 'download-grid.finance', enabled: true, sortOrder: 20, props: {}},
            {blockKey: 'feature-cards.wealth', enabled: true, sortOrder: 30, props: {}},
            {blockKey: 'scenario-cards.wealth', enabled: true, sortOrder: 40, props: {}},
            {blockKey: 'workflow-steps.wealth', enabled: true, sortOrder: 50, props: {}},
            {blockKey: 'capability-grid.wealth', enabled: true, sortOrder: 60, props: {}},
            {blockKey: 'security-badges.finance', enabled: true, sortOrder: 70, props: {}},
            {blockKey: 'cta-banner.finance', enabled: true, sortOrder: 80, props: {}},
          ]
        : [
            {blockKey: 'hero.basic', enabled: true, sortOrder: 10, props: {}},
            {blockKey: 'download-grid.classic', enabled: true, sortOrder: 20, props: {}},
          ],
    },
  ];
}

function mergePages(defaultValue, ...sources) {
  const pageMap = new Map(asArray(defaultValue).map((page) => [trimString(asObject(page).pageKey), page]));
  for (const source of sources) {
    for (const page of asArray(source)) {
      const entry = asObject(page);
      const pageKey = trimString(entry.pageKey);
      if (!pageKey) continue;
      const existing = asObject(pageMap.get(pageKey));
      pageMap.set(pageKey, {
        ...existing,
        ...entry,
        seo: deepMerge(existing.seo, entry.seo),
        blocks: asArray(entry.blocks).length > 0 ? asArray(entry.blocks) : asArray(existing.blocks),
      });
    }
  }
  return Array.from(pageMap.values());
}

function normalizeLegacyWebsite(base, payload) {
  const rootConfig = asObject(payload?.config);
  const surfaceConfig = asObject(payload?.surfaceConfig);
  return {
    ...base.website,
    ...asObject(rootConfig.website),
    ...asObject(surfaceConfig.website),
  };
}

function normalizeFlatAssets(base, payload) {
  const rootConfig = asObject(payload?.config);
  const surfaceConfig = asObject(payload?.surfaceConfig);
  const rootAssets = asObject(rootConfig.assets);
  const surfaceAssets = asObject(surfaceConfig.assets);
  return {
    ...base.assets,
    ...Object.fromEntries(Object.entries(surfaceAssets).filter(([, value]) => typeof value === 'string')),
    faviconPngSrc: resolveAssetUrl({...rootAssets, ...surfaceAssets}, ['faviconPngSrc', 'faviconPng'], base.assets.faviconPngSrc),
    appleTouchIconSrc: resolveAssetUrl(
      {...rootAssets, ...surfaceAssets},
      ['appleTouchIconSrc', 'appleTouchIcon'],
      base.assets.appleTouchIconSrc,
    ),
    logoSrc: resolveAssetUrl({...rootAssets, ...surfaceAssets}, ['logoSrc', 'homeLogo', 'logoMaster'], base.assets.logoSrc),
    installerHeroSrc: resolveAssetUrl(
      {...rootAssets, ...surfaceAssets},
      ['installerHeroSrc', 'installerHero'],
      base.assets.installerHeroSrc,
    ),
    logoMasterSrc: resolveAssetUrl({...rootAssets, ...surfaceAssets}, ['logoMasterSrc', 'logoMaster'], base.assets.logoMasterSrc),
    heroArtSrc: resolveAssetUrl({...rootAssets, ...surfaceAssets}, ['heroArtSrc', 'homeHeroArt'], base.assets.heroArtSrc),
    heroLayer1Src: resolveAssetUrl(
      {...rootAssets, ...surfaceAssets},
      ['heroLayer1Src', 'homeHeroLayer1'],
      base.assets.heroLayer1Src,
    ),
    heroLayer2Src: resolveAssetUrl(
      {...rootAssets, ...surfaceAssets},
      ['heroLayer2Src', 'homeHeroLayer2'],
      base.assets.heroLayer2Src,
    ),
    heroPhotoSrc: resolveAssetUrl({...rootAssets, ...surfaceAssets}, ['heroPhotoSrc', 'homeHeroPhoto'], base.assets.heroPhotoSrc),
  };
}

export function normalizeRuntimeBrand(base, payload) {
  const rootConfig = asObject(payload?.config);
  const surfaceConfig = asObject(payload?.surfaceConfig);
  const rootMarketing = asObject(rootConfig.marketingSite);
  const surfaceMarketing = asObject(surfaceConfig.marketingSite);
  const website = normalizeLegacyWebsite(base, payload);
  const assets = normalizeFlatAssets(base, payload);
  const distribution = deepMerge(base.distribution, asObject(rootConfig.distribution), asObject(surfaceConfig.distribution));
  const release = {
    ...base.release,
    publishedVersion: payload?.publishedVersion || base.release.publishedVersion || 0,
  };
  const runtimeBrand = {
    ...base,
    brandId: trimString(payload?.app?.appName || payload?.brand?.brandId) || base.brandId,
    displayName: trimString(payload?.brand?.displayName || payload?.app?.displayName) || base.displayName,
    website,
    assets,
    distribution,
    release,
  };

  const templateKey = normalizeTemplateKey(
    surfaceConfig.templateKey ||
      surfaceMarketing.templateKey ||
      rootConfig.templateKey ||
      rootMarketing.templateKey ||
      asObject(base.marketingSite).templateKey,
    runtimeBrand.brandId,
  );

  const defaultShell = defaultSiteShell(runtimeBrand, templateKey);
  const siteShell = deepMerge(
    defaultShell,
    asObject(asObject(base.marketingSite).siteShell),
    asObject(rootMarketing.siteShell),
    asObject(rootConfig.siteShell),
    asObject(surfaceMarketing.siteShell),
    asObject(surfaceConfig.siteShell),
  );

  const pages = mergePages(
    defaultPages(runtimeBrand, templateKey),
    asObject(base.marketingSite).pages,
    rootMarketing.pages,
    rootConfig.pages,
    surfaceMarketing.pages,
    surfaceConfig.pages,
  );

  return {
    ...runtimeBrand,
    marketingSite: {
      templateKey,
      siteShell,
      pages,
    },
  };
}
