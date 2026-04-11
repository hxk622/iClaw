export type ThemeMode = 'light' | 'dark' | 'system';

export type LoginState = 'booting' | 'login' | 'console';

export type AuthTokens = {
  access_token?: string;
  refresh_token?: string;
};

export type AdminRoute =
  | 'overview'
  | 'brands'
  | 'brand-detail'
  | 'agent-center'
  | 'skill-center'
  | 'mcp-center'
  | 'model-center'
  | 'runtime-management'
  | 'cloud-skills'
  | 'cloud-mcps'
  | 'assets'
  | 'releases'
  | 'payments-config'
  | 'payments-packages'
  | 'payments-orders'
  | 'audit-log';

export type NavItem = {
  id: AdminRoute | 'payments';
  label: string;
  children?: Array<{ id: AdminRoute; label: string }>;
};

export type OverviewStats = {
  brandsTotal: number;
  publishedCount: number;
  cloudSkillsCount: number;
  mcpServersCount: number;
  skillsCount: number;
  assetsCount: number;
};

export type OverviewRelease = {
  id: string;
  displayName: string;
  version: string;
  publishedAt: string;
};

export type OverviewEdit = {
  id: string;
  displayName: string;
  action: string;
  actorName: string;
  createdAt: string;
};

export type OverviewData = {
  stats: OverviewStats;
  recentReleases: OverviewRelease[];
  recentEdits: OverviewEdit[];
  brandConfigs: Record<string, Record<string, unknown>>;
  agentCatalog: Array<{
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
  }>;
  releases: Array<{
    id: string;
    brandId: string;
    displayName: string;
    version: string;
    publishedAt: string;
    createdByName: string;
    surfaces: string[];
    skillCount: number;
    mcpCount: number;
  }>;
  audit: Array<{
    id: string;
    brandId: string;
    brandDisplayName: string;
    action: string;
    actorName: string;
    actorUsername: string;
    environment: string;
    createdAt: string;
    payload: Record<string, unknown>;
  }>;
  assets: Array<{
    assetKey: string;
    brandId: string;
    brandDisplayName: string;
    appName: string;
    storageProvider: string;
    publicUrl: string;
    objectKey: string;
    contentType: string;
    metadata: Record<string, unknown>;
    updatedAt: string;
  }>;
  paymentGatewayConfigs: Record<
    string,
    | {
        provider: string;
        source: string;
        scopeType: string;
        scopeKey: string;
        config: Record<string, unknown>;
        secretValues: Record<string, unknown>;
        configuredSecretKeys: string[];
        completenessStatus: string;
        missingFields: string[];
        updatedAt: string;
      }
    | null
  >;
  paymentProviderProfiles: Array<{
    id: string;
    provider: string;
    scopeType: string;
    scopeKey: string;
    channelKind: string;
    displayName: string;
    enabled: boolean;
    completenessStatus: string;
    missingFields: string[];
    configuredSecretKeys: string[];
    config: Record<string, unknown>;
  }>;
  paymentProviderBindings: Array<{
    provider: string;
    appName: string;
    mode: string;
    activeProfileId: string;
  }>;
  paymentOrders: Array<{
    orderId: string;
    status: string;
    provider: string;
    amountCnyFen: number;
    totalCredits: number;
    userId: string;
    username: string;
    userEmail: string;
    userDisplayName: string;
    appName: string;
    appVersion: string;
    releaseChannel: string;
    platform: string;
    arch: string;
    providerOrderId: string;
    providerPrepayId: string;
    returnUrl: string;
    createdAt: string;
    paidAt: string;
    expiresAt: string;
    latestWebhookAt: string;
    updatedAt: string;
    webhookEventCount: number;
    metadata: Record<string, unknown>;
  }>;
  cloudSkills: Array<{
    slug: string;
    name: string;
    description: string;
    version: string;
    originType: string;
    publisher: string;
    active: boolean;
    tags: string[];
    sourceUrl: string;
    artifactUrl: string;
    market?: string;
    category?: string;
    skillType?: string;
    distribution?: string;
    artifactFormat?: string;
    artifactSha256?: string;
    artifactSourcePath?: string;
    metadata: Record<string, unknown>;
  }>;
  cloudSkillMeta: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
    nextOffset: number | null;
    query: string;
  };
  skillSyncSources: Array<{
    id: string;
    displayName: string;
    sourceType: string;
    sourceKey?: string;
    sourceUrl?: string;
    config?: Record<string, unknown>;
    active: boolean;
  }>;
  skillSyncRuns: Array<{
    id: string;
    displayName: string;
    status: string;
    startedAt: string;
    finishedAt: string;
    summary?: Record<string, unknown>;
  }>;
  cloudMcps: Array<{
    key: string;
    name: string;
    description: string;
    transport: string;
    objectKey: string;
    enabled: boolean;
    metadata: Record<string, unknown>;
  }>;
  modelProviderProfiles: Array<{
    id: string;
    scopeType: string;
    scopeKey: string;
    providerKey: string;
    providerLabel: string;
    baseUrl: string;
    apiKey: string;
    logoPresetKey: string;
    metadata: Record<string, unknown>;
    enabled: boolean;
    sortOrder: number;
    models: Array<{
      label: string;
      modelId: string;
      logoPresetKey: string;
      billingMultiplier: number;
    }>;
  }>;
  memoryEmbeddingProfiles: Array<{
    id: string;
    scopeType: string;
    scopeKey: string;
    providerKey: string;
    providerLabel: string;
    baseUrl: string;
    apiKey: string;
    embeddingModel: string;
    logoPresetKey: string;
    autoRecall: boolean;
    enabled: boolean;
  }>;
  modelProviderOverrides: Record<
    string,
    {
      providerMode: string;
      activeProfileId: string;
      cacheVersion: number;
    } | null
  >;
  platformSkills: Array<{
    slug: string;
    name: string;
    description: string;
    category: string;
    version: string;
    publisher: string;
    active: boolean;
    metadata?: Record<string, unknown>;
    connectedBrands: Array<{ brandId: string; displayName: string }>;
  }>;
  platformMcps: Array<{
    key: string;
    name: string;
    description: string;
    transport: string;
    active: boolean;
    metadata?: Record<string, unknown>;
    connectedBrands: Array<{ brandId: string; displayName: string }>;
  }>;
  platformModels: Array<{
    ref: string;
    label: string;
    providerId: string;
    modelId: string;
    api?: string;
    baseUrl?: string;
    useRuntimeOpenai?: boolean;
    authHeader?: boolean;
    reasoning?: boolean;
    input?: string[];
    contextWindow?: number;
    maxTokens?: number;
    metadata?: Record<string, unknown>;
    active: boolean;
    connectedBrands: Array<{ brandId: string; displayName: string }>;
  }>;
  rechargeCatalog: Array<{
    packageId: string;
    packageName: string;
    credits: number;
    bonusCredits: number;
    amountCnyFen: number;
    sortOrder: number;
    active: boolean;
    recommended: boolean;
    default: boolean;
    description: string;
    badgeLabel: string;
    highlight: string;
    featureList: string[];
  }>;
  menuCatalog: Array<{
    key: string;
    label: string;
    category: string;
    iconKey: string;
    active: boolean;
    enabledByDefault?: boolean;
  }>;
  composerControlCatalog: Array<{
    controlKey: string;
    active: boolean;
  }>;
  composerShortcutCatalog: Array<{
    shortcutKey: string;
    active: boolean;
  }>;
  runtimeReleases: Array<{
    id: string;
    runtimeKind: string;
    version: string;
    channel: string;
    platform: string;
    arch: string;
    targetTriple: string;
    status: string;
    updatedAt: string;
    artifactUrl: string;
  }>;
  runtimeBindings: Array<{
    id: string;
    scopeType: string;
    scopeKey: string;
    runtimeKind: string;
    channel: string;
    platform: string;
    arch: string;
    targetTriple: string;
    releaseId: string;
    enabled: boolean;
    updatedAt: string;
    changeReason: string;
  }>;
  runtimeBindingHistory: Array<{
    id: string;
    bindingId: string;
    scopeType: string;
    scopeKey: string;
    runtimeKind: string;
    channel: string;
    targetTriple: string;
    fromReleaseId: string;
    toReleaseId: string;
    createdAt: string;
    changeReason: string;
  }>;
  runtimeBootstrapSource: {
    sourcePath: string;
    version: string;
    artifacts: Array<{
      targetTriple: string;
      platform: string;
      arch: string;
      artifactUrl: string;
      artifactFormat: string;
      objectKey: string;
    }>;
  } | null;
  desktopReleaseConfigs: Record<
    string,
    {
      dev: {
        draft: {
          version: string;
          notes: string;
          publishedAt: string;
          policy: {
            mandatory: boolean;
            forceUpdateBelowVersion: string;
            allowCurrentRunToFinish: boolean;
            reasonCode: string;
            reasonMessage: string;
          };
          targets: Array<{
            platform: string;
            arch: string;
            installer: Record<string, unknown>;
            updater: Record<string, unknown>;
            signature: Record<string, unknown>;
          }>;
        };
        published: {
          version: string;
          notes: string;
          publishedAt: string;
          policy: {
            mandatory: boolean;
            forceUpdateBelowVersion: string;
            allowCurrentRunToFinish: boolean;
            reasonCode: string;
            reasonMessage: string;
          };
          targets: Array<{
            platform: string;
            arch: string;
            installer: Record<string, unknown>;
            updater: Record<string, unknown>;
            signature: Record<string, unknown>;
          }>;
        };
      };
      prod: {
        draft: {
          version: string;
          notes: string;
          publishedAt: string;
          policy: {
            mandatory: boolean;
            forceUpdateBelowVersion: string;
            allowCurrentRunToFinish: boolean;
            reasonCode: string;
            reasonMessage: string;
          };
          targets: Array<{
            platform: string;
            arch: string;
            installer: Record<string, unknown>;
            updater: Record<string, unknown>;
            signature: Record<string, unknown>;
          }>;
        };
        published: {
          version: string;
          notes: string;
          publishedAt: string;
          policy: {
            mandatory: boolean;
            forceUpdateBelowVersion: string;
            allowCurrentRunToFinish: boolean;
            reasonCode: string;
            reasonMessage: string;
          };
          targets: Array<{
            platform: string;
            arch: string;
            installer: Record<string, unknown>;
            updater: Record<string, unknown>;
            signature: Record<string, unknown>;
          }>;
        };
      };
    }
  >;
  brands: Array<{
    brandId: string;
    displayName: string;
    productName: string;
    tenantKey: string;
    status: string;
    updatedAt: string;
    surfaceCount: number;
    skillCount: number;
    mcpCount: number;
  }>;
  user: Record<string, unknown> | null;
};

export type BrandDetailData = {
  brand: {
    brandId: string;
    displayName: string;
    productName: string;
    tenantKey: string;
    status: string;
    updatedAt: string;
    publishedVersion: string;
    defaultLocale: string;
  };
  appConfig: Record<string, unknown>;
  skillBindings: Array<Record<string, unknown>>;
  mcpBindings: Array<Record<string, unknown>>;
  modelBindings: Array<Record<string, unknown>>;
  menuBindings: Array<Record<string, unknown>>;
  rechargePackageBindings: Array<Record<string, unknown>>;
  composerControlBindings: Array<Record<string, unknown>>;
  composerShortcutBindings: Array<Record<string, unknown>>;
  assets: Array<Record<string, unknown>>;
  versions: Array<Record<string, unknown>>;
  audit: Array<Record<string, unknown>>;
};
