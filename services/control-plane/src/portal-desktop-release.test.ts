import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPortalDesktopReleaseManifestPayload,
  compareDesktopReleaseVersions,
  readPortalDesktopReleaseConfig,
  resolvePortalDesktopReleaseDownloadFile,
  resolvePortalDesktopReleaseHint,
  resolvePortalDesktopUpdaterPayload,
  writePortalDesktopReleaseConfig,
  type PortalDesktopReleaseConfig,
  type PortalDesktopReleaseTarget,
} from './portal-desktop-release.ts';

function buildPublishedConfig(input: {
  version: string;
  rolloutId?: string;
  notes?: string;
  mandatory?: boolean;
  forceUpdateBelowVersion?: string | null;
  allowCurrentRunToFinish?: boolean;
  includeUpdater?: boolean;
  extraTargets?: PortalDesktopReleaseTarget[];
}): Record<string, unknown> {
  const target: PortalDesktopReleaseTarget = {
    platform: 'darwin',
    arch: 'aarch64',
    installer: {
      storageProvider: 's3',
      objectKey: 'desktop/mac/aarch64/iClaw.dmg',
      contentType: 'application/x-apple-diskimage',
      fileName: 'iClaw.dmg',
      sha256: 'installer-sha',
      sizeBytes: 1024,
      uploadedAt: '2026-04-04T00:00:00.000Z',
    },
    updater: input.includeUpdater === false
      ? null
      : {
          storageProvider: 's3',
          objectKey: 'desktop/mac/aarch64/iClaw.app.tar.gz',
          contentType: 'application/gzip',
          fileName: 'iClaw.app.tar.gz',
          sha256: 'updater-sha',
          sizeBytes: 512,
          uploadedAt: '2026-04-04T00:00:00.000Z',
        },
    signature: input.includeUpdater === false
      ? null
      : {
          storageProvider: 's3',
          objectKey: 'desktop/mac/aarch64/iClaw.app.tar.gz.sig',
          contentType: 'text/plain',
          fileName: 'iClaw.app.tar.gz.sig',
          sha256: 'sig-sha',
          sizeBytes: 128,
          uploadedAt: '2026-04-04T00:00:00.000Z',
          signature: 'signed-updater-payload',
        },
    release: {
      version: input.version,
      rolloutId: input.rolloutId || 'rollout-prod-20260404',
      notes: input.notes || 'Desktop release notes',
      publishedAt: '2026-04-04T00:00:00.000Z',
      policy: {
        mandatory: Boolean(input.mandatory),
        forceUpdateBelowVersion: input.forceUpdateBelowVersion || null,
        allowCurrentRunToFinish: input.allowCurrentRunToFinish ?? true,
        reasonCode: 'desktop_update',
        reasonMessage: 'Please update the desktop app.',
      },
    },
  };

  const next: PortalDesktopReleaseConfig = {
    channels: {
      dev: {
        draft: {
          version: null,
          rolloutId: null,
          notes: null,
          targets: [],
          policy: {
            mandatory: false,
            forceUpdateBelowVersion: null,
            allowCurrentRunToFinish: true,
            reasonCode: null,
            reasonMessage: null,
          },
          publishedAt: null,
        },
        published: {
          version: null,
          rolloutId: null,
          notes: null,
          targets: [],
          policy: {
            mandatory: false,
            forceUpdateBelowVersion: null,
            allowCurrentRunToFinish: true,
            reasonCode: null,
            reasonMessage: null,
          },
          publishedAt: null,
        },
      },
      prod: {
        draft: {
          version: null,
          rolloutId: null,
          notes: null,
          targets: [],
          policy: {
            mandatory: false,
            forceUpdateBelowVersion: null,
            allowCurrentRunToFinish: true,
            reasonCode: null,
            reasonMessage: null,
          },
          publishedAt: null,
        },
        published: {
          version: input.version,
          rolloutId: input.rolloutId || 'rollout-prod-20260404',
          notes: input.notes || 'Desktop release notes',
          targets: [target, ...(input.extraTargets || [])],
          policy: {
            mandatory: Boolean(input.mandatory),
            forceUpdateBelowVersion: input.forceUpdateBelowVersion || null,
            allowCurrentRunToFinish: input.allowCurrentRunToFinish ?? true,
            reasonCode: 'desktop_update',
            reasonMessage: 'Please update the desktop app.',
          },
          publishedAt: '2026-04-04T00:00:00.000Z',
        },
      },
    },
  };

  return writePortalDesktopReleaseConfig({}, next);
}

