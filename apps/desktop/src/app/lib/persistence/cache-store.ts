function canUseWindowStorage(storageType: 'localStorage' | 'sessionStorage'): boolean {
  return typeof window !== 'undefined' && typeof window[storageType] !== 'undefined';
}

function getWindowStorage(storageType: 'localStorage' | 'sessionStorage'): Storage | null {
  if (!canUseWindowStorage(storageType)) {
    return null;
  }
  try {
    return window[storageType];
  } catch {
    return null;
  }
}

function readStorageString(storageType: 'localStorage' | 'sessionStorage', key: string): string | null {
  const storage = getWindowStorage(storageType);
  if (!storage) {
    return null;
  }
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorageString(storageType: 'localStorage' | 'sessionStorage', key: string, value: string | null): void {
  const storage = getWindowStorage(storageType);
  if (!storage) {
    return;
  }
  try {
    if (value === null) {
      storage.removeItem(key);
      return;
    }
    storage.setItem(key, value);
  } catch {}
}

function readStorageJson<T>(storageType: 'localStorage' | 'sessionStorage', key: string): T | null {
  const raw = readStorageString(storageType, key);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeStorageJson(storageType: 'localStorage' | 'sessionStorage', key: string, value: unknown): void {
  if (value === null || value === undefined) {
    writeStorageString(storageType, key, null);
    return;
  }
  try {
    writeStorageString(storageType, key, JSON.stringify(value));
  } catch {}
}

function clearStorageKeysByPrefix(storageType: 'localStorage' | 'sessionStorage', prefix: string): void {
  const storage = getWindowStorage(storageType);
  if (!storage) {
    return;
  }
  try {
    const toDelete: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && key.startsWith(prefix)) {
        toDelete.push(key);
      }
    }
    toDelete.forEach((key) => storage.removeItem(key));
  } catch {}
}

export function canUseCacheStorage(): boolean {
  return canUseWindowStorage('localStorage');
}

export function readCacheString(key: string): string | null {
  return readStorageString('localStorage', key);
}

export function writeCacheString(key: string, value: string | null): void {
  writeStorageString('localStorage', key, value);
}

export function readCacheJson<T>(key: string): T | null {
  return readStorageJson<T>('localStorage', key);
}

export function writeCacheJson(key: string, value: unknown): void {
  writeStorageJson('localStorage', key, value);
}

export function removeCacheKeys(keys: string[]): void {
  keys.forEach((key) => writeCacheString(key, null));
}

export function clearCacheKeysByPrefix(prefix: string): void {
  clearStorageKeysByPrefix('localStorage', prefix);
}

export function canUseSessionStorage(): boolean {
  return canUseWindowStorage('sessionStorage');
}

export function readSessionString(key: string): string | null {
  return readStorageString('sessionStorage', key);
}

export function writeSessionString(key: string, value: string | null): void {
  writeStorageString('sessionStorage', key, value);
}

export function readSessionJson<T>(key: string): T | null {
  return readStorageJson<T>('sessionStorage', key);
}

export function writeSessionJson(key: string, value: unknown): void {
  writeStorageJson('sessionStorage', key, value);
}

export function removeSessionKeys(keys: string[]): void {
  keys.forEach((key) => writeSessionString(key, null));
}

export function clearSessionKeysByPrefix(prefix: string): void {
  clearStorageKeysByPrefix('sessionStorage', prefix);
}
