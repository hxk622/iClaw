import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadBrandProfile, resolveBrandId } from './brand-profile.mjs';

const defaultRootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
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
    sourceProfileHash,
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
