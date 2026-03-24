import { invoke } from '@tauri-apps/api/core';
import { ACCESS_TOKEN_STORAGE_KEY, REFRESH_TOKEN_STORAGE_KEY } from './storage';

const LEGACY_ACCESS_TOKEN_KEY = 'iclaw_access_token';
const LEGACY_REFRESH_TOKEN_KEY = 'iclaw_refresh_token';
const LEGACY_NAMESPACE_ACCESS_TOKEN_KEYS = ['iclaw:auth.access_token'];
const LEGACY_NAMESPACE_REFRESH_TOKEN_KEYS = ['iclaw:auth.refresh_token'];

export interface StoredAuth {
  accessToken: string;
  refreshToken: string;
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function normalizeStoredAuth(input: Partial<StoredAuth> | null | undefined): StoredAuth | null {
  const accessToken = String(input?.accessToken || '').trim();
  const refreshToken = String(input?.refreshToken || '').trim();
  if (!accessToken || !refreshToken) {
    return null;
  }
  return { accessToken, refreshToken };
}

function readBrowserAuth(): StoredAuth | null {
  const accessToken =
    localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) || localStorage.getItem(LEGACY_ACCESS_TOKEN_KEY);
  const refreshToken =
    localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY) || localStorage.getItem(LEGACY_REFRESH_TOKEN_KEY);
  return normalizeStoredAuth({ accessToken: accessToken || '', refreshToken: refreshToken || '' });
}

function persistBrowserAuth(auth: StoredAuth): void {
  localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, auth.accessToken);
  localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, auth.refreshToken);
}

function clearBrowserAuth(): void {
  localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
  localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
}

function readLegacyBrowserAuth(): StoredAuth | null {
  const legacyPairs = LEGACY_NAMESPACE_ACCESS_TOKEN_KEYS.map((accessKey, index) => ({
    accessKey,
    refreshKey: LEGACY_NAMESPACE_REFRESH_TOKEN_KEYS[index],
  }));

  for (const pair of legacyPairs) {
    const accessToken = localStorage.getItem(pair.accessKey);
    const refreshToken = localStorage.getItem(pair.refreshKey);
    if (!accessToken || !refreshToken) {
      continue;
    }

    const auth = normalizeStoredAuth({ accessToken, refreshToken });
    if (!auth) {
      continue;
    }
    persistBrowserAuth(auth);
    return auth;
  }

  return null;
}

export async function readAuth(): Promise<StoredAuth | null> {
  if (isTauriRuntime()) {
    try {
      const result = await invoke<{ access_token: string; refresh_token: string } | null>(
        'load_auth_tokens',
      );
      const auth = normalizeStoredAuth({
        accessToken: result?.access_token || '',
        refreshToken: result?.refresh_token || '',
      });
      if (auth) {
        persistBrowserAuth(auth);
        return auth;
      }
    } catch (error) {
      console.warn('[desktop] failed to read keyring auth tokens, falling back to local storage', error);
    }

    return readBrowserAuth() || readLegacyBrowserAuth();
  }

  const browserAuth = readBrowserAuth();
  if (!browserAuth) {
    return readLegacyBrowserAuth();
  }
  return browserAuth;
}

export async function writeAuth(auth: StoredAuth): Promise<void> {
  const normalized = normalizeStoredAuth(auth);
  if (!normalized) {
    clearBrowserAuth();
    return;
  }

  persistBrowserAuth(normalized);

  if (isTauriRuntime()) {
    try {
      await invoke<boolean>('save_auth_tokens', {
        accessToken: normalized.accessToken,
        refreshToken: normalized.refreshToken,
      });
    } catch (error) {
      console.warn('[desktop] failed to persist auth tokens to keyring, local storage mirror kept', error);
    }
  }
}

export async function clearAuth(): Promise<void> {
  clearBrowserAuth();

  if (isTauriRuntime()) {
    try {
      await invoke<boolean>('clear_auth_tokens');
    } catch (error) {
      console.warn('[desktop] failed to clear keyring auth tokens', error);
    }
  }
}
