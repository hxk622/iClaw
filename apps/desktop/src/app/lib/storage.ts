import { BRAND } from './brand';

function buildKey(suffix: string): string {
  return `${BRAND.storage.namespace}:${suffix}`;
}

export const ACCESS_TOKEN_STORAGE_KEY = buildKey('auth.access_token');
export const REFRESH_TOKEN_STORAGE_KEY = buildKey('auth.refresh_token');
export const SETTINGS_STORAGE_KEY = buildKey('settings');
export const THEME_STORAGE_KEY = buildKey('theme.mode');
export const THEME_CHANGE_EVENT = buildKey('theme.change');
export const WORKSPACE_UPDATED_EVENT = buildKey('workspace.updated');
