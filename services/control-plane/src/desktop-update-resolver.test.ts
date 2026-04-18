import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveDesktopUpdateHintPayload,
  resolveDesktopUpdateResponseHeaders,
  resolveDesktopUpdaterRoutePayload,
} from './desktop-update-resolver.ts';
import { writePortalDesktopReleaseConfig, type PortalDesktopReleaseConfig, type PortalDesktopReleaseTarget } from './portal-desktop-release.ts';

function buildPublishedConfig(input: {
  version: string;
  rolloutId?: string;
  mandatory?: boolean;
  allowCurrentRunToFinish?: boolean;
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
    updater: {
      storageProvider: 's3',
      objectKey: 'desktop/mac/aarch64/iClaw.app.tar.gz',
      contentType: 'application/gzip',
      fileName: 'iClaw.app.tar.gz',
      sha256: 'updater-sha',
      sizeBytes: 512,
      uploadedAt: '2026-04-04T00:00:00.000Z',
    },
    signature: {
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
      notes: 'Desktop release notes',
      publishedAt: '2026-04-04T00:00:00.000Z',
      policy: {
        mandatory: Boolean(input.mandatory),
        forceUpdateBelowVersion: null,
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
          notes: 'Desktop release notes',
          targets: [target],
          policy: {
            mandatory: Boolean(input.mandatory),
            forceUpdateBelowVersion: null,
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

function createPortalStore(config: Record<string, unknown> | null) {
  return {
    async getAppDetail(appName: string) {
      if (!config) return null;
      return {
        app: {
          appName,
          config,
        },
      };
    },
  };
}

test('resolveDesktopUpdateHintPayload returns managed desktop release hint for configured app', async () => {
  const hint = await resolveDesktopUpdateHintPayload(
    {
      appName: 'iclaw',
      appVersion: '1.0.1+202604021919',
      platform: 'darwin',
      arch: 'aarch64',
      channel: 'prod',
    },
    createPortalStore(buildPublishedConfig({
      version: '1.0.2+202604041200',
    })) as never,
    'https://updates.example.com',
  );

  assert.ok(hint);
  assert.equal(hint.latestVersion, '1.0.2+202604041200');
  assert.equal(hint.rolloutId, 'rollout-prod-20260404');
  assert.equal(hint.updateAvailable, true);
  assert.equal(hint.enforcementState, 'recommended');
  assert.match(hint.manifestUrl || '', /desktop\/release-manifest/);
  assert.match(hint.artifactUrl || '', /artifact_type=installer/);
  assert.equal(hint.artifactSha256, 'installer-sha');
});

test('resolveDesktopUpdateResponseHeaders exposes desktop update metadata for the desktop shell', async () => {
  const headers = await resolveDesktopUpdateResponseHeaders(
    {
      'x-iclaw-app-name': 'iclaw',
      'x-iclaw-app-version': '1.0.1+202604021919',
      'x-iclaw-platform': 'darwin',
      'x-iclaw-arch': 'aarch64',
      'x-iclaw-channel': 'prod',
    },
    createPortalStore(buildPublishedConfig({
      version: '1.0.2+202604041200',
      mandatory: true,
      allowCurrentRunToFinish: false,
    })) as never,
    'https://updates.example.com',
  );

  assert.equal(headers['x-iclaw-app-name'], 'iclaw');
  assert.equal(headers['x-iclaw-latest-version'], '1.0.2+202604041200');
  assert.equal(headers['x-iclaw-update-available'], 'true');
  assert.equal(headers['x-iclaw-update-mandatory'], 'true');
  assert.equal(headers['x-iclaw-update-enforcement-state'], 'required_now');
  assert.equal(headers['x-iclaw-update-block-new-runs'], 'true');
  assert.equal(headers['x-iclaw-update-rollout-id'], 'rollout-prod-20260404');
  assert.equal(headers['x-iclaw-update-reason-code'], 'desktop_update');
  assert.match(headers['x-iclaw-update-manifest-url'] || '', /desktop\/release-manifest/);
  assert.match(headers['x-iclaw-update-artifact-url'] || '', /artifact_type=installer/);
  assert.equal(headers['x-iclaw-update-artifact-sha256'], 'installer-sha');
});

test('resolveDesktopUpdaterRoutePayload returns signed updater payload for native auto-update checks', async () => {
  const payload = await resolveDesktopUpdaterRoutePayload(
    {
      appName: 'iclaw',
      appVersion: '1.0.1+202604021919',
      platform: 'darwin',
      arch: 'aarch64',
      channel: 'prod',
    },
    createPortalStore(buildPublishedConfig({
      version: '1.0.2+202604041200',
    })) as never,
    'https://updates.example.com',
  );

  assert.ok(payload);
  assert.equal(payload.version, '1.0.2+202604041200');
  assert.equal(payload.rolloutId, 'rollout-prod-20260404');
  assert.equal(payload.signature, 'signed-updater-payload');
  assert.equal(payload.enforcementState, 'recommended');
  assert.match(payload.url, /artifact_type=updater/);
  assert.match(payload.externalDownloadUrl || '', /artifact_type=installer/);
  assert.equal(payload.externalDownloadSha256, 'installer-sha');
});

test('resolveDesktopUpdateResponseHeaders returns empty object when app is unmanaged', async () => {
  const headers = await resolveDesktopUpdateResponseHeaders(
    {
      'x-iclaw-app-name': 'missing-app',
      'x-iclaw-app-version': '1.0.1+202604021919',
      'x-iclaw-platform': 'darwin',
      'x-iclaw-arch': 'aarch64',
      'x-iclaw-channel': 'prod',
    },
    createPortalStore(null) as never,
    'https://updates.example.com',
  );

  assert.deepEqual(headers, {});
});
