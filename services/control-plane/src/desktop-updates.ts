import { access, readFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { join } from 'node:path';

export const DESKTOP_UPDATE_RESPONSE_HEADERS = [
  'x-iclaw-latest-version',
  'x-iclaw-update-available',
  'x-iclaw-update-mandatory',
  'x-iclaw-update-manifest-url',
  'x-iclaw-update-artifact-url',
] as const;

type DesktopReleaseManifestEntry = {
  platform?: unknown;
  arch?: unknown;
  version?: unknown;
  artifact_url?: unknown;
  published_at?: unknown;
  updater?: unknown;
};

type DesktopReleaseIndexManifest = {
  version?: unknown;
  entries?: unknown;
};

type DesktopReleaseTargetManifest = {
  version?: unknown;
  entry?: unknown;
};

type DesktopUpdateManifestSource = {
  channel: string;
  manifestDir: string;
  publicBaseUrl: string;
  cacheTtlMs: number;
  mandatory: boolean;
  forceUpdateBelowVersion?: string | null;
};

export type DesktopUpdateRequest = {
  appVersion?: string | null;
  platform?: string | null;
  arch?: string | null;
  channel?: string | null;
};

export type DesktopUpdateHint = {
  latestVersion: string;
  updateAvailable: boolean;
  mandatory: boolean;
  manifestUrl: string | null;
  artifactUrl: string | null;
};

export type DesktopUpdaterPayload = {
  version: string;
  url: string;
  signature: string;
  notes: string | null;
  pubDate: string | null;
  mandatory: boolean;
  externalDownloadUrl: string | null;
};

type CacheRecord = {
  expiresAt: number;
  value: DesktopUpdateHint | null;
};

const MANIFEST_CACHE = new Map<string, CacheRecord>();

function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeChannel(value?: string | null): string {
  const normalized = trimString(value).toLowerCase();
  return normalized === 'dev' ? 'dev' : 'prod';
}

function normalizePlatform(value?: string | null): string {
  const normalized = trimString(value).toLowerCase();
  if (!normalized) return '';
  if (normalized.startsWith('darwin')) return 'darwin';
  if (normalized.startsWith('windows')) return 'windows';
  if (normalized.startsWith('linux')) return 'linux';
  return normalized;
}

function normalizeArch(value?: string | null): string {
  const normalized = trimString(value).toLowerCase();
  if (!normalized) return '';
  if (normalized.includes('aarch64') || normalized.includes('arm64')) return 'aarch64';
  if (normalized.includes('x86_64') || normalized.includes('amd64') || normalized.includes('x64')) return 'x64';
  if (normalized === 'arm64') return 'aarch64';
  if (normalized === 'x86_64' || normalized === 'amd64') return 'x64';
  return normalized;
}

function normalizeBaseUrl(value: string): string {
  return trimString(value).replace(/\/+$/, '');
}

function parseVersionTriplet(value: string): [number, number, number] | null {
  const match = value.trim().match(/^(\d+)\.(\d+)\.(\d+)(?:\+[\w.-]+)?$/);
  if (!match) return null;
  return [
    Number.parseInt(match[1], 10),
    Number.parseInt(match[2], 10),
    Number.parseInt(match[3], 10),
  ];
}

function compareVersions(left: string, right: string): number {
  const parsedLeft = parseVersionTriplet(left);
  const parsedRight = parseVersionTriplet(right);
  if (!parsedLeft || !parsedRight) return 0;
  for (let index = 0; index < 3; index += 1) {
    if (parsedLeft[index] > parsedRight[index]) return 1;
    if (parsedLeft[index] < parsedRight[index]) return -1;
  }
  return 0;
}

function isDesktopReleaseManifestEntry(value: unknown): value is DesktopReleaseManifestEntry {
  return Boolean(value) && typeof value === 'object';
}

function readUpdaterPayload(entry: DesktopReleaseManifestEntry | null): {
  url: string;
  signature: string;
  notes: string | null;
  pubDate: string | null;
} | null {
  if (!entry || !entry.updater || typeof entry.updater !== 'object') return null;
  const updater = entry.updater as {
    url?: unknown;
    signature?: unknown;
    notes?: unknown;
    pub_date?: unknown;
  };
  const url = trimString(updater.url);
  const signature = trimString(updater.signature);
  if (!url || !signature) return null;
  return {
    url,
    signature,
    notes: trimString(updater.notes) || null,
    pubDate: trimString(updater.pub_date) || trimString(entry.published_at) || null,
  };
}

function resolveLatestVersionFromEntry(entry: DesktopReleaseManifestEntry | null): string {
  const entryVersion = trimString(entry?.version);
  return entryVersion;
}

function buildTargetManifestName(channel: string, platform: string, arch: string): string {
  return `latest-${channel}-${platform}-${arch}.json`;
}

function buildIndexManifestName(channel: string): string {
  return `latest-${channel}.json`;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`failed to fetch manifest: ${response.status}`);
  }
  return (await response.json()) as T;
}