test('compareDesktopReleaseVersions ignores build metadata and compares semantic triplets', () => {
  assert.equal(compareDesktopReleaseVersions('1.0.1+202604021919', '1.0.0+202603091514'), 1);
  assert.equal(compareDesktopReleaseVersions('1.0.0+1', '1.0.0+2'), 0);
  assert.equal(compareDesktopReleaseVersions('1.2.0', '1.3.0'), -1);
});

test('resolvePortalDesktopReleaseHint reports available recommended update when latest version is newer', () => {
  const config = buildPublishedConfig({
    version: '1.0.2+202604041200',
  });

  const hint = resolvePortalDesktopReleaseHint({
    baseUrl: 'https://updates.example.com',
    appName: 'iclaw',
    config,
    appVersion: '1.0.1+202604021919',
    channel: 'prod',
    platform: 'darwin',
    arch: 'aarch64',
  });

  assert.ok(hint);
  assert.equal(hint.latestVersion, '1.0.2+202604041200');
  assert.equal(hint.rolloutId, 'rollout-prod-20260404');
  assert.equal(hint.updateAvailable, true);
  assert.equal(hint.mandatory, false);
  assert.equal(hint.enforcementState, 'recommended');
  assert.equal(hint.blockNewRuns, false);
  assert.match(hint.manifestUrl || '', /desktop\/release-manifest/);
  assert.match(hint.artifactUrl || '', /artifact_type=installer/);
  assert.equal(hint.artifactSha256, 'installer-sha');
});

test('resolvePortalDesktopUpdaterPayload returns signed updater payload when updater artifacts exist', () => {
  const config = buildPublishedConfig({
    version: '1.0.2+202604041200',
    notes: 'Signed update available.',
  });

  const payload = resolvePortalDesktopUpdaterPayload({
    baseUrl: 'https://updates.example.com',
    appName: 'iclaw',
    config,
    appVersion: '1.0.1+202604021919',
    channel: 'prod',
    platform: 'darwin',
    arch: 'aarch64',
  });

  assert.ok(payload);
  assert.equal(payload.version, '1.0.2+202604041200');
  assert.equal(payload.rolloutId, 'rollout-prod-20260404');
  assert.equal(payload.signature, 'signed-updater-payload');
  assert.match(payload.url, /artifact_type=updater/);
  assert.match(payload.externalDownloadUrl || '', /artifact_type=installer/);
  assert.equal(payload.externalDownloadSha256, 'installer-sha');
  assert.equal(payload.mandatory, false);
  assert.equal(payload.enforcementState, 'recommended');
});

test('resolvePortalDesktopUpdaterPayload returns required_now force update when policy forbids finishing current run', () => {
  const config = buildPublishedConfig({
    version: '1.0.2+202604041200',
    mandatory: true,
    allowCurrentRunToFinish: false,
  });

  const payload = resolvePortalDesktopUpdaterPayload({
    baseUrl: 'https://updates.example.com',
    appName: 'iclaw',
    config,
    appVersion: '1.0.1+202604021919',
    channel: 'prod',
    platform: 'darwin',
    arch: 'aarch64',
  });

  assert.ok(payload);
  assert.equal(payload.mandatory, true);
  assert.equal(payload.enforcementState, 'required_now');
  assert.equal(payload.blockNewRuns, true);
});

