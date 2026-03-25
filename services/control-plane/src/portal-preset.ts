import {readFile} from 'node:fs/promises';
import {basename, resolve} from 'node:path';

import type {PortalPresetManifest} from './portal-domain.ts';
import {uploadPortalAssetFile} from './portal-asset-storage.ts';
import type {PgPortalStore} from './portal-store.ts';

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
      metadata: {
        sourceType: 'preset',
        presetFilePath: asset.filePath,
        ...(asset.metadata || {}),
      },
      actorUserId: null,
    });
  }
}
