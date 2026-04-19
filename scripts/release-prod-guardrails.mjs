#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {spawnSync} from 'node:child_process';

import {loadBrandProfile, resolveBrandId} from './lib/brand-profile.mjs';

const rootDir = process.cwd();

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = {
    brandId: '',
    channel: trimString(process.env.ICLAW_ENV_NAME || process.env.NODE_ENV || 'prod') || 'prod',
    releaseVersion: trimString(process.env.ICLAW_RELEASE_VERSION || process.env.ICLAW_DESKTOP_RELEASE_VERSION || ''),
    target: 'x86_64-pc-windows-msvc',
    mode: 'all',
    allowDirty: false,
    allowStash: false,
    checkDesktopReleaseApi: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--brand') {
      options.brandId = resolveBrandId(argv[index + 1] || '');
      index += 1;
      continue;
    }
    if (arg.startsWith('--brand=')) {
      options.brandId = resolveBrandId(arg.slice('--brand='.length));
      continue;
    }
    if (arg === '--channel') {
      options.channel = trimString(argv[index + 1] || '') || options.channel;
      index += 1;
      continue;
    }
    if (arg.startsWith('--channel=')) {
      options.channel = trimString(arg.slice('--channel='.length)) || options.channel;
      continue;
    }
    if (arg === '--release-version') {
      options.releaseVersion = trimString(argv[index + 1] || '');
      index += 1;
      continue;
    }
    if (arg.startsWith('--release-version=')) {
      options.releaseVersion = trimString(arg.slice('--release-version='.length));
      continue;
    }
    if (arg === '--target') {
      options.target = trimString(argv[index + 1] || '') || options.target;
      index += 1;
      continue;
    }
    if (arg.startsWith('--target=')) {
      options.target = trimString(arg.slice('--target='.length)) || options.target;
      continue;
    }
    if (arg === '--mode') {
      options.mode = trimString(argv[index + 1] || '') || options.mode;
      index += 1;
      continue;
    }
    if (arg.startsWith('--mode=')) {
      options.mode = trimString(arg.slice('--mode='.length)) || options.mode;
      continue;
    }
    if (arg === '--allow-dirty') {
      options.allowDirty = true;
      continue;
    }
    if (arg === '--allow-stash') {
      options.allowStash = true;
      continue;
    }
    if (arg === '--check-desktop-release-api') {
      options.checkDesktopReleaseApi = true;
      continue;
    }
  }

  return options;
}

function runCapture(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? rootDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: options.env ?? process.env,
    shell: options.shell ?? false,
  });
  if (result.error) {
    throw result.error;
  }
  return result;
}

function ensureCleanWorktree() {
  const result = runCapture('git', ['status', '--short']);
  if ((result.status ?? 1) !== 0) {
    fail(trimString(result.stderr) || 'git status failed');
  }
  const output = trimString(result.stdout);
  if (output) {
    fail(`working tree is not clean:\n${output}`);
  }
}

function ensureEmptyStash() {
  const result = runCapture('git', ['stash', 'list']);
  if ((result.status ?? 1) !== 0) {
    fail(trimString(result.stderr) || 'git stash list failed');
  }
  const output = trimString(result.stdout);
  if (output) {
    fail(`stash is not empty:\n${output}`);
  }
}

async function collectShellScriptsWithCrLf() {
  const releaseCriticalScripts = [
    'scripts/with-env.sh',
    'scripts/publish-downloads.sh',
    'scripts/deploy-control-plane.sh',
    'scripts/deploy-admin.sh',
    'scripts/deploy-home.sh',
    'scripts/deploy-prod-marketing.sh',
    'scripts/build-openclaw-runtime.sh',
    'scripts/build-openclaw-server-runtime.sh',
    'scripts/prepare-openclaw-workspace.sh',
    'scripts/lib/env-files.sh',
    'scripts/lib/gateway-token.sh',
    'scripts/lib/openclaw-launcher.sh',
    'scripts/lib/openclaw-package.sh',
  ];
  const offenders = [];

  for (const relativePath of releaseCriticalScripts) {
    const fullPath = path.join(rootDir, relativePath);
    const buffer = await fs.readFile(fullPath).catch(() => null);
    if (!buffer) {
      offenders.push(`${relativePath} (missing)`);
      continue;
    }
    if (buffer.includes(Buffer.from('\r\n'))) {
      offenders.push(relativePath);
    }
  }

  return offenders.sort();
}

function targetTripleToArch(targetTriple) {
  if (/aarch64|arm64/i.test(targetTriple)) return 'aarch64';
  return 'x64';
}

