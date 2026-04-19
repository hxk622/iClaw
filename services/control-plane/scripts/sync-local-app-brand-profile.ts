import {access, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {dirname, extname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {config} from '../src/config.ts';
import {downloadPortalAssetFile} from '../src/portal-asset-storage.ts';
import type {PortalAppAssetRecord, PortalAppDetail} from '../src/portal-domain.ts';
import {PgPortalStore} from '../src/portal-store.ts';
import {HttpError} from '../src/errors.ts';

function readArg(name: string): string | null {
  const index = process.argv.findIndex((item) => item === name);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStringArray(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const items = value.map((item) => trimString(item)).filter(Boolean);
  return items.length > 0 ? items : fallback;
}

function localDesktopOrigins(): string[] {
  return [
    'http://127.0.0.1:1520',
    'http://localhost:1520',
    'https://tauri.localhost',
    'http://tauri.localhost',
    'tauri://localhost',
  ];
}

function normalizeWebsite(raw: unknown, displayName: string) {
  const website = asObject(raw);
  return {
    homeTitle: trimString(website.homeTitle) || `${displayName} 官网`,
    metaDescription:
      trimString(website.metaDescription) || `${displayName} 官网，面向普通用户的本地 AI 客户端。`,
    brandLabel: trimString(website.brandLabel) || displayName,
    kicker: trimString(website.kicker) || 'Official Website',
    heroTitlePre: trimString(website.heroTitlePre) || '让 AI 真正像软件一样',
    heroTitleMain: trimString(website.heroTitleMain) || '装上就能用',
    heroDescription:
      trimString(website.heroDescription) ||
      `${displayName} 面向普通用户设计。少一点配置，多一点结果。打开、提问、执行、拿答案。`,
    topCtaLabel: trimString(website.topCtaLabel) || '下载',
    scrollLabel: trimString(website.scrollLabel) || '向下下载',
    downloadTitle: trimString(website.downloadTitle) || `下载 ${displayName}`,
  };
}

function defaultMarketingTemplateKey(brandId: string): string {
  return brandId === 'caiclaw' ? 'wealth-premium' : 'classic-download';
}

function normalizeMarketingSite(raw: unknown, brandId: string) {
  const source = asObject(raw);
  const nested = asObject(source.marketingSite);
  const siteShell = asObject(source.siteShell);
  return {
    templateKey: trimString(source.templateKey || nested.templateKey) || defaultMarketingTemplateKey(brandId),
    siteShell: Object.keys(siteShell).length > 0 ? siteShell : asObject(nested.siteShell),
    pages: Array.isArray(source.pages) ? source.pages : Array.isArray(nested.pages) ? nested.pages : [],
  };
}

function findAsset(detail: PortalAppDetail, assetKey: string): PortalAppAssetRecord | null {
  const direct = detail.assets.find((item) => item.assetKey === assetKey) || null;
  if (direct) {
    return direct;
  }

  const publishedConfig = asObject(detail.releases[0]?.config);
  const assets = asObject(publishedConfig.assets);
  const raw = asObject(assets[assetKey]);
  const objectKey = trimString(raw.objectKey || raw.object_key);
  if (!objectKey) {
    return null;
  }

  return {
    id: `published:${detail.app.appName}:${assetKey}`,
    appName: detail.app.appName,
    assetKey,
    storageProvider: trimString(raw.storageProvider || raw.storage_provider) || 's3',
    objectKey,
    publicUrl: trimString(raw.url || raw.publicUrl || raw.public_url) || null,
    contentType: trimString(raw.contentType || raw.content_type) || null,
    sha256: null,
    sizeBytes: null,
    metadata: asObject(raw.metadata),
    createdAt: '',
    updatedAt: '',
  };
}

async function writeAssetFile(
  detail: PortalAppDetail,
  repoRoot: string,
  cacheRoot: string,
  assetKey: string,
  relativePath: string,
): Promise<string | null> {
  const asset = findAsset(detail, assetKey);
  if (!asset) {
    return null;
  }
  const file = await downloadPortalAssetFile({
    appName: detail.app.appName,
    assetKey,
    storageProvider: asset.storageProvider || 's3',
    objectKey: asset.objectKey,
    contentType: asset.contentType,
  }).catch((error) => {
    if (error instanceof HttpError && error.statusCode === 404) {
      return null;
    }
    throw error;
  });

  const targetPath = resolve(cacheRoot, relativePath);
  await mkdir(dirname(targetPath), {recursive: true});

  if (file) {
    await writeFile(targetPath, file.buffer);
    return `./${relativePath}`;
  }

  const metadata = asObject(asset.metadata);
  const repoAssetPath = trimString(
    metadata.repoAssetPath || metadata.repo_asset_path || metadata.presetFilePath || metadata.preset_file_path,
  );
  if (!repoAssetPath) {
    return null;
  }

  const repoAssetSourcePath = resolve(repoRoot, 'services/control-plane', repoAssetPath);
  const repoAssetBuffer = await readFile(repoAssetSourcePath).catch(() => null);
  if (!repoAssetBuffer) {
    return null;
  }

  await writeFile(targetPath, repoAssetBuffer);
  return `./${relativePath}`;
}

async function relativePathIfExists(cacheRoot: string, relativePath: string): Promise<string | null> {
  try {
    await access(resolve(cacheRoot, relativePath));
    return `./${relativePath}`;
  } catch {
    return null;
  }
}

function buildProfile(detail: PortalAppDetail, cachedAssets: Record<string, string | null>) {
  const appConfig = asObject(detail.app.config);
  const brandMeta = {
    ...asObject(appConfig.brand_meta),
    ...asObject(appConfig.brandMeta),
  };
  const storage = asObject(appConfig.storage);
  const oauth = asObject(appConfig.oauth);
  const distribution = asObject(appConfig.distribution);
  const distributionDownloads = asObject(distribution.downloads);
  const runtimeDistribution = asObject(appConfig.runtimeDistribution || appConfig.runtime_distribution);
  const runtimeDev = asObject(runtimeDistribution.dev);
  const runtimeProd = asObject(runtimeDistribution.prod);
  const controlPlane = asObject(appConfig.controlPlane || appConfig.control_plane);
  const website = normalizeWebsite(appConfig.website, detail.app.displayName);
  const surfaces = asObject(appConfig.surfaces);
  const homeWebSurface = asObject(surfaces['home-web']);
  const homeWebSurfaceConfig = asObject(homeWebSurface.config);
  const productName =
    trimString(appConfig.productName || appConfig.product_name || brandMeta.product_name || brandMeta.productName) ||
    detail.app.displayName;
  const brandId = detail.app.appName;

  return {
    brandId,
    productName,
    displayName: detail.app.displayName,
    websiteTitle: trimString(appConfig.websiteTitle || appConfig.website_title) || productName,
    defaultThemeMode: trimString(asObject(appConfig.theme).defaultMode || asObject(appConfig.theme).default_mode) || 'dark',
    sidebarSubtitle: trimString(appConfig.sidebarSubtitle || appConfig.sidebar_subtitle),
    legalName: trimString(appConfig.legalName || appConfig.legal_name || brandMeta.legal_name) || detail.app.displayName,
    bundleIdentifier: trimString(appConfig.bundleIdentifier || appConfig.bundle_identifier),
    authService: trimString(appConfig.authService || appConfig.auth_service),
    theme: appConfig.theme || {},
    assets: {
      faviconIco: cachedAssets.faviconIco,
      faviconPng: cachedAssets.faviconPng,
      appleTouchIcon: cachedAssets.appleTouchIcon || cachedAssets.faviconPng,
      installerHero: cachedAssets.installerHero,
      tauriIconsDir: cachedAssets.tauriIconsDir,
      assistantAvatar: cachedAssets.assistantAvatar,
      brandMark: cachedAssets.brandMark,
      logoMaster: cachedAssets.logoMaster,
      homeLogo: cachedAssets.homeLogo,
      homeHeroArt: cachedAssets.homeHeroArt,
      homeHeroLayer1: cachedAssets.homeHeroLayer1,
      homeHeroLayer2: cachedAssets.homeHeroLayer2,
      homeHeroPhoto: cachedAssets.homeHeroPhoto,
    },
    storage: {
      namespace: trimString(storage.namespace || brandMeta.storage_namespace) || brandId,
    },
    oauth: {
      wechat: {
        appId: trimString(asObject(oauth.wechat).appId || asObject(oauth.wechat).app_id),
        redirectUri: trimString(asObject(oauth.wechat).redirectUri || asObject(oauth.wechat).redirect_uri),
      },
      google: {
        clientId: trimString(asObject(oauth.google).clientId || asObject(oauth.google).client_id),
        redirectUri: trimString(asObject(oauth.google).redirectUri || asObject(oauth.google).redirect_uri),
      },
    },
    website,
    marketingSite: normalizeMarketingSite(homeWebSurfaceConfig, brandId),
    distribution: {
      artifactBaseName: trimString(distribution.artifactBaseName || distribution.artifact_base_name) || productName,
      downloads: {
        dev: {
          bucket:
            trimString(asObject(distributionDownloads.dev).bucket) ||
            `${brandId}-dev`,
          publicBaseUrl: trimString(asObject(asObject(distributionDownloads.dev)).publicBaseUrl),
        },
        prod: {
          bucket:
            trimString(asObject(distributionDownloads.prod).bucket) ||
            `${brandId}-prod`,
          publicBaseUrl: trimString(asObject(asObject(distributionDownloads.prod)).publicBaseUrl),
        },
      },
      home: {
        nginxPath: trimString(asObject(distribution.home).nginxPath) || `/var/www/${brandId}-home`,
      },
    },
    runtimeDistribution: {
      minioPrefix: trimString(runtimeDistribution.minioPrefix || runtimeDistribution.minio_prefix) || 'runtime',
      dev: {
        bucket: trimString(runtimeDev.bucket) || `${brandId}-dev`,
        publicBaseUrl: trimString(runtimeDev.publicBaseUrl || runtimeDev.public_base_url),
      },
      prod: {
        bucket: trimString(runtimeProd.bucket) || `${brandId}-prod`,
        publicBaseUrl: trimString(runtimeProd.publicBaseUrl || runtimeProd.public_base_url),
      },
    },
    controlPlane: {
      serviceName: trimString(controlPlane.serviceName || controlPlane.service_name) || `${brandId}-control-plane`,
      s3Bucket: trimString(controlPlane.s3Bucket || controlPlane.s3_bucket) || `${brandId}-files`,
      redisKeyPrefix:
        trimString(controlPlane.redisKeyPrefix || controlPlane.redis_key_prefix) || `${brandId}:control-plane`,
      allowedOrigins: normalizeStringArray(controlPlane.allowedOrigins || controlPlane.allowed_origins, localDesktopOrigins()),
    },
  };
}

async function main() {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const rawPositional = process.argv.slice(2).find((item) => !item.startsWith('--')) || '';
  const appName = trimString(readArg('--app') || process.env.APP_NAME || process.env.ICLAW_PORTAL_APP_NAME || rawPositional || '').toLowerCase();
  if (!appName) {
    throw new Error('app name is required');
  }

  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(scriptDir, '../../..');
  const cacheRoot = resolve(repoRoot, '.cache/portal-apps', appName);
  const store = new PgPortalStore(config.databaseUrl);

  try {
    const detail = await store.getAppDetail(appName);
    if (!detail) {
      throw new Error(`portal app not found: ${appName}`);
    }

    await rm(resolve(cacheRoot, 'assets'), {recursive: true, force: true});
    await mkdir(cacheRoot, {recursive: true});

    await writeAssetFile(detail, repoRoot, cacheRoot, 'faviconIco', 'assets/favicon.ico');
    await writeAssetFile(detail, repoRoot, cacheRoot, 'faviconPng', 'assets/favicon.png');
    await writeAssetFile(detail, repoRoot, cacheRoot, 'appleTouchIcon', 'assets/apple-touch-icon.png');
    await writeAssetFile(detail, repoRoot, cacheRoot, 'installerHero', 'assets/installer-hero.png');
    await writeAssetFile(
      detail,
      repoRoot,
      cacheRoot,
      'assistantAvatar',
      `assets/assistant-avatar${extname(findAsset(detail, 'assistantAvatar')?.objectKey || '') || '.png'}`,
    );
    await writeAssetFile(
      detail,
      repoRoot,
      cacheRoot,
      'brandMark',
      `assets/brand-mark${extname(findAsset(detail, 'brandMark')?.objectKey || '') || '.png'}`,
    );
    await writeAssetFile(
      detail,
      repoRoot,
      cacheRoot,
      'logoMaster',
      `assets/logo-master${extname(findAsset(detail, 'logoMaster')?.objectKey || '') || '.png'}`,
    );
    await writeAssetFile(
      detail,
      repoRoot,
      cacheRoot,
      'homeLogo',
      `assets/home-logo${extname(findAsset(detail, 'homeLogo')?.objectKey || '') || '.png'}`,
    );
    await writeAssetFile(detail, repoRoot, cacheRoot, 'homeHeroArt', 'assets/hero-art.svg');
    await writeAssetFile(detail, repoRoot, cacheRoot, 'homeHeroLayer1', 'assets/hero-layer-1.svg');
    await writeAssetFile(detail, repoRoot, cacheRoot, 'homeHeroLayer2', 'assets/hero-layer-2.svg');
    await writeAssetFile(
      detail,
      repoRoot,
      cacheRoot,
      'homeHeroPhoto',
      `assets/hero-photo${extname(findAsset(detail, 'homeHeroPhoto')?.objectKey || '') || '.jpg'}`,
    );
    await writeAssetFile(detail, repoRoot, cacheRoot, 'tauriIcon32', 'assets/tauri-icons/32x32.png');
    await writeAssetFile(detail, repoRoot, cacheRoot, 'tauriIcon128', 'assets/tauri-icons/128x128.png');
    await writeAssetFile(detail, repoRoot, cacheRoot, 'tauriIcon1282x', 'assets/tauri-icons/128x128@2x.png');
    await writeAssetFile(detail, repoRoot, cacheRoot, 'tauriIconPng', 'assets/tauri-icons/icon.png');
    await writeAssetFile(detail, repoRoot, cacheRoot, 'tauriIconIco', 'assets/tauri-icons/icon.ico');
    await writeAssetFile(detail, repoRoot, cacheRoot, 'tauriIconIcns', 'assets/tauri-icons/icon.icns');

    const cachedAssets = {
      faviconIco: await relativePathIfExists(cacheRoot, 'assets/favicon.ico'),
      faviconPng: await relativePathIfExists(cacheRoot, 'assets/favicon.png'),
      appleTouchIcon: await relativePathIfExists(cacheRoot, 'assets/apple-touch-icon.png'),
      installerHero: await relativePathIfExists(cacheRoot, 'assets/installer-hero.png'),
      assistantAvatar: await relativePathIfExists(
        cacheRoot,
        `assets/assistant-avatar${extname(findAsset(detail, 'assistantAvatar')?.objectKey || '') || '.png'}`,
      ),
      brandMark: await relativePathIfExists(
        cacheRoot,
        `assets/brand-mark${extname(findAsset(detail, 'brandMark')?.objectKey || '') || '.png'}`,
      ),
      logoMaster: await relativePathIfExists(
        cacheRoot,
        `assets/logo-master${extname(findAsset(detail, 'logoMaster')?.objectKey || '') || '.png'}`,
      ),
      homeLogo: await relativePathIfExists(
        cacheRoot,
        `assets/home-logo${extname(findAsset(detail, 'homeLogo')?.objectKey || '') || '.png'}`,
      ),
      homeHeroArt: await relativePathIfExists(cacheRoot, 'assets/hero-art.svg'),
      homeHeroLayer1: await relativePathIfExists(cacheRoot, 'assets/hero-layer-1.svg'),
      homeHeroLayer2: await relativePathIfExists(cacheRoot, 'assets/hero-layer-2.svg'),
      homeHeroPhoto: await relativePathIfExists(
        cacheRoot,
        `assets/hero-photo${extname(findAsset(detail, 'homeHeroPhoto')?.objectKey || '') || '.jpg'}`,
      ),
      tauriIcon32: await relativePathIfExists(cacheRoot, 'assets/tauri-icons/32x32.png'),
      tauriIcon128: await relativePathIfExists(cacheRoot, 'assets/tauri-icons/128x128.png'),
      tauriIcon1282x: await relativePathIfExists(cacheRoot, 'assets/tauri-icons/128x128@2x.png'),
      tauriIconPng: await relativePathIfExists(cacheRoot, 'assets/tauri-icons/icon.png'),
      tauriIconIco: await relativePathIfExists(cacheRoot, 'assets/tauri-icons/icon.ico'),
      tauriIconIcns: await relativePathIfExists(cacheRoot, 'assets/tauri-icons/icon.icns'),
    };

    const tauriIconsDir =
      cachedAssets.tauriIcon32 &&
      cachedAssets.tauriIcon128 &&
      cachedAssets.tauriIcon1282x &&
      cachedAssets.tauriIconPng &&
      cachedAssets.tauriIconIco &&
      cachedAssets.tauriIconIcns
        ? './assets/tauri-icons'
        : null;

    const profile = buildProfile(detail, {
      ...cachedAssets,
      tauriIconsDir,
    });
    await writeFile(resolve(cacheRoot, 'profile.json'), `${JSON.stringify(profile, null, 2)}\n`, 'utf8');

    console.log(
      JSON.stringify(
        {
          ok: true,
          appName,
          cacheRoot,
          profilePath: resolve(cacheRoot, 'profile.json'),
          assetCount: detail.assets.length,
          tauriIconsReady: Boolean(tauriIconsDir),
        },
        null,
        2,
      ),
    );
  } finally {
    await store.close();
  }
}

await main();
