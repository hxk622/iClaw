import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {spawnSync} from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultRootDir = path.resolve(__dirname, '..', '..');

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

async function readEnvFileIfPresent(targetPath) {
  try {
    return await fsp.readFile(targetPath, 'utf8');
  } catch {
    return '';
  }
}

function applyEnvContent(raw) {
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    if (typeof process.env[key] === 'undefined') {
      process.env[key] = value;
    }
  }
}

async function ensureRootEnvLoaded(rootDir) {
  const raw = await readEnvFileIfPresent(path.join(rootDir, '.env'));
  applyEnvContent(raw);
}

function ensureRootEnvLoadedSync(rootDir = defaultRootDir) {
  try {
    const raw = fs.readFileSync(path.join(rootDir, '.env'), 'utf8');
    applyEnvContent(raw);
  } catch {
    // Ignore missing .env files; callers still fall back to explicit args/default brand.
  }
}

function cacheRootFor(rootDir, brandId) {
  return path.join(rootDir, '.cache', 'portal-apps', brandId);
}

async function ensureSyncedBrandProfile(rootDir, brandId) {
  await ensureRootEnvLoaded(rootDir);
  const envName = trimString(process.env.NODE_ENV) || 'dev';
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
      },
      encoding: 'utf8',
    },
  );

  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || result.stdout?.trim() || `failed to sync portal app profile: ${brandId}`);
  }
}

export function resolveBrandId(brandId = '') {
  ensureRootEnvLoadedSync(defaultRootDir);
  const explicitBrandId = trimString(brandId);
  const envBrandId = trimString(
    process.env.APP_NAME || process.env.ICLAW_PORTAL_APP_NAME || process.env.ICLAW_BRAND || process.env.ICLAW_APP_NAME || '',
  );
  return explicitBrandId || envBrandId || 'iclaw';
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
