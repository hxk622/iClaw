import { invoke } from '@tauri-apps/api/core';
import type { SettingsState } from '@/app/contexts/settings-context';

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function saveIclawSettingsAndApply(settings: SettingsState): Promise<boolean> {
  localStorage.setItem('iclaw-settings', JSON.stringify(settings));

  if (!isTauriRuntime()) {
    return false;
  }

  return invoke<boolean>('save_iclaw_settings_and_apply', { settings });
}
