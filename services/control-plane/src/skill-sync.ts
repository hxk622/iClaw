import path from 'node:path';

import type {
  SkillCatalogEntryRecord,
  SkillOriginType,
  SkillSyncRunRecord,
  SkillSyncSourceRecord,
  UpsertSkillCatalogEntryInput,
} from './domain.ts';
import {
  DEFAULT_CLAWHUB_CLIENT_VERSION,
  DEFAULT_CLAWHUB_CONVEX_URL,
  DEFAULT_CLAWHUB_DETAIL_API_BASE,
  DEFAULT_CLAWHUB_PUBLIC_BASE_URL,
} from './skill-sync-defaults.ts';

type ClawHubPublicSkill = {
  _id?: string;
  slug: string;
  displayName: string;
  summary?: string | null;
  stats?: Record<string, unknown> | null;
  tags?: Record<string, string> | null;
  createdAt?: number;
  updatedAt?: number;
};

type ClawHubListSkillItem = {
  skill: ClawHubPublicSkill;
  latestVersion: {
    version: string;
    createdAt?: number;
    changelog?: string;
    parsed?: Record<string, unknown> | null;
  } | null;
  ownerHandle?: string | null;
  owner?: {
    _id?: string;
    handle?: string | null;
    displayName?: string | null;
    image?: string | null;
  } | null;
};

type ClawHubListResponse = {
  page: ClawHubListSkillItem[];
  hasMore: boolean;
  nextCursor?: string | null;
};

type ClawHubSkillDetailResponse = {
  skill: {
    _id?: string;
    slug: string;
    displayName: string;
    summary?: string | null;
    tags?: Record<string, string> | null;
    stats?: Record<string, unknown> | null;
    badges?: Record<string, unknown> | null;
    ownerUserId?: string;
    createdAt?: number;
    updatedAt?: number;
  } | null;
  latestVersion: {
    _id?: string;
    version: string;
    createdAt?: number;
    changelog?: string;
    changelogSource?: string;
    parsed?: Record<string, unknown> | null;
    fingerprint?: string | null;
    files?: Array<Record<string, unknown>>;
    sha256hash?: string | null;
    llmAnalysis?: Record<string, unknown> | null;
    staticScan?: Record<string, unknown> | null;
    vtAnalysis?: Record<string, unknown> | null;
  } | null;
  owner: {
    _id?: string;
    handle?: string | null;
    displayName?: string | null;
    name?: string | null;
    image?: string | null;
  } | null;
  moderationInfo?: {
    isSuspicious?: boolean;
    isMalwareBlocked?: boolean;
    verdict?: string | null;
    reasonCodes?: string[] | null;
    summary?: string | null;
    engineVersion?: string | null;
    updatedAt?: number | null;
  } | null;
  requestedSlug?: string | null;
  resolvedSlug?: string | null;
  pendingReview?: boolean;
  canonical?: Record<string, unknown> | null;
  forkOf?: Record<string, unknown> | null;
};

type ConvexQuerySuccess<T> = {
  status: 'success';
  value: T;
  logLines?: unknown[];
};

type ConvexQueryFailure = {
  status: 'error';
  errorMessage: string;
  errorData?: unknown;
  logLines?: unknown[];
};

type GitHubTreeEntry = {
  path: string;
  type: 'blob' | 'tree';
};

type GitHubTreeResponse = {
  sha?: string;
  tree?: GitHubTreeEntry[];
};

type NormalizedSkillCandidate = {
  slug: string;
  name: string;
  description: string;
  visibility: 'showcase' | 'internal';
  market: string | null;
  category: string | null;
  skill_type: string | null;
  publisher: string;
  distribution: 'cloud';
  tags: string[];
  version: string;
  artifact_url: string | null;
  artifact_format: 'tar.gz' | 'zip';
  artifact_sha256: string | null;
  artifact_source_path: string | null;
  origin_type: SkillOriginType;
  source_url: string | null;
  metadata: Record<string, unknown>;
  active: boolean;
};

