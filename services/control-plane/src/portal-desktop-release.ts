import type {PortalJsonObject} from './portal-domain.ts';

export const PORTAL_DESKTOP_RELEASE_CONFIG_KEY = 'desktop_release_admin';

export type DesktopReleaseChannel = 'dev' | 'prod';
export type DesktopReleasePlatform = 'darwin' | 'windows';
export type DesktopReleaseArch = 'aarch64' | 'x64';
export type DesktopReleaseArtifactType = 'installer' | 'updater' | 'signature';
export type DesktopUpdateEnforcementState = 'recommended' | 'required_after_run' | 'required_now';

export type PortalDesktopReleaseFile = {
  storageProvider: string;
  objectKey: string;
  contentType: string;
  fileName: string;
  sha256: string;
  sizeBytes: number;
  uploadedAt: string | null;
};

export type PortalDesktopReleaseSignature = PortalDesktopReleaseFile & {
  signature: string;
};

export type PortalDesktopReleaseTarget = {
  platform: DesktopReleasePlatform;
  arch: DesktopReleaseArch;
  installer: PortalDesktopReleaseFile | null;
  updater: PortalDesktopReleaseFile | null;
  signature: PortalDesktopReleaseSignature | null;
  release: PortalDesktopReleaseTargetRelease;
};

export type PortalDesktopReleaseTargetRelease = {
  version: string | null;
  notes: string | null;
  policy: PortalDesktopReleasePolicy;
  publishedAt: string | null;
};

export type PortalDesktopReleasePolicy = {
  mandatory: boolean;
  forceUpdateBelowVersion: string | null;
  allowCurrentRunToFinish: boolean;
  reasonCode: string | null;
  reasonMessage: string | null;
};

export type PortalDesktopReleaseSnapshot = {
  version: string | null;
  notes: string | null;
  targets: PortalDesktopReleaseTarget[];
  policy: PortalDesktopReleasePolicy;
  publishedAt: string | null;
};

export type PortalDesktopReleaseChannelState = {
  draft: PortalDesktopReleaseSnapshot;
  published: PortalDesktopReleaseSnapshot;
};

export type PortalDesktopReleaseConfig = {
  channels: Record<DesktopReleaseChannel, PortalDesktopReleaseChannelState>;
};

export type PortalDesktopReleaseHint = {
  latestVersion: string;
  updateAvailable: boolean;
  mandatory: boolean;
  enforcementState: DesktopUpdateEnforcementState;
  blockNewRuns: boolean;
  reasonCode: string | null;
  reasonMessage: string | null;
  manifestUrl: string | null;
  artifactUrl: string | null;
};

export type PortalDesktopUpdaterPayload = {
  version: string;
  url: string;
  signature: string;
  notes: string | null;
  pubDate: string | null;
  mandatory: boolean;
  enforcementState: DesktopUpdateEnforcementState;
  blockNewRuns: boolean;
  reasonCode: string | null;
  reasonMessage: string | null;
  externalDownloadUrl: string | null;
};

type PortalDesktopManifestEntry = {
  platform: DesktopReleasePlatform;
  arch: DesktopReleaseArch;
  version: string;
  artifact_name: string;
  artifact_url: string;
  artifact_size: number;
  artifact_sha256: string;
  published_at: string;
  updater:
    | {
        url: string;
        signature: string;
        pub_date: string | null;
        notes: string | null;
      }
    | null;
};

function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asObject(value: unknown): PortalJsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as PortalJsonObject) : {};
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function normalizeDesktopReleaseChannel(value?: string | null): DesktopReleaseChannel {
  return trimString(value).toLowerCase() === 'dev' ? 'dev' : 'prod';
}

export function normalizeDesktopReleasePlatform(value?: string | null): DesktopReleasePlatform | '' {
  const normalized = trimString(value).toLowerCase();
  if (!normalized) return '';
  if (normalized.startsWith('darwin') || normalized.startsWith('mac')) return 'darwin';
  if (normalized.startsWith('windows') || normalized.startsWith('win')) return 'windows';
  return normalized === 'darwin' || normalized === 'windows' ? normalized : '';
}

export function normalizeDesktopReleaseArch(value?: string | null): DesktopReleaseArch | '' {
  const normalized = trimString(value).toLowerCase();
  if (!normalized) return '';
  if (normalized.includes('aarch64') || normalized.includes('arm64')) return 'aarch64';
  if (normalized.includes('x86_64') || normalized.includes('amd64') || normalized.includes('x64')) return 'x64';
  return normalized === 'aarch64' || normalized === 'x64' ? normalized : '';
}

