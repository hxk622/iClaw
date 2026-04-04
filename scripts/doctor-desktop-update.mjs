#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const supportedChannels = new Set(['dev', 'prod', 'all']);

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseBaseVersion(version) {
  return trimString(version).split('+', 1)[0] || trimString(version);
}

function parseVersionTriplet(version) {
  const match = trimString(version).match(/^(\d+)\.(\d+)\.(\d+)(?:\+[\w.-]+)?$/);
  if (!match) return null;
  return [
    Number.parseInt(match[1], 10),
    Number.parseInt(match[2], 10),
    Number.parseInt(match[3], 10),
  ];
}

function compareVersions(left, right) {
  const a = parseVersionTriplet(left);
  const b = parseVersionTriplet(right);
  if (!a || !b) return 0;
  for (let index = 0; index < 3; index += 1) {
    if (a[index] > b[index]) return 1;
    if (a[index] < b[index]) return -1;
  }
  return 0;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function readIfExists(filePath) {
  try {
    return await readJson(filePath);
  } catch {
    return null;
  }
}

function normalizeChannel(value) {
  const normalized = trimString(value).toLowerCase();
  if (supportedChannels.has(normalized)) {
    return normalized;
  }
  return '';
}

function resolveRequestedChannel(argv) {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--channel') {
      return normalizeChannel(argv[index + 1]);
    }
    if (arg.startsWith('--channel=')) {
      return normalizeChannel(arg.slice('--channel='.length));
    }
  }

  const envChannel = normalizeChannel(process.env.DESKTOP_RELEASE_CHANNEL || process.env.ICLAW_ENV_NAME || '');
  return envChannel || 'all';
}

function summarizeManifest(channel, manifest) {
  if (!manifest || typeof manifest !== 'object') {
    return {
      channel,
      present: false,
      version: null,
      hasUpdater: false,
      entryCount: 0,
    };
  }

  const entries = Array.isArray(manifest.entries)
    ? manifest.entries
    : manifest.entry
      ? [manifest.entry]
      : [];
  const hasUpdater = entries.some((entry) => entry?.updater?.url && entry?.updater?.signature);

  return {
    channel,
    present: true,
    version: trimString(manifest.version) || null,
    baseVersion: trimString(manifest.version) ? parseBaseVersion(manifest.version) : null,
    hasUpdater,
    entryCount: entries.length,
  };
}

async function main() {
  const requestedChannel = resolveRequestedChannel(process.argv.slice(2));
  const packageJson = await readJson(path.join(rootDir, 'package.json'));
  const tauriConfig = await readJson(path.join(rootDir, 'apps/desktop/src-tauri/tauri.generated.conf.json'));
  const currentVersion = trimString(packageJson.version);
  const currentBaseVersion = parseBaseVersion(currentVersion);
  const publicKeyConfigured = Boolean(trimString(process.env.TAURI_UPDATER_PUBLIC_KEY));
  const signingKeyConfigured = Boolean(trimString(process.env.TAURI_SIGNING_PRIVATE_KEY));
  const tauriCreateUpdaterArtifactsMaterialized = Boolean(tauriConfig?.bundle?.createUpdaterArtifacts);
  const tauriCreateUpdaterArtifactsEffective = tauriCreateUpdaterArtifactsMaterialized || signingKeyConfigured;
  const warnings = [];

  const devManifest = summarizeManifest(
    'dev',
    await readIfExists(path.join(rootDir, 'dist/releases/latest-dev.json')),
  );
  const prodManifest = summarizeManifest(
    'prod',
    await readIfExists(path.join(rootDir, 'dist/releases/latest-prod.json')),
  );

  const issues = [];
  const channelsToCheck =
    requestedChannel === 'all'
      ? ['dev', 'prod']
      : requestedChannel === 'dev'
        ? ['dev']
        : ['prod'];

  if (!publicKeyConfigured) {
    issues.push('missing TAURI_UPDATER_PUBLIC_KEY: desktop runtime will report updater unsupported');
  }
  if (!signingKeyConfigured) {
    issues.push('missing TAURI_SIGNING_PRIVATE_KEY: build cannot create updater artifacts');
  }
  if (!tauriCreateUpdaterArtifactsEffective) {
    issues.push('tauri.generated.conf.json has bundle.createUpdaterArtifacts=false');
  } else if (signingKeyConfigured && !tauriCreateUpdaterArtifactsMaterialized) {
    warnings.push('tauri.generated.conf.json is stale in the worktree, but apply-brand can materialize updater artifacts under the current env');
  }

  if (channelsToCheck.includes('dev')) {
    if (!devManifest.present) {
      issues.push('dist/releases/latest-dev.json is missing');
    } else {
      if (!devManifest.hasUpdater) {
        issues.push('dev manifest has no signed updater payload');
      }
      if (devManifest.version && compareVersions(devManifest.version, currentVersion) < 0) {
        issues.push(`dev manifest version ${devManifest.version} is older than current app version ${currentVersion}`);
      }
    }
  }

  if (channelsToCheck.includes('prod')) {
    if (!prodManifest.present) {
      issues.push('dist/releases/latest-prod.json is missing');
    } else if (prodManifest.version && compareVersions(prodManifest.version, currentVersion) < 0) {
      issues.push(`prod manifest version ${prodManifest.version} is older than current app version ${currentVersion}`);
    }
  }

  const report = {
    requestedChannel,
    currentVersion,
    currentBaseVersion,
    publicKeyConfigured,
    signingKeyConfigured,
    tauriCreateUpdaterArtifacts: tauriCreateUpdaterArtifactsEffective,
    tauriCreateUpdaterArtifactsMaterialized,
    manifests: {
      dev: devManifest,
      prod: prodManifest,
    },
    warnings,
    issues,
    autoUpdateReady: issues.length === 0,
  };

  console.log(JSON.stringify(report, null, 2));
  if (issues.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
