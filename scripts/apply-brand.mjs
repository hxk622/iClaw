#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { loadBrandProfile, resolveBrandId } from './lib/brand-profile.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const desktopDir = path.join(rootDir, 'apps', 'desktop');
const homeWebDir = path.join(rootDir, 'home-web');
const tauriDir = path.join(desktopDir, 'src-tauri');
const outputBrandDir = path.join(desktopDir, 'public', 'brand');
const outputPublicDir = path.join(desktopDir, 'public');
const outputIconsDir = path.join(tauriDir, 'icons-generated');
const outputInstallerAssetsDir = path.join(tauriDir, 'installer-generated');
const legacyInstallerAssetPath = path.join(desktopDir, 'src', 'app', 'assets', 'installer-lobster.png');
const homeWebPublicBrandDir = path.join(homeWebDir, 'public', 'brand');
const tauriTemplatePath = path.join(tauriDir, 'tauri.conf.json');
const tauriGeneratedPath = path.join(tauriDir, 'tauri.generated.conf.json');
const brandGeneratedTsPath = path.join(desktopDir, 'src', 'app', 'lib', 'brand.generated.ts');
const brandGeneratedJsonPath = path.join(tauriDir, 'brand.generated.json');
const homeWebBrandGeneratedJsPath = path.join(homeWebDir, 'brand.generated.js');
const rootPackageJsonPath = path.join(rootDir, 'package.json');

function resolveBrandPath(brandDir, rawPath) {
  if (typeof rawPath !== 'string' || !rawPath.trim()) {
    return null;
  }
  return path.resolve(brandDir, rawPath);
}

async function ensureFile(sourcePath, label) {
  if (!sourcePath) {
    throw new Error(`missing ${label}: unresolved source path`);
  }
  try {
    await fs.access(sourcePath);
  } catch {
    throw new Error(`missing ${label}: ${sourcePath}`);
  }
}

async function copyFile(sourcePath, targetPath) {
  await ensureFile(sourcePath, path.basename(targetPath));
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.copyFile(sourcePath, targetPath);
}

async function copyOptionalFile(sourcePath, targetPath) {
  if (!sourcePath) {
    await fs.rm(targetPath, { force: true });
    return;
  }
  await copyFile(sourcePath, targetPath);
}

async function copyFirstExistingFile(sourcePaths, targetPath) {
  for (const sourcePath of sourcePaths) {
    if (!sourcePath) {
      continue;
    }
    try {
      await fs.access(sourcePath);
      await copyFile(sourcePath, targetPath);
      return;
    } catch {}
  }
  throw new Error(`missing source for ${targetPath}: ${sourcePaths.filter(Boolean).join(', ')}`);
}

async function copyDirectory(sourcePath, targetPath) {
  await ensureFile(sourcePath, path.basename(targetPath));
  await fs.rm(targetPath, { recursive: true, force: true });
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.cp(sourcePath, targetPath, { recursive: true });
}

async function ensureTauriIcons(params) {
  const {
    faviconIco,
    faviconPng,
    tauriIconsDir,
    outputIconsDir,
  } = params;

  await fs.rm(outputIconsDir, { recursive: true, force: true });
  await fs.mkdir(outputIconsDir, { recursive: true });

  const tauri32x32 = tauriIconsDir ? path.join(tauriIconsDir, '32x32.png') : null;
  const tauri128x128 = tauriIconsDir ? path.join(tauriIconsDir, '128x128.png') : null;
  const tauri128x128Retina = tauriIconsDir ? path.join(tauriIconsDir, '128x128@2x.png') : null;
  const tauriIconPng = tauriIconsDir ? path.join(tauriIconsDir, 'icon.png') : null;

  // Tauri expects exact sizes and RGBA PNGs here. Reusing favicon.png can
  // produce a 512/1024 RGB asset masquerading as 32x32, which breaks release builds.
  await copyFirstExistingFile([tauri32x32, faviconPng], path.join(outputIconsDir, '32x32.png'));
  await copyFirstExistingFile([tauri128x128, tauriIconPng, faviconPng], path.join(outputIconsDir, '128x128.png'));
  await copyFirstExistingFile(
    [tauri128x128Retina, tauri128x128, tauriIconPng, faviconPng],
    path.join(outputIconsDir, '128x128@2x.png'),
  );
  await copyFirstExistingFile([tauriIconPng, faviconPng], path.join(outputIconsDir, 'icon.png'));
  await copyFile(faviconIco, path.join(outputIconsDir, 'icon.ico'));

  const icnsSourcePath = path.join(tauriIconsDir, 'icon.icns');
  await copyFile(icnsSourcePath, path.join(outputIconsDir, 'icon.icns'));
}

