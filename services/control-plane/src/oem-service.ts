import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

import type {McpCatalogEntryRecord, PublicUser, UpsertMcpCatalogEntryInput} from './domain.ts';
import {HttpError} from './errors.ts';
import {deleteOemAssetFile, downloadOemAssetFile, uploadOemAssetFile} from './oem-asset-storage.ts';
import type {PgOemStore} from './oem-store.ts';
import type {ControlPlaneStore} from './store.ts';

const execFileAsync = promisify(execFile);

function normalizeBrandId(value: unknown): string {
  if (typeof value !== 'string') {
    throw new HttpError(400, 'BAD_REQUEST', 'brand_id is required');
  }
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(normalized)) {
    throw new HttpError(400, 'BAD_REQUEST', 'brand_id must be 2-63 chars and use lowercase letters, numbers, hyphen');
  }
  return normalized;
}

function normalizeRequiredString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new HttpError(400, 'BAD_REQUEST', `${field} is required`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new HttpError(400, 'BAD_REQUEST', `${field} is required`);
  }
  return normalized;
}

function normalizeStatus(value: unknown, fallback: 'draft' | 'published' | 'archived' = 'draft') {
  if (value === undefined) {
    return fallback;
  }
  if (value === 'draft' || value === 'published' || value === 'archived') {
    return value;
  }
  throw new HttpError(400, 'BAD_REQUEST', 'status must be draft, published, or archived');
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function cloneObject(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
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

function normalizeOptionalString(value: unknown, field: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new HttpError(400, 'BAD_REQUEST', `${field} must be a string`);
  }
  const normalized = value.trim();
  return normalized || null;
}

function normalizeOptionalBoolean(value: unknown, field: string, fallback: boolean): boolean {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== 'boolean') {
    throw new HttpError(400, 'BAD_REQUEST', `${field} must be a boolean`);
  }
  return value;
}

function parseRequiredBase64(value: unknown, field: string): Buffer {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpError(400, 'BAD_REQUEST', `${field} is required`);
  }
  try {
    const buffer = Buffer.from(value.trim(), 'base64');
    if (buffer.length === 0) {
      throw new Error('empty');
    }
    return buffer;
  } catch {
    throw new HttpError(400, 'BAD_REQUEST', `${field} must be valid base64`);
  }
}

function normalizePositiveInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new HttpError(400, 'BAD_REQUEST', `${field} must be a positive integer`);
  }
  return value;
}

type OemModelCatalogEntry = {
  ref: string;
  label: string;
  providerId: string;
  modelId: string;
  api: string;
  baseUrl: string | null;
  useRuntimeOpenai: boolean;
  authHeader: boolean;
  reasoning: boolean;
  input: string[];
  contextWindow: number;
  maxTokens: number;
};

const OEM_MODEL_CATALOG: OemModelCatalogEntry[] = [
  {
    ref: 'openai/qwen3.5-plus',
    label: 'Qwen3.5 Plus',
    providerId: 'openai',
    modelId: 'qwen3.5-plus',
    api: 'openai-completions',
    baseUrl: null,
    useRuntimeOpenai: true,
    authHeader: true,
    reasoning: true,
    input: ['text', 'image'],
    contextWindow: 131072,
    maxTokens: 8192,
  },
  {
    ref: 'openai/qwen3-coder-plus',
    label: 'Qwen3 Coder Plus',
    providerId: 'openai',
    modelId: 'qwen3-coder-plus',
    api: 'openai-completions',
    baseUrl: null,
    useRuntimeOpenai: true,
    authHeader: true,
    reasoning: true,
    input: ['text'],
    contextWindow: 262144,
    maxTokens: 8192,
  },
  {
    ref: 'openai/qwen3-max',
    label: 'Qwen3 Max',
    providerId: 'openai',
    modelId: 'qwen3-max',
    api: 'openai-completions',
    baseUrl: null,
    useRuntimeOpenai: true,
    authHeader: true,
    reasoning: true,
    input: ['text', 'image'],
    contextWindow: 262144,
    maxTokens: 8192,
  },
  {
    ref: 'openai/MiniMax-M2.7',
    label: 'MiniMax m2.7',
    providerId: 'openai',
    modelId: 'MiniMax-M2.7',
    api: 'openai-completions',
    baseUrl: null,
    useRuntimeOpenai: true,
    authHeader: true,
    reasoning: true,
    input: ['text'],
    contextWindow: 200000,
    maxTokens: 8192,
  },
  {
    ref: 'openai/MiniMax-M2.5',
    label: 'MiniMax m2.5',
    providerId: 'openai',
    modelId: 'MiniMax-M2.5',
    api: 'openai-completions',
    baseUrl: null,
    useRuntimeOpenai: true,
    authHeader: true,
    reasoning: true,
    input: ['text'],
    contextWindow: 200000,
    maxTokens: 8192,
  },
  {
    ref: 'openai/MiniMax-M2.1',
    label: 'MiniMax m2.1',
    providerId: 'openai',
    modelId: 'MiniMax-M2.1',
    api: 'openai-completions',
    baseUrl: null,
    useRuntimeOpenai: true,
    authHeader: true,
    reasoning: true,
    input: ['text'],
    contextWindow: 128000,
    maxTokens: 8192,
  },
  {
    ref: 'openai/kimi-k2.5',
    label: 'Kimi K2.5',
    providerId: 'openai',
    modelId: 'kimi-k2.5',
    api: 'openai-completions',
    baseUrl: null,
    useRuntimeOpenai: true,
    authHeader: true,
    reasoning: false,
    input: ['text', 'image'],
    contextWindow: 256000,
    maxTokens: 8192,
  },
  {
    ref: 'openai/doubao-seed-2.0-code',
    label: 'Doubao Seed-2.0-code',
    providerId: 'openai',
    modelId: 'doubao-seed-2.0-code',
    api: 'openai-completions',
    baseUrl: null,
    useRuntimeOpenai: true,
    authHeader: true,
    reasoning: true,
    input: ['text'],
    contextWindow: 128000,
    maxTokens: 8192,
  },
  {
    ref: 'openai/glm-4.7',
    label: 'GLM 4.7',
    providerId: 'openai',
    modelId: 'glm-4.7',
    api: 'openai-completions',
    baseUrl: null,
    useRuntimeOpenai: true,
    authHeader: true,
    reasoning: true,
    input: ['text'],
    contextWindow: 204800,
    maxTokens: 131072,
  },
  {
    ref: 'openai/glm-5',
    label: 'GLM 5',
    providerId: 'openai',
    modelId: 'glm-5',
    api: 'openai-completions',
    baseUrl: null,
    useRuntimeOpenai: true,
    authHeader: true,
    reasoning: true,
    input: ['text'],
    contextWindow: 202752,
    maxTokens: 16384,
  },
  {
    ref: 'deepseek/deepseek-v3.2',
    label: 'DeepSeek V3.2',
    providerId: 'deepseek',
    modelId: 'deepseek-v3.2',
    api: 'openai-completions',
    baseUrl: 'https://api.deepseek.com/v1',
    useRuntimeOpenai: false,
    authHeader: true,
    reasoning: true,
    input: ['text'],
    contextWindow: 128000,
    maxTokens: 8192,
  },
];

