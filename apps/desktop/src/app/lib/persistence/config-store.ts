import { invoke } from '@tauri-apps/api/core';
import {
  DESKTOP_CONFIG_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  THEME_EXPLICIT_STORAGE_KEY,
  THEME_STORAGE_KEY,
} from '@/app/lib/storage';
import { isTauriRuntime } from '@/app/lib/tauri-sidecar';
import { readCacheJson, readCacheString, writeCacheJson, writeCacheString } from '@/app/lib/persistence/cache-store';

export const DESKTOP_CONFIG_SECTION_SETTINGS = 'settings';
export const DESKTOP_CONFIG_SECTION_THEME = 'theme';

type ThemeModeValue = 'light' | 'dark' | 'system';

export interface DesktopThemeConfig {
  mode: ThemeModeValue;
  explicit: boolean;
  updatedAt: string | null;
}

export interface DesktopConfigDocument {
  schemaVersion: 1;
  sections: Record<string, unknown>;
  updatedAt: string;
}

let cachedConfigDocument: DesktopConfigDocument = createEmptyDesktopConfigDocument();
let bootstrapPromise: Promise<DesktopConfigDocument> | null = null;
let bootstrapped = false;

function nowIso(): string {
  return new Date().toISOString();
}

function createEmptyDesktopConfigDocument(): DesktopConfigDocument {
  return {
    schemaVersion: 1,
    sections: {},
    updatedAt: nowIso(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isThemeModeValue(value: unknown): value is ThemeModeValue {
  return value === 'light' || value === 'dark' || value === 'system';
}

function normalizeThemeSection(value: unknown): DesktopThemeConfig | null {
  if (!isRecord(value)) {
    return null;
  }
  const mode = value.mode;
  if (!isThemeModeValue(mode)) {
    return null;
  }
  return {
    mode,
    explicit: value.explicit === true,
    updatedAt: typeof value.updatedAt === 'string' && value.updatedAt.trim() ? value.updatedAt : null,
  };
}

function normalizeDocument(input: unknown): DesktopConfigDocument {
  if (!isRecord(input)) {
    return createEmptyDesktopConfigDocument();
  }

  const sections = isRecord(input.sections) ? { ...input.sections } : {};
  const normalizedTheme = normalizeThemeSection(sections[DESKTOP_CONFIG_SECTION_THEME]);
  if (normalizedTheme) {
    sections[DESKTOP_CONFIG_SECTION_THEME] = normalizedTheme;
  } else {
    delete sections[DESKTOP_CONFIG_SECTION_THEME];
  }

  return {
    schemaVersion: 1,
    sections,
    updatedAt: typeof input.updatedAt === 'string' && input.updatedAt.trim() ? input.updatedAt : nowIso(),
  };
}

function readLegacySettingsSection(): Record<string, unknown> | null {
  const legacy = readCacheJson<Record<string, unknown>>(SETTINGS_STORAGE_KEY);
  return isRecord(legacy) ? legacy : null;
}

function readLegacyThemeSection(): DesktopThemeConfig | null {
  const mode = readCacheString(THEME_STORAGE_KEY);
  const explicit = readCacheString(THEME_EXPLICIT_STORAGE_KEY) === '1';
  if (!isThemeModeValue(mode)) {
    return null;
  }
  if (mode === 'system' && !explicit) {
    return null;
  }
  return {
    mode,
    explicit: explicit || mode === 'light' || mode === 'dark',
    updatedAt: null,
  };
}

function readLocalConfigDocument(): DesktopConfigDocument | null {
  const raw = readCacheString(DESKTOP_CONFIG_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return normalizeDocument(JSON.parse(raw) as DesktopConfigDocument);
  } catch {
    return null;
  }
}

function clearLegacyConfigKeys(): void {
  writeCacheString(SETTINGS_STORAGE_KEY, null);
  writeCacheString(THEME_STORAGE_KEY, null);
  writeCacheString(THEME_EXPLICIT_STORAGE_KEY, null);
}

function buildLegacyMigrationDocument(): DesktopConfigDocument | null {
  const sections: Record<string, unknown> = {};
  const settings = readLegacySettingsSection();
  if (settings) {
    sections[DESKTOP_CONFIG_SECTION_SETTINGS] = settings;
  }
  const theme = readLegacyThemeSection();
  if (theme) {
    sections[DESKTOP_CONFIG_SECTION_THEME] = theme;
  }
  if (Object.keys(sections).length === 0) {
    return null;
  }
  return {
    schemaVersion: 1,
    sections,
    updatedAt: nowIso(),
  };
}

async function loadNativeConfigDocument(): Promise<DesktopConfigDocument | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  const payload = await invoke<DesktopConfigDocument | null>('load_desktop_client_config');
  if (!payload) {
    return null;
  }
  return normalizeDocument(payload);
}

async function persistConfigDocument(document: DesktopConfigDocument): Promise<DesktopConfigDocument> {
  const normalized = normalizeDocument(document);
  cachedConfigDocument = normalized;
  writeCacheJson(DESKTOP_CONFIG_STORAGE_KEY, normalized);
  if (isTauriRuntime()) {
    await invoke<boolean>('save_desktop_client_config', { config: normalized });
  }
  return normalized;
}

export async function bootstrapDesktopConfigStore(): Promise<DesktopConfigDocument> {
  if (bootstrapped) {
    return cachedConfigDocument;
  }
  if (bootstrapPromise) {
    return bootstrapPromise;
  }

  bootstrapPromise = (async () => {
    const nativeDocument = await loadNativeConfigDocument();
    if (nativeDocument) {
      cachedConfigDocument = nativeDocument;
      writeCacheJson(DESKTOP_CONFIG_STORAGE_KEY, nativeDocument);
      bootstrapped = true;
      return nativeDocument;
    }

    const localDocument = readLocalConfigDocument();
    if (localDocument) {
      cachedConfigDocument = localDocument;
      bootstrapped = true;
      return localDocument;
    }

    const migratedDocument = buildLegacyMigrationDocument();
    if (migratedDocument) {
      const persisted = await persistConfigDocument(migratedDocument);
      clearLegacyConfigKeys();
      bootstrapped = true;
      return persisted;
    }

    cachedConfigDocument = createEmptyDesktopConfigDocument();
    bootstrapped = true;
    return cachedConfigDocument;
  })();

  try {
    return await bootstrapPromise;
  } finally {
    bootstrapPromise = null;
  }
}

export function getDesktopConfigDocument(): DesktopConfigDocument {
  return cachedConfigDocument;
}

export function readDesktopConfigSection<T>(section: string): T | null {
  const value = cachedConfigDocument.sections[section];
  return value === undefined ? null : (value as T);
}

export async function writeDesktopConfigSection(section: string, value: unknown): Promise<DesktopConfigDocument> {
  const nextSections = { ...cachedConfigDocument.sections };
  if (value === null || value === undefined) {
    delete nextSections[section];
  } else {
    nextSections[section] = value;
  }
  return persistConfigDocument({
    schemaVersion: 1,
    sections: nextSections,
    updatedAt: nowIso(),
  });
}

export function buildExplicitThemeConfig(mode: ThemeModeValue): DesktopThemeConfig {
  return {
    mode,
    explicit: true,
    updatedAt: nowIso(),
  };
}
