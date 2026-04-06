import type {
  AppRechargePackageBindingRecord,
  RechargePackageCatalogRecord,
} from './recharge-packages.ts';

export type PortalJsonObject = Record<string, unknown>;

export type PortalAppStatus = 'active' | 'disabled';

export type PortalAppRecord = {
  appName: string;
  displayName: string;
  description: string | null;
  status: PortalAppStatus;
  defaultLocale: string;
  config: PortalJsonObject;
  createdAt: string;
  updatedAt: string;
};

export type PortalSkillRecord = {
  slug: string;
  name: string;
  description: string;
  market: string | null;
  category: string | null;
  skillType: string | null;
  publisher: string;
  distribution: string | null;
  tags: string[];
  version: string | null;
  sourceUrl: string | null;
  objectKey: string | null;
  contentSha256: string | null;
  metadata: PortalJsonObject;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PortalMcpRecord = {
  mcpKey: string;
  name: string;
  description: string;
  transport: string;
  objectKey: string | null;
  config: PortalJsonObject;
  metadata: PortalJsonObject;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PortalModelRecord = {
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
  metadata: PortalJsonObject;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PortalModelProviderScopeType = 'platform' | 'app';

export type PortalAppModelProviderMode = 'inherit_platform' | 'use_app_profile';

export type PortalModelProviderProfileModelRecord = {
  id: string;
  profileId: string;
  modelRef: string;
  modelId: string;
  label: string;
  logoPresetKey: string | null;
  billingMultiplier: number;
  reasoning: boolean;
  inputModalities: string[];
  contextWindow: number | null;
  maxTokens: number | null;
  enabled: boolean;
  sortOrder: number;
  metadata: PortalJsonObject;
  createdAt: string;
  updatedAt: string;
};

export type PortalModelProviderProfileRecord = {
  id: string;
  scopeType: PortalModelProviderScopeType;
  scopeKey: string;
  providerKey: string;
  providerLabel: string;
  apiProtocol: string;
  baseUrl: string;
  authMode: string;
  apiKey: string;
  logoPresetKey: string | null;
  metadata: PortalJsonObject;
  enabled: boolean;
  sortOrder: number;
  models: PortalModelProviderProfileModelRecord[];
  createdAt: string;
  updatedAt: string;
};

export type PortalAppModelRuntimeOverrideRecord = {
  appName: string;
  providerMode: PortalAppModelProviderMode;
  activeProfileId: string | null;
  cacheVersion: number;
  updatedAt: string;
};

export type PortalResolvedRuntimeModelsResult = {
  appName: string;
  providerMode: PortalAppModelProviderMode;
  resolvedScope: PortalModelProviderScopeType;
  profile: PortalModelProviderProfileRecord;
  models: PortalModelProviderProfileModelRecord[];
  version: number;
};

export type PortalMemoryEmbeddingProfileRecord = {
  id: string;
  scopeType: PortalModelProviderScopeType;
  scopeKey: string;
  providerKey: string;
  providerLabel: string;
  baseUrl: string;
  authMode: string;
  apiKey: string;
  embeddingModel: string;
  logoPresetKey: string | null;
  autoRecall: boolean;
  metadata: PortalJsonObject;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PortalResolvedMemoryEmbeddingResult = {
  appName: string;
  resolvedScope: PortalModelProviderScopeType;
  profile: PortalMemoryEmbeddingProfileRecord;
  version: number;
};

export type PortalMenuRecord = {
  menuKey: string;
  displayName: string;
  category: string | null;
  routeKey: string | null;
  iconKey: string | null;
  active: boolean;
  metadata: PortalJsonObject;
  createdAt: string;
  updatedAt: string;
};

export type PortalComposerControlOptionRecord = {
  controlKey: string;
  optionValue: string;
  label: string;
  description: string;
  sortOrder: number;
  metadata: PortalJsonObject;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PortalComposerControlRecord = {
  controlKey: string;
  displayName: string;
  controlType: string;
  iconKey: string | null;
  metadata: PortalJsonObject;
  active: boolean;
  options: PortalComposerControlOptionRecord[];
  createdAt: string;
  updatedAt: string;
};

export type PortalComposerShortcutRecord = {
  shortcutKey: string;
  displayName: string;
  description: string;
  template: string;
  iconKey: string | null;
  tone: string | null;
  metadata: PortalJsonObject;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PortalRechargePackageRecord = RechargePackageCatalogRecord;

export type PortalAppSkillBindingRecord = {
  appName: string;
  skillSlug: string;
  enabled: boolean;
  sortOrder: number;
  config: PortalJsonObject;
};

export type PortalAppMcpBindingRecord = {
  appName: string;
  mcpKey: string;
  enabled: boolean;
  sortOrder: number;
  config: PortalJsonObject;
};

export type PortalAppModelBindingRecord = {
  appName: string;
  modelRef: string;
  enabled: boolean;
  sortOrder: number;
  config: PortalJsonObject;
  model?: PortalModelRecord | null;
};

export type PortalAppMenuBindingRecord = {
  appName: string;
  menuKey: string;
  enabled: boolean;
  sortOrder: number;
  config: PortalJsonObject;
};

export type PortalAppComposerControlBindingRecord = {
  appName: string;
  controlKey: string;
  enabled: boolean;
  sortOrder: number;
  config: PortalJsonObject;
};

export type PortalAppComposerShortcutBindingRecord = {
  appName: string;
  shortcutKey: string;
  enabled: boolean;
  sortOrder: number;
  config: PortalJsonObject;
};

export type PortalAppRechargePackageBindingRecord = AppRechargePackageBindingRecord;

export type PortalAppAssetRecord = {
  id: string;
  appName: string;
  appDisplayName?: string | null;
  assetKey: string;
  storageProvider?: string | null;
  objectKey: string;
  publicUrl?: string | null;
  contentType: string | null;
  sha256: string | null;
  sizeBytes: number | null;
  metadata: PortalJsonObject;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PortalAppReleaseRecord = {
  id: string;
  appName: string;
  appDisplayName: string | null;
  version: number;
  config: PortalJsonObject;
  changedAreas: string[];
  surfaces: string[];
  skillCount: number;
  mcpCount: number;
  menuCount: number;
  assetCount: number;
  createdBy: string | null;
  createdByName: string | null;
  createdByUsername: string | null;
  createdAt: string;
  publishedAt: string;
};

export type PortalAppAuditRecord = {
  id: string;
  appName: string;
  appDisplayName: string | null;
  action: string;
  actorUserId: string | null;
  actorName: string | null;
  actorUsername: string | null;
  payload: PortalJsonObject;
  createdAt: string;
};

export type PortalAppDetail = {
  app: PortalAppRecord;
  skillBindings: PortalAppSkillBindingRecord[];
  mcpBindings: PortalAppMcpBindingRecord[];
  modelBindings: PortalAppModelBindingRecord[];
  menuBindings: PortalAppMenuBindingRecord[];
  composerControlBindings: PortalAppComposerControlBindingRecord[];
  composerShortcutBindings: PortalAppComposerShortcutBindingRecord[];
  rechargePackageBindings: PortalAppRechargePackageBindingRecord[];
  assets: PortalAppAssetRecord[];
  releases: PortalAppReleaseRecord[];
  audit: PortalAppAuditRecord[];
};

export type UpsertPortalAppInput = {
  appName: string;
  displayName: string;
  description?: string | null;
  status?: PortalAppStatus;
  defaultLocale?: string | null;
  config?: PortalJsonObject;
};

export type UpsertPortalSkillInput = {
  slug: string;
  name: string;
  description: string;
  category?: string | null;
  publisher: string;
  objectKey?: string | null;
  contentSha256?: string | null;
  metadata?: PortalJsonObject;
  active?: boolean;
  fileBase64?: string | null;
  fileName?: string | null;
  contentType?: string | null;
};

export type UpsertPortalMcpInput = {
  mcpKey: string;
  name?: string;
  description?: string;
  transport?: string | null;
  objectKey?: string | null;
  config?: PortalJsonObject;
  metadata?: PortalJsonObject;
  active?: boolean;
};

export type UpsertPortalModelInput = {
  ref: string;
  label: string;
  providerId: string;
  modelId: string;
  api: string;
  baseUrl?: string | null;
  useRuntimeOpenai?: boolean;
  authHeader?: boolean;
  reasoning?: boolean;
  input?: string[];
  contextWindow?: number;
  maxTokens?: number;
  metadata?: PortalJsonObject;
  active?: boolean;
};

export type UpsertPortalModelProviderProfileInput = {
  id?: string | null;
  scopeType: PortalModelProviderScopeType;
  scopeKey: string;
  providerKey: string;
  providerLabel: string;
  apiProtocol: string;
  baseUrl: string;
  authMode?: string | null;
  apiKey: string;
  logoPresetKey?: string | null;
  metadata?: PortalJsonObject;
  enabled?: boolean;
  sortOrder?: number;
  models?: Array<{
    id?: string | null;
    modelRef: string;
    modelId: string;
    label: string;
    logoPresetKey?: string | null;
    billingMultiplier?: number | null;
    reasoning?: boolean;
    inputModalities?: string[];
    contextWindow?: number | null;
    maxTokens?: number | null;
    enabled?: boolean;
    sortOrder?: number;
    metadata?: PortalJsonObject;
  }>;
};

export type UpsertPortalAppModelRuntimeOverrideInput = {
  appName: string;
  providerMode?: PortalAppModelProviderMode;
  activeProfileId?: string | null;
  cacheVersion?: number | null;
};

export type UpsertPortalMemoryEmbeddingProfileInput = {
  id?: string | null;
  scopeType: PortalModelProviderScopeType;
  scopeKey: string;
  providerKey: string;
  providerLabel: string;
  baseUrl: string;
  authMode?: string | null;
  apiKey: string;
  embeddingModel: string;
  logoPresetKey?: string | null;
  autoRecall?: boolean;
  metadata?: PortalJsonObject;
  enabled?: boolean;
};

export type ValidatePortalMemoryEmbeddingProfileInput = {
  providerKey: string;
  baseUrl: string;
  authMode?: string | null;
  apiKey: string;
  embeddingModel: string;
};

export type UpsertPortalMenuInput = {
  menuKey: string;
  displayName: string;
  category?: string | null;
  routeKey?: string | null;
  iconKey?: string | null;
  metadata?: PortalJsonObject;
  active?: boolean;
};

export type UpsertPortalRechargePackageInput = {
  packageId: string;
  packageName: string;
  credits: number;
  bonusCredits?: number;
  amountCnyFen: number;
  sortOrder?: number;
  recommended?: boolean;
  default?: boolean;
  metadata?: PortalJsonObject;
  active?: boolean;
};

export type UpsertPortalComposerControlInput = {
  controlKey: string;
  displayName: string;
  controlType: string;
  iconKey?: string | null;
  metadata?: PortalJsonObject;
  active?: boolean;
  options?: Array<{
    optionValue: string;
    label: string;
    description?: string | null;
    sortOrder?: number;
    metadata?: PortalJsonObject;
    active?: boolean;
  }>;
};

export type UpsertPortalComposerShortcutInput = {
  shortcutKey: string;
  displayName: string;
  description?: string | null;
  template: string;
  iconKey?: string | null;
  tone?: string | null;
  metadata?: PortalJsonObject;
  active?: boolean;
};

export type ReplacePortalAppSkillBindingsInput = Array<{
  skillSlug: string;
  enabled?: boolean;
  sortOrder?: number;
  config?: PortalJsonObject;
}>;

export type ReplacePortalAppMcpBindingsInput = Array<{
  mcpKey: string;
  enabled?: boolean;
  sortOrder?: number;
  config?: PortalJsonObject;
}>;

export type ReplacePortalAppModelBindingsInput = Array<{
  modelRef: string;
  enabled?: boolean;
  sortOrder?: number;
  recommended?: boolean;
  default?: boolean;
  config?: PortalJsonObject;
}>;

export type ReplacePortalAppMenuBindingsInput = Array<{
  menuKey: string;
  enabled?: boolean;
  sortOrder?: number;
  config?: PortalJsonObject;
}>;

export type ReplacePortalAppComposerControlBindingsInput = Array<{
  controlKey: string;
  enabled?: boolean;
  sortOrder?: number;
  config?: PortalJsonObject;
}>;

export type ReplacePortalAppComposerShortcutBindingsInput = Array<{
  shortcutKey: string;
  enabled?: boolean;
  sortOrder?: number;
  config?: PortalJsonObject;
}>;

export type ReplacePortalAppRechargePackageBindingsInput = Array<{
  packageId: string;
  enabled?: boolean;
  sortOrder?: number;
  recommended?: boolean;
  default?: boolean;
  config?: PortalJsonObject;
}>;

export type PortalPresetManifest = {
  schemaVersion: number;
  apps: UpsertPortalAppInput[];
  skills: UpsertPortalSkillInput[];
  mcps: UpsertPortalMcpInput[];
  models?: UpsertPortalModelInput[];
  menus?: UpsertPortalMenuInput[];
  rechargePackages?: UpsertPortalRechargePackageInput[];
  composerControls?: UpsertPortalComposerControlInput[];
  composerShortcuts?: UpsertPortalComposerShortcutInput[];
  assets?: Array<{
    appName: string;
    assetKey: string;
    filePath: string;
    contentType: string;
    metadata?: PortalJsonObject;
  }>;
  bindings: {
    skills: Array<{appName: string; items: ReplacePortalAppSkillBindingsInput}>;
    mcps: Array<{appName: string; items: ReplacePortalAppMcpBindingsInput}>;
    models?: Array<{appName: string; items: ReplacePortalAppModelBindingsInput}>;
    menus: Array<{appName: string; items: ReplacePortalAppMenuBindingsInput}>;
    rechargePackages?: Array<{appName: string; items: ReplacePortalAppRechargePackageBindingsInput}>;
    composerControls?: Array<{appName: string; items: ReplacePortalAppComposerControlBindingsInput}>;
    composerShortcuts?: Array<{appName: string; items: ReplacePortalAppComposerShortcutBindingsInput}>;
  };
};
