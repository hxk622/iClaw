export type OemJsonObject = Record<string, unknown>;

export type OemBrandStatus = 'draft' | 'published' | 'archived';

export type OemBrandRecord = {
  brandId: string;
  tenantKey: string;
  displayName: string;
  productName: string;
  status: OemBrandStatus;
  draftConfig: OemJsonObject;
  publishedConfig: OemJsonObject | null;
  publishedVersion: number;
  createdAt: string;
  updatedAt: string;
};

export type OemBrandVersionRecord = {
  id: string;
  brandId: string;
  brandDisplayName: string | null;
  version: number;
  config: OemJsonObject;
  createdBy: string | null;
  createdByName: string | null;
  createdByUsername: string | null;
  createdAt: string;
  publishedAt: string;
};

export type OemAssetRecord = {
  id: string;
  brandId: string;
  assetKey: string;
  kind: string;
  storageProvider: string;
  objectKey: string;
  publicUrl: string | null;
  metadata: OemJsonObject;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OemAuditEventRecord = {
  id: string;
  brandId: string;
  brandDisplayName: string | null;
  brandProductName: string | null;
  action: string;
  actorUserId: string | null;
  actorName: string | null;
  actorUsername: string | null;
  payload: OemJsonObject;
  createdAt: string;
};

export type OemBrandSummaryRecord = {
  brandId: string;
  tenantKey: string;
  displayName: string;
  productName: string;
  status: OemBrandStatus;
  publishedVersion: number;
  createdAt: string;
  updatedAt: string;
  lastPublishedAt: string | null;
  assetCount: number;
};

export type OemAssetListRecord = OemAssetRecord & {
  brandDisplayName: string | null;
  brandProductName: string | null;
};

export type UpsertOemAssetInput = {
  brandId: string;
  assetKey: string;
  kind: string;
  storageProvider: string;
  objectKey: string;
  publicUrl: string | null;
  metadata: OemJsonObject;
  actorUserId: string | null;
};

export type SeedOemBrandInput = {
  brandId: string;
  tenantKey: string;
  displayName: string;
  productName: string;
  config: OemJsonObject;
  assets: Array<{
    assetKey: string;
    kind: string;
    storageProvider: string;
    objectKey: string;
    publicUrl?: string | null;
    metadata?: OemJsonObject;
  }>;
};

export type UpsertOemBrandDraftInput = {
  brandId: string;
  tenantKey: string;
  displayName: string;
  productName: string;
  status: OemBrandStatus;
  draftConfig: OemJsonObject;
  actorUserId: string | null;
};