function normalizeDesktopReleaseFile(value: unknown): PortalDesktopReleaseFile | null {
  const file = asObject(value);
  const objectKey = trimString(file.objectKey || file.object_key);
  if (!objectKey) return null;
  return {
    storageProvider: trimString(file.storageProvider || file.storage_provider) || 's3',
    objectKey,
    contentType: trimString(file.contentType || file.content_type) || 'application/octet-stream',
    fileName: trimString(file.fileName || file.file_name) || objectKey.split('/').at(-1) || 'artifact.bin',
    sha256: trimString(file.sha256),
    sizeBytes: Number(file.sizeBytes || file.size_bytes || 0) || 0,
    uploadedAt: trimString(file.uploadedAt || file.uploaded_at) || null,
  } as PortalDesktopReleaseFile;
}

function normalizeDesktopReleaseSignature(value: unknown): PortalDesktopReleaseSignature | null {
  const base = normalizeDesktopReleaseFile(value);
  if (!base) return null;
  const signature = trimString(asObject(value).signature);
  return signature ? { ...base, signature } : null;
}

function emptyTargetRelease(): PortalDesktopReleaseTargetRelease {
  return {
    version: null,
    notes: null,
    policy: emptyPolicy(),
    publishedAt: null,
  };
}

function normalizeTargetRelease(value: unknown): PortalDesktopReleaseTargetRelease {
  const release = asObject(value);
  return {
    version: trimString(release.version) || null,
    notes: trimString(release.notes) || null,
    policy: normalizePolicy(release.policy),
    publishedAt: trimString(release.publishedAt || release.published_at) || null,
  };
}

function emptyPolicy(): PortalDesktopReleasePolicy {
  return {
    mandatory: false,
    forceUpdateBelowVersion: null,
    allowCurrentRunToFinish: true,
    reasonCode: null,
    reasonMessage: null,
  };
}

function normalizePolicy(value: unknown): PortalDesktopReleasePolicy {
  const policy = asObject(value);
  return {
    mandatory: Boolean(policy.mandatory),
    forceUpdateBelowVersion: trimString(policy.forceUpdateBelowVersion || policy.force_update_below_version) || null,
    allowCurrentRunToFinish:
      policy.allowCurrentRunToFinish === undefined && policy.allow_current_run_to_finish === undefined
        ? true
        : Boolean(policy.allowCurrentRunToFinish ?? policy.allow_current_run_to_finish),
    reasonCode: trimString(policy.reasonCode || policy.reason_code) || null,
    reasonMessage: trimString(policy.reasonMessage || policy.reason_message) || null,
  };
}

function emptyTarget(platform: DesktopReleasePlatform, arch: DesktopReleaseArch): PortalDesktopReleaseTarget {
  return {
    platform,
    arch,
    installer: null,
    updater: null,
    signature: null,
    release: emptyTargetRelease(),
  };
}

function normalizeTarget(value: unknown): PortalDesktopReleaseTarget | null {
  const target = asObject(value);
  const platform = normalizeDesktopReleasePlatform(String(target.platform || ''));
  const arch = normalizeDesktopReleaseArch(String(target.arch || ''));
  if (!platform || !arch) return null;
  return {
    platform,
    arch,
    installer: normalizeDesktopReleaseFile(target.installer),
    updater: normalizeDesktopReleaseFile(target.updater),
    signature: normalizeDesktopReleaseSignature(target.signature),
    release: normalizeTargetRelease(target.release),
  };
}

function emptySnapshot(): PortalDesktopReleaseSnapshot {
  return {
    version: null,
    notes: null,
    targets: [],
    policy: emptyPolicy(),
    publishedAt: null,
  };
}

function normalizeSnapshot(value: unknown): PortalDesktopReleaseSnapshot {
  const snapshot = asObject(value);
  return {
    version: trimString(snapshot.version) || null,
    notes: trimString(snapshot.notes) || null,
    targets: asArray(snapshot.targets).map(normalizeTarget).filter(Boolean) as PortalDesktopReleaseTarget[],
    policy: normalizePolicy(snapshot.policy),
    publishedAt: trimString(snapshot.publishedAt || snapshot.published_at) || null,
  };
}

function emptyChannelState(): PortalDesktopReleaseChannelState {
  return {
    draft: emptySnapshot(),
    published: emptySnapshot(),
  };
}

