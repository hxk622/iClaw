#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const desktopDir = path.join(rootDir, 'apps', 'desktop');
const tauriDir = path.join(desktopDir, 'src-tauri');
const outputBrandDir = path.join(desktopDir, 'public', 'brand');
const outputIconsDir = path.join(tauriDir, 'icons-generated');

const brandId = process.argv[2] || process.env.ICLAW_BRAND || 'iclaw';
const brandDir = path.join(rootDir, 'brands', brandId);
const brandConfigPath = path.join(brandDir, 'brand.json');
const tauriTemplatePath = path.join(tauriDir, 'tauri.conf.json');
const tauriGeneratedPath = path.join(tauriDir, 'tauri.generated.conf.json');
const brandGeneratedTsPath = path.join(desktopDir, 'src', 'app', 'lib', 'brand.generated.ts');
const brandGeneratedJsonPath = path.join(tauriDir, 'brand.generated.json');

function resolveBrandPath(rawPath) {
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
    },
    null,
    2,
  )} as const;\n`;
}

async function main() {
  const raw = await fs.readFile(brandConfigPath, 'utf8');
  const brand = JSON.parse(raw);

  const faviconIco = resolveBrandPath(brand.assets.faviconIco);
  const faviconPng = resolveBrandPath(brand.assets.faviconPng);
  const appleTouchIcon = resolveBrandPath(brand.assets.appleTouchIcon || brand.assets.faviconPng);
  const installerHero = resolveBrandPath(brand.assets.installerHero);
  const tauriIconsDir = resolveBrandPath(brand.assets.tauriIconsDir);

  await fs.mkdir(outputBrandDir, { recursive: true });
  await copyFile(faviconIco, path.join(outputBrandDir, 'favicon.ico'));
  await copyFile(faviconPng, path.join(outputBrandDir, 'favicon.png'));
  await copyFile(appleTouchIcon, path.join(outputBrandDir, 'apple-touch-icon.png'));
  await copyFile(installerHero, path.join(outputBrandDir, 'installer-hero.png'));
  await copyDirectory(tauriIconsDir, outputIconsDir);

  const tauriConfig = JSON.parse(await fs.readFile(tauriTemplatePath, 'utf8'));
  tauriConfig.productName = brand.productName;
  tauriConfig.identifier = brand.bundleIdentifier;
  if (Array.isArray(tauriConfig.app?.windows) && tauriConfig.app.windows[0]) {
    tauriConfig.app.windows[0].title = brand.productName;
  }
  tauriConfig.bundle = tauriConfig.bundle || {};
  tauriConfig.bundle.icon = [
    'icons-generated/32x32.png',
    'icons-generated/128x128.png',
    'icons-generated/128x128@2x.png',
    'icons-generated/icon.icns',
    'icons-generated/icon.ico',
  ];

  await fs.writeFile(tauriGeneratedPath, `${JSON.stringify(tauriConfig, null, 2)}\n`, 'utf8');
  await fs.writeFile(
    brandGeneratedJsonPath,
    `${JSON.stringify(
      {
        brandId: brand.brandId,
        productName: brand.productName,
        bundleIdentifier: brand.bundleIdentifier,
        authService: brand.authService,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  await fs.writeFile(brandGeneratedTsPath, buildBrandTs(brand), 'utf8');

  process.stdout.write(`[brand] applied ${brand.brandId}\n`);
}

main().catch((error) => {
  console.error(`[brand] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
