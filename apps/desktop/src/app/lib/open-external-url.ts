import { invoke } from '@tauri-apps/api/core';
import { isTauriRuntime } from './tauri-sidecar';

export async function openExternalUrl(url: string): Promise<boolean> {
  const normalized = url.trim();
  if (!normalized) return false;

  if (isTauriRuntime()) {
    try {
      return await invoke<boolean>('open_external_url', { url: normalized });
    } catch (error) {
      console.error('failed to open external url in desktop shell', error);
      return false;
    }
  }

  try {
    const nextWindow = window.open(normalized, '_blank', 'noopener,noreferrer');
    if (!nextWindow || nextWindow.closed || typeof nextWindow.closed === 'undefined') {
      window.location.assign(normalized);
    }
    return true;
  } catch (error) {
    console.error('failed to open external url in browser', error);
    return false;
  }
}
