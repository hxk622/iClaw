import {execFileSync} from 'node:child_process';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename, dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {config} from '../src/config.ts';
import {buildCloudSkillArtifactObjectKey, CLOUD_SKILL_ARTIFACT_OBJECT_KEY_FIELD} from '../src/cloud-skill-artifacts.ts';
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

async function packageSkillSource(skillDir: string, slug: string): Promise<Buffer> {
  const tempDir = await mkdtemp(resolve(tmpdir(), 'iclaw-cloud-skill-'));
  const archivePath = resolve(tempDir, `${slug}.tar.gz`);
  try {
    execFileSync('tar', ['-czf', archivePath, '-C', dirname(skillDir), basename(skillDir)], {
      stdio: 'pipe',
    });
    return await readFile(archivePath);
  } finally {
    await rm(tempDir, {recursive: true, force: true});
  }
}

async function main() {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const rawSlugs = normalizeSlugList(readArg('--slugs'));
  const currentFile = fileURLToPath(import.meta.url);
  const repoRoot = resolve(dirname(currentFile), '../../..');
  const defaultSourceRoot = resolve(repoRoot, 'skills');
  const sourceRoot = readArg('--source-root') || defaultSourceRoot;
  const store = new PgControlPlaneStore(config.databaseUrl);

  try {
    const targetSlugs =
      rawSlugs.length > 0
        ? rawSlugs
        : (
            await store.listSkillCatalogAdmin(50000, 0, 'agent-reach-')
          )
            .filter(
              (entry) =>
                entry.distribution === 'cloud' &&
                entry.slug.startsWith('agent-reach-') &&
                (entry.artifactSourcePath ||
                  (typeof entry.metadata?.source_kind === 'string' && entry.metadata.source_kind === 'agent-reach-wrapper')),
            )
            .map((entry) => entry.slug);

    const published: Array<{slug: string; objectKey: string; sha256: string; sizeBytes: number}> = [];
    for (const slug of targetSlugs) {
      const entry = await store.getSkillCatalogEntry(slug);
      if (!entry) {
        throw new Error(`cloud skill not found: ${slug}`);
      }
      const sourceDir = resolve(sourceRoot, slug);
      const archive = await packageSkillSource(sourceDir, slug);
      const objectKey = buildCloudSkillArtifactObjectKey({
        slug,
        version: entry.version,
        artifactFormat: entry.artifactFormat,
      });
      const uploaded = await uploadPortalSkillArtifact({
        slug,
        artifact: archive,
        filename: `${slug}.${entry.artifactFormat === 'zip' ? 'zip' : 'tar.gz'}`,
        contentType: entry.artifactFormat === 'zip' ? 'application/zip' : 'application/gzip',
        objectKey,
      });

      await store.upsertSkillCatalogEntry({
        slug: entry.slug,
        name: entry.name,
        description: entry.description,
        market: entry.market,
        category: entry.category,
        skill_type: entry.skillType,
        publisher: entry.publisher,
        distribution: entry.distribution,
        tags: entry.tags,
        version: entry.version,
        artifact_url: null,
        artifact_format: uploaded.artifactFormat,
        artifact_sha256: uploaded.contentSha256,
        artifact_source_path: null,
        origin_type: 'manual',
        source_url: entry.sourceUrl,
        metadata: {
          ...(entry.metadata || {}),
          [CLOUD_SKILL_ARTIFACT_OBJECT_KEY_FIELD]: uploaded.objectKey,
        },
        active: entry.active,
      });

      published.push({
        slug,
        objectKey: uploaded.objectKey,
        sha256: uploaded.contentSha256,
        sizeBytes: uploaded.sizeBytes,
      });
    }

    console.log(JSON.stringify({ok: true, published}, null, 2));
  } finally {
    await store.close();
  }
}

await main();
