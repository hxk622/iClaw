import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadBrandProfile, resolveBrandId } from './brand-profile.mjs';

const defaultRootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveStageRunId() {
  const explicitRunId = trimString(process.env.ICLAW_DESKTOP_STAGE_RUN_ID || process.env.ICLAW_STAGE_RUN_ID);
  if (explicitRunId) {
    return explicitRunId;
  }
  return `${Date.now()}`;
}

function buildDesktopBrandStagingPaths(rootDir, brandId, buildId, runId) {
  const brandRoot = path.join(rootDir, '.build', 'desktop', brandId);
  const stageRoot = path.join(brandRoot, buildId, runId);
  const desktopRoot = path.join(stageRoot, 'desktop');
  const publicRoot = path.join(desktopRoot, 'public');
  const tauriRoot = path.join(desktopRoot, 'src-tauri');
  return {
    brandRoot,
    root: stageRoot,
    currentPath: path.join(brandRoot, 'current.json'),
    stampPath: path.join(stageRoot, 'brand-stamp.json'),
    manifestPath: path.join(stageRoot, 'manifest.json'),
    desktopRoot,
    publicRoot,
    publicBrandDir: path.join(publicRoot, 'brand'),
    tauriRoot,
    tauriConfigPath: path.join(tauriRoot, 'tauri.conf.json'),
    tauriGeneratedConfigPath: path.join(tauriRoot, 'tauri.generated.conf.json'),
    brandGeneratedJsonPath: path.join(tauriRoot, 'brand.generated.json'),
    brandGeneratedTsPath: path.join(desktopRoot, 'src', 'app', 'lib', 'brand.generated.ts'),
    iconsGeneratedDir: path.join(tauriRoot, 'icons-generated'),
    installerGeneratedDir: path.join(tauriRoot, 'installer-generated'),
  };
}

