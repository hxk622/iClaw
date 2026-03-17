import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {Pool} from 'pg';

import {config} from '../src/config.ts';

type SkillDistribution = 'bundled' | 'cloud';

type ClawHubListSkillItem = {
  slug: string;
  displayName: string;
  summary?: string | null;
  tags?: Record<string, string> | null;
  stats?: {
    downloads?: number;
    installsAllTime?: number;
    installsCurrent?: number;
    stars?: number;
    versions?: number;
    comments?: number;
  } | null;
  createdAt?: number;
  updatedAt?: number;
  latestVersion?: {
    version: string;
    createdAt?: number;
    changelog?: string;
    license?: string | null;
  } | null;
  metadata?: {
    os?: string[] | null;
    systems?: string[] | null;
  } | null;
};

type ClawHubListResponse = {
  items: ClawHubListSkillItem[];
  nextCursor?: string | null;
};

type ClawHubSkillDetailResponse = {
  skill: {
    slug: string;
    displayName: string;
    summary?: string | null;
    tags?: Record<string, string> | null;
    stats?: ClawHubListSkillItem['stats'];
    createdAt?: number;
    updatedAt?: number;
  } | null;
  latestVersion: {
    version: string;
    createdAt?: number;
    changelog?: string;
    license?: string | null;
  } | null;
  owner: {
    handle?: string | null;
    displayName?: string | null;
    userId?: string | null;
    image?: string | null;
  } | null;
  moderation?: {
    isSuspicious?: boolean;
    isMalwareBlocked?: boolean;
    verdict?: string | null;
    reasonCodes?: string[] | null;
    summary?: string | null;
    engineVersion?: string | null;
    updatedAt?: number | null;
  } | null;
  metadata?: {
    os?: string[] | null;
    systems?: string[] | null;
  } | null;
};

type BundledSkillDescriptor = {
  slug: string;
  name: string;
  normalizedName: string;
};

type CatalogUpsertRecord = {
  slug: string;
  name: string;
  description: string;
  visibility: 'showcase' | 'internal';
  market: string | null;
  category: string | null;
  skillType: string | null;
  publisher: string;
  distribution: SkillDistribution;
  tags: string[];
  artifactFormat: 'zip';
  artifactUrl: string;
  artifactSha256: string | null;
  artifactSourcePath: string | null;
  version: string;
  publishedAt: string;
};

type SyncDecision =
  | {kind: 'skip'; slug: string; reason: string}
  | {kind: 'upsert'; record: CatalogUpsertRecord; reason: string};

const CLAWHUB_API_BASE = 'https://wry-manatee-359.convex.site/api/v1';
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const skillsRoot = path.resolve(repoRoot, 'skills');
const BLOCKED_CLOUD_SKILL_SLUGS = new Set(['github', 'gog', 'ontology', 'skill-vetter', 'summarize']);

function parseArgs() {
  const args = process.argv.slice(2);
  let limit = 5;
  let dryRun = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--') {
      continue;
    }
    if (arg === '--limit') {
      limit = Number.parseInt(args[index + 1] ?? '5', 10);
      index += 1;
      continue;
    }
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    throw new Error(`unknown arg: ${arg}`);
  }
  if (!Number.isFinite(limit) || limit <= 0) {
    throw new Error('limit must be a positive integer');
  }
  return {limit, dryRun};
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseFrontmatter(raw: string): Record<string, string> {
  if (!raw.startsWith('---\n')) {
    return {};
  }
  const closingIndex = raw.indexOf('\n---', 4);
  if (closingIndex === -1) {
    return {};
  }
  const frontmatter = raw.slice(4, closingIndex).split('\n');
  const values: Record<string, string> = {};
  let blockKey: string | null = null;
  let blockLines: string[] = [];

  for (const line of frontmatter) {
    if (blockKey) {
      if (/^\s/.test(line) || !line.trim()) {
        blockLines.push(line.replace(/^\s+/, ''));
        continue;
      }
      values[blockKey] = blockLines.join('\n').trim();
      blockKey = null;
      blockLines = [];
    }

    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separatorIndex = trimmed.indexOf(':');
    if (separatorIndex === -1) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!key) continue;
    if (value === '|' || value === '>') {
      blockKey = key;
      blockLines = [];
      continue;
    }
    values[key] = value.replace(/^['"]|['"]$/g, '');
  }

  if (blockKey) {
    values[blockKey] = blockLines.join('\n').trim();
  }
  return values;
}

async function loadBundledSkills(): Promise<BundledSkillDescriptor[]> {
  const entries = await fs.readdir(skillsRoot, {withFileTypes: true});
  const bundled: BundledSkillDescriptor[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillMdPath = path.join(skillsRoot, entry.name, 'SKILL.md');
    try {
      const raw = await fs.readFile(skillMdPath, 'utf8');
      const frontmatter = parseFrontmatter(raw);
      const slug = (frontmatter.slug || entry.name).trim();
      const name = (frontmatter.name || entry.name).trim();
      if (!slug || !name) continue;
      bundled.push({
        slug,
        name,
        normalizedName: normalizeName(name),
      });
    } catch {
      continue;
    }
  }
  return bundled;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'iClaw-control-plane-skill-sync/0.1',
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`request failed ${response.status} for ${url}: ${text}`);
  }
  return (await response.json()) as T;
}

