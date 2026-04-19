#!/usr/bin/env node
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { loadBrandProfile, resolveBrandId } from './lib/brand-profile.mjs';
import {
  classifyDesktopReleaseUpdaterState,
  nativeUpdaterExpected,
  resolveDesktopReleaseTargetArtifacts,
  supportedDesktopReleaseTargets,
} from './lib/desktop-release-artifacts.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const defaultReleaseDir = path.join(rootDir, 'dist', 'releases');
const supportedTargets = supportedDesktopReleaseTargets.map(({ platform, arch, installerExt, updaterExt }) => ({
  platform,
  arch,
  installerExt,
  updaterExt,
}));

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
  let mandatory = false;
  let allowCurrentRunToFinish = true;
  let forceUpdateBelowVersion = '';
  let reasonCode = '';
  let reasonMessage = '';

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
    if (arg === '--mandatory') {
      mandatory = true;
      continue;
    }
    if (arg === '--disallow-current-run-to-finish') {
      allowCurrentRunToFinish = false;
      continue;
    }
    if (arg === '--allow-current-run-to-finish') {
      allowCurrentRunToFinish = true;
      continue;
    }
    if (arg === '--force-update-below-version') {
      forceUpdateBelowVersion = trimString(argv[index + 1] || '');
      index += 1;
      continue;
    }
    if (arg === '--reason-code') {
      reasonCode = trimString(argv[index + 1] || '');
      index += 1;
      continue;
    }
    if (arg === '--reason-message') {
      reasonMessage = trimString(argv[index + 1] || '');
      index += 1;
      continue;
    }
  }

  return {
    brandId,
    channel,
    releaseDir,
    version,
    notes,
    platform,
    arch,
    mandatory,
    allowCurrentRunToFinish,
    forceUpdateBelowVersion,
    reasonCode,
    reasonMessage,
  };
}

function splitVersion(version) {
  const normalized = trimString(version);
  const [baseVersion] = normalized.split('+', 1);
  return {
    fullVersion: normalized,
    baseVersion: trimString(baseVersion),
  };
}

function resolveControlPlaneBaseUrl(profile) {
  const explicit = trimString(process.env.ICLAW_CONTROL_PLANE_BASE_URL);
  if (!explicit) {
    throw new Error('Missing control-plane base URL. Set ICLAW_CONTROL_PLANE_BASE_URL.');
  }
  return explicit.replace(/\/+$/, '');
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

function runCapture(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? rootDir,
    env: options.env ?? process.env,
    shell: options.shell ?? false,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error) {
    throw result.error;
  }
  return result;
}

function runChecked(command, args, options = {}) {
  const result = runCapture(command, args, options);
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || result.stdout?.trim() || `${command} failed`);
  }
  return result;
}

function parseJsonFromCommandOutput(output) {
  const raw = trimString(output);
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace < 0 || lastBrace < firstBrace) {
    throw new Error(`Expected JSON in command output, got: ${raw.slice(0, 240)}`);
  }
  return JSON.parse(raw.slice(firstBrace, lastBrace + 1));
}

function resolveRemoteControlPlaneTarget() {
  const host = trimString(process.env.ICLAW_CONTROL_PLANE_HOST) || trimString(process.env.ICLAW_PROD_APP_HOST);
  if (!host) {
    throw new Error('Missing control-plane host. Set ICLAW_CONTROL_PLANE_HOST or ICLAW_PROD_APP_HOST.');
  }
  return {
    host,
    user: trimString(process.env.ICLAW_CONTROL_PLANE_USER) || 'root',
    path: trimString(process.env.ICLAW_CONTROL_PLANE_PATH) || '/opt/iclaw',
  };
}

function shouldUseRemoteDesktopReleaseUpload() {
  const mode = trimString(process.env.ICLAW_DESKTOP_RELEASE_UPLOAD_MODE).toLowerCase();
  if (mode === 'remote') return true;
  if (mode === 'local') return false;
  const endpoint = trimString(process.env.S3_ENDPOINT);
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/i.test(endpoint);
}

async function uploadArtifactDirect({ brandId, channel, platform, arch, artifactType, filePath, contentType }) {
  const scriptPath = path.join(rootDir, 'services', 'control-plane', 'scripts', 'upload-desktop-release-file.ts');
  const result = runCapture(
    process.execPath,
    [
      '--experimental-strip-types',
      scriptPath,
      '--app',
      brandId,
      '--channel',
      channel,
      '--platform',
      platform,
      '--arch',
      arch,
      '--artifact-type',
      artifactType,
      '--file',
      filePath,
      '--content-type',
      contentType,
    ],
    {
      cwd: rootDir,
      env: process.env,
    },
  );
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || result.stdout?.trim() || `${scriptPath} failed`);
  }
  return parseJsonFromCommandOutput(result.stdout || '{}');
}