function parsePositiveInteger(value, fallback) {
  const numeric = Number.parseInt(trimString(value), 10);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function resolveBuildId({ appVersion, releaseVersion }) {
  const explicitBuildId = trimString(process.env.BUILD_ID || process.env.ICLAW_BUILD_ID);
  if (explicitBuildId) {
    return explicitBuildId;
  }

  const normalizedAppVersion = trimString(appVersion);
  const plusIndex = normalizedAppVersion.indexOf('+');
  if (plusIndex >= 0) {
    const suffix = normalizedAppVersion.slice(plusIndex + 1).trim();
    if (suffix) {
      return suffix;
    }
  }

  const normalizedReleaseVersion = trimString(releaseVersion);
  if (normalizedReleaseVersion) {
    const segments = normalizedReleaseVersion.split('.').map((segment) => segment.trim()).filter(Boolean);
    const tail = segments[segments.length - 1];
    if (tail) {
      return tail;
    }
  }

  return 'dev';
}

async function readVersionInfo(rootDir) {
  const packageJsonPath = path.join(rootDir, 'package.json');
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
  return {
    packageJsonPath,
    appVersion: trimString(packageJson.version) || '0.0.0',
    releaseVersion: trimString(packageJson.releaseVersion) || null,
  };
}

async function hashProfileSource(brandConfigPath, profile) {
  const hasher = createHash('sha256');
  try {
    hasher.update(await fs.readFile(brandConfigPath));
  } catch {
    hasher.update(JSON.stringify(profile || {}, null, 2));
  }
  return hasher.digest('hex');
}

export async function loadDesktopBrandContext(options = {}) {
  const rootDir = options.rootDir ? path.resolve(options.rootDir) : defaultRootDir;
  const brandId = resolveBrandId(options.brandId);
  const { brandDir, brandConfigPath, profile } = await loadBrandProfile({
    rootDir,
    brandId,
    envName: options.envName,
  });
  const versionInfo = await readVersionInfo(rootDir);
  const productName =
    trimString(profile?.productName) ||
    trimString(profile?.displayName) ||
    trimString(profile?.websiteTitle) ||
    brandId;
  const bundleIdentifier = trimString(profile?.bundleIdentifier);
  const artifactBaseName =
    trimString(profile?.distribution?.artifactBaseName) ||
    productName;
  const buildId = resolveBuildId(versionInfo);
  const stageRunId = resolveStageRunId();
  const sourceProfileHash = await hashProfileSource(brandConfigPath, profile);

  return {
    rootDir,
    brandDir,
    brandConfigPath,
    profile,
    brandId,
    productName,
    bundleIdentifier,
    artifactBaseName,
    appVersion: versionInfo.appVersion,
    releaseVersion: versionInfo.releaseVersion,
    buildId,
    stageRunId,
    sourceProfileHash,
    staging: buildDesktopBrandStagingPaths(rootDir, brandId, buildId, stageRunId),
    stamp: {
      brandId,
      productName,
      bundleIdentifier,
      artifactBaseName,
      buildId,
      sourceProfileHash,
    },
  };
}

export async function readActiveDesktopBrandStage(options = {}) {
  const rootDir = options.rootDir ? path.resolve(options.rootDir) : defaultRootDir;
  const brandId = resolveBrandId(options.brandId);
  const currentPath = path.join(rootDir, '.build', 'desktop', brandId, 'current.json');
  const payload = JSON.parse(await fs.readFile(currentPath, 'utf8'));
  const buildId = trimString(payload.buildId);
  const runId = trimString(payload.runId);
  if (!buildId || !runId) {
    throw new Error(`invalid active desktop stage marker: ${currentPath}`);
  }
  return {
    ...payload,
    currentPath,
    paths: buildDesktopBrandStagingPaths(rootDir, brandId, buildId, runId),
  };
}

export async function pruneDesktopBrandStages(options = {}) {
  const rootDir = options.rootDir ? path.resolve(options.rootDir) : defaultRootDir;
  const brandId = resolveBrandId(options.brandId);
  const keepStages = parsePositiveInteger(
    options.keepStages ?? process.env.ICLAW_DESKTOP_STAGE_KEEP ?? process.env.ICLAW_KEEP_VERSIONS,
    3,
  );
  const brandRoot = path.join(rootDir, '.build', 'desktop', brandId);
  const protectedStageRoot = trimString(options.protectedStageRoot)
    ? path.resolve(options.protectedStageRoot)
    : '';
  const protectedRoots = new Set(protectedStageRoot ? [protectedStageRoot] : []);

  let buildEntries = [];
  try {
    buildEntries = await fs.readdir(brandRoot, { withFileTypes: true });
  } catch {
    return {
      brandRoot,
      keepStages,
      protectedRoots: [...protectedRoots],
      stagesSeen: 0,
      stagesRemoved: 0,
      buildDirsRemoved: 0,
      removedStageRoots: [],
    };
  }

  const stageEntries = [];
  for (const buildEntry of buildEntries) {
    if (!buildEntry.isDirectory()) {
      continue;
    }
    const buildId = trimString(buildEntry.name);
    if (!buildId) {
      continue;
    }
    const buildRoot = path.join(brandRoot, buildId);
    let runEntries = [];
    try {
      runEntries = await fs.readdir(buildRoot, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const runEntry of runEntries) {
      if (!runEntry.isDirectory()) {
        continue;
      }
      const runId = trimString(runEntry.name);
      if (!runId) {
        continue;
      }
      stageEntries.push({
        buildId,
        runId,
        stageRoot: path.join(buildRoot, runId),
        sortKey: `${buildId}/${runId}`,
      });
    }
  }

  stageEntries.sort((left, right) => right.sortKey.localeCompare(left.sortKey));
  const keepRoots = new Set([...protectedRoots]);
  for (const entry of stageEntries) {
    if (keepRoots.size >= keepStages) {
      break;
    }
    keepRoots.add(entry.stageRoot);
  }

  const removedStageRoots = [];
  for (const entry of stageEntries) {
    if (keepRoots.has(entry.stageRoot)) {
      continue;
    }
    await fs.rm(entry.stageRoot, { recursive: true, force: true });
    removedStageRoots.push(entry.stageRoot);
  }

  let buildDirsRemoved = 0;
  for (const buildEntry of buildEntries) {
    if (!buildEntry.isDirectory()) {
      continue;
    }
    const buildRoot = path.join(brandRoot, buildEntry.name);
    let remainingEntries = [];
    try {
      remainingEntries = await fs.readdir(buildRoot);
    } catch {
      continue;
    }
    if (remainingEntries.length === 0) {
      await fs.rm(buildRoot, { recursive: true, force: true });
      buildDirsRemoved += 1;
    }
  }

  return {
    brandRoot,
    keepStages,
    protectedRoots: [...protectedRoots],
    stagesSeen: stageEntries.length,
    stagesRemoved: removedStageRoots.length,
    buildDirsRemoved,
    removedStageRoots,
  };
}
