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

export type RequiredResolvedMenuUiConfig = {
  displayName: string;
  group: string | null;
  iconKey: string;
};

export type ResolvedComposerControlOption = {
  value: string;
  label: string;
  description: string;
};

export type ResolvedComposerControlConfig = {
  controlKey: string;
  displayName: string;
  controlType: string;
  iconKey: string | null;
  sortOrder: number;
  options: ResolvedComposerControlOption[];
  metadata: Record<string, unknown>;
  config: Record<string, unknown>;
};

export type ResolvedComposerShortcutConfig = {
  shortcutKey: string;
  displayName: string;
  description: string;
  template: string;
  iconKey: string | null;
  tone: string | null;
  sortOrder: number;
  metadata: Record<string, unknown>;
  config: Record<string, unknown>;
};

export type ResolvedInputComposerConfig = {
  topBarControls: ResolvedComposerControlConfig[];
  footerShortcuts: ResolvedComposerShortcutConfig[];
};

export type ResolvedWelcomeQuickActionConfig = {
  label: string;
  prompt: string;
  iconKey: string | null;
};

export type ResolvedWelcomePageConfig = {
  enabled: boolean;
  kolName: string;
  expertName: string;
  slogan: string;
  avatarUrl: string;
  primaryColor: string;
  backgroundImageUrl: string;
  description: string;
  expertiseAreas: string[];
  targetAudience: string;
  quickActions: ResolvedWelcomeQuickActionConfig[];
  disclaimer: string;
};

const DEFAULT_ENABLED_MENU_KEYS = [
  'chat',
  'cron',
  'investment-experts',
  'stock-market',
  'fund-market',
  'lobster-store',
  'skill-store',
  'finance-skills',
  'foundation-skills',
  'mcp-store',
  'memory',
  'data-connections',
  'im-bots',
  'security',
  'task-center',
] as const;

const DEFAULT_MENU_UI_CONFIG: Record<string, RequiredResolvedMenuUiConfig> = {
  chat: { displayName: '智能对话', group: '工作台', iconKey: 'chat' },
  cron: { displayName: '定时任务', group: '工作台', iconKey: 'cron' },
  'investment-experts': { displayName: '智能投资专家', group: '工作台', iconKey: 'investment-experts' },
  'stock-market': { displayName: '股票市场', group: '市场', iconKey: 'stock-market' },
  'fund-market': { displayName: '基金市场', group: '市场', iconKey: 'fund-market' },
  'lobster-store': { displayName: '龙虾商店', group: '商店', iconKey: 'lobster-store' },
  'skill-store': { displayName: '技能商店', group: '商店', iconKey: 'skill-store' },
  'finance-skills': { displayName: '财经技能', group: '商店', iconKey: 'finance-skills' },
  'foundation-skills': { displayName: '基础技能', group: '商店', iconKey: 'foundation-skills' },
  'mcp-store': { displayName: 'MCP商店', group: '商店', iconKey: 'mcp-store' },
  memory: { displayName: '记忆管理', group: '工作台', iconKey: 'memory' },
  'data-connections': { displayName: '数据连接', group: '工作台', iconKey: 'data-connections' },
  'im-bots': { displayName: 'IM机器人', group: '工作台', iconKey: 'im-bots' },
  security: { displayName: '安全防护', group: '工作台', iconKey: 'security' },
  'task-center': { displayName: '历史任务', group: null, iconKey: 'task-center' },
  settings: { displayName: '设置', group: null, iconKey: 'settings' },
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

function resolveComposerControlConfigs(value: unknown): ResolvedComposerControlConfig[] {
  return asArray(value)
    .map((item) => {
      const entry = asObject(item);
      const controlKey = String(entry.control_key ?? entry.controlKey ?? '').trim();
      if (!controlKey) return null;
      return {
        controlKey,
        displayName: String(entry.display_name || entry.displayName || '').trim() || controlKey,
        controlType: String(entry.control_type || entry.controlType || 'static').trim() || 'static',
        iconKey: String(entry.icon_key || entry.iconKey || '').trim() || null,
        sortOrder: Number(entry.sort_order || entry.sortOrder || 100) || 100,
        metadata: asObject(entry.metadata),
        config: asObject(entry.config),
        options: asArray(entry.options)
          .map((option) => {
            const rawOption = asObject(option);
            const value = String(rawOption.option_value ?? rawOption.optionValue ?? rawOption.value ?? '').trim();
            if (!value) return null;
            return {
              value,
              label: String(rawOption.label || value).trim() || value,
              description: String(rawOption.description || rawOption.detail || '').trim(),
            };
          })
          .filter((option): option is ResolvedComposerControlOption => Boolean(option)),
      };
    })
    .filter((item): item is ResolvedComposerControlConfig => Boolean(item))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.controlKey.localeCompare(right.controlKey, 'zh-CN'));
}

