import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDesktopUpdateApiRoutes,
  createDesktopUpdateResponseHeadersResolver,
} from './desktop-update-api.ts';
import {HttpError} from './errors.ts';
import type {Route} from './http.ts';
import {writePortalDesktopReleaseConfig, type PortalDesktopReleaseConfig, type PortalDesktopReleaseTarget} from './portal-desktop-release.ts';

function buildPublishedConfig(input: {
  version: string;
  rolloutId?: string;
  mandatory?: boolean;
  allowCurrentRunToFinish?: boolean;
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
          targets: [target, ...(input.extraTargets || [])],
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

function createDesktopUpdateApiHarness(managedConfig: Record<string, unknown> | null) {
  const portalStore = createPortalStore(managedConfig);
  const resolvePublicBaseUrl = () => 'https://updates.example.com';
  const routes = createDesktopUpdateApiRoutes({
    portalStore,
    resolvePublicBaseUrl,
  });
  const headersResolver = createDesktopUpdateResponseHeadersResolver({
    portalStore,
    resolvePublicBaseUrl,
  });
  return {
    findRoute(path: string): Route {
      const route = routes.find((entry) => entry.path === path);
      assert.ok(route, `route ${path} should exist`);
      return route;
    },
    headersResolver,
  };
}

test('desktop update hint route returns managed payload', async () => {
  const {findRoute} = createDesktopUpdateApiHarness(
    buildPublishedConfig({
      version: '1.0.2+202604041200',
    }),
  );

  const payload = await findRoute('/desktop/update-hint').handler({
    body: undefined,
    requestId: 'req-test',
    headers: {},
    params: {},
    url: new URL(
      'http://127.0.0.1:2130/desktop/update-hint?app_name=iclaw&current_version=1.0.1%2B202604021919&target=darwin&arch=aarch64&channel=prod',
    ),
  });

  assert.equal(typeof payload, 'object');
  assert.equal((payload as Record<string, unknown>).latestVersion, '1.0.2+202604041200');
  assert.equal((payload as Record<string, unknown>).rolloutId, 'rollout-prod-20260404');
  assert.equal((payload as Record<string, unknown>).updateAvailable, true);
  assert.equal((payload as Record<string, unknown>).enforcementState, 'recommended');
  assert.match(String((payload as Record<string, unknown>).manifestUrl || ''), /desktop\/release-manifest/);
  assert.match(String((payload as Record<string, unknown>).artifactUrl || ''), /artifact_type=installer/);
  assert.equal((payload as Record<string, unknown>).artifactSha256, 'installer-sha');
});

test('desktop update hint route rejects requests without current_version', async () => {
  const {findRoute} = createDesktopUpdateApiHarness(buildPublishedConfig({version: '1.0.2+202604041200'}));

  await assert.rejects(
    async () =>
      findRoute('/desktop/update-hint').handler({
        body: undefined,
        requestId: 'req-test',
        headers: {},
        params: {},
        url: new URL('http://127.0.0.1:2130/desktop/update-hint?app_name=iclaw&channel=prod'),
      }),
    (error: unknown) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.statusCode, 400);
      assert.equal(error.api.code, 'BAD_REQUEST');
      assert.equal(error.api.message, 'current_version is required');
      return true;
    },
  );
});

test('desktop updater route returns signed native updater payload', async () => {
  const {findRoute} = createDesktopUpdateApiHarness(
    buildPublishedConfig({
      version: '1.0.2+202604041200',
    }),
  );

  const response = await findRoute('/desktop/update').handler({
    body: undefined,
    requestId: 'req-test',
    headers: {},
    params: {},
    url: new URL(
      'http://127.0.0.1:2130/desktop/update?app_name=iclaw&current_version=1.0.1%2B202604021919&target=darwin&arch=aarch64&channel=prod',
    ),
  });

  assert.ok(response && typeof response === 'object' && 'body' in response);
  const raw = response as {statusCode?: number; headers?: Record<string, string>; body: string | Buffer};
  assert.equal(raw.statusCode, 200);
  assert.equal(raw.headers?.['Cache-Control'], 'no-store');
  const payload = JSON.parse(String(raw.body)) as Record<string, unknown>;
  assert.equal(payload.version, '1.0.2+202604041200');
  assert.equal(payload.rollout_id, 'rollout-prod-20260404');
  assert.equal(payload.signature, 'signed-updater-payload');
  assert.equal(payload.enforcement_state, 'recommended');
  assert.match(String(payload.url || ''), /artifact_type=updater/);
  assert.match(String(payload.external_download_url || ''), /artifact_type=installer/);
  assert.equal(payload.external_download_sha256, 'installer-sha');
});

