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
      platform: 'macos',
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
          external_download_sha256: null,
        };
      },
      downloadAndInstallDesktopUpdate: async () => {
        calls.push('download');
        return true;
      },
      downloadAndLaunchDesktopInstaller: async () => {
        calls.push('installer');
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

test('executeDesktopUpdateUpgrade prefers native tauri updater on windows when signed update is available', async () => {
  const openedUrls: string[] = [];
  const calls: string[] = [];

  const result = await executeDesktopUpdateUpgrade({
    hint: buildHint({
      artifactUrl: 'https://downloads.example.com/iclaw-installer.exe',
      latestVersion: '1.0.4',
      mandatory: true,
      enforcementState: 'required_after_run',
    }),
    config: {
      authBaseUrl: 'https://updates.example.com',
      appName: 'iclaw',
      channel: 'prod',
    },
    deps: {
      isTauriRuntime: true,
      platform: 'windows',
      checkDesktopUpdate: async (input) => {
        calls.push(`check:${input.appName}:${input.channel}`);
        return {
          supported: true,
          available: true,
          version: '1.0.4',
          notes: 'Signed windows update',
          pub_date: '2026-04-04T00:00:00.000Z',
          mandatory: true,
          external_download_url: 'https://downloads.example.com/iclaw-installer.exe',
          external_download_sha256: 'runtime-installer-sha',
        };
      },
      downloadAndInstallDesktopUpdate: async () => {
        calls.push('native');
        return true;
      },
      downloadAndLaunchDesktopInstaller: async (input) => {
        calls.push(`installer:${input.artifactUrl}:${input.version}`);
        return true;
      },
      onBeforeInstallerLaunch: async (input) => {
        calls.push(`prepare:${input.artifactUrl}:${input.hint.latestVersion}`);
      },
      resolveDesktopUpdateArtifactUrl: async () => {
        calls.push('artifact');
        return 'https://downloads.example.com/iclaw-installer.exe';
      },
      openExternal: (url) => {
        openedUrls.push(url);
      },
    },
  });

  assert.deepEqual(calls, [
    'check:iclaw:prod',
    'native',
  ]);
  assert.deepEqual(openedUrls, []);
  assert.deepEqual(result, {
    mode: 'native',
    actionState: 'downloading',
    progress: 5,
    detail: '正在准备下载更新包。',
  });
});

test('executeDesktopUpdateUpgrade falls back to windows installer when native updater is unavailable', async () => {
  const openedUrls: string[] = [];
  const calls: string[] = [];

  const result = await executeDesktopUpdateUpgrade({
    hint: buildHint({
      artifactUrl: 'https://downloads.example.com/iclaw-installer.exe',
      latestVersion: '1.0.4',
      mandatory: true,
      enforcementState: 'required_after_run',
    }),
    config: {
      authBaseUrl: 'https://updates.example.com',
      appName: 'iclaw',
      channel: 'prod',
    },
    deps: {
      isTauriRuntime: true,
      platform: 'windows',
      checkDesktopUpdate: async () => {
        calls.push('check');
        return null;
      },
      downloadAndInstallDesktopUpdate: async () => {
        calls.push('native');
        return true;
      },
      downloadAndLaunchDesktopInstaller: async (input) => {
        calls.push(`installer:${input.artifactUrl}:${input.version}`);
        return true;
      },
      onBeforeInstallerLaunch: async (input) => {
        calls.push(`prepare:${input.artifactUrl}:${input.hint.latestVersion}`);
      },
      resolveDesktopUpdateArtifactUrl: async () => {
        calls.push('artifact');
        return 'https://downloads.example.com/iclaw-installer.exe';
      },
      openExternal: (url) => {
        openedUrls.push(url);
      },
    },
  });

  assert.deepEqual(calls, [
    'check',
    'prepare:https://downloads.example.com/iclaw-installer.exe:1.0.4',
    'installer:https://downloads.example.com/iclaw-installer.exe:1.0.4',
  ]);
  assert.deepEqual(openedUrls, []);
  assert.deepEqual(result, {
    mode: 'installer',
    actionState: 'opened',
    statusMessage: '已启动安装器，正在完成升级。',
  });
});

test('executeDesktopUpdateUpgrade falls back to windows installer when native updater install start fails', async () => {
  const calls: string[] = [];

  const result = await executeDesktopUpdateUpgrade({
    hint: buildHint({
      artifactUrl: 'https://downloads.example.com/iclaw-installer.exe',
      latestVersion: '1.0.4',
    }),
    config: {
      authBaseUrl: 'https://updates.example.com',
      appName: 'iclaw',
      channel: 'prod',
    },
    deps: {
      isTauriRuntime: true,
      platform: 'windows',
      checkDesktopUpdate: async () => {
        calls.push('check');
        return {
          supported: true,
          available: true,
          version: '1.0.4',
          notes: 'Signed windows update',
          pub_date: '2026-04-04T00:00:00.000Z',
          mandatory: false,
          external_download_url: 'https://downloads.example.com/iclaw-installer.exe',
          external_download_sha256: 'runtime-installer-sha',
        };
      },
      downloadAndInstallDesktopUpdate: async () => {
        calls.push('native');
        throw new Error('native install failed');
      },
      downloadAndLaunchDesktopInstaller: async (input) => {
        calls.push(`installer:${input.artifactUrl}:${input.version}:${input.artifactSha256}`);
        return true;
      },
      onBeforeInstallerLaunch: async (input) => {
        calls.push(`prepare:${input.artifactUrl}:${input.hint.latestVersion}`);
      },
      resolveDesktopUpdateArtifactUrl: async () => {
        calls.push('artifact');
        return 'https://should-not-be-needed.example.com/iclaw-installer.exe';
      },
      openExternal: () => {},
    },
  });

  assert.deepEqual(calls, [
    'check',
    'native',
    'prepare:https://downloads.example.com/iclaw-installer.exe:1.0.4',
    'installer:https://downloads.example.com/iclaw-installer.exe:1.0.4:runtime-installer-sha',
  ]);
  assert.deepEqual(result, {
    mode: 'installer',
    actionState: 'opened',
    statusMessage: '已启动安装器，正在完成升级。',
  });
});

test('executeDesktopUpdateUpgrade opens runtime-provided external download url when updater falls back to installer', async () => {
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
      platform: 'macos',
      checkDesktopUpdate: async () => {
        calls.push('check');
        return {
          supported: false,
          available: false,
          version: null,
          notes: null,
          pub_date: null,
          mandatory: false,
          external_download_url: 'https://downloads.example.com/iclaw.dmg',
          external_download_sha256: 'runtime-dmg-sha',
        };
      },
      downloadAndInstallDesktopUpdate: async () => false,
      downloadAndLaunchDesktopInstaller: async (input) => {
        calls.push(`installer:${input.artifactUrl}`);
        return false;
      },
      onBeforeInstallerLaunch: async (input) => {
        calls.push(`prepare:${input.artifactUrl}:${input.hint.latestVersion}`);
      },
      resolveDesktopUpdateArtifactUrl: async () => {
        throw new Error('should not resolve artifact when runtime already supplied external url');
      },
      openExternal: (url) => {
        openedUrls.push(url);
      },
    },
  });

  assert.deepEqual(calls, [
    'check',
    'prepare:https://downloads.example.com/iclaw.dmg:1.0.2+202604041200',
    'installer:https://downloads.example.com/iclaw.dmg',
  ]);
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
      platform: 'web',
      checkDesktopUpdate: async () => null,
      downloadAndInstallDesktopUpdate: async () => false,
      downloadAndLaunchDesktopInstaller: async () => false,
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
        platform: 'web',
        checkDesktopUpdate: async () => null,
        downloadAndInstallDesktopUpdate: async () => false,
        downloadAndLaunchDesktopInstaller: async () => false,
        resolveDesktopUpdateArtifactUrl: async () => null,
        openExternal: () => {},
      },
    }),
    /当前更新源未提供下载地址/,
  );
});
