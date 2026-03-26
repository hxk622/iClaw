import fsp from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {spawnSync} from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { normalizeEnvName, resolveConfiguredAppName, resolvePortalSourceEnv, resolveSelectedEnvName } from './app-env.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultRootDir = path.resolve(__dirname, '..', '..');

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cacheRootFor(rootDir, brandId) {
  return path.join(rootDir, '.cache', 'portal-apps', brandId);
}

async function ensureSyncedBrandProfile(rootDir, brandId) {
  const envName = resolveSelectedEnvName() || normalizeEnvName(process.env.NODE_ENV || '') || 'dev';
  const sourceEnv = resolvePortalSourceEnv(rootDir);
  const result = spawnSync(
    'bash',
    [
      path.join(rootDir, 'scripts', 'with-env.sh'),
      envName,
      'pnpm',
      '--filter',
      '@iclaw/control-plane',
      'sync:local-app-brand-profile',
      '--',
      '--app',
      brandId,
    ],
    {
      cwd: rootDir,
      env: {
        ...process.env,
        ...sourceEnv,
      },
      encoding: 'utf8',
    },
  );

  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || result.stdout?.trim() || `failed to sync portal app profile: ${brandId}`);
  }
}

export function resolveBrandId(
  brandId = '',
) {
  const explicitBrandId = trimString(brandId);
  const envBrandId = trimString(resolveConfiguredAppName(defaultRootDir));
  const resolved = explicitBrandId || envBrandId;
  if (!resolved) {
    throw new Error('APP_NAME is required to resolve OEM brand profile');
  }
  return resolved;
}

export async function loadBrandProfile(options = {}) {
  const rootDir = options.rootDir ? path.resolve(options.rootDir) : defaultRootDir;
  const brandId = resolveBrandId(options.brandId);
  await ensureSyncedBrandProfile(rootDir, brandId);
  const brandDir = cacheRootFor(rootDir, brandId);
  const brandConfigPath = path.join(brandDir, 'profile.json');
  const profile = JSON.parse(await fsp.readFile(brandConfigPath, 'utf8'));
  return {
    rootDir,
    brandDir,
    brandConfigPath,
    profile,
  };
}
