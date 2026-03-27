import path from 'node:path';
import process from 'node:process';
import {spawnSync} from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { normalizeEnvName, resolveConfiguredAppName, resolveSelectedEnvName } from './app-env.mjs';
import { loadPackagingProfile } from './packaging-profile.mjs';
import fsp from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultRootDir = path.resolve(__dirname, '..', '..');

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cacheRootFor(rootDir, brandId) {
  return path.join(rootDir, '.cache', 'portal-apps', brandId);
}

function pnpmCommand() {
  const nodeBinDir = path.dirname(process.execPath);
  const bundledCorepack = path.join(nodeBinDir, process.platform === 'win32' ? 'corepack.cmd' : 'corepack');
  return [bundledCorepack, 'pnpm'];
}

async function ensureSyncedBrandProfile(rootDir, brandId) {
  const envName = resolveSelectedEnvName() || normalizeEnvName(process.env.NODE_ENV || '') || 'dev';
  const usePackagingSourceEnv = /^(1|true|yes)$/i.test(String(process.env.ICLAW_USE_PACKAGING_SOURCE_ENV || '').trim());
  const [pnpmBin, ...pnpmArgs] = pnpmCommand();
  const syncCommand = usePackagingSourceEnv
    ? [
        process.execPath,
        path.join(rootDir, 'scripts', 'with-packaging-source-env.mjs'),
        '--',
        pnpmBin,
        ...pnpmArgs,
        '--filter',
        '@iclaw/control-plane',
        'sync:local-app-brand-profile',
        '--',
        '--app',
        brandId,
      ]
    : [
        pnpmBin,
        ...pnpmArgs,
        '--filter',
        '@iclaw/control-plane',
        'sync:local-app-brand-profile',
        '--',
        '--app',
        brandId,
      ];
  const result = spawnSync(
    process.execPath,
    [
      path.join(rootDir, 'scripts', 'run-bash.mjs'),
      path.join(rootDir, 'scripts', 'with-env.sh'),
      envName,
      ...syncCommand,
    ],
    {
      cwd: rootDir,
      env: { ...process.env },
      encoding: 'utf8',
      shell: false,
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
  try {
    const resolved = await loadPackagingProfile({
      rootDir,
      brandId,
      envName: options.envName,
    });
    const brandDir = path.dirname(resolved.filePath);
    return {
      rootDir,
      brandDir,
      brandConfigPath: resolved.filePath,
      profile: resolved.profile,
    };
  } catch {}
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
