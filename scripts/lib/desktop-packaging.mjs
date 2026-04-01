import path from 'node:path';
import process from 'node:process';

const TARGET_METADATA = new Map([
  ['aarch64-apple-darwin', { platform: 'darwin', arch: 'aarch64', hostPlatform: 'darwin' }],
  ['x86_64-apple-darwin', { platform: 'darwin', arch: 'x64', hostPlatform: 'darwin' }],
  ['aarch64-pc-windows-msvc', { platform: 'windows', arch: 'aarch64', hostPlatform: 'win32' }],
  ['x86_64-pc-windows-msvc', { platform: 'windows', arch: 'x64', hostPlatform: 'win32' }],
  ['aarch64-unknown-linux-gnu', { platform: 'linux', arch: 'aarch64', hostPlatform: 'linux' }],
  ['x86_64-unknown-linux-gnu', { platform: 'linux', arch: 'x64', hostPlatform: 'linux' }],
]);

export function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizePackagingChannel(raw) {
  const normalized = trimString(raw).toLowerCase();
  if (!normalized) return '';
  if (['dev', 'development', 'local'].includes(normalized)) return 'dev';
  if (['test', 'testing', 'staging'].includes(normalized)) return 'test';
  if (['prod', 'production', 'release'].includes(normalized)) return 'prod';
  return '';
}

export function resolvePackagingChannelFromEnv(env = process.env) {
  return normalizePackagingChannel(env.ICLAW_ENV_NAME || env.NODE_ENV || '');
}

export function listKnownRuntimeTargets() {
  return [...TARGET_METADATA.keys()];
}

export function resolvePackagingTargetInfo(target = '', options = {}) {
  const explicitTarget = trimString(target);
  if (explicitTarget) {
    const metadata = TARGET_METADATA.get(explicitTarget);
    if (!metadata) {
      return null;
    }
    return {
      triple: explicitTarget,
      ...metadata,
    };
  }

  const hostPlatform = options.hostPlatform || process.platform;
  const hostArch = options.hostArch || process.arch;
  if (hostPlatform === 'darwin') {
    if (hostArch === 'arm64') return resolvePackagingTargetInfo('aarch64-apple-darwin');
    if (hostArch === 'x64') return resolvePackagingTargetInfo('x86_64-apple-darwin');
  }
  if (hostPlatform === 'win32') {
    if (hostArch === 'arm64') return resolvePackagingTargetInfo('aarch64-pc-windows-msvc');
    if (hostArch === 'x64') return resolvePackagingTargetInfo('x86_64-pc-windows-msvc');
  }
  if (hostPlatform === 'linux') {
    if (hostArch === 'arm64') return resolvePackagingTargetInfo('aarch64-unknown-linux-gnu');
    if (hostArch === 'x64') return resolvePackagingTargetInfo('x86_64-unknown-linux-gnu');
  }
  return null;
}

export function getHostPackagingTargets(hostPlatform = process.platform) {
  return [...TARGET_METADATA.entries()]
    .filter(([, value]) => value.hostPlatform === hostPlatform)
    .map(([triple]) => triple);
}

export function getArchLabelForTarget(target = '', options = {}) {
  return resolvePackagingTargetInfo(target, options)?.arch || '';
}

export function getPlatformForTarget(target = '', options = {}) {
  return resolvePackagingTargetInfo(target, options)?.platform || '';
}

export function buildBundleRoot({ tauriDir, target = '', profile = 'release' }) {
  const targetDir = trimString(target)
    ? path.join(tauriDir, 'target', trimString(target), profile)
    : path.join(tauriDir, 'target', profile);
  return path.join(targetDir, 'bundle');
}

export function buildPackagingWorkspacePaths({ rootDir, brandId, channel = '', target = '' }) {
  const normalizedBrand = trimString(brandId) || 'default';
  const normalizedChannel = normalizePackagingChannel(channel) || 'adhoc';
  const targetInfo = resolvePackagingTargetInfo(target);
  const targetSegment = targetInfo?.triple || trimString(target) || 'host';
  const workspaceRoot = path.join(rootDir, '.tmp-packaging', normalizedBrand, normalizedChannel, targetSegment);
  const resourcesSourceDir = path.join(workspaceRoot, 'resources-source');
  const baselineDir = path.join(resourcesSourceDir, 'baseline');
  return {
    workspaceRoot,
    resourcesSourceDir,
    bundledSkillsDir: path.join(resourcesSourceDir, 'bundled-skills'),
    baselineDir,
    packagedSkillBaselineDir: path.join(baselineDir, 'skills'),
    packagedMcpBaselineDir: path.join(baselineDir, 'mcp'),
  };
}
