import {execFile} from 'node:child_process';
import {cp, mkdir, mkdtemp, readFile, readdir, rm, stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename, dirname, resolve} from 'node:path';
import {promisify} from 'node:util';

import {config} from '../src/config.ts';
import {buildCloudSkillArtifactObjectKey, CLOUD_SKILL_ARTIFACT_OBJECT_KEY_FIELD} from '../src/cloud-skill-artifacts.ts';
import {PgControlPlaneStore} from '../src/pg-store.ts';
import {PgPortalStore} from '../src/portal-store.ts';
import {uploadPortalSkillArtifact} from '../src/portal-skill-storage.ts';

const execFileAsync = promisify(execFile);

function readArg(name: string): string | null {
  const index = process.argv.findIndex((item) => item === name);
  if (index === -1) {
    return null;
  }
  return process.argv[index + 1] || null;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
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

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_/]+/g, '-')
    .replace(/\/+/g, '/')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseFrontmatter(raw: string): Record<string, unknown> {
  if (!raw.startsWith('---\n')) {
    return {};
  }
  const closingIndex = raw.indexOf('\n---', 4);
  if (closingIndex === -1) {
    return {};
  }

  const frontmatter = raw.slice(4, closingIndex).split('\n');
  const values: Record<string, unknown> = {};
  let currentArrayKey: string | null = null;
  let currentBlockKey: string | null = null;
  let currentBlockMode: '|' | '>' | null = null;
  const currentBlockLines: string[] = [];

  const flushBlock = () => {
    if (!currentBlockKey) {
      return;
    }
    const normalized =
      currentBlockMode === '>'
        ? currentBlockLines.map((line) => line.trim()).filter(Boolean).join(' ')
        : currentBlockLines.join('\n').trim();
    values[currentBlockKey] = normalized;
    currentBlockKey = null;
    currentBlockMode = null;
    currentBlockLines.length = 0;
  };

  for (const line of frontmatter) {
    if (currentBlockKey) {
      if (line.startsWith(' ') || line.startsWith('\t') || !line.trim()) {
        currentBlockLines.push(line.replace(/^[ \t]+/, ''));
        continue;
      }
      flushBlock();
    }
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    if (currentArrayKey && trimmed.startsWith('- ')) {
      const list = Array.isArray(values[currentArrayKey]) ? (values[currentArrayKey] as unknown[]) : [];
      list.push(trimmed.slice(2).trim().replace(/^['"]|['"]$/g, ''));
      values[currentArrayKey] = list;
      continue;
    }
    currentArrayKey = null;
    const separatorIndex = trimmed.indexOf(':');
    if (separatorIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!key) {
      continue;
    }
    if (!value) {
      currentArrayKey = key;
      values[key] = [];
      continue;
    }
    if (value === '|' || value === '>') {
      currentBlockKey = key;
      currentBlockMode = value;
      continue;
    }
    if (value.startsWith('[') && value.endsWith(']')) {
      values[key] = value
        .slice(1, -1)
        .split(',')
        .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
      continue;
    }
    values[key] = value.replace(/^['"]|['"]$/g, '');
  }

  flushBlock();

  return values;
}

function splitCsv(value: string | null): string[] {
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

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => trimString(item))
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return splitCsv(value);
  }
  return [];
}

function inferMarket(item: {name: string; description: string; tags: string[]}): string {
  const text = [item.name, item.description, item.tags.join(' ')].join(' ');
  if (text.includes('A股')) return 'A股';
  if (text.includes('美股')) return '美股';
  if (text.includes('全球')) return '全球';
  if (/crypto|defi|blockchain|on-chain|web3|币/i.test(text)) return '全球';
  return '通用';
}

function inferSkillType(item: {name: string; description: string; tags: string[]}): string {
  const text = [item.name, item.description, item.tags.join(' ')].join(' ');
  if (/(生成器|generator|writer|builder|memo|创作|生成)/i.test(text)) return '生成器';
  if (/(筛选|扫描|scan|finder|search|discover|detect)/i.test(text)) return '扫描器';
  if (/(tool|tools|toolkit|cli|api|workflow|integration|automation|自动化)/i.test(text)) return '工具包';
  return '分析师';
}

function inferCategory(item: {name: string; description: string; tags: string[]}): string {
  const text = [item.name, item.description, item.tags.join(' ')].join(' ');
  if (/(数据|search|api|scrape|crawl|tool|tools|cli|fetch|automation|自动化)/i.test(text)) return 'data';
  if (/(report|memo|document|write|writer|documentation|doc|content|内容)/i.test(text)) return 'content';
  if (/(portfolio|risk|allocation|var|cvar|drawdown)/i.test(text)) return 'portfolio';
  if (/(research|analysis|analyze|agent|memory|workflow|proactive|improving|strategy|策略)/i.test(text))
    return 'research';
  return 'general';
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
  const entries = await readdir(sourceDir, {withFileTypes: true});
  for (const entry of entries) {
    if (entry.name === '.git') {
      continue;
    }
    await cp(resolve(sourceDir, entry.name), resolve(stageDir, entry.name), {recursive: true, force: true});
  }
}

async function removeJunkFiles(root: string): Promise<void> {
  const entries = await readdir(root, {withFileTypes: true});
  for (const entry of entries) {
    const target = resolve(root, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === '.github' ||
        entry.name === '__pycache__' ||
        entry.name === '.pytest_cache' ||
        entry.name === '.mypy_cache'
      ) {
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

async function buildArchive(slug: string, stageDir: string, artifactDir: string): Promise<string> {
  const artifactPath = resolve(artifactDir, `${slug}.zip`);
  await mkdir(dirname(artifactPath), {recursive: true});
  await rm(artifactPath, {force: true});
  await execFileAsync('zip', ['-qr', artifactPath, '.'], {cwd: stageDir});
  return artifactPath;
}

function detectArtifactFormat(filePath: string): 'zip' | 'tar.gz' {
  if (filePath.endsWith('.zip')) {
    return 'zip';
  }
  if (filePath.endsWith('.tar.gz') || filePath.endsWith('.tgz')) {
    return 'tar.gz';
  }
  throw new Error(`unsupported artifact format: ${filePath}`);
}

async function main() {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const sourceArg = readArg('--source');
  const artifactPathArg = readArg('--artifact-path');
  if (!trimString(sourceArg) && !trimString(artifactPathArg)) {
    throw new Error('either --source or --artifact-path is required');
  }
  const sourceDir = trimString(sourceArg) ? normalizePath(sourceArg, '--source') : null;
  const artifactPathInput = trimString(artifactPathArg) ? resolve(trimString(artifactPathArg)) : null;
  const artifactDir = resolve(readArg('--artifact-dir') || '.tmp/github-cloud-skills');
  const sourceUrl = trimString(readArg('--source-url'));
  const sourceRepo = trimString(readArg('--source-repo'));
  const version = trimString(readArg('--version')) || '1.0.0';
  let frontmatter: Record<string, unknown> = {};
  if (sourceDir) {
    const skillMarkdownPath = resolve(sourceDir, 'SKILL.md');
    if (!(await pathExists(skillMarkdownPath))) {
      throw new Error(`SKILL.md not found in ${sourceDir}`);
    }
    const rawSkillMarkdown = await readFile(skillMarkdownPath, 'utf8');
    frontmatter = parseFrontmatter(rawSkillMarkdown);
  }
  const frontmatterName = trimString(frontmatter.name);
  const frontmatterDescription = trimString(frontmatter.description);
  const frontmatterPublisher = trimString(frontmatter.publisher);
  const frontmatterMarket = trimString(frontmatter.market);
  const frontmatterCategory = trimString(frontmatter.category);
  const frontmatterSkillType = trimString(frontmatter.skill_type);
  const tags = Array.from(new Set([...asStringArray(frontmatter.tags), ...splitCsv(readArg('--tags'))]));

  const slug = normalizeSlug(trimString(readArg('--slug')) || trimString(frontmatter.slug) || (sourceDir ? basename(sourceDir) : ''));
  if (!slug) {
    throw new Error('unable to resolve skill slug');
  }

  const name = trimString(readArg('--name')) || frontmatterName || slug;
  const description = trimString(readArg('--description')) || frontmatterDescription;
  if (!description) {
    throw new Error('--description is required when SKILL.md frontmatter has no description');
  }
  const publisher = trimString(readArg('--publisher')) || frontmatterPublisher || 'GitHub';
  const market = trimString(readArg('--market')) || frontmatterMarket || inferMarket({name, description, tags});
  const category = trimString(readArg('--category')) || frontmatterCategory || inferCategory({name, description, tags});
  const skillType =
    trimString(readArg('--skill-type')) || frontmatterSkillType || inferSkillType({name, description, tags});
  const platformPresetReason =
    trimString(readArg('--platform-preset-reason')) || `平台预置 ${name}`;
  const bundleToPlatform = hasFlag('--platform-bundle');

  const tempRoot = artifactPathInput ? null : await mkdtemp(resolve(tmpdir(), 'iclaw-github-cloud-skill-'));
  const stageDir = tempRoot ? resolve(tempRoot, slug) : null;
  const cloudStore = new PgControlPlaneStore(config.databaseUrl);
  const portalStore = new PgPortalStore(config.databaseUrl);

  try {
    let artifactPath = artifactPathInput;
    if (!artifactPath) {
      if (!sourceDir || !stageDir) {
        throw new Error('--source is required when --artifact-path is not provided');
      }
      await mkdir(stageDir, {recursive: true});
      await copySkillSource(sourceDir, stageDir);
      await removeJunkFiles(stageDir);
      artifactPath = await buildArchive(slug, stageDir, artifactDir);
    }
    const artifactFormat = detectArtifactFormat(artifactPath);
    const artifact = await readFile(artifactPath);
    const objectKey = buildCloudSkillArtifactObjectKey({
      slug,
      version,
      artifactFormat,
    });
    const uploaded = await uploadPortalSkillArtifact({
      slug,
      artifact,
      filename: `${slug}.${artifactFormat === 'zip' ? 'zip' : 'tar.gz'}`,
      contentType: artifactFormat === 'zip' ? 'application/zip' : 'application/gzip',
      objectKey,
    });

    const existing = await cloudStore.getSkillCatalogEntry(slug);
    const nextMetadata: Record<string, unknown> = {
      ...(existing?.metadata || {}),
      execution_surface: 'desktop-local',
      source_label: sourceUrl ? 'GitHub' : existing?.metadata?.source_label,
      source_repo: sourceRepo || existing?.metadata?.source_repo,
      source_kind: 'github_repo',
      [CLOUD_SKILL_ARTIFACT_OBJECT_KEY_FIELD]: uploaded.objectKey,
    };

    if (!nextMetadata.source_label) {
      delete nextMetadata.source_label;
    }
    if (!nextMetadata.source_repo) {
      delete nextMetadata.source_repo;
    }

    await cloudStore.upsertSkillCatalogEntry({
      slug,
      name,
      description,
      market,
      category,
      skill_type: skillType,
      publisher,
      distribution: 'cloud',
      tags,
      version,
      artifact_url: null,
      artifact_format: uploaded.artifactFormat,
      artifact_sha256: uploaded.contentSha256,
      artifact_source_path: null,
      origin_type: 'github_repo',
      source_url: sourceUrl || existing?.sourceUrl,
      metadata: nextMetadata,
      active: true,
    });

    if (bundleToPlatform) {
      await portalStore.upsertSkill({
        slug,
        active: true,
        metadata: {
          platformPresetReason,
          sourceCatalog: 'github_repo',
          sourceType: 'manual_publish',
        },
      });
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          slug,
          name,
          version,
          bundledToPlatform: bundleToPlatform,
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
    await cloudStore.close();
    await portalStore.close();
    if (tempRoot) {
      await rm(tempRoot, {recursive: true, force: true});
    }
  }
}

await main();