export function readPortalDesktopReleaseConfig(config: PortalJsonObject): PortalDesktopReleaseConfig {
  const raw = asObject(config[PORTAL_DESKTOP_RELEASE_CONFIG_KEY]);
  const channels = asObject(raw.channels);
  return {
    channels: {
      dev: {
        draft: normalizeSnapshot(asObject(asObject(channels.dev).draft)),
        published: normalizeSnapshot(asObject(asObject(channels.dev).published)),
      },
      prod: {
        draft: normalizeSnapshot(asObject(asObject(channels.prod).draft)),
        published: normalizeSnapshot(asObject(asObject(channels.prod).published)),
      },
    },
  };
}

export function writePortalDesktopReleaseConfig(
  config: PortalJsonObject,
  next: PortalDesktopReleaseConfig,
): PortalJsonObject {
  return {
    ...config,
    [PORTAL_DESKTOP_RELEASE_CONFIG_KEY]: {
      channels: {
        dev: next.channels.dev || emptyChannelState(),
        prod: next.channels.prod || emptyChannelState(),
      },
    },
  };
}

export function stripPortalDesktopReleaseConfig(config: PortalJsonObject): PortalJsonObject {
  const next = { ...config };
  delete next[PORTAL_DESKTOP_RELEASE_CONFIG_KEY];
  return next;
}

export function upsertPortalDesktopReleaseTarget(
  targets: PortalDesktopReleaseTarget[],
  platform: DesktopReleasePlatform,
  arch: DesktopReleaseArch,
): PortalDesktopReleaseTarget {
  const existing = targets.find((entry) => entry.platform === platform && entry.arch === arch);
  if (existing) return existing;
  const next = emptyTarget(platform, arch);
  targets.push(next);
  return next;
}

export function compareDesktopReleaseVersions(left: string, right: string): number {
  const parse = (value: string): [number, number, number] | null => {
    const match = value.trim().match(/^(\d+)\.(\d+)\.(\d+)(?:\+[\w.-]+)?$/);
    if (!match) return null;
    return [
      Number.parseInt(match[1] || '0', 10),
      Number.parseInt(match[2] || '0', 10),
      Number.parseInt(match[3] || '0', 10),
    ];
  };
  const parsedLeft = parse(left);
  const parsedRight = parse(right);
  if (!parsedLeft || !parsedRight) return 0;
  for (let index = 0; index < 3; index += 1) {
    if (parsedLeft[index] > parsedRight[index]) return 1;
    if (parsedLeft[index] < parsedRight[index]) return -1;
  }
  return 0;
}

function isForcedUpdate(policy: PortalDesktopReleasePolicy, appVersion: string): boolean {
  return Boolean(policy.forceUpdateBelowVersion && compareDesktopReleaseVersions(appVersion, policy.forceUpdateBelowVersion) < 0);
}

function resolveEnforcementState(mandatory: boolean, allowCurrentRunToFinish: boolean): DesktopUpdateEnforcementState {
  if (!mandatory) return 'recommended';
  return allowCurrentRunToFinish ? 'required_after_run' : 'required_now';
}

function findTarget(
  targets: PortalDesktopReleaseTarget[],
  platform: DesktopReleasePlatform | '',
  arch: DesktopReleaseArch | '',
): PortalDesktopReleaseTarget | null {
  if (platform && arch) {
    return targets.find((entry) => entry.platform === platform && entry.arch === arch) || null;
  }
  if (platform) {
    return targets.find((entry) => entry.platform === platform) || null;
  }
  if (arch) {
    return targets.find((entry) => entry.arch === arch) || null;
  }
  return targets[0] || null;
}

export function buildPortalDesktopReleaseArtifactUrl(input: {
  baseUrl: string;
  appName: string;
  channel: DesktopReleaseChannel;
  platform: DesktopReleasePlatform;
  arch: DesktopReleaseArch;
  artifactType: 'installer' | 'updater';
}): string {
  const baseUrl = input.baseUrl.replace(/\/+$/, '');
  return `${baseUrl}/desktop/release-file?app_name=${encodeURIComponent(input.appName)}&channel=${encodeURIComponent(input.channel)}&target=${encodeURIComponent(input.platform)}&arch=${encodeURIComponent(input.arch)}&artifact_type=${encodeURIComponent(input.artifactType)}`;
}

