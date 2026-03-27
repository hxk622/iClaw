import process from 'node:process';
import { readPreferredEnvValue, readPreferredPackagingEnvValue, resolveConfiguredAppName } from './app-env.mjs';

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveBrandId(brandId, rootDir) {
  const explicitBrandId = trimString(brandId);
  if (explicitBrandId) {
    return explicitBrandId;
  }
  return trimString(resolveConfiguredAppName(rootDir));
}

function toBrandEnvSuffix(brandId) {
  return trimString(brandId)
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

function resolveEnvValue(rootDir, key) {
  return (
    trimString(process.env[key]) ||
    trimString(readPreferredPackagingEnvValue(rootDir, key)) ||
    trimString(readPreferredEnvValue(rootDir, key))
  );
}

export async function resolveOemSigningProfile(options = {}) {
  const rootDir = options.rootDir ? String(options.rootDir) : process.cwd();
  const brandId = resolveBrandId(options.brandId, rootDir);
  const profileName = toBrandEnvSuffix(brandId);
  const env = {};
  const errors = [];
  const signingKeys = [
    'APPLE_SIGNING_IDENTITY',
    'APPLE_ID',
    'APPLE_PASSWORD',
    'APPLE_TEAM_ID',
    'TAURI_SIGNING_PRIVATE_KEY',
    'TAURI_SIGNING_PRIVATE_KEY_PASSWORD',
    'TAURI_UPDATER_PUBLIC_KEY',
  ];

  for (const envKey of signingKeys) {
    const brandScopedKey = `${envKey}_${profileName}`;
    const resolved = resolveEnvValue(rootDir, brandScopedKey);
    if (resolved) {
      env[envKey] = resolved;
      continue;
    }
    if (envKey === 'TAURI_SIGNING_PRIVATE_KEY_PASSWORD') {
      continue;
    }
    errors.push(`missing env ${brandScopedKey}`);
  }

  if (errors.length > 0 && Object.keys(env).length > 0) {
    throw new Error(
      [
        `failed to resolve OEM signing env for brand ${brandId}`,
        `expected APP_NAME-scoped vars with suffix _${profileName}`,
        ...errors,
      ].join('\n'),
    );
  }

  return {
    brandId,
    filePath: null,
    profileName,
    env,
  };
}