function cloneModelCatalogEntry(entry: OemModelCatalogEntry): OemModelCatalogEntry {
  return {
    ...entry,
    input: [...entry.input],
  };
}

function getOemModelCatalog(): OemModelCatalogEntry[] {
  return OEM_MODEL_CATALOG.map(cloneModelCatalogEntry);
}

function normalizeCapabilityModelEntries(value: unknown): OemModelCatalogEntry[] {
  const out: OemModelCatalogEntry[] = [];
  const seen = new Set<string>();
  for (const item of asArray(value)) {
    const entry = asObject(item);
    const ref = normalizeOptionalString(entry.ref, 'capabilities.models.entries[].ref');
    if (!ref || seen.has(ref)) {
      continue;
    }
    const providerId = normalizeOptionalString(entry.providerId ?? entry.provider_id, 'provider_id');
    const modelId = normalizeOptionalString(entry.modelId ?? entry.model_id, 'model_id');
    const api = normalizeOptionalString(entry.api, 'api');
    if (!providerId || !modelId || !api) {
      continue;
    }
    seen.add(ref);
    out.push({
      ref,
      label: normalizeOptionalString(entry.label, 'label') || modelId,
      providerId,
      modelId,
      api,
      baseUrl: normalizeOptionalString(entry.baseUrl ?? entry.base_url, 'base_url'),
      useRuntimeOpenai:
        entry.useRuntimeOpenai === true ||
        entry.use_runtime_openai === true ||
        (providerId === 'openai' && !normalizeOptionalString(entry.baseUrl ?? entry.base_url, 'base_url')),
      authHeader: entry.authHeader !== false && entry.auth_header !== false,
      reasoning: entry.reasoning !== false,
      input: asStringArray(entry.input),
      contextWindow:
        typeof entry.contextWindow === 'number'
          ? entry.contextWindow
          : typeof entry.context_window === 'number'
            ? entry.context_window
            : 0,
      maxTokens:
        typeof entry.maxTokens === 'number'
          ? entry.maxTokens
          : typeof entry.max_tokens === 'number'
            ? entry.max_tokens
            : 0,
    });
  }
  return out;
}

function countConfiguredSurfaces(config: Record<string, unknown>): number {
  return Object.values(asObject(config.surfaces)).filter((surface) => {
    const entry = asObject(surface);
    return entry.enabled !== false;
  }).length;
}

function extractCapabilityConfig(config: Record<string, unknown>): {
  skills: string[];
  mcpServers: string[];
  agents: string[];
  menus: string[];
  models: {
    default: string | null;
    recommended: string[];
    entries: OemModelCatalogEntry[];
  };
} {
  const capabilities = asObject(config.capabilities);
  const models = asObject(capabilities.models);
  return {
    skills: asStringArray(capabilities.skills),
    mcpServers: asStringArray(capabilities.mcp_servers),
    agents: asStringArray(capabilities.agents),
    menus: asStringArray(capabilities.menus),
    models: {
      default: normalizeOptionalString(models.default, 'capabilities.models.default'),
      recommended: asStringArray(models.recommended),
      entries: normalizeCapabilityModelEntries(models.entries),
    },
  };
}

function hasPendingChanges(config: {
  draftConfig: Record<string, unknown>;
  publishedConfig: Record<string, unknown> | null;
}): boolean {
  return JSON.stringify(config.draftConfig || {}) !== JSON.stringify(config.publishedConfig || {});
}

