export function readCacheString(key: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeCacheString(key: string, value: string | null): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    if (value === null) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, value);
  } catch {}
}

export function readCacheJson<T>(key: string): T | null {
  const raw = readCacheString(key);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeCacheJson(key: string, value: unknown): void {
  if (value === null || value === undefined) {
    writeCacheString(key, null);
    return;
  }
  try {
    writeCacheString(key, JSON.stringify(value));
  } catch {}
}
