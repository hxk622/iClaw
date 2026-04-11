import {execFile} from 'node:child_process';
import {readdir, readFile, stat} from 'node:fs/promises';
import path, {basename, posix, resolve} from 'node:path';
import {promisify} from 'node:util';

import {PgControlPlaneStore} from '../src/pg-store.ts';
import {PgPortalStore} from '../src/portal-store.ts';

const execFileAsync = promisify(execFile);

type SkillDirRecord = {
  absolutePath: string;
  relativePath: string;
  skillMdPath: string;
};

function readArg(name: string): string | null {
  const index = process.argv.findIndex((item) => item === name);
  if (index === -1) {
    return null;
  }
  return process.argv[index + 1] || null;
}

function readArgs(name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name) {
      const value = process.argv[index + 1] || '';
      if (value.trim()) {
        values.push(value.trim());
      }
    }
  }
  return values;
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

function parseRepoIdentity(repoUrl: string): {owner: string; repo: string} {
  const parsed = new URL(repoUrl);
  if (parsed.hostname !== 'github.com') {
    throw new Error(`repo_url must use github.com: ${repoUrl}`);
  }
  const parts = parsed.pathname.split('/').filter(Boolean);
  if (parts.length < 2) {
    throw new Error(`repo_url must include owner and repo: ${repoUrl}`);
  }
  return {
    owner: parts[0],
    repo: parts[1].replace(/\.git$/i, ''),
  };
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function walkSkillDirs(root: string, repoRoot: string, acc: SkillDirRecord[]): Promise<void> {
  const entries = await readdir(root, {withFileTypes: true});
  if (entries.some((entry) => entry.isFile() && entry.name === 'SKILL.md')) {
    acc.push({
      absolutePath: root,
      relativePath: path.relative(repoRoot, root).split(path.sep).join('/'),
      skillMdPath: path.relative(repoRoot, resolve(root, 'SKILL.md')).split(path.sep).join('/'),
    });
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '__pycache__') {
      continue;
    }
    await walkSkillDirs(resolve(root, entry.name), repoRoot, acc);
  }
}

