#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { loadDesktopBrandContext, pruneDesktopBrandStages } from './lib/desktop-brand-context.mjs';
import { isFalsyEnv } from './lib/desktop-release-artifacts.mjs';
import { spawnSync } from 'node:child_process';

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
const tauriTemplatePath = path.join(tauriDir, 'tauri.template.conf.json');
const tauriMaterializedPath = path.join(tauriDir, 'tauri.conf.json');
const tauriGeneratedPath = path.join(tauriDir, 'tauri.generated.conf.json');
const brandGeneratedTsPath = path.join(desktopDir, 'src', 'app', 'lib', 'brand.generated.ts');
const brandGeneratedJsonPath = path.join(tauriDir, 'brand.generated.json');
const homeWebBrandGeneratedJsPath = path.join(homeWebDir, 'brand.generated.js');
const guardrailsScriptPath = path.join(rootDir, 'scripts', 'verify-desktop-brand-guardrails.mjs');
const brandGeneratedPaths = [
  outputBrandDir,
  path.join(outputPublicDir, 'favicon.ico'),
  path.join(outputPublicDir, 'favicon.png'),
  path.join(outputPublicDir, 'apple-touch-icon.png'),
  outputIconsDir,
  outputInstallerAssetsDir,
  legacyInstallerAssetPath,
  tauriMaterializedPath,
  tauriGeneratedPath,
  brandGeneratedTsPath,
  brandGeneratedJsonPath,
  homeWebBrandGeneratedJsPath,
  homeWebPublicBrandDir,
];

function defaultMarketingTemplateKey(brandId) {
  return brandId === 'caiclaw' ? 'wealth-premium' : 'classic-download';
}

function resolveBrandPath(brandDir, rawPath) {
  if (typeof rawPath !== 'string' || !rawPath.trim()) {
    return null;
  }
  return path.resolve(brandDir, rawPath);
}

function buildSourceCandidates(sourcePath) {
  if (typeof sourcePath !== 'string' || !sourcePath.trim()) {
    return [];
  }
  const normalized = sourcePath.replace(/\\/g, '/');
  const candidates = [sourcePath];
  const legacyPrefix = '/services/control-plane/presets/assets/';
  const legacyIndex = normalized.indexOf(legacyPrefix);
  if (legacyIndex >= 0) {
    const suffix = normalized.slice(legacyIndex + legacyPrefix.length);
    candidates.push(path.join(rootDir, 'services', 'control-plane', 'assets', suffix));
  }
  return [...new Set(candidates)];
}

async function ensureFile(sourcePath, label) {
  if (!sourcePath) {
    throw new Error(`missing ${label}: unresolved source path`);
  }
  const candidates = buildSourceCandidates(sourcePath);
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {}
  }
  throw new Error(`missing ${label}: ${candidates.join(', ')}`);
}

async function resolveExistingFile(sourcePath, label) {
  return ensureFile(sourcePath, label);
}

async function copyFile(sourcePath, targetPath) {
  const resolvedSourcePath = await resolveExistingFile(sourcePath, path.basename(targetPath));
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.copyFile(resolvedSourcePath, targetPath);
}

async function detectBinaryFileFormat(sourcePath, fallbackExtension = 'png') {
  const resolvedSourcePath = await resolveExistingFile(sourcePath, path.basename(sourcePath || 'asset'));
  const buffer = await fs.readFile(resolvedSourcePath);
  const textProbe = buffer.subarray(0, 256).toString('utf8').trimStart().toLowerCase();
  if (textProbe.startsWith('<svg') || textProbe.startsWith('<?xml')) {
    return 'svg';
  }
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'webp';
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpg';
  }
  if (
    buffer.length >= 6 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return 'gif';
  }
  const inferred = path.extname(resolvedSourcePath).replace(/^\./, '').trim().toLowerCase();
  return inferred || fallbackExtension;
}

