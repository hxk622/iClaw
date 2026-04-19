import { invoke } from '@tauri-apps/api/core';
import { readCacheString, removeCacheKeys, writeCacheString } from '@/app/lib/persistence/cache-store';
import { isTauriRuntime } from './desktop-runtime';
import { ACCESS_TOKEN_STORAGE_KEY, REFRESH_TOKEN_STORAGE_KEY } from './storage';

const LEGACY_ACCESS_TOKEN_KEY = 'iclaw_access_token';
const LEGACY_REFRESH_TOKEN_KEY = 'iclaw_refresh_token';
const LEGACY_NAMESPACE_ACCESS_TOKEN_KEYS = ['iclaw:auth.access_token'];
const LEGACY_NAMESPACE_REFRESH_TOKEN_KEYS = ['iclaw:auth.refresh_token'];

export interface StoredAuth {
  accessToken: string;
  refreshToken: string;
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
  const accessToken = readCacheString(ACCESS_TOKEN_STORAGE_KEY);
  const refreshToken = readCacheString(REFRESH_TOKEN_STORAGE_KEY);
  return normalizeStoredAuth({ accessToken: accessToken || '', refreshToken: refreshToken || '' });
}

function persistBrowserAuth(auth: StoredAuth): void {
  writeCacheString(ACCESS_TOKEN_STORAGE_KEY, auth.accessToken);
  writeCacheString(REFRESH_TOKEN_STORAGE_KEY, auth.refreshToken);
}

function clearBrowserAuth(): void {
  removeCacheKeys([
    ACCESS_TOKEN_STORAGE_KEY,
    REFRESH_TOKEN_STORAGE_KEY,
    LEGACY_ACCESS_TOKEN_KEY,
    LEGACY_REFRESH_TOKEN_KEY,
    ...LEGACY_NAMESPACE_ACCESS_TOKEN_KEYS,
    ...LEGACY_NAMESPACE_REFRESH_TOKEN_KEYS,
  ]);
}

function readLegacyBrowserAuth(): StoredAuth | null {
  const accessToken =
    readCacheString(LEGACY_ACCESS_TOKEN_KEY) ||
    LEGACY_NAMESPACE_ACCESS_TOKEN_KEYS.map((key) => readCacheString(key)).find(Boolean) ||
    '';
  const refreshToken =
    readCacheString(LEGACY_REFRESH_TOKEN_KEY) ||
    LEGACY_NAMESPACE_REFRESH_TOKEN_KEYS.map((key) => readCacheString(key)).find(Boolean) ||
    '';
  return normalizeStoredAuth({ accessToken, refreshToken });
}

async function migrateBrowserAuthToSecureStore(): Promise<StoredAuth | null> {
  const auth = readBrowserAuth() || readLegacyBrowserAuth();
  if (!auth) {
    clearBrowserAuth();
    return null;
  }
  await invoke<boolean>('save_auth_tokens', {
    accessToken: auth.accessToken,
    refreshToken: auth.refreshToken,
  });
  clearBrowserAuth();
  return auth;
}

export async function readAuth(): Promise<StoredAuth | null> {
  if (isTauriRuntime()) {
    const result = await invoke<{ access_token: string; refresh_token: string } | null>('load_auth_tokens');
    const auth = normalizeStoredAuth({
      accessToken: result?.access_token || '',
      refreshToken: result?.refresh_token || '',
    });
    if (auth) {
      clearBrowserAuth();
      return auth;
    }
    return migrateBrowserAuthToSecureStore();
  }

  const browserAuth = readBrowserAuth();
  if (!browserAuth) {
    return readLegacyBrowserAuth();
  }
  return browserAuth;
}

export async function writeAuth(auth: StoredAuth): Promise<void> {
  const normalized = normalizeStoredAuth(auth);
  if (isTauriRuntime()) {
    if (!normalized) {
      await invoke<boolean>('clear_auth_tokens');
      clearBrowserAuth();
      return;
    }
    await invoke<boolean>('save_auth_tokens', {
      accessToken: normalized.accessToken,
      refreshToken: normalized.refreshToken,
    });
    clearBrowserAuth();
    return;
  }

  if (!normalized) {
    clearBrowserAuth();
    return;
  }

  persistBrowserAuth(normalized);
}

export async function clearAuth(): Promise<void> {
  if (isTauriRuntime()) {
    try {
      await invoke<boolean>('clear_auth_tokens');
    } finally {
      clearBrowserAuth();
    }
  } else {
    clearBrowserAuth();
  }
}
