#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultRootDir = path.resolve(__dirname, '..', '..');

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStringArray(value, fallback = []) {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const items = value
    .map((entry) => trimString(entry))
    .filter(Boolean);
  return items.length > 0 ? items : fallback;
}

function localDesktopOrigins() {
  return [
    'http://127.0.0.1:1520',
    'http://localhost:1520',
    'https://tauri.localhost',
    'http://tauri.localhost',
    'tauri://localhost',
  ];
}

function assetPathOrNull(value) {
  const normalized = trimString(value);
  return normalized || null;
}

function normalizeWebsite(raw, displayName) {
  const website = raw?.website || {};
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

function normalizeProfile(raw) {
  const displayName = trimString(raw.displayName) || trimString(raw.productName) || trimString(raw.brandId);
  const brandId = trimString(raw.brandId);
  const artifactBaseName = trimString(raw?.distribution?.artifactBaseName) || displayName.replace(/\s+/g, '');
  const storageNamespace = trimString(raw?.storage?.namespace) || brandId;
  const downloadDevBucket = trimString(raw?.distribution?.downloads?.dev?.bucket) || `${brandId}-dev`;
  const downloadProdBucket = trimString(raw?.distribution?.downloads?.prod?.bucket) || `${brandId}-prod`;
  const runtimeDevBucket = trimString(raw?.runtimeDistribution?.dev?.bucket) || downloadDevBucket;
  const runtimeProdBucket = trimString(raw?.runtimeDistribution?.prod?.bucket) || downloadProdBucket;

  return {
    brandId,
    productName: trimString(raw.productName),
    displayName,
    websiteTitle: trimString(raw.websiteTitle) || trimString(raw.productName) || displayName,
    sidebarSubtitle: trimString(raw.sidebarSubtitle),
    legalName: trimString(raw.legalName) || displayName,
    bundleIdentifier: trimString(raw.bundleIdentifier),
    authService: trimString(raw.authService),
    theme: raw.theme,
    assets: {
      faviconIco: trimString(raw?.assets?.faviconIco),
      faviconPng: trimString(raw?.assets?.faviconPng),
      appleTouchIcon: trimString(raw?.assets?.appleTouchIcon) || trimString(raw?.assets?.faviconPng),
      installerHero: trimString(raw?.assets?.installerHero),
      tauriIconsDir: trimString(raw?.assets?.tauriIconsDir),
      logoMaster: assetPathOrNull(raw?.assets?.logoMaster),
      homeLogo: assetPathOrNull(raw?.assets?.homeLogo),
      homeHeroArt: assetPathOrNull(raw?.assets?.homeHeroArt),
      homeHeroLayer1: assetPathOrNull(raw?.assets?.homeHeroLayer1),
      homeHeroLayer2: assetPathOrNull(raw?.assets?.homeHeroLayer2),
      homeHeroPhoto: assetPathOrNull(raw?.assets?.homeHeroPhoto),
    },
    storage: {
      namespace: storageNamespace,
    },
    endpoints: {
      authBaseUrl: trimString(raw?.endpoints?.authBaseUrl),
    },
    oauth: {
      wechat: {
        appId: trimString(raw?.oauth?.wechat?.appId),
        redirectUri: trimString(raw?.oauth?.wechat?.redirectUri),
      },
      google: {
        clientId: trimString(raw?.oauth?.google?.clientId),
        redirectUri: trimString(raw?.oauth?.google?.redirectUri),
      },
    },
    website: normalizeWebsite(raw, displayName),
    distribution: {
      artifactBaseName,
      downloads: {
        dev: {
          bucket: downloadDevBucket,
          publicBaseUrl:
            trimString(raw?.distribution?.downloads?.dev?.publicBaseUrl) ||
            `http://127.0.0.1:9000/${downloadDevBucket}`,
        },
        prod: {
          bucket: downloadProdBucket,
          publicBaseUrl: trimString(raw?.distribution?.downloads?.prod?.publicBaseUrl),
        },
      },
      home: {
        nginxPath: trimString(raw?.distribution?.home?.nginxPath) || `/var/www/${brandId}-home`,
      },
    },
    runtimeDistribution: {
      minioPrefix: trimString(raw?.runtimeDistribution?.minioPrefix) || 'runtime',
      dev: {
        bucket: runtimeDevBucket,
        publicBaseUrl:
          trimString(raw?.runtimeDistribution?.dev?.publicBaseUrl) ||
          `http://127.0.0.1:9000/${runtimeDevBucket}`,
      },
      prod: {
        bucket: runtimeProdBucket,
        publicBaseUrl: trimString(raw?.runtimeDistribution?.prod?.publicBaseUrl),
      },
    },
    controlPlane: {
      serviceName: trimString(raw?.controlPlane?.serviceName) || `${brandId}-control-plane`,
      s3Bucket: trimString(raw?.controlPlane?.s3Bucket) || `${brandId}-files`,
      redisKeyPrefix: trimString(raw?.controlPlane?.redisKeyPrefix) || `${brandId}:control-plane`,
      allowedOrigins: normalizeStringArray(raw?.controlPlane?.allowedOrigins, localDesktopOrigins()),
    },
  };
}

export function resolveBrandId(brandId = process.env.ICLAW_BRAND || '') {
  const normalized = trimString(brandId);
  return normalized || 'iclaw';
}

export async function loadBrandProfile(options = {}) {
  const rootDir = options.rootDir ? path.resolve(options.rootDir) : defaultRootDir;
  const brandId = resolveBrandId(options.brandId);
  const brandDir = path.join(rootDir, 'brands', brandId);
  const brandConfigPath = path.join(brandDir, 'brand.json');
  const raw = JSON.parse(await fs.readFile(brandConfigPath, 'utf8'));
  const profile = normalizeProfile(raw);
  return {
    rootDir,
    brandDir,
    brandConfigPath,
    profile,
  };
}
