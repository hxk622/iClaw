export type PortalJsonObject = Record<string, unknown>;

export type PortalRuntimeReleaseScopeType = 'platform' | 'app';

export type PortalRuntimeReleaseStatus = 'draft' | 'published' | 'deprecated' | 'archived';

export type PortalRuntimeReleaseRecord = {
  id: string;
  runtimeKind: string;
  version: string;
  channel: string;
  platform: string;
  arch: string;
  targetTriple: string;
  artifactType: string;
  storageProvider: string;
  bucketName: string | null;
  objectKey: string | null;
  artifactUrl: string;
  artifactSha256: string | null;
  artifactSizeBytes: number | null;
  launcherRelativePath: string | null;
  gitCommit: string | null;
  gitTag: string | null;
  releaseVersion: string | null;
  buildTime: string | null;
  buildInfo: PortalJsonObject;
  metadata: PortalJsonObject;
  status: PortalRuntimeReleaseStatus;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};

export type PortalRuntimeReleaseBindingRecord = {
  id: string;
  scopeType: PortalRuntimeReleaseScopeType;
  scopeKey: string;
  runtimeKind: string;
  channel: string;
  platform: string;
  arch: string;
  targetTriple: string;
  releaseId: string;
  enabled: boolean;
  metadata: PortalJsonObject;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PortalRuntimeReleaseBindingHistoryRecord = {
  id: string;
  bindingId: string;
  scopeType: PortalRuntimeReleaseScopeType;
  scopeKey: string;
  runtimeKind: string;
  channel: string;
  platform: string;
  arch: string;
  targetTriple: string;
  fromReleaseId: string | null;
  toReleaseId: string | null;
  changeReason: string | null;
  operatorUserId: string | null;
  metadata: PortalJsonObject;
  createdAt: string;
};

export type PortalResolvedRuntimeReleaseResult = {
  appName: string;
  resolvedScope: PortalRuntimeReleaseScopeType;
  binding: PortalRuntimeReleaseBindingRecord;
  release: PortalRuntimeReleaseRecord;
};

export type ListPortalRuntimeReleasesInput = {
  runtimeKind?: string | null;
  channel?: string | null;
  platform?: string | null;
  arch?: string | null;
  status?: PortalRuntimeReleaseStatus | null;
  limit?: number | null;
};

export type UpsertPortalRuntimeReleaseInput = {
  id?: string | null;
  runtimeKind: string;
  version: string;
  channel: string;
  platform: string;
  arch: string;
  targetTriple: string;
  artifactType?: string | null;
  storageProvider?: string | null;
  bucketName?: string | null;
  objectKey?: string | null;
  artifactUrl: string;
  artifactSha256?: string | null;
  artifactSizeBytes?: number | null;
  launcherRelativePath?: string | null;
  gitCommit?: string | null;
  gitTag?: string | null;
  releaseVersion?: string | null;
  buildTime?: string | null;
  buildInfo?: PortalJsonObject;
  metadata?: PortalJsonObject;
  status?: PortalRuntimeReleaseStatus;
};

export type ListPortalRuntimeReleaseBindingsInput = {
  scopeType?: PortalRuntimeReleaseScopeType | null;
  scopeKey?: string | null;
  runtimeKind?: string | null;
  channel?: string | null;
  platform?: string | null;
  arch?: string | null;
  limit?: number | null;
};

export type UpsertPortalRuntimeReleaseBindingInput = {
  id?: string | null;
  scopeType: PortalRuntimeReleaseScopeType;
  scopeKey: string;
  runtimeKind: string;
  channel: string;
  platform: string;
  arch: string;
  targetTriple: string;
  releaseId: string;
  enabled?: boolean;
  metadata?: PortalJsonObject;
  changeReason?: string | null;
};

export type ListPortalRuntimeReleaseBindingHistoryInput = {
  bindingId?: string | null;
  scopeType?: PortalRuntimeReleaseScopeType | null;
  scopeKey?: string | null;
  runtimeKind?: string | null;
  channel?: string | null;
  targetTriple?: string | null;
  limit?: number | null;
};

export type ResolvePortalRuntimeReleaseInput = {
  runtimeKind?: string | null;
  channel?: string | null;
  platform?: string | null;
  arch?: string | null;
};

export type PortalLegacyRuntimeBootstrapArtifactRecord = {
  targetTriple: string;
  platform: string;
  arch: string;
  artifactUrl: string;
  artifactSha256: string | null;
  artifactFormat: string;
  launcherRelativePath: string | null;
  objectKey: string | null;
};

export type PortalLegacyRuntimeBootstrapSourceRecord = {
  sourcePath: string;
  version: string;
  runtimeKind: string;
  artifacts: PortalLegacyRuntimeBootstrapArtifactRecord[];
};

export type ImportPortalRuntimeBootstrapInput = {
  runtimeKind?: string | null;
  channel: string;
  status?: PortalRuntimeReleaseStatus | null;
  bindScopeType?: PortalRuntimeReleaseScopeType | null;
  bindScopeKey?: string | null;
  bind_scope_type?: PortalRuntimeReleaseScopeType | null;
  bind_scope_key?: string | null;
};

export type ImportPortalRuntimeBootstrapResult = {
  source: PortalLegacyRuntimeBootstrapSourceRecord;
  importedReleases: PortalRuntimeReleaseRecord[];
  importedBindings: PortalRuntimeReleaseBindingRecord[];
};