function titleizeKey(value: string): string {
  return value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

function deriveAuditEnvironment(action: string, payload: Record<string, unknown>): string {
  const explicit = typeof payload.environment === 'string' ? payload.environment.trim() : '';
  if (explicit) {
    return explicit;
  }
  if (action === 'published') {
    return 'published';
  }
  if (action === 'rollback_prepared' || action === 'draft_saved' || action === 'asset_upserted') {
    return 'draft';
  }
  return 'control-plane';
}

function summarizeRelease(config: Record<string, unknown>, previousConfig?: Record<string, unknown> | null): {
  changedAreas: string[];
  surfaces: string[];
  skillCount: number;
  mcpCount: number;
} {
  const surfaces = Object.entries(asObject(config.surfaces))
    .filter(([, surface]) => asObject(surface).enabled !== false)
    .map(([key]) => key);
  const capabilities = extractCapabilityConfig(config);
  const changedAreas = new Set<string>();
  if (!previousConfig) {
    changedAreas.add('initial_release');
  } else {
    const previous = previousConfig;
    const fields: Array<[string, string]> = [
      ['brand_meta', 'brand_meta'],
      ['theme', 'theme'],
      ['assets', 'assets'],
      ['distribution', 'distribution'],
      ['endpoints', 'endpoints'],
      ['oauth', 'oauth'],
      ['surfaces', 'surfaces'],
      ['capabilities', 'capabilities'],
    ];
    for (const [key, label] of fields) {
      if (JSON.stringify(asObject(config[key])) !== JSON.stringify(asObject(previous[key]))) {
        changedAreas.add(label);
      }
    }
  }
  return {
    changedAreas: Array.from(changedAreas),
    surfaces,
    skillCount: capabilities.skills.length,
    mcpCount: capabilities.mcpServers.length,
  };
}

function upsertAssetValueInDraftConfig(input: {
  draftConfig: Record<string, unknown>;
  assetKey: string;
  publicUrl: string | null;
  objectKey: string;
}): Record<string, unknown> {
  const next = cloneObject(input.draftConfig);
  next.assets = {
    ...asObject(next.assets),
    [input.assetKey]: input.publicUrl || input.objectKey,
  };
  return next;
}

function removeAssetValueInDraftConfig(input: {
  draftConfig: Record<string, unknown>;
  assetKey: string;
}): Record<string, unknown> {
  const next = cloneObject(input.draftConfig);
  const assets = {
    ...asObject(next.assets),
  };
  delete assets[input.assetKey];
  next.assets = assets;
  return next;
}

function normalizeMcpKey(value: unknown): string {
  if (typeof value !== 'string') {
    throw new HttpError(400, 'BAD_REQUEST', 'key is required');
  }
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-_]{1,62}$/.test(normalized)) {
    throw new HttpError(400, 'BAD_REQUEST', 'key must use lowercase letters, numbers, hyphen, underscore');
  }
  return normalized;
}

function normalizeEnvRecord(value: unknown): Record<string, string> {
  if (value === undefined || value === null) {
    return {};
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'BAD_REQUEST', 'env must be an object');
  }
  const output: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    const normalizedKey = key.trim();
    if (!normalizedKey) continue;
    if (typeof raw !== 'string') {
      throw new HttpError(400, 'BAD_REQUEST', `env.${normalizedKey} must be a string`);
    }
    output[normalizedKey] = raw;
  }
  return output;
}

function formatMcpCatalogEntryView(entry: McpCatalogEntryRecord) {
  const config = asObject(entry.config);
  const env = normalizeEnvRecord(config.env);
  return {
    key: entry.mcpKey,
    mcpKey: entry.mcpKey,
    name: entry.name || titleizeKey(entry.mcpKey),
    description: entry.description || '',
    enabled: entry.active !== false,
    active: entry.active !== false,
    type: typeof config.type === 'string' ? config.type : null,
    transport: entry.transport || 'config',
    command: typeof config.command === 'string' ? config.command.trim() || null : null,
    args: asStringArray(config.args),
    http_url:
      typeof config.http_url === 'string'
        ? config.http_url.trim() || null
        : typeof config.httpUrl === 'string'
          ? config.httpUrl.trim() || null
          : null,
    env,
    env_keys: Object.keys(env).sort(),
    config,
    metadata: asObject(entry.metadata),
    object_key: entry.objectKey || null,
    objectKey: entry.objectKey || null,
  };
}

function rolePriority(role: PublicUser['role']): number {
  switch (role) {
    case 'super_admin':
      return 3;
    case 'admin':
      return 2;
    default:
      return 1;
  }
}

function buildDefaultDraftConfig(input: {
  brandId: string;
  tenantKey: string;
  displayName: string;
  productName: string;
}): Record<string, unknown> {
  const defaultModelEntry = getOemModelCatalog().find((item) => item.ref === 'openai/qwen3.5-plus') || null;
  return {
    brand_id: input.brandId,
    brand_meta: {
      brand_id: input.brandId,
      tenant_key: input.tenantKey,
      display_name: input.displayName,
      product_name: input.productName,
    },
    surfaces: {
      'home-web': {
        enabled: true,
        config: {
          website: {
            homeTitle: `${input.displayName} 官网`,
            metaDescription: `${input.displayName} 下载与品牌页。`,
            brandLabel: input.displayName,
            kicker: 'Official Website',
            heroTitlePre: `${input.displayName} OEM`,
            heroTitleMain: '打开就能用',
            heroDescription: `${input.productName} 的品牌化入口页。`,
            topCtaLabel: '下载',
            scrollLabel: '向下下载',
            downloadTitle: `下载 ${input.displayName}`,
          },
        },
      },
      desktop: {
        enabled: true,
        config: {
          productName: input.productName,
          displayName: input.displayName,
        },
      },
      header: {
        enabled: true,
        config: {},
      },
      sidebar: {
        enabled: true,
        config: {},
      },
      input: {
        enabled: true,
        config: {},
      },
    },
    capabilities: {
      skills: [],
      mcp_servers: [],
      agents: [],
      menus: [],
      models: {
        default: defaultModelEntry?.ref || null,
        recommended: defaultModelEntry ? [defaultModelEntry.ref] : [],
        entries: defaultModelEntry ? [defaultModelEntry] : [],
      },
    },
    assets: {},
    distribution: {},
    endpoints: {},
    oauth: {},
    theme: {
      defaultMode: 'dark',
    },
  };
}