type SyncExecution = {
  status: SkillSyncRunRecord['status'];
  summary: Record<string, unknown>;
  items: SkillSyncRunRecord['items'];
  upserts: Array<Required<UpsertSkillCatalogEntryInput>>;
};

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
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

  for (const line of frontmatter) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (currentArrayKey && trimmed.startsWith('- ')) {
      const list = Array.isArray(values[currentArrayKey]) ? (values[currentArrayKey] as unknown[]) : [];
      list.push(trimmed.slice(2).trim().replace(/^['"]|['"]$/g, ''));
      values[currentArrayKey] = list;
      continue;
    }
    currentArrayKey = null;
    const separatorIndex = trimmed.indexOf(':');
    if (separatorIndex === -1) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!key) continue;
    if (!value) {
      currentArrayKey = key;
      values[key] = [];
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

  return values;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
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
  if (/(生成器|generator|writer|builder|memo)/i.test(text)) return '生成器';
  if (/(筛选|扫描|scan|finder|search|discover|detect)/i.test(text)) return '扫描器';
  if (/(tool|tools|toolkit|cli|api|workflow|integration)/i.test(text)) return '工具包';
  return '分析师';
}

function inferCategory(item: {name: string; description: string; tags: string[]}): string {
  const text = [item.name, item.description, item.tags.join(' ')].join(' ');
  if (/(数据|search|api|scrape|crawl|tool|tools|cli|fetch)/i.test(text)) return 'data';
  if (/(report|memo|document|write|writer|documentation|doc)/i.test(text)) return 'report';
  if (/(portfolio|risk|allocation|var|cvar|drawdown)/i.test(text)) return 'portfolio';
  if (/(research|analysis|analyze|agent|memory|workflow|proactive|improving)/i.test(text)) return 'research';
  return 'general';
}

function readPositiveIntegerConfig(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : fallback;
}

function readNonNegativeIntegerConfig(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  const normalized = Math.floor(value);
  return normalized >= 0 ? normalized : null;
}

async function mapWithConcurrency<TInput, TOutput>(
  items: TInput[],
  concurrency: number,
  worker: (item: TInput, index: number) => Promise<TOutput>,
): Promise<TOutput[]> {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<TOutput>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);

  await Promise.all(
    Array.from({length: workerCount}, async () => {
      while (true) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        if (currentIndex >= items.length) {
          break;
        }
        results[currentIndex] = await worker(items[currentIndex], currentIndex);
      }
    }),
  );

  return results;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeRetryDelay(response: Response | null, attempt: number): number {
  const retryAfter = response?.headers.get('retry-after');
  if (retryAfter) {
    const asSeconds = Number.parseFloat(retryAfter);
    if (Number.isFinite(asSeconds) && asSeconds >= 0) {
      return Math.max(500, Math.ceil(asSeconds * 1000));
    }
    const asDate = Date.parse(retryAfter);
    if (Number.isFinite(asDate)) {
      return Math.max(500, asDate - Date.now());
    }
  }

  const resetAt = response?.headers.get('x-ratelimit-reset');
  if (resetAt) {
    const resetSeconds = Number.parseInt(resetAt, 10);
    if (Number.isFinite(resetSeconds)) {
      return Math.max(500, resetSeconds * 1000 - Date.now());
    }
  }

  return Math.min(1000 * 2 ** (attempt - 1), 10_000);
}

async function fetchWithRetry(url: string, init?: RequestInit): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return response;
      }

      if (response.status === 408 || response.status === 429 || response.status >= 500) {
        const delayMs = computeRetryDelay(response, attempt);
        await sleep(delayMs);
        continue;
      }

      const text = await response.text().catch(() => '');
      throw new Error(`request failed ${response.status} for ${url}: ${text}`);
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt >= 5) {
        break;
      }
      await sleep(computeRetryDelay(null, attempt));
    }
  }

  throw lastError || new Error(`request failed for ${url}`);
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  if (!headers.has('User-Agent')) {
    headers.set('User-Agent', 'iClaw-control-plane-cloud-skill-sync/0.1');
  }
  const response = await fetchWithRetry(url, {
    ...init,
    headers,
  });
  return (await response.json()) as T;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetchWithRetry(url, {
    headers: {
      Accept: 'text/plain',
      'User-Agent': 'iClaw-control-plane-cloud-skill-sync/0.1',
    },
  });
  return response.text();
}