async function listSkillDirs(repoRoot: string, skillRoots: string[]): Promise<SkillDirRecord[]> {
  const roots = skillRoots.length > 0 ? skillRoots : ['skills'];
  const skills: SkillDirRecord[] = [];
  for (const relativeRoot of roots) {
    const absoluteRoot = resolve(repoRoot, relativeRoot);
    if (!(await pathExists(absoluteRoot))) {
      throw new Error(`skill root not found: ${relativeRoot}`);
    }
    await walkSkillDirs(absoluteRoot, repoRoot, skills);
  }
  return skills.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

async function resolveGitShortSha(repoRoot: string): Promise<string> {
  const {stdout} = await execFileAsync('git', ['-C', repoRoot, 'rev-parse', '--short', 'HEAD']);
  return stdout.trim();
}

async function main() {
  const databaseUrl = trimString(process.env.DATABASE_URL);
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const repoRoot = normalizePath(readArg('--repo-root'), '--repo-root');
  const repoUrl = trimString(readArg('--repo-url'));
  if (!repoUrl) {
    throw new Error('--repo-url is required');
  }
  const branch = trimString(readArg('--branch')) || 'main';
  const slugPrefix = normalizeSlug(trimString(readArg('--slug-prefix'))).replace(/\/+$/g, '');
  const platformBundle = hasFlag('--platform-bundle');
  const dryRun = hasFlag('--dry-run');
  const allowOverwrite = hasFlag('--allow-overwrite');
  const preferExistingOnSourceMismatch = hasFlag('--prefer-existing-on-source-mismatch');
  const platformPresetReason =
    trimString(readArg('--platform-preset-reason')) ||
    `平台预置 ${basename(repoRoot)}`;
  const skillRoots = readArgs('--skill-root');
  const repoIdentity = parseRepoIdentity(repoUrl);
  const gitShortSha = await resolveGitShortSha(repoRoot);
  const skillDirs = await listSkillDirs(repoRoot, skillRoots);
  if (skillDirs.length === 0) {
    throw new Error(`no SKILL.md directories found under ${repoRoot}`);
  }

  const cloudStore = new PgControlPlaneStore(databaseUrl);
  const portalStore = new PgPortalStore(databaseUrl);

  try {
    const summary: Array<Record<string, unknown>> = [];
    for (const skillDir of skillDirs) {
      const rawSkillMarkdown = await readFile(resolve(skillDir.absolutePath, 'SKILL.md'), 'utf8');
      const frontmatter = parseFrontmatter(rawSkillMarkdown);
      const rawSlug = normalizeSlug(trimString(frontmatter.slug) || basename(skillDir.absolutePath));
      if (!rawSlug) {
        throw new Error(`unable to resolve skill slug for ${skillDir.relativePath}`);
      }
      const slug = slugPrefix
        ? normalizeSlug(rawSlug.startsWith(`${slugPrefix}-`) ? rawSlug : `${slugPrefix}-${rawSlug}`)
        : rawSlug;
      const name = trimString(frontmatter.name) || basename(skillDir.absolutePath);
      const description = trimString(frontmatter.description);
      if (!description) {
        throw new Error(`description is required for ${skillDir.relativePath}`);
      }
      const tags = asStringArray(frontmatter.tags);
      const version = trimString(frontmatter.version) || `0.0.0+git.${gitShortSha}`;
      const publisher = trimString(frontmatter.publisher) || `GitHub · ${repoIdentity.owner}`;
      const market = trimString(frontmatter.market) || inferMarket({name, description, tags});
      const category = trimString(frontmatter.category) || inferCategory({name, description, tags});
      const skillType = trimString(frontmatter.skill_type) || inferSkillType({name, description, tags});
      const sourceUrl = `https://github.com/${repoIdentity.owner}/${repoIdentity.repo}/tree/${branch}/${skillDir.relativePath}`;
      const existing = await cloudStore.getSkillCatalogEntry(slug);
      const sourceMismatch =
        existing &&
        trimString(existing.sourceUrl) &&
        trimString(existing.sourceUrl) !== sourceUrl;

      if (sourceMismatch && !allowOverwrite && !preferExistingOnSourceMismatch) {
        throw new Error(
          `refusing to overwrite existing slug ${slug}: ${existing.sourceUrl} -> ${sourceUrl}. Re-run with --allow-overwrite if this is intentional.`,
        );
      }

      const payload = {
        slug,
        name,
        description,
        market,
        category,
        skill_type: skillType,
        publisher,
        distribution: 'cloud' as const,
        tags,
        version,
        artifact_url: null,
        artifact_format: 'tar.gz' as const,
        artifact_sha256: null,
        artifact_source_path: null,
        origin_type: 'github_repo',
        source_url: sourceUrl,
        metadata: {
          ...(existing?.metadata || {}),
          execution_surface: 'desktop-local',
          source_label: 'GitHub',
          source_repo: `${repoIdentity.owner}/${repoIdentity.repo}`,
          source_kind: 'github_repo',
          github: {
            owner: repoIdentity.owner,
            repo: repoIdentity.repo,
            branch,
            skill_path: skillDir.relativePath,
            skill_md_path: skillDir.skillMdPath,
            archive_url: `https://codeload.github.com/${repoIdentity.owner}/${repoIdentity.repo}/tar.gz/refs/heads/${branch}`,
            repo_url: `https://github.com/${repoIdentity.owner}/${repoIdentity.repo}`,
            tree_sha: gitShortSha,
            frontmatter,
          },
        },
        active: true,
      };

      const reusingExisting = Boolean(sourceMismatch && !allowOverwrite && preferExistingOnSourceMismatch);

      if (!dryRun) {
        if (!reusingExisting) {
          await cloudStore.upsertSkillCatalogEntry(payload);
        }
        if (platformBundle) {
          await portalStore.upsertSkill({
            slug,
            active: true,
            metadata: {
              platformPresetReason,
              sourceCatalog: 'github_repo',
              sourceType: 'manual_import_repo',
              sourceRepo: `${repoIdentity.owner}/${repoIdentity.repo}`,
              sourceSkillPath: skillDir.relativePath,
            },
          });
        }
      }

      summary.push({
        slug,
        name: reusingExisting ? existing?.name || name : name,
        version: reusingExisting ? existing?.version || version : version,
        sourceUrl: reusingExisting ? existing?.sourceUrl || sourceUrl : sourceUrl,
        bundledToPlatform: platformBundle,
        reusedExistingCatalogEntry: reusingExisting,
      });
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun,
          repoRoot,
          repoUrl,
          branch,
          skillCount: summary.length,
          items: summary,
        },
        null,
        2,
      ),
    );
  } finally {
    await cloudStore.close();
    await portalStore.close();
  }
}

await main();