function mergeBrandMetadata(input: {
  brandId: string;
  tenantKey: string;
  displayName: string;
  productName: string;
  draftConfig: Record<string, unknown>;
}): Record<string, unknown> {
  const next = cloneObject(input.draftConfig);
  next.brand_id = input.brandId;
  next.brand_meta = {
    ...asObject(next.brand_meta),
    brand_id: input.brandId,
    tenant_key: input.tenantKey,
    display_name: input.displayName,
    product_name: input.productName,
  };
  if (!next.surfaces || typeof next.surfaces !== 'object' || Array.isArray(next.surfaces)) {
    next.surfaces = {};
  }
  return next;
}

export class OemService {
  private readonly store: PgOemStore;
  private readonly controlStore: ControlPlaneStore | null;
  private readonly authResolver: (accessToken: string) => Promise<PublicUser>;

  constructor(
    store: PgOemStore,
    authResolver: (accessToken: string) => Promise<PublicUser>,
    options?: {controlStore?: ControlPlaneStore | null},
  ) {
    this.store = store;
    this.authResolver = authResolver;
    this.controlStore = options?.controlStore || null;
  }

  async listBrands(accessToken: string, input: {query?: string | null; status?: string | null; limit?: number | null} = {}) {
    await this.requireAdmin(accessToken);
    const items = await this.store.listBrands({
      query: normalizeOptionalString(input.query, 'query'),
      status: normalizeOptionalString(input.status, 'status'),
      limit: input.limit ? normalizePositiveInteger(input.limit, 'limit') : 200,
    });
    return {items};
  }

  async getBrand(accessToken: string, brandIdInput: string) {
    await this.requireAdmin(accessToken);
    const brandId = normalizeBrandId(brandIdInput);
    const brand = await this.store.getBrand(brandId);
    if (!brand) {
      throw new HttpError(404, 'NOT_FOUND', 'OEM brand not found');
    }
    const [versions, assets, audit] = await Promise.all([
      this.store.listBrandVersions(brandId),
      this.store.listBrandAssets(brandId),
      this.store.listAuditEvents(brandId),
    ]);
    return {
      brand,
      versions,
      assets,
      audit,
    };
  }

  async getDashboard(accessToken: string) {
    await this.requireAdmin(accessToken);
    const [summaries, brands, releases, auditFeed, skillCatalog, mcpCatalog] = await Promise.all([
      this.store.listBrandSummaries(),
      this.store.listBrands(),
      this.store.listReleases({limit: 8}),
      this.store.listAuditFeed({limit: 10}),
      this.controlStore?.listSkillCatalogAdmin() || Promise.resolve([]),
      this.getMcpCatalog(),
    ]);

    const summaryByBrandId = new Map(summaries.map((item) => [item.brandId, item]));
    const releaseHistoryByBrandId = new Map<string, Array<{version: number; config: Record<string, unknown>}>>();
    for (const release of releases) {
      const current = releaseHistoryByBrandId.get(release.brandId) || [];
      current.push({version: release.version, config: release.config});
      releaseHistoryByBrandId.set(release.brandId, current);
    }

    const totalAssets = summaries.reduce((sum, item) => sum + item.assetCount, 0);
    const publishedCount = brands.filter((brand) => brand.status === 'published').length;
    const draftCount = brands.filter((brand) => brand.status === 'draft').length;
    const archivedCount = brands.filter((brand) => brand.status === 'archived').length;
    const pendingChangesCount = brands.filter((brand) => hasPendingChanges(brand)).length;

    return {
      stats: {
        brands_total: brands.length,
        published_count: publishedCount,
        draft_count: draftCount,
        archived_count: archivedCount,
        assets_count: totalAssets,
        skills_count: skillCatalog.length,
        mcp_servers_count: mcpCatalog.length,
        pending_changes_count: pendingChangesCount,
      },
      recent_releases: releases.map((release) => {
        const brandHistory = releaseHistoryByBrandId.get(release.brandId) || [];
        const previous = brandHistory.find((item) => item.version === release.version - 1)?.config || null;
        const summary = summarizeRelease(release.config, previous);
        return {
          id: release.id,
          brand_id: release.brandId,
          display_name: summaryByBrandId.get(release.brandId)?.displayName || release.brandId,
          version: release.version,
          published_at: release.publishedAt,
          created_by: release.createdBy,
          created_by_name: release.createdByName,
          created_by_username: release.createdByUsername,
          changed_areas: summary.changedAreas,
          surfaces: summary.surfaces,
          skill_count: summary.skillCount,
          mcp_count: summary.mcpCount,
        };
      }),
      recent_edits: auditFeed.map((event) => ({
        id: event.id,
        brand_id: event.brandId,
        display_name: event.brandDisplayName || event.brandId,
        action: event.action,
        actor_name: event.actorName,
        actor_username: event.actorUsername,
        created_at: event.createdAt,
        environment: deriveAuditEnvironment(event.action, event.payload),
        payload: event.payload,
      })),
      brand_activity: brands.map((brand) => {
        const capabilities = extractCapabilityConfig(brand.draftConfig);
        const summary = summaryByBrandId.get(brand.brandId);
        return {
          brand_id: brand.brandId,
          display_name: brand.displayName,
          product_name: brand.productName,
          status: brand.status,
          published_version: brand.publishedVersion,
          configured_surfaces: countConfiguredSurfaces(brand.draftConfig),
          enabled_skills: capabilities.skills.length,
          enabled_mcp_servers: capabilities.mcpServers.length,
          asset_count: summary?.assetCount || 0,
          updated_at: brand.updatedAt,
          last_published_at: summary?.lastPublishedAt || null,
        };
      }),
    };
  }

