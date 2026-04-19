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
  { platform: 'windows', arch: 'x64', publicPlatform: 'windows' },
  { platform: 'windows', arch: 'aarch64', publicPlatform: 'windows' },
  { platform: 'darwin', arch: 'x64', publicPlatform: 'mac' },
  { platform: 'darwin', arch: 'aarch64', publicPlatform: 'mac' },
];

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseArgs(argv) {
  let brandId = resolveBrandId();
  let channel = 'prod';
  let outDir = defaultReleaseDir;

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
    if (arg === '--out-dir') {
      outDir = path.resolve(argv[index + 1] || defaultReleaseDir);
      index += 1;
    }
  }

  return { brandId, channel, outDir };
}

function resolveControlPlaneBaseUrl(profile) {
  const explicit = trimString(process.env.ICLAW_CONTROL_PLANE_BASE_URL);
  if (!explicit) {
    throw new Error('Missing control-plane base URL. Set ICLAW_CONTROL_PLANE_BASE_URL.');
  }
  return explicit.replace(/\/+$/, '');
}

async function fetchManifest(baseUrl, brandId, channel, target) {
  const params = new URLSearchParams({
    app_name: brandId,
    channel,
    target: target.platform,
    arch: target.arch,
  });
  const response = await fetch(`${baseUrl}/desktop/release-manifest?${params.toString()}`);
  if (response.status === 404) {
    return null;
  }
  const payload = await response.json().catch(() => null);
  const data = payload && payload.success === true ? payload.data : payload;
  if (!response.ok || payload?.success === false) {
    const message = payload?.error?.message || `${response.status} ${response.statusText}`.trim();
    throw new Error(`failed to export manifest for ${target.platform}/${target.arch}: ${message}`);
  }
  const directEntry =
    data?.entry &&
    data.entry.platform === target.platform &&
    data.entry.arch === target.arch
      ? data.entry
      : null;
  const fallbackEntry = Array.isArray(data?.entries)
    ? data.entries.find((entry) => entry?.platform === target.platform && entry?.arch === target.arch) || null
    : null;
  if (!directEntry && !fallbackEntry) {
    return null;
  }
  return {
    ...data,
    entry: directEntry || fallbackEntry,
  };
}

async function writeJson(filePath, payload) {
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { profile } = await loadBrandProfile({ rootDir, brandId: args.brandId, envName: args.channel });
  const baseUrl = resolveControlPlaneBaseUrl(profile);
  const entries = [];
  let version = null;

  await fs.mkdir(args.outDir, { recursive: true });

  for (const target of supportedTargets) {
    const manifest = await fetchManifest(baseUrl, args.brandId, args.channel, target);
    if (!manifest?.entry) {
      continue;
    }
    entries.push(manifest.entry);
    version = version || manifest.version || manifest.entry.version || null;
    const targetPayload = {
      schema_version: 1,
      brand_id: args.brandId,
      artifact_base_name: trimString(profile?.distribution?.artifactBaseName) || trimString(profile?.productName),
      channel: args.channel,
      version: manifest.version || manifest.entry.version,
      base_version: trimString((manifest.version || manifest.entry.version || '').split('+', 1)[0]) || null,
      build_id: null,
      generated_at: manifest.generated_at || new Date().toISOString(),
      entry: manifest.entry,
    };
    await writeJson(
      path.join(args.outDir, `latest-${args.channel}-${target.publicPlatform}-${target.arch}.json`),
      targetPayload,
    );
  }

  if (entries.length === 0) {
    throw new Error(`No published desktop release manifests found for ${args.brandId}/${args.channel}`);
  }

  const uniqueVersions = Array.from(new Set(entries.map((entry) => entry.version)));
  const indexPayload = {
    schema_version: 1,
    brand_id: args.brandId,
    artifact_base_name: trimString(profile?.distribution?.artifactBaseName) || trimString(profile?.productName),
    channel: args.channel,
    version: uniqueVersions.length === 1 ? uniqueVersions[0] : version,
    base_version: uniqueVersions.length === 1 ? trimString((uniqueVersions[0] || '').split('+', 1)[0]) || null : null,
    build_id: null,
    generated_at: new Date().toISOString(),
    entries,
  };
  await writeJson(path.join(args.outDir, `latest-${args.channel}.json`), indexPayload);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