export function buildPortalDesktopReleaseManifestUrl(input: {
  baseUrl: string;
  appName: string;
  channel: DesktopReleaseChannel;
  platform?: DesktopReleasePlatform | '';
  arch?: DesktopReleaseArch | '';
}): string {
  const baseUrl = input.baseUrl.replace(/\/+$/, '');
  const params = new URLSearchParams({
    app_name: input.appName,
    channel: input.channel,
  });
  if (input.platform) params.set('target', input.platform);
  if (input.arch) params.set('arch', input.arch);
  return `${baseUrl}/desktop/release-manifest?${params.toString()}`;
}

function buildManifestEntry(baseUrl: string, appName: string, channel: DesktopReleaseChannel, target: PortalDesktopReleaseTarget, version: string, notes: string | null, publishedAt: string | null): PortalDesktopManifestEntry | null {
  if (!target.installer) return null;
  return {
    platform: target.platform,
    arch: target.arch,
    version,
    artifact_name: target.installer.fileName,
    artifact_url: buildPortalDesktopReleaseArtifactUrl({
      baseUrl,
      appName,
      channel,
      platform: target.platform,
      arch: target.arch,
      artifactType: 'installer',
    }),
    artifact_size: target.installer.sizeBytes,
    artifact_sha256: target.installer.sha256,
    published_at: publishedAt || target.installer.uploadedAt || new Date().toISOString(),
    updater:
      target.updater && target.signature
        ? {
            url: buildPortalDesktopReleaseArtifactUrl({
              baseUrl,
              appName,
              channel,
              platform: target.platform,
              arch: target.arch,
              artifactType: 'updater',
            }),
            signature: target.signature.signature,
            pub_date: publishedAt || target.updater.uploadedAt || null,
            notes,
          }
        : null,
  };
}

function resolveTargetRelease(target: PortalDesktopReleaseTarget, snapshot: PortalDesktopReleaseSnapshot): PortalDesktopReleaseTargetRelease {
  const hasTargetScopedRelease =
    Boolean(target.release.version) ||
    Boolean(target.release.notes) ||
    Boolean(target.release.publishedAt) ||
    Boolean(target.release.policy.mandatory) ||
    Boolean(target.release.policy.forceUpdateBelowVersion) ||
    Boolean(target.release.policy.reasonCode) ||
    Boolean(target.release.policy.reasonMessage) ||
    target.release.policy.allowCurrentRunToFinish !== true;
  if (hasTargetScopedRelease) {
    return target.release;
  }
  return {
    version: snapshot.version,
    notes: snapshot.notes,
    policy: snapshot.policy,
    publishedAt: snapshot.publishedAt,
  };
}

export function buildPortalDesktopReleaseManifestPayload(input: {
  baseUrl: string;
  appName: string;
  channel: DesktopReleaseChannel;
  snapshot: PortalDesktopReleaseSnapshot;
  platform?: DesktopReleasePlatform | '';
  arch?: DesktopReleaseArch | '';
}): Record<string, unknown> | null {
  const entries = input.snapshot.targets
    .map((target) => {
      const release = resolveTargetRelease(target, input.snapshot);
      const version = trimString(release.version);
      if (!version) return null;
      return buildManifestEntry(
        input.baseUrl,
        input.appName,
        input.channel,
        target,
        version,
        release.notes,
        release.publishedAt,
      );
    })
    .filter(Boolean) as PortalDesktopManifestEntry[];
  if (entries.length === 0) return null;

  if (input.platform && input.arch) {
    const targetEntry = entries.find((entry) => entry.platform === input.platform && entry.arch === input.arch);
    if (targetEntry) {
      return {
        schema_version: 1,
        app_name: input.appName,
        channel: input.channel,
        version: targetEntry.version,
        generated_at: new Date().toISOString(),
        entry: targetEntry,
      };
    }
    return null;
  }

  const uniqueVersions = Array.from(new Set(entries.map((entry) => entry.version)));
  return {
    schema_version: 1,
    app_name: input.appName,
    channel: input.channel,
    version: uniqueVersions.length === 1 ? uniqueVersions[0] : null,
    generated_at: new Date().toISOString(),
    entries,
  };
}

