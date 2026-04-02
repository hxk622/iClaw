#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { loadBrandProfile, resolveBrandId } from './lib/brand-profile.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const defaultReleaseDir = path.join(rootDir, 'dist', 'releases');
const supportedTargets = [
  { platform: 'windows', arch: 'x64', installerExt: 'exe', updaterExt: 'nsis.zip' },
  { platform: 'windows', arch: 'aarch64', installerExt: 'exe', updaterExt: 'nsis.zip' },
  { platform: 'darwin', arch: 'x64', installerExt: 'dmg', updaterExt: 'app.tar.gz' },
  { platform: 'darwin', arch: 'aarch64', installerExt: 'dmg', updaterExt: 'app.tar.gz' },
];

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseArgs(argv) {
  let brandId = resolveBrandId();
  let channel = 'prod';
  let releaseDir = defaultReleaseDir;
  let version = '';
  let notes = '';
  let platform = '';
  let arch = '';

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--brand') {
      brandId = resolveBrandId(argv[index + 1] || '');
      index += 1;
      continue;
    }
    if (arg === '--channel') {
      channel = trimString(argv[index + 1] || '') || 'prod';
      index += 1;
      continue;
    }
    if (arg === '--release-dir') {
      releaseDir = path.resolve(argv[index + 1] || defaultReleaseDir);
      index += 1;
      continue;
    }
    if (arg === '--version') {
      version = trimString(argv[index + 1] || '');
      index += 1;
      continue;
    }
    if (arg === '--notes') {
      notes = trimString(argv[index + 1] || '');
      index += 1;
      continue;
    }
    if (arg === '--platform') {
      platform = trimString(argv[index + 1] || '');
      index += 1;
      continue;
    }
    if (arg === '--arch') {
      arch = trimString(argv[index + 1] || '');
      index += 1;
      continue;
    }
  }

  return { brandId, channel, releaseDir, version, notes, platform, arch };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function splitVersion(version) {
  const normalized = trimString(version);
  const [baseVersion] = normalized.split('+', 1);
  return {
    fullVersion: normalized,
    baseVersion: trimString(baseVersion),
  };
}

function isReleaseForAppVersion(releaseVersion, appVersion) {
  const { fullVersion, baseVersion } = splitVersion(appVersion);
  return (
    releaseVersion === fullVersion ||
    releaseVersion.startsWith(`${fullVersion}.`) ||
    releaseVersion === baseVersion ||
    releaseVersion.startsWith(`${baseVersion}.`)
  );
}

function compareByName(a, b) {
  return a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });
}

function resolveControlPlaneBaseUrl(profile) {
  const explicit = trimString(process.env.ICLAW_CONTROL_PLANE_BASE_URL);
  const fallback = trimString(profile?.endpoints?.authBaseUrl);
  const baseUrl = explicit || fallback;
  if (!baseUrl) {
    throw new Error('Missing control-plane base URL. Set ICLAW_CONTROL_PLANE_BASE_URL or endpoints.authBaseUrl.');
  }
  return baseUrl.replace(/\/+$/, '');
}

async function resolveAccessToken(baseUrl) {
  const explicitToken = trimString(process.env.ICLAW_CONTROL_PLANE_ACCESS_TOKEN);
  if (explicitToken) {
    return explicitToken;
  }

  const identifier =
    trimString(process.env.ICLAW_CONTROL_PLANE_ADMIN_IDENTIFIER) ||
    trimString(process.env.ICLAW_CONTROL_PLANE_ADMIN_EMAIL) ||
    trimString(process.env.CONTROL_PLANE_BOOTSTRAP_ADMIN_EMAIL) ||
    trimString(process.env.ICLAW_CONTROL_PLANE_ADMIN_USERNAME) ||
    trimString(process.env.CONTROL_PLANE_BOOTSTRAP_ADMIN_USERNAME);
  const password =
    trimString(process.env.ICLAW_CONTROL_PLANE_ADMIN_PASSWORD) ||
    trimString(process.env.CONTROL_PLANE_BOOTSTRAP_ADMIN_PASSWORD);

  if (!identifier || !password) {
    throw new Error('Missing control-plane admin credentials. Set ICLAW_CONTROL_PLANE_ACCESS_TOKEN or admin identifier/password env vars.');
  }

  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ identifier, password }),
  });
  const payload = await response.json().catch(() => null);
  const accessToken = trimString(payload?.data?.tokens?.access_token || payload?.data?.access_token);
  if (!response.ok || !accessToken) {
    throw new Error(`control-plane login failed: ${response.status}`);
  }
  return accessToken;
}

async function apiFetchJson(baseUrl, accessToken, requestPath, init = {}) {
  const response = await fetch(`${baseUrl}${requestPath}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers || {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    const message = payload?.error?.message || `${response.status} ${response.statusText}`.trim();
    throw new Error(`${requestPath}: ${message}`);
  }
  return payload;
}

async function apiUploadBinary(baseUrl, accessToken, requestPath, filePath, contentType) {
  const content = await fs.readFile(filePath);
  const response = await fetch(`${baseUrl}${requestPath}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': contentType,
      'x-iclaw-file-name': path.basename(filePath),
    },
    body: content,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    const message = payload?.error?.message || `${response.status} ${response.statusText}`.trim();
    throw new Error(`${requestPath}: ${message}`);
  }
  return payload;
}

