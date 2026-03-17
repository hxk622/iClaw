import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

export interface DesktopUpdateCheckResult {
  supported: boolean;
  available: boolean;
  version: string | null;
  notes: string | null;
  pub_date: string | null;
  mandatory: boolean;
  external_download_url: string | null;
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
  channel: 'dev' | 'prod';
}): Promise<DesktopUpdateCheckResult | null> {
  if (!isTauriRuntime()) return null;
  return invoke<DesktopUpdateCheckResult>('check_desktop_update', {
    input: {
      authBaseUrl: input.authBaseUrl,
      channel: input.channel,
    },
  });
}

export async function downloadAndInstallDesktopUpdate(): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  return invoke<boolean>('download_and_install_desktop_update');
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