function inferMarket(item: {
  name: string;
  description: string;
  tags: string[];
}): string {
  const text = [item.name, item.description, item.tags.join(' ')].join(' ');
  if (text.includes('A股')) return 'A股';
  if (text.includes('美股')) return '美股';
  if (text.includes('全球')) return '全球';
  if (/crypto|defi|blockchain|on-chain|web3|币/i.test(text)) return '全球';
  return '通用';
}

function inferSkillType(item: {
  name: string;
  description: string;
  tags: string[];
}): string {
  const text = [item.name, item.description, item.tags.join(' ')].join(' ');
  if (/(生成器|generator|writer|builder|memo)/i.test(text)) return '生成器';
  if (/(筛选|扫描|scan|finder|search|discover|detect)/i.test(text)) return '扫描器';
  if (/(tool|tools|toolkit|cli|search|api|workflow|memory|integration)/i.test(text)) return '工具包';
  return '分析师';
}

function inferCategory(item: {
  name: string;
  description: string;
  tags: string[];
}): string {
  const text = [item.name, item.description, item.tags.join(' ')].join(' ');
  if (/(数据|search|api|scrape|crawl|tool|tools|cli|fetch)/i.test(text)) return 'data';
  if (/(report|memo|document|write|writer|documentation|doc)/i.test(text)) return 'report';
  if (/(portfolio|risk|allocation|var|cvar|drawdown)/i.test(text)) return 'portfolio';
  if (/(research|analysis|analyze|agent|memory|workflow|proactive|improving)/i.test(text)) return 'research';
  return 'general';
}

function inferTags(item: {
  slug: string;
  name: string;
  description: string;
  tagMap?: Record<string, string> | null;
}): string[] {
  const explicit = Object.keys(item.tagMap || {}).map((tag) => tag.trim()).filter(Boolean);
  const inferred = new Set<string>(explicit);

  const text = `${item.slug} ${item.name} ${item.description}`;
  if (/(search|搜索)/i.test(text)) inferred.add('搜索');
  if (/(skill|skills|技能)/i.test(text)) inferred.add('技能');
  if (/(agent|代理)/i.test(text)) inferred.add('Agent');
  if (/(document|docs|文档)/i.test(text)) inferred.add('文档');
  if (/(memory|记忆|learning|improving)/i.test(text)) inferred.add('记忆');
  if (/(workflow|自动化|proactive)/i.test(text)) inferred.add('工作流');

  return Array.from(inferred).slice(0, 8);
}

function publisherLabel(detail: ClawHubSkillDetailResponse): string {
  const handle = detail.owner?.handle?.trim();
  const displayName = detail.owner?.displayName?.trim();
  if (handle) return `ClawHub · ${handle}`;
  if (displayName) return `ClawHub · ${displayName}`;
  return 'ClawHub';
}

function buildArtifactUrl(slug: string, version: string): string {
  const query = new URLSearchParams({slug, version});
  return `${CLAWHUB_API_BASE}/download?${query.toString()}`;
}

function isoFromTimestamp(value: number | undefined, fallback: string): string {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return new Date(value).toISOString();
  }
  return fallback;
}

async function loadExistingCloudSlugs(pool: Pool): Promise<Set<string>> {
  const result = await pool.query<{slug: string}>(
    `
      select slug
      from skill_catalog_entries
      where distribution = 'cloud'
    `,
  );
  return new Set(result.rows.map((row) => row.slug));
}

function classifySkill(
  detail: ClawHubSkillDetailResponse,
  bundledBySlug: Set<string>,
  bundledByName: Set<string>,
): SyncDecision {
  const skill = detail.skill;
  const latestVersion = detail.latestVersion;
  if (!skill) {
    return {kind: 'skip', slug: 'unknown', reason: 'missing skill detail'};
  }
  const slug = skill.slug.trim();
  const name = (skill.displayName || slug).trim();
  const description = (skill.summary || '').trim();

  if (!slug || !name || !description || !latestVersion?.version) {
    return {kind: 'skip', slug: slug || 'unknown', reason: 'missing required fields'};
  }

  if (BLOCKED_CLOUD_SKILL_SLUGS.has(slug)) {
    return {kind: 'skip', slug, reason: 'blocked by curated catalog policy'};
  }

  if (bundledBySlug.has(slug) || bundledByName.has(normalizeName(name))) {
    return {kind: 'skip', slug, reason: 'duplicate of bundled skill'};
  }

  if (detail.moderation?.isMalwareBlocked || detail.moderation?.isSuspicious) {
    return {kind: 'skip', slug, reason: 'blocked by moderation'};
  }

  const tags = inferTags({
    slug,
    name,
    description,
    tagMap: skill.tags,
  });
  const market = inferMarket({name, description, tags});
  const category = inferCategory({name, description, tags});
  const skillType = inferSkillType({name, description, tags});
  const now = new Date().toISOString();

  return {
    kind: 'upsert',
    reason: 'eligible cloud skill',
    record: {
      slug,
      name,
      description,
      visibility: 'showcase',
      market,
      category,
      skillType,
      publisher: publisherLabel(detail),
      distribution: 'cloud',
      tags,
      artifactFormat: 'zip',
      artifactUrl: buildArtifactUrl(slug, latestVersion.version),
      artifactSha256: null,
      artifactSourcePath: null,
      version: latestVersion.version,
      publishedAt: isoFromTimestamp(latestVersion.createdAt, now),
    },
  };
}

