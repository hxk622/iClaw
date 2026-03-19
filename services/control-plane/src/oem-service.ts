import type {PublicUser} from './domain.ts';
import {HttpError} from './errors.ts';
import type {PgOemStore} from './oem-store.ts';

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
  private readonly authResolver: (accessToken: string) => Promise<PublicUser>;

  constructor(store: PgOemStore, authResolver: (accessToken: string) => Promise<PublicUser>) {
    this.store = store;
    this.authResolver = authResolver;
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
    const brand = await this.store.publishBrand(brandId, actor.id);
    return {brand};
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
}