  async saveBrandDraft(
    accessToken: string,
    input: {
      brand_id?: string;
      tenant_key?: string;
      display_name?: string;
      product_name?: string;
      status?: 'draft' | 'published' | 'archived';
      draft_config?: Record<string, unknown>;
    },
  ) {
    const actor = await this.requireAdmin(accessToken);
    const brandId = normalizeBrandId(input.brand_id);
    const existing = await this.store.getBrand(brandId);
    const displayName = normalizeRequiredString(input.display_name ?? existing?.displayName, 'display_name');
    const productName = normalizeRequiredString(input.product_name ?? existing?.productName, 'product_name');
    const tenantKey = normalizeRequiredString(input.tenant_key ?? existing?.tenantKey ?? brandId, 'tenant_key');
    const status = normalizeStatus(input.status, existing?.status || 'draft');
    const draftConfig =
      input.draft_config && typeof input.draft_config === 'object' && !Array.isArray(input.draft_config)
        ? (input.draft_config as Record<string, unknown>)
        : existing?.draftConfig || buildDefaultDraftConfig({brandId, tenantKey, displayName, productName});

    const brand = await this.store.upsertDraft({
      brandId,
      tenantKey,
      displayName,
      productName,
      status,
      draftConfig: mergeBrandMetadata({
        brandId,
        tenantKey,
        displayName,
        productName,
        draftConfig,
      }),
      actorUserId: actor.id,
    });

    return {brand};
  }

  async publishBrand(accessToken: string, input: {brand_id?: string}) {
    const actor = await this.requireAdmin(accessToken);
    const brandId = normalizeBrandId(input.brand_id);
    const existing = await this.store.getBrand(brandId);
    if (!existing) {
      throw new HttpError(404, 'NOT_FOUND', 'OEM brand not found');
    }
    const brand = await this.store.publishBrand(brandId, actor.id);
    return {brand};
  }

  async restoreBrandVersion(accessToken: string, input: {brand_id?: string; version?: number}) {
    const actor = await this.requireAdmin(accessToken);
    const brandId = normalizeBrandId(input.brand_id);
    const version = normalizePositiveInteger(input.version, 'version');
    const existing = await this.store.getBrand(brandId);
    if (!existing) {
      throw new HttpError(404, 'NOT_FOUND', 'OEM brand not found');
    }
    const versions = await this.store.listBrandVersions(brandId);
    if (!versions.some((item) => item.version === version)) {
      throw new HttpError(404, 'NOT_FOUND', 'OEM brand version not found');
    }
    const brand = await this.store.restoreBrandVersion(brandId, version, actor.id);
    return {brand};
  }

  async listReleases(accessToken: string, input: {brand_id?: string | null; limit?: number | null}) {
    await this.requireAdmin(accessToken);
    const limit = input.limit ? normalizePositiveInteger(input.limit, 'limit') : 100;
    const brandId = input.brand_id ? normalizeBrandId(input.brand_id) : null;
    const releases = await this.store.listReleases({brandId, limit});
    const grouped = new Map<string, Array<{version: number; config: Record<string, unknown>}>>();
    for (const release of releases) {
      const current = grouped.get(release.brandId) || [];
      current.push({version: release.version, config: release.config});
      grouped.set(release.brandId, current);
    }
    return {
      items: releases.map((release) => {
        const previous = grouped.get(release.brandId)?.find((item) => item.version === release.version - 1)?.config || null;
        const summary = summarizeRelease(release.config, previous);
        return {
          id: release.id,
          brand_id: release.brandId,
          display_name: release.brandDisplayName || release.brandId,
          version: release.version,
          created_by: release.createdBy,
          created_by_name: release.createdByName,
          created_by_username: release.createdByUsername,
          created_at: release.createdAt,
          published_at: release.publishedAt,
          changed_areas: summary.changedAreas,
          surfaces: summary.surfaces,
          skill_count: summary.skillCount,
          mcp_count: summary.mcpCount,
          config: release.config,
        };
      }),
    };
  }

  async listAssets(
    accessToken: string,
    input: {brand_id?: string | null; kind?: string | null; limit?: number | null},
  ) {
    await this.requireAdmin(accessToken);
    const limit = input.limit ? normalizePositiveInteger(input.limit, 'limit') : 200;
    const brandId = input.brand_id ? normalizeBrandId(input.brand_id) : null;
    const kind = normalizeOptionalString(input.kind, 'kind');
    const items = await this.store.listAssets({brandId, kind, limit});
    return {items};
  }

