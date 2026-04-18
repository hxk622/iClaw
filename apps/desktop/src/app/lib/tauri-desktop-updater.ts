import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

export interface DesktopUpdateCheckResult {
  supported: boolean;
  available: boolean;
  version: string | null;
  rollout_id: string | null;
  notes: string | null;
  pub_date: string | null;
  mandatory: boolean;
  external_download_url: string | null;
  external_download_sha256: string | null;
}

export interface DesktopUpdateProgress {
  phase: string;
  progress: number;
  version: string | null;
  downloaded_bytes: number | null;
  total_bytes: number | null;
  detail: string;
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function checkDesktopUpdate(input: {
  authBaseUrl: string;
  appName: string;
  channel: 'dev' | 'prod';
}): Promise<DesktopUpdateCheckResult | null> {
  if (!isTauriRuntime()) return null;
  return invoke<DesktopUpdateCheckResult>('check_desktop_update', {
    input: {
      authBaseUrl: input.authBaseUrl,
      appName: input.appName,
      channel: input.channel,
    },
  });
}

export async function downloadAndInstallDesktopUpdate(): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  return invoke<boolean>('download_and_install_desktop_update');
}

export async function downloadAndLaunchDesktopInstaller(input: {
  artifactUrl: string;
  version?: string | null;
  artifactSha256?: string | null;
}): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  return invoke<boolean>('download_and_launch_desktop_installer', {
    input: {
      artifactUrl: input.artifactUrl,
      version: input.version || null,
      artifactSha256: input.artifactSha256 || null,
    },
  });
}

export async function restartDesktopApp(): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke('restart_desktop_app');
}

export async function listenDesktopUpdateProgress(
  handler: (payload: DesktopUpdateProgress) => void,
): Promise<() => void> {
  if (!isTauriRuntime()) return () => {};
  const unlisten = await listen<DesktopUpdateProgress>('desktop-update-progress', (event) => {
    handler(event.payload);
  });
  return () => {
    void unlisten();
  };
}
