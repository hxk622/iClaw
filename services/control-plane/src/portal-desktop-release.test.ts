import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPortalDesktopReleaseManifestPayload,
  compareDesktopReleaseVersions,
  resolvePortalDesktopReleaseHint,
  resolvePortalDesktopUpdaterPayload,
  writePortalDesktopReleaseConfig,
  type PortalDesktopReleaseConfig,
  type PortalDesktopReleaseTarget,
} from './portal-desktop-release.ts';

function buildPublishedConfig(input: {
  version: string;
  notes?: string;
  mandatory?: boolean;
  forceUpdateBelowVersion?: string | null;
  allowCurrentRunToFinish?: boolean;
  includeUpdater?: boolean;
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
          notes: input.notes || 'Desktop release notes',
          targets: [target],
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
  assert.equal(hint.updateAvailable, true);
  assert.equal(hint.mandatory, false);
  assert.equal(hint.enforcementState, 'recommended');
  assert.equal(hint.blockNewRuns, false);
  assert.match(hint.manifestUrl || '', /desktop\/release-manifest/);
  assert.match(hint.artifactUrl || '', /artifact_type=installer/);
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
  assert.equal(payload.signature, 'signed-updater-payload');
  assert.match(payload.url, /artifact_type=updater/);
  assert.match(payload.externalDownloadUrl || '', /artifact_type=installer/);
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