test('resolvePortalDesktopReleaseHint and updater payload share the same policy fields for windows targets', () => {
  const config = buildPublishedConfig({
    version: '1.0.2+202604041200',
    extraTargets: [
      {
        platform: 'windows',
        arch: 'x64',
        installer: {
          storageProvider: 's3',
          objectKey: 'desktop/windows/x64/iClaw.exe',
          contentType: 'application/vnd.microsoft.portable-executable',
          fileName: 'iClaw.exe',
          sha256: 'windows-installer-sha',
          sizeBytes: 2048,
          uploadedAt: '2026-04-04T00:00:00.000Z',
        },
        updater: {
          storageProvider: 's3',
          objectKey: 'desktop/windows/x64/iClaw.nsis.zip',
          contentType: 'application/zip',
          fileName: 'iClaw.nsis.zip',
          sha256: 'windows-updater-sha',
          sizeBytes: 1024,
          uploadedAt: '2026-04-04T00:00:00.000Z',
        },
        signature: {
          storageProvider: 's3',
          objectKey: 'desktop/windows/x64/iClaw.nsis.zip.sig',
          contentType: 'text/plain',
          fileName: 'iClaw.nsis.zip.sig',
          sha256: 'windows-sig-sha',
          sizeBytes: 128,
          uploadedAt: '2026-04-04T00:00:00.000Z',
          signature: 'signed-windows-updater-payload',
        },
        release: {
          version: '1.0.2+202604041200',
          rolloutId: 'rollout-win-20260404',
          notes: 'Windows release notes',
          publishedAt: '2026-04-04T00:00:00.000Z',
          policy: {
            mandatory: true,
            forceUpdateBelowVersion: null,
            allowCurrentRunToFinish: false,
            reasonCode: 'desktop_update',
            reasonMessage: 'Windows must update now.',
          },
        },
      },
    ],
  });

  const hint = resolvePortalDesktopReleaseHint({
    baseUrl: 'https://updates.example.com',
    appName: 'iclaw',
    config,
    appVersion: '1.0.1+202604021919',
    channel: 'prod',
    platform: 'windows',
    arch: 'x64',
  });

  const payload = resolvePortalDesktopUpdaterPayload({
    baseUrl: 'https://updates.example.com',
    appName: 'iclaw',
    config,
    appVersion: '1.0.1+202604021919',
    channel: 'prod',
    platform: 'windows',
    arch: 'x64',
  });

  assert.ok(hint);
  assert.ok(payload);
  assert.equal(hint.mandatory, payload.mandatory);
  assert.equal(hint.enforcementState, payload.enforcementState);
  assert.equal(hint.blockNewRuns, payload.blockNewRuns);
  assert.equal(hint.reasonCode, payload.reasonCode);
  assert.equal(hint.reasonMessage, payload.reasonMessage);
  assert.equal(payload.enforcementState, 'required_now');
  assert.equal(payload.reasonMessage, 'Windows must update now.');
  assert.equal(hint.rolloutId, 'rollout-win-20260404');
  assert.equal(payload.rolloutId, 'rollout-win-20260404');
});

test('resolvePortalDesktopReleaseHint upgrades to mandatory when forceUpdateBelowVersion is hit', () => {
  const config = buildPublishedConfig({
    version: '1.0.2+202604041200',
    forceUpdateBelowVersion: '1.0.1',
    allowCurrentRunToFinish: true,
  });

  const hint = resolvePortalDesktopReleaseHint({
    baseUrl: 'https://updates.example.com',
    appName: 'iclaw',
    config,
    appVersion: '1.0.0+202604010001',
    channel: 'prod',
    platform: 'darwin',
    arch: 'aarch64',
  });

  assert.ok(hint);
  assert.equal(hint.mandatory, true);
  assert.equal(hint.enforcementState, 'required_after_run');
  assert.equal(hint.blockNewRuns, true);
});

