import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path, { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBrandProfile, resolveBrandId } from '../../scripts/lib/brand-profile-core.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..', '..');
const extensionDir = resolve(rootDir, 'extension');
const publicDir = resolve(extensionDir, 'public');
const distDir = resolve(extensionDir, 'dist');

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

async function ensureFile(sourcePath, label) {
  if (!sourcePath) {
    throw new Error(`missing ${label}`);
  }
  const resolved = path.resolve(rootDir, sourcePath);
  await readFile(resolved);
  return resolved;
}

async function resolveBrandContext() {
  const brandId = resolveBrandId(process.env.APP_NAME || process.env.ICLAW_BRAND || '');
  const { profile } = await loadBrandProfile({ rootDir, brandId, envName: process.env.NODE_ENV || 'dev' });
  const displayName = trimString(profile.displayName) || trimString(profile.productName) || brandId;
  return {
    brandId,
    displayName,
    productName: trimString(profile.productName) || displayName,
    assets: profile.assets || {},
  };
}

async function renderManifest(brand) {
  const templatePath = resolve(publicDir, 'manifest.json');
  const manifest = JSON.parse(await readFile(templatePath, 'utf8'));
  manifest.name = brand.displayName;
  manifest.short_name = brand.displayName;
  manifest.description = `${brand.displayName} 浏览器采集插件`;
  manifest.action = {
    ...(manifest.action || {}),
    default_title: brand.displayName,
  };
  return manifest;
}

async function copyBrandIcons(brand) {
  const logoSource = brand.assets.faviconPng || brand.assets.logoMaster || brand.assets.homeLogo;
  const appIconSource = brand.assets.faviconPng || brand.assets.logoMaster || brand.assets.homeLogo;
  if (logoSource) {
    await cp(await ensureFile(logoSource, 'extension logo'), resolve(distDir, 'logo.png'));
  }
  if (appIconSource) {
    await cp(await ensureFile(appIconSource, 'extension app icon'), resolve(distDir, 'app-icon.png'));
  }
}

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });
await cp(publicDir, distDir, { recursive: true });

const brand = await resolveBrandContext();
const manifest = await renderManifest(brand);
await writeFile(resolve(distDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
await copyBrandIcons(brand);
await writeFile(resolve(distDir, 'BUILD_ENV'), 'extension\n');
await mkdir(dirname(resolve(distDir, 'build-meta.json')), { recursive: true });
await writeFile(
  resolve(distDir, 'build-meta.json'),
  JSON.stringify(
    {
      name: '@iclaw/extension',
      brandId: brand.brandId,
      displayName: brand.displayName,
      productName: brand.productName,
      builtAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);
console.log(`[extension] built -> ${distDir} (${brand.brandId} / ${brand.displayName})`);
