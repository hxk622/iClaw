import type { DesktopUpdateHint } from '@iclaw/sdk';
import { resolveDesktopUpdateArtifactUrl } from './desktop-updates.ts';
import type { DesktopUpdateCheckResult } from './tauri-desktop-updater.ts';

export type DesktopUpdateUpgradeConfig = {
  authBaseUrl: string;
  appName: string;
  channel: 'dev' | 'prod';
};

export type DesktopRuntimePlatform = 'windows' | 'macos' | 'linux' | 'web';

export type DesktopUpdateUpgradeDeps = {
  isTauriRuntime: boolean;
  platform: DesktopRuntimePlatform;
  checkDesktopUpdate: (input: DesktopUpdateUpgradeConfig) => Promise<DesktopUpdateCheckResult | null>;
  downloadAndInstallDesktopUpdate: () => Promise<boolean>;
  downloadAndLaunchDesktopInstaller: (input: {
    artifactUrl: string;
    version?: string | null;
    artifactSha256?: string | null;
  }) => Promise<boolean>;
  resolveDesktopUpdateArtifactUrl?: (hint: DesktopUpdateHint) => Promise<string | null>;
  onBeforeInstallerLaunch?: (input: { hint: DesktopUpdateHint; artifactUrl: string }) => Promise<void>;
  openExternal: (url: string) => void;
};

export type DesktopUpdateUpgradeResult =
  | {
      mode: 'native';
      actionState: 'downloading';
      progress: number;
      detail: string;
    }
  | {
      mode: 'installer';
      actionState: 'opened';
      statusMessage: string;
    }
  | {
      mode: 'external';
      actionState: 'opened';
      openedUrl: string;
      statusMessage: string;
    };

function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function executeDesktopUpdateUpgrade(input: {
  hint: DesktopUpdateHint;
  config: DesktopUpdateUpgradeConfig;
  deps: DesktopUpdateUpgradeDeps;
}): Promise<DesktopUpdateUpgradeResult> {
  const { hint, config, deps } = input;

  if (deps.isTauriRuntime && deps.platform === 'windows') {
    const resolveArtifactUrl = deps.resolveDesktopUpdateArtifactUrl || resolveDesktopUpdateArtifactUrl;
    const artifactUrl = trimString(await resolveArtifactUrl(hint));
    if (!artifactUrl) {
      throw new Error('当前更新源未提供安装包地址');
    }
    await deps.onBeforeInstallerLaunch?.({ hint, artifactUrl });
    const started = await deps.downloadAndLaunchDesktopInstaller({
      artifactUrl,
      version: hint.latestVersion,
      artifactSha256: null,
    });
    if (!started) {
      throw new Error('桌面安装器启动失败');
    }
    return {
      mode: 'installer',
      actionState: 'opened',
      statusMessage: '已启动安装器，正在完成升级。',
    };
  }

  if (deps.isTauriRuntime) {
    const updaterCheck = await deps.checkDesktopUpdate(config);
    if (updaterCheck?.supported && updaterCheck.available) {
      const started = await deps.downloadAndInstallDesktopUpdate();
      if (!started) {
        throw new Error('桌面更新下载未启动');
      }
      return {
        mode: 'native',
        actionState: 'downloading',
        progress: 5,
        detail: '正在准备下载更新包。',
      };
    }

    const externalDownloadUrl = trimString(updaterCheck?.external_download_url);
    if (externalDownloadUrl) {
      deps.openExternal(externalDownloadUrl);
      return {
        mode: 'external',
        actionState: 'opened',
        openedUrl: externalDownloadUrl,
        statusMessage: '已打开更新下载页。',
      };
    }
  }

  const resolveArtifactUrl = deps.resolveDesktopUpdateArtifactUrl || resolveDesktopUpdateArtifactUrl;
  const artifactUrl = await resolveArtifactUrl(hint);
  const targetUrl = artifactUrl || trimString(hint.manifestUrl);
  if (!targetUrl) {
    throw new Error('当前更新源未提供下载地址');
  }
  deps.openExternal(targetUrl);
  return {
    mode: 'external',
    actionState: 'opened',
    openedUrl: targetUrl,
    statusMessage: '已打开更新下载页。',
  };
}