test('resolvePortalDesktopUpdaterPayload returns null when updater artifacts are missing even if installer exists', () => {
  const config = buildPublishedConfig({
    version: '1.0.2+202604041200',
    includeUpdater: false,
  });

  const payload = resolvePortalDesktopUpdaterPayload({
    baseUrl: 'https://updates.example.com',
    appName: 'iclaw',
    config,
    appVersion: '1.0.1+202604021919',
    channel: 'prod',
    platform: 'darwin',
    arch: 'aarch64',
  });

  assert.equal(payload, null);
});

test('buildPortalDesktopReleaseManifestPayload includes updater metadata only when updater and signature both exist', () => {
  const configWithUpdater = buildPublishedConfig({
    version: '1.0.2+202604041200',
  });
  const configWithoutUpdater = buildPublishedConfig({
    version: '1.0.2+202604041200',
    includeUpdater: false,
  });

  const withUpdater = buildPortalDesktopReleaseManifestPayload({
    baseUrl: 'https://updates.example.com',
    appName: 'iclaw',
    channel: 'prod',
    snapshot: (configWithUpdater as { desktop_release_admin: { channels: { prod: { published: PortalDesktopReleaseConfig['channels']['prod']['published'] } } } }).desktop_release_admin.channels.prod.published,
    platform: 'darwin',
    arch: 'aarch64',
  }) as { entry?: { updater?: unknown } };

  const withoutUpdater = buildPortalDesktopReleaseManifestPayload({
    baseUrl: 'https://updates.example.com',
    appName: 'iclaw',
    channel: 'prod',
    snapshot: (configWithoutUpdater as { desktop_release_admin: { channels: { prod: { published: PortalDesktopReleaseConfig['channels']['prod']['published'] } } } }).desktop_release_admin.channels.prod.published,
    platform: 'darwin',
    arch: 'aarch64',
  }) as { entry?: { updater?: unknown } };

  assert.ok(withUpdater.entry?.updater);
  assert.equal(withoutUpdater.entry?.updater ?? null, null);
});

test('readPortalDesktopReleaseConfig hydrates snapshot-level release fields onto targets that do not define release', () => {
  const config = writePortalDesktopReleaseConfig({}, {
    channels: {
      dev: {
        draft: {
          version: null,
          rolloutId: null,
          notes: null,
          targets: [],
          policy: {
            mandatory: false,
            forceUpdateBelowVersion: null,
            allowCurrentRunToFinish: true,
            reasonCode: null,
            reasonMessage: null,
          },
          publishedAt: null,
        },
        published: {
          version: null,
          rolloutId: null,
          notes: null,
          targets: [],
          policy: {
            mandatory: false,
            forceUpdateBelowVersion: null,
            allowCurrentRunToFinish: true,
            reasonCode: null,
            reasonMessage: null,
          },
          publishedAt: null,
        },
      },
      prod: {
        draft: {
          version: '1.2.3',
          rolloutId: 'rollout-prod-1.2.3',
          notes: 'Unified desktop release',
          targets: [
            {
              platform: 'windows',
              arch: 'x64',
              installer: {
                storageProvider: 's3',
                objectKey: 'desktop/windows/x64/iClaw.exe',
                contentType: 'application/vnd.microsoft.portable-executable',
                fileName: 'iClaw.exe',
                sha256: 'windows-installer-sha',
                sizeBytes: 2048,
                uploadedAt: '2026-04-04T00:00:00.000Z',
              },
              updater: {
                storageProvider: 's3',
                objectKey: 'desktop/windows/x64/iClaw.nsis.zip',
                contentType: 'application/zip',
                fileName: 'iClaw.nsis.zip',
                sha256: 'windows-updater-sha',
                sizeBytes: 1024,
                uploadedAt: '2026-04-04T00:00:00.000Z',
              },
              signature: {
                storageProvider: 's3',
                objectKey: 'desktop/windows/x64/iClaw.nsis.zip.sig',
                contentType: 'text/plain',
                fileName: 'iClaw.nsis.zip.sig',
                sha256: 'windows-sig-sha',
                sizeBytes: 128,
                uploadedAt: '2026-04-04T00:00:00.000Z',
                signature: 'signed-windows-updater-payload',
              },
            } as unknown as PortalDesktopReleaseTarget,
          ],
          policy: {
            mandatory: true,
            forceUpdateBelowVersion: '1.2.0',
            allowCurrentRunToFinish: false,
            reasonCode: 'desktop_update',
            reasonMessage: 'Please update the desktop app.',
          },
          publishedAt: '2026-04-04T00:00:00.000Z',
        },
        published: {
          version: null,
          rolloutId: null,
          notes: null,
          targets: [],
          policy: {
            mandatory: false,
            forceUpdateBelowVersion: null,
            allowCurrentRunToFinish: true,
            reasonCode: null,
            reasonMessage: null,
          },
          publishedAt: null,
        },
      },
    },
  });

  const parsed = readPortalDesktopReleaseConfig(config);
  const target = parsed.channels.prod.draft.targets[0];

  assert.ok(target);
  assert.equal(target.release.version, '1.2.3');
  assert.equal(target.release.notes, 'Unified desktop release');
  assert.equal(target.release.publishedAt, '2026-04-04T00:00:00.000Z');
  assert.equal(target.release.policy.mandatory, true);
  assert.equal(target.release.policy.forceUpdateBelowVersion, '1.2.0');
  assert.equal(target.release.policy.allowCurrentRunToFinish, false);
});

