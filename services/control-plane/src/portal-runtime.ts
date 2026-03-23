import type {PortalAppAssetRecord, PortalAppDetail, PortalJsonObject} from './portal-domain.ts';
import {stripPortalDesktopReleaseConfig} from './portal-desktop-release.ts';

function asObject(value: unknown): PortalJsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as PortalJsonObject;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function compareBySortOrder(left: {sortOrder: number}, right: {sortOrder: number}): number {
  return left.sortOrder - right.sortOrder;
}

const LEGACY_MENU_KEY_MAP: Record<string, string[]> = {
  workspace: ['chat'],
  skills: ['skill-store'],
  mcp: ['mcp-store'],
  settings: ['settings'],
  assets: [],
  models: [],
};

function normalizePortalMenuKeys(keys: string[]): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const key of keys) {
    const mapped = LEGACY_MENU_KEY_MAP[key] || [key];
    for (const nextKey of mapped) {
      const trimmed = nextKey.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      normalized.push(trimmed);
    }
  }
  return normalized;
}

export function buildPortalPublicConfig(
  detail: PortalAppDetail,
  options: {
    surfaceKey?: string | null;
    assetUrlResolver?: (asset: PortalAppAssetRecord) => string | null;
  } = {},
): {
  brand: {
    brandId: string;
    displayName: string;
    productName: string;
    tenantKey: string;
    status: string;
  };
  app: {
    appName: string;
    displayName: string;
    description: string | null;
    status: string;
    defaultLocale: string;
  };
  publishedVersion: number;
  config: PortalJsonObject;
  surfaceKey: string | null;
  surfaceConfig: PortalJsonObject | null;
} {
  const existingConfig = stripPortalDesktopReleaseConfig(cloneJson(asObject(detail.app.config)));
  const existingAssets = asObject(existingConfig.assets);
  const existingCapabilities = asObject(existingConfig.capabilities);
  const existingBrandMeta = {
    ...asObject(existingConfig.brand_meta),
    ...asObject(existingConfig.brandMeta),
  };
  const existingStorage = asObject(existingConfig.storage);
  const resolveAssetUrl = options.assetUrlResolver || (() => null);
  const surfaceKey = typeof options.surfaceKey === 'string' ? options.surfaceKey.trim() : '';
  const surfaces = asObject(existingConfig.surfaces);
  const surfaceEntry = surfaceKey ? asObject(surfaces[surfaceKey]) : null;

  const skillBindings = detail.skillBindings
    .filter((item) => item.enabled)
    .sort(compareBySortOrder)
    .map((item) => ({
      skill_slug: item.skillSlug,
      sort_order: item.sortOrder,
      config: cloneJson(item.config),
    }));
  const mcpBindings = detail.mcpBindings
    .filter((item) => item.enabled)
    .sort(compareBySortOrder)
    .map((item) => ({
      mcp_key: item.mcpKey,
      sort_order: item.sortOrder,
      config: cloneJson(item.config),
    }));
  const menuBindings = detail.menuBindings
    .filter((item) => item.enabled)
    .sort(compareBySortOrder)
    .flatMap((item) =>
      normalizePortalMenuKeys([item.menuKey]).map((menuKey) => ({
        menu_key: menuKey,
        sort_order: item.sortOrder,
        config: cloneJson(item.config),
      })),
    )
    .filter((item, index, items) => items.findIndex((entry) => entry.menu_key === item.menu_key) === index);
  const modelBindings = detail.modelBindings
    .filter((item) => item.enabled && item.model?.active !== false)
    .sort(compareBySortOrder)
    .map((item) => ({
      model_ref: item.modelRef,
      sort_order: item.sortOrder,
      recommended: asObject(item.config).recommended === true,
      default: asObject(item.config).default === true,
      config: cloneJson(item.config),
      entry: item.model
        ? {
            ref: item.model.ref,
            label: item.model.label,
            providerId: item.model.providerId,
            modelId: item.model.modelId,
            api: item.model.api,
            baseUrl: item.model.baseUrl,
            useRuntimeOpenai: item.model.useRuntimeOpenai,
            authHeader: item.model.authHeader,
            reasoning: item.model.reasoning,
            input: cloneJson(item.model.input),
            contextWindow: item.model.contextWindow,
            maxTokens: item.model.maxTokens,
          }
        : null,
    }))
    .filter((item) => item.entry);
  const modelEntries = modelBindings.map((item) => cloneJson(item.entry));
  const modelRefs = modelBindings.map((item) => item.model_ref);
  const existingModelConfig = asObject(existingCapabilities.models);
  const configuredDefaultModel = String(existingModelConfig.default || '').trim();
  const defaultModelRef =
    modelBindings.find((item) => item.default)?.model_ref ||
    (configuredDefaultModel && modelRefs.includes(configuredDefaultModel) ? configuredDefaultModel : '') ||
    modelRefs[0] ||
    null;
  const recommendedModels = modelBindings.filter((item) => item.recommended).map((item) => item.model_ref);
  const brandId = detail.app.appName;
  const tenantKey =
    String(existingBrandMeta.tenant_key || existingBrandMeta.tenantKey || existingStorage.namespace || brandId).trim() ||
    brandId;
  const productName =
    String(existingBrandMeta.product_name || existingBrandMeta.productName || existingConfig.productName || detail.app.displayName).trim() ||
    detail.app.displayName;

  const assetEntries = detail.assets
    .map((asset) => {
      const resolvedUrl = resolveAssetUrl(asset);
      return [
        asset.assetKey,
        {
          url: resolvedUrl,
          content_type: asset.contentType,
          object_key: asset.objectKey,
          storage_provider: asset.storageProvider || null,
          metadata: cloneJson(asset.metadata),
        },
      ] as const;
    })
    .filter((entry) => Boolean(entry[1].url || entry[1].object_key));

  return {
    brand: {
      brandId,
      displayName: detail.app.displayName,
      productName,
      tenantKey,
      status: detail.app.status,
    },
    app: {
      appName: detail.app.appName,
      displayName: detail.app.displayName,
      description: detail.app.description,
      status: detail.app.status,
      defaultLocale: detail.app.defaultLocale,
    },
    publishedVersion: detail.releases[0]?.version || 0,
    config: {
      ...existingConfig,
      brand_meta: {
        ...existingBrandMeta,
        brand_id: brandId,
        tenant_key: tenantKey,
        display_name: detail.app.displayName,
        product_name: productName,
        legal_name: String(existingBrandMeta.legal_name || detail.app.displayName).trim() || detail.app.displayName,
        storage_namespace: String(existingBrandMeta.storage_namespace || existingStorage.namespace || brandId).trim() || brandId,
      },
      assets: {
        ...existingAssets,
        ...Object.fromEntries(assetEntries),
      },
      capabilities: {
        ...existingCapabilities,
        skills: skillBindings.map((item) => item.skill_slug),
        mcp_servers: mcpBindings.map((item) => item.mcp_key),
        menus: menuBindings.map((item) => item.menu_key),
        models: {
          default: defaultModelRef,
          recommended: recommendedModels,
          entries: modelEntries,
        },
      },
      skill_bindings: skillBindings,
      mcp_bindings: mcpBindings,
      model_bindings: modelBindings.map((item) => ({
        model_ref: item.model_ref,
        sort_order: item.sort_order,
        recommended: item.recommended,
        default: item.default,
        config: cloneJson(item.config),
      })),
      menu_bindings: menuBindings,
    },
    surfaceKey: surfaceKey || null,
    surfaceConfig: surfaceEntry ? asObject(surfaceEntry.config) : null,
  };
}
