import { loadOemRuntimeSnapshot, saveOemRuntimeSnapshot, syncOemRuntimeSnapshot } from './tauri-runtime-config';

export type BrandRuntimeConfig = {
  brandId: string;
  publishedVersion: number;
  config: Record<string, unknown>;
};

export type ResolvedMenuUiConfig = {
  displayName?: string;
  group?: string;
  iconKey?: string;
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

function resolveMenuCatalogUiDefaults(
  root: Record<string, unknown>,
): Record<string, ResolvedMenuUiConfig> {
  const catalog = asArray(root.menu_catalog);
  const entries: Record<string, ResolvedMenuUiConfig> = {};
  for (const entry of catalog) {
    const item = asObject(entry);
    const metadata = asObject(item.metadata);
    const key = String(item.menu_key ?? item.menuKey ?? '').trim();
    if (!key) continue;
    const displayName = String(item.display_name || item.displayName || '').trim();
    const group = String(metadata.group_label || metadata.groupLabel || metadata.group || item.group || '').trim();
    const iconKey = String(item.icon_key || item.iconKey || '').trim();
    entries[key] = {
      ...(displayName ? {displayName} : {}),
      ...(group ? {group} : {}),
      ...(iconKey ? {iconKey} : {}),
    };
  }
  return entries;
}

function resolveEnabledSkillSlugs(root: Record<string, unknown>): Set<string> {
  const skillBindings = asArray(root.skill_bindings);
  const bound = skillBindings
    .filter((item) => asObject(item).enabled !== false)
    .map((item) => String(asObject(item).skill_slug ?? asObject(item).skillSlug ?? '').trim())
    .filter(Boolean);
  const fallback = asStringArray(asObject(root.capabilities).skills);
  return new Set(bound.length ? bound : fallback);
}

function resolveEnabledMcpKeys(root: Record<string, unknown>): Set<string> {
  const mcpBindings = asArray(root.mcp_bindings);
  const bound = mcpBindings
    .filter((item) => asObject(item).enabled !== false)
    .map((item) => String(asObject(item).mcp_key ?? asObject(item).mcpKey ?? '').trim())
    .filter(Boolean);
  const fallback = asStringArray(asObject(root.capabilities).mcp_servers);
  return new Set(bound.length ? bound : fallback);
}

function resolveEnabledModelRefs(root: Record<string, unknown>): Set<string> {
  const modelBindings = asArray(root.model_bindings);
  const bound = modelBindings
    .filter((item) => asObject(item).enabled !== false)
    .map((item) => String(asObject(item).model_ref ?? asObject(item).modelRef ?? '').trim())
    .filter(Boolean);
  const modelsConfig = asObject(asObject(root.capabilities).models);
  const fallback = [
    ...asArray(modelsConfig.entries).map((item) => String(asObject(item).ref ?? '').trim()),
    ...asStringArray(modelsConfig.recommended),
    String(modelsConfig.default || '').trim(),
  ].filter(Boolean);
  return new Set(bound.length ? bound : fallback);
}

function matchesMenuRequirements(
  menuConfig: Record<string, unknown>,
  availability: {
    skills: Set<string>;
    mcps: Set<string>;
    models: Set<string>;
  },
): boolean {
  const requires = asObject(menuConfig.requires);
  const skillSlug = String(
    requires.skill_slug || requires.skillSlug || menuConfig.requires_skill_slug || menuConfig.requiresSkillSlug || '',
  ).trim();
  const mcpKey = String(
    requires.mcp_key || requires.mcpKey || menuConfig.requires_mcp_key || menuConfig.requiresMcpKey || '',
  ).trim();
  const modelRef = String(
    requires.model_ref || requires.modelRef || menuConfig.requires_model_ref || menuConfig.requiresModelRef || '',
  ).trim();
  if (skillSlug && !availability.skills.has(skillSlug)) return false;
  if (mcpKey && !availability.mcps.has(mcpKey)) return false;
  if (modelRef && !availability.models.has(modelRef)) return false;
  return true;
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
  const availability = {
    skills: resolveEnabledSkillSlugs(root),
    mcps: resolveEnabledMcpKeys(root),
    models: resolveEnabledModelRefs(root),
  };

  for (const key of keys) {
    const binding = menuBindings.find((item) => {
      const entry = asObject(item);
      return normalizeMenuKeys([String(entry.menu_key ?? entry.menuKey ?? '').trim()]).includes(key);
    });
    if (binding && !matchesMenuRequirements(asObject(asObject(binding).config), availability)) {
      continue;
    }
    const surface = asObject(surfaces[key]);
    if (Object.keys(surface).length > 0 && surface.enabled === false) {
      continue;
    }
    visible.add(key);
  }

  return Array.from(visible);
}

export function resolveMenuDisplayNames(config: Record<string, unknown> | null | undefined): Record<string, string> | null {
  const resolved = resolveMenuUiConfig(config);
  if (!resolved) return null;
  const displayNames = Object.fromEntries(
    Object.entries(resolved)
      .map(([key, value]) => [key, String(value.displayName || '').trim()])
      .filter((entry) => Boolean(entry[1])),
  );
  return Object.keys(displayNames).length ? displayNames : null;
}

export function resolveMenuUiConfig(config: Record<string, unknown> | null | undefined): Record<string, ResolvedMenuUiConfig> | null {
  const root = asObject(config);
  const menuBindings = asArray(root.menu_bindings);
  const entries: Record<string, ResolvedMenuUiConfig> = resolveMenuCatalogUiDefaults(root);
  if (!menuBindings.length && Object.keys(entries).length === 0) {
    return null;
  }

  for (const entry of menuBindings) {
    const item = asObject(entry);
    const config = asObject(item.config);
    const displayName = String(config.display_name || config.displayName || '').trim();
    const group = String(config.group_label || config.groupLabel || config.group || '').trim();
    const iconKey = String(config.icon_key || config.iconKey || '').trim();
    for (const key of normalizeMenuKeys([String(item.menu_key ?? item.menuKey ?? '').trim()])) {
      if (!key) continue;
      entries[key] = {
        ...(entries[key] || {}),
        ...(displayName ? {displayName} : {}),
        ...(group ? {group} : {}),
        ...(iconKey ? {iconKey} : {}),
      };
    }
  }

  return Object.keys(entries).length ? entries : null;
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
