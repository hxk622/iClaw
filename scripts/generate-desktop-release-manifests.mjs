#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { loadBrandProfile, resolveBrandId } from './lib/brand-profile.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const defaultReleaseDir = path.join(rootDir, 'dist', 'releases');
const supportedChannels = new Set(['dev', 'test', 'prod']);
const supportedTargets = [
  { platform: 'darwin', arch: 'aarch64', installerExt: 'dmg', updaterExt: 'app.tar.gz' },
  { platform: 'darwin', arch: 'x64', installerExt: 'dmg', updaterExt: 'app.tar.gz' },
  { platform: 'windows', arch: 'x64', installerExt: 'exe', updaterExt: 'nsis.zip' },
  { platform: 'windows', arch: 'aarch64', installerExt: 'exe', updaterExt: 'nsis.zip' },
];

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizePublicBaseUrl(value) {
  const normalized = trimString(value);
  return normalized ? normalized.replace(/\/+$/, '') : '';
}

function splitVersion(version) {
  const [baseVersion, buildId] = version.split('+', 2);
  return {
    baseVersion,
    buildId: buildId || null,
  };
}

function normalizeReleaseVersionPrefix(version) {
  return splitVersion(version).baseVersion;
}

async function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  const buffer = await fs.readFile(filePath);
  hash.update(buffer);
  return hash.digest('hex');
}

function buildArtifactUrl(publicBaseUrl, fileName, platform, arch) {
  if (!publicBaseUrl) return null;
  return `${publicBaseUrl}/${platform}/${arch}/${encodeURIComponent(fileName)}`;
}

function findUpdaterArtifacts(params) {
  const { artifactBaseName, releaseVersion, arch, channel, files, publicBaseUrl, releaseDir, updaterExt } = params;
  const archiveName = `${artifactBaseName}_${releaseVersion}_${arch}_${channel}.${updaterExt}`;
  const signatureName = `${archiveName}.sig`;
  if (!files.includes(archiveName) || !files.includes(signatureName)) {
    return null;
  }

  return {
    archiveName,
    signaturePath: path.join(releaseDir, signatureName),
    url: buildArtifactUrl(publicBaseUrl, archiveName, params.platform, params.arch),
  };
}

function parseArgs(argv) {
  let brandId = resolveBrandId();
  let channel = '';
  let releaseDir = defaultReleaseDir;
  let version = '';

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--brand') {
      brandId = resolveBrandId(argv[index + 1] || '');
      index += 1;
      continue;
    }
    if (arg === '--channel') {
      channel = trimString(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--release-dir') {
      const next = trimString(argv[index + 1]);
      if (next) releaseDir = path.resolve(next);
      index += 1;
      continue;
    }
    if (arg === '--version') {
      version = trimString(argv[index + 1]);
      index += 1;
      continue;
    }
  }

  if (!supportedChannels.has(channel)) {
    throw new Error('Usage: node scripts/generate-desktop-release-manifests.mjs --channel <dev|test|prod> [--version <x.y.z+build>] [--brand <brand-id>] [--release-dir <dir>]');
  }

  return {
    brandId,
    channel,
    releaseDir,
    version,
  };
}

function resolveCurrentVersion(explicitVersion, packageJson) {
  const fromArgs = trimString(explicitVersion);
  if (fromArgs) return fromArgs;
  const fromPackage = trimString(packageJson.version);
  if (!fromPackage) {
    throw new Error('Missing version in package.json');
  }
  return fromPackage;
}

function matchReleaseFile(fileName, artifactBaseName, target, channel) {
  const pattern = new RegExp(
    `^${escapeRegExp(artifactBaseName)}_(?<releaseVersion>.+)_${escapeRegExp(target.arch)}_${escapeRegExp(channel)}\\.${escapeRegExp(target.installerExt)}$`,
  );
  const match = fileName.match(pattern);
  if (!match?.groups?.releaseVersion) return null;
  return {
    releaseVersion: match.groups.releaseVersion,
  };
}

function isReleaseForAppVersion(releaseVersion, appVersion) {
  const normalizedAppVersion = trimString(appVersion);
  const publicVersion = normalizeReleaseVersionPrefix(normalizedAppVersion);
  return (
    releaseVersion === normalizedAppVersion ||
    releaseVersion.startsWith(`${normalizedAppVersion}.`) ||
    releaseVersion === publicVersion ||
    releaseVersion.startsWith(`${publicVersion}.`)
  );
}

