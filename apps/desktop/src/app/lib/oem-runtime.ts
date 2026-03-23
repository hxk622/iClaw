import { loadOemRuntimeSnapshot, saveOemRuntimeSnapshot, syncOemRuntimeSnapshot } from './tauri-runtime-config';

export type BrandRuntimeConfig = {
  brandId: string;
  publishedVersion: number;
  config: Record<string, unknown>;
};

type PublicBrandConfigResponse = {
  success?: boolean;
  data?: {
    brand?: {
      brandId?: string | null;
      displayName?: string | null;
    } | null;
    app?: {
      appName?: string | null;
    } | null;
    publishedVersion?: number | null;
    config?: Record<string, unknown> | null;
  } | null;
};

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${path}`;
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asStringArray(value: unknown): string[] {
  const seen = new Set<string>();
  for (const item of asArray(value)) {
    if (typeof item !== 'string') continue;
    const normalized = item.trim();
    if (!normalized) continue;
    seen.add(normalized);
  }
  return Array.from(seen);
}

const LEGACY_MENU_KEY_MAP: Record<string, string[]> = {
  workspace: ['chat'],
  skills: ['skill-store'],
  mcp: ['mcp-store'],
  settings: ['settings'],
  assets: [],
  models: [],
};

function normalizeMenuKeys(keys: string[]): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const key of keys) {
    const mapped = LEGACY_MENU_KEY_MAP[key] ?? [key];
    for (const nextKey of mapped) {
      const trimmed = nextKey.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      normalized.push(trimmed);
    }
  }
  return normalized;
}

function normalizeBrandRuntimeConfig(
  data: PublicBrandConfigResponse['data'],
  fallbackBrandId: string,
): BrandRuntimeConfig | null {
  if (!data?.config || typeof data.config !== 'object' || Array.isArray(data.config)) {
    return null;
  }

  return {
    brandId: String(data.brand?.brandId || data.app?.appName || fallbackBrandId).trim() || fallbackBrandId,
    publishedVersion:
      typeof data.publishedVersion === 'number' && Number.isFinite(data.publishedVersion) ? data.publishedVersion : 0,
    config: data.config,
  };
}

export async function loadPublishedBrandRuntimeConfig(input: {
  authBaseUrl: string;
  brandId: string;
}): Promise<BrandRuntimeConfig> {
  const brandId = input.brandId.trim();
  const authBaseUrl = input.authBaseUrl.trim();
  if (!brandId || !authBaseUrl) {
    throw new Error('brand runtime config requires authBaseUrl and brandId');
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(
      joinUrl(authBaseUrl, `/portal/public-config?app_name=${encodeURIComponent(brandId)}`),
      {
        method: 'GET',
        signal: controller.signal,
      },
    );
    const payload = (await response.json().catch(() => ({}))) as PublicBrandConfigResponse;
    const normalized = normalizeBrandRuntimeConfig(payload?.data, brandId);
    if (!response.ok || !payload?.success || !normalized) {
      throw new Error(`failed to load OEM runtime config (${response.status})`);
    }
    return normalized;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function loadBrandRuntimeConfigWithFallback(input: {
  authBaseUrl: string;
  brandId: string;
}): Promise<BrandRuntimeConfig | null> {
  try {
    const runtimeConfig = await loadPublishedBrandRuntimeConfig(input);
    if (isTauriRuntime()) {
      await saveOemRuntimeSnapshot(runtimeConfig).catch(() => false);
    }
    return runtimeConfig;
  } catch (error) {
    if (!isTauriRuntime()) {
      throw error;
    }
    return loadOemRuntimeSnapshot();
  }
}

export function resolveEnabledMenuKeys(config: Record<string, unknown> | null | undefined): string[] | null {
  const root = asObject(config);
  const menuBindings = asArray(root.menu_bindings);
  const capabilityMenus = asStringArray(asObject(root.capabilities).menus);
  if (!menuBindings.length && !capabilityMenus.length) {
    return null;
  }

  const surfaces = asObject(root.surfaces);
  const orderedFromBindings = menuBindings
    .filter((item) => asObject(item).enabled !== false)
    .sort((left, right) => {
      const leftOrder = Number(asObject(left).sort_order ?? asObject(left).sortOrder ?? 100);
      const rightOrder = Number(asObject(right).sort_order ?? asObject(right).sortOrder ?? 100);
      return leftOrder - rightOrder;
    })
    .map((item) => String(asObject(item).menu_key ?? asObject(item).menuKey ?? '').trim())
    .filter(Boolean);
  const keys = normalizeMenuKeys(orderedFromBindings.length ? orderedFromBindings : capabilityMenus);
  const visible = new Set<string>();

  for (const key of keys) {
    const surface = asObject(surfaces[key]);
    if (Object.keys(surface).length > 0 && surface.enabled === false) {
      continue;
    }
    visible.add(key);
  }

  return Array.from(visible);
}

export function resolveMenuDisplayNames(config: Record<string, unknown> | null | undefined): Record<string, string> | null {
  const root = asObject(config);
  const menuBindings = asArray(root.menu_bindings);
  if (!menuBindings.length) {
    return null;
  }

  const labels: Record<string, string> = {};
  for (const entry of menuBindings) {
    const item = asObject(entry);
    const config = asObject(item.config);
    const displayName = String(config.display_name || config.displayName || '').trim();
    if (!displayName) continue;
    for (const key of normalizeMenuKeys([String(item.menu_key ?? item.menuKey ?? '').trim()])) {
      if (!key || labels[key]) continue;
      labels[key] = displayName;
    }
  }

  return Object.keys(labels).length ? labels : null;
}

export async function syncPublishedBrandRuntimeSnapshot(input: {
  authBaseUrl: string;
  brandId: string;
}): Promise<boolean> {
  const brandId = input.brandId.trim();
  const authBaseUrl = input.authBaseUrl.trim();
  if (!brandId || !authBaseUrl) {
    return false;
  }

  if (isTauriRuntime()) {
    return syncOemRuntimeSnapshot({ authBaseUrl, brandId });
  }

  try {
    const runtimeConfig = await loadPublishedBrandRuntimeConfig({ authBaseUrl, brandId });
    return saveOemRuntimeSnapshot({
      brandId: runtimeConfig.brandId,
      publishedVersion: runtimeConfig.publishedVersion,
      config: runtimeConfig.config,
    });
  } catch {
    return false;
  }
}
