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
  | 'user-action-audit'
  | 'auto-fault-reports'
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
  | 'audit-log'
  | 'client-metrics'
  | 'finance-compliance'
  | 'sync-tasks'
  | 'fault-reports';

export type NavItem = {
  id: AdminRoute | 'payments' | 'fault-center' | 'audit-center';
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
    config: Record<string, unknown>;
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
  modelLogoPresets: Array<{
    presetKey: string;
    label: string;
    fileName: string;
    contentType: string;
    url: string;
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
    objectKey?: string;
    command?: string;
    httpUrl?: string;
    envKeys?: string[];
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
    displayName: string;
    controlType: string;
    iconKey: string;
    metadata: Record<string, unknown>;
    sortOrder: number;
    options: Array<{
      optionValue: string;
      label: string;
      description: string;
      sortOrder: number;
      metadata: Record<string, unknown>;
      active: boolean;
    }>;
    active: boolean;
  }>;
  composerShortcutCatalog: Array<{
    shortcutKey: string;
    displayName: string;
    description: string;
    template: string;
    iconKey: string;
    tone: string;
    metadata: Record<string, unknown>;
    sortOrder: number;
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
            release: {
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
            };
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
            release: {
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
            };
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
            release: {
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
            };
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
            release: {
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
            };
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

export type UserActionAuditRecord = {
  id: string;
  intentId: string;
  traceId: string;
  userId: string;
  deviceId: string;
  appName: string;
  agentId: string;
  skillSlug: string;
  workflowId: string;
  capability: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  requiresElevation: boolean;
  decision: 'allow' | 'deny' | 'pending';
  stage:
    | 'intent_created'
    | 'policy_evaluated'
    | 'approval_requested'
    | 'approval_granted'
    | 'approval_denied'
    | 'plan_mismatch_denied'
    | 'execution_started'
    | 'execution_finished';
  summary: string;
  reason: string;
  resources: Array<Record<string, unknown>>;
  matchedPolicyRuleId: string;
  approvedPlanHash: string;
  executedPlanHash: string;
  commandSnapshotRedacted: string;
  resultCode: string;
  resultSummary: string;
  durationMs: number | null;
  createdAt: string;
};

export type UserActionDiagnosticUploadRecord = {
  id: string;
  userId: string;
  username: string;
  userDisplayName: string;
  deviceId: string;
  appName: string;
  uploadBucket: string;
  uploadKey: string;
  fileName: string;
  fileSizeBytes: number;
  sha256: string;
  sourceType: string;
  containsCustomerLogs: boolean;
  sensitivityLevel: 'customer' | 'internal' | 'redacted';
  linkedIntentId: string;
  createdAt: string;
};

export type DesktopFaultReportSummaryRecord = {
  id: string;
  reportId: string;
  entry: 'installer' | 'exception-dialog';
  accountState: 'anonymous' | 'authenticated';
  userId: string;
  username: string;
  userDisplayName: string;
  deviceId: string;
  installSessionId: string;
  appName: string;
  brandId: string;
  appVersion: string;
  releaseChannel: string;
  platform: string;
  platformVersion: string;
  arch: string;
  failureStage: string;
  errorTitle: string;
  errorMessage: string;
  errorCode: string;
  fileName: string;
  fileSizeBytes: number;
  fileSha256: string;
  createdAt: string;
};

export type DesktopFaultReportDetailRecord = DesktopFaultReportSummaryRecord & {
  runtimeFound: boolean;
  runtimeInstallable: boolean;
  runtimeVersion: string;
  runtimePath: string;
  workDir: string;
  logDir: string;
  runtimeDownloadUrl: string;
  installProgressPhase: string;
  installProgressPercent: number | null;
  uploadBucket: string;
  uploadKey: string;
  downloadUrl: string;
};

export type ClientMetricEventRecord = {
  id: string;
  eventName: string;
  eventTime: string;
  userId: string;
  deviceId: string;
  sessionId: string;
  installId: string;
  appName: string;
  brandId: string;
  appVersion: string;
  releaseChannel: string;
  platform: string;
  osVersion: string;
  arch: string;
  page: string;
  result: 'success' | 'failed' | null;
  errorCode: string;
  durationMs: number | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type ClientCrashEventRecord = {
  id: string;
  crashType: 'native' | 'renderer' | 'sidecar';
  eventTime: string;
  userId: string;
  deviceId: string;
  appName: string;
  brandId: string;
  appVersion: string;
  platform: string;
  osVersion: string;
  arch: string;
  errorTitle: string;
  errorMessage: string;
  stackSummary: string;
  fileBucket: string;
  fileKey: string;
  createdAt: string;
};

export type ClientPerfSampleRecord = {
  id: string;
  metricName:
    | 'cold_start_ms'
    | 'warm_start_ms'
    | 'page_load_ms'
    | 'api_latency_ms'
    | 'memory_mb'
    | 'cpu_percent';
  metricTime: string;
  userId: string;
  deviceId: string;
  appName: string;
  brandId: string;
  appVersion: string;
  releaseChannel: string;
  platform: string;
  osVersion: string;
  arch: string;
  value: number;
  unit: string;
  sampleRate: number | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type FinanceComplianceEventRecord = {
  id: string;
  appName: string;
  sessionKey: string;
  conversationId: string | null;
  channel: 'chat' | 'cron' | 'notification' | 'report';
  sourceSurface: string | null;
  inputClassification:
    | 'market_info'
    | 'research_request'
    | 'advice_request'
    | 'personalized_request'
    | 'execution_request'
    | null;
  outputClassification: 'market_data' | 'research_summary' | 'investment_view' | 'actionable_advice' | null;
  riskLevel: 'low' | 'medium' | 'high';
  showDisclaimer: boolean;
  disclaimerText: string | null;
  degraded: boolean;
  blocked: boolean;
  reasons: string[];
  matchedRules: string[];
  confidence: 'low' | 'medium' | 'high';
  classifierVersion: string | null;
  decisionSource: 'plugin' | 'server' | 'heuristic_fallback';
  usedCapabilities: string[];
  usedModel: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type FinanceComplianceSummaryData = {
  totalEvents: number;
  disclaimerCount: number;
  degradedCount: number;
  blockedCount: number;
  disclaimerRate: number;
  heuristicFallbackCount: number;
  unknownOutputCount: number;
  byChannel: Array<{
    channel: 'chat' | 'cron' | 'notification' | 'report';
    count: number;
  }>;
  byOutputClassification: Array<{
    outputClassification: 'market_data' | 'research_summary' | 'investment_view' | 'actionable_advice' | 'unknown';
    count: number;
  }>;
  topReasons: Array<{
    reason: string;
    count: number;
  }>;
  byDay: Array<{
    date: string;
    total: number;
    disclaimerCount: number;
    degradedCount: number;
    blockedCount: number;
  }>;
};

export type SyncTaskRunRecord = {
  runId: string;
  taskId: string;
  taskLabel: string;
  category: string;
  triggerType: 'manual' | 'schedule' | 'warmup';
  schedule: string | null;
  status: 'running' | 'success' | 'failed' | 'skipped';
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  syncCount: number | null;
  dataSource: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type SyncTaskRunTriggerResult = {
  runId: string;
  taskId: string;
  triggerType: 'manual';
  status: 'running' | 'success' | 'failed' | 'skipped';
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
