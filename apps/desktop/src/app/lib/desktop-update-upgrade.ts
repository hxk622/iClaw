import type { DesktopUpdateHint } from '@iclaw/sdk';
import { resolveDesktopUpdateArtifact, resolveDesktopUpdateArtifactUrl } from './desktop-updates.ts';
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

async function startInstallerFallback(input: {
  hint: DesktopUpdateHint;
  deps: DesktopUpdateUpgradeDeps;
  artifactUrl: string;
  artifactSha256?: string | null;
}): Promise<DesktopUpdateUpgradeResult> {
  const { hint, deps, artifactUrl, artifactSha256 } = input;
  await deps.onBeforeInstallerLaunch?.({ hint, artifactUrl });
  const started = await deps.downloadAndLaunchDesktopInstaller({
    artifactUrl,
    version: hint.latestVersion,
    artifactSha256: artifactSha256 || null,
  });
  if (!started) {
    if (deps.platform !== 'windows') {
      deps.openExternal(artifactUrl);
      return {
        mode: 'external',
        actionState: 'opened',
        openedUrl: artifactUrl,
        statusMessage: '已打开更新下载页。',
      };
    }
    throw new Error('桌面安装器启动失败');
  }
  return {
    mode: 'installer',
    actionState: 'opened',
    statusMessage: '已启动安装器，正在完成升级。',
  };
}

export async function executeDesktopUpdateUpgrade(input: {
  hint: DesktopUpdateHint;
  config: DesktopUpdateUpgradeConfig;
  deps: DesktopUpdateUpgradeDeps;
}): Promise<DesktopUpdateUpgradeResult> {
  const { hint, config, deps } = input;
  const resolveArtifactUrl = deps.resolveDesktopUpdateArtifactUrl || resolveDesktopUpdateArtifactUrl;

  if (deps.isTauriRuntime) {
    let updaterCheck: DesktopUpdateCheckResult | null = null;
    try {
      updaterCheck = await deps.checkDesktopUpdate(config);
    } catch {
      updaterCheck = null;
    }
    if (updaterCheck?.supported && updaterCheck.available) {
      try {
        const started = await deps.downloadAndInstallDesktopUpdate();
        if (started) {
          return {
            mode: 'native',
            actionState: 'downloading',
            progress: 5,
            detail: '正在准备下载更新包。',
          };
        }
      } catch {
        // Fall through to installer fallback when native updater cannot start.
      }
    }

    const runtimeArtifactUrl = trimString(updaterCheck?.external_download_url);
    const runtimeArtifactSha256 = trimString(updaterCheck?.external_download_sha256);
    let artifactUrl = runtimeArtifactUrl;
    let artifactSha256 = runtimeArtifactSha256 || null;
    if (!artifactUrl) {
      if (trimString(hint.artifactUrl)) {
        artifactUrl = trimString(hint.artifactUrl);
        artifactSha256 = trimString(hint.artifactSha256) || null;
      } else if (deps.resolveDesktopUpdateArtifactUrl) {
        artifactUrl = trimString(await deps.resolveDesktopUpdateArtifactUrl(hint));
      } else {
        const resolvedArtifact = await resolveDesktopUpdateArtifact(hint);
        artifactUrl = trimString(resolvedArtifact.artifactUrl);
        artifactSha256 = trimString(resolvedArtifact.artifactSha256) || null;
      }
    }
    if (artifactUrl) {
      return startInstallerFallback({
        hint,
        deps,
        artifactUrl,
        artifactSha256,
      });
    }
  }

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
