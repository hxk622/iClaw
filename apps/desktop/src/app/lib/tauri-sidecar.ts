import { invoke } from '@tauri-apps/api/core';

export interface GatewayAuth {
  token?: string;
  password?: string;
}

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function loadGatewayAuth(): Promise<GatewayAuth | null> {
  if (!isTauriRuntime()) return null;
  return invoke<GatewayAuth>('load_gateway_auth');
}

export async function startSidecar(args: string[]): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  return invoke<boolean>('start_sidecar', { args });
}

export async function stopSidecar(): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  return invoke<boolean>('stop_sidecar');
}