test('buildPortalDesktopReleaseManifestPayload prefers target-scoped release metadata over snapshot defaults', () => {
  const config = buildPublishedConfig({
    version: '1.0.2+202604041200',
    notes: 'Snapshot release notes',
    extraTargets: [
      {
        platform: 'windows',
        arch: 'x64',
        installer: {
          storageProvider: 's3',
          objectKey: 'desktop/windows/x64/iClaw.exe',
          contentType: 'application/vnd.microsoft.portable-executable',
          fileName: 'iClaw.exe',
          sha256: 'windows-installer-sha',
          sizeBytes: 2048,
          uploadedAt: '2026-04-04T00:00:00.000Z',
        },
        updater: {
          storageProvider: 's3',
          objectKey: 'desktop/windows/x64/iClaw.nsis.zip',
          contentType: 'application/zip',
          fileName: 'iClaw.nsis.zip',
          sha256: 'windows-updater-sha',
          sizeBytes: 1024,
          uploadedAt: '2026-04-04T00:00:00.000Z',
        },
        signature: {
          storageProvider: 's3',
          objectKey: 'desktop/windows/x64/iClaw.nsis.zip.sig',
          contentType: 'text/plain',
          fileName: 'iClaw.nsis.zip.sig',
          sha256: 'windows-sig-sha',
          sizeBytes: 128,
          uploadedAt: '2026-04-04T00:00:00.000Z',
          signature: 'signed-windows-updater-payload',
        },
        release: {
          version: '1.0.3+202604050101',
          rolloutId: 'rollout-win-20260405',
          notes: 'Windows target release notes',
          publishedAt: '2026-04-05T00:00:00.000Z',
          policy: {
            mandatory: true,
            forceUpdateBelowVersion: null,
            allowCurrentRunToFinish: false,
            reasonCode: 'desktop_update',
            reasonMessage: 'Please update the desktop app.',
          },
        },
      },
    ],
  });

  const payload = buildPortalDesktopReleaseManifestPayload({
    baseUrl: 'https://updates.example.com',
    appName: 'iclaw',
    channel: 'prod',
    snapshot: (config as { desktop_release_admin: { channels: { prod: { published: PortalDesktopReleaseConfig['channels']['prod']['published'] } } } }).desktop_release_admin.channels.prod.published,
    platform: 'windows',
    arch: 'x64',
  }) as {entry?: {version?: string; published_at?: string; updater?: {notes?: string | null; pub_date?: string | null} | null}};

  assert.equal(payload.entry?.version, '1.0.3+202604050101');
  assert.equal(payload.entry?.published_at, '2026-04-05T00:00:00.000Z');
  assert.equal(payload.entry?.updater?.notes, 'Windows target release notes');
  assert.equal(payload.entry?.updater?.pub_date, '2026-04-05T00:00:00.000Z');
});

