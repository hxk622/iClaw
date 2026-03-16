import { invoke } from '@tauri-apps/api/core';
import { ACCESS_TOKEN_STORAGE_KEY, REFRESH_TOKEN_STORAGE_KEY } from './storage';

const LEGACY_ACCESS_TOKEN_KEY = 'iclaw_access_token';
const LEGACY_REFRESH_TOKEN_KEY = 'iclaw_refresh_token';

export interface StoredAuth {
  accessToken: string;
  refreshToken: string;
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function readAuth(): Promise<StoredAuth | null> {
  if (isTauriRuntime()) {
    try {
      const result = await invoke<{ access_token: string; refresh_token: string } | null>(
        'load_auth_tokens',
      );
      if (!result) return null;
      return {
        accessToken: result.access_token,
        refreshToken: result.refresh_token,
      };
    } catch {
      return null;
    }
  }

  const accessToken =
    localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) || localStorage.getItem(LEGACY_ACCESS_TOKEN_KEY);
  const refreshToken =
    localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY) || localStorage.getItem(LEGACY_REFRESH_TOKEN_KEY);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export async function writeAuth(auth: StoredAuth): Promise<void> {
  if (isTauriRuntime()) {
    await invoke<boolean>('save_auth_tokens', {
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
    });
    return;
  }

  localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, auth.accessToken);
  localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, auth.refreshToken);
}

export async function clearAuth(): Promise<void> {
  if (isTauriRuntime()) {
    await invoke<boolean>('clear_auth_tokens');
    return;
  }

  localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
  localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
}
