import type {
  AuthTokens,
  BrandDetailData,
  ClientCrashEventRecord,
  ClientMetricEventRecord,
  ClientPerfSampleRecord,
  DesktopFaultReportDetailRecord,
  DesktopFaultReportSummaryRecord,
  OverviewData,
  UserActionAuditRecord,
  UserActionDiagnosticUploadRecord,
} from './adminTypes';

export const API_BASE_URL = ((import.meta.env?.VITE_AUTH_BASE_URL || 'http://127.0.0.1:2130') + '').trim().replace(/\/+$/, '');
export const PRIMARY_PAYMENT_PROVIDER = 'wechat_qr';

const TOKEN_STORAGE_KEY = 'iclaw.admin-web.tokens';
const DEFAULT_OVERVIEW_CORE_TIMEOUT_MS = 12_000;
const DEFAULT_OVERVIEW_OPTIONAL_TIMEOUT_MS = 6_000;
const PAYMENT_PROVIDER_CONFIG_FIELDS = ['sp_mchid', 'sp_appid', 'sub_mchid', 'notify_url', 'serial_no'] as const;
const PAYMENT_PROVIDER_SECRET_FIELDS = ['api_v3_key', 'private_key_pem'] as const;
const PAYMENT_GATEWAY_CONFIG_FIELDS = ['partner_id', 'gateway'] as const;
const PAYMENT_GATEWAY_SECRET_FIELDS = ['key'] as const;

export function loadTokens(): AuthTokens | null {
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function persistTokens(tokens: AuthTokens | null) {
  if (tokens) {
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
    return;
  }
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

async function parseResponse(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    const error = new Error(payload?.error?.message || '请求失败');
    throw error;
  }
  return payload.data;
}

async function refreshToken(tokens: AuthTokens | null) {
  if (!tokens?.refresh_token) {
    return null;
  }
  const next = await parseResponse(
    await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh_token: tokens.refresh_token,
      }),
    }),
  );
  const merged = {
    ...tokens,
    ...next,
  };
  persistTokens(merged);
  return merged;
}

export async function apiFetch(path: string, init: RequestInit = {}, options: { skipRefresh?: boolean } = {}) {
  let tokens = loadTokens();
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json');
  if (tokens?.access_token) {
    headers.set('Authorization', `Bearer ${tokens.access_token}`);
  }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });
  if (response.status === 401 && !options.skipRefresh && tokens?.refresh_token) {
    tokens = await refreshToken(tokens).catch(() => null);
    if (tokens?.access_token) {
      return apiFetch(path, init, { skipRefresh: true });
    }
  }
  return parseResponse(response);
}

