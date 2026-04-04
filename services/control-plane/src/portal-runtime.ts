import type {
  PortalAppAssetRecord,
  PortalAppDetail,
  PortalComposerControlRecord,
  PortalComposerShortcutRecord,
  PortalJsonObject,
  PortalMenuRecord,
  PortalRechargePackageRecord,
} from './portal-domain.ts';
import {stripPortalDesktopReleaseConfig} from './portal-desktop-release.ts';
import {resolveRechargePaymentMethods} from './recharge-payment-methods.ts';

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

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asStringArray(value: unknown): string[] {
  const seen = new Set<string>();
  for (const item of asArray(value)) {
    if (typeof item !== 'string') continue;
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) continue;
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
const SYSTEM_MANAGED_MENU_KEYS = new Set(['settings']);

function normalizePortalMenuKeys(keys: string[]): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const key of keys) {
    const mapped = LEGACY_MENU_KEY_MAP[key] || [key];
    for (const nextKey of mapped) {
      const trimmed = nextKey.trim();
      if (!trimmed || SYSTEM_MANAGED_MENU_KEYS.has(trimmed) || seen.has(trimmed)) continue;
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
    menuCatalog?: PortalMenuRecord[];
    composerControlCatalog?: PortalComposerControlRecord[];
    composerShortcutCatalog?: PortalComposerShortcutRecord[];
    rechargePackageCatalog?: PortalRechargePackageRecord[];
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
  const menuCatalog = Array.isArray(options.menuCatalog) ? options.menuCatalog : [];
  const composerControlCatalog = Array.isArray(options.composerControlCatalog) ? options.composerControlCatalog : [];
  const composerShortcutCatalog = Array.isArray(options.composerShortcutCatalog) ? options.composerShortcutCatalog : [];
  const rechargePackageCatalog = Array.isArray(options.rechargePackageCatalog) ? options.rechargePackageCatalog : [];
  const surfaceKey = typeof options.surfaceKey === 'string' ? options.surfaceKey.trim() : '';
  const surfaces = asObject(existingConfig.surfaces);
  const inputSurface = asObject(surfaces.input);
  const inputSurfaceConfig = asObject(inputSurface.config);
  const rechargeSurface = asObject(surfaces.recharge);
  const rechargeSurfaceConfig = asObject(rechargeSurface.config);
  const hasExplicitRechargePaymentMethods =
    Array.isArray(rechargeSurfaceConfig.payment_methods) || Array.isArray(rechargeSurfaceConfig.paymentMethods);

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
  const publicMenuCatalog = menuCatalog
    .filter((item) => item.active && !SYSTEM_MANAGED_MENU_KEYS.has(item.menuKey))
    .map((item) => ({
      menu_key: item.menuKey,
      display_name: item.displayName,
      category: item.category,
      route_key: item.routeKey,
      icon_key: item.iconKey,
      metadata: cloneJson(item.metadata),
    }));
  const publicComposerControls = detail.composerControlBindings
    .filter((item) => item.enabled)
    .sort(compareBySortOrder)
    .map((item) => {
      const catalog = composerControlCatalog.find((entry) => entry.controlKey === item.controlKey && entry.active);
      if (!catalog) return null;
      const bindingConfig = asObject(item.config);
      const allowedOptionValues = asStringArray(bindingConfig.allowed_option_values ?? bindingConfig.allowedOptionValues);
      const options = catalog.options
        .filter((entry) => entry.active)
        .sort((left, right) => left.sortOrder - right.sortOrder || left.optionValue.localeCompare(right.optionValue, 'zh-CN'))
        .filter((entry) => allowedOptionValues.length === 0 || allowedOptionValues.includes(entry.optionValue))
        .map((entry) => ({
          option_value: entry.optionValue,
          label: entry.label,
          description: entry.description,
          sort_order: entry.sortOrder,
          metadata: cloneJson(entry.metadata),
        }));
      return {
        control_key: catalog.controlKey,
        display_name: String(bindingConfig.display_name || bindingConfig.displayName || catalog.displayName).trim() || catalog.displayName,
        control_type: catalog.controlType,
        icon_key: String(bindingConfig.icon_key || bindingConfig.iconKey || catalog.iconKey || '').trim() || null,
        sort_order: item.sortOrder,
        metadata: cloneJson(catalog.metadata),
        config: cloneJson(bindingConfig),
        options,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const publicComposerShortcuts = detail.composerShortcutBindings
    .filter((item) => item.enabled)
    .sort(compareBySortOrder)
    .map((item) => {
      const catalog = composerShortcutCatalog.find((entry) => entry.shortcutKey === item.shortcutKey && entry.active);
      if (!catalog) return null;
      const bindingConfig = asObject(item.config);
      return {
        shortcut_key: catalog.shortcutKey,
        display_name:
          String(bindingConfig.display_name || bindingConfig.displayName || catalog.displayName).trim() || catalog.displayName,
        description:
          String(bindingConfig.description || bindingConfig.subtitle || catalog.description).trim() || catalog.description,
        template:
          String(bindingConfig.template || bindingConfig.template_text || catalog.template).trim() || catalog.template,
        icon_key: String(bindingConfig.icon_key || bindingConfig.iconKey || catalog.iconKey || '').trim() || null,
        tone: String(bindingConfig.tone || catalog.tone || '').trim() || null,
        sort_order: item.sortOrder,
        metadata: cloneJson(catalog.metadata),
        config: cloneJson(bindingConfig),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const platformRechargePackages = rechargePackageCatalog
    .filter((item) => item.active !== false)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.packageId.localeCompare(right.packageId, 'zh-CN'));
  const enabledRechargeBindings = detail.rechargePackageBindings
    .filter((item) => item.enabled)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.packageId.localeCompare(right.packageId, 'zh-CN'));
  const hasAppRechargeBindings = enabledRechargeBindings.length > 0;
  const publicRechargePackages = (hasAppRechargeBindings
    ? enabledRechargeBindings
        .map((binding) => {
          const catalog = platformRechargePackages.find((item) => item.packageId === binding.packageId);
          if (!catalog) return null;
          return {
            package_id: catalog.packageId,
            package_name: catalog.packageName,
            credits: catalog.credits,
            bonus_credits: catalog.bonusCredits,
            total_credits: catalog.credits + catalog.bonusCredits,
            amount_cny_fen: catalog.amountCnyFen,
            sort_order: binding.sortOrder,
            recommended: binding.recommended === true,
            is_default: binding.default === true,
            metadata: {
              ...cloneJson(catalog.metadata),
              ...cloneJson(binding.config),
              source_layer: 'oem_binding',
            },
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    : platformRechargePackages.map((item) => ({
        package_id: item.packageId,
        package_name: item.packageName,
        credits: item.credits,
        bonus_credits: item.bonusCredits,
        total_credits: item.credits + item.bonusCredits,
        amount_cny_fen: item.amountCnyFen,
        sort_order: item.sortOrder,
        recommended: item.recommended,
        is_default: item.default,
        metadata: {
          ...cloneJson(item.metadata),
          source_layer: 'platform_catalog',
        },
      })))
    .sort((left, right) => left.sort_order - right.sort_order || left.package_id.localeCompare(right.package_id, 'zh-CN'));
  const resolvedRechargePaymentMethods = resolveRechargePaymentMethods(detail.app.config);
  const publicRechargePaymentMethods = resolvedRechargePaymentMethods
    .filter((item) => item.enabled)
    .map((item) => ({
      provider: item.provider,
      sort_order: item.sortOrder,
      is_default: item.default,
      label: item.label,
      metadata: {
        ...cloneJson(item.metadata),
        source_layer: item.sourceLayer,
      },
    }));
  const rechargePaymentMethodsSourceLayer =
    resolvedRechargePaymentMethods[0]?.sourceLayer || (hasExplicitRechargePaymentMethods ? 'oem_binding' : 'platform_default');
  const nextInputSurfaceConfig = {
    ...inputSurfaceConfig,
    top_bar_controls: publicComposerControls,
    footer_shortcuts: publicComposerShortcuts,
  };
  const nextRechargeSurfaceConfig = {
    ...rechargeSurfaceConfig,
    packages: publicRechargePackages,
    payment_methods: publicRechargePaymentMethods,
    payment_methods_source_layer: rechargePaymentMethodsSourceLayer,
    source_layer: hasAppRechargeBindings ? 'oem_binding' : 'platform_catalog',
  };
  const resolvedSurfaces: PortalJsonObject = {
    ...surfaces,
    input: {
      ...inputSurface,
      config: nextInputSurfaceConfig,
    },
    recharge: {
      ...rechargeSurface,
      enabled: rechargeSurface.enabled !== false,
      config: nextRechargeSurfaceConfig,
    },
  };
  const surfaceEntry = surfaceKey ? asObject(resolvedSurfaces[surfaceKey]) : null;

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
      surfaces: resolvedSurfaces,
      capabilities: {
        ...existingCapabilities,
        skills: skillBindings.map((item) => item.skill_slug),
        mcp_servers: mcpBindings.map((item) => item.mcp_key),
        menus: menuBindings.map((item) => item.menu_key),
      },
      skill_bindings: skillBindings,
      mcp_bindings: mcpBindings,
      menu_bindings: menuBindings,
      menu_catalog: publicMenuCatalog,
      composer_control_bindings: publicComposerControls,
      composer_shortcut_bindings: publicComposerShortcuts,
      recharge_package_catalog: platformRechargePackages.map((item) => ({
        package_id: item.packageId,
        package_name: item.packageName,
        credits: item.credits,
        bonus_credits: item.bonusCredits,
        total_credits: item.credits + item.bonusCredits,
        amount_cny_fen: item.amountCnyFen,
        sort_order: item.sortOrder,
        recommended: item.recommended,
        is_default: item.default,
        metadata: cloneJson(item.metadata),
      })),
      recharge_package_bindings: enabledRechargeBindings.map((item) => ({
        package_id: item.packageId,
        sort_order: item.sortOrder,
        recommended: item.recommended,
        is_default: item.default,
        config: cloneJson(item.config),
      })),
      recharge_payment_method_bindings: resolvedRechargePaymentMethods.map((item) => ({
        provider: item.provider,
        enabled: item.enabled,
        sort_order: item.sortOrder,
        is_default: item.default,
        label: item.label,
        metadata: cloneJson(item.metadata),
        source_layer: item.sourceLayer,
      })),
    },
    surfaceKey: surfaceKey || null,
    surfaceConfig: surfaceEntry ? asObject(surfaceEntry.config) : null,
  };
}