function buildManifestUrl(baseUrl: string, fileName: string): string | null {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  if (!normalizedBaseUrl) return null;
  return `${normalizedBaseUrl}/${encodeURIComponent(fileName)}`;
}

async function loadTargetManifest(source: DesktopUpdateManifestSource, platform: string, arch: string): Promise<{
  version: string;
  manifestUrl: string | null;
  artifactUrl: string | null;
  entry: DesktopReleaseManifestEntry | null;
} | null> {
  const fileName = buildTargetManifestName(source.channel, platform, arch);
  const localPath = source.manifestDir ? join(source.manifestDir, fileName) : '';
  if (localPath && (await fileExists(localPath))) {
    const manifest = await readJsonFile<DesktopReleaseTargetManifest>(localPath);
    const entry = isDesktopReleaseManifestEntry(manifest.entry) ? manifest.entry : null;
    const version = trimString(manifest.version) || resolveLatestVersionFromEntry(entry);
    if (!version) return null;
    return {
      version,
      manifestUrl: buildManifestUrl(source.publicBaseUrl, fileName),
      artifactUrl: trimString(entry?.artifact_url) || null,
      entry,
    };
  }

  const remoteUrl = buildManifestUrl(source.publicBaseUrl, fileName);
  if (!remoteUrl) return null;
  const manifest = await fetchJson<DesktopReleaseTargetManifest>(remoteUrl);
  const entry = isDesktopReleaseManifestEntry(manifest.entry) ? manifest.entry : null;
  const version = trimString(manifest.version) || resolveLatestVersionFromEntry(entry);
  if (!version) return null;
  return {
    version,
    manifestUrl: remoteUrl,
    artifactUrl: trimString(entry?.artifact_url) || null,
    entry,
  };
}

async function loadIndexManifest(source: DesktopUpdateManifestSource): Promise<{
  version: string;
  manifestUrl: string | null;
  artifactUrl: string | null;
  entry: DesktopReleaseManifestEntry | null;
} | null> {
  const fileName = buildIndexManifestName(source.channel);
  const localPath = source.manifestDir ? join(source.manifestDir, fileName) : '';
  if (localPath && (await fileExists(localPath))) {
    const manifest = await readJsonFile<DesktopReleaseIndexManifest>(localPath);
    const entries = Array.isArray(manifest.entries) ? manifest.entries : [];
    const firstEntry = entries.find(isDesktopReleaseManifestEntry) || null;
    const version = trimString(manifest.version) || resolveLatestVersionFromEntry(firstEntry);
    if (!version) return null;
    return {
      version,
      manifestUrl: buildManifestUrl(source.publicBaseUrl, fileName),
      artifactUrl: trimString(firstEntry?.artifact_url) || null,
      entry: firstEntry,
    };
  }

  const remoteUrl = buildManifestUrl(source.publicBaseUrl, fileName);
  if (!remoteUrl) return null;
  const manifest = await fetchJson<DesktopReleaseIndexManifest>(remoteUrl);
  const entries = Array.isArray(manifest.entries) ? manifest.entries : [];
  const firstEntry = entries.find(isDesktopReleaseManifestEntry) || null;
  const version = trimString(manifest.version) || resolveLatestVersionFromEntry(firstEntry);
  if (!version) return null;
  return {
    version,
    manifestUrl: remoteUrl,
    artifactUrl: trimString(firstEntry?.artifact_url) || null,
    entry: firstEntry,
  };
}