function resolveComposerShortcutConfigs(value: unknown): ResolvedComposerShortcutConfig[] {
  return asArray(value)
    .map((item) => {
      const entry = asObject(item);
      const shortcutKey = String(entry.shortcut_key ?? entry.shortcutKey ?? '').trim();
      if (!shortcutKey) return null;
      return {
        shortcutKey,
        displayName: String(entry.display_name || entry.displayName || '').trim() || shortcutKey,
        description: String(entry.description || '').trim(),
        template: String(entry.template || entry.template_text || '').trim(),
        iconKey: String(entry.icon_key || entry.iconKey || '').trim() || null,
        tone: String(entry.tone || '').trim() || null,
        sortOrder: Number(entry.sort_order || entry.sortOrder || 100) || 100,
        metadata: asObject(entry.metadata),
        config: asObject(entry.config),
      };
    })
    .filter((item): item is ResolvedComposerShortcutConfig => Boolean(item))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.shortcutKey.localeCompare(right.shortcutKey, 'zh-CN'));
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
    return [...DEFAULT_ENABLED_MENU_KEYS];
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

export function resolveRequiredEnabledMenuKeys(config: Record<string, unknown> | null | undefined): string[] {
  const resolved = resolveEnabledMenuKeys(config);
  if (!resolved || resolved.length === 0) {
    return [...DEFAULT_ENABLED_MENU_KEYS];
  }
  return resolved;
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

export function resolveRequiredMenuUiConfig(
  config: Record<string, unknown> | null | undefined,
  requiredMenuKeys: string[],
): Record<string, RequiredResolvedMenuUiConfig> {
  const resolved = resolveMenuUiConfig(config);
  if (!resolved) {
    return Object.fromEntries(
      normalizeMenuKeys(requiredMenuKeys)
        .map((menuKey) => [menuKey, DEFAULT_MENU_UI_CONFIG[menuKey]])
        .filter((entry): entry is [string, RequiredResolvedMenuUiConfig] => Boolean(entry[1])),
    );
  }

  const entries: Record<string, RequiredResolvedMenuUiConfig> = {};
  for (const menuKey of normalizeMenuKeys(requiredMenuKeys)) {
    const item = resolved[menuKey] ?? DEFAULT_MENU_UI_CONFIG[menuKey];
    if (!item) {
      throw new Error(`OEM runtime menu config is missing for "${menuKey}"`);
    }

    const displayName = String(item.displayName || '').trim();
    if (!displayName) {
      throw new Error(`OEM runtime menu displayName is missing for "${menuKey}"`);
    }

    const iconKey = String(item.iconKey || '').trim();
    if (!iconKey) {
      throw new Error(`OEM runtime menu iconKey is missing for "${menuKey}"`);
    }

    const group = String(item.group || '').trim();
    entries[menuKey] = {
      displayName,
      group: group || null,
      iconKey,
    };
  }

  return entries;
}

export function resolveInputComposerConfig(
  config: Record<string, unknown> | null | undefined,
): ResolvedInputComposerConfig | null {
  const root = asObject(config);
  const inputConfig = asObject(asObject(asObject(root.surfaces).input).config);
  const rootTopBarControls = resolveComposerControlConfigs(root.composer_control_bindings);
  const rootFooterShortcuts = resolveComposerShortcutConfigs(root.composer_shortcut_bindings);
  const topBarControls = rootTopBarControls.length
    ? rootTopBarControls
    : resolveComposerControlConfigs(inputConfig.top_bar_controls);
  const footerShortcuts = rootFooterShortcuts.length
    ? rootFooterShortcuts
    : resolveComposerShortcutConfigs(inputConfig.footer_shortcuts);
  if (!topBarControls.length && !footerShortcuts.length) {
    return null;
  }
  return {
    topBarControls,
    footerShortcuts,
  };
}

export function resolveWelcomePageConfig(
  config: Record<string, unknown> | null | undefined,
): ResolvedWelcomePageConfig | null {
  const root = asObject(config);
  const welcomeSurface = asObject(asObject(root.surfaces).welcome);
  if (Object.keys(welcomeSurface).length === 0) {
    return null;
  }

  const welcomeConfig = asObject(welcomeSurface.config);
  const quickActions = asArray(welcomeConfig.quick_actions ?? welcomeConfig.quickActions)
    .map((item) => {
      const entry = asObject(item);
      const label = String(entry.label || entry.display_name || entry.displayName || '').trim();
      const prompt = String(entry.prompt || entry.template || entry.template_text || '').trim();
      if (!label && !prompt) return null;
      return {
        label,
        prompt,
        iconKey: String(entry.icon_key || entry.iconKey || entry.icon || '').trim() || null,
      };
    })
    .filter((item): item is ResolvedWelcomeQuickActionConfig => Boolean(item));

  return {
    enabled: welcomeSurface.enabled !== false,
    kolName: String(welcomeConfig.kol_name || welcomeConfig.kolName || '').trim(),
    expertName: String(welcomeConfig.expert_name || welcomeConfig.expertName || '').trim(),
    slogan: String(welcomeConfig.slogan || '').trim(),
    avatarUrl: String(welcomeConfig.avatar_url || welcomeConfig.avatar || welcomeConfig.avatarUrl || '').trim(),
    primaryColor: String(welcomeConfig.primary_color || welcomeConfig.primaryColor || '').trim(),
    backgroundImageUrl: String(
      welcomeConfig.background_image_url || welcomeConfig.backgroundImageUrl || welcomeConfig.backgroundImage || '',
    ).trim(),
    description: String(welcomeConfig.description || '').trim(),
    expertiseAreas: asStringArray(welcomeConfig.expertise_areas || welcomeConfig.expertiseAreas),
    targetAudience: String(welcomeConfig.target_audience || welcomeConfig.targetAudience || '').trim(),
    quickActions,
    disclaimer: String(welcomeConfig.disclaimer || '').trim(),
  };
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