  async upsertAsset(
    accessToken: string,
    input: {
      brand_id?: string;
      asset_key?: string;
      kind?: string;
      storage_provider?: string;
      object_key?: string;
      public_url?: string | null;
      metadata?: Record<string, unknown>;
    },
  ) {
    const actor = await this.requireAdmin(accessToken);
    const brandId = normalizeBrandId(input.brand_id);
    const existing = await this.store.getBrand(brandId);
    if (!existing) {
      throw new HttpError(404, 'NOT_FOUND', 'OEM brand not found');
    }
    const assetKey = normalizeRequiredString(input.asset_key, 'asset_key');
    const kind = normalizeRequiredString(input.kind, 'kind');
    const storageProvider = normalizeRequiredString(input.storage_provider || 'repo', 'storage_provider');
    const objectKey = normalizeRequiredString(input.object_key, 'object_key');
    const publicUrl = normalizeOptionalString(input.public_url, 'public_url');
    const metadata =
      input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
        ? (input.metadata as Record<string, unknown>)
        : {};
    const asset = await this.store.upsertAsset({
      brandId,
      assetKey,
      kind,
      storageProvider,
      objectKey,
      publicUrl,
      metadata,
      actorUserId: actor.id,
    });
    const nextDraftConfig = upsertAssetValueInDraftConfig({
      draftConfig: existing.draftConfig,
      assetKey,
      publicUrl: asset.publicUrl,
      objectKey: asset.objectKey,
    });
    await this.store.upsertDraft({
      brandId,
      tenantKey: existing.tenantKey,
      displayName: existing.displayName,
      productName: existing.productName,
      status: existing.status === 'published' ? 'draft' : existing.status,
      draftConfig: mergeBrandMetadata({
        brandId,
        tenantKey: existing.tenantKey,
        displayName: existing.displayName,
        productName: existing.productName,
        draftConfig: nextDraftConfig,
      }),
      actorUserId: actor.id,
    });
    return {asset};
  }