async function resolveLatestVersion(
  source: DesktopUpdateManifestSource,
  request: DesktopUpdateRequest,
): Promise<{
  version: string;
  manifestUrl: string | null;
  artifactUrl: string | null;
  entry: DesktopReleaseManifestEntry | null;
} | null> {
  const platform = normalizePlatform(request.platform);
  const arch = normalizeArch(request.arch);
  if (platform && arch) {
    const targetManifest = await loadTargetManifest(source, platform, arch);
    if (targetManifest) return targetManifest;
  }
  return loadIndexManifest(source);
}

export async function resolveDesktopUpdateHint(
  source: DesktopUpdateManifestSource,
  request: DesktopUpdateRequest,
): Promise<DesktopUpdateHint | null> {
  const appVersion = trimString(request.appVersion);
  if (!appVersion) return null;

  const channel = normalizeChannel(request.channel || source.channel);
  const cacheKey = JSON.stringify({
    appVersion,
    platform: normalizePlatform(request.platform),
    arch: normalizeArch(request.arch),
    channel,
    manifestDir: source.manifestDir,
    publicBaseUrl: source.publicBaseUrl,
    mandatory: source.mandatory,
    forceUpdateBelowVersion: trimString(source.forceUpdateBelowVersion),
  });
  const cached = MANIFEST_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const latest = await resolveLatestVersion(
    {
      ...source,
      channel,
    },
    request,
  );
  const hint = latest
    ? {
        latestVersion: latest.version,
        updateAvailable: compareVersions(latest.version, appVersion) > 0,
        mandatory:
          compareVersions(latest.version, appVersion) > 0 && (source.mandatory || isForcedUpdate(source, appVersion)),
        manifestUrl: latest.manifestUrl,
        artifactUrl: latest.artifactUrl,
      }
    : null;

  MANIFEST_CACHE.set(cacheKey, {
    expiresAt: Date.now() + Math.max(1_000, source.cacheTtlMs),
    value: hint,
  });
  return hint;
}

function isForcedUpdate(source: DesktopUpdateManifestSource, appVersion: string): boolean {
  const forceUpdateBelowVersion = trimString(source.forceUpdateBelowVersion);
  if (!forceUpdateBelowVersion) return false;
  return compareVersions(appVersion, forceUpdateBelowVersion) < 0;
}

async function resolveLatestEntry(
  source: DesktopUpdateManifestSource,
  request: DesktopUpdateRequest,
): Promise<{
  version: string;
  manifestUrl: string | null;
  artifactUrl: string | null;
  entry: DesktopReleaseManifestEntry | null;
} | null> {
  const channel = normalizeChannel(request.channel || source.channel);
  return resolveLatestVersion(
    {
      ...source,
      channel,
    },
    request,
  );
}

export async function resolveDesktopUpdaterPayload(
  source: DesktopUpdateManifestSource,
  request: DesktopUpdateRequest,
): Promise<DesktopUpdaterPayload | null> {
  const appVersion = trimString(request.appVersion);
  if (!appVersion) return null;

  const latest = await resolveLatestEntry(source, request);
  if (!latest) return null;
  if (compareVersions(latest.version, appVersion) <= 0) return null;

  const updater = readUpdaterPayload(latest.entry);
  if (!updater) return null;

  return {
    version: latest.version,
    url: updater.url,
    signature: updater.signature,
    notes: updater.notes,
    pubDate: updater.pubDate,
    mandatory: source.mandatory || isForcedUpdate(source, appVersion),
    externalDownloadUrl: latest.artifactUrl,
  };
}