function buildBrandTs(brand) {
  return `export const BRAND = ${JSON.stringify(
    {
      brandId: brand.brandId,
      productName: brand.productName,
      displayName: brand.displayName,
      websiteTitle: brand.websiteTitle,
      devWebsiteTitle: `${brand.websiteTitle}-dev`,
      defaultThemeMode: brand.defaultThemeMode || 'dark',
      sidebarTitle: brand.productName,
      devSidebarTitle: `${brand.productName}-dev`,
      sidebarSubtitle: brand.sidebarSubtitle,
      legalName: brand.legalName,
      bundleIdentifier: brand.bundleIdentifier,
      authService: brand.authService,
      assets: {
        faviconIcoSrc: '/brand/favicon.ico',
        faviconPngSrc: '/brand/favicon.png',
        appleTouchIconSrc: '/brand/apple-touch-icon.png',
        installerHeroSrc: '/brand/installer-hero.png',
        assistantAvatarSrc: '/brand/assistant-avatar.png',
        logoAlt: `${brand.displayName} logo`,
      },
      theme: brand.theme,
      storage: {
        namespace: brand.storage.namespace,
      },
      endpoints: brand.endpoints,
      oauth: brand.oauth,
      website: brand.website,
      distribution: {
        artifactBaseName: brand.distribution.artifactBaseName,
      },
    },
    null,
    2,
  )} as const;\n`;
}

function resolveHomeReleaseVersion(appVersion) {
  const requested =
    (typeof process.env.ICLAW_HOME_PUBLIC_RELEASE_VERSION === 'string' ? process.env.ICLAW_HOME_PUBLIC_RELEASE_VERSION : '') ||
    (typeof process.env.ICLAW_RELEASE_VERSION === 'string' ? process.env.ICLAW_RELEASE_VERSION : '');
  const normalizedRequested = requested.trim();
  if (normalizedRequested) {
    return normalizedRequested.replace(/\+/g, '.');
  }
  return typeof appVersion === 'string' ? appVersion.replace(/\+/g, '.') : '0.0.0';
}

function buildHomeBrandJs(brand, appVersion) {
  return `export const HOME_BRAND = ${JSON.stringify(
    {
      brandId: brand.brandId,
      displayName: brand.displayName,
      defaultThemeMode: brand.defaultThemeMode || 'dark',
      website: brand.website,
      assets: {
        faviconPngSrc: '/brand/favicon.png',
        appleTouchIconSrc: '/brand/apple-touch-icon.png',
        logoSrc: '/brand/logo.png',
        heroArtSrc: brand.assets.homeHeroArt ? '/brand/hero-art.svg' : '/hero-art.svg',
        heroLayer1Src: brand.assets.homeHeroLayer1 ? '/brand/hero-layer-1.svg' : '/hero-layer-1.svg',
        heroLayer2Src: brand.assets.homeHeroLayer2 ? '/brand/hero-layer-2.svg' : '/hero-layer-2.svg',
        heroPhotoSrc: brand.assets.homeHeroPhoto ? '/brand/hero-photo.jpg' : '/hero-photo.jpg',
        logoAlt: `${brand.displayName} logo`,
      },
      release: {
        version: resolveHomeReleaseVersion(appVersion),
        artifactBaseName: brand.distribution.artifactBaseName,
      },
      distribution: brand.distribution,
    },
    null,
    2,
  )};\n`;
}

