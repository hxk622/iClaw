import type { ThemeMode } from './adminTypes';

const THEME_STORAGE_KEY = 'iclaw.admin-web.theme';

export function isThemeMode(value: string): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function readStoredThemeMode(): ThemeMode {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value && isThemeMode(value) ? value : 'system';
  } catch {
    return 'system';
  }
}

export function resolveThemeMode(mode: ThemeMode) {
  if (mode === 'light' || mode === 'dark') {
    return mode;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyThemeMode(mode: ThemeMode) {
  const resolved = resolveThemeMode(mode);
  document.documentElement.dataset.themeMode = mode;
  document.documentElement.dataset.resolvedTheme = resolved;
}

export function persistThemeMode(mode: ThemeMode) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {}
}
