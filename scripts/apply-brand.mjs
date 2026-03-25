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
const legacyInstallerAssetPath = path.join(desktopDir, 'src', 'app', 'assets', 'installer-lobster.png');
const homeWebPublicBrandDir = path.join(homeWebDir, 'public', 'brand');
const tauriTemplatePath = path.join(tauriDir, 'tauri.conf.json');
const tauriGeneratedPath = path.join(tauriDir, 'tauri.generated.conf.json');
const brandGeneratedTsPath = path.join(desktopDir, 'src', 'app', 'lib', 'brand.generated.ts');
const brandGeneratedJsonPath = path.join(tauriDir, 'brand.generated.json');
const homeWebBrandGeneratedJsPath = path.join(homeWebDir, 'brand.generated.js');
const rootPackageJsonPath = path.join(rootDir, 'package.json');

function resolveBrandPath(brandDir, rawPath) {
  return path.resolve(brandDir, rawPath);
}

async function ensureFile(sourcePath, label) {
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

async function copyDirectory(sourcePath, targetPath) {
  await ensureFile(sourcePath, path.basename(targetPath));
  await fs.rm(targetPath, { recursive: true, force: true });
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.cp(sourcePath, targetPath, { recursive: true });
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
        assistantAvatarSrc: '/brand/favicon.png',
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
        version: appVersion,
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
  const homeLogo = brand.assets.homeLogo
    ? resolveBrandPath(brandDir, brand.assets.homeLogo)
    : resolveBrandPath(brandDir, brand.assets.faviconPng);
  const homeHeroArt = brand.assets.homeHeroArt ? resolveBrandPath(brandDir, brand.assets.homeHeroArt) : null;
  const homeHeroLayer1 = brand.assets.homeHeroLayer1 ? resolveBrandPath(brandDir, brand.assets.homeHeroLayer1) : null;
  const homeHeroLayer2 = brand.assets.homeHeroLayer2 ? resolveBrandPath(brandDir, brand.assets.homeHeroLayer2) : null;
  const homeHeroPhoto = brand.assets.homeHeroPhoto ? resolveBrandPath(brandDir, brand.assets.homeHeroPhoto) : null;

  await fs.mkdir(outputBrandDir, { recursive: true });
  await fs.mkdir(outputPublicDir, { recursive: true });
  await fs.mkdir(homeWebPublicBrandDir, { recursive: true });
  await copyFile(faviconIco, path.join(outputBrandDir, 'favicon.ico'));
  await copyFile(faviconPng, path.join(outputBrandDir, 'favicon.png'));
  await copyFile(appleTouchIcon, path.join(outputBrandDir, 'apple-touch-icon.png'));
  await copyFile(installerHero, path.join(outputBrandDir, 'installer-hero.png'));
  await copyFile(faviconIco, path.join(outputPublicDir, 'favicon.ico'));
  await copyFile(faviconPng, path.join(outputPublicDir, 'favicon.png'));
  await copyFile(appleTouchIcon, path.join(outputPublicDir, 'apple-touch-icon.png'));
  await copyFile(installerHero, legacyInstallerAssetPath);
  await copyDirectory(tauriIconsDir, outputIconsDir);
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
  tauriConfig.bundle.createUpdaterArtifacts = Boolean((process.env.TAURI_SIGNING_PRIVATE_KEY || '').trim());
  tauriConfig.bundle.icon = [
    'icons-generated/32x32.png',
    'icons-generated/128x128.png',
    'icons-generated/128x128@2x.png',
    'icons-generated/icon.icns',
    'icons-generated/icon.ico',
  ];
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