async function apiFetchWithTimeout(
  path: string,
  init: RequestInit = {},
  options: { skipRefresh?: boolean } = {},
  timeoutMs = DEFAULT_OVERVIEW_OPTIONAL_TIMEOUT_MS,
) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return apiFetch(path, init, options);
  }

  const controller = new AbortController();
  const upstreamSignal = init.signal;
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const relayAbort = () => controller.abort();

  if (upstreamSignal) {
    if (upstreamSignal.aborted) {
      controller.abort();
    } else {
      upstreamSignal.addEventListener('abort', relayAbort, { once: true });
    }
  }

  try {
    return await apiFetch(
      path,
      {
        ...init,
        signal: controller.signal,
      },
      options,
    );
  } catch (error) {
    if (timedOut) {
      throw new Error(`请求超时（${timeoutMs}ms）：${path}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    upstreamSignal?.removeEventListener('abort', relayAbort);
  }
}

async function withOverviewFallback<T>(label: string, load: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await load();
  } catch (error) {
    console.warn(`[admin-web] overview bootstrap skipped ${label}`, error);
    return fallback;
  }
}

export function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function stringValue(value: unknown) {
  return String(value || '').trim();
}

export function numberValue(value: unknown) {
  const normalized = Number(value || 0);
  return Number.isFinite(normalized) ? normalized : 0;
}

function cloneConfig<T>(value: T): T {
  return JSON.parse(JSON.stringify(value || {}));
}

function getDesktopReleaseConfig(source: Record<string, unknown>) {
  const config = asObject(source.config);
  const root = asObject(config.desktop_release_admin);
  const channels = asObject(root.channels);
  const ensureSnapshot = (value: unknown) => {
    const snapshot = asObject(value);
    return {
      version: stringValue(snapshot.version),
      notes: stringValue(snapshot.notes),
      publishedAt: stringValue(snapshot.publishedAt || snapshot.published_at),
      policy: {
        mandatory: Boolean(asObject(snapshot.policy).mandatory),
        forceUpdateBelowVersion: stringValue(
          asObject(snapshot.policy).forceUpdateBelowVersion || asObject(snapshot.policy).force_update_below_version,
        ),
        allowCurrentRunToFinish:
          asObject(snapshot.policy).allowCurrentRunToFinish === undefined &&
          asObject(snapshot.policy).allow_current_run_to_finish === undefined
            ? true
            : Boolean(asObject(snapshot.policy).allowCurrentRunToFinish ?? asObject(snapshot.policy).allow_current_run_to_finish),
        reasonCode: stringValue(asObject(snapshot.policy).reasonCode || asObject(snapshot.policy).reason_code),
        reasonMessage: stringValue(asObject(snapshot.policy).reasonMessage || asObject(snapshot.policy).reason_message),
      },
      targets: toArray<Record<string, unknown>>(snapshot.targets).map((item) => {
        const target = asObject(item);
        return {
          platform: stringValue(target.platform),
          arch: stringValue(target.arch),
          installer: asObject(target.installer),
          updater: asObject(target.updater),
          signature: asObject(target.signature),
        };
      }),
    };
  };
  const ensureChannel = (value: unknown) => {
    const channel = asObject(value);
    return {
      draft: ensureSnapshot(channel.draft),
      published: ensureSnapshot(channel.published),
    };
  };
  return {
    dev: ensureChannel(channels.dev),
    prod: ensureChannel(channels.prod),
  };
}

function splitLines(value: unknown) {
  return String(value || '')
    .split(/[\n,]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseLabelHrefLines(raw: string) {
  return splitLines(raw)
    .map((line) => {
      const [labelPart, hrefPart] = line.split('|');
      const label = String(labelPart || '').trim();
      const href = String(hrefPart || '').trim();
      if (!label) {
        return null;
      }
      return {
        label,
        href: href || '#',
      };
    })
    .filter(Boolean) as Array<{ label: string; href: string }>;
}

function upsertPage(pages: Array<Record<string, unknown>>, pageKey: string, fallbackPath: string) {
  const existing = pages.find((item) => stringValue(asObject(item).pageKey) === pageKey);
  if (existing) return asObject(existing);
  const next = { pageKey, path: fallbackPath, enabled: true, seo: {}, blocks: [] };
  pages.push(next);
  return next;
}

function upsertBlock(page: Record<string, unknown>, matcherPrefix: string, fallbackBlockKey: string, sortOrder: number) {
  const blocks = Array.isArray(page.blocks) ? page.blocks : [];
  page.blocks = blocks;
  const existing = blocks.find((item) => String(asObject(item).blockKey || '').startsWith(matcherPrefix));
  if (existing) return asObject(existing);
  const next = { blockKey: fallbackBlockKey, enabled: true, sortOrder, props: {} };
  blocks.push(next);
  return next;
}

function createOverviewAppDetailFallback(app: Record<string, unknown>) {
  return {
    app,
    skillBindings: [],
    mcpBindings: [],
    modelBindings: [],
    menuBindings: [],
    rechargePackageBindings: [],
    composerControlBindings: [],
    composerShortcutBindings: [],
    assets: [],
    releases: [],
    audit: [],
    versions: [],
  };
}

export async function loadOverviewData(options: {
  coreTimeoutMs?: number;
  optionalTimeoutMs?: number;
} = {}): Promise<OverviewData> {
  const coreTimeoutMs =
    Number.isFinite(options.coreTimeoutMs) && Number(options.coreTimeoutMs) > 0
      ? Number(options.coreTimeoutMs)
      : DEFAULT_OVERVIEW_CORE_TIMEOUT_MS;
  const optionalTimeoutMs =
    Number.isFinite(options.optionalTimeoutMs) && Number(options.optionalTimeoutMs) > 0
      ? Number(options.optionalTimeoutMs)
      : DEFAULT_OVERVIEW_OPTIONAL_TIMEOUT_MS;
  const [
    user,
    appsData,
    agentCatalogData,
    skillsData,
    mcpsData,
    modelCatalogData,
    modelProviderProfilesData,
    memoryEmbeddingProfilesData,
    modelLogoPresetsData,
    menuCatalogData,
    composerControlCatalogData,
    composerShortcutCatalogData,
    rechargeCatalogData,
    paymentGatewayConfigData,
    paymentProviderProfilesData,
    paymentProviderBindingsData,
    paymentOrdersData,
    cloudSkillsData,
    skillSyncSourcesData,
    skillSyncRunsData,
    cloudMcpsData,
    runtimeReleasesData,
    runtimeBindingsData,
    runtimeBindingHistoryData,
    runtimeBootstrapSourceData,
  ] = await Promise.all([
    apiFetchWithTimeout('/auth/me', { method: 'GET' }, {}, coreTimeoutMs),
    apiFetchWithTimeout('/admin/portal/apps', { method: 'GET' }, {}, coreTimeoutMs),
    withOverviewFallback('agent catalog', () => apiFetchWithTimeout('/admin/agents/catalog', { method: 'GET' }, {}, optionalTimeoutMs), { items: [] }),
    withOverviewFallback('platform skills', () => apiFetchWithTimeout('/admin/portal/catalog/skills', { method: 'GET' }, {}, optionalTimeoutMs), { items: [] }),
    withOverviewFallback('platform mcps', () => apiFetchWithTimeout('/admin/portal/catalog/mcps', { method: 'GET' }, {}, optionalTimeoutMs), { items: [] }),
    withOverviewFallback('platform models', () => apiFetchWithTimeout('/admin/portal/catalog/models', { method: 'GET' }, {}, optionalTimeoutMs), { items: [] }),
    withOverviewFallback('model provider profiles', () => apiFetchWithTimeout('/admin/portal/model-provider-profiles', { method: 'GET' }, {}, optionalTimeoutMs), { items: [] }),
    withOverviewFallback('memory embedding profiles', () => apiFetchWithTimeout('/admin/portal/memory-embedding-profiles', { method: 'GET' }, {}, optionalTimeoutMs), { items: [] }),
    withOverviewFallback('model logo presets', () => apiFetchWithTimeout('/admin/portal/model-logo-presets', { method: 'GET' }, {}, optionalTimeoutMs), { items: [] }),
    withOverviewFallback('menu catalog', () => apiFetchWithTimeout('/admin/portal/catalog/menus', { method: 'GET' }, {}, optionalTimeoutMs), { items: [] }),
    withOverviewFallback('composer control catalog', () => apiFetchWithTimeout('/admin/portal/catalog/composer-controls', { method: 'GET' }, {}, optionalTimeoutMs), { items: [] }),
    withOverviewFallback('composer shortcut catalog', () => apiFetchWithTimeout('/admin/portal/catalog/composer-shortcuts', { method: 'GET' }, {}, optionalTimeoutMs), { items: [] }),
    withOverviewFallback('recharge package catalog', () => apiFetchWithTimeout('/admin/portal/catalog/recharge-packages', { method: 'GET' }, {}, optionalTimeoutMs), { items: [] }),
    withOverviewFallback('payment gateway config', () => apiFetchWithTimeout('/admin/payments/gateway-config', { method: 'GET' }, {}, optionalTimeoutMs), null),
    withOverviewFallback(
      'payment provider profiles',
      () => apiFetchWithTimeout(`/admin/payments/provider-profiles?provider=${encodeURIComponent(PRIMARY_PAYMENT_PROVIDER)}`, { method: 'GET' }, {}, optionalTimeoutMs),
      { items: [] },
    ),
    withOverviewFallback(
      'payment provider bindings',
      () => apiFetchWithTimeout(`/admin/payments/provider-bindings?provider=${encodeURIComponent(PRIMARY_PAYMENT_PROVIDER)}`, { method: 'GET' }, {}, optionalTimeoutMs),
      { items: [] },
    ),
    withOverviewFallback('payment orders', () => apiFetchWithTimeout('/admin/payments/orders?limit=200', { method: 'GET' }, {}, optionalTimeoutMs), { items: [] }),
    withOverviewFallback(
      'cloud skills catalog',
      () => apiFetchWithTimeout('/admin/skills/catalog?limit=100&offset=0', { method: 'GET' }, {}, optionalTimeoutMs),
      { items: [], total: 0, limit: 100, offset: 0, has_more: false, next_offset: null },
    ),
    withOverviewFallback('skill sync sources', () => apiFetchWithTimeout('/admin/skills/sync/sources', { method: 'GET' }, {}, optionalTimeoutMs), { items: [] }),
    withOverviewFallback('skill sync runs', () => apiFetchWithTimeout('/admin/skills/sync/runs', { method: 'GET' }, {}, optionalTimeoutMs), { items: [] }),
    withOverviewFallback('cloud mcp catalog', () => apiFetchWithTimeout('/admin/mcp/catalog', { method: 'GET' }, {}, optionalTimeoutMs), { items: [] }),
    withOverviewFallback('runtime releases', () => apiFetchWithTimeout('/admin/portal/runtime-releases?limit=200', { method: 'GET' }, {}, optionalTimeoutMs), { items: [] }),
    withOverviewFallback('runtime bindings', () => apiFetchWithTimeout('/admin/portal/runtime-bindings?limit=200', { method: 'GET' }, {}, optionalTimeoutMs), { items: [] }),
    withOverviewFallback('runtime binding history', () => apiFetchWithTimeout('/admin/portal/runtime-binding-history?limit=200', { method: 'GET' }, {}, optionalTimeoutMs), { items: [] }),
    withOverviewFallback('runtime bootstrap source', () => apiFetchWithTimeout('/admin/portal/runtime-bootstrap-source', { method: 'GET' }, {}, optionalTimeoutMs), null),
  ]);

  const apps = toArray<Record<string, unknown>>(asObject(appsData).items);
  const details = await Promise.all(
    apps.map(async (app) => {
      const appName = stringValue(app.appName);
      return withOverviewFallback(
        `app detail ${appName}`,
        () => apiFetchWithTimeout(`/admin/portal/apps/${encodeURIComponent(appName)}`, { method: 'GET' }, {}, optionalTimeoutMs),
        createOverviewAppDetailFallback(app),
      );
    }),
  );
  const overrides = await Promise.all(
    apps.map(async (app) => {
      const appName = stringValue(app.appName);
      const detail = await withOverviewFallback(
        `model provider override ${appName}`,
        () =>
          apiFetchWithTimeout(
            `/admin/portal/apps/${encodeURIComponent(appName)}/model-provider-override`,
            { method: 'GET' },
            {},
            optionalTimeoutMs,
          ),
        null,
      );
      return [appName, detail] as const;
    }),
  );
  const paymentGatewayConfigs: Record<string, Record<string, unknown> | null> = {
    platform: paymentGatewayConfigData && typeof paymentGatewayConfigData === 'object' ? asObject(paymentGatewayConfigData) : null,
  };
  await Promise.all(
    apps.map(async (app) => {
      const appName = stringValue(app.appName);
      const detail = await withOverviewFallback(
        `payment gateway config ${appName}`,
        () =>
          apiFetchWithTimeout(
            `/admin/payments/gateway-config?scope_type=app&scope_key=${encodeURIComponent(appName)}`,
            {
              method: 'GET',
            },
            {},
            optionalTimeoutMs,
          ),
        null,
      );
      paymentGatewayConfigs[appName] = detail && typeof detail === 'object' ? asObject(detail) : null;
    }),
  );

  const releases = details
    .flatMap((detail) => {
      const detailObject = asObject(detail);
      const brand = asObject(detailObject.brand);
      const brandName = stringValue(brand.displayName || brand.brandId);
      return toArray<Record<string, unknown>>(detailObject.versions).map((item) => ({
        id: stringValue(item.id) || `${brandName}-${stringValue(item.version)}`,
        brandId: stringValue(item.brandId || item.appName || brand.brandId),
        displayName: brandName,
        version: stringValue(item.version),
        publishedAt: stringValue(item.publishedAt || item.published_at),
        createdByName: stringValue(item.createdByName || item.created_by_name || item.createdByUsername || 'system'),
        surfaces: Object.keys(asObject(asObject(item.config).surfaces)).filter(
          (key) => asObject(asObject(asObject(item.config).surfaces)[key]).enabled !== false,
        ),
        skillCount: toArray<Record<string, unknown>>(detailObject.skillBindings).filter((entry) => entry.enabled !== false).length,
        mcpCount: toArray<Record<string, unknown>>(detailObject.mcpBindings).filter((entry) => entry.enabled !== false).length,
        config: asObject(item.config),
      }));
    })
    .filter((item) => item.version)
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));

  const edits = details
    .flatMap((detail) => {
      const detailObject = asObject(detail);
      const brand = asObject(detailObject.brand);
      const brandName = stringValue(brand.displayName || brand.brandId);
      return toArray<Record<string, unknown>>(detailObject.audit).map((item) => ({
        id: stringValue(item.id) || `${brandName}-${stringValue(item.created_at)}`,
        displayName: brandName,
        action: stringValue(item.action),
        actorName: stringValue(item.actor_name || item.actor_username || 'system'),
        createdAt: stringValue(item.created_at || item.createdAt),
      }));
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 5);

  const audit = details
    .flatMap((detail) => {
      const detailObject = asObject(detail);
      const brand = asObject(detailObject.brand);
      return toArray<Record<string, unknown>>(detailObject.audit).map((item) => ({
        id: stringValue(item.id),
        brandId: stringValue(item.brandId || item.appName || brand.brandId),
        brandDisplayName: stringValue(item.brandDisplayName || item.appDisplayName || brand.displayName || brand.brandId),
        action: stringValue(item.action),
        actorName: stringValue(item.actorName),
        actorUsername: stringValue(item.actorUsername),
        environment: stringValue(item.environment || 'portal'),
        createdAt: stringValue(item.createdAt || item.created_at),
        payload: asObject(item.payload),
      }));
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  const assets = details.flatMap((detail) => {
    const detailObject = asObject(detail);
    const app = asObject(detailObject.app);
    return toArray<Record<string, unknown>>(detailObject.assets).map((item) => ({
      assetKey: stringValue(item.assetKey),
      brandId: stringValue(item.brandId || item.appName || app.appName),
      brandDisplayName: stringValue(item.brandDisplayName || app.displayName || app.appName),
      appName: stringValue(item.appName || app.appName),
      storageProvider: stringValue(item.storageProvider || 's3'),
      publicUrl: stringValue(item.publicUrl),
      objectKey: stringValue(item.objectKey),
      contentType: stringValue(item.contentType),
      metadata: asObject(item.metadata),
      updatedAt: stringValue(item.updatedAt),
    }));
  });
  const brandConfigs = Object.fromEntries(
    details.map((detail) => {
      const detailObject = asObject(detail);
      const app = asObject(detailObject.app);
      return [stringValue(app.appName), asObject(app.config)];
    }),
  );
  const agentCatalog = toArray<Record<string, unknown>>(asObject(agentCatalogData).items).map((item) => ({
    slug: stringValue(item.slug),
    name: stringValue(item.name || item.slug),
    description: stringValue(item.description),
    category: stringValue(item.category || 'general'),
    publisher: stringValue(item.publisher || 'admin-web'),
    featured: item.featured === true,
    official: item.official !== false,
    tags: toArray<string>(item.tags).map((entry) => String(entry || '')),
    capabilities: toArray<string>(item.capabilities).map((entry) => String(entry || '')),
    useCases: toArray<string>(item.use_cases || item.useCases).map((entry) => String(entry || '')),
    metadata: asObject(item.metadata),
    sortOrder: numberValue(item.sort_order || item.sortOrder || 9999),
    active: item.active !== false,
  }));
  const normalizedPaymentGatewayConfigs = Object.fromEntries(
    Object.entries(paymentGatewayConfigs).map(([key, value]) => {
      const config = asObject(value);
      return [key, value ? {
        provider: stringValue(config.provider || 'epay'),
        source: stringValue(config.source || 'unset'),
        scopeType: stringValue(config.scope_type || config.scopeType || (key === 'platform' ? 'platform' : 'app')),
        scopeKey: stringValue(config.scope_key || config.scopeKey || key),
        config: asObject(config.config),
        secretValues: asObject(config.secret_values || config.secretValues),
        configuredSecretKeys: toArray<string>(config.configured_secret_keys || config.configuredSecretKeys).map((entry) => String(entry || '')),
        completenessStatus: stringValue(config.completeness_status || config.completenessStatus || 'missing'),
        missingFields: toArray<string>(config.missing_fields || config.missingFields).map((entry) => String(entry || '')),
        updatedAt: stringValue(config.updated_at || config.updatedAt),
      } : null];
    }),
  );
  const paymentProviderProfiles = toArray<Record<string, unknown>>(asObject(paymentProviderProfilesData).items).map((item) => ({
    id: stringValue(item.id),
    provider: stringValue(item.provider || PRIMARY_PAYMENT_PROVIDER),
    scopeType: stringValue(item.scope_type || item.scopeType || 'platform'),
    scopeKey: stringValue(item.scope_key || item.scopeKey || 'platform'),
    channelKind: stringValue(item.channel_kind || item.channelKind || 'wechat_service_provider'),
    displayName: stringValue(item.display_name || item.displayName),
    enabled: item.enabled !== false,
    completenessStatus: stringValue(item.completeness_status || item.completenessStatus || 'missing'),
    missingFields: toArray<string>(item.missing_fields || item.missingFields).map((entry) => String(entry || '')),
    configuredSecretKeys: toArray<string>(item.configured_secret_keys || item.configuredSecretKeys).map((entry) => String(entry || '')),
    config: asObject(item.config || item.config_values || item.configValues),
  }));
  const paymentProviderBindings = toArray<Record<string, unknown>>(asObject(paymentProviderBindingsData).items).map((item) => ({
    provider: stringValue(item.provider || PRIMARY_PAYMENT_PROVIDER),
    appName: stringValue(item.app_name || item.appName),
    mode: stringValue(item.mode || 'inherit_platform'),
    activeProfileId: stringValue(item.active_profile_id || item.activeProfileId),
  }));
  const modelLogoPresets = toArray<Record<string, unknown>>(asObject(modelLogoPresetsData).items).map((item) => ({
    presetKey: stringValue(item.presetKey || item.preset_key),
    label: stringValue(item.label || item.presetKey || item.preset_key),
    fileName: stringValue(item.fileName || item.file_name),
    contentType: stringValue(item.contentType || item.content_type || 'image/png'),
    url: stringValue(item.url),
  }));

  const paymentOrders = toArray<Record<string, unknown>>(asObject(paymentOrdersData).items).map((item) => ({
    orderId: stringValue(item.order_id),
    status: stringValue(item.status),
    provider: stringValue(item.provider),
    amountCnyFen: numberValue(item.amount_cny_fen),
    totalCredits: numberValue(item.total_credits),
    userId: stringValue(item.user_id),
    username: stringValue(item.username),
    userEmail: stringValue(item.user_email),
    userDisplayName: stringValue(item.user_display_name),
    appName: stringValue(item.app_name),
    appVersion: stringValue(item.app_version),
    releaseChannel: stringValue(item.release_channel),
    platform: stringValue(item.platform),
    arch: stringValue(item.arch),
    providerOrderId: stringValue(item.provider_order_id),
    providerPrepayId: stringValue(item.provider_prepay_id),
    returnUrl: stringValue(item.return_url),
    createdAt: stringValue(item.created_at),
    paidAt: stringValue(item.paid_at),
    expiresAt: stringValue(item.expires_at),
    latestWebhookAt: stringValue(item.latest_webhook_at),
    updatedAt: stringValue(item.updated_at),
    webhookEventCount: numberValue(item.webhook_event_count),
    metadata: asObject(item.metadata),
  }));

  const rechargeCatalog = toArray<Record<string, unknown>>(asObject(rechargeCatalogData).items).map((item) => ({
    ...(() => {
      const metadata = asObject(item.metadata);
      const featureListSnake = Array.isArray(metadata.feature_list) ? metadata.feature_list.map((entry) => String(entry || '')) : null;
      const featureListCamel = Array.isArray(metadata.featureList) ? metadata.featureList.map((entry) => String(entry || '')) : null;
      return {
        description: stringValue(metadata.description),
        badgeLabel: stringValue(metadata.badge_label || metadata.badgeLabel),
        highlight: stringValue(metadata.highlight),
        featureList: featureListSnake || featureListCamel || [],
      };
    })(),
    packageId: stringValue(item.packageId || item.package_id),
    packageName: stringValue(item.packageName || item.package_name || item.packageId || item.package_id),
    credits: numberValue(item.credits),
    bonusCredits: numberValue(item.bonusCredits || item.bonus_credits),
    amountCnyFen: numberValue(item.amountCnyFen || item.amount_cny_fen),
    sortOrder: numberValue(item.sortOrder || item.sort_order),
    active: item.active !== false,
    recommended: item.recommended === true,
    default: item.default === true || item.is_default === true,
  }));

  const menuCatalog = toArray<Record<string, unknown>>(asObject(menuCatalogData).items).map((item) => ({
    key: stringValue(item.menuKey || item.menu_key || item.key),
    label: stringValue(item.displayName || item.display_name || item.label || item.menuKey || item.key),
    category: stringValue(item.category || 'sidebar'),
    iconKey: stringValue(item.iconKey || item.icon_key),
    active: item.active !== false,
    enabledByDefault:
      asObject(item.metadata).enabled_by_default === true || asObject(item.metadata).enabledByDefault === true,
  }));

  const composerControlCatalog = toArray<Record<string, unknown>>(asObject(composerControlCatalogData).items).map((item) => ({
    controlKey: stringValue(item.controlKey || item.control_key),
    displayName: stringValue(item.displayName || item.display_name || item.controlKey || item.control_key),
    controlType: stringValue(item.controlType || item.control_type || 'static'),
    iconKey: stringValue(item.iconKey || item.icon_key),
    metadata: asObject(item.metadata),
    sortOrder: numberValue(item.sortOrder || item.sort_order || 0),
    options: toArray<Record<string, unknown>>(item.options).map((option, index) => ({
      optionValue: stringValue(option.optionValue || option.option_value || option.value),
      label: stringValue(option.label || option.optionValue || option.option_value || option.value),
      description: stringValue(option.description || option.detail),
      sortOrder: numberValue(option.sortOrder || option.sort_order || (index + 1) * 10),
      metadata: asObject(option.metadata),
      active: option.active !== false,
    })),
    active: item.active !== false,
  }));

  const composerShortcutCatalog = toArray<Record<string, unknown>>(asObject(composerShortcutCatalogData).items).map((item) => ({
    shortcutKey: stringValue(item.shortcutKey || item.shortcut_key),
    displayName: stringValue(item.displayName || item.display_name || item.shortcutKey || item.shortcut_key),
    description: stringValue(item.description),
    template: stringValue(item.template || item.template_text),
    iconKey: stringValue(item.iconKey || item.icon_key),
    tone: stringValue(item.tone),
    metadata: asObject(item.metadata),
    sortOrder: numberValue(item.sortOrder || item.sort_order || 0),
    active: item.active !== false,
  }));

  const cloudSkills = toArray<Record<string, unknown>>(asObject(cloudSkillsData).items).map((item) => ({
    slug: stringValue(item.slug),
    name: stringValue(item.name || item.slug),
    description: stringValue(item.description),
    version: stringValue(item.version || '0.0.0'),
    originType: stringValue(item.origin_type || item.originType || 'manual'),
    publisher: stringValue(item.publisher || '未知'),
    active: item.active !== false,
    tags: toArray<string>(item.tags).map((tag) => String(tag || '')),
    sourceUrl: stringValue(item.source_url || item.sourceUrl),
    artifactUrl: stringValue(item.artifact_url || item.artifactUrl),
    market: stringValue(item.market),
    category: stringValue(item.category),
    skillType: stringValue(item.skill_type || item.skillType),
    distribution: stringValue(item.distribution),
    artifactFormat: stringValue(item.artifact_format || item.artifactFormat),
    artifactSha256: stringValue(item.artifact_sha256 || item.artifactSha256),
    artifactSourcePath: stringValue(item.artifact_source_path || item.artifactSourcePath || item.artifact_path),
    metadata: asObject(item.metadata),
  }));

  const skillSyncSources = toArray<Record<string, unknown>>(asObject(skillSyncSourcesData).items).map((item) => ({
    id: stringValue(item.id),
    displayName: stringValue(item.display_name || item.displayName || item.id),
    sourceType: stringValue(item.source_type || item.sourceType),
    sourceKey: stringValue(item.source_key || item.sourceKey),
    sourceUrl: stringValue(item.source_url || item.sourceUrl),
    config: asObject(item.config),
    active: item.active !== false,
  }));

  const skillSyncRuns = toArray<Record<string, unknown>>(asObject(skillSyncRunsData).items).map((item) => ({
    id: stringValue(item.id),
    displayName: stringValue(item.display_name || item.displayName || item.id),
    status: stringValue(item.status),
    startedAt: stringValue(item.started_at || item.startedAt),
    finishedAt: stringValue(item.finished_at || item.finishedAt),
    summary: asObject(item.summary),
  }));

  const cloudMcps = toArray<Record<string, unknown>>(asObject(cloudMcpsData).items)
    .map((item) => {
      const key = stringValue(item.key || item.mcpKey);
      return {
        key,
        name: stringValue(item.name || key),
        description: stringValue(item.description),
        transport: stringValue(item.transport || 'config'),
        objectKey: stringValue(item.object_key || item.objectKey),
        enabled: item.enabled !== false && item.active !== false,
        metadata: asObject(item.metadata),
      };
    })
    .filter((item) => item.key)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));

  const modelProviderProfiles = toArray<Record<string, unknown>>(asObject(modelProviderProfilesData).items).map((item) => ({
    id: stringValue(item.id),
    scopeType: stringValue(item.scopeType),
    scopeKey: stringValue(item.scopeKey),
    providerKey: stringValue(item.providerKey),
    providerLabel: stringValue(item.providerLabel || item.providerKey),
    baseUrl: stringValue(item.baseUrl),
    apiKey: stringValue(item.apiKey),
    logoPresetKey: stringValue(item.logoPresetKey),
    metadata: asObject(item.metadata),
    enabled: item.enabled !== false,
    sortOrder: numberValue(item.sortOrder),
    models: toArray<Record<string, unknown>>(item.models).map((model) => ({
      label: stringValue(model.label),
      modelId: stringValue(model.modelId),
      logoPresetKey: stringValue(model.logoPresetKey),
      billingMultiplier: numberValue(model.billingMultiplier || model.billing_multiplier || 1) || 1,
    })),
  }));

  const memoryEmbeddingProfiles = toArray<Record<string, unknown>>(asObject(memoryEmbeddingProfilesData).items).map((item) => ({
    id: stringValue(item.id),
    scopeType: stringValue(item.scopeType),
    scopeKey: stringValue(item.scopeKey),
    providerKey: stringValue(item.providerKey),
    providerLabel: stringValue(item.providerLabel || item.providerKey),
    baseUrl: stringValue(item.baseUrl),
    apiKey: stringValue(item.apiKey),
    embeddingModel: stringValue(item.embeddingModel),
    logoPresetKey: stringValue(item.logoPresetKey),
    autoRecall: item.autoRecall !== false,
    enabled: item.enabled !== false,
  }));

  const modelProviderOverrides = Object.fromEntries(overrides.map(([appName, detail]) => [appName, detail ? {
    providerMode: stringValue(asObject(detail).providerMode),
    activeProfileId: stringValue(asObject(detail).activeProfileId),
    cacheVersion: numberValue(asObject(detail).cacheVersion),
  } : null]));

  const getSkillConnections = (slug: string) =>
    details.flatMap((detail) => {
      const detailObject = asObject(detail);
      const app = asObject(detailObject.app);
      return toArray<Record<string, unknown>>(detailObject.skillBindings)
        .filter((item) => stringValue(item.skillSlug) === slug && item.enabled !== false)
        .map(() => ({
          brandId: stringValue(app.appName),
          displayName: stringValue(app.displayName || app.appName),
        }));
    });

  const getMcpConnections = (key: string) =>
    details.flatMap((detail) => {
      const detailObject = asObject(detail);
      const app = asObject(detailObject.app);
      return toArray<Record<string, unknown>>(detailObject.mcpBindings)
        .filter((item) => stringValue(item.mcpKey) === key && item.enabled !== false)
        .map(() => ({
          brandId: stringValue(app.appName),
          displayName: stringValue(app.displayName || app.appName),
        }));
    });

  const getModelConnections = (ref: string) =>
    details.flatMap((detail) => {
      const detailObject = asObject(detail);
      const app = asObject(detailObject.app);
      return toArray<Record<string, unknown>>(detailObject.modelBindings)
        .filter((item) => stringValue(item.modelRef) === ref && item.enabled !== false)
        .map(() => ({
          brandId: stringValue(app.appName),
          displayName: stringValue(app.displayName || app.appName),
        }));
    });

  const platformSkills = toArray<Record<string, unknown>>(asObject(skillsData).items)
    .map((item) => {
      const slug = stringValue(item.slug);
      return {
        slug,
        name: stringValue(item.name || slug),
        description: stringValue(item.description),
        category: stringValue(item.category),
        version: stringValue(item.version || '0.0.0'),
        publisher: stringValue(item.publisher || '未知'),
        active: item.active !== false,
        metadata: asObject(item.metadata),
        connectedBrands: getSkillConnections(slug),
      };
    })
    .filter((item) => item.slug)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));

  const platformMcps = toArray<Record<string, unknown>>(asObject(mcpsData).items)
    .map((item) => {
      const key = stringValue(item.mcpKey || item.key);
      return {
        key,
        name: stringValue(item.name || key),
        description: stringValue(item.description),
        transport: stringValue(item.transport || 'config'),
        objectKey: stringValue(item.object_key || item.objectKey),
        command: stringValue(item.command),
        httpUrl: stringValue(item.http_url || item.httpUrl),
        envKeys: toArray<string>(item.env_keys || item.envKeys).map((entry) => String(entry || '')),
        active: item.active !== false,
        metadata: asObject(item.metadata),
        connectedBrands: getMcpConnections(key),
      };
    })
    .filter((item) => item.key)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));

  const platformModels = toArray<Record<string, unknown>>(asObject(modelCatalogData).items)
    .map((item) => {
      const ref = stringValue(item.ref);
      return {
        ref,
        label: stringValue(item.label || ref),
        providerId: stringValue(item.providerId),
        modelId: stringValue(item.modelId),
        api: stringValue(item.api || 'openai-completions'),
        baseUrl: stringValue(item.baseUrl),
        useRuntimeOpenai: item.useRuntimeOpenai !== false,
        authHeader: item.authHeader !== false,
        reasoning: item.reasoning === true,
        input: Array.isArray(item.input) ? item.input.map((entry) => String(entry || '')) : [],
        contextWindow: numberValue(item.contextWindow),
        maxTokens: numberValue(item.maxTokens),
        metadata: asObject(item.metadata),
        active: item.active !== false,
        connectedBrands: getModelConnections(ref),
      };
    })
    .filter((item) => item.ref)
    .sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));

  const runtimeReleases = toArray<Record<string, unknown>>(asObject(runtimeReleasesData).items).map((item) => ({
    id: stringValue(item.id),
    runtimeKind: stringValue(item.runtimeKind),
    version: stringValue(item.version),
    channel: stringValue(item.channel),
    platform: stringValue(item.platform),
    arch: stringValue(item.arch),
    targetTriple: stringValue(item.targetTriple),
    status: stringValue(item.status),
    updatedAt: stringValue(item.updatedAt),
    artifactUrl: stringValue(item.artifactUrl),
  }));

  const runtimeBindings = toArray<Record<string, unknown>>(asObject(runtimeBindingsData).items).map((item) => ({
    id: stringValue(item.id),
    scopeType: stringValue(item.scopeType),
    scopeKey: stringValue(item.scopeKey),
    runtimeKind: stringValue(item.runtimeKind),
    channel: stringValue(item.channel),
    platform: stringValue(item.platform),
    arch: stringValue(item.arch),
    targetTriple: stringValue(item.targetTriple),
    releaseId: stringValue(item.releaseId),
    enabled: item.enabled !== false,
    updatedAt: stringValue(item.updatedAt),
    changeReason: stringValue(item.changeReason),
  }));

  const runtimeBindingHistory = toArray<Record<string, unknown>>(asObject(runtimeBindingHistoryData).items).map((item) => ({
    id: stringValue(item.id),
    bindingId: stringValue(item.bindingId),
    scopeType: stringValue(item.scopeType),
    scopeKey: stringValue(item.scopeKey),
    runtimeKind: stringValue(item.runtimeKind),
    channel: stringValue(item.channel),
    targetTriple: stringValue(item.targetTriple),
    fromReleaseId: stringValue(item.fromReleaseId),
    toReleaseId: stringValue(item.toReleaseId),
    createdAt: stringValue(item.createdAt),
    changeReason: stringValue(item.changeReason),
  }));

  const runtimeBootstrapSource =
    runtimeBootstrapSourceData && typeof runtimeBootstrapSourceData === 'object'
      ? {
          sourcePath: stringValue(asObject(runtimeBootstrapSourceData).sourcePath),
          version: stringValue(asObject(runtimeBootstrapSourceData).version),
          artifacts: toArray<Record<string, unknown>>(asObject(runtimeBootstrapSourceData).artifacts).map((item) => ({
            targetTriple: stringValue(item.targetTriple),
            platform: stringValue(item.platform),
            arch: stringValue(item.arch),
            artifactUrl: stringValue(item.artifactUrl),
            artifactFormat: stringValue(item.artifactFormat),
            objectKey: stringValue(item.objectKey),
          })),
        }
      : null;

  const brands = apps.map((app, index) => {
    const detail = asObject(details[index]);
    const detailApp = asObject(detail.app);
    const config = asObject(detailApp.config);
    const surfaces = asObject(config.surfaces);
    const brandMeta = asObject(config.brand_meta || config.brandMeta);
    return {
      brandId: stringValue(app.appName),
      displayName: stringValue(app.displayName),
      productName: stringValue(brandMeta.product_name || brandMeta.productName || app.displayName),
      tenantKey: stringValue(brandMeta.tenant_key || brandMeta.tenantKey || app.appName),
      status: stringValue(app.status) === 'disabled' ? 'disabled' : 'active',
      updatedAt: stringValue(app.updatedAt),
      surfaceCount: Object.values(surfaces).filter((surface) => asObject(surface).enabled !== false).length,
      skillCount: toArray<Record<string, unknown>>(detail.skillBindings).filter((item) => item.enabled !== false).length,
      mcpCount: toArray<Record<string, unknown>>(detail.mcpBindings).filter((item) => item.enabled !== false).length,
    };
  });

  const desktopReleaseConfigs = Object.fromEntries(
    details.map((detail) => {
      const detailObject = asObject(detail);
      const app = asObject(detailObject.app);
      return [stringValue(app.appName), getDesktopReleaseConfig(app)];
    }),
  );

  return {
    user: asObject(user),
    stats: {
      brandsTotal: apps.length,
      publishedCount: apps.filter((app) => stringValue(app.status || app.appStatus) !== 'disabled').length,
      cloudSkillsCount: numberValue(asObject(cloudSkillsData).total || toArray(asObject(cloudSkillsData).items).length),
      mcpServersCount: numberValue(asObject(mcpsData).items ? toArray(asObject(mcpsData).items).length : 0),
      skillsCount: numberValue(asObject(skillsData).items ? toArray(asObject(skillsData).items).length : 0),
      assetsCount: details.reduce((sum, detail) => sum + toArray(asObject(detail).assets).length, 0),
    },
    recentReleases: releases,
    recentEdits: edits,
    brandConfigs,
    agentCatalog,
    releases,
    audit,
    assets,
    paymentGatewayConfigs: normalizedPaymentGatewayConfigs,
    paymentProviderProfiles,
    paymentProviderBindings,
    paymentOrders,
    rechargeCatalog,
    menuCatalog,
    composerControlCatalog,
    composerShortcutCatalog,
    cloudSkills,
    cloudSkillMeta: {
      total: numberValue(asObject(cloudSkillsData).total),
      limit: numberValue(asObject(cloudSkillsData).limit || 100),
      offset: numberValue(asObject(cloudSkillsData).offset || 0),
      hasMore: asObject(cloudSkillsData).has_more === true,
      nextOffset: Number.isFinite(Number(asObject(cloudSkillsData).next_offset)) ? Number(asObject(cloudSkillsData).next_offset) : null,
      query: '',
    },
    skillSyncSources,
    skillSyncRuns,
    cloudMcps,
    modelLogoPresets,
    modelProviderProfiles,
    memoryEmbeddingProfiles,
    modelProviderOverrides,
    platformSkills,
    platformMcps,
    platformModels,
    runtimeReleases,
    runtimeBindings,
    runtimeBindingHistory,
    runtimeBootstrapSource,
    desktopReleaseConfigs,
    brands,
  };
}

export async function loadBrandDetailData(brandId: string): Promise<BrandDetailData> {
  const detail = await apiFetch(`/admin/portal/apps/${encodeURIComponent(brandId)}`, { method: 'GET' });
  const detailObject = asObject(detail);
  const app = asObject(detailObject.app);
  const config = asObject(app.config);
  const brandMeta = asObject(config.brand_meta || config.brandMeta);

  return {
    brand: {
      brandId: stringValue(app.appName),
      displayName: stringValue(app.displayName || app.appName),
      productName: stringValue(brandMeta.product_name || brandMeta.productName || app.displayName),
      tenantKey: stringValue(brandMeta.tenant_key || brandMeta.tenantKey || app.appName),
      status: stringValue(app.status) === 'disabled' ? 'disabled' : 'active',
      updatedAt: stringValue(app.updatedAt),
      publishedVersion: stringValue(asObject(detailObject.releases?.[0]).version || '0'),
      defaultLocale: stringValue(app.defaultLocale || 'zh-CN'),
    },
    appConfig: config,
    skillBindings: toArray<Record<string, unknown>>(detailObject.skillBindings),
    mcpBindings: toArray<Record<string, unknown>>(detailObject.mcpBindings),
    modelBindings: toArray<Record<string, unknown>>(detailObject.modelBindings),
    menuBindings: toArray<Record<string, unknown>>(detailObject.menuBindings),
    rechargePackageBindings: toArray<Record<string, unknown>>(detailObject.rechargePackageBindings),
    composerControlBindings: toArray<Record<string, unknown>>(detailObject.composerControlBindings),
    composerShortcutBindings: toArray<Record<string, unknown>>(detailObject.composerShortcutBindings),
    assets: toArray<Record<string, unknown>>(detailObject.assets),
    versions: toArray<Record<string, unknown>>(detailObject.releases),
    audit: toArray<Record<string, unknown>>(detailObject.audit),
  };
}

export async function loadUserActionAuditData(): Promise<{
  items: UserActionAuditRecord[];
  uploads: UserActionDiagnosticUploadRecord[];
}> {
  const [auditData, uploadData] = await Promise.all([
    apiFetch('/admin/security/action-audit-events?limit=500', {method: 'GET'}),
    apiFetch('/admin/security/action-diagnostic-uploads?limit=500', {method: 'GET'}).catch(() => ({items: []})),
  ]);

  return {
    items: toArray<Record<string, unknown>>(asObject(auditData).items).map((item) => ({
      id: stringValue(item.id),
      intentId: stringValue(item.intent_id || item.intentId),
      traceId: stringValue(item.trace_id || item.traceId),
      userId: stringValue(item.user_id || item.userId),
      deviceId: stringValue(item.device_id || item.deviceId),
      appName: stringValue(item.app_name || item.appName),
      agentId: stringValue(item.agent_id || item.agentId),
      skillSlug: stringValue(item.skill_slug || item.skillSlug),
      workflowId: stringValue(item.workflow_id || item.workflowId),
      capability: stringValue(item.capability),
      riskLevel: (stringValue(item.risk_level || item.riskLevel) || 'medium') as UserActionAuditRecord['riskLevel'],
      requiresElevation: Boolean(item.requires_elevation ?? item.requiresElevation),
      decision: (stringValue(item.decision) || 'pending') as UserActionAuditRecord['decision'],
      stage: (stringValue(item.stage) || 'intent_created') as UserActionAuditRecord['stage'],
      summary: stringValue(item.summary),
      reason: stringValue(item.reason),
      resources: toArray<Record<string, unknown>>(item.resources),
      matchedPolicyRuleId: stringValue(item.matched_policy_rule_id || item.matchedPolicyRuleId),
      approvedPlanHash: stringValue(item.approved_plan_hash || item.approvedPlanHash),
      executedPlanHash: stringValue(item.executed_plan_hash || item.executedPlanHash),
      commandSnapshotRedacted: stringValue(item.command_snapshot_redacted || item.commandSnapshotRedacted),
      resultCode: stringValue(item.result_code || item.resultCode),
      resultSummary: stringValue(item.result_summary || item.resultSummary),
      durationMs: typeof item.duration_ms === 'number' ? item.duration_ms : typeof item.durationMs === 'number' ? item.durationMs : null,
      createdAt: stringValue(item.created_at || item.createdAt),
    })),
    uploads: toArray<Record<string, unknown>>(asObject(uploadData).items).map((item) => ({
      id: stringValue(item.id),
      userId: stringValue(item.user_id || item.userId),
      deviceId: stringValue(item.device_id || item.deviceId),
      appName: stringValue(item.app_name || item.appName),
      uploadBucket: stringValue(item.upload_bucket || item.uploadBucket),
      uploadKey: stringValue(item.upload_key || item.uploadKey),
      fileName: stringValue(item.file_name || item.fileName),
      fileSizeBytes: numberValue(item.file_size_bytes || item.fileSizeBytes),
      sha256: stringValue(item.sha256),
      sourceType: stringValue(item.source_type || item.sourceType),
      containsCustomerLogs: Boolean(item.contains_customer_logs ?? item.containsCustomerLogs),
      sensitivityLevel: (stringValue(item.sensitivity_level || item.sensitivityLevel) || 'internal') as UserActionDiagnosticUploadRecord['sensitivityLevel'],
      linkedIntentId: stringValue(item.linked_intent_id || item.linkedIntentId),
      createdAt: stringValue(item.created_at || item.createdAt),
    })),
  };
}

export async function loadDesktopDiagnosticUploads(input: {
  userId?: string;
  deviceId?: string;
  appName?: string;
  sourceType?: string;
  limit?: number;
} = {}): Promise<UserActionDiagnosticUploadRecord[]> {
  const params = new URLSearchParams();
  if (stringValue(input.userId)) params.set('user_id', stringValue(input.userId));
  if (stringValue(input.deviceId)) params.set('device_id', stringValue(input.deviceId));
  if (stringValue(input.appName)) params.set('app_name', stringValue(input.appName));
  if (stringValue(input.sourceType)) params.set('source_type', stringValue(input.sourceType));
  params.set('limit', String(Math.max(1, numberValue(input.limit || 500))));

  const data = await apiFetch(`/admin/security/action-diagnostic-uploads?${params.toString()}`, {method: 'GET'});
  return toArray<Record<string, unknown>>(asObject(data).items).map((item) => ({
    id: stringValue(item.id),
    userId: stringValue(item.user_id || item.userId),
    deviceId: stringValue(item.device_id || item.deviceId),
    appName: stringValue(item.app_name || item.appName),
    uploadBucket: stringValue(item.upload_bucket || item.uploadBucket),
    uploadKey: stringValue(item.upload_key || item.uploadKey),
    fileName: stringValue(item.file_name || item.fileName),
    fileSizeBytes: numberValue(item.file_size_bytes || item.fileSizeBytes),
    sha256: stringValue(item.sha256),
    sourceType: stringValue(item.source_type || item.sourceType),
    containsCustomerLogs: Boolean(item.contains_customer_logs ?? item.containsCustomerLogs),
    sensitivityLevel: (stringValue(item.sensitivity_level || item.sensitivityLevel) || 'internal') as UserActionDiagnosticUploadRecord['sensitivityLevel'],
    linkedIntentId: stringValue(item.linked_intent_id || item.linkedIntentId),
    createdAt: stringValue(item.created_at || item.createdAt),
  }));
}

export async function loadDesktopFaultReports(input: {
  q?: string;
  platform?: string;
  entry?: string;
  accountState?: string;
  deviceId?: string;
  appVersion?: string;
  limit?: number;
} = {}): Promise<DesktopFaultReportSummaryRecord[]> {
  const params = new URLSearchParams();
  if (input.q?.trim()) params.set('report_id', input.q.trim());
  if (input.platform?.trim()) params.set('platform', input.platform.trim());
  if (input.entry?.trim()) params.set('entry', input.entry.trim());
  if (input.accountState?.trim()) params.set('account_state', input.accountState.trim());
  if (input.deviceId?.trim()) params.set('device_id', input.deviceId.trim());
  if (input.appVersion?.trim()) params.set('app_version', input.appVersion.trim());
  params.set('limit', String(input.limit && input.limit > 0 ? input.limit : 500));
  const data = await apiFetch(`/admin/desktop/fault-reports?${params.toString()}`, { method: 'GET' });
  return toArray<Record<string, unknown>>(asObject(data).items).map((item) => ({
    id: stringValue(item.id),
    reportId: stringValue(item.report_id || item.reportId),
    entry: (stringValue(item.entry) || 'installer') as DesktopFaultReportSummaryRecord['entry'],
    accountState: (stringValue(item.account_state || item.accountState) || 'anonymous') as DesktopFaultReportSummaryRecord['accountState'],
    userId: stringValue(item.user_id || item.userId),
    deviceId: stringValue(item.device_id || item.deviceId),
    installSessionId: stringValue(item.install_session_id || item.installSessionId),
    appName: stringValue(item.app_name || item.appName),
    brandId: stringValue(item.brand_id || item.brandId),
    appVersion: stringValue(item.app_version || item.appVersion),
    releaseChannel: stringValue(item.release_channel || item.releaseChannel),
    platform: stringValue(item.platform),
    platformVersion: stringValue(item.platform_version || item.platformVersion),
    arch: stringValue(item.arch),
    failureStage: stringValue(item.failure_stage || item.failureStage),
    errorTitle: stringValue(item.error_title || item.errorTitle),
    errorMessage: stringValue(item.error_message || item.errorMessage),
    errorCode: stringValue(item.error_code || item.errorCode),
    fileName: stringValue(item.file_name || item.fileName),
    fileSizeBytes: numberValue(item.file_size_bytes || item.fileSizeBytes),
    fileSha256: stringValue(item.file_sha256 || item.fileSha256),
    createdAt: stringValue(item.created_at || item.createdAt),
  }));
}

export async function getDesktopFaultReportDetail(id: string): Promise<DesktopFaultReportDetailRecord> {
  const data = await apiFetch(`/admin/desktop/fault-reports/${encodeURIComponent(id)}`, { method: 'GET' });
  const item = asObject(data);
  return {
    id: stringValue(item.id),
    reportId: stringValue(item.report_id || item.reportId),
    entry: (stringValue(item.entry) || 'installer') as DesktopFaultReportDetailRecord['entry'],
    accountState: (stringValue(item.account_state || item.accountState) || 'anonymous') as DesktopFaultReportDetailRecord['accountState'],
    userId: stringValue(item.user_id || item.userId),
    deviceId: stringValue(item.device_id || item.deviceId),
    installSessionId: stringValue(item.install_session_id || item.installSessionId),
    appName: stringValue(item.app_name || item.appName),
    brandId: stringValue(item.brand_id || item.brandId),
    appVersion: stringValue(item.app_version || item.appVersion),
    releaseChannel: stringValue(item.release_channel || item.releaseChannel),
    platform: stringValue(item.platform),
    platformVersion: stringValue(item.platform_version || item.platformVersion),
    arch: stringValue(item.arch),
    failureStage: stringValue(item.failure_stage || item.failureStage),
    errorTitle: stringValue(item.error_title || item.errorTitle),
    errorMessage: stringValue(item.error_message || item.errorMessage),
    errorCode: stringValue(item.error_code || item.errorCode),
    fileName: stringValue(item.file_name || item.fileName),
    fileSizeBytes: numberValue(item.file_size_bytes || item.fileSizeBytes),
    fileSha256: stringValue(item.file_sha256 || item.fileSha256),
    createdAt: stringValue(item.created_at || item.createdAt),
    runtimeFound: Boolean(item.runtime_found ?? item.runtimeFound),
    runtimeInstallable: Boolean(item.runtime_installable ?? item.runtimeInstallable),
    runtimeVersion: stringValue(item.runtime_version || item.runtimeVersion),
    runtimePath: stringValue(item.runtime_path || item.runtimePath),
    workDir: stringValue(item.work_dir || item.workDir),
    logDir: stringValue(item.log_dir || item.logDir),
    runtimeDownloadUrl: stringValue(item.runtime_download_url || item.runtimeDownloadUrl),
    installProgressPhase: stringValue(item.install_progress_phase || item.installProgressPhase),
    installProgressPercent:
      typeof item.install_progress_percent === 'number'
        ? item.install_progress_percent
        : typeof item.installProgressPercent === 'number'
          ? item.installProgressPercent
          : null,
    uploadBucket: stringValue(item.upload_bucket || item.uploadBucket),
    uploadKey: stringValue(item.upload_key || item.uploadKey),
    downloadUrl: stringValue(item.download_url || item.downloadUrl),
  };
}

export async function downloadDesktopFaultReportFile(input: {
  id: string;
  fileName?: string;
}): Promise<void> {
  let tokens = loadTokens();
  if (!tokens?.access_token) {
    throw new Error('缺少登录令牌，请重新登录后再试。');
  }

  const request = async (accessToken: string) =>
    fetch(`${API_BASE_URL}/admin/desktop/fault-reports/${encodeURIComponent(input.id)}/download`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

  let response = await request(tokens.access_token);
  if (response.status === 401 && tokens?.refresh_token) {
    tokens = await refreshToken(tokens).catch(() => null);
    if (!tokens?.access_token) {
      throw new Error('登录状态已失效，请重新登录后再试。');
    }
    response = await request(tokens.access_token);
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error?.message || `下载失败：${response.status}`);
  }

  const blob = await response.blob();
  const fallbackName = (input.fileName || '').trim() || `desktop-fault-report-${input.id}.zip`;
  const objectUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fallbackName;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
}

export async function downloadDesktopDiagnosticUploadFile(input: {
  id: string;
  fileName?: string;
}): Promise<void> {
  let tokens = loadTokens();
  if (!tokens?.access_token) {
    throw new Error('缺少登录令牌，请重新登录后再试。');
  }

  const request = async (accessToken: string) =>
    fetch(`${API_BASE_URL}/admin/security/action-diagnostic-uploads/${encodeURIComponent(input.id)}/download`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

  let response = await request(tokens.access_token);
  if (response.status === 401 && tokens?.refresh_token) {
    tokens = await refreshToken(tokens).catch(() => null);
    if (!tokens?.access_token) {
      throw new Error('登录状态已失效，请重新登录后再试。');
    }
    response = await request(tokens.access_token);
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error?.message || `下载失败：${response.status}`);
  }

  const blob = await response.blob();
  const fallbackName = (input.fileName || '').trim() || `desktop-diagnostic-upload-${input.id}.zip`;
  const objectUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fallbackName;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
}

export async function loadClientMetricEvents(input: {
  eventName?: string;
  appVersion?: string;
  platform?: string;
  result?: string;
  limit?: number;
} = {}): Promise<ClientMetricEventRecord[]> {
  const params = new URLSearchParams();
  if (input.eventName?.trim()) params.set('event_name', input.eventName.trim());
  if (input.appVersion?.trim()) params.set('app_version', input.appVersion.trim());
  if (input.platform?.trim()) params.set('platform', input.platform.trim());
  if (input.result?.trim()) params.set('result', input.result.trim());
  params.set('limit', String(input.limit && input.limit > 0 ? input.limit : 500));
  const data = await apiFetch(`/admin/client-metrics/events?${params.toString()}`, { method: 'GET' });
  return toArray<Record<string, unknown>>(asObject(data).items).map((item) => ({
    id: stringValue(item.id),
    eventName: stringValue(item.event_name || item.eventName),
    eventTime: stringValue(item.event_time || item.eventTime),
    userId: stringValue(item.user_id || item.userId),
    deviceId: stringValue(item.device_id || item.deviceId),
    sessionId: stringValue(item.session_id || item.sessionId),
    installId: stringValue(item.install_id || item.installId),
    appName: stringValue(item.app_name || item.appName),
    brandId: stringValue(item.brand_id || item.brandId),
    appVersion: stringValue(item.app_version || item.appVersion),
    releaseChannel: stringValue(item.release_channel || item.releaseChannel),
    platform: stringValue(item.platform),
    osVersion: stringValue(item.os_version || item.osVersion),
    arch: stringValue(item.arch),
    page: stringValue(item.page),
    result: (stringValue(item.result) || null) as ClientMetricEventRecord['result'],
    errorCode: stringValue(item.error_code || item.errorCode),
    durationMs:
      typeof item.duration_ms === 'number'
        ? item.duration_ms
        : typeof item.durationMs === 'number'
          ? item.durationMs
          : null,
    payload: asObject(item.payload),
    createdAt: stringValue(item.created_at || item.createdAt),
  }));
}

export async function loadClientCrashEvents(input: {
  appVersion?: string;
  platform?: string;
  crashType?: string;
  limit?: number;
} = {}): Promise<ClientCrashEventRecord[]> {
  const params = new URLSearchParams();
  if (input.appVersion?.trim()) params.set('app_version', input.appVersion.trim());
  if (input.platform?.trim()) params.set('platform', input.platform.trim());
  if (input.crashType?.trim()) params.set('crash_type', input.crashType.trim());
  params.set('limit', String(input.limit && input.limit > 0 ? input.limit : 200));
  const data = await apiFetch(`/admin/client-metrics/crashes?${params.toString()}`, { method: 'GET' });
  return toArray<Record<string, unknown>>(asObject(data).items).map((item) => ({
    id: stringValue(item.id),
    crashType: (stringValue(item.crash_type || item.crashType) || 'renderer') as ClientCrashEventRecord['crashType'],
    eventTime: stringValue(item.event_time || item.eventTime),
    userId: stringValue(item.user_id || item.userId),
    deviceId: stringValue(item.device_id || item.deviceId),
    appName: stringValue(item.app_name || item.appName),
    brandId: stringValue(item.brand_id || item.brandId),
    appVersion: stringValue(item.app_version || item.appVersion),
    platform: stringValue(item.platform),
    osVersion: stringValue(item.os_version || item.osVersion),
    arch: stringValue(item.arch),
    errorTitle: stringValue(item.error_title || item.errorTitle),
    errorMessage: stringValue(item.error_message || item.errorMessage),
    stackSummary: stringValue(item.stack_summary || item.stackSummary),
    fileBucket: stringValue(item.file_bucket || item.fileBucket),
    fileKey: stringValue(item.file_key || item.fileKey),
    createdAt: stringValue(item.created_at || item.createdAt),
  }));
}

export async function loadClientPerfSamples(input: {
  metricName?: string;
  appVersion?: string;
  platform?: string;
  limit?: number;
} = {}): Promise<ClientPerfSampleRecord[]> {
  const params = new URLSearchParams();
  if (input.metricName?.trim()) params.set('metric_name', input.metricName.trim());
  if (input.appVersion?.trim()) params.set('app_version', input.appVersion.trim());
  if (input.platform?.trim()) params.set('platform', input.platform.trim());
  params.set('limit', String(input.limit && input.limit > 0 ? input.limit : 200));
  const data = await apiFetch(`/admin/client-metrics/perf?${params.toString()}`, { method: 'GET' });
  return toArray<Record<string, unknown>>(asObject(data).items).map((item) => ({
    id: stringValue(item.id),
    metricName: (stringValue(item.metric_name || item.metricName) || 'cold_start_ms') as ClientPerfSampleRecord['metricName'],
    metricTime: stringValue(item.metric_time || item.metricTime),
    userId: stringValue(item.user_id || item.userId),
    deviceId: stringValue(item.device_id || item.deviceId),
    appName: stringValue(item.app_name || item.appName),
    brandId: stringValue(item.brand_id || item.brandId),
    appVersion: stringValue(item.app_version || item.appVersion),
    releaseChannel: stringValue(item.release_channel || item.releaseChannel),
    platform: stringValue(item.platform),
    osVersion: stringValue(item.os_version || item.osVersion),
    arch: stringValue(item.arch),
    value: numberValue(item.value),
    unit: stringValue(item.unit),
    sampleRate:
      typeof item.sample_rate === 'number'
        ? item.sample_rate
        : typeof item.sampleRate === 'number'
          ? item.sampleRate
          : null,
    payload: asObject(item.payload),
    createdAt: stringValue(item.created_at || item.createdAt),
  }));
}

export async function saveBrandTheme(
  detail: BrandDetailData,
  input: {
    defaultMode: 'light' | 'dark' | 'system';
    lightPrimary: string;
    lightPrimaryHover: string;
    lightOnPrimary: string;
    darkPrimary: string;
    darkPrimaryHover: string;
    darkOnPrimary: string;
  },
) {
  const nextConfig = JSON.parse(JSON.stringify(detail.appConfig || {}));
  const theme = asObject(nextConfig.theme);
  const light = asObject(theme.light);
  const dark = asObject(theme.dark);

  nextConfig.theme = {
    ...theme,
    defaultMode: input.defaultMode,
    default_mode: input.defaultMode,
    light: {
      ...light,
      primary: input.lightPrimary.trim(),
      primaryHover: input.lightPrimaryHover.trim(),
      onPrimary: input.lightOnPrimary.trim(),
    },
    dark: {
      ...dark,
      primary: input.darkPrimary.trim(),
      primaryHover: input.darkPrimaryHover.trim(),
      onPrimary: input.darkOnPrimary.trim(),
    },
  };

  await apiFetch(`/admin/portal/apps/${encodeURIComponent(detail.brand.brandId)}`, {
    method: 'PUT',
    body: JSON.stringify({
      displayName: detail.brand.displayName,
      status: detail.brand.status === 'disabled' ? 'disabled' : 'active',
      defaultLocale: detail.brand.defaultLocale || 'zh-CN',
      config: nextConfig,
    }),
  });
}

export async function saveBrandBaseInfo(
  detail: BrandDetailData,
  input: {
    displayName: string;
    productName: string;
    tenantKey: string;
    defaultLocale: string;
    status: string;
  },
) {
  const nextConfig = cloneConfig(detail.appConfig || {});
  const displayName = input.displayName.trim() || detail.brand.brandId;
  const productName = input.productName.trim() || displayName;
  const tenantKey = input.tenantKey.trim() || detail.brand.brandId;
  const defaultLocale = input.defaultLocale.trim() || 'zh-CN';
  const status = input.status === 'disabled' ? 'disabled' : 'active';

  nextConfig.productName = productName;
  nextConfig.product_name = productName;
  nextConfig.tenantKey = tenantKey;
  nextConfig.tenant_key = tenantKey;

  const brandMeta = asObject(nextConfig.brand_meta);
  nextConfig.brand_meta = {
    ...brandMeta,
    brand_id: detail.brand.brandId,
    display_name: displayName,
    product_name: productName,
    tenant_key: tenantKey,
    legal_name: stringValue(brandMeta.legal_name || displayName),
    storage_namespace: tenantKey,
  };
  const brandMetaCamel = asObject(nextConfig.brandMeta);
  nextConfig.brandMeta = {
    ...brandMetaCamel,
    displayName,
    productName,
    tenantKey,
    legalName: stringValue(brandMetaCamel.legalName || displayName),
    storageNamespace: tenantKey,
  };

  await apiFetch(`/admin/portal/apps/${encodeURIComponent(detail.brand.brandId)}`, {
    method: 'PUT',
    body: JSON.stringify({
      displayName,
      status,
      defaultLocale,
      config: nextConfig,
    }),
  });
}

export async function saveBrandSkills(
  detail: BrandDetailData,
  selectedSkillSlugs: string[],
  platformManagedSkillSlugs: string[] = [],
) {
  const platformManaged = new Set(platformManagedSkillSlugs.map((item) => item.trim()).filter(Boolean));
  const existingBindings = new Map(
    detail.skillBindings
      .map((item) => [stringValue(item.skillSlug), item] as const)
      .filter(([slug]) => Boolean(slug)),
  );
  const payload = Array.from(new Set(selectedSkillSlugs.map((item) => item.trim()).filter(Boolean)))
    .filter((slug) => !platformManaged.has(slug))
    .map((skillSlug, index) => ({
      skillSlug,
      enabled: true,
      sortOrder: (index + 1) * 10,
      config: asObject(existingBindings.get(skillSlug)?.config),
    }));

  await apiFetch(`/admin/portal/apps/${encodeURIComponent(detail.brand.brandId)}/skills`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function saveBrandMcps(
  detail: BrandDetailData,
  selectedMcpKeys: string[],
  platformManagedMcpKeys: string[] = [],
) {
  const platformManaged = new Set(platformManagedMcpKeys.map((item) => item.trim()).filter(Boolean));
  const existingBindings = new Map(
    detail.mcpBindings
      .map((item) => [stringValue(item.mcpKey), item] as const)
      .filter(([key]) => Boolean(key)),
  );
  const payload = Array.from(new Set(selectedMcpKeys.map((item) => item.trim()).filter(Boolean)))
    .filter((mcpKey) => !platformManaged.has(mcpKey))
    .map((mcpKey, index) => ({
      mcpKey,
      enabled: true,
      sortOrder: (index + 1) * 10,
      config: asObject(existingBindings.get(mcpKey)?.config),
    }));

  await apiFetch(`/admin/portal/apps/${encodeURIComponent(detail.brand.brandId)}/mcps`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function saveBrandRechargePackages(
  detail: BrandDetailData,
  selectedPackageIds: string[],
) {
  const existingBindings = new Map(
    detail.rechargePackageBindings
      .map((item) => [stringValue(item.packageId || item.package_id), item] as const)
      .filter(([packageId]) => Boolean(packageId)),
  );
  const normalized = Array.from(new Set(selectedPackageIds.map((item) => item.trim()).filter(Boolean)));
  const existingDefault =
    normalized.find((packageId) => {
      const binding = asObject(existingBindings.get(packageId));
      return binding.default === true || binding.is_default === true;
    }) || normalized[0] || '';
  const payload = normalized.map((packageId, index) => {
    const binding = asObject(existingBindings.get(packageId));
    return {
      packageId,
      enabled: true,
      sortOrder: (index + 1) * 10,
      recommended: binding.recommended === true,
      default: packageId === existingDefault,
      config: {},
    };
  });

  await apiFetch(`/admin/portal/apps/${encodeURIComponent(detail.brand.brandId)}/recharge-packages`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function saveBrandModels(
  detail: BrandDetailData,
  items: Array<{
    modelRef: string;
    enabled: boolean;
    recommended: boolean;
    default: boolean;
  }>,
) {
  const existingBindings = new Map(
    detail.modelBindings
      .map((item) => [stringValue(item.modelRef || item.model_ref), item] as const)
      .filter(([modelRef]) => Boolean(modelRef)),
  );
  const payload = items
    .filter((item) => item.enabled && item.modelRef.trim())
    .map((item, index) => ({
      modelRef: item.modelRef.trim(),
      enabled: true,
      sortOrder: (index + 1) * 10,
      config: {
        ...asObject(asObject(existingBindings.get(item.modelRef))?.config),
        recommended: item.recommended === true,
        default: item.default === true,
      },
    }));

  await apiFetch(`/admin/portal/apps/${encodeURIComponent(detail.brand.brandId)}/models`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function saveBrandComposerControls(
  detail: BrandDetailData,
  items: Array<{
    controlKey: string;
    enabled: boolean;
    displayName: string;
    allowedOptionValues: string[];
  }>,
) {
  const existingBindings = new Map(
    detail.composerControlBindings
      .map((item) => [stringValue(item.controlKey || item.control_key), item] as const)
      .filter(([controlKey]) => Boolean(controlKey)),
  );
  const payload = items.map((item, index) => {
    const existing = asObject(existingBindings.get(item.controlKey));
    const existingConfig = asObject(existing.config);
    return {
      controlKey: item.controlKey,
      enabled: item.enabled,
      sortOrder: (index + 1) * 10,
      config: {
        ...existingConfig,
        display_name: item.displayName.trim(),
        allowed_option_values: item.allowedOptionValues.map((entry) => entry.trim()).filter(Boolean),
      },
    };
  });
  await apiFetch(`/admin/portal/apps/${encodeURIComponent(detail.brand.brandId)}/composer-controls`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function saveBrandComposerShortcuts(
  detail: BrandDetailData,
  items: Array<{
    shortcutKey: string;
    enabled: boolean;
    displayName: string;
    description: string;
    template: string;
  }>,
) {
  const existingBindings = new Map(
    detail.composerShortcutBindings
      .map((item) => [stringValue(item.shortcutKey || item.shortcut_key), item] as const)
      .filter(([shortcutKey]) => Boolean(shortcutKey)),
  );
  const payload = items.map((item, index) => {
    const existing = asObject(existingBindings.get(item.shortcutKey));
    const existingConfig = asObject(existing.config);
    return {
      shortcutKey: item.shortcutKey,
      enabled: item.enabled,
      sortOrder: (index + 1) * 10,
      config: {
        ...existingConfig,
        display_name: item.displayName.trim(),
        description: item.description.trim(),
        template: item.template,
      },
    };
  });
  await apiFetch(`/admin/portal/apps/${encodeURIComponent(detail.brand.brandId)}/composer-shortcuts`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function saveBrandDesktopShell(
  detail: BrandDetailData,
  input: {
    websiteTitle: string;
    devWebsiteTitle: string;
    sidebarTitle: string;
    devSidebarTitle: string;
    sidebarSubtitle: string;
    legalName: string;
    bundleIdentifier: string;
    authService: string;
  },
) {
  const nextConfig = JSON.parse(JSON.stringify(detail.appConfig || {}));
  nextConfig.websiteTitle = input.websiteTitle.trim();
  nextConfig.website_title = input.websiteTitle.trim();
  nextConfig.devWebsiteTitle = input.devWebsiteTitle.trim();
  nextConfig.dev_website_title = input.devWebsiteTitle.trim();
  nextConfig.sidebarTitle = input.sidebarTitle.trim();
  nextConfig.sidebar_title = input.sidebarTitle.trim();
  nextConfig.devSidebarTitle = input.devSidebarTitle.trim();
  nextConfig.dev_sidebar_title = input.devSidebarTitle.trim();
  nextConfig.sidebarSubtitle = input.sidebarSubtitle.trim();
  nextConfig.sidebar_subtitle = input.sidebarSubtitle.trim();
  nextConfig.legalName = input.legalName.trim();
  nextConfig.legal_name = input.legalName.trim();
  nextConfig.bundleIdentifier = input.bundleIdentifier.trim();
  nextConfig.bundle_identifier = input.bundleIdentifier.trim();
  nextConfig.authService = input.authService.trim();
  nextConfig.auth_service = input.authService.trim();

  const brandMeta = asObject(nextConfig.brand_meta);
  nextConfig.brand_meta = {
    ...brandMeta,
    legal_name: input.legalName.trim(),
  };
  const brandMetaCamel = asObject(nextConfig.brandMeta);
  nextConfig.brandMeta = {
    ...brandMetaCamel,
    legalName: input.legalName.trim(),
  };

  await apiFetch(`/admin/portal/apps/${encodeURIComponent(detail.brand.brandId)}`, {
    method: 'PUT',
    body: JSON.stringify({
      displayName: detail.brand.displayName,
      status: detail.brand.status === 'disabled' ? 'disabled' : 'active',
      defaultLocale: detail.brand.defaultLocale || 'zh-CN',
      config: nextConfig,
    }),
  });
}

export async function saveBrandAuthExperience(
  detail: BrandDetailData,
  input: {
    title: string;
    subtitle: string;
    socialNotice: string;
    agreements: Array<{
      key: string;
      title: string;
      version: string;
      effectiveDate: string;
      summary: string;
      content: string;
    }>;
  },
) {
  const nextConfig = JSON.parse(JSON.stringify(detail.appConfig || {}));
  nextConfig.auth_experience = {
    title: input.title.trim(),
    subtitle: input.subtitle.trim(),
    social_notice: input.socialNotice.trim(),
    agreements: input.agreements.map((item) => ({
      key: item.key,
      title: item.title.trim(),
      version: item.version.trim(),
      effective_date: item.effectiveDate.trim(),
      summary: item.summary.trim(),
      content: item.content.trim(),
    })),
  };
  nextConfig.authExperience = {
    title: input.title.trim(),
    subtitle: input.subtitle.trim(),
    socialNotice: input.socialNotice.trim(),
    agreements: input.agreements.map((item) => ({
      key: item.key,
      title: item.title.trim(),
      version: item.version.trim(),
      effectiveDate: item.effectiveDate.trim(),
      summary: item.summary.trim(),
      content: item.content.trim(),
    })),
  };

  await apiFetch(`/admin/portal/apps/${encodeURIComponent(detail.brand.brandId)}`, {
    method: 'PUT',
    body: JSON.stringify({
      displayName: detail.brand.displayName,
      status: detail.brand.status === 'disabled' ? 'disabled' : 'active',
      defaultLocale: detail.brand.defaultLocale || 'zh-CN',
      config: nextConfig,
    }),
  });
}

export async function saveBrandSidebar(
  detail: BrandDetailData,
  input: {
    enabled: boolean;
    variant: string;
    brandTitle: string;
    brandSubtitle: string;
    sectionStyle: string;
    emphasizeActiveItem: boolean;
  },
) {
  const nextConfig = JSON.parse(JSON.stringify(detail.appConfig || {}));
  const surfaces = asObject(nextConfig.surfaces);
  const existingSidebar = asObject(surfaces.sidebar);
  nextConfig.surfaces = {
    ...surfaces,
    sidebar: {
      ...existingSidebar,
      enabled: input.enabled,
      config: {
        variant: input.variant.trim(),
        brandBlock: {
          title: input.brandTitle.trim(),
          subtitle: input.brandSubtitle.trim(),
        },
        layout: {
          sectionStyle: input.sectionStyle.trim(),
          emphasizeActiveItem: input.emphasizeActiveItem,
        },
      },
    },
  };

  await apiFetch(`/admin/portal/apps/${encodeURIComponent(detail.brand.brandId)}`, {
    method: 'PUT',
    body: JSON.stringify({
      displayName: detail.brand.displayName,
      status: detail.brand.status === 'disabled' ? 'disabled' : 'active',
      defaultLocale: detail.brand.defaultLocale || 'zh-CN',
      config: nextConfig,
    }),
  });
}

export async function saveBrandHeader(
  detail: BrandDetailData,
  input: {
    enabled: boolean;
    statusLabel: string;
    liveStatusLabel: string;
    showLiveBadge: boolean;
    showQuotes: boolean;
    showHeadlines: boolean;
    showSecurityBadge: boolean;
    securityLabel: string;
    showCredits: boolean;
    showRechargeButton: boolean;
    rechargeLabel: string;
    showModeBadge: boolean;
    modeBadgeLabel: string;
    fallbackQuotes: Array<{
      label: string;
      value: string;
      change: number;
      changePercent: string;
    }>;
    fallbackHeadlines: Array<{
      title: string;
      source: string;
      href: string;
    }>;
  },
) {
  const nextConfig = JSON.parse(JSON.stringify(detail.appConfig || {}));
  const surfaces = asObject(nextConfig.surfaces);
  const existingHeader = asObject(surfaces.header);
  nextConfig.surfaces = {
    ...surfaces,
    header: {
      ...existingHeader,
      enabled: input.enabled,
      config: {
        status_label: input.statusLabel.trim(),
        live_status_label: input.liveStatusLabel.trim(),
        show_live_badge: input.showLiveBadge,
        show_quotes: input.showQuotes,
        show_headlines: input.showHeadlines,
        show_security_badge: input.showSecurityBadge,
        security_label: input.securityLabel.trim(),
        show_credits: input.showCredits,
        show_recharge_button: input.showRechargeButton,
        recharge_label: input.rechargeLabel.trim(),
        show_mode_badge: input.showModeBadge,
        mode_badge_label: input.modeBadgeLabel.trim(),
        fallback_quotes: input.fallbackQuotes.map((item) => ({
          label: item.label.trim(),
          value: item.value.trim(),
          change: Number(item.change || 0),
          change_percent: item.changePercent.trim(),
        })),
        fallback_headlines: input.fallbackHeadlines.map((item) => ({
          title: item.title.trim(),
          source: item.source.trim(),
          href: item.href.trim(),
        })),
      },
    },
  };

  await apiFetch(`/admin/portal/apps/${encodeURIComponent(detail.brand.brandId)}`, {
    method: 'PUT',
    body: JSON.stringify({
      displayName: detail.brand.displayName,
      status: detail.brand.status === 'disabled' ? 'disabled' : 'active',
      defaultLocale: detail.brand.defaultLocale || 'zh-CN',
      config: nextConfig,
    }),
  });
}

export async function saveBrandInputSurface(
  detail: BrandDetailData,
  input: {
    enabled: boolean;
    placeholderText: string;
  },
) {
  const nextConfig = JSON.parse(JSON.stringify(detail.appConfig || {}));
  const surfaces = asObject(nextConfig.surfaces);
  const existingInput = asObject(surfaces.input);
  nextConfig.surfaces = {
    ...surfaces,
    input: {
      ...existingInput,
      enabled: input.enabled,
      config: {
        placeholder_text: input.placeholderText.trim(),
      },
    },
  };

  await apiFetch(`/admin/portal/apps/${encodeURIComponent(detail.brand.brandId)}`, {
    method: 'PUT',
    body: JSON.stringify({
      displayName: detail.brand.displayName,
      status: detail.brand.status === 'disabled' ? 'disabled' : 'active',
      defaultLocale: detail.brand.defaultLocale || 'zh-CN',
      config: nextConfig,
    }),
  });
}

export async function saveBrandWelcomeSurface(
  detail: BrandDetailData,
  input: {
    enabled: boolean;
    entryLabel: string;
    kolName: string;
    expertName: string;
    slogan: string;
    avatarUrl: string;
    backgroundImageUrl: string;
    primaryColor: string;
    description: string;
    expertiseAreas: string[];
    targetAudience: string;
    disclaimer: string;
    quickActions: Array<{
      label: string;
      prompt: string;
      iconKey: string;
    }>;
  },
) {
  const nextConfig = JSON.parse(JSON.stringify(detail.appConfig || {}));
  const surfaces = asObject(nextConfig.surfaces);
  const existingWelcome = asObject(surfaces.welcome);
  nextConfig.surfaces = {
    ...surfaces,
    welcome: {
      ...existingWelcome,
      enabled: input.enabled,
      config: {
        entry_label: input.entryLabel.trim(),
        kol_name: input.kolName.trim(),
        expert_name: input.expertName.trim(),
        slogan: input.slogan.trim(),
        avatar_url: input.avatarUrl.trim(),
        background_image_url: input.backgroundImageUrl.trim(),
        primary_color: input.primaryColor.trim(),
        description: input.description.trim(),
        expertise_areas: input.expertiseAreas.map((item) => item.trim()).filter(Boolean),
        target_audience: input.targetAudience.trim(),
        disclaimer: input.disclaimer.trim(),
        quick_actions: input.quickActions.map((item) => ({
          label: item.label.trim(),
          prompt: item.prompt.trim(),
          icon_key: item.iconKey.trim(),
        })),
      },
    },
  };

  await apiFetch(`/admin/portal/apps/${encodeURIComponent(detail.brand.brandId)}`, {
    method: 'PUT',
    body: JSON.stringify({
      displayName: detail.brand.displayName,
      status: detail.brand.status === 'disabled' ? 'disabled' : 'active',
      defaultLocale: detail.brand.defaultLocale || 'zh-CN',
      config: nextConfig,
    }),
  });
}

export async function saveBrandHomeWebSurface(
  detail: BrandDetailData,
  input: {
    enabled: boolean;
    templateKey: string;
    headerEnabled: boolean;
    headerVariant: string;
    headerBrandLabel: string;
    headerSubline: string;
    headerNavItemsText: string;
    headerPrimaryCtaLabel: string;
    headerPrimaryCtaHref: string;
    footerEnabled: boolean;
    footerVariant: string;
    footerColumnsText: string;
    footerLegalLinksText: string;
    footerCopyrightText: string;
    footerIcpText: string;
    homeSeoTitle: string;
    homeSeoDescription: string;
    heroEyebrow: string;
    heroTitlePre: string;
    heroTitleMain: string;
    heroDescription: string;
    downloadTitle: string;
    privacyTitle: string;
    privacyContent: string;
    termsTitle: string;
    termsContent: string;
  },
) {
  const nextConfig = JSON.parse(JSON.stringify(detail.appConfig || {}));
  const surfaces = asObject(nextConfig.surfaces);
  const existingHomeWeb = asObject(surfaces['home-web']);
  const homeConfig = JSON.parse(JSON.stringify(asObject(existingHomeWeb.config || {})));

  const website = asObject(homeConfig.website);
  website.homeTitle = input.homeSeoTitle.trim();
  website.metaDescription = input.homeSeoDescription.trim();
  website.brandLabel = input.headerBrandLabel.trim();
  website.kicker = input.heroEyebrow.trim();
  website.heroTitlePre = input.heroTitlePre.trim();
  website.heroTitleMain = input.heroTitleMain.trim();
  website.heroDescription = input.heroDescription.trim();
  website.topCtaLabel = input.headerPrimaryCtaLabel.trim();
  website.downloadTitle = input.downloadTitle.trim();
  website.scrollLabel = stringValue(website.scrollLabel || '向下下载') || '向下下载';
  homeConfig.website = website;

  homeConfig.templateKey = input.templateKey.trim();

  const siteShell = asObject(homeConfig.siteShell);
  siteShell.header = {
    enabled: input.headerEnabled,
    variant: input.headerVariant.trim(),
    props: {
      brandLabel: input.headerBrandLabel.trim(),
      subline: input.headerSubline.trim(),
      navItems: parseLabelHrefLines(input.headerNavItemsText),
      primaryCta: {
        label: input.headerPrimaryCtaLabel.trim(),
        href: input.headerPrimaryCtaHref.trim(),
      },
    },
  };
  siteShell.footer = {
    enabled: input.footerEnabled,
    variant: input.footerVariant.trim(),
    props: {
      columns: [
        {
          title: '站点',
          links: parseLabelHrefLines(input.footerColumnsText),
        },
      ],
      legalLinks: parseLabelHrefLines(input.footerLegalLinksText),
      copyrightText: input.footerCopyrightText.trim(),
      icpText: input.footerIcpText.trim(),
    },
  };
  homeConfig.siteShell = siteShell;
  homeConfig.marketingSite = {
    ...(asObject(homeConfig.marketingSite)),
    templateKey: input.templateKey.trim(),
    siteShell: JSON.parse(JSON.stringify(siteShell)),
    pages: Array.isArray(asObject(homeConfig.marketingSite).pages) ? asObject(homeConfig.marketingSite).pages : homeConfig.pages,
  };

  const pages = Array.isArray(homeConfig.pages) ? homeConfig.pages : [];
  const homePage = upsertPage(pages, 'home', '/');
  homePage.enabled = true;
  homePage.seo = {
    ...(asObject(homePage.seo)),
    title: input.homeSeoTitle.trim(),
    description: input.homeSeoDescription.trim(),
  };
  const heroBlock = upsertBlock(homePage, 'hero.', 'hero.basic', 10);
  heroBlock.props = {
    ...(asObject(heroBlock.props)),
    eyebrow: input.heroEyebrow.trim(),
    titlePre: input.heroTitlePre.trim(),
    titleMain: input.heroTitleMain.trim(),
    description: input.heroDescription.trim(),
  };
  const downloadBlock = upsertBlock(homePage, 'download-grid.', 'download-grid.classic', 20);
  downloadBlock.props = {
    ...(asObject(downloadBlock.props)),
    title: input.downloadTitle.trim(),
  };

  const privacyPage = upsertPage(pages, 'privacy', '/privacy');
  privacyPage.enabled = true;
  const privacyBlock = upsertBlock(privacyPage, 'rich-text.', 'rich-text.legal', 10);
  privacyBlock.props = {
    ...(asObject(privacyBlock.props)),
    title: input.privacyTitle.trim(),
    content: input.privacyContent.trim(),
  };

  const termsPage = upsertPage(pages, 'terms', '/terms');
  termsPage.enabled = true;
  const termsBlock = upsertBlock(termsPage, 'rich-text.', 'rich-text.legal', 10);
  termsBlock.props = {
    ...(asObject(termsBlock.props)),
    title: input.termsTitle.trim(),
    content: input.termsContent.trim(),
  };

  homeConfig.pages = pages;
  if (homeConfig.marketingSite && typeof homeConfig.marketingSite === 'object') {
    homeConfig.marketingSite.pages = JSON.parse(JSON.stringify(pages));
  }

  nextConfig.surfaces = {
    ...surfaces,
    'home-web': {
      ...existingHomeWeb,
      enabled: input.enabled,
      config: homeConfig,
    },
  };

  await apiFetch(`/admin/portal/apps/${encodeURIComponent(detail.brand.brandId)}`, {
    method: 'PUT',
    body: JSON.stringify({
      displayName: detail.brand.displayName,
      status: detail.brand.status === 'disabled' ? 'disabled' : 'active',
      defaultLocale: detail.brand.defaultLocale || 'zh-CN',
      config: nextConfig,
    }),
  });
}

export async function savePlatformSkillBinding(input: {
  slug: string;
  active: boolean;
  metadata?: Record<string, unknown>;
}) {
  if (!input.slug.trim()) {
    throw new Error('请填写 cloud skill slug');
  }
  await apiFetch(`/admin/portal/catalog/skills/${encodeURIComponent(input.slug.trim())}`, {
    method: 'PUT',
    body: JSON.stringify({
      metadata: asObject(input.metadata),
      active: input.active,
    }),
  });
}

export async function deletePlatformSkillBinding(slug: string) {
  const normalized = slug.trim();
  if (!normalized) return;
  await apiFetch(`/admin/portal/catalog/skills/${encodeURIComponent(normalized)}`, {
    method: 'DELETE',
  });
}

export async function savePlatformMcpBinding(input: {
  key: string;
  active: boolean;
  metadata?: Record<string, unknown>;
}) {
  if (!input.key.trim()) {
    throw new Error('请填写 MCP key');
  }
  await apiFetch(`/admin/portal/catalog/mcps/${encodeURIComponent(input.key.trim())}`, {
    method: 'PUT',
    body: JSON.stringify({
      metadata: asObject(input.metadata),
      active: input.active,
    }),
  });
}

export async function deletePlatformMcpBinding(key: string) {
  const normalized = key.trim();
  if (!normalized) return;
  await apiFetch(`/admin/portal/catalog/mcps/${encodeURIComponent(normalized)}`, {
    method: 'DELETE',
  });
}

export async function saveCloudMcpCatalogEntry(input: {
  key: string;
  name: string;
  description: string;
  transport: string;
  objectKey: string;
  enabled: boolean;
  command: string;
  argsText: string;
  httpUrl: string;
  envText: string;
  metadata?: Record<string, unknown>;
}) {
  const splitLines = (value: string) =>
    value
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
  const parseEnvText = (raw: string) =>
    raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .reduce<Record<string, string>>((accumulator, line) => {
        const separatorIndex = line.indexOf('=');
        if (separatorIndex <= 0) return accumulator;
        const key = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim();
        if (!key) return accumulator;
        accumulator[key] = value;
        return accumulator;
      }, {});

  await apiFetch('/admin/mcp/catalog', {
    method: 'PUT',
    body: JSON.stringify({
      key: input.key.trim(),
      name: input.name.trim(),
      description: input.description.trim(),
      transport: input.transport.trim() || 'config',
      object_key: input.objectKey.trim() || null,
      enabled: input.enabled,
      command: input.command.trim() || null,
      args: splitLines(input.argsText),
      http_url: input.httpUrl.trim() || null,
      env: parseEnvText(input.envText),
      metadata: asObject(input.metadata),
    }),
  });
}

export async function deleteCloudMcpCatalogEntry(key: string) {
  const normalized = key.trim();
  if (!normalized) return;
  await apiFetch(`/admin/mcp/catalog?key=${encodeURIComponent(normalized)}`, {
    method: 'DELETE',
  });
}

export async function testCloudMcpCatalogEntry(input: {
  key: string;
  name: string;
  description: string;
  transport: string;
  objectKey: string;
  enabled: boolean;
  command: string;
  argsText: string;
  httpUrl: string;
  envText: string;
}) {
  const splitLines = (value: string) =>
    value
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
  const parseEnvText = (raw: string) =>
    raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .reduce<Record<string, string>>((accumulator, line) => {
        const separatorIndex = line.indexOf('=');
        if (separatorIndex <= 0) return accumulator;
        const key = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim();
        if (!key) return accumulator;
        accumulator[key] = value;
        return accumulator;
      }, {});

  return await apiFetch('/admin/mcp/test', {
    method: 'POST',
    body: JSON.stringify({
      key: input.key.trim(),
      name: input.name.trim(),
      transport: input.transport.trim() || 'config',
      object_key: input.objectKey.trim() || null,
      command: input.command.trim() || null,
      args: splitLines(input.argsText),
      http_url: input.httpUrl.trim() || null,
      env: parseEnvText(input.envText),
    }),
  });
}

export async function saveSkillSyncSource(input: {
  id?: string;
  sourceType: string;
  sourceKey: string;
  displayName: string;
  sourceUrl: string;
  config?: Record<string, unknown>;
  active: boolean;
}) {
  await apiFetch('/admin/skills/sync/sources', {
    method: 'PUT',
    body: JSON.stringify({
      id: input.id?.trim() || undefined,
      source_type: input.sourceType.trim() || 'github_repo',
      source_key: input.sourceKey.trim(),
      display_name: input.displayName.trim(),
      source_url: input.sourceUrl.trim(),
      config: asObject(input.config),
      active: input.active,
    }),
  });
}

export async function fetchCloudSkillsCatalogPage(input: { query?: string; offset?: number; limit?: number }) {
  const query = stringValue(input.query);
  const offset = Math.max(0, numberValue(input.offset));
  const limit = Math.max(1, numberValue(input.limit || 100));
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (query) {
    params.set('query', query);
  }
  return await apiFetch(`/admin/skills/catalog?${params.toString()}`, { method: 'GET' });
}

export async function runSkillSync(sourceId: string) {
  return await apiFetch('/admin/skills/sync/run', {
    method: 'POST',
    body: JSON.stringify({
      source_id: sourceId.trim(),
    }),
  });
}

export async function setCloudSkillEnabled(skill: {
  slug: string;
  name: string;
  description: string;
  market?: string;
  category?: string;
  skillType?: string;
  publisher: string;
  distribution?: string;
  tags: string[];
  version: string;
  artifactUrl?: string;
  artifactFormat?: string;
  artifactSha256?: string;
  artifactSourcePath?: string;
  originType: string;
  sourceUrl?: string;
  metadata: Record<string, unknown>;
}, enabled: boolean) {
  await apiFetch('/admin/skills/catalog', {
    method: 'PUT',
    body: JSON.stringify({
      slug: skill.slug,
      name: skill.name,
      description: skill.description,
      market: skill.market || null,
      category: skill.category || null,
      skill_type: skill.skillType || null,
      publisher: skill.publisher,
      distribution: skill.distribution || null,
      tags: skill.tags || [],
      version: skill.version,
      artifact_url: skill.artifactUrl || null,
      artifact_format: skill.artifactFormat || null,
      artifact_sha256: skill.artifactSha256 || null,
      artifact_source_path: skill.distribution === 'bundled' ? (skill.artifactSourcePath || null) : null,
      origin_type: skill.originType,
      source_url: skill.sourceUrl || null,
      metadata: asObject(skill.metadata),
      active: enabled,
    }),
  });
}

export async function fetchPaymentOrderDetail(orderId: string) {
  const normalized = orderId.trim();
  if (!normalized) return null;
  return await apiFetch(`/admin/payments/orders/${encodeURIComponent(normalized)}`, { method: 'GET' });
}

export async function markPaymentOrderPaid(
  orderId: string,
  input: {
    providerOrderId: string;
    paidAt: string;
    note: string;
  },
) {
  const normalized = orderId.trim();
  if (!normalized) return null;
  return await apiFetch(`/admin/payments/orders/${encodeURIComponent(normalized)}/mark-paid`, {
    method: 'POST',
    body: JSON.stringify({
      provider_order_id: input.providerOrderId.trim(),
      paid_at: input.paidAt.trim(),
      note: input.note.trim(),
    }),
  });
}

export async function refundPaymentOrder(
  orderId: string,
  input: {
    note: string;
  },
) {
  const normalized = orderId.trim();
  if (!normalized) return null;
  return await apiFetch(`/admin/payments/orders/${encodeURIComponent(normalized)}/refund`, {
    method: 'POST',
    body: JSON.stringify({
      note: input.note.trim(),
    }),
  });
}

export async function savePlatformModelCatalogEntry(input: {
  ref: string;
  label: string;
  providerId: string;
  modelId: string;
  api: string;
  baseUrl: string;
  useRuntimeOpenai: boolean;
  authHeader: boolean;
  reasoning: boolean;
  inputText: string;
  contextWindow: number;
  maxTokens: number;
  active: boolean;
}) {
  const splitLines = (value: string) =>
    value
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);

  await apiFetch('/admin/portal/catalog/models', {
    method: 'PUT',
    body: JSON.stringify({
      ref: input.ref.trim(),
      label: input.label.trim(),
      providerId: input.providerId.trim(),
      modelId: input.modelId.trim(),
      api: input.api.trim() || 'openai-completions',
      baseUrl: input.baseUrl.trim() || null,
      useRuntimeOpenai: input.useRuntimeOpenai,
      authHeader: input.authHeader,
      reasoning: input.reasoning,
      input: splitLines(input.inputText),
      contextWindow: Number(input.contextWindow || 0) || 0,
      maxTokens: Number(input.maxTokens || 0) || 0,
      metadata: {},
      active: input.active,
    }),
  });
}

export async function deletePlatformModelCatalogEntry(ref: string) {
  const normalized = ref.trim();
  if (!normalized) return;
  await apiFetch(`/admin/portal/catalog/models?ref=${encodeURIComponent(normalized)}`, {
    method: 'DELETE',
  });
}

async function apiUploadBinary(path: string, file: File, contentType?: string) {
  const tokens = loadTokens();
  const headers = new Headers();
  if (tokens?.access_token) {
    headers.set('Authorization', `Bearer ${tokens.access_token}`);
  }
  headers.set('Content-Type', contentType || file.type || 'application/octet-stream');
  headers.set('x-iclaw-file-name', file.name || 'artifact.bin');
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'PUT',
    headers,
    body: file,
  });
  if (response.status === 401 && tokens?.refresh_token) {
    const refreshed = await refreshToken(tokens).catch(() => null);
    if (refreshed?.access_token) {
      return apiUploadBinary(path, file, contentType);
    }
  }
  return await parseResponse(response);
}

function inferBinaryContentType(file: File) {
  const name = String(file?.name || '').toLowerCase();
  if (name.endsWith('.dmg')) return 'application/x-apple-diskimage';
  if (name.endsWith('.exe')) return 'application/vnd.microsoft.portable-executable';
  if (name.endsWith('.app.tar.gz') || name.endsWith('.tar.gz') || name.endsWith('.tgz')) return 'application/gzip';
  if (name.endsWith('.nsis.zip') || name.endsWith('.zip')) return 'application/zip';
  if (name.endsWith('.sig')) return 'text/plain; charset=utf-8';
  return file?.type || 'application/octet-stream';
}

export async function saveRuntimeRelease(input: {
  id?: string;
  runtimeKind: string;
  version: string;
  channel: string;
  platform: string;
  arch: string;
  targetTriple: string;
  artifactUrl: string;
  bucketName: string;
  objectKey: string;
  artifactSha256: string;
  artifactSizeBytes: number;
  launcherRelativePath: string;
  gitCommit: string;
  gitTag: string;
  releaseVersion: string;
  buildTime: string;
  status: string;
}) {
  await apiFetch('/admin/portal/runtime-releases', {
    method: 'PUT',
    body: JSON.stringify({
      id: input.id?.trim() || null,
      runtimeKind: input.runtimeKind.trim(),
      version: input.version.trim(),
      channel: input.channel.trim(),
      platform: input.platform.trim(),
      arch: input.arch.trim(),
      targetTriple: input.targetTriple.trim(),
      artifactUrl: input.artifactUrl.trim(),
      bucketName: input.bucketName.trim() || null,
      objectKey: input.objectKey.trim() || null,
      artifactSha256: input.artifactSha256.trim() || null,
      artifactSizeBytes: Number(input.artifactSizeBytes || 0) || null,
      launcherRelativePath: input.launcherRelativePath.trim() || null,
      gitCommit: input.gitCommit.trim() || null,
      gitTag: input.gitTag.trim() || null,
      releaseVersion: input.releaseVersion.trim() || null,
      buildTime: input.buildTime.trim() || null,
      status: input.status.trim() || 'draft',
    }),
  });
}

export async function saveRuntimeBinding(input: {
  id?: string;
  scopeType: string;
  scopeKey: string;
  runtimeKind: string;
  channel: string;
  platform: string;
  arch: string;
  targetTriple: string;
  releaseId: string;
  enabled: boolean;
  changeReason: string;
}) {
  await apiFetch('/admin/portal/runtime-bindings', {
    method: 'PUT',
    body: JSON.stringify({
      id: input.id?.trim() || null,
      scopeType: input.scopeType.trim() === 'app' ? 'app' : 'platform',
      scopeKey: input.scopeKey.trim(),
      runtimeKind: input.runtimeKind.trim(),
      channel: input.channel.trim(),
      platform: input.platform.trim(),
      arch: input.arch.trim(),
      targetTriple: input.targetTriple.trim(),
      releaseId: input.releaseId.trim(),
      enabled: input.enabled,
      changeReason: input.changeReason.trim() || null,
    }),
  });
}

export async function importRuntimeBootstrapSource(input: {
  channel: 'prod' | 'dev';
  bindScopeType: 'none' | 'platform' | 'app';
  bindScopeKey?: string;
}) {
  const bindScopeType =
    input.bindScopeType === 'platform'
      ? 'platform'
      : input.bindScopeType === 'app'
        ? 'app'
        : 'none';
  return await apiFetch('/admin/portal/runtime-bootstrap-source/import', {
    method: 'POST',
    body: JSON.stringify({
      channel: input.channel === 'dev' ? 'dev' : 'prod',
      bind_scope_type: bindScopeType === 'none' ? null : bindScopeType,
      bind_scope_key:
        bindScopeType === 'app'
          ? stringValue(input.bindScopeKey)
          : bindScopeType === 'platform'
            ? 'platform'
            : null,
    }),
  });
}

export async function publishDesktopRelease(input: {
  brandId: string;
  channel: string;
  version: string;
  notes: string;
  enforcementMode: 'recommended' | 'required_after_run' | 'required_now';
  forceUpdateBelowVersion: string;
  reasonMessage: string;
  files: Record<string, File | null>;
}) {
  const slots: Array<[string, string, string]> = [
    ['darwin', 'aarch64', 'installer'],
    ['darwin', 'aarch64', 'updater'],
    ['darwin', 'aarch64', 'signature'],
    ['darwin', 'x64', 'installer'],
    ['darwin', 'x64', 'updater'],
    ['darwin', 'x64', 'signature'],
    ['windows', 'x64', 'installer'],
    ['windows', 'x64', 'updater'],
    ['windows', 'x64', 'signature'],
    ['windows', 'aarch64', 'installer'],
    ['windows', 'aarch64', 'updater'],
    ['windows', 'aarch64', 'signature'],
  ];

  for (const [platform, arch, artifactType] of slots) {
    const fieldName = `desktop_file_${platform}_${arch}_${artifactType}`;
    const file = input.files[fieldName];
    if (!(file instanceof File) || file.size === 0) continue;
    await apiUploadBinary(
      `/admin/portal/apps/${encodeURIComponent(input.brandId)}/desktop-release/${encodeURIComponent(input.channel)}/${encodeURIComponent(platform)}/${encodeURIComponent(arch)}/${encodeURIComponent(artifactType)}`,
      file,
      inferBinaryContentType(file),
    );
  }

  const mandatory = input.enforcementMode === 'required_after_run' || input.enforcementMode === 'required_now';
  const allowCurrentRunToFinish = input.enforcementMode !== 'required_now';
  await apiFetch(`/admin/portal/apps/${encodeURIComponent(input.brandId)}/desktop-release/${encodeURIComponent(input.channel)}/publish`, {
    method: 'POST',
    body: JSON.stringify({
      version: input.version.trim(),
      notes: input.notes.trim() || null,
      mandatory,
      force_update_below_version: input.forceUpdateBelowVersion.trim() || null,
      allow_current_run_to_finish: allowCurrentRunToFinish,
      reason_code: mandatory ? (input.enforcementMode === 'required_now' ? 'mandatory_immediate' : 'stability_hotfix') : null,
      reason_message: input.reasonMessage.trim() || null,
    }),
  });
}

export async function saveModelProviderProfile(input: {
  profileId?: string;
  scopeType: string;
  scopeKey: string;
  providerMode: string;
  providerKey: string;
  baseUrl: string;
  apiKey: string;
  logoPresetKey: string;
  defaultModelRef: string;
  models: Array<{
    label: string;
    modelId: string;
    logoPresetKey: string;
    billingMultiplier: number;
  }>;
}) {
  let savedProfile: { id?: string } | null = null;
  let effectiveProviderMode = input.providerMode;
  const shouldSaveProfile =
    input.scopeType === 'platform' ||
    input.providerMode === 'use_app_profile' ||
    Boolean(input.providerKey.trim());

  if (shouldSaveProfile) {
    if (
      input.scopeType === 'app' &&
      input.providerMode !== 'use_app_profile' &&
      (input.providerKey.trim() || input.baseUrl.trim() || input.apiKey.trim() || input.models.length > 0)
    ) {
      effectiveProviderMode = 'use_app_profile';
    }
    savedProfile = await apiFetch('/admin/portal/model-provider-profiles', {
      method: 'PUT',
      body: JSON.stringify({
        id: input.profileId?.trim() || null,
        scopeType: input.scopeType,
        scopeKey: input.scopeKey,
        providerKey: input.providerKey.trim(),
        providerLabel: input.providerKey.trim(),
        apiProtocol: 'openai-completions',
        baseUrl: input.baseUrl.trim(),
        authMode: 'bearer',
        apiKey: input.apiKey.trim(),
        logoPresetKey: input.logoPresetKey.trim() || null,
        metadata: input.defaultModelRef.trim() ? { default_model_ref: input.defaultModelRef.trim() } : {},
        enabled: true,
        sortOrder: 100,
        models: input.models.map((item, index) => ({
          label: item.label.trim(),
          modelId: item.modelId.trim(),
          logoPresetKey: item.logoPresetKey.trim() || null,
          billingMultiplier: Number(item.billingMultiplier || 1) || 1,
          reasoning: false,
          inputModalities: ['text'],
          contextWindow: null,
          maxTokens: null,
          enabled: true,
          sortOrder: 100 + index,
          metadata: {},
        })).filter((item) => item.modelId && item.label),
      }),
    });
  }

  if (input.scopeType === 'app') {
    await apiFetch(`/admin/portal/apps/${encodeURIComponent(input.scopeKey)}/model-provider-override`, {
      method: 'PUT',
      body: JSON.stringify({
        providerMode: effectiveProviderMode,
        activeProfileId:
          effectiveProviderMode === 'use_app_profile'
            ? savedProfile?.id || input.profileId?.trim() || null
            : null,
        cacheVersion: Date.now(),
      }),
    });
  }
}

export async function saveMemoryEmbeddingProfile(input: {
  profileId?: string;
  scopeType: string;
  scopeKey: string;
  providerKey: string;
  baseUrl: string;
  apiKey: string;
  embeddingModel: string;
  logoPresetKey: string;
  autoRecall: boolean;
}) {
  const preflight = await apiFetch('/admin/portal/memory-embedding-profiles/preflight', {
    method: 'POST',
    body: JSON.stringify({
      providerKey: input.providerKey.trim(),
      baseUrl: input.baseUrl.trim(),
      authMode: 'bearer',
      apiKey: input.apiKey.trim(),
      embeddingModel: input.embeddingModel.trim(),
    }),
  });

  await apiFetch('/admin/portal/memory-embedding-profiles', {
    method: 'PUT',
    body: JSON.stringify({
      id: input.profileId?.trim() || null,
      scopeType: input.scopeType,
      scopeKey: input.scopeKey,
      providerKey: input.providerKey.trim(),
      providerLabel: input.providerKey.trim(),
      baseUrl: input.baseUrl.trim(),
      authMode: 'bearer',
      apiKey: input.apiKey.trim(),
      embeddingModel: input.embeddingModel.trim(),
      logoPresetKey: input.logoPresetKey.trim() || null,
      autoRecall: input.autoRecall,
      metadata: {},
      enabled: true,
    }),
  });

  return preflight;
}

export async function testMemoryEmbeddingProfile(input: {
  providerKey: string;
  baseUrl: string;
  apiKey: string;
  embeddingModel: string;
}) {
  return await apiFetch('/admin/portal/memory-embedding-profiles/preflight', {
    method: 'POST',
    body: JSON.stringify({
      providerKey: input.providerKey.trim(),
      baseUrl: input.baseUrl.trim(),
      authMode: 'bearer',
      apiKey: input.apiKey.trim(),
      embeddingModel: input.embeddingModel.trim(),
    }),
  });
}

export async function restorePlatformModelProvider(appName: string) {
  const normalized = appName.trim();
  if (!normalized) return;
  await apiFetch(`/admin/portal/apps/${encodeURIComponent(normalized)}/model-provider-override`, {
    method: 'PUT',
    body: JSON.stringify({
      providerMode: 'inherit_platform',
      activeProfileId: null,
      cacheVersion: Date.now(),
    }),
  });
}

export async function restorePlatformMemoryEmbedding(profileId: string) {
  const normalized = profileId.trim();
  if (!normalized) return;
  await apiFetch(`/admin/portal/memory-embedding-profiles?id=${encodeURIComponent(normalized)}`, {
    method: 'DELETE',
  });
}

export async function readFileAsBase64(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.slice(result.indexOf(',') + 1) : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error || new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

export async function uploadBrandAssetByBrandId(
  brandId: string,
  input: {
    assetKey: string;
    kind: string;
    metadata?: Record<string, unknown>;
    file: File;
  },
) {
  const normalizedBrandId = brandId.trim();
  const normalizedAssetKey = input.assetKey.trim();
  if (!normalizedBrandId) {
    throw new Error('请选择资源所属品牌');
  }
  if (!normalizedAssetKey) {
    throw new Error('请输入 Asset Key');
  }
  if (!(input.file instanceof File) || input.file.size === 0) {
    throw new Error('请选择要上传的资源文件');
  }
  const fileBase64 = await readFileAsBase64(input.file);
  await apiFetch(`/admin/portal/apps/${encodeURIComponent(normalizedBrandId)}/assets/${encodeURIComponent(normalizedAssetKey)}/upload`, {
    method: 'POST',
    body: JSON.stringify({
      content_type: input.file.type || 'application/octet-stream',
      file_name: input.file.name,
      file_base64: fileBase64,
      metadata: {
        ...asObject(input.metadata),
        kind: input.kind.trim(),
      },
    }),
  });
}

export async function uploadBrandAsset(
  detail: BrandDetailData,
  input: {
    assetKey: string;
    kind: string;
    metadata?: Record<string, unknown>;
    file: File;
  },
) {
  await uploadBrandAssetByBrandId(detail.brand.brandId, input);
}

export async function deleteBrandAsset(brandId: string, assetKey: string) {
  const normalizedBrandId = brandId.trim();
  const normalizedAssetKey = assetKey.trim();
  if (!normalizedBrandId || !normalizedAssetKey) {
    throw new Error('缺少要删除的资源标识');
  }
  await apiFetch(`/admin/portal/apps/${encodeURIComponent(normalizedBrandId)}/assets/${encodeURIComponent(normalizedAssetKey)}`, {
    method: 'DELETE',
  });
}

export async function publishBrandSnapshot(brandId: string) {
  const normalizedBrandId = brandId.trim();
  if (!normalizedBrandId) {
    throw new Error('缺少品牌标识');
  }
  await apiFetch(`/admin/portal/apps/${encodeURIComponent(normalizedBrandId)}/publish`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function restoreBrandVersion(brandId: string, version: string) {
  const normalizedBrandId = brandId.trim();
  const normalizedVersion = version.trim();
  if (!normalizedBrandId || !normalizedVersion) {
    throw new Error('缺少品牌或版本信息');
  }
  await apiFetch(`/admin/portal/apps/${encodeURIComponent(normalizedBrandId)}/restore`, {
    method: 'POST',
    body: JSON.stringify({ version: normalizedVersion }),
  });
}

export async function saveAgentCatalogEntry(input: {
  slug: string;
  name: string;
  description: string;
  category: string;
  publisher: string;
  featured: boolean;
  official: boolean;
  tags: string[];
  capabilities: string[];
  useCases: string[];
  metadata: Record<string, unknown>;
  sortOrder: number;
  active: boolean;
}) {
  const slug = input.slug.trim();
  if (!slug) {
    throw new Error('请填写 Agent slug');
  }
  await apiFetch('/admin/agents/catalog', {
    method: 'PUT',
    body: JSON.stringify({
      slug,
      name: input.name.trim(),
      description: input.description.trim(),
      category: input.category.trim() || 'general',
      publisher: input.publisher.trim() || 'admin-web',
      featured: input.featured === true,
      official: input.official !== false,
      tags: input.tags.map((item) => item.trim()).filter(Boolean),
      capabilities: input.capabilities.map((item) => item.trim()).filter(Boolean),
      use_cases: input.useCases.map((item) => item.trim()).filter(Boolean),
      metadata: asObject(input.metadata),
      sort_order: Number(input.sortOrder || 9999) || 9999,
      active: input.active !== false,
    }),
  });
}

export async function deleteAgentCatalogEntry(slug: string) {
  const normalized = slug.trim();
  if (!normalized) {
    throw new Error('缺少要删除的 Agent');
  }
  await apiFetch(`/admin/agents/catalog?slug=${encodeURIComponent(normalized)}`, {
    method: 'DELETE',
  });
}

export async function savePaymentGatewayConfig(input: {
  provider: string;
  scopeType: 'platform' | 'app';
  scopeKey: string;
  mode: 'inherit_platform' | 'use_app_config';
  configValues: Record<string, string>;
  secretValues: Record<string, string>;
}) {
  const scopeType = input.scopeType === 'app' ? 'app' : 'platform';
  const scopeKey = scopeType === 'app' ? input.scopeKey.trim() : 'platform';
  await apiFetch('/admin/payments/gateway-config', {
    method: 'PUT',
    body: JSON.stringify({
      provider: input.provider.trim() || 'epay',
      scope_type: scopeType,
      scope_key: scopeKey,
      mode: scopeType === 'app' ? input.mode : 'use_app_config',
      config_values: input.configValues,
      secret_values: input.secretValues,
    }),
  });
}

export async function savePaymentProviderProfile(input: {
  profileId: string;
  provider: string;
  scopeType: 'platform' | 'app';
  scopeKey: string;
  mode: 'inherit_platform' | 'use_app_profile';
  displayName: string;
  enabled: boolean;
  configValues: Record<string, string>;
  secretValues: Record<string, string>;
}) {
  const hasAnyValues = [...Object.values(input.configValues), ...Object.values(input.secretValues)].some((item) => String(item || '').trim());
  const shouldSaveProfile =
    input.scopeType === 'platform' ||
    input.mode === 'use_app_profile' ||
    Boolean(input.profileId.trim()) ||
    hasAnyValues;

  let savedProfileId = input.profileId.trim();
  if (shouldSaveProfile) {
    const saved = await apiFetch('/admin/payments/provider-profiles', {
      method: 'PUT',
      body: JSON.stringify({
        id: savedProfileId || null,
        provider: input.provider.trim() || PRIMARY_PAYMENT_PROVIDER,
        scope_type: input.scopeType,
        scope_key: input.scopeKey.trim() || (input.scopeType === 'platform' ? 'platform' : ''),
        channel_kind: 'wechat_service_provider',
        display_name: input.displayName.trim(),
        enabled: input.enabled !== false,
        config_values: input.configValues,
        secret_values: input.secretValues,
      }),
    });
    savedProfileId = stringValue(asObject(saved).id);
  }

  if (input.scopeType === 'app') {
    await apiFetch(`/admin/payments/provider-bindings/${encodeURIComponent(input.scopeKey.trim())}`, {
      method: 'PUT',
      body: JSON.stringify({
        provider: input.provider.trim() || PRIMARY_PAYMENT_PROVIDER,
        mode: input.mode,
        active_profile_id: input.mode === 'use_app_profile' ? savedProfileId || null : null,
      }),
    });
  }
}

export async function saveOemRechargePaymentMethodConfig(input: {
  brandId: string;
  displayName: string;
  status: string;
  defaultLocale: string;
  appConfig: Record<string, unknown>;
  useOverride: boolean;
  items: Array<{
    provider: string;
    label: string;
    enabled: boolean;
    default: boolean;
    sortOrder: number;
    metadata: Record<string, unknown>;
  }>;
}) {
  const nextConfig = cloneConfig(input.appConfig || {});
  const surfaces = { ...asObject(nextConfig.surfaces) };
  const rechargeSurface = { ...asObject(surfaces.recharge) };
  const rechargeConfig = { ...asObject(rechargeSurface.config) };
  if (input.useOverride) {
    rechargeConfig.payment_methods = input.items.map((item) => ({
      provider: item.provider,
      label: item.label,
      enabled: item.enabled !== false,
      is_default: item.default === true,
      sort_order: Number(item.sortOrder || 0),
      metadata: asObject(item.metadata),
    }));
    delete rechargeConfig.paymentMethods;
  } else {
    delete rechargeConfig.payment_methods;
    delete rechargeConfig.paymentMethods;
  }
  rechargeSurface.config = rechargeConfig;
  surfaces.recharge = rechargeSurface;
  nextConfig.surfaces = surfaces;

  await apiFetch(`/admin/portal/apps/${encodeURIComponent(input.brandId)}`, {
    method: 'PUT',
    body: JSON.stringify({
      displayName: input.displayName,
      status: input.status === 'disabled' ? 'disabled' : 'active',
      defaultLocale: input.defaultLocale || 'zh-CN',
      config: nextConfig,
    }),
  });
}

export async function saveRechargePackageCatalogEntry(input: {
  packageId: string;
  packageName: string;
  credits: number;
  bonusCredits: number;
  amountCnyFen: number;
  sortOrder: number;
  recommended: boolean;
  default: boolean;
  active: boolean;
  description: string;
  badgeLabel: string;
  highlight: string;
  featureList: string[];
}) {
  if (!input.packageId.trim()) {
    throw new Error('请填写 package_id');
  }
  await apiFetch(`/admin/portal/catalog/recharge-packages/${encodeURIComponent(input.packageId.trim())}`, {
    method: 'PUT',
    body: JSON.stringify({
      packageName: input.packageName.trim(),
      credits: Number(input.credits || 0) || 0,
      bonusCredits: Number(input.bonusCredits || 0) || 0,
      amountCnyFen: Number(input.amountCnyFen || 0) || 0,
      sortOrder: Number(input.sortOrder || 0) || 0,
      recommended: input.recommended === true,
      default: input.default === true,
      active: input.active !== false,
      metadata: {
        description: input.description.trim(),
        badge_label: input.badgeLabel.trim(),
        highlight: input.highlight.trim(),
        feature_list: input.featureList.map((item) => item.trim()).filter(Boolean),
      },
    }),
  });
}

export async function deleteRechargePackageCatalogEntry(packageId: string) {
  const normalized = packageId.trim();
  if (!normalized) return;
  await apiFetch(`/admin/portal/catalog/recharge-packages/${encodeURIComponent(normalized)}`, {
    method: 'DELETE',
  });
}

export async function restoreRecommendedRechargePackages() {
  return await apiFetch('/admin/portal/catalog/recharge-packages/restore-recommended', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function createBrand(input: {
  brandId: string;
  displayName: string;
  productName: string;
  tenantKey: string;
  menuCatalog: Array<{ key: string; enabledByDefault?: boolean }>;
  composerControlCatalog: Array<{ controlKey: string; active: boolean }>;
  composerShortcutCatalog: Array<{ shortcutKey: string; active: boolean }>;
}) {
  const brandId = input.brandId.trim().toLowerCase();
  const displayName = input.displayName.trim();
  const productName = input.productName.trim();
  const tenantKey = (input.tenantKey.trim() || brandId).trim();
  if (!brandId) {
    throw new Error('请填写 brand_id');
  }

  const DEFAULT_SURFACE_KEYS = ['desktop', 'home-web', 'welcome', 'auth', 'header', 'sidebar', 'input', 'skill-store', 'mcp-store', 'lobster-store', 'investment-experts', 'security', 'memory', 'data-connections', 'im-bots', 'task-center'];

  await apiFetch(`/admin/portal/apps/${encodeURIComponent(brandId)}`, {
    method: 'PUT',
    body: JSON.stringify({
      displayName,
      status: 'active',
      defaultLocale: 'zh-CN',
      config: {
        productName,
        product_name: productName,
        tenantKey,
        tenant_key: tenantKey,
        brand_meta: {
          brand_id: brandId,
          display_name: displayName || brandId,
          product_name: productName || displayName || brandId,
          tenant_key: tenantKey,
          legal_name: displayName || brandId,
          storage_namespace: tenantKey,
        },
        brandMeta: {
          productName,
          tenantKey,
        },
        surfaces: Object.fromEntries(DEFAULT_SURFACE_KEYS.map((key) => [key, { enabled: true, config: {} }])),
        theme: {
          light: {},
          dark: {},
        },
      },
    }),
  });

  await apiFetch(`/admin/portal/apps/${encodeURIComponent(brandId)}/menus`, {
    method: 'PUT',
    body: JSON.stringify(
      input.menuCatalog.map((item, index) => ({
        menuKey: item.key,
        enabled: item.enabledByDefault === true,
        sortOrder: (index + 1) * 10,
        config: {},
      })),
    ),
  });

  await Promise.all([
    apiFetch(`/admin/portal/apps/${encodeURIComponent(brandId)}/composer-controls`, {
      method: 'PUT',
      body: JSON.stringify(
        input.composerControlCatalog.map((item, index) => ({
          controlKey: item.controlKey,
          enabled: item.active !== false,
          sortOrder: (index + 1) * 10,
          config: {},
        })),
      ),
    }),
    apiFetch(`/admin/portal/apps/${encodeURIComponent(brandId)}/composer-shortcuts`, {
      method: 'PUT',
      body: JSON.stringify(
        input.composerShortcutCatalog.map((item, index) => ({
          shortcutKey: item.shortcutKey,
          enabled: item.active !== false,
          sortOrder: (index + 1) * 10,
          config: {},
        })),
      ),
    }),
    apiFetch(`/admin/portal/apps/${encodeURIComponent(brandId)}/models`, {
      method: 'PUT',
      body: JSON.stringify([]),
    }),
  ]);

  return brandId;
}

function hasAnyPaymentProviderValues(input: {
  configValues: Record<string, string>;
  secretValues: Record<string, string>;
}) {
  return [...PAYMENT_PROVIDER_CONFIG_FIELDS, ...PAYMENT_PROVIDER_SECRET_FIELDS].some((key) =>
    stringValue(input.configValues[key] || input.secretValues[key] || ''),
  );
}

export async function savePaymentProviderConfig(input: {
  scopeType: 'platform' | 'app';
  scopeKey: string;
  provider?: string;
  mode: 'inherit_platform' | 'use_app_profile';
  profileId?: string;
  displayName: string;
  enabled: boolean;
  configValues: Record<string, string>;
  secretValues: Record<string, string>;
  usePaymentMethodsOverride?: boolean;
  paymentMethodItems?: Array<{
    provider: string;
    label: string;
    enabled: boolean;
    default: boolean;
    sortOrder: number;
    metadata?: Record<string, unknown>;
  }>;
}) {
  const scopeType = input.scopeType === 'app' ? 'app' : 'platform';
  const scopeKey = (scopeType === 'app' ? input.scopeKey : 'platform').trim();
  const provider = input.provider?.trim() || PRIMARY_PAYMENT_PROVIDER;
  if (!scopeKey) {
    throw new Error('缺少支付 Provider 作用域');
  }

  const existingProfile =
    scopeType === 'platform'
      ? null
      : await apiFetch(
          `/admin/payments/provider-profiles?scope_type=${encodeURIComponent(scopeType)}&scope_key=${encodeURIComponent(scopeKey)}&provider=${encodeURIComponent(provider)}`,
          { method: 'GET' },
        )
          .then((response) => toArray<Record<string, unknown>>(asObject(response).items)[0] || null)
          .catch(() => null);

  const shouldSaveProfile =
    scopeType === 'platform' ||
    input.mode === 'use_app_profile' ||
    Boolean(existingProfile) ||
    hasAnyPaymentProviderValues({ configValues: input.configValues, secretValues: input.secretValues });

  let savedProfileId = input.profileId?.trim() || stringValue(asObject(existingProfile).id);

  if (shouldSaveProfile) {
    const savedProfile = await apiFetch('/admin/payments/provider-profiles', {
      method: 'PUT',
      body: JSON.stringify({
        id: savedProfileId || null,
        provider,
        scope_type: scopeType,
        scope_key: scopeKey,
        channel_kind: 'wechat_service_provider',
        display_name: input.displayName.trim(),
        enabled: input.enabled,
        config_values: Object.fromEntries(
          PAYMENT_PROVIDER_CONFIG_FIELDS.map((key) => [key, stringValue(input.configValues[key])]),
        ),
        secret_values: Object.fromEntries(
          PAYMENT_PROVIDER_SECRET_FIELDS.map((key) => [key, String(input.secretValues[key] || '')]),
        ),
      }),
    });
    savedProfileId = stringValue(asObject(savedProfile).id);
  }

  if (scopeType === 'app') {
    await apiFetch(`/admin/payments/provider-bindings/${encodeURIComponent(scopeKey)}`, {
      method: 'PUT',
      body: JSON.stringify({
        provider,
        mode: input.mode,
        active_profile_id: input.mode === 'use_app_profile' ? savedProfileId || null : null,
      }),
    });

    if (Array.isArray(input.paymentMethodItems)) {
      const detail = await loadBrandDetailData(scopeKey);
      await saveOemRechargePaymentMethodConfig({
        brandId: scopeKey,
        displayName: detail.brand.displayName,
        status: detail.brand.status,
        defaultLocale: detail.brand.defaultLocale,
        appConfig: detail.appConfig,
        useOverride: input.usePaymentMethodsOverride === true,
        items: input.paymentMethodItems.map((item) => ({
          ...item,
          metadata: asObject(item.metadata),
        })),
      });
    }
  }
}

export async function saveBrandMenus(
  detail: BrandDetailData,
  items: Array<{
    menuKey: string;
    enabled: boolean;
    displayName: string;
    group: string;
  }>,
) {
  const existingBindings = new Map(
    detail.menuBindings
      .map((item) => [stringValue(item.menuKey || item.menu_key), item] as const)
      .filter(([key]) => Boolean(key)),
  );

  const payload = items.map((item, index) => {
    const existing = asObject(existingBindings.get(item.menuKey));
    const existingConfig = asObject(existing.config);
    const nextConfig: Record<string, unknown> = {
      ...existingConfig,
    };

    if (item.displayName.trim()) {
      nextConfig.display_name = item.displayName.trim();
    } else {
      delete nextConfig.display_name;
      delete nextConfig.displayName;
    }

    if (item.group.trim()) {
      nextConfig.group_label = item.group.trim();
    } else {
      delete nextConfig.group_label;
      delete nextConfig.groupLabel;
      delete nextConfig.group;
    }

    return {
      menuKey: item.menuKey,
      enabled: item.enabled,
      sortOrder: (index + 1) * 10,
      config: nextConfig,
    };
  });

  await apiFetch(`/admin/portal/apps/${encodeURIComponent(detail.brand.brandId)}/menus`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}