async function findTargetArtifacts({ releaseDir, artifactBaseName, channel, appVersion, target }) {
  const entries = await fs.readdir(releaseDir, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  const installerPattern = new RegExp(
    `^${escapeRegExp(artifactBaseName)}_(?<releaseVersion>.+)_${escapeRegExp(target.arch)}_${escapeRegExp(channel)}\\.${escapeRegExp(target.installerExt)}$`,
  );
  const installerMatches = files
    .map((fileName) => {
      const match = fileName.match(installerPattern);
      if (!match?.groups?.releaseVersion) return null;
      if (!isReleaseForAppVersion(match.groups.releaseVersion, appVersion)) return null;
      return {
        fileName,
        releaseVersion: match.groups.releaseVersion,
      };
    })
    .filter(Boolean)
    .sort((left, right) => compareByName(left.fileName, right.fileName));

  const latestInstaller = installerMatches.at(-1);
  if (!latestInstaller) {
    return null;
  }

  const updaterName = `${artifactBaseName}_${latestInstaller.releaseVersion}_${target.arch}_${channel}.${target.updaterExt}`;
  const signatureName = `${updaterName}.sig`;
  const hasUpdater = files.includes(updaterName);
  const hasSignature = files.includes(signatureName);
  if (hasUpdater !== hasSignature) {
    throw new Error(`Incomplete release files for ${target.platform}/${target.arch}: updater and signature must either both exist or both be omitted for ${latestInstaller.releaseVersion}`);
  }

  return {
    platform: target.platform,
    arch: target.arch,
    installerPath: path.join(releaseDir, latestInstaller.fileName),
    updaterPath: hasUpdater ? path.join(releaseDir, updaterName) : null,
    signaturePath: hasSignature ? path.join(releaseDir, signatureName) : null,
  };
}

function inferContentType(filePath) {
  const normalized = filePath.toLowerCase();
  if (normalized.endsWith('.exe')) return 'application/vnd.microsoft.portable-executable';
  if (normalized.endsWith('.dmg')) return 'application/x-apple-diskimage';
  if (normalized.endsWith('.zip')) return 'application/zip';
  if (normalized.endsWith('.tar.gz')) return 'application/gzip';
  if (normalized.endsWith('.sig')) return 'text/plain; charset=utf-8';
  return 'application/octet-stream';
}

async function publishTarget({ baseUrl, accessToken, brandId, channel, version, notes, target }) {
  const targetPrefix = `/admin/portal/apps/${encodeURIComponent(brandId)}/desktop-release/${encodeURIComponent(channel)}/${encodeURIComponent(target.platform)}/${encodeURIComponent(target.arch)}`;
  await apiUploadBinary(baseUrl, accessToken, `${targetPrefix}/installer`, target.installerPath, inferContentType(target.installerPath));
  if (target.updaterPath && target.signaturePath) {
    await apiUploadBinary(baseUrl, accessToken, `${targetPrefix}/updater`, target.updaterPath, inferContentType(target.updaterPath));
    await apiUploadBinary(baseUrl, accessToken, `${targetPrefix}/signature`, target.signaturePath, inferContentType(target.signaturePath));
  }
  await apiFetchJson(baseUrl, accessToken, `${targetPrefix}/publish`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      version,
      notes: notes || null,
      mandatory: false,
      allow_current_run_to_finish: true,
      force_update_below_version: null,
      reason_code: null,
      reason_message: null,
    }),
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const packageJson = JSON.parse(await fs.readFile(path.join(rootDir, 'package.json'), 'utf8'));
  const appVersion = trimString(args.version || packageJson.version);
  const publishVersion = splitVersion(appVersion).baseVersion;
  if (!publishVersion) {
    throw new Error('Missing desktop publish version');
  }

  const { profile } = await loadBrandProfile({ rootDir, brandId: args.brandId, envName: args.channel });
  const baseUrl = resolveControlPlaneBaseUrl(profile);
  const accessToken = await resolveAccessToken(baseUrl);
  const filteredTargets = supportedTargets.filter((target) => {
    if (args.platform && target.platform !== args.platform) return false;
    if (args.arch && target.arch !== args.arch) return false;
    return true;
  });

  if (filteredTargets.length === 0) {
    throw new Error('No publish targets matched --platform/--arch filters');
  }

  let publishedCount = 0;
  for (const target of filteredTargets) {
    const artifacts = await findTargetArtifacts({
      releaseDir: args.releaseDir,
      artifactBaseName: trimString(profile?.distribution?.artifactBaseName) || trimString(profile?.productName),
      channel: args.channel,
      appVersion,
      target,
    });
    if (!artifacts) {
      continue;
    }
    await publishTarget({
      baseUrl,
      accessToken,
      brandId: args.brandId,
      channel: args.channel,
      version: publishVersion,
      notes: args.notes,
      target: artifacts,
    });
    process.stdout.write(`[desktop-release] published ${args.brandId}/${args.channel}/${target.platform}/${target.arch} -> ${publishVersion}\n`);
    publishedCount += 1;
  }

  if (publishedCount === 0) {
    throw new Error(`No release artifacts found under ${args.releaseDir} for ${args.brandId}/${args.channel}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
