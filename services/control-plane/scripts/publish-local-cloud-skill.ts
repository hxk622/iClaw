import {execFile} from 'node:child_process';
import {cp, mkdir, mkdtemp, readFile, readdir, rm, stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename, dirname, resolve} from 'node:path';
import {promisify} from 'node:util';

import {config} from '../src/config.ts';
import {buildCloudSkillArtifactObjectKey, CLOUD_SKILL_ARTIFACT_OBJECT_KEY_FIELD} from '../src/cloud-skill-artifacts.ts';
import {PgControlPlaneStore} from '../src/pg-store.ts';
import {uploadPortalSkillArtifact} from '../src/portal-skill-storage.ts';

const execFileAsync = promisify(execFile);

function readArg(name: string): string | null {
  const index = process.argv.findIndex((item) => item === name);
  if (index === -1) {
    return null;
  }
  return process.argv[index + 1] || null;
}

function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePath(value: string | null, field: string): string {
  const normalized = trimString(value);
  if (!normalized) {
    throw new Error(`${field} is required`);
  }
  return resolve(normalized);
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function copySkillSource(sourceDir: string, stageDir: string): Promise<void> {
  await cp(sourceDir, stageDir, {recursive: true, force: true});
}

async function removeJunkFiles(root: string): Promise<void> {
  const entries = await readdir(root, {withFileTypes: true});
  for (const entry of entries) {
    const target = resolve(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__pycache__' || entry.name === '.pytest_cache' || entry.name === '.mypy_cache') {
        await rm(target, {recursive: true, force: true});
        continue;
      }
      await removeJunkFiles(target);
      continue;
    }
    if (entry.name === '.DS_Store' || entry.name.endsWith('.pyc') || entry.name.endsWith('.pyo')) {
      await rm(target, {force: true});
    }
  }
}

async function buildTarGzArchive(slug: string, stageRoot: string, artifactDir: string): Promise<string> {
  const artifactPath = resolve(artifactDir, `${slug}.tar.gz`);
  await mkdir(dirname(artifactPath), {recursive: true});
  await rm(artifactPath, {force: true});
  const tarCommand = process.platform === 'win32' ? 'tar.exe' : 'tar';
  await execFileAsync(tarCommand, ['-czf', artifactPath, slug], {cwd: stageRoot});
  return artifactPath;
}

async function main() {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const slug = trimString(readArg('--slug')).toLowerCase();
  const sourceDir = normalizePath(readArg('--source'), '--source');
  const artifactDir = resolve(trimString(readArg('--artifact-dir')) || '.tmp/local-cloud-skills');
  const requestedVersion = trimString(readArg('--version'));
  if (!slug) {
    throw new Error('--slug is required');
  }
  if (!(await pathExists(resolve(sourceDir, 'SKILL.md')))) {
    throw new Error(`SKILL.md not found in ${sourceDir}`);
  }

  const tempRoot = await mkdtemp(resolve(tmpdir(), 'iclaw-local-cloud-skill-'));
  const stageRoot = resolve(tempRoot, 'stage');
  const stageDir = resolve(stageRoot, slug);
  const store = new PgControlPlaneStore(config.databaseUrl);

  try {
    const existing = await store.getSkillCatalogEntry(slug);
    if (!existing) {
      throw new Error(`skill catalog entry not found: ${slug}`);
    }

    const version = requestedVersion || trimString(existing.version) || '1.0.0';
    await mkdir(stageRoot, {recursive: true});
    await copySkillSource(sourceDir, stageDir);
    await removeJunkFiles(stageDir);

    const artifactPath = await buildTarGzArchive(slug, stageRoot, artifactDir);
    const artifact = await readFile(artifactPath);
    const objectKey = buildCloudSkillArtifactObjectKey({
      slug,
      version,
      artifactFormat: 'tar.gz',
    });
    const uploaded = await uploadPortalSkillArtifact({
      slug,
      artifact,
      filename: `${slug}.tar.gz`,
      contentType: 'application/gzip',
      objectKey,
    });

    await store.upsertSkillCatalogEntry({
      slug: existing.slug,
      name: existing.name,
      description: existing.description,
      market: existing.market,
      category: existing.category,
      skill_type: existing.skillType,
      publisher: existing.publisher,
      distribution: 'cloud',
      tags: existing.tags,
      version,
      artifact_url: null,
      artifact_format: uploaded.artifactFormat,
      artifact_sha256: uploaded.contentSha256,
      artifact_source_path: null,
      origin_type: existing.originType,
      source_url: existing.sourceUrl,
      metadata: {
        ...(existing.metadata || {}),
        source_kind: 'local_repo',
        source_label: 'repo-local-skill',
        local_source_dir: sourceDir,
        [CLOUD_SKILL_ARTIFACT_OBJECT_KEY_FIELD]: uploaded.objectKey,
      },
      active: existing.active,
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          slug,
          version,
          sourceDir,
          artifactPath,
          objectKey: uploaded.objectKey,
          artifactSha256: uploaded.contentSha256,
          sizeBytes: uploaded.sizeBytes,
        },
        null,
        2,
      ),
    );
  } finally {
    await store.close();
    await rm(tempRoot, {recursive: true, force: true});
  }
}

await main();
