import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {dirname, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

import {
  buildCloudSkillArtifactObjectKey,
  CLOUD_SKILL_ARTIFACT_OBJECT_KEY_FIELD,
  getCloudSkillArtifactObjectKey,
} from '../src/cloud-skill-artifacts.ts';
import {config} from '../src/config.ts';
import {PgControlPlaneStore} from '../src/pg-store.ts';
import {uploadPortalSkillArtifact} from '../src/portal-skill-storage.ts';

function readArg(name: string): string | null {
  const index = process.argv.findIndex((item) => item === name);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

function normalizeSlugList(value: string | null): string[] {
  if (!value) return [];
  return Array.from(
    new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

const currentFile = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(currentFile), '../../..');
const skillsSourceRoot = resolve(process.env.ICLAW_SKILLS_SOURCE_DIR || resolve(repoRoot, 'skills'));

function resolveSkillSourceDir(relativePath: string): string {
  const normalized = relativePath.trim().replace(/^[/\\]+/, '');
  if (!normalized) {
    throw new Error('skill source path is empty');
  }
  const target = resolve(skillsSourceRoot, normalized);
  if (target !== skillsSourceRoot && !target.startsWith(`${skillsSourceRoot}${sep}`)) {
    throw new Error(`skill source path escapes root: ${relativePath}`);
  }
  if (!existsSync(target)) {
    throw new Error(`skill source path not found: ${relativePath}`);
  }
  return target;
}

function packageSkillArtifact(relativePath: string): Buffer {
  resolveSkillSourceDir(relativePath);
  return execFileSync('tar', ['-czf', '-', '-C', skillsSourceRoot, relativePath], {
    encoding: 'buffer',
    maxBuffer: 128 * 1024 * 1024,
  }) as Buffer;
}

async function main() {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const targetSlugs = normalizeSlugList(readArg('--slugs'));
  const store = new PgControlPlaneStore(config.databaseUrl);

  try {
    const entries = await store.listSkillCatalogAdmin();
    const candidates = entries.filter((entry) => {
      if (entry.distribution !== 'bundled' || !entry.artifactSourcePath) {
        return false;
      }
      if (targetSlugs.length > 0 && !targetSlugs.includes(entry.slug)) {
        return false;
      }
      return true;
    });

    if (candidates.length === 0) {
      console.log(JSON.stringify({ok: true, migrated: [], skipped: []}, null, 2));
      return;
    }

    const migrated: Array<{slug: string; objectKey: string; sha256: string; sizeBytes: number}> = [];
    const skipped: Array<{slug: string; reason: string}> = [];

    for (const entry of candidates) {
      const existingObjectKey = getCloudSkillArtifactObjectKey(entry.metadata || {});
      let objectKey = existingObjectKey;
      let contentSha256 = entry.artifactSha256 || '';
      let sizeBytes = 0;

      if (!objectKey) {
        const artifact = packageSkillArtifact(entry.artifactSourcePath);
        const uploaded = await uploadPortalSkillArtifact({
          slug: entry.slug,
          artifact,
          filename: `${entry.slug}.tar.gz`,
          contentType: 'application/gzip',
          objectKey: buildCloudSkillArtifactObjectKey({
            slug: entry.slug,
            version: entry.version,
            artifactFormat: 'tar.gz',
          }),
        });
        objectKey = uploaded.objectKey;
        contentSha256 = uploaded.contentSha256;
        sizeBytes = uploaded.sizeBytes;
      }

      if (!objectKey) {
        skipped.push({slug: entry.slug, reason: 'missing object key after upload'});
        continue;
      }

      await store.upsertSkillCatalogEntry({
        slug: entry.slug,
        name: entry.name,
        description: entry.description,
        market: entry.market,
        category: entry.category,
        skill_type: entry.skillType,
        publisher: entry.publisher,
        distribution: 'cloud',
        tags: entry.tags,
        version: entry.version,
        artifact_url: null,
        artifact_format: 'tar.gz',
        artifact_sha256: contentSha256 || null,
        artifact_source_path: null,
        origin_type: entry.originType === 'bundled' ? 'manual' : entry.originType,
        source_url: entry.sourceUrl,
        metadata: {
          ...(entry.metadata || {}),
          [CLOUD_SKILL_ARTIFACT_OBJECT_KEY_FIELD]: objectKey,
        },
        active: entry.active,
      });

      migrated.push({
        slug: entry.slug,
        objectKey,
        sha256: contentSha256,
        sizeBytes,
      });
    }

    console.log(JSON.stringify({ok: true, migrated, skipped}, null, 2));
  } finally {
    await store.close();
  }
}

await main();
