import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface ExtensionGrantRequestPayload {
  requestId: string;
  extensionId: string;
  browserFamily: string;
  deviceId: string;
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function listenExtensionGrantRequests(
  handler: (payload: ExtensionGrantRequestPayload) => void,
): Promise<() => void> {
  if (!isTauriRuntime()) return () => {};
  const unlisten = await listen<ExtensionGrantRequestPayload>('extension-bridge-grant-request', (event) => {
    handler(event.payload);
  });
  return () => {
    void unlisten();
  };
}

export async function resolveExtensionGrantRequest(input: {
  requestId: string;
  allow: boolean;
}): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  return invoke<boolean>('resolve_extension_bridge_grant_request', {
    requestId: input.requestId,
    allow: input.allow,
  });
}