async function uploadArtifactViaRemoteHost({ brandId, channel, platform, arch, artifactType, filePath, contentType }) {
  const remote = resolveRemoteControlPlaneTarget();
  const remoteTarget = `${remote.user}@${remote.host}`;
  const remoteTempDir = `/tmp/iclaw-desktop-release-${Date.now()}`;
  const remoteFilePath = `${remoteTempDir}/${path.basename(filePath)}`;

  runChecked('ssh', [remoteTarget, `mkdir -p ${JSON.stringify(remoteTempDir)}`]);
  runChecked('scp', [filePath, `${remoteTarget}:${remoteFilePath}`]);

  try {
    const remoteScript = `${remote.path}/services/control-plane/scripts/upload-desktop-release-file.ts`;
    const result = runCapture('ssh', [
      remoteTarget,
      [
        'cd',
        JSON.stringify(remote.path),
        '&&',
        'node',
        'scripts/run-with-env.mjs',
        'prod',
        'node',
        '--experimental-strip-types',
        remoteScript,
        '--app',
        brandId,
        '--channel',
        channel,
        '--platform',
        platform,
        '--arch',
        arch,
        '--artifact-type',
        artifactType,
        '--file',
        remoteFilePath,
        '--content-type',
        contentType,
      ].join(' '),
    ]);
    if (result.status !== 0) {
      throw new Error(result.stderr?.trim() || result.stdout?.trim() || `remote upload failed for ${path.basename(filePath)}`);
    }
    return parseJsonFromCommandOutput(result.stdout || '{}');
  } finally {
    runCapture('ssh', [remoteTarget, `rm -rf ${JSON.stringify(remoteTempDir)}`]);
  }
}

async function registerUploadedArtifact(baseUrl, accessToken, requestPath, payload) {
  return apiFetchJson(baseUrl, accessToken, requestPath, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payload),
  });
}

async function findTargetArtifacts({ releaseDir, artifactBaseName, channel, appVersion, target, updaterExpected }) {
  const entries = await fs.readdir(releaseDir, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  const artifacts = resolveDesktopReleaseTargetArtifacts({
    releaseDir,
    artifactBaseName,
    channel,
    appVersion,
    target: {
      ...target,
      publicPlatform: target.platform === 'darwin' ? 'mac' : target.platform,
    },
    files,
  });
  if (!artifacts) {
    return null;
  }
  const classification = classifyDesktopReleaseUpdaterState(artifacts, { updaterExpected });
  if (classification.status === 'missing-signature' || classification.status === 'missing-updater') {
    throw new Error(
      `Incomplete release files for ${target.platform}/${target.arch}/${artifacts.releaseVersion}: ${classification.message}`,
    );
  }
  if (classification.status === 'missing-updater-and-signature') {
    throw new Error(
      `Missing signed updater artifacts for ${target.platform}/${target.arch}/${artifacts.releaseVersion}: ${classification.message}`,
    );
  }

  return {
    platform: target.platform,
    arch: target.arch,
    installerPath: artifacts.installerPath,
    updaterPath: artifacts.updaterPath,
    signaturePath: artifacts.signaturePath,
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

async function publishTarget({ baseUrl, accessToken, brandId, channel, version, notes, target, policy }) {
  const targetPrefix = `/admin/portal/apps/${encodeURIComponent(brandId)}/desktop-release/${encodeURIComponent(channel)}/${encodeURIComponent(target.platform)}/${encodeURIComponent(target.arch)}`;
  const uploadArtifact = shouldUseRemoteDesktopReleaseUpload() ? uploadArtifactViaRemoteHost : uploadArtifactDirect;
  const installerUpload = await uploadArtifact({
    brandId,
    channel,
    platform: target.platform,
    arch: target.arch,
    artifactType: 'installer',
    filePath: target.installerPath,
    contentType: inferContentType(target.installerPath),
  });
  await registerUploadedArtifact(baseUrl, accessToken, `${targetPrefix}/installer/register`, installerUpload);
  if (target.updaterPath && target.signaturePath) {
    const updaterUpload = await uploadArtifact({
      brandId,
      channel,
      platform: target.platform,
      arch: target.arch,
      artifactType: 'updater',
      filePath: target.updaterPath,
      contentType: inferContentType(target.updaterPath),
    });
    await registerUploadedArtifact(baseUrl, accessToken, `${targetPrefix}/updater/register`, updaterUpload);
    const signatureUpload = await uploadArtifact({
      brandId,
      channel,
      platform: target.platform,
      arch: target.arch,
      artifactType: 'signature',
      filePath: target.signaturePath,
      contentType: inferContentType(target.signaturePath),
    });
    await registerUploadedArtifact(baseUrl, accessToken, `${targetPrefix}/signature/register`, {
      ...signatureUpload,
      signature: trimString(await fs.readFile(target.signaturePath, 'utf8')),
    });
  }
  await apiFetchJson(baseUrl, accessToken, `${targetPrefix}/publish`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      version,
      notes: notes || null,
      mandatory: policy.mandatory,
      allow_current_run_to_finish: policy.allowCurrentRunToFinish,
      force_update_below_version: policy.forceUpdateBelowVersion,
      reason_code: policy.reasonCode,
      reason_message: policy.reasonMessage,
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
  const policy = {
    mandatory: args.mandatory,
    allowCurrentRunToFinish: args.allowCurrentRunToFinish,
    forceUpdateBelowVersion: args.forceUpdateBelowVersion || null,
    reasonCode: args.reasonCode || null,
    reasonMessage: args.reasonMessage || null,
  };
  const filteredTargets = supportedTargets.filter((target) => {
    if (args.platform && target.platform !== args.platform) return false;
    if (args.arch && target.arch !== args.arch) return false;
    return true;
  });

  if (filteredTargets.length === 0) {
    throw new Error('No publish targets matched --platform/--arch filters');
  }

  const updaterExpected = nativeUpdaterExpected(process.env);
  let publishedCount = 0;
  for (const target of filteredTargets) {
    const artifacts = await findTargetArtifacts({
      releaseDir: args.releaseDir,
      artifactBaseName: trimString(profile?.distribution?.artifactBaseName) || trimString(profile?.productName),
      channel: args.channel,
      appVersion,
      target,
      updaterExpected,
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
      policy,
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