function compareByName(a, b) {
  return a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });
}

async function collectEntries(params) {
  const { artifactBaseName, appVersion, channel, files, publicBaseUrl, releaseDir } = params;
  const versionParts = splitVersion(appVersion);
  const entries = [];

  for (const target of supportedTargets) {
    const matchingFiles = files
      .map((fileName) => {
        const match = matchReleaseFile(fileName, artifactBaseName, target, channel);
        if (!match) return null;
        if (!isReleaseForAppVersion(match.releaseVersion, appVersion)) return null;
        return {
          fileName,
          releaseVersion: match.releaseVersion,
        };
      })
      .filter(Boolean)
      .sort((left, right) => compareByName(left.fileName, right.fileName));

    const latest = matchingFiles.at(-1);
    if (!latest) continue;

    const filePath = path.join(releaseDir, latest.fileName);
    const stats = await fs.stat(filePath);
    const sha256 = await sha256File(filePath);
    const updaterArtifacts = findUpdaterArtifacts({
      artifactBaseName,
      releaseVersion: latest.releaseVersion,
      platform: target.platform,
      arch: target.arch,
      channel,
      files,
      publicBaseUrl,
      releaseDir,
      updaterExt: target.updaterExt,
    });
    const updaterSignature = updaterArtifacts
      ? trimString(await fs.readFile(updaterArtifacts.signaturePath, 'utf8'))
      : '';

    entries.push({
      platform: target.platform,
      arch: target.arch,
      version: appVersion,
      base_version: versionParts.baseVersion,
      build_id: versionParts.buildId,
      release_version: latest.releaseVersion,
      artifact_name: latest.fileName,
      artifact_url: buildArtifactUrl(publicBaseUrl, latest.fileName, target.platform, target.arch),
      artifact_size: stats.size,
      artifact_sha256: sha256,
      published_at: stats.mtime.toISOString(),
      updater:
        updaterArtifacts?.url && updaterSignature
          ? {
              url: updaterArtifacts.url,
              signature: updaterSignature,
              pub_date: stats.mtime.toISOString(),
            }
          : null,
    });
  }

  return entries;
}

async function writeJson(filePath, payload) {
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const packageJsonPath = path.join(rootDir, 'package.json');
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
  const appVersion = resolveCurrentVersion(args.version, packageJson);
  const { profile } = await loadBrandProfile({ rootDir, brandId: args.brandId });
  const publicBaseUrl = normalizePublicBaseUrl(profile.distribution.downloads[args.channel]?.publicBaseUrl);
  const artifactBaseName = profile.distribution.artifactBaseName;
  const dirEntries = await fs.readdir(args.releaseDir, { withFileTypes: true });
  const files = dirEntries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  const entries = await collectEntries({
    artifactBaseName,
    appVersion,
    channel: args.channel,
    files,
    publicBaseUrl,
    releaseDir: args.releaseDir,
  });

  if (entries.length === 0) {
    throw new Error(
      `No desktop release artifacts found for version ${appVersion} under ${args.releaseDir} (channel=${args.channel})`,
    );
  }

  const generatedAt = new Date().toISOString();
  const versionParts = splitVersion(appVersion);
  const indexPayload = {
    schema_version: 1,
    brand_id: profile.brandId,
    artifact_base_name: artifactBaseName,
    channel: args.channel,
    version: appVersion,
    base_version: versionParts.baseVersion,
    build_id: versionParts.buildId,
    generated_at: generatedAt,
    entries,
  };

  const indexPath = path.join(args.releaseDir, `latest-${args.channel}.json`);
  await writeJson(indexPath, indexPayload);

  for (const entry of entries) {
    const targetPayload = {
      schema_version: 1,
      brand_id: profile.brandId,
      artifact_base_name: artifactBaseName,
      channel: args.channel,
      version: appVersion,
      base_version: versionParts.baseVersion,
      build_id: versionParts.buildId,
      generated_at: generatedAt,
      entry,
    };
    const targetPath = path.join(args.releaseDir, `latest-${args.channel}-${entry.platform}-${entry.arch}.json`);
    await writeJson(targetPath, targetPayload);
  }

  process.stdout.write(`Generated desktop release manifests for ${args.channel}: ${entries.length} target(s)\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