function deriveApiVersion(releaseVersion) {
  const match = trimString(releaseVersion).match(/^(\d+\.\d+\.\d+)/);
  return match ? match[1] : '';
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

function unwrapSuccessPayload(payload) {
  if (payload && typeof payload === 'object' && payload.success === true && payload.data) {
    return payload.data;
  }
  return payload;
}

function extractManifestEntry(payload, platform, arch) {
  if (payload?.entry?.platform === platform && payload?.entry?.arch === arch) {
    return payload.entry;
  }
  if (Array.isArray(payload?.entries)) {
    return payload.entries.find((entry) => entry?.platform === platform && entry?.arch === arch) || null;
  }
  return null;
}

async function ensureLocalReleaseArtifacts({artifactBaseName, channel, releaseVersion, targetTriple}) {
  const arch = targetTripleToArch(targetTriple);
  const releaseDir = path.join(rootDir, 'dist', 'releases');
  const expectedArtifactName = `${artifactBaseName}_${releaseVersion}_${arch}_${channel}.exe`;
  const artifactPath = path.join(releaseDir, expectedArtifactName);
  await fs.access(artifactPath).catch(() => fail(`missing local release artifact: ${path.relative(rootDir, artifactPath)}`));

  const latestManifestPath = path.join(releaseDir, `latest-${channel}-windows-${arch}.json`);
  const aggregateManifestPath = path.join(releaseDir, `latest-${channel}.json`);
  const latestPayload = await readJson(latestManifestPath).catch(() => fail(`missing local manifest: ${path.relative(rootDir, latestManifestPath)}`));
  const aggregatePayload = await readJson(aggregateManifestPath).catch(() =>
    fail(`missing aggregate manifest: ${path.relative(rootDir, aggregateManifestPath)}`),
  );

  const latestEntry = extractManifestEntry(latestPayload, 'windows', arch);
  const aggregateEntry = extractManifestEntry(aggregatePayload, 'windows', arch);
  if (!latestEntry) {
    fail(`local latest manifest is missing windows/${arch} entry: ${path.relative(rootDir, latestManifestPath)}`);
  }
  if (!aggregateEntry) {
    fail(`local aggregate manifest is missing windows/${arch} entry: ${path.relative(rootDir, aggregateManifestPath)}`);
  }

  if (trimString(latestEntry.release_version) !== releaseVersion) {
    fail(`local latest manifest release_version mismatch: expected ${releaseVersion}, got ${trimString(latestEntry.release_version) || '<empty>'}`);
  }
  if (trimString(aggregateEntry.release_version) !== releaseVersion) {
    fail(`local aggregate manifest release_version mismatch: expected ${releaseVersion}, got ${trimString(aggregateEntry.release_version) || '<empty>'}`);
  }
  if (trimString(latestEntry.artifact_name) !== expectedArtifactName) {
    fail(`local latest manifest artifact_name mismatch: expected ${expectedArtifactName}, got ${trimString(latestEntry.artifact_name) || '<empty>'}`);
  }
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    fail(`request failed ${response.status} ${response.statusText}: ${url}`);
  }
  return response.json();
}

function resolveDesktopReleaseApiBaseUrl(profile, channel, downloadsBaseUrl) {
  const explicitBaseUrl = trimString(process.env.ICLAW_CONTROL_PLANE_BASE_URL).replace(/\/+$/, '');
  if (explicitBaseUrl) {
    return explicitBaseUrl;
  }

  const runtimeBaseUrl = trimString(profile?.runtimeDistribution?.[channel]?.publicBaseUrl).replace(/\/+$/, '');
  if (runtimeBaseUrl) {
    return runtimeBaseUrl;
  }

  const normalizedDownloadsBaseUrl = trimString(downloadsBaseUrl).replace(/\/+$/, '');
  if (normalizedDownloadsBaseUrl) {
    return normalizedDownloadsBaseUrl.replace(/\/downloads$/i, '');
  }

  return '';
}

