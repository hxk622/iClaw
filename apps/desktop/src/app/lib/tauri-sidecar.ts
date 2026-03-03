import { invoke } from '@tauri-apps/api/core';

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function startSidecar(command: string, args: string[]): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  return invoke<boolean>('start_sidecar', { command, args });
}

export async function stopSidecar(): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  return invoke<boolean>('stop_sidecar');
}
