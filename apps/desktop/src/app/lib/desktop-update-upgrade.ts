import type { DesktopUpdateHint } from '@iclaw/sdk';
import { resolveDesktopUpdateArtifactUrl } from './desktop-updates.ts';
import type { DesktopUpdateCheckResult } from './tauri-desktop-updater.ts';

export type DesktopUpdateUpgradeConfig = {
  authBaseUrl: string;
  appName: string;
  channel: 'dev' | 'prod';
};

export type DesktopUpdateUpgradeDeps = {
  isTauriRuntime: boolean;
  checkDesktopUpdate: (input: DesktopUpdateUpgradeConfig) => Promise<DesktopUpdateCheckResult | null>;
  downloadAndInstallDesktopUpdate: () => Promise<boolean>;
  resolveDesktopUpdateArtifactUrl?: (hint: DesktopUpdateHint) => Promise<string | null>;
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
