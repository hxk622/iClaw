import {readFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import type {PublicUser} from './domain.ts';
import {HttpError} from './errors.ts';
import type {PgOemStore} from './oem-store.ts';
import type {ControlPlaneStore} from './store.ts';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const mcpCatalogPath = resolve(repoRoot, 'mcp/mcp.json');

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

function normalizePositiveInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new HttpError(400, 'BAD_REQUEST', `${field} must be a positive integer`);
  }
  return value;
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
} {
  const capabilities = asObject(config.capabilities);
  return {
    skills: asStringArray(capabilities.skills),
    mcpServers: asStringArray(capabilities.mcp_servers),
    agents: asStringArray(capabilities.agents),
    menus: asStringArray(capabilities.menus),
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

async function readMcpCatalog(): Promise<
  Array<{
    key: string;
    enabledByDefault: boolean;
    command: string | null;
    args: string[];
    httpUrl: string | null;
    envKeys: string[];
  }>
> {
  const raw = JSON.parse(await readFile(mcpCatalogPath, 'utf8')) as {mcpServers?: Record<string, unknown>};
  return Object.entries(raw.mcpServers || {}).map(([key, value]) => {
    const entry = asObject(value);
    const env = asObject(entry.env);
    return {
      key,
      enabledByDefault: entry.enabled !== false,
      command: typeof entry.command === 'string' ? entry.command : null,
      args: asStringArray(entry.args),
      httpUrl: typeof entry.httpUrl === 'string' ? entry.httpUrl : null,
      envKeys: Object.keys(env).sort(),
    };
  });
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
    },
    assets: {},
    distribution: {},
    endpoints: {},
    oauth: {},
    theme: {},
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
  private mcpCatalogPromise: Promise<
    Array<{
      key: string;
      enabledByDefault: boolean;
      command: string | null;
      args: string[];
      httpUrl: string | null;
      envKeys: string[];
    }>
  > | null = null;

  constructor(
    store: PgOemStore,
    authResolver: (accessToken: string) => Promise<PublicUser>,
    options?: {controlStore?: ControlPlaneStore | null},
  ) {
    this.store = store;
    this.authResolver = authResolver;
    this.controlStore = options?.controlStore || null;
  }

  async listBrands(accessToken: string) {
    await this.requireAdmin(accessToken);
    const items = await this.store.listBrands();
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
    return {asset};
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
        latestRelease: string | null;
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
        latestRelease: skill.latestRelease?.version || null,
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
            latestRelease: null,
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
          name: titleizeKey(entry.key),
          enabled_by_default: entry.enabledByDefault,
          command: entry.command,
          args: entry.args,
          http_url: entry.httpUrl,
          env_keys: entry.envKeys,
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
    if (!this.mcpCatalogPromise) {
      this.mcpCatalogPromise = readMcpCatalog();
    }
    return this.mcpCatalogPromise;
  }
}