async function copyBrowserAsset(sourcePath, targetDir, baseName, fallbackExtension = 'png') {
  const extension = await detectBinaryFileFormat(sourcePath, fallbackExtension);
  try {
    const existingEntries = await fs.readdir(targetDir, { withFileTypes: true });
    await Promise.all(
      existingEntries
        .filter((entry) => entry.isFile() && entry.name.startsWith(`${baseName}.`))
        .map((entry) => fs.rm(path.join(targetDir, entry.name), { force: true })),
    );
  } catch {}
  const fileName = `${baseName}.${extension}`;
  await copyFile(sourcePath, path.join(targetDir, fileName));
  return fileName;
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
      await resolveExistingFile(sourcePath, path.basename(targetPath));
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

async function mirrorPathToTargets(sourcePath, targetPaths) {
  const normalizedTargets = targetPaths.filter(Boolean);
  if (normalizedTargets.length === 0) {
    return;
  }
  for (const targetPath of normalizedTargets) {
    await fs.rm(targetPath, { recursive: true, force: true });
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.cp(sourcePath, targetPath, { recursive: true });
  }
}

async function clearBrandOutputs() {
  await Promise.all(
    brandGeneratedPaths.map((targetPath) =>
      fs.rm(targetPath, { recursive: true, force: true }),
    ),
  );
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
  const tauriIconIco = tauriIconsDir ? path.join(tauriIconsDir, 'icon.ico') : null;

  // Tauri expects exact sizes and RGBA PNGs here. Reusing favicon.png can
  // produce a 512/1024 RGB asset masquerading as 32x32, which breaks release builds.
  await copyFirstExistingFile([tauri32x32, faviconPng], path.join(outputIconsDir, '32x32.png'));
  await copyFirstExistingFile([tauri128x128, tauriIconPng, faviconPng], path.join(outputIconsDir, '128x128.png'));
  await copyFirstExistingFile(
    [tauri128x128Retina, tauri128x128, tauriIconPng, faviconPng],
    path.join(outputIconsDir, '128x128@2x.png'),
  );
  await copyFirstExistingFile([tauriIconPng, faviconPng], path.join(outputIconsDir, 'icon.png'));
  await copyFirstExistingFile([tauriIconIco, faviconIco], path.join(outputIconsDir, 'icon.ico'));

  const icnsSourcePath = path.join(tauriIconsDir, 'icon.icns');
  await copyFile(icnsSourcePath, path.join(outputIconsDir, 'icon.icns'));
}

function buildBrandTs(brand, appVersion, assetPaths, brandStamp) {
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
        brandMarkSrc: '/brand/brand-mark.png',
        appleTouchIconSrc: '/brand/apple-touch-icon.png',
        installerHeroSrc: assetPaths.installerHeroSrc,
        assistantAvatarSrc: assetPaths.assistantAvatarSrc,
        logoAlt: `${brand.displayName} logo`,
      },
      theme: brand.theme,
      storage: {
        namespace: brand.storage.namespace,
      },
      oauth: brand.oauth,
      website: brand.website,
      distribution: {
        artifactBaseName: brandStamp.artifactBaseName,
      },
      build: {
        version: appVersion,
        stamp: brandStamp,
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
  const rootReleaseVersion =
    typeof process.env.ICLAW_ROOT_RELEASE_VERSION === 'string' ? process.env.ICLAW_ROOT_RELEASE_VERSION.trim() : '';
  if (rootReleaseVersion) {
    return rootReleaseVersion.replace(/\+/g, '.');
  }
  return typeof appVersion === 'string' ? appVersion.replace(/\+/g, '.') : '0.0.0';
}

function isTruthyEnv(value) {
  return /^(1|true|yes)$/i.test(String(value || '').trim());
}

function buildHomeBrandJs(brand, appVersion, assetPaths, brandStamp) {
  return `export const HOME_BRAND = ${JSON.stringify(
    {
      brandId: brand.brandId,
      displayName: brand.displayName,
      defaultThemeMode: brand.defaultThemeMode || 'dark',
      marketingSite: {
        templateKey:
          (brand.marketingSite && typeof brand.marketingSite === 'object' && typeof brand.marketingSite.templateKey === 'string'
            ? brand.marketingSite.templateKey.trim()
            : '') || defaultMarketingTemplateKey(brand.brandId),
        siteShell:
          brand.marketingSite && typeof brand.marketingSite === 'object' && brand.marketingSite.siteShell
            ? brand.marketingSite.siteShell
            : {},
        pages:
          brand.marketingSite && typeof brand.marketingSite === 'object' && Array.isArray(brand.marketingSite.pages)
            ? brand.marketingSite.pages
            : [],
      },
      website: brand.website,
      assets: {
        faviconPngSrc: '/brand/favicon.png',
        appleTouchIconSrc: '/brand/apple-touch-icon.png',
        logoSrc: assetPaths.logoSrc,
        installerHeroSrc: assetPaths.installerHeroSrc,
        logoMasterSrc: assetPaths.logoMasterSrc,
        heroArtSrc: brand.assets.homeHeroArt ? '/brand/hero-art.svg' : '/hero-art.svg',
        heroLayer1Src: brand.assets.homeHeroLayer1 ? '/brand/hero-layer-1.svg' : '/hero-layer-1.svg',
        heroLayer2Src: brand.assets.homeHeroLayer2 ? '/brand/hero-layer-2.svg' : '/hero-layer-2.svg',
        heroPhotoSrc: brand.assets.homeHeroPhoto ? '/brand/hero-photo.jpg' : '/hero-photo.jpg',
        logoAlt: `${brand.displayName} logo`,
      },
      release: {
        version: resolveHomeReleaseVersion(appVersion),
        artifactBaseName: brandStamp.artifactBaseName,
      },
      build: {
        version: appVersion,
        stamp: brandStamp,
      },
      distribution: brand.distribution,
    },
    null,
    2,
  )};\n`;
}

function assertDesktopBrandConsistency(tauriConfig, brand) {
  const expectedProductName = typeof brand.productName === 'string' ? brand.productName.trim() : '';
  const actualProductName = typeof tauriConfig.productName === 'string' ? tauriConfig.productName.trim() : '';
  if (!expectedProductName || actualProductName !== expectedProductName) {
    throw new Error(
      `desktop brand config mismatch: productName must equal brand.productName (${JSON.stringify(expectedProductName)}), got ${JSON.stringify(actualProductName)}`,
    );
  }

  const windowTitle = tauriConfig.app?.windows?.[0]?.title;
  const actualWindowTitle = typeof windowTitle === 'string' ? windowTitle.trim() : '';
  if (actualWindowTitle !== expectedProductName) {
    throw new Error(
      `desktop brand config mismatch: window title must equal brand.productName (${JSON.stringify(expectedProductName)}), got ${JSON.stringify(actualWindowTitle)}`,
    );
  }
}

async function main() {
  {
    const guardrail = spawnSync(process.execPath, [guardrailsScriptPath], {
      cwd: rootDir,
      stdio: 'pipe',
      encoding: 'utf8',
    });
    if (guardrail.status !== 0) {
      throw new Error((guardrail.stderr || guardrail.stdout || '').trim() || 'desktop brand guardrail failed');
    }
  }
  const context = await loadDesktopBrandContext({ rootDir, brandId: process.argv[2] });
  const {
    brandDir,
    profile: brand,
    appVersion,
    releaseVersion,
    artifactBaseName,
    staging,
    stamp: brandStamp,
  } = context;
  if (releaseVersion) {
    process.env.ICLAW_ROOT_RELEASE_VERSION = releaseVersion;
  }

  const faviconIco = resolveBrandPath(brandDir, brand.assets.faviconIco);
  const faviconPng = resolveBrandPath(brandDir, brand.assets.faviconPng);
  const appleTouchIcon = resolveBrandPath(brandDir, brand.assets.appleTouchIcon || brand.assets.faviconPng);
  const installerHero = resolveBrandPath(brandDir, brand.assets.installerHero);
  const tauriIconsDir = resolveBrandPath(brandDir, brand.assets.tauriIconsDir);
  const tauriIconPng = tauriIconsDir ? path.join(tauriIconsDir, 'icon.png') : null;
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
  const logoMaster = brand.assets.logoMaster
    ? resolveBrandPath(brandDir, brand.assets.logoMaster)
    : homeLogo;
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

  if (tauriIconsDir && process.platform === 'darwin') {
    execFileSync(path.join(rootDir, 'scripts', 'generate-icons.sh'), [brand.brandId], {
      cwd: rootDir,
      stdio: 'inherit',
    });
  } else if (tauriIconsDir) {
    process.stdout.write(`[brand] reuse existing tauri icons for ${brand.brandId} on ${process.platform}\n`);
  }

  await clearBrandOutputs();
  await fs.mkdir(outputBrandDir, { recursive: true });
  await fs.mkdir(outputPublicDir, { recursive: true });
  await fs.mkdir(homeWebPublicBrandDir, { recursive: true });
  await fs.mkdir(outputInstallerAssetsDir, { recursive: true });
  await copyFile(faviconIco, path.join(outputBrandDir, 'favicon.ico'));
  await copyFile(faviconPng, path.join(outputBrandDir, 'favicon.png'));
  await copyFile(appleTouchIcon, path.join(outputBrandDir, 'apple-touch-icon.png'));
  const installerHeroFileName = await copyBrowserAsset(installerHero, outputBrandDir, 'installer-hero');
  const assistantAvatarFileName = await copyBrowserAsset(assistantAvatar, outputBrandDir, 'assistant-avatar');
  await copyFile(faviconIco, path.join(outputPublicDir, 'favicon.ico'));
  await copyFile(faviconPng, path.join(outputPublicDir, 'favicon.png'));
  await copyFirstExistingFile([tauriIconPng, faviconPng], path.join(outputBrandDir, 'brand-mark.png'));
  await copyFirstExistingFile([tauriIconPng, faviconPng], path.join(outputPublicDir, 'brand-mark.png'));
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
  const homeLogoFileName = await copyBrowserAsset(homeLogo, homeWebPublicBrandDir, 'logo');
  await copyBrowserAsset(installerHero, homeWebPublicBrandDir, 'installer-hero');
  const logoMasterFileName = await copyBrowserAsset(logoMaster, homeWebPublicBrandDir, 'logo-master');
  await copyOptionalFile(homeHeroArt, path.join(homeWebPublicBrandDir, 'hero-art.svg'));
  await copyOptionalFile(homeHeroLayer1, path.join(homeWebPublicBrandDir, 'hero-layer-1.svg'));
  await copyOptionalFile(homeHeroLayer2, path.join(homeWebPublicBrandDir, 'hero-layer-2.svg'));
  await copyOptionalFile(homeHeroPhoto, path.join(homeWebPublicBrandDir, 'hero-photo.jpg'));

  const brandAssetPaths = {
    installerHeroSrc: `/brand/${installerHeroFileName}`,
    assistantAvatarSrc: `/brand/${assistantAvatarFileName}`,
    logoSrc: `/brand/${homeLogoFileName}`,
    logoMasterSrc: `/brand/${logoMasterFileName}`,
  };

  const tauriConfig = JSON.parse(await fs.readFile(tauriTemplatePath, 'utf8'));
  tauriConfig.productName = brand.productName;
  tauriConfig.version = appVersion;
  tauriConfig.identifier = brand.bundleIdentifier;
  if (Array.isArray(tauriConfig.app?.windows) && tauriConfig.app.windows[0]) {
    tauriConfig.app.windows[0].title = brand.productName;
  }
  tauriConfig.bundle = tauriConfig.bundle || {};
  tauriConfig.bundle.windows = tauriConfig.bundle.windows || {};
  tauriConfig.bundle.windows.nsis = tauriConfig.bundle.windows.nsis || {};
  const enableNativeUpdater =
    !isFalsyEnv(process.env.ICLAW_DESKTOP_ENABLE_NATIVE_UPDATER) &&
    Boolean((process.env.TAURI_SIGNING_PRIVATE_KEY || '').trim());
  tauriConfig.bundle.createUpdaterArtifacts = enableNativeUpdater;
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

  assertDesktopBrandConsistency(tauriConfig, brand);

  const tauriConfigRaw = `${JSON.stringify(tauriConfig, null, 2)}\n`;
  await fs.writeFile(tauriMaterializedPath, tauriConfigRaw, 'utf8');
  await fs.writeFile(tauriGeneratedPath, tauriConfigRaw, 'utf8');
  await fs.writeFile(
    brandGeneratedJsonPath,
    `${JSON.stringify(
      {
        brandId: brand.brandId,
        productName: brand.productName,
        bundleIdentifier: brand.bundleIdentifier,
        authService: brand.authService,
        artifactBaseName,
      storageNamespace: brand.storage.namespace,
      build: {
        version: appVersion,
        stamp: brandStamp,
      },
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  await fs.writeFile(brandGeneratedTsPath, buildBrandTs(brand, appVersion, brandAssetPaths, brandStamp), 'utf8');
  await fs.writeFile(homeWebBrandGeneratedJsPath, buildHomeBrandJs(brand, appVersion, brandAssetPaths, brandStamp), 'utf8');

  await fs.rm(staging.root, { recursive: true, force: true });
  await fs.mkdir(staging.brandRoot, { recursive: true });
  await fs.mkdir(staging.root, { recursive: true });
  await fs.writeFile(staging.stampPath, `${JSON.stringify(brandStamp, null, 2)}\n`, 'utf8');
  await fs.writeFile(
    staging.currentPath,
    `${JSON.stringify(
      {
        brandId: brand.brandId,
        buildId: context.buildId,
        runId: context.stageRunId,
        stageRoot: staging.root,
        stamp: brandStamp,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  await fs.writeFile(
    staging.manifestPath,
    `${JSON.stringify(
      {
        brandId: brand.brandId,
        buildId: context.buildId,
        runId: context.stageRunId,
        appVersion,
        outputs: {
          tauriConfigPath: path.relative(staging.root, staging.tauriConfigPath),
          tauriGeneratedConfigPath: path.relative(staging.root, staging.tauriGeneratedConfigPath),
          brandGeneratedJsonPath: path.relative(staging.root, staging.brandGeneratedJsonPath),
          brandGeneratedTsPath: path.relative(staging.root, staging.brandGeneratedTsPath),
          publicBrandDir: path.relative(staging.root, staging.publicBrandDir),
          iconsGeneratedDir: path.relative(staging.root, staging.iconsGeneratedDir),
          installerGeneratedDir: path.relative(staging.root, staging.installerGeneratedDir),
        },
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  await mirrorPathToTargets(outputBrandDir, [staging.publicBrandDir]);
  await mirrorPathToTargets(path.join(outputPublicDir, 'favicon.ico'), [path.join(staging.publicRoot, 'favicon.ico')]);
  await mirrorPathToTargets(path.join(outputPublicDir, 'favicon.png'), [path.join(staging.publicRoot, 'favicon.png')]);
  await mirrorPathToTargets(
    path.join(outputPublicDir, 'apple-touch-icon.png'),
    [path.join(staging.publicRoot, 'apple-touch-icon.png')],
  );
  await mirrorPathToTargets(tauriMaterializedPath, [staging.tauriConfigPath]);
  await mirrorPathToTargets(tauriGeneratedPath, [staging.tauriGeneratedConfigPath]);
  await mirrorPathToTargets(brandGeneratedJsonPath, [staging.brandGeneratedJsonPath]);
  await mirrorPathToTargets(brandGeneratedTsPath, [staging.brandGeneratedTsPath]);
  await mirrorPathToTargets(outputIconsDir, [staging.iconsGeneratedDir]);
  await mirrorPathToTargets(outputInstallerAssetsDir, [staging.installerGeneratedDir]);

  const stagePruneResult = await pruneDesktopBrandStages({
    rootDir,
    brandId: brand.brandId,
    protectedStageRoot: staging.root,
  });
  if (stagePruneResult.stagesRemoved > 0 || stagePruneResult.buildDirsRemoved > 0) {
    process.stdout.write(
      `[brand] pruned desktop staging for ${brand.brandId}: removed ${stagePruneResult.stagesRemoved} stages, ${stagePruneResult.buildDirsRemoved} empty build dirs; keep=${stagePruneResult.keepStages}\n`,
    );
  }

  process.stdout.write(`[brand] applied ${brand.brandId}\n`);
}

main().catch((error) => {
  console.error(`[brand] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