export function resolvePortalDesktopReleaseHint(input: {
  baseUrl: string;
  appName: string;
  config: PortalJsonObject;
  appVersion: string;
  channel?: string | null;
  platform?: string | null;
  arch?: string | null;
}): PortalDesktopReleaseHint | null {
  const appVersion = trimString(input.appVersion);
  if (!appVersion) return null;
  const channel = normalizeDesktopReleaseChannel(input.channel);
  const platform = normalizeDesktopReleasePlatform(input.platform);
  const arch = normalizeDesktopReleaseArch(input.arch);
  const releaseConfig = readPortalDesktopReleaseConfig(input.config);
  const published = releaseConfig.channels[channel].published;
  const target = findTarget(published.targets, platform, arch);
  if (!target || !target.installer) return null;
  const release = resolveTargetRelease(target, published);
  const latestVersion = trimString(release.version);
  if (!latestVersion) return null;
  const updateAvailable = compareDesktopReleaseVersions(latestVersion, appVersion) > 0;
  const mandatory = updateAvailable && (release.policy.mandatory || isForcedUpdate(release.policy, appVersion));
  return {
    latestVersion,
    updateAvailable,
    mandatory,
    enforcementState: resolveEnforcementState(mandatory, release.policy.allowCurrentRunToFinish),
    blockNewRuns: mandatory,
    reasonCode: release.policy.reasonCode,
    reasonMessage: release.policy.reasonMessage,
    manifestUrl: buildPortalDesktopReleaseManifestUrl({
      baseUrl: input.baseUrl,
      appName: input.appName,
      channel,
      platform,
      arch,
    }),
    artifactUrl: buildPortalDesktopReleaseArtifactUrl({
      baseUrl: input.baseUrl,
      appName: input.appName,
      channel,
      platform: target.platform,
      arch: target.arch,
      artifactType: 'installer',
    }),
  };
}

export function resolvePortalDesktopUpdaterPayload(input: {
  baseUrl: string;
  appName: string;
  config: PortalJsonObject;
  appVersion: string;
  channel?: string | null;
  platform?: string | null;
  arch?: string | null;
}): PortalDesktopUpdaterPayload | null {
  const appVersion = trimString(input.appVersion);
  if (!appVersion) return null;
  const channel = normalizeDesktopReleaseChannel(input.channel);
  const platform = normalizeDesktopReleasePlatform(input.platform);
  const arch = normalizeDesktopReleaseArch(input.arch);
  const releaseConfig = readPortalDesktopReleaseConfig(input.config);
  const published = releaseConfig.channels[channel].published;
  const target = findTarget(published.targets, platform, arch);
  if (!target) return null;
  const release = resolveTargetRelease(target, published);
  const latestVersion = trimString(release.version);
  if (!latestVersion || compareDesktopReleaseVersions(latestVersion, appVersion) <= 0) return null;
  if (!target?.updater || !target.signature?.signature) return null;
  const mandatory = release.policy.mandatory || isForcedUpdate(release.policy, appVersion);
  return {
    version: latestVersion,
    url: buildPortalDesktopReleaseArtifactUrl({
      baseUrl: input.baseUrl,
      appName: input.appName,
      channel,
      platform: target.platform,
      arch: target.arch,
      artifactType: 'updater',
    }),
    signature: target.signature.signature,
    notes: release.notes,
    pubDate: release.publishedAt || target.updater.uploadedAt || null,
    mandatory,
    enforcementState: resolveEnforcementState(mandatory, release.policy.allowCurrentRunToFinish),
    blockNewRuns: mandatory,
    reasonCode: release.policy.reasonCode,
    reasonMessage: release.policy.reasonMessage,
    externalDownloadUrl: buildPortalDesktopReleaseArtifactUrl({
      baseUrl: input.baseUrl,
      appName: input.appName,
      channel,
      platform: target.platform,
      arch: target.arch,
      artifactType: 'installer',
    }),
  };
}

export function resolvePortalDesktopReleaseDownloadFile(input: {
  appName: string;
  config: PortalJsonObject;
  channel?: string | null;
  platform?: string | null;
  arch?: string | null;
  artifactType?: string | null;
}): PortalDesktopReleaseFile | null {
  const channel = normalizeDesktopReleaseChannel(input.channel);
  const platform = normalizeDesktopReleasePlatform(input.platform);
  const arch = normalizeDesktopReleaseArch(input.arch);
  const artifactType = trimString(input.artifactType).toLowerCase();
  const releaseConfig = readPortalDesktopReleaseConfig(input.config);
  const published = releaseConfig.channels[channel].published;
  const target = findTarget(published.targets, platform, arch);
  if (!target) return null;
  if (artifactType === 'updater') {
    return target.updater;
  }
  return target.installer;
}

export function validatePortalDesktopReleaseVersion(value: string): boolean {
  return /^(\d+)\.(\d+)\.(\d+)(?:\+[\w.-]+)?$/.test(value.trim());
}