test('buildPortalDesktopReleaseManifestPayload does not fall back to a different platform when target/arch is specified', () => {
  const config = buildPublishedConfig({
    version: '1.0.2+202604041200',
  });

  const payload = buildPortalDesktopReleaseManifestPayload({
    baseUrl: 'https://updates.example.com',
    appName: 'iclaw',
    channel: 'prod',
    snapshot: (config as { desktop_release_admin: { channels: { prod: { published: PortalDesktopReleaseConfig['channels']['prod']['published'] } } } }).desktop_release_admin.channels.prod.published,
    platform: 'windows',
    arch: 'x64',
  });

  assert.equal(payload, null);
});

test('buildPortalDesktopReleaseManifestPayload returns the exact windows target when published', () => {
  const config = buildPublishedConfig({
    version: '1.0.2+202604041200',
    extraTargets: [
      {
        platform: 'windows',
        arch: 'x64',
        installer: {
          storageProvider: 's3',
          objectKey: 'desktop/windows/x64/iClaw.exe',
          contentType: 'application/vnd.microsoft.portable-executable',
          fileName: 'iClaw.exe',
          sha256: 'windows-installer-sha',
          sizeBytes: 2048,
          uploadedAt: '2026-04-04T00:00:00.000Z',
        },
        updater: {
          storageProvider: 's3',
          objectKey: 'desktop/windows/x64/iClaw.nsis.zip',
          contentType: 'application/zip',
          fileName: 'iClaw.nsis.zip',
          sha256: 'windows-updater-sha',
          sizeBytes: 1024,
          uploadedAt: '2026-04-04T00:00:00.000Z',
        },
        signature: {
          storageProvider: 's3',
          objectKey: 'desktop/windows/x64/iClaw.nsis.zip.sig',
          contentType: 'text/plain',
          fileName: 'iClaw.nsis.zip.sig',
          sha256: 'windows-sig-sha',
          sizeBytes: 128,
          uploadedAt: '2026-04-04T00:00:00.000Z',
          signature: 'signed-windows-updater-payload',
        },
        release: {
          version: '1.0.2+202604041200',
          rolloutId: 'rollout-win-20260404',
          notes: 'Windows release notes',
          publishedAt: '2026-04-04T00:00:00.000Z',
          policy: {
            mandatory: true,
            forceUpdateBelowVersion: null,
            allowCurrentRunToFinish: false,
            reasonCode: 'desktop_update',
            reasonMessage: 'Please update the desktop app.',
          },
        },
      },
    ],
  });

  const payload = buildPortalDesktopReleaseManifestPayload({
    baseUrl: 'https://updates.example.com',
    appName: 'iclaw',
    channel: 'prod',
    snapshot: (config as { desktop_release_admin: { channels: { prod: { published: PortalDesktopReleaseConfig['channels']['prod']['published'] } } } }).desktop_release_admin.channels.prod.published,
    platform: 'windows',
    arch: 'x64',
  }) as {entry?: {platform?: string; arch?: string; artifact_name?: string}};

  assert.equal(payload.entry?.platform, 'windows');
  assert.equal(payload.entry?.arch, 'x64');
  assert.equal(payload.entry?.artifact_name, 'iClaw.exe');
});

test('resolvePortalDesktopReleaseDownloadFile does not fall back to another platform when exact target is missing', () => {
  const config = buildPublishedConfig({
    version: '1.0.2+202604041200',
  });

  const installer = resolvePortalDesktopReleaseDownloadFile({
    appName: 'iclaw',
    config,
    channel: 'prod',
    platform: 'windows',
    arch: 'x64',
    artifactType: 'installer',
  });

  assert.equal(installer, null);
});