  async uploadAssetFile(
    accessToken: string,
    input: {
      brand_id?: string;
      asset_key?: string;
      kind?: string;
      content_type?: string;
      file_name?: string;
      file_base64?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    const actor = await this.requireAdmin(accessToken);
    const brandId = normalizeBrandId(input.brand_id);
    const existing = await this.store.getBrand(brandId);
    if (!existing) {
      throw new HttpError(404, 'NOT_FOUND', 'OEM brand not found');
    }
    const assetKey = normalizeRequiredString(input.asset_key, 'asset_key');
    const kind = normalizeRequiredString(input.kind, 'kind');
    const contentType = normalizeRequiredString(input.content_type, 'content_type');
    const filename = normalizeOptionalString(input.file_name, 'file_name') || `${assetKey}`;
    const content = parseRequiredBase64(input.file_base64, 'file_base64');
    const metadata =
      input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
        ? (input.metadata as Record<string, unknown>)
        : {};

    const upload = await uploadOemAssetFile({
      brandId,
      assetKey,
      content,
      contentType,
      filename,
    });
    const asset = await this.store.upsertAsset({
      brandId,
      assetKey,
      kind,
      storageProvider: upload.storageProvider,
      objectKey: upload.objectKey,
      publicUrl: upload.publicUrl,
      metadata: {
        ...metadata,
        content_type: contentType,
        file_name: filename,
        byte_size: content.length,
      },
      actorUserId: actor.id,
    });

    const nextDraftConfig = upsertAssetValueInDraftConfig({
      draftConfig: existing.draftConfig,
      assetKey,
      publicUrl: asset.publicUrl,
      objectKey: asset.objectKey,
    });
    await this.store.upsertDraft({
      brandId,
      tenantKey: existing.tenantKey,
      displayName: existing.displayName,
      productName: existing.productName,
      status: existing.status === 'published' ? 'draft' : existing.status,
      draftConfig: mergeBrandMetadata({
        brandId,
        tenantKey: existing.tenantKey,
        displayName: existing.displayName,
        productName: existing.productName,
        draftConfig: nextDraftConfig,
      }),
      actorUserId: actor.id,
    });

    return {asset};
  }

  async deleteAsset(accessToken: string, input: {brand_id?: string; asset_key?: string}) {
    const actor = await this.requireAdmin(accessToken);
    const brandId = normalizeBrandId(input.brand_id);
    const assetKey = normalizeRequiredString(input.asset_key, 'asset_key');
    const existing = await this.store.getBrandAsset(brandId, assetKey);
    if (!existing) {
      return {removed: false};
    }

    const brand = await this.store.getBrand(brandId);
    if (!brand) {
      throw new HttpError(404, 'NOT_FOUND', 'OEM brand not found');
    }

    const nextDraftConfig = removeAssetValueInDraftConfig({
      draftConfig: brand.draftConfig,
      assetKey,
    });

    const removed = await this.store.deleteAsset({
      brandId,
      assetKey,
      actorUserId: actor.id,
      existing,
    });

    if (!removed.removed) {
      return removed;
    }

    await this.store.upsertDraft({
      brandId,
      tenantKey: brand.tenantKey,
      displayName: brand.displayName,
      productName: brand.productName,
      status: brand.status === 'published' ? 'draft' : brand.status,
      draftConfig: mergeBrandMetadata({
        brandId,
        tenantKey: brand.tenantKey,
        displayName: brand.displayName,
        productName: brand.productName,
        draftConfig: nextDraftConfig,
      }),
      actorUserId: actor.id,
    });

    try {
      await deleteOemAssetFile({
        storageProvider: existing.storageProvider,
        objectKey: existing.objectKey,
      });
    } catch (error) {
      console.warn('[oem-service] failed to delete OEM asset object', {
        brandId,
        assetKey,
        storageProvider: existing.storageProvider,
        objectKey: existing.objectKey,
        error,
      });
    }

    return {removed: true};
  }

  async getAssetFile(brandIdInput: string, assetKeyInput: string) {
    const brandId = normalizeBrandId(brandIdInput);
    const assetKey = normalizeRequiredString(assetKeyInput, 'asset_key');
    const asset = await this.store.getBrandAsset(brandId, assetKey);
    if (!asset) {
      throw new HttpError(404, 'NOT_FOUND', 'OEM asset not found');
    }
    const contentType = normalizeOptionalString(asset.metadata.content_type, 'content_type');
    const file = await downloadOemAssetFile({
      brandId,
      assetKey,
      storageProvider: asset.storageProvider,
      objectKey: asset.objectKey,
      contentType,
    });
    return {
      file,
      asset,
    };
  }

  async listAudit(accessToken: string, input: {brand_id?: string | null; action?: string | null; limit?: number | null}) {
    await this.requireAdmin(accessToken);
    const limit = input.limit ? normalizePositiveInteger(input.limit, 'limit') : 200;
    const brandId = input.brand_id ? normalizeBrandId(input.brand_id) : null;
    const action = normalizeOptionalString(input.action, 'action');
    const items = await this.store.listAuditFeed({brandId, action, limit});
    return {
      items: items.map((item) => ({
        ...item,
        environment: deriveAuditEnvironment(item.action, item.payload),
      })),
    };
  }

  async listMcpCatalog(accessToken: string) {
    await this.requireAdmin(accessToken);
    const items = await this.getMcpCatalog();
    return {
      items,
    };
  }

  async upsertMcpCatalogEntry(
    accessToken: string,
    input: UpsertMcpCatalogEntryInput & {
      key?: string;
      enabled?: boolean;
      type?: string | null;
      command?: string | null;
      args?: string[];
      http_url?: string | null;
      env?: Record<string, string>;
    },
  ) {
    await this.requireAdmin(accessToken);
    if (!this.controlStore) {
      throw new HttpError(500, 'INTERNAL_ERROR', 'cloud mcp catalog store unavailable');
    }
    const key = normalizeMcpKey(input.key);
    const existing = await this.controlStore.getMcpCatalogEntry(key);
    const existingView = existing ? formatMcpCatalogEntryView(existing) : null;
    const enabled = normalizeOptionalBoolean(input.enabled, 'enabled', existingView?.enabled ?? true);
    const type = normalizeOptionalString(input.type, 'type') ?? existingView?.type;
    const transport =
      normalizeOptionalString(input.transport, 'transport') ??
      existing?.transport ??
      existingView?.type ??
      'config';
    const command = normalizeOptionalString(input.command, 'command') ?? existingView?.command;
    const args = input.args === undefined ? (existingView?.args || []) : asStringArray(input.args);
    const httpUrl = normalizeOptionalString(input.http_url, 'http_url') ?? existingView?.http_url;
    const env = input.env === undefined ? normalizeEnvRecord(existingView?.env || {}) : normalizeEnvRecord(input.env);
    const name =
      normalizeOptionalString(input.name, 'name') ||
      existing?.name ||
      existingView?.name ||
      titleizeKey(key);
    const description =
      normalizeOptionalString(input.description, 'description') ||
      existing?.description ||
      '';
    const objectKey =
      normalizeOptionalString(input.object_key, 'object_key') ??
      existing?.objectKey ??
      null;
    const metadata =
      input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
        ? cloneObject(input.metadata as Record<string, unknown>)
        : existing?.metadata && typeof existing.metadata === 'object'
          ? cloneObject(existing.metadata)
          : {};

    if (!command && !httpUrl) {
      throw new HttpError(400, 'BAD_REQUEST', 'command or http_url is required');
    }

    const nextConfig: Record<string, unknown> = {};
    if (type) nextConfig.type = type;
    if (command) nextConfig.command = command;
    if (args.length) nextConfig.args = args;
    if (httpUrl) nextConfig.http_url = httpUrl;
    if (Object.keys(env).length > 0) nextConfig.env = env;

    const record = await this.controlStore.upsertMcpCatalogEntry({
      mcp_key: key,
      name,
      description,
      transport,
      object_key: objectKey,
      config: nextConfig,
      metadata,
      active: enabled,
    });
    return formatMcpCatalogEntryView(record);
  }

  async deleteMcpCatalogEntry(accessToken: string, keyInput: string) {
    await this.requireAdmin(accessToken);
    if (!this.controlStore) {
      throw new HttpError(500, 'INTERNAL_ERROR', 'cloud mcp catalog store unavailable');
    }
    const key = normalizeMcpKey(keyInput);
    return {removed: await this.controlStore.deleteMcpCatalogEntry(key)};
  }

  async testMcpCatalogEntry(
    accessToken: string,
    input: {
      key?: string;
      command?: string | null;
      http_url?: string | null;
    },
  ) {
    await this.requireAdmin(accessToken);
    const key = input.key ? normalizeMcpKey(input.key) : null;
    let command = normalizeOptionalString(input.command, 'command');
    let httpUrl = normalizeOptionalString(input.http_url, 'http_url');

    if (key && !command && !httpUrl) {
      if (!this.controlStore) {
        throw new HttpError(500, 'INTERNAL_ERROR', 'cloud mcp catalog store unavailable');
      }
      const existing = await this.controlStore.getMcpCatalogEntry(key);
      if (!existing) {
        throw new HttpError(404, 'NOT_FOUND', 'MCP entry not found');
      }
      const entry = formatMcpCatalogEntryView(existing);
      command = entry.command;
      httpUrl = entry.http_url;
    }

    if (httpUrl) {
      try {
        const response = await fetch(httpUrl, {
          method: 'GET',
          signal: AbortSignal.timeout(3000),
        });
        return {
          ok: response.ok,
          mode: 'http',
          status: response.status,
          message: response.ok ? `HTTP ${response.status}` : `HTTP ${response.status}`,
        };
      } catch (error) {
        return {
          ok: false,
          mode: 'http',
          status: null,
          message: error instanceof Error ? error.message : 'HTTP connection failed',
        };
      }
    }

    if (command) {
      try {
        const output = await execFileAsync('which', [command], {timeout: 3000});
        return {
          ok: true,
          mode: 'stdio',
          status: 0,
          message: String(output.stdout || output.stderr || command).trim() || command,
        };
      } catch (error) {
        return {
          ok: false,
          mode: 'stdio',
          status: null,
          message: error instanceof Error ? error.message : 'command not found',
        };
      }
    }

    throw new HttpError(400, 'BAD_REQUEST', 'command or http_url is required for testing');
  }

  async getCapabilities(accessToken: string) {
    await this.requireAdmin(accessToken);
    const [brands, skillCatalog, mcpCatalog] = await Promise.all([
      this.store.listBrands(),
      this.controlStore?.listSkillCatalogAdmin() || Promise.resolve([]),
      this.getMcpCatalog(),
    ]);

    const brandAssignments = brands.map((brand) => ({
      brandId: brand.brandId,
      displayName: brand.displayName,
      status: brand.status,
      capabilities: extractCapabilityConfig(brand.draftConfig),
    }));

    const skillMap = new Map<
      string,
      {
        slug: string;
        name: string;
        description: string;
        category: string | null;
        publisher: string;
        distribution: string;
        active: boolean;
        version: string | null;
        connectedBrands: Array<{brand_id: string; display_name: string; status: string}>;
      }
    >();

    for (const skill of skillCatalog) {
      skillMap.set(skill.slug, {
        slug: skill.slug,
        name: skill.name,
        description: skill.description,
        category: skill.category,
        publisher: skill.publisher,
        distribution: skill.distribution,
        active: skill.active,
        version: skill.version || null,
        connectedBrands: [],
      });
    }

    for (const brand of brandAssignments) {
      for (const slug of brand.capabilities.skills) {
        if (!skillMap.has(slug)) {
          skillMap.set(slug, {
            slug,
            name: titleizeKey(slug),
            description: '',
            category: null,
            publisher: 'Uncatalogued',
            distribution: 'unknown',
            active: true,
            version: null,
            connectedBrands: [],
          });
        }
        skillMap.get(slug)?.connectedBrands.push({
          brand_id: brand.brandId,
          display_name: brand.displayName,
          status: brand.status,
        });
      }
    }

    const mcpMap = new Map(
      mcpCatalog.map((entry) => [
        entry.key,
        {
          key: entry.key,
          name: entry.name || titleizeKey(entry.key),
          enabled_by_default: entry.enabled !== false,
          command: entry.command,
          args: entry.args,
          http_url: entry.http_url,
          env_keys: entry.env_keys,
          connected_brands: [] as Array<{brand_id: string; display_name: string; status: string}>,
        },
      ]),
    );

    for (const brand of brandAssignments) {
      for (const key of brand.capabilities.mcpServers) {
        if (!mcpMap.has(key)) {
          mcpMap.set(key, {
            key,
            name: titleizeKey(key),
            enabled_by_default: false,
            command: null,
            args: [],
            http_url: null,
            env_keys: [],
            connected_brands: [],
          });
        }
        mcpMap.get(key)?.connected_brands.push({
          brand_id: brand.brandId,
          display_name: brand.displayName,
          status: brand.status,
        });
      }
    }

    return {
      skills: Array.from(skillMap.values())
        .map((item) => ({
          ...item,
          brand_count: item.connectedBrands.length,
        }))
        .sort((left, right) => right.brand_count - left.brand_count || left.name.localeCompare(right.name, 'zh-CN')),
      mcp_servers: Array.from(mcpMap.values())
        .map((item) => ({
          ...item,
          connected_brand_count: item.connected_brands.length,
        }))
        .sort(
          (left, right) =>
            right.connected_brand_count - left.connected_brand_count || left.name.localeCompare(right.name, 'zh-CN'),
        ),
      models: getOemModelCatalog()
        .map((entry) => ({
          ...entry,
          connected_brand_count: brandAssignments.filter((brand) =>
            brand.capabilities.models.entries.some((item) => item.ref === entry.ref),
          ).length,
        }))
        .sort(
          (left, right) =>
            right.connected_brand_count - left.connected_brand_count || left.label.localeCompare(right.label, 'zh-CN'),
        ),
      brands: brandAssignments,
    };
  }

  async getPublicBrandConfig(brandIdInput: string, surfaceKeyInput?: string | null) {
    const brandId = normalizeBrandId(brandIdInput);
    const brand = await this.store.getPublishedBrand(brandId);
    if (!brand || !brand.publishedConfig) {
      throw new HttpError(404, 'NOT_FOUND', 'published OEM config not found');
    }

    const surfaceKey = typeof surfaceKeyInput === 'string' ? surfaceKeyInput.trim() : '';
    const surfaces = asObject(brand.publishedConfig.surfaces);
    const surfaceEntry = surfaceKey ? asObject(surfaces[surfaceKey]) : null;

    return {
      brand,
      publishedVersion: brand.publishedVersion,
      config: brand.publishedConfig,
      surfaceKey: surfaceKey || null,
      surfaceConfig: surfaceEntry ? asObject(surfaceEntry.config) : null,
    };
  }

  private async requireAdmin(accessToken: string): Promise<PublicUser> {
    const user = await this.authResolver(accessToken);
    if (rolePriority(user.role) < rolePriority('admin')) {
      throw new HttpError(403, 'FORBIDDEN', 'admin access required');
    }
    return user;
  }

  private async getMcpCatalog() {
    if (!this.controlStore) {
      return [];
    }
    const items = await this.controlStore.listMcpCatalogAdmin();
    return items
      .map((item) => formatMcpCatalogEntryView(item))
      .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
  }
}