async function upsertCatalogRecord(pool: Pool, record: CatalogUpsertRecord): Promise<'inserted' | 'updated'> {
  const existing = await pool.query<{slug: string}>(
    `
      select slug
      from skill_catalog_entries
      where slug = $1
      limit 1
    `,
    [record.slug],
  );

  await pool.query(
    `
      insert into skill_catalog_entries (
        slug,
        name,
        description,
        visibility,
        market,
        category,
        skill_type,
        publisher,
        distribution,
        tags,
        active,
        created_at,
        updated_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, true, now(), now())
      on conflict (slug)
      do update set
        name = excluded.name,
        description = excluded.description,
        visibility = excluded.visibility,
        market = excluded.market,
        category = excluded.category,
        skill_type = excluded.skill_type,
        publisher = excluded.publisher,
        distribution = excluded.distribution,
        tags = excluded.tags,
        active = true,
        updated_at = now()
    `,
    [
      record.slug,
      record.name,
      record.description,
      record.visibility,
      record.market,
      record.category,
      record.skillType,
      record.publisher,
      record.distribution,
      JSON.stringify(record.tags),
    ],
  );

  await pool.query(
    `
      insert into skill_releases (
        skill_slug,
        version,
        artifact_format,
        artifact_url,
        artifact_sha256,
        artifact_source_path,
        status,
        published_at,
        created_at
      )
      values ($1, $2, $3, $4, $5, $6, 'published', $7::timestamptz, now())
      on conflict (skill_slug, version)
      do update set
        artifact_format = excluded.artifact_format,
        artifact_url = excluded.artifact_url,
        artifact_sha256 = excluded.artifact_sha256,
        artifact_source_path = excluded.artifact_source_path,
        status = 'published',
        published_at = excluded.published_at
    `,
    [
      record.slug,
      record.version,
      record.artifactFormat,
      record.artifactUrl,
      record.artifactSha256,
      record.artifactSourcePath,
      record.publishedAt,
    ],
  );

  return existing.rowCount > 0 ? 'updated' : 'inserted';
}

async function main() {
  const {limit, dryRun} = parseArgs();
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const bundledSkills = await loadBundledSkills();
  const bundledBySlug = new Set(bundledSkills.map((item) => item.slug));
  const bundledByName = new Set(bundledSkills.map((item) => item.normalizedName));
  const pool = new Pool({connectionString: config.databaseUrl});

  try {
    const existingCloudSlugs = await loadExistingCloudSlugs(pool);
    const decisions: Array<SyncDecision & {status?: 'inserted' | 'updated'}> = [];
    let cursor: string | null = null;

    while (decisions.filter((item) => item.kind === 'upsert').length < limit) {
      const query = new URLSearchParams({
        sort: 'downloads',
        nonSuspicious: 'true',
        limit: '25',
      });
      if (cursor) {
        query.set('cursor', cursor);
      }
      const list = await fetchJson<ClawHubListResponse>(`${CLAWHUB_API_BASE}/skills?${query.toString()}`);
      if (!list.items.length) {
        break;
      }

      for (const item of list.items) {
        if (decisions.filter((entry) => entry.kind === 'upsert').length >= limit) {
          break;
        }
        const detail = await fetchJson<ClawHubSkillDetailResponse>(`${CLAWHUB_API_BASE}/skills/${encodeURIComponent(item.slug)}`);
        const decision = classifySkill(detail, bundledBySlug, bundledByName);
        if (decision.kind === 'skip') {
          decisions.push(decision);
          continue;
        }

        const status = dryRun ? (existingCloudSlugs.has(decision.record.slug) ? 'updated' : 'inserted') : await upsertCatalogRecord(pool, decision.record);
        decisions.push({...decision, status});
        existingCloudSlugs.add(decision.record.slug);
      }

      cursor = list.nextCursor || null;
      if (!cursor) {
        break;
      }
    }

    const inserted = decisions.filter((item) => item.kind === 'upsert' && item.status === 'inserted');
    const updated = decisions.filter((item) => item.kind === 'upsert' && item.status === 'updated');
    const skipped = decisions.filter((item) => item.kind === 'skip');

    console.log(
      JSON.stringify(
        {
          dryRun,
          requested: limit,
          imported: inserted.length + updated.length,
          inserted: inserted.map((item) => item.record.slug),
          updated: updated.map((item) => item.record.slug),
          skipped: skipped.map((item) => ({slug: item.slug, reason: item.reason})),
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('[sync-clawhub-top-skills] failed');
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