async function fetchConvexQuery<T>(input: {
  convexUrl: string;
  clientVersion: string;
  path: string;
  args: Record<string, unknown>;
}): Promise<T> {
  const response = await fetchJson<ConvexQuerySuccess<T> | ConvexQueryFailure>(`${input.convexUrl.replace(/\/$/, '')}/api/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Convex-Client': input.clientVersion,
      Accept: 'application/json',
    },
    body: JSON.stringify({
      path: input.path,
      format: 'convex_encoded_json',
      args: [input.args],
    }),
  });

  if (response.status !== 'success') {
    throw new Error(response.errorMessage || `convex query failed for ${input.path}`);
  }

  return response.value;
}

function buildClawHubPublisher(detail: ClawHubSkillDetailResponse): string {
  const handle = detail.owner?.handle?.trim();
  const displayName = detail.owner?.displayName?.trim();
  if (handle) return `ClawHub · ${handle}`;
  if (displayName) return `ClawHub · ${displayName}`;
  return 'ClawHub';
}

function resolveClawHubPublicBaseUrl(source: SkillSyncSourceRecord): string {
  const raw = source.sourceUrl.trim();
  if (!raw) {
    return DEFAULT_CLAWHUB_PUBLIC_BASE_URL;
  }
  try {
    const parsed = new URL(raw);
    if (/\.convex\.(site|cloud)$/i.test(parsed.hostname)) {
      return DEFAULT_CLAWHUB_PUBLIC_BASE_URL;
    }
    return raw.replace(/\/$/, '');
  } catch {
    return DEFAULT_CLAWHUB_PUBLIC_BASE_URL;
  }
}

function resolveClawHubConfig(source: SkillSyncSourceRecord): {
  publicBaseUrl: string;
  convexUrl: string;
  detailApiBase: string;
  clientVersion: string;
} {
  const config = source.config || {};
  const convexUrl =
    typeof config.convex_url === 'string' && config.convex_url.trim()
      ? config.convex_url.trim().replace(/\/$/, '')
      : DEFAULT_CLAWHUB_CONVEX_URL;
  const detailApiBase =
    typeof config.detail_api_base === 'string' && config.detail_api_base.trim()
      ? config.detail_api_base.trim().replace(/\/$/, '')
      : DEFAULT_CLAWHUB_DETAIL_API_BASE;
  const clientVersion =
    typeof config.client_version === 'string' && config.client_version.trim()
      ? config.client_version.trim()
      : DEFAULT_CLAWHUB_CLIENT_VERSION;

  return {
    publicBaseUrl: resolveClawHubPublicBaseUrl(source),
    convexUrl,
    detailApiBase,
    clientVersion,
  };
}

async function loadClawHubCandidates(source: SkillSyncSourceRecord): Promise<NormalizedSkillCandidate[]> {
  const config = source.config || {};
  const {publicBaseUrl, convexUrl, detailApiBase, clientVersion} = resolveClawHubConfig(source);
  const rawLimit = readNonNegativeIntegerConfig(config.limit);
  const limit = rawLimit === null ? 25 : rawLimit === 0 ? Number.POSITIVE_INFINITY : rawLimit;
  const sort = typeof config.sort === 'string' && config.sort.trim() ? config.sort.trim() : 'downloads';
  const pageSize = Math.min(100, readPositiveIntegerConfig(config.page_size, 100));
  const detailConcurrency = readPositiveIntegerConfig(config.detail_concurrency, 8);
  const includeDetail = config.include_detail === true;
  const candidates: NormalizedSkillCandidate[] = [];
  const seenSlugs = new Set<string>();
  let cursor: string | null = null;

  while (candidates.length < limit) {
    const list: ClawHubListResponse = await fetchConvexQuery<ClawHubListResponse>({
      convexUrl,
      clientVersion,
      path: 'skills:listPublicPageV4',
      args: {
        cursor: cursor || undefined,
        numItems: Math.min(pageSize, Math.max(1, Number.isFinite(limit) ? limit - candidates.length : pageSize)),
        sort,
        dir: sort === 'name' ? 'asc' : 'desc',
      },
    });
    if (!list.page?.length) break;

    const buildCandidate = (input: {item: ClawHubListSkillItem; detail: ClawHubSkillDetailResponse | null}): NormalizedSkillCandidate | null => {
      const skill = input.detail?.skill || input.item.skill;
      const latestVersion = input.detail?.latestVersion || input.item.latestVersion;
      const owner = input.detail?.owner || input.item.owner || null;
      if (!skill || !latestVersion?.version) return null;

      const slug = normalizeSlug(skill.slug);
      const name = (skill.displayName || input.item.skill.displayName || skill.slug).trim();
      const description = (skill.summary || input.item.skill.summary || '').trim();
      if (!slug || !name || !description) return null;

      const tags = Object.keys(skill.tags || {}).map((tag) => tag.trim()).filter(Boolean);
      const ownerRef = owner?.handle?.trim() || owner?._id?.trim() || input.item.ownerHandle?.trim() || input.item.owner?._id?.trim();
      const publisher = input.detail ? buildClawHubPublisher(input.detail) : owner?.handle?.trim() ? `ClawHub · ${owner.handle.trim()}` : owner?.displayName?.trim() ? `ClawHub · ${owner.displayName.trim()}` : 'ClawHub';

      return {
        slug,
        name,
        description,
        visibility: 'showcase',
        market: inferMarket({name, description, tags}),
        category: inferCategory({name, description, tags}),
        skill_type: inferSkillType({name, description, tags}),
        publisher,
        distribution: 'cloud',
        tags,
        version: latestVersion.version.trim(),
        artifact_url: `${detailApiBase}/download?${new URLSearchParams({
          slug: skill.slug,
          version: latestVersion.version,
        }).toString()}`,
        artifact_format: 'zip',
        artifact_sha256: null,
        artifact_source_path: null,
        origin_type: 'clawhub',
        source_url: ownerRef
          ? `${publicBaseUrl}/${encodeURIComponent(ownerRef)}/${encodeURIComponent(skill.slug)}`
          : `${publicBaseUrl}/${encodeURIComponent(skill.slug)}`,
        metadata: {
          clawhub: {
            listing: input.item,
            detail: input.detail,
            source: {
              convex_url: convexUrl,
              detail_api_base: detailApiBase,
              public_base_url: publicBaseUrl,
              query_path: 'skills:listPublicPageV4',
              detail_query_path: includeDetail ? 'skills:getBySlug' : null,
              include_detail: includeDetail,
            },
          },
        },
        active: true,
      };
    };

    const pageCandidates = includeDetail
      ? await mapWithConcurrency(list.page, detailConcurrency, async (item) => {
          const detail = await fetchConvexQuery<ClawHubSkillDetailResponse>({
            convexUrl,
            clientVersion,
            path: 'skills:getBySlug',
            args: {
              slug: item.skill.slug,
            },
          });
          return buildCandidate({item, detail});
        })
      : list.page.map((item) => buildCandidate({item, detail: null}));

    for (const candidate of pageCandidates) {
      if (!candidate) {
        continue;
      }
      if (seenSlugs.has(candidate.slug)) {
        continue;
      }
      seenSlugs.add(candidate.slug);
      candidates.push(candidate);
      if (candidates.length >= limit) {
        break;
      }
    }

    cursor = list.nextCursor || null;
    if (!list.hasMore || !cursor) break;
  }

  return candidates;
}

function parseGithubSource(source: SkillSyncSourceRecord): {
  owner: string;
  repo: string;
  branch: string;
  basePath: string;
} {
  const parsed = new URL(source.sourceUrl);
  if (parsed.hostname !== 'github.com') {
    throw new Error('github source_url must use github.com');
  }
  const parts = parsed.pathname.split('/').filter(Boolean);
  if (parts.length < 2) {
    throw new Error('github source_url must include owner and repo');
  }
  const owner = parts[0];
  const repo = parts[1];
  let branch = typeof source.config.branch === 'string' && source.config.branch.trim() ? source.config.branch.trim() : 'main';
  let basePath = typeof source.config.base_path === 'string' ? source.config.base_path.trim().replace(/^\/+|\/+$/g, '') : '';
  if (parts[2] === 'tree' && parts[3]) {
    branch = parts[3];
    basePath = parts.slice(4).join('/');
  }
  return {owner, repo, branch, basePath};
}

async function loadGithubCandidates(source: SkillSyncSourceRecord): Promise<NormalizedSkillCandidate[]> {
  const {owner, repo, branch, basePath} = parseGithubSource(source);
  const tree = await fetchJson<GitHubTreeResponse>(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
  );
  const treeItems = Array.isArray(tree.tree) ? tree.tree : [];
  const skillFiles = treeItems
    .filter((item) => item.type === 'blob' && item.path.endsWith('SKILL.md'))
    .map((item) => item.path)
    .filter((filePath) => !basePath || filePath === `${basePath}/SKILL.md` || filePath.startsWith(`${basePath}/`));

  const candidates: NormalizedSkillCandidate[] = [];
  for (const skillMdPath of skillFiles) {
    const raw = await fetchText(
      `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(branch)}/${skillMdPath}`,
    );
    const frontmatter = parseFrontmatter(raw);
    const skillDir = path.posix.dirname(skillMdPath) === '.' ? '' : path.posix.dirname(skillMdPath);
    const fallbackSlug = skillDir ? path.posix.basename(skillDir) : repo;
    const slug = normalizeSlug(typeof frontmatter.slug === 'string' && frontmatter.slug.trim() ? frontmatter.slug : fallbackSlug);
    const name =
      typeof frontmatter.name === 'string' && frontmatter.name.trim()
        ? frontmatter.name.trim()
        : slug;
    const description =
      typeof frontmatter.description === 'string' && frontmatter.description.trim()
        ? frontmatter.description.trim()
        : `Synced from GitHub repository ${owner}/${repo}`;
    const tags = asStringArray(frontmatter.tags);
    const version =
      typeof frontmatter.version === 'string' && frontmatter.version.trim()
        ? frontmatter.version.trim()
        : `0.0.0+git.${(tree.sha || 'head').slice(0, 7)}`;

    candidates.push({
      slug,
      name,
      description,
      visibility: 'showcase',
      market: typeof frontmatter.market === 'string' ? frontmatter.market.trim() || inferMarket({name, description, tags}) : inferMarket({name, description, tags}),
      category:
        typeof frontmatter.category === 'string' ? frontmatter.category.trim() || inferCategory({name, description, tags}) : inferCategory({name, description, tags}),
      skill_type:
        typeof frontmatter.skill_type === 'string'
          ? frontmatter.skill_type.trim() || inferSkillType({name, description, tags})
          : inferSkillType({name, description, tags}),
      publisher:
        typeof frontmatter.publisher === 'string' && frontmatter.publisher.trim()
          ? frontmatter.publisher.trim()
          : `GitHub · ${owner}`,
      distribution: 'cloud',
      tags,
      version,
      artifact_url: null,
      artifact_format: 'tar.gz',
      artifact_sha256: null,
      artifact_source_path: skillDir || '.',
      origin_type: 'github_repo',
      source_url: `https://github.com/${owner}/${repo}${skillDir ? `/tree/${branch}/${skillDir}` : ''}`,
      metadata: {
        github: {
          owner,
          repo,
          branch,
          skill_path: skillDir || '.',
          skill_md_path: skillMdPath,
          archive_url: `https://codeload.github.com/${owner}/${repo}/tar.gz/refs/heads/${branch}`,
          repo_url: `https://github.com/${owner}/${repo}`,
          tree_sha: tree.sha || null,
          frontmatter,
        },
      },
      active: true,
    });
  }

  return candidates;
}

