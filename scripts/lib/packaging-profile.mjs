import fsp from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { normalizeEnvName, resolveConfiguredAppName, resolveSelectedEnvName } from './app-env.mjs';
import { assertBrandAssetPolicy } from './brand-asset-policy.mjs';

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

const defaultRootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function resolvePackagingEnvName(raw = '') {
  return normalizeEnvName(raw) || normalizeEnvName(process.env.ICLAW_PACKAGING_ENV || '') || resolveSelectedEnvName() || 'dev';
}

export function resolvePackagingBrandId(rootDir, brandId = '') {
  const explicitBrandId = trimString(brandId);
  const envBrandId = trimString(resolveConfiguredAppName(rootDir));
  const resolved = explicitBrandId || envBrandId;
  if (!resolved) {
    throw new Error('APP_NAME is required to resolve packaging profile');
  }
  return resolved;
}

export function packagingProfilePath(rootDir, envName, brandId) {
  return path.join(rootDir, 'config', 'packaging', envName, `${brandId}.json`);
}

export async function loadPackagingProfile(options = {}) {
  const rootDir = options.rootDir ? path.resolve(options.rootDir) : defaultRootDir;
  const envName = resolvePackagingEnvName(options.envName);
  const brandId = resolvePackagingBrandId(rootDir, options.brandId);
  const filePath = packagingProfilePath(rootDir, envName, brandId);
  const profile = JSON.parse(await fsp.readFile(filePath, 'utf8'));
  const assetPolicy = assertBrandAssetPolicy(profile);
  return {
    rootDir,
    envName,
    brandId,
    filePath,
    profile,
    assetPolicy,
  };
}