async function ensurePublicReleaseArtifacts({profile, channel, releaseVersion, targetTriple, checkDesktopReleaseApi}) {
  const arch = targetTripleToArch(targetTriple);
  const downloadsBaseUrl = trimString(profile?.distribution?.downloads?.[channel]?.publicBaseUrl).replace(/\/+$/, '');
  if (!downloadsBaseUrl) {
    fail(`missing public downloads base URL for channel=${channel}`);
  }
  const manifestUrl = `${downloadsBaseUrl}/windows/${arch}/latest-${channel}-windows-${arch}.json`;
  const manifestPayload = await fetchJson(manifestUrl);
  const manifestEntry = extractManifestEntry(manifestPayload, 'windows', arch);
  if (!manifestEntry) {
    fail(`public manifest is missing windows/${arch} entry: ${manifestUrl}`);
  }
  if (trimString(manifestEntry.release_version) !== releaseVersion) {
    fail(`public manifest release_version mismatch: expected ${releaseVersion}, got ${trimString(manifestEntry.release_version) || '<empty>'}`);
  }

  const artifactUrl = trimString(manifestEntry.artifact_url);
  if (!artifactUrl) {
    fail(`public manifest missing artifact_url: ${manifestUrl}`);
  }
  const artifactHead = await fetch(artifactUrl, {method: 'HEAD'});
  if (!artifactHead.ok) {
    fail(`public artifact is not reachable: ${artifactUrl} (${artifactHead.status})`);
  }

  if (!checkDesktopReleaseApi) {
    return;
  }

  const releaseApiBaseUrl = resolveDesktopReleaseApiBaseUrl(profile, channel, downloadsBaseUrl);
  if (!releaseApiBaseUrl) {
    fail('missing desktop release API base URL');
  }
  const releaseApiUrl = `${releaseApiBaseUrl}/desktop/release-manifest?app_name=${encodeURIComponent(profile.brandId)}&channel=${encodeURIComponent(channel)}`;
  const releaseApiPayload = unwrapSuccessPayload(await fetchJson(releaseApiUrl));
  const releaseApiEntry = Array.isArray(releaseApiPayload?.entries)
    ? releaseApiPayload.entries.find((entry) => entry?.platform === 'windows' && entry?.arch === arch) || null
    : null;
  if (!releaseApiEntry) {
    fail(`desktop release API missing windows/${arch} entry: ${releaseApiUrl}`);
  }
  const expectedApiVersion = deriveApiVersion(releaseVersion);
  if (!expectedApiVersion) {
    fail(`failed to derive desktop release API version from releaseVersion=${releaseVersion}`);
  }
  if (trimString(releaseApiEntry.version) !== expectedApiVersion) {
    fail(`desktop release API version mismatch: expected ${expectedApiVersion}, got ${trimString(releaseApiEntry.version) || '<empty>'}`);
  }
  const expectedArtifactName = `${trimString(profile?.distribution?.artifactBaseName)}_${releaseVersion}_${arch}_${channel}.exe`;
  if (trimString(releaseApiEntry.artifact_name) !== expectedArtifactName) {
    fail(`desktop release API artifact_name mismatch: expected ${expectedArtifactName}, got ${trimString(releaseApiEntry.artifact_name) || '<empty>'}`);
  }
}

async function ensureVersionRecordSkeleton(releaseVersion) {
  const versionRecordPath = path.join(rootDir, 'docs', 'version_record', `${releaseVersion}.md`);
  const testReportPath = path.join(rootDir, 'docs', 'version_record', 'test_report', `${releaseVersion}.md`);
  await fs.access(versionRecordPath).catch(() => fail(`missing version record: ${path.relative(rootDir, versionRecordPath)}`));
  await fs.access(testReportPath).catch(() => fail(`missing test report: ${path.relative(rootDir, testReportPath)}`));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  options.brandId = resolveBrandId(options.brandId);
  if (!options.releaseVersion) {
    fail('Usage: node scripts/release-prod-guardrails.mjs --release-version <x.y.z.build>');
  }

  const {profile} = await loadBrandProfile({rootDir, brandId: options.brandId, envName: options.channel});
  const mode = trimString(options.mode || 'all').toLowerCase();
  const checks = [];

  if (mode === 'all' || mode === 'pre') {
    await ensureVersionRecordSkeleton(options.releaseVersion);
    if (!options.allowDirty) {
      ensureCleanWorktree();
    }
    if (!options.allowStash) {
      ensureEmptyStash();
    }
    const offenders = await collectShellScriptsWithCrLf();
    if (offenders.length > 0) {
      fail(`shell scripts must use LF only:\n${offenders.join('\n')}`);
    }
    checks.push('pre');
  }

  if (mode === 'all' || mode === 'local') {
    await ensureLocalReleaseArtifacts({
      artifactBaseName: trimString(profile?.distribution?.artifactBaseName),
      channel: options.channel,
      releaseVersion: options.releaseVersion,
      targetTriple: options.target,
    });
    checks.push('local');
  }

  if (mode === 'all' || mode === 'public') {
    await ensurePublicReleaseArtifacts({
      profile,
      channel: options.channel,
      releaseVersion: options.releaseVersion,
      targetTriple: options.target,
      checkDesktopReleaseApi: options.checkDesktopReleaseApi,
    });
    checks.push('public');
  }

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        brandId: profile.brandId,
        channel: options.channel,
        releaseVersion: options.releaseVersion,
        target: options.target,
        checks,
        desktopReleaseApiChecked: options.checkDesktopReleaseApi,
      },
      null,
      2,
    ) + '\n',
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
