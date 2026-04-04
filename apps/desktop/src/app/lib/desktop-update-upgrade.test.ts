import test from 'node:test';
import assert from 'node:assert/strict';

import type { DesktopUpdateHint } from '@iclaw/sdk';
import { executeDesktopUpdateUpgrade } from './desktop-update-upgrade.ts';

function buildHint(overrides: Partial<DesktopUpdateHint> = {}): DesktopUpdateHint {
  return {
    latestVersion: '1.0.2+202604041200',
    updateAvailable: true,
    mandatory: false,
    enforcementState: 'recommended',
    blockNewRuns: false,
    reasonCode: null,
    reasonMessage: null,
    manifestUrl: 'https://updates.example.com/latest-prod-mac-aarch64.json',
    artifactUrl: null,
    ...overrides,
  };
}

test('executeDesktopUpdateUpgrade prefers native tauri updater when signed update is available', async () => {
  const openedUrls: string[] = [];
  const calls: string[] = [];

  const result = await executeDesktopUpdateUpgrade({
    hint: buildHint(),
    config: {
      authBaseUrl: 'https://updates.example.com',
      appName: 'iclaw',
      channel: 'prod',
    },
    deps: {
      isTauriRuntime: true,
      checkDesktopUpdate: async (input) => {
        calls.push(`check:${input.appName}:${input.channel}`);
        return {
          supported: true,
          available: true,
          version: '1.0.2+202604041200',
          notes: 'Signed update',
          pub_date: '2026-04-04T00:00:00.000Z',
          mandatory: false,
          external_download_url: null,
        };
      },
      downloadAndInstallDesktopUpdate: async () => {
        calls.push('download');
        return true;
      },
      resolveDesktopUpdateArtifactUrl: async () => {
        calls.push('artifact');
        return 'https://should-not-open.example.com';
      },
      openExternal: (url) => {
        openedUrls.push(url);
      },
    },
  });

  assert.deepEqual(calls, ['check:iclaw:prod', 'download']);
  assert.deepEqual(openedUrls, []);
  assert.deepEqual(result, {
    mode: 'native',
    actionState: 'downloading',
    progress: 5,
    detail: '正在准备下载更新包。',
  });
});

test('executeDesktopUpdateUpgrade opens runtime-provided external download url when updater falls back to installer', async () => {
  const openedUrls: string[] = [];

  const result = await executeDesktopUpdateUpgrade({
    hint: buildHint(),
    config: {
      authBaseUrl: 'https://updates.example.com',
      appName: 'iclaw',
      channel: 'prod',
    },
    deps: {
      isTauriRuntime: true,
      checkDesktopUpdate: async () => ({
        supported: false,
        available: false,
        version: null,
        notes: null,
        pub_date: null,
        mandatory: false,
        external_download_url: 'https://downloads.example.com/iclaw.dmg',
      }),
      downloadAndInstallDesktopUpdate: async () => false,
      resolveDesktopUpdateArtifactUrl: async () => {
        throw new Error('should not resolve artifact when runtime already supplied external url');
      },
      openExternal: (url) => {
        openedUrls.push(url);
      },
    },
  });

  assert.deepEqual(openedUrls, ['https://downloads.example.com/iclaw.dmg']);
  assert.deepEqual(result, {
    mode: 'external',
    actionState: 'opened',
    openedUrl: 'https://downloads.example.com/iclaw.dmg',
    statusMessage: '已打开更新下载页。',
  });
});

test('executeDesktopUpdateUpgrade falls back to manifest artifact resolution outside tauri runtime', async () => {
  const openedUrls: string[] = [];

  const result = await executeDesktopUpdateUpgrade({
    hint: buildHint(),
    config: {
      authBaseUrl: 'https://updates.example.com',
      appName: 'iclaw',
      channel: 'prod',
    },
    deps: {
      isTauriRuntime: false,
      checkDesktopUpdate: async () => null,
      downloadAndInstallDesktopUpdate: async () => false,
      resolveDesktopUpdateArtifactUrl: async () => 'https://downloads.example.com/iclaw-installer.dmg',
      openExternal: (url) => {
        openedUrls.push(url);
      },
    },
  });

  assert.deepEqual(openedUrls, ['https://downloads.example.com/iclaw-installer.dmg']);
  assert.deepEqual(result, {
    mode: 'external',
    actionState: 'opened',
    openedUrl: 'https://downloads.example.com/iclaw-installer.dmg',
    statusMessage: '已打开更新下载页。',
  });
});

test('executeDesktopUpdateUpgrade throws when no native updater and no fallback download url exist', async () => {
  await assert.rejects(
    executeDesktopUpdateUpgrade({
      hint: buildHint({
        manifestUrl: null,
      }),
      config: {
        authBaseUrl: 'https://updates.example.com',
        appName: 'iclaw',
        channel: 'prod',
      },
      deps: {
        isTauriRuntime: false,
        checkDesktopUpdate: async () => null,
        downloadAndInstallDesktopUpdate: async () => false,
        resolveDesktopUpdateArtifactUrl: async () => null,
        openExternal: () => {},
      },
    }),
    /当前更新源未提供下载地址/,
  );
});
