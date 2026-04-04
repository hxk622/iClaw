import { BRAND } from './brand.ts';

export function buildStorageKey(suffix: string): string {
  return `${BRAND.storage.namespace}:${suffix}`;
}

export const ACCESS_TOKEN_STORAGE_KEY = buildStorageKey('auth.access_token');
export const REFRESH_TOKEN_STORAGE_KEY = buildStorageKey('auth.refresh_token');
export const DESKTOP_CONFIG_STORAGE_KEY = buildStorageKey('desktop.config');
export const SETTINGS_STORAGE_KEY = buildStorageKey('settings');
export const THEME_STORAGE_KEY = buildStorageKey('theme.mode');
export const THEME_EXPLICIT_STORAGE_KEY = buildStorageKey('theme.explicit');
export const THEME_CHANGE_EVENT = buildStorageKey('theme.change');
export const WORKSPACE_UPDATED_EVENT = buildStorageKey('workspace.updated');
