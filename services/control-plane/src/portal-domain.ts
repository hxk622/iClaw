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
  category: string | null;
  publisher: string;
  visibility: string;
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
  visibility?: string | null;
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
  name: string;
  description: string;
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

export type PortalPresetManifest = {
  schemaVersion: number;
  apps: UpsertPortalAppInput[];
  skills: UpsertPortalSkillInput[];
  mcps: UpsertPortalMcpInput[];
  models?: UpsertPortalModelInput[];
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
  };
};
