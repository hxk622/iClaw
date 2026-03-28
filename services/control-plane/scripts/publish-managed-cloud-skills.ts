import {readdir, readFile} from 'node:fs/promises';
import {basename, resolve} from 'node:path';

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

async function readArtifactFile(artifactPath: string): Promise<Buffer> {
  return await readFile(artifactPath);
}

function detectArtifactFormat(filename: string): 'tar.gz' | 'zip' {
  if (filename.endsWith('.zip')) {
    return 'zip';
  }
  if (filename.endsWith('.tar.gz')) {
    return 'tar.gz';
  }
  throw new Error(`unsupported artifact format: ${filename}`);
}

async function collectArtifactFiles(artifactDir: string): Promise<Map<string, string>> {
  const entries = await readdir(artifactDir, {withFileTypes: true});
  const result = new Map<string, string>();
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const name = entry.name.trim();
    const slug = name.endsWith('.tar.gz')
      ? name.slice(0, -'.tar.gz'.length)
      : name.endsWith('.zip')
        ? name.slice(0, -'.zip'.length)
        : '';
    if (!slug) continue;
    result.set(slug, resolve(artifactDir, name));
  }
  return result;
}

async function main() {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const rawSlugs = normalizeSlugList(readArg('--slugs'));
  const artifactDirArg = readArg('--artifact-dir');
  if (!artifactDirArg) {
    throw new Error('--artifact-dir is required; cloud skill publishing only accepts prebuilt artifacts');
  }
  const artifactDir = resolve(artifactDirArg);
  const artifactFiles = await collectArtifactFiles(artifactDir);
  const store = new PgControlPlaneStore(config.databaseUrl);

  try {
    const targetSlugs = rawSlugs.length > 0 ? rawSlugs : Array.from(artifactFiles.keys()).sort();
    if (targetSlugs.length === 0) {
      throw new Error(`no cloud skill artifacts found in ${artifactDir}`);
    }

    const published: Array<{slug: string; objectKey: string; sha256: string; sizeBytes: number}> = [];
    for (const slug of targetSlugs) {
      const entry = await store.getSkillCatalogEntry(slug);
      if (!entry) {
        throw new Error(`cloud skill not found: ${slug}`);
      }
      const artifactPath = artifactFiles.get(slug);
      if (!artifactPath) {
        throw new Error(`artifact not found for ${slug} in ${artifactDir}`);
      }
      const artifactFormat = detectArtifactFormat(basename(artifactPath));
      const archive = await readArtifactFile(artifactPath);
      const objectKey = buildCloudSkillArtifactObjectKey({
        slug,
        version: entry.version,
        artifactFormat,
      });
      const uploaded = await uploadPortalSkillArtifact({
        slug,
        artifact: archive,
        filename: `${slug}.${artifactFormat === 'zip' ? 'zip' : 'tar.gz'}`,
        contentType: artifactFormat === 'zip' ? 'application/zip' : 'application/gzip',
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
