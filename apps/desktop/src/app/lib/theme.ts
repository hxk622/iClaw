export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

import {
  DESKTOP_CONFIG_SECTION_THEME,
  readDesktopConfigSection,
  type DesktopThemeConfig,
} from '@/app/lib/persistence/config-store';
import { BRAND } from './brand';
import { THEME_CHANGE_EVENT } from './storage';

export { THEME_CHANGE_EVENT };

function isThemeMode(value: string | null | undefined): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function getBrandDefaultThemeMode(): ThemeMode {
  return isThemeMode(BRAND.defaultThemeMode ?? null) ? BRAND.defaultThemeMode : 'dark';
}

export function hasExplicitStoredThemeMode(): boolean {
  const stored = readDesktopConfigSection<DesktopThemeConfig>(DESKTOP_CONFIG_SECTION_THEME);
  return stored?.explicit === true;
}

export function normalizeThemeModePreference(
  value: string | null | undefined,
  fallback: ThemeMode = getBrandDefaultThemeMode(),
  explicitOverride: boolean = hasExplicitStoredThemeMode(),
): ThemeMode {
  if (!isThemeMode(value)) {
    return fallback;
  }
  if (value === 'light' || value === 'dark') {
    return value;
  }
  return explicitOverride ? 'system' : fallback;
}

export function readStoredThemeMode(): ThemeMode {
  const stored = readDesktopConfigSection<DesktopThemeConfig>(DESKTOP_CONFIG_SECTION_THEME);
  return normalizeThemeModePreference(stored?.mode ?? null, getBrandDefaultThemeMode(), stored?.explicit === true);
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
