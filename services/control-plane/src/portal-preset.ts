import {execFileSync} from 'node:child_process';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename, resolve} from 'node:path';

import {config} from './config.ts';
import type {PortalPresetManifest} from './portal-domain.ts';
import {uploadPortalAssetFile} from './portal-asset-storage.ts';
import {downloadPortalSkillArtifact, uploadPortalSkillArtifact} from './portal-skill-storage.ts';
import {PgControlPlaneStore} from './pg-store.ts';
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

  if (config.databaseUrl) {
    await syncPresetSkillArtifacts(store, manifest, options);
  }
}

async function syncPresetSkillArtifacts(
  store: PgPortalStore,
  manifest: PortalPresetManifest,
  options: {
    manifestDir: string;
  },
): Promise<void> {
  const repoRoot = resolve(options.manifestDir, '../../..');
  const skillsRoot = resolve(repoRoot, 'skills');
  const controlStore = new PgControlPlaneStore(config.databaseUrl);
  try {
    for (const skill of manifest.skills || []) {
      const current = await store.getSkill(skill.slug);
      if (!current) {
        continue;
      }
      if (current.objectKey) {
        try {
          await downloadPortalSkillArtifact(current.objectKey);
          continue;
        } catch {
          // Continue to rebuild preset artifact below.
        }
      }
      const legacy = await controlStore.getSkillCatalogEntry(skill.slug);
      const sourcePath = legacy?.artifactSourcePath?.trim() || '';
      if (!sourcePath) {
        continue;
      }
      const skillDir = resolve(skillsRoot, sourcePath);
      const tempRoot = await mkdtemp(resolve(tmpdir(), 'iclaw-preset-skill-'));
      try {
        const archivePath = resolve(tempRoot, `${skill.slug}.tar.gz`);
        execFileSync('tar', ['-czf', archivePath, '-C', skillsRoot, sourcePath], {
          stdio: 'pipe',
        });
        const artifact = await readFile(archivePath);
        const uploaded = await uploadPortalSkillArtifact({
          slug: skill.slug,
          artifact,
          filename: `${skill.slug}.tar.gz`,
          contentType: 'application/gzip',
        });
        await store.upsertSkill({
          ...skill,
          objectKey: uploaded.objectKey,
          contentSha256: uploaded.contentSha256,
          metadata: {
            ...(skill.metadata || {}),
            artifact_format: uploaded.artifactFormat,
            artifact_size_bytes: uploaded.sizeBytes,
            seeded_source_path: sourcePath,
          },
        });
      } finally {
        await rm(tempRoot, {recursive: true, force: true});
      }
    }
  } finally {
    await controlStore.close();
  }
}
