import {execFile} from 'node:child_process';
import {cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename, dirname, resolve} from 'node:path';
import {promisify} from 'node:util';

import {config} from '../src/config.ts';
import {CLOUD_SKILL_ARTIFACT_OBJECT_KEY_FIELD} from '../src/cloud-skill-artifacts.ts';
import {
  buildRemotionSkillMarkdown,
  FRONTEND_SLIDES_CLOUD_SKILL_REQUIRED_PATHS,
  FRONTEND_SLIDES_CLOUD_SKILL_SLUG,
  buildXiaohongshuSkillMarkdown,
  getExternalCloudSkillSeed,
  REMOTION_CLOUD_SKILL_REQUIRED_PATHS,
  REMOTION_CLOUD_SKILL_SLUG,
  XIAOHONGSHU_CLOUD_SKILL_OPTIONAL_PATHS,
  XIAOHONGSHU_CLOUD_SKILL_REQUIREMENTS,
  XIAOHONGSHU_CLOUD_SKILL_REQUIRED_PATHS,
  XIAOHONGSHU_CLOUD_SKILL_SLUG,
} from '../src/external-cloud-skill-presets.ts';
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

function normalizePath(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field} is required`);
  }
  return resolve(normalized);
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function removeJunkFiles(root: string): Promise<void> {
  const entries = await readdir(root, {withFileTypes: true});
  for (const entry of entries) {
    const target = resolve(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__pycache__' || entry.name === '.pytest_cache') {
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

async function stageXiaohongshuSkill(sourceDir: string, stageDir: string): Promise<void> {
  for (const relativePath of XIAOHONGSHU_CLOUD_SKILL_REQUIRED_PATHS) {
    const sourcePath = resolve(sourceDir, relativePath);
    if (!(await pathExists(sourcePath))) {
      throw new Error(`missing required source path: ${relativePath}`);
    }
    await cp(sourcePath, resolve(stageDir, relativePath), {recursive: true, force: true});
  }

  for (const relativePath of XIAOHONGSHU_CLOUD_SKILL_OPTIONAL_PATHS) {
    const sourcePath = resolve(sourceDir, relativePath);
    if (await pathExists(sourcePath)) {
      await cp(sourcePath, resolve(stageDir, relativePath), {recursive: true, force: true});
    }
  }

  await removeJunkFiles(stageDir);
  await writeFile(resolve(stageDir, 'SKILL.md'), buildXiaohongshuSkillMarkdown(), 'utf8');
  if (!(await pathExists(resolve(stageDir, 'requirements.txt')))) {
    await writeFile(resolve(stageDir, 'requirements.txt'), XIAOHONGSHU_CLOUD_SKILL_REQUIREMENTS, 'utf8');
  }
}

async function stageRemotionSkill(sourceDir: string, stageDir: string): Promise<void> {
  for (const relativePath of REMOTION_CLOUD_SKILL_REQUIRED_PATHS) {
    const sourcePath = resolve(sourceDir, relativePath);
    if (!(await pathExists(sourcePath))) {
      throw new Error(`missing required source path: ${relativePath}`);
    }
    await cp(sourcePath, resolve(stageDir, relativePath), {recursive: true, force: true});
  }

  await removeJunkFiles(stageDir);
  await writeFile(resolve(stageDir, 'SKILL.md'), buildRemotionSkillMarkdown(), 'utf8');
}

async function stageFrontendSlidesSkill(sourceDir: string, stageDir: string): Promise<void> {
  for (const relativePath of FRONTEND_SLIDES_CLOUD_SKILL_REQUIRED_PATHS) {
    const sourcePath = resolve(sourceDir, relativePath);
    if (!(await pathExists(sourcePath))) {
      throw new Error(`missing required source path: ${relativePath}`);
    }
    await cp(sourcePath, resolve(stageDir, relativePath), {recursive: true, force: true});
  }
  await removeJunkFiles(stageDir);
}

async function stageSkillSource(slug: string, sourceDir: string, stageDir: string): Promise<void> {
  switch (slug) {
    case XIAOHONGSHU_CLOUD_SKILL_SLUG:
      await stageXiaohongshuSkill(sourceDir, stageDir);
      return;
    case REMOTION_CLOUD_SKILL_SLUG:
      await stageRemotionSkill(sourceDir, stageDir);
      return;
    case FRONTEND_SLIDES_CLOUD_SKILL_SLUG:
      await stageFrontendSlidesSkill(sourceDir, stageDir);
      return;
    default:
      throw new Error(`unsupported external cloud skill slug: ${slug}`);
  }
}

async function buildArchive(slug: string, stageDir: string, artifactDir: string): Promise<string> {
  const artifactPath = resolve(artifactDir, `${slug}.zip`);
  await mkdir(dirname(artifactPath), {recursive: true});
  await rm(artifactPath, {force: true});
  await execFileAsync('zip', ['-qr', artifactPath, '.'], {cwd: stageDir});
  return artifactPath;
}

async function main() {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const slug = (readArg('--slug') || '').trim().toLowerCase();
  const sourceDir = normalizePath(readArg('--source') || '', '--source');
  const artifactDir = normalizePath(readArg('--artifact-dir') || '.tmp/external-cloud-skills', '--artifact-dir');
  if (!slug) {
    throw new Error('--slug is required');
  }

  const preset = getExternalCloudSkillSeed(slug);
  if (!preset) {
    throw new Error(`unsupported external cloud skill slug: ${slug}`);
  }

  const tempRoot = await mkdtemp(resolve(tmpdir(), 'iclaw-external-cloud-skill-'));
  const stageDir = resolve(tempRoot, basename(slug));
  const store = new PgControlPlaneStore(config.databaseUrl);
  try {
    await mkdir(stageDir, {recursive: true});
    await stageSkillSource(slug, sourceDir, stageDir);
    const artifactPath = await buildArchive(slug, stageDir, artifactDir);
    const artifact = await readFile(artifactPath);
    const uploaded = await uploadPortalSkillArtifact({
      slug,
      artifact,
      filename: `${slug}.zip`,
      contentType: 'application/zip',
      objectKey: String((preset.metadata || {})[CLOUD_SKILL_ARTIFACT_OBJECT_KEY_FIELD] || '').trim() || undefined,
    });

    const existing = await store.getSkillCatalogEntry(slug);
    await store.upsertSkillCatalogEntry({
      slug,
      name: preset.name,
      description: preset.description,
      market: preset.market,
      category: preset.category,
      skill_type: preset.skillType,
      publisher: preset.publisher,
      distribution: preset.distribution,
      tags: [...preset.tags],
      version: preset.version,
      artifact_url: null,
      artifact_format: preset.artifactFormat,
      artifact_sha256: uploaded.contentSha256,
      artifact_source_path: null,
      origin_type: preset.originType,
      source_url: preset.sourceUrl || existing?.sourceUrl || null,
      metadata: {
        ...(existing?.metadata || {}),
        ...(preset.metadata || {}),
        [CLOUD_SKILL_ARTIFACT_OBJECT_KEY_FIELD]: uploaded.objectKey,
      },
      active: true,
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          slug,
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