function selectExistingEntry(
  candidate: NormalizedSkillCandidate,
  existingBySlug: Map<string, SkillCatalogEntryRecord>,
  existingBySourceUrl: Map<string, SkillCatalogEntryRecord>,
  existingByName: Map<string, SkillCatalogEntryRecord>,
): SkillCatalogEntryRecord | null {
  const bySlug = existingBySlug.get(candidate.slug);
  if (bySlug) return bySlug;
  if (candidate.source_url) {
    const bySourceUrl = existingBySourceUrl.get(candidate.source_url);
    if (bySourceUrl) return bySourceUrl;
  }
  return existingByName.get(normalizeName(candidate.name)) || null;
}

export async function syncSkillsFromSource(
  source: SkillSyncSourceRecord,
  existingEntries: SkillCatalogEntryRecord[],
): Promise<SyncExecution> {
  const startedAt = new Date().toISOString();
  try {
    const candidates = source.sourceType === 'clawhub' ? await loadClawHubCandidates(source) : await loadGithubCandidates(source);
    const existingBySlug = new Map(existingEntries.map((item) => [item.slug, item]));
    const existingBySourceUrl = new Map(
      existingEntries
        .filter((item) => item.sourceUrl)
        .map((item) => [item.sourceUrl as string, item]),
    );
    const existingByName = new Map(existingEntries.map((item) => [normalizeName(item.name), item]));

    const items: SkillSyncRunRecord['items'] = [];
    const upserts: Array<Required<UpsertSkillCatalogEntryInput>> = [];

    for (const candidate of candidates) {
      const existing = selectExistingEntry(candidate, existingBySlug, existingBySourceUrl, existingByName);
      if (existing) {
        if (existing.version === candidate.version) {
          items.push({
            slug: existing.slug,
            name: existing.name,
            version: candidate.version,
            status: 'skipped',
            reason: 'same version',
            sourceUrl: candidate.source_url,
          });
          continue;
        }
        upserts.push({
          ...candidate,
          slug: existing.slug,
        });
        const merged: SkillCatalogEntryRecord = {
          ...existing,
          slug: existing.slug,
          name: candidate.name,
          description: candidate.description,
          visibility: candidate.visibility,
          market: candidate.market,
          category: candidate.category,
          skillType: candidate.skill_type,
          publisher: candidate.publisher,
          distribution: candidate.distribution,
          tags: candidate.tags,
          version: candidate.version,
          artifactFormat: candidate.artifact_format,
          artifactUrl: candidate.artifact_url,
          artifactSha256: candidate.artifact_sha256,
          artifactSourcePath: candidate.artifact_source_path,
          originType: candidate.origin_type,
          sourceUrl: candidate.source_url,
          metadata: candidate.metadata,
          active: candidate.active,
          updatedAt: new Date().toISOString(),
        };
        existingBySlug.set(existing.slug, merged);
        if (candidate.source_url) {
          existingBySourceUrl.set(candidate.source_url, merged);
        }
        existingByName.set(normalizeName(candidate.name), merged);
        items.push({
          slug: existing.slug,
          name: candidate.name,
          version: candidate.version,
          status: 'updated',
          reason: `version ${existing.version} -> ${candidate.version}`,
          sourceUrl: candidate.source_url,
        });
        continue;
      }

      upserts.push(candidate);
      const created: SkillCatalogEntryRecord = {
        slug: candidate.slug,
        name: candidate.name,
        description: candidate.description,
        visibility: candidate.visibility,
        market: candidate.market,
        category: candidate.category,
        skillType: candidate.skill_type,
        publisher: candidate.publisher,
        distribution: candidate.distribution,
        tags: candidate.tags,
        version: candidate.version,
        artifactFormat: candidate.artifact_format,
        artifactUrl: candidate.artifact_url,
        artifactSha256: candidate.artifact_sha256,
        artifactSourcePath: candidate.artifact_source_path,
        originType: candidate.origin_type,
        sourceUrl: candidate.source_url,
        metadata: candidate.metadata,
        active: candidate.active,
        createdAt: startedAt,
        updatedAt: startedAt,
      };
      existingBySlug.set(candidate.slug, created);
      if (candidate.source_url) {
        existingBySourceUrl.set(candidate.source_url, created);
      }
      existingByName.set(normalizeName(candidate.name), created);
      items.push({
        slug: candidate.slug,
        name: candidate.name,
        version: candidate.version,
        status: 'created',
        reason: null,
        sourceUrl: candidate.source_url,
      });
    }

    const summary = {
      source_key: source.sourceKey,
      total: items.length,
      created: items.filter((item) => item.status === 'created').length,
      updated: items.filter((item) => item.status === 'updated').length,
      skipped: items.filter((item) => item.status === 'skipped').length,
      finished_at: new Date().toISOString(),
      started_at: startedAt,
    };
    return {
      status: 'succeeded',
      summary,
      items,
      upserts,
    };
  } catch (error) {
    return {
      status: 'failed',
      summary: {
        source_key: source.sourceKey,
        total: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'sync failed',
      },
      items: [],
      upserts: [],
    };
  }
}