async function main() {
  const brandId = resolveBrandId(process.argv[2]);
  const { brandDir, profile: brand } = await loadBrandProfile({ rootDir, brandId });
  const rootPackageJson = JSON.parse(await fs.readFile(rootPackageJsonPath, 'utf8'));
  const appVersion = typeof rootPackageJson.version === 'string' ? rootPackageJson.version : '0.0.0';

  const faviconIco = resolveBrandPath(brandDir, brand.assets.faviconIco);
  const faviconPng = resolveBrandPath(brandDir, brand.assets.faviconPng);
  const appleTouchIcon = resolveBrandPath(brandDir, brand.assets.appleTouchIcon || brand.assets.faviconPng);
  const installerHero = resolveBrandPath(brandDir, brand.assets.installerHero);
  const tauriIconsDir = resolveBrandPath(brandDir, brand.assets.tauriIconsDir);
  const dmgBackground = brand.assets.dmgBackground
    ? resolveBrandPath(brandDir, brand.assets.dmgBackground)
    : installerHero;
  const dmgVolumeIcon = brand.assets.dmgVolumeIcon
    ? resolveBrandPath(brandDir, brand.assets.dmgVolumeIcon)
    : path.join(tauriIconsDir || '', 'icon.icns');
  const windowsInstallerHeaderImage = brand.assets.windowsInstallerHeaderImage
    ? resolveBrandPath(brandDir, brand.assets.windowsInstallerHeaderImage)
    : null;
  const windowsInstallerSidebarImage = brand.assets.windowsInstallerSidebarImage
    ? resolveBrandPath(brandDir, brand.assets.windowsInstallerSidebarImage)
    : null;
  const windowsInstallerIcon = brand.assets.windowsInstallerIcon
    ? resolveBrandPath(brandDir, brand.assets.windowsInstallerIcon)
    : path.join(tauriIconsDir || '', 'icon.ico');
  const homeLogo = brand.assets.homeLogo
    ? resolveBrandPath(brandDir, brand.assets.homeLogo)
    : resolveBrandPath(brandDir, brand.assets.faviconPng);
  const assistantAvatar = brand.assets.assistantAvatar
    ? resolveBrandPath(brandDir, brand.assets.assistantAvatar)
    : brand.assets.logoMaster
      ? resolveBrandPath(brandDir, brand.assets.logoMaster)
      : tauriIconsDir
        ? path.join(tauriIconsDir, 'icon.png')
        : faviconPng;
  const homeHeroArt = brand.assets.homeHeroArt ? resolveBrandPath(brandDir, brand.assets.homeHeroArt) : null;
  const homeHeroLayer1 = brand.assets.homeHeroLayer1 ? resolveBrandPath(brandDir, brand.assets.homeHeroLayer1) : null;
  const homeHeroLayer2 = brand.assets.homeHeroLayer2 ? resolveBrandPath(brandDir, brand.assets.homeHeroLayer2) : null;
  const homeHeroPhoto = brand.assets.homeHeroPhoto ? resolveBrandPath(brandDir, brand.assets.homeHeroPhoto) : null;

  await fs.mkdir(outputBrandDir, { recursive: true });
  await fs.mkdir(outputPublicDir, { recursive: true });
  await fs.mkdir(homeWebPublicBrandDir, { recursive: true });
  await fs.mkdir(outputInstallerAssetsDir, { recursive: true });
  await copyFile(faviconIco, path.join(outputBrandDir, 'favicon.ico'));
  await copyFile(faviconPng, path.join(outputBrandDir, 'favicon.png'));
  await copyFile(appleTouchIcon, path.join(outputBrandDir, 'apple-touch-icon.png'));
  await copyFile(installerHero, path.join(outputBrandDir, 'installer-hero.png'));
  await copyFile(assistantAvatar, path.join(outputBrandDir, 'assistant-avatar.png'));
  await copyFile(faviconIco, path.join(outputPublicDir, 'favicon.ico'));
  await copyFile(faviconPng, path.join(outputPublicDir, 'favicon.png'));
  await copyFile(appleTouchIcon, path.join(outputPublicDir, 'apple-touch-icon.png'));
  await copyFile(installerHero, legacyInstallerAssetPath);
  await ensureTauriIcons({
    faviconIco,
    faviconPng,
    tauriIconsDir,
    outputIconsDir,
  });
  await copyFile(dmgBackground, path.join(outputInstallerAssetsDir, 'dmg-background.png'));
  await copyFile(dmgVolumeIcon, path.join(outputInstallerAssetsDir, 'dmg-volume.icns'));
  await copyFile(windowsInstallerIcon, path.join(outputInstallerAssetsDir, 'nsis-installer.ico'));
  await copyOptionalFile(
    windowsInstallerHeaderImage,
    path.join(outputInstallerAssetsDir, 'nsis-header.bmp'),
  );
  await copyOptionalFile(
    windowsInstallerSidebarImage,
    path.join(outputInstallerAssetsDir, 'nsis-sidebar.bmp'),
  );
  await copyFile(faviconPng, path.join(homeWebPublicBrandDir, 'favicon.png'));
  await copyFile(appleTouchIcon, path.join(homeWebPublicBrandDir, 'apple-touch-icon.png'));
  await copyFile(homeLogo, path.join(homeWebPublicBrandDir, 'logo.png'));
  await copyOptionalFile(homeHeroArt, path.join(homeWebPublicBrandDir, 'hero-art.svg'));
  await copyOptionalFile(homeHeroLayer1, path.join(homeWebPublicBrandDir, 'hero-layer-1.svg'));
  await copyOptionalFile(homeHeroLayer2, path.join(homeWebPublicBrandDir, 'hero-layer-2.svg'));
  await copyOptionalFile(homeHeroPhoto, path.join(homeWebPublicBrandDir, 'hero-photo.jpg'));

  const tauriConfig = JSON.parse(await fs.readFile(tauriTemplatePath, 'utf8'));
  tauriConfig.productName = brand.productName;
  tauriConfig.identifier = brand.bundleIdentifier;
  if (Array.isArray(tauriConfig.app?.windows) && tauriConfig.app.windows[0]) {
    tauriConfig.app.windows[0].title = brand.productName;
  }
  tauriConfig.bundle = tauriConfig.bundle || {};
  tauriConfig.bundle.windows = tauriConfig.bundle.windows || {};
  tauriConfig.bundle.windows.nsis = tauriConfig.bundle.windows.nsis || {};
  tauriConfig.bundle.createUpdaterArtifacts = Boolean((process.env.TAURI_SIGNING_PRIVATE_KEY || '').trim());
  tauriConfig.bundle.icon = [
    'icons-generated/32x32.png',
    'icons-generated/128x128.png',
    'icons-generated/128x128@2x.png',
    'icons-generated/icon.icns',
    'icons-generated/icon.ico',
  ];
  tauriConfig.bundle.windows.nsis.installerIcon = 'installer-generated/nsis-installer.ico';
  if (windowsInstallerHeaderImage) {
    tauriConfig.bundle.windows.nsis.headerImage = 'installer-generated/nsis-header.bmp';
  } else {
    delete tauriConfig.bundle.windows.nsis.headerImage;
  }
  if (windowsInstallerSidebarImage) {
    tauriConfig.bundle.windows.nsis.sidebarImage = 'installer-generated/nsis-sidebar.bmp';
  } else {
    delete tauriConfig.bundle.windows.nsis.sidebarImage;
  }
  const updaterPubkey = (process.env.TAURI_UPDATER_PUBLIC_KEY || '').trim();
  if (updaterPubkey) {
    tauriConfig.plugins = tauriConfig.plugins || {};
    tauriConfig.plugins.updater = {
      pubkey: updaterPubkey,
    };
  } else if (tauriConfig.plugins && typeof tauriConfig.plugins === 'object') {
    delete tauriConfig.plugins.updater;
    if (Object.keys(tauriConfig.plugins).length === 0) {
      delete tauriConfig.plugins;
    }
  }

  await fs.writeFile(tauriGeneratedPath, `${JSON.stringify(tauriConfig, null, 2)}\n`, 'utf8');
  await fs.writeFile(
    brandGeneratedJsonPath,
    `${JSON.stringify(
      {
        brandId: brand.brandId,
        productName: brand.productName,
        bundleIdentifier: brand.bundleIdentifier,
        authService: brand.authService,
        endpoints: brand.endpoints,
        artifactBaseName: brand.distribution.artifactBaseName,
        storageNamespace: brand.storage.namespace,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  await fs.writeFile(brandGeneratedTsPath, buildBrandTs(brand), 'utf8');
  await fs.writeFile(homeWebBrandGeneratedJsPath, buildHomeBrandJs(brand, appVersion), 'utf8');

  process.stdout.write(`[brand] applied ${brand.brandId}\n`);
}

main().catch((error) => {
  console.error(`[brand] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
