import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {basename, resolve} from 'node:path';

import type {PortalJsonObject, PortalPresetManifest} from './portal-domain.ts';
import {uploadPortalAssetFile} from './portal-asset-storage.ts';
import type {PgPortalStore} from './portal-store.ts';

function normalizeJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeJsonValue(item));
  }
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort((left, right) => left.localeCompare(right))
      .reduce<Record<string, unknown>>((accumulator, key) => {
        accumulator[key] = normalizeJsonValue((value as Record<string, unknown>)[key]);
        return accumulator;
      }, {});
  }
  return value ?? null;
}

function stableJsonStringify(value: unknown): string {
  return JSON.stringify(normalizeJsonValue(value));
}

function buildPresetAssetMetadata(asset: NonNullable<PortalPresetManifest['assets']>[number]): PortalJsonObject {
  return {
    sourceType: 'preset',
    presetFilePath: asset.filePath,
    ...(asset.metadata || {}),
  };
}

export async function syncPortalPresetManifest(
  store: PgPortalStore,
  manifest: PortalPresetManifest,
  options: {
    manifestDir: string;
    preserveExistingAppState?: boolean;
  },
): Promise<void> {
  await store.syncPreset({
    apps: manifest.apps || [],
    skills: manifest.skills || [],
    mcps: manifest.mcps || [],
    models: manifest.models || [],
    menus: manifest.menus || [],
    composerControls: manifest.composerControls || [],
    composerShortcuts: manifest.composerShortcuts || [],
    skillBindings: manifest.bindings?.skills || [],
    mcpBindings: manifest.bindings?.mcps || [],
    modelBindings: manifest.bindings?.models || [],
    menuBindings: manifest.bindings?.menus || [],
    composerControlBindings: manifest.bindings?.composerControls || [],
    composerShortcutBindings: manifest.bindings?.composerShortcuts || [],
    preserveExistingAppState: options.preserveExistingAppState === true,
  });

  for (const asset of manifest.assets || []) {
    const existing = await store.getAppAsset(asset.appName, asset.assetKey);
    const existingSourceType = typeof existing?.metadata?.sourceType === 'string' ? String(existing.metadata.sourceType) : '';
    if (existing && existingSourceType && existingSourceType !== 'preset') {
      continue;
    }

    const absolutePath = resolve(options.manifestDir, asset.filePath);
    const content = await readFile(absolutePath);
    const sha256 = createHash('sha256').update(content).digest('hex');
    const metadata = buildPresetAssetMetadata(asset);
    const existingMetadataMatches = stableJsonStringify(existing?.metadata || {}) === stableJsonStringify(metadata);
    const canReuseExistingUpload =
      existingSourceType === 'preset' &&
      typeof existing?.storageProvider === 'string' &&
      existing.storageProvider.trim().length > 0 &&
      typeof existing.objectKey === 'string' &&
      existing.objectKey.trim().length > 0 &&
      existing.sha256 === sha256;
    if (
      canReuseExistingUpload &&
      existing.contentType === asset.contentType &&
      existing.sizeBytes === content.length &&
      existingMetadataMatches
    ) {
      continue;
    }
    if (canReuseExistingUpload) {
      await store.upsertAsset({
        appName: asset.appName,
        assetKey: asset.assetKey,
        storageProvider: existing.storageProvider || 's3',
        objectKey: existing.objectKey,
        publicUrl: existing.publicUrl || null,
        contentType: asset.contentType,
        sha256,
        sizeBytes: content.length,
        metadata,
        actorUserId: null,
      });
      continue;
    }
    const uploaded = await uploadPortalAssetFile({
      appName: asset.appName,
      assetKey: asset.assetKey,
      content,
      contentType: asset.contentType,
      filename: basename(absolutePath),
    });

    await store.upsertAsset({
      appName: asset.appName,
      assetKey: asset.assetKey,
      storageProvider: uploaded.storageProvider,
      objectKey: uploaded.objectKey,
      publicUrl: uploaded.publicUrl,
      contentType: asset.contentType,
      sha256: uploaded.sha256,
      sizeBytes: uploaded.sizeBytes,
      metadata,
      actorUserId: null,
    });
  }
}
