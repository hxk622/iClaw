export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

import { BRAND } from './brand';
import { THEME_CHANGE_EVENT, THEME_EXPLICIT_STORAGE_KEY, THEME_STORAGE_KEY } from './storage';

export { THEME_CHANGE_EVENT, THEME_EXPLICIT_STORAGE_KEY, THEME_STORAGE_KEY };

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function getBrandDefaultThemeMode(): ThemeMode {
  return isThemeMode(BRAND.defaultThemeMode ?? null) ? BRAND.defaultThemeMode : 'dark';
}

export function hasExplicitStoredThemeMode(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const explicit = window.localStorage.getItem(THEME_EXPLICIT_STORAGE_KEY);
  if (explicit === '1') {
    return true;
  }
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  return saved === 'light' || saved === 'dark';
}

export function normalizeThemeModePreference(
  value: string | null | undefined,
  fallback: ThemeMode = getBrandDefaultThemeMode(),
): ThemeMode {
  if (!isThemeMode(value)) {
    return fallback;
  }
  if (value === 'light' || value === 'dark') {
    return value;
  }
  return hasExplicitStoredThemeMode() ? 'system' : fallback;
}

export function readStoredThemeMode(): ThemeMode {
  if (typeof window === 'undefined') {
    return getBrandDefaultThemeMode();
  }
  return normalizeThemeModePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
}

export function resolveThemeMode(mode: ThemeMode): ResolvedTheme {
  if (mode === 'light' || mode === 'dark') {
    return mode;
  }
  if (typeof window === 'undefined') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function getResolvedThemeFromDom(): ResolvedTheme {
  if (typeof document === 'undefined') {
    return 'light';
  }
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function applyThemeMode(mode: ThemeMode): ResolvedTheme {
  const resolved = resolveThemeMode(mode);
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.classList.toggle('dark', resolved === 'dark');
    root.dataset.themeMode = mode;
    root.dataset.resolvedTheme = resolved;
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(THEME_CHANGE_EVENT, {
        detail: { mode, resolved },
      }),
    );
  }
  return resolved;
}

export function persistThemeMode(mode: ThemeMode): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
    window.localStorage.setItem(THEME_EXPLICIT_STORAGE_KEY, '1');
  }
}
