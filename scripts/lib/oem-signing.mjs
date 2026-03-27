import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { readPreferredEnvValue, readPreferredPackagingEnvValue, resolveConfiguredAppName } from './app-env.mjs';

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function signingConfigCandidates(rootDir) {
  return [
    path.join(rootDir, 'config', 'oem-signing.local.json'),
    path.join(rootDir, 'config', 'oem-signing.json'),
  ];
}

async function readSigningConfig(rootDir) {
  for (const filePath of signingConfigCandidates(rootDir)) {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      return {
        filePath,
        config: JSON.parse(raw),
      };
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        continue;
      }
      throw error;
    }
  }

  return {
    filePath: null,
    config: null,
  };
}

function resolveBrandId(brandId, rootDir) {
  const explicitBrandId = trimString(brandId);
  if (explicitBrandId) {
    return explicitBrandId;
  }
  return trimString(resolveConfiguredAppName(rootDir));
}

function resolveProfileNameForBrand(config, brandId) {
  if (!isPlainObject(config)) {
    return '';
  }
  const brands = isPlainObject(config.brands) ? config.brands : {};
  return trimString(brands[brandId]);
}

function resolveProfile(config, profileName) {
  if (!profileName || !isPlainObject(config)) {
    return null;
  }
  const profiles = isPlainObject(config.profiles) ? config.profiles : {};
  const profile = profiles[profileName];
  return isPlainObject(profile) ? profile : null;
}

function resolveEnvValue(rootDir, key) {
  return (
    trimString(process.env[key]) ||
    trimString(readPreferredPackagingEnvValue(rootDir, key)) ||
    trimString(readPreferredEnvValue(rootDir, key))
  );
}

function resolveMappedValue(rootDir, key, value, errors) {
  if (typeof value === 'string') {
    return value;
  }

  if (!isPlainObject(value)) {
    errors.push(`invalid signing env mapping for ${key}`);
    return '';
  }

  const fromEnv = trimString(value.fromEnv);
  if (!fromEnv) {
    errors.push(`missing fromEnv for signing env mapping ${key}`);
    return '';
  }

  const resolved = resolveEnvValue(rootDir, fromEnv);
  if (!resolved) {
    errors.push(`missing env ${fromEnv} for signing env mapping ${key}`);
    return '';
  }
  return resolved;
}

export async function resolveOemSigningProfile(options = {}) {
  const rootDir = path.resolve(options.rootDir || process.cwd());
  const brandId = resolveBrandId(options.brandId, rootDir);
  const { filePath, config } = await readSigningConfig(rootDir);

  if (!config) {
    return {
      brandId,
      filePath: null,
      profileName: '',
      env: {},
    };
  }

  const profileName = resolveProfileNameForBrand(config, brandId);
  if (!profileName) {
    return {
      brandId,
      filePath,
      profileName: '',
      env: {},
    };
  }

  const profile = resolveProfile(config, profileName);
  if (!profile) {
    throw new Error(`missing OEM signing profile "${profileName}" for brand ${brandId}`);
  }

  const envMappings = isPlainObject(profile.env) ? profile.env : {};
  const env = {};
  const errors = [];

  for (const [key, value] of Object.entries(envMappings)) {
    const envKey = trimString(key);
    if (!envKey) {
      continue;
    }
    const resolved = resolveMappedValue(rootDir, envKey, value, errors);
    if (resolved) {
      env[envKey] = resolved;
    }
  }

  if (errors.length > 0) {
    throw new Error(
      [
        `failed to resolve OEM signing profile "${profileName}" for brand ${brandId}`,
        `config: ${filePath}`,
        ...errors,
      ].join('\n'),
    );
  }

  return {
    brandId,
    filePath,
    profileName,
    env,
  };
}