test('desktop update hint and updater routes return aligned policy fields for windows targets', async () => {
  const {findRoute} = createDesktopUpdateApiHarness(
    buildPublishedConfig({
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
              allowCurrentRunToFinish: true,
              reasonCode: 'desktop_update',
              reasonMessage: 'Windows update required after current run.',
            },
          },
        },
      ],
    }),
  );

  const hint = await findRoute('/desktop/update-hint').handler({
    body: undefined,
    requestId: 'req-test',
    headers: {},
    params: {},
    url: new URL(
      'http://127.0.0.1:2130/desktop/update-hint?app_name=iclaw&current_version=1.0.1%2B202604021919&target=windows&arch=x64&channel=prod',
    ),
  }) as Record<string, unknown>;

  const response = await findRoute('/desktop/update').handler({
    body: undefined,
    requestId: 'req-test',
    headers: {},
    params: {},
    url: new URL(
      'http://127.0.0.1:2130/desktop/update?app_name=iclaw&current_version=1.0.1%2B202604021919&target=windows&arch=x64&channel=prod',
    ),
  });
  assert.ok(response && typeof response === 'object' && 'body' in response);
  const raw = response as {body: string | Buffer};
  const payload = JSON.parse(String(raw.body)) as Record<string, unknown>;

  assert.equal(hint.enforcementState, payload.enforcement_state);
  assert.equal(hint.blockNewRuns, payload.block_new_runs);
  assert.equal(hint.rolloutId, 'rollout-win-20260404');
  assert.equal(payload.rollout_id, 'rollout-win-20260404');
  assert.equal(hint.reasonCode, payload.reason_code);
  assert.equal(hint.reasonMessage, payload.reason_message);
  assert.equal(payload.enforcement_state, 'required_after_run');
  assert.equal(payload.reason_message, 'Windows update required after current run.');
});

test('desktop updater route returns 204 when the app is unmanaged', async () => {
  const {findRoute} = createDesktopUpdateApiHarness(null);

  const response = await findRoute('/desktop/update').handler({
    body: undefined,
    requestId: 'req-test',
    headers: {},
    params: {},
    url: new URL(
      'http://127.0.0.1:2130/desktop/update?app_name=missing-app&current_version=1.0.1%2B202604021919&target=darwin&arch=aarch64&channel=prod',
    ),
  });

  assert.ok(response && typeof response === 'object' && 'body' in response);
  const raw = response as {statusCode?: number; headers?: Record<string, string>; body: string | Buffer};
  assert.equal(raw.statusCode, 204);
  assert.equal(raw.headers?.['Cache-Control'], 'no-store');
  assert.equal(String(raw.body), '');
});

test('desktop update headers resolver decorates generic API responses for desktop clients', async () => {
  const {headersResolver} = createDesktopUpdateApiHarness(
    buildPublishedConfig({
      version: '1.0.2+202604041200',
      mandatory: true,
      allowCurrentRunToFinish: false,
    }),
  );

  const headers = await headersResolver({
    request: {
      headers: {
        'x-iclaw-app-name': 'iclaw',
        'x-iclaw-app-version': '1.0.1+202604021919',
        'x-iclaw-platform': 'darwin',
        'x-iclaw-arch': 'aarch64',
        'x-iclaw-channel': 'prod',
      },
    } as never,
    requestId: 'req-test',
    url: new URL('http://127.0.0.1:2130/health'),
  });

  assert.equal(headers['x-iclaw-latest-version'], '1.0.2+202604041200');
  assert.equal(headers['x-iclaw-update-available'], 'true');
  assert.equal(headers['x-iclaw-update-mandatory'], 'true');
  assert.equal(headers['x-iclaw-update-enforcement-state'], 'required_now');
  assert.equal(headers['x-iclaw-update-block-new-runs'], 'true');
});
