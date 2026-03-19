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
  version: number;
  config: OemJsonObject;
  createdBy: string | null;
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
  action: string;
  actorUserId: string | null;
  payload: OemJsonObject;
  createdAt: string;
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
