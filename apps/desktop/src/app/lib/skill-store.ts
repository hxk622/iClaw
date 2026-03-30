import { invoke } from '@tauri-apps/api/core';
import type {
  AdminSkillCatalogEntryData,
  IClawClient,
  SkillCatalogEntryData,
  SkillCatalogPageData,
  SkillSyncRunData,
  SkillSyncSourceData,
  UserExtensionInstallConfigData,
  UserSkillLibraryItemData,
} from '@iclaw/sdk';
import type {
  ExtensionInstallConfigSnapshot,
  ExtensionSetupSchema,
  ExtensionSetupStatus,
} from './extension-setup';
import {parseExtensionSetupSchema} from './extension-setup';
import { canUseCacheStorage, readCacheJson, writeCacheJson } from './persistence/cache-store';

type ManagedSkillInstallInput = {
  slug: string;
  version: string;
  artifact_url: string;
  artifact_sha256?: string | null;
  artifact_format?: string | null;
  source?: 'cloud' | 'private';
};

type ManagedSkillInstallRecord = {
  slug: string;
  version: string;
  source: string;
  installed_at: string;
  path: string;
};

type ImportGithubSkillInput = {
  auth_base_url: string;
  access_token: string;
  repo_url: string;
};

type ImportLocalSkillInput = {
  auth_base_url: string;
  access_token: string;
};

export type ImportedSkillResult = {
  slug: string;
  version: string;
  name: string;
  source: 'private';
};

export type SkillMarketLabel = 'A股' | '美股' | '通用' | '全球';
export type SkillTypeLabel = '工具包' | '分析师' | '生成器' | '扫描器';
export type SkillStoreCategoryId =
  | 'all'
  | 'official'
  | 'a-share'
  | 'us-stock'
  | 'data'
  | 'research'
  | 'portfolio'
  | 'report'
  | 'general';

export type SkillStoreItem = {
  slug: string;
  name: string;
  description: string;
  tags: string[];
  downloadCount: number | null;
  featured: boolean;
  source: 'bundled' | 'cloud' | 'private';
  market: SkillMarketLabel;
  skillType: SkillTypeLabel;
  categoryId: SkillStoreCategoryId;
  categoryLabel: string;
  official: boolean;
  installed: boolean;
  userInstalled: boolean;
  localInstalled: boolean;
  enabled: boolean;
  sourceLabel: string;
  publisher: string;
  version: string | null;
  artifactUrl: string | null;
  artifactFormat: string | null;
  artifactSha256: string | null;
  sourceUrl: string | null;
  metadata: Record<string, unknown>;
  setupSchema: ExtensionSetupSchema | null;
  setupStatus: ExtensionSetupStatus;
  setupSchemaVersion: number | null;
  setupUpdatedAt: string | null;
};

export type AdminSkillStoreItem = SkillStoreItem & {
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SkillSyncSourceItem = SkillSyncSourceData;
export type SkillSyncRunItem = SkillSyncRunData;
export type SkillStoreCatalogPage = {
  items: SkillStoreItem[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  nextOffset: number | null;
};
export type AdminSkillStoreCatalogPage = {
  items: AdminSkillStoreItem[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  nextOffset: number | null;
};

const CATEGORY_LABELS: Record<Exclude<SkillStoreCategoryId, 'all' | 'official' | 'a-share' | 'us-stock'>, string> = {
  data: '数据工具',
  research: '研究分析',
  portfolio: '组合与风险',
  report: '报告生成',
  general: '通用工具',
};

const FEATURED_SKILL_SLUGS = new Set([
  'A股数据工具包',
  '美股数据工具包',
  '加密货币分析师',
  'A股量化因子筛选器',
  '美股量化因子扫描器',
  '股票研究分析师',
  '财报分析师',
  '风险管理分析师',
  '投资备忘录生成器',
  '金融仪表板生成器',
  'multi-search-engine',
  'stock-watcher',
]);

const SKILL_STORE_UPDATED_EVENT = 'iclaw-skill-store-updated';
const SKILL_STORE_SYNC_ERROR_EVENT = 'iclaw-skill-store-sync-error';
const SKILL_STORE_CACHE_KEY_PREFIX = 'iclaw.skill-store.cache.v2';
const SKILL_STORE_INITIAL_CLOUD_LIMIT = 60;
const SKILL_STORE_CACHE_TTL_MS = 30 * 60 * 1000;

type SkillStoreCatalogCacheSnapshot = {
  version: 1;
  savedAt: number;
  items: SkillStoreItem[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  nextOffset: number | null;
};

type SkillStoreCatalogQuery = {
  tagKeywords?: string[];
};

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function canUseStorage(): boolean {
  return canUseCacheStorage();
}

function emitWindowEvent(name: string, detail?: unknown): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

export function subscribeSkillStoreEvents(
  onUpdate: () => void,
  onSyncError?: (message: string) => void,
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleUpdate = () => onUpdate();
  const handleSyncError = (event: Event) => {
    if (!onSyncError) return;
    const detail = (event as CustomEvent<string>).detail;
    onSyncError(typeof detail === 'string' && detail.trim() ? detail : '下载安装失败');
  };

  window.addEventListener(SKILL_STORE_UPDATED_EVENT, handleUpdate);
  window.addEventListener(SKILL_STORE_SYNC_ERROR_EVENT, handleSyncError as EventListener);
  return () => {
    window.removeEventListener(SKILL_STORE_UPDATED_EVENT, handleUpdate);
    window.removeEventListener(SKILL_STORE_SYNC_ERROR_EVENT, handleSyncError as EventListener);
  };
}

function normalizeText(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase();
}

function parseNonNegativeInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.round(value);
  }
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().replace(/[,_\s]/g, '');
  if (!normalized || !/^\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
}

function readObjectPath(source: unknown, path: string[]): unknown {
  let current = source;
  for (const segment of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function readSkillDownloadCount(metadata: Record<string, unknown> | null | undefined): number | null {
  if (!metadata) {
    return null;
  }

  const candidatePaths = [
    ['downloads'],
    ['download_count'],
    ['downloadCount'],
    ['install_count'],
    ['installCount'],
    ['installs'],
    ['stats', 'downloads'],
    ['stats', 'download_count'],
    ['stats', 'downloadCount'],
    ['clawhub', 'listing', 'skill', 'stats', 'downloads'],
    ['clawhub', 'listing', 'skill', 'stats', 'download_count'],
    ['clawhub', 'listing', 'skill', 'stats', 'downloadCount'],
    ['clawhub', 'detail', 'skill', 'stats', 'downloads'],
    ['clawhub', 'detail', 'skill', 'stats', 'download_count'],
    ['clawhub', 'detail', 'skill', 'stats', 'downloadCount'],
  ];

  for (const path of candidatePaths) {
    const count = parseNonNegativeInteger(readObjectPath(metadata, path));
    if (count != null) {
      return count;
    }
  }

  return null;
}

function inferMarket(item: {
  market?: string | null;
  name: string;
  description: string;
  tags: string[];
}): SkillMarketLabel {
  const explicit = (item.market || '').trim();
  if (explicit === 'A股' || explicit === '美股' || explicit === '通用' || explicit === '全球') {
    return explicit;
  }

  const text = [item.market, item.name, item.description, item.tags.join(' ')].join(' ');
  if (text.includes('A股')) return 'A股';
  if (text.includes('美股')) return '美股';
  if (text.includes('加密') || normalizeText(item.market) === 'crypto') return '全球';
  if (text.includes('全球')) return '全球';
  return '通用';
}

function inferSkillType(item: {
  skill_type?: string | null;
  name: string;
  description: string;
  tags: string[];
}): SkillTypeLabel {
  const value = item.skill_type?.trim();
  if (value === '工具包' || value === '分析师' || value === '生成器' || value === '扫描器') {
    return value;
  }

  const text = [item.name, item.description, item.tags.join(' ')].join(' ');
  if (/(生成器|报告生成|备忘录)/.test(text)) return '生成器';
  if (/(筛选|扫描|检测|识别|监控)/.test(text)) return '扫描器';
  if (/(工具|仪表板|数据包|计算器|面板)/.test(text)) return '工具包';
  return '分析师';
}

function inferCategoryId(item: {
  category?: string | null;
  name: string;
  description: string;
  tags: string[];
}): SkillStoreCategoryId {
  const explicit = normalizeText(item.category);
  if (
    explicit === 'data' ||
    explicit === 'research' ||
    explicit === 'portfolio' ||
    explicit === 'report' ||
    explicit === 'general'
  ) {
    return explicit;
  }

  const text = [item.category, item.name, item.description, item.tags.join(' ')].join(' ');
  if (/(数据|仪表板|可视化|数据库|行情|宏观)/.test(text)) return 'data';
  if (/(风险|组合|回撤|压力测试|var|cvar)/i.test(text)) return 'portfolio';
  if (/(报告|备忘录|财报生成|周报|晨会)/.test(text)) return 'report';
  if (/(研究|估值|分析|轮动|esg|技术|财报|事件|因子|股票)/i.test(text)) return 'research';
  return 'general';
}

function categoryLabel(categoryId: SkillStoreCategoryId, market: SkillMarketLabel): string {
  if (categoryId === 'a-share') return 'A股';
  if (categoryId === 'us-stock') return '美股';
  if (categoryId === 'official') return '官方预置';
  if (categoryId === 'all') return '全部';
  if (market === 'A股') return 'A股';
  if (market === '美股') return '美股';
  return CATEGORY_LABELS[categoryId];
}

function isFeaturedSkill(item: {slug: string; featured?: boolean | null}): boolean {
  if (typeof item.featured === 'boolean') {
    return item.featured;
  }
  return FEATURED_SKILL_SLUGS.has(item.slug);
}

function sortSkillStoreItems<T extends SkillStoreItem>(items: Iterable<T>): T[] {
  return Array.from(items).sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
}

function mergeSkillStoreItems<T extends SkillStoreItem>(...groups: Array<Iterable<T>>): T[] {
  const merged = new Map<string, T>();
  for (const group of groups) {
    for (const item of group) {
      if (!merged.has(item.slug)) {
        merged.set(item.slug, item);
      }
    }
  }
  return sortSkillStoreItems(merged.values());
}

function toSkillStoreCatalogPage<T extends SkillStoreItem>(input: {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  nextOffset: number | null;
}): {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  nextOffset: number | null;
} {
  return {
    items: sortSkillStoreItems(input.items),
    total: input.total,
    limit: input.limit,
    offset: input.offset,
    hasMore: input.hasMore,
    nextOffset: input.nextOffset,
  };
}

function toSnapshotSkill(item: SkillStoreItem): SkillStoreItem {
  if (item.source === 'bundled') {
    return item;
  }
  return {
    ...item,
    installed: false,
    userInstalled: false,
    localInstalled: false,
    enabled: false,
  };
}

function normalizeSkillStoreCatalogQuery(query?: SkillStoreCatalogQuery): {tagKeywords: string[]} {
  return {
    tagKeywords: Array.from(new Set((query?.tagKeywords || []).map((keyword) => keyword.trim()).filter(Boolean))),
  };
}

function skillStoreCatalogCacheKey(query?: SkillStoreCatalogQuery): string {
  const normalized = normalizeSkillStoreCatalogQuery(query);
  if (normalized.tagKeywords.length === 0) {
    return `${SKILL_STORE_CACHE_KEY_PREFIX}:all`;
  }
  return `${SKILL_STORE_CACHE_KEY_PREFIX}:tags:${normalized.tagKeywords.join('|').toLowerCase()}`;
}

function persistSkillStoreCatalogSnapshot(page: SkillStoreCatalogPage, query?: SkillStoreCatalogQuery): void {
  if (!canUseStorage()) {
    return;
  }
  try {
    const snapshot: SkillStoreCatalogCacheSnapshot = {
      version: 1,
      savedAt: Date.now(),
      items: page.items.filter((item) => item.source !== 'private').map(toSnapshotSkill),
      total: page.total,
      limit: page.limit,
      offset: page.offset,
      hasMore: page.hasMore,
      nextOffset: page.nextOffset,
    };
    writeCacheJson(skillStoreCatalogCacheKey(query), snapshot);
  } catch {
    // Ignore cache write errors and continue with live data.
  }
}

export function readSkillStoreCatalogSnapshot(query?: SkillStoreCatalogQuery): SkillStoreCatalogPage | null {
  if (!canUseStorage()) {
    return null;
  }
  try {
    const snapshot = readCacheJson<Partial<SkillStoreCatalogCacheSnapshot>>(skillStoreCatalogCacheKey(query));
    if (!snapshot) {
      return null;
    }
    if (
      snapshot.version !== 1 ||
      !Array.isArray(snapshot.items) ||
      typeof snapshot.savedAt !== 'number' ||
      Date.now() - snapshot.savedAt > SKILL_STORE_CACHE_TTL_MS
    ) {
      return null;
    }
    return {
      items: snapshot.items as SkillStoreItem[],
      total: typeof snapshot.total === 'number' ? snapshot.total : snapshot.items.length,
      limit: typeof snapshot.limit === 'number' ? snapshot.limit : SKILL_STORE_INITIAL_CLOUD_LIMIT,
      offset: typeof snapshot.offset === 'number' ? snapshot.offset : 0,
      hasMore: Boolean(snapshot.hasMore),
      nextOffset: typeof snapshot.nextOffset === 'number' ? snapshot.nextOffset : null,
    };
  } catch {
    return null;
  }
}

function normalizeCloudSkill(
  item: SkillCatalogEntryData,
  libraryItem: UserSkillLibraryItemData | null,
  localItem: ManagedSkillInstallRecord | null,
): SkillStoreItem {
  const market = inferMarket(item);
  const inferredCategoryId = inferCategoryId(item);
  const categoryId =
    market === 'A股' ? 'a-share' : market === '美股' ? 'us-stock' : inferredCategoryId;
  const builtin = item.source === 'bundled';
  const userInstalled = Boolean(libraryItem);
  const localInstalled = builtin || Boolean(localItem);
  const installed = builtin || userInstalled || localInstalled;
  const enabled = builtin ? true : (libraryItem?.enabled ?? installed);
  const setupSchema = parseExtensionSetupSchema(item.metadata);

  return {
    slug: item.slug,
    name: item.name,
    description: item.description,
    tags: item.tags,
    downloadCount: readSkillDownloadCount(item.metadata),
    featured: isFeaturedSkill(item),
    source: item.source,
    market,
    skillType: inferSkillType(item),
    categoryId,
    categoryLabel: categoryLabel(categoryId, market),
    official: builtin || normalizeText(item.publisher) === 'iclaw',
    installed,
    userInstalled,
    localInstalled,
    enabled,
    sourceLabel: item.source === 'private' ? '我的导入' : builtin ? '系统预置' : '云端技能',
    publisher: item.publisher,
    version: item.version,
    artifactUrl: item.artifact_url,
    artifactFormat: item.artifact_format,
    artifactSha256: item.artifact_sha256,
    sourceUrl: item.source_url,
    metadata: item.metadata || {},
    setupSchema,
    setupStatus: libraryItem?.setup_status || (setupSchema ? 'missing' : 'not_required'),
    setupSchemaVersion: libraryItem?.setup_schema_version ?? setupSchema?.version ?? null,
    setupUpdatedAt: libraryItem?.setup_updated_at ?? null,
  };
}

function normalizeAdminSkill(
  item: AdminSkillCatalogEntryData,
  libraryItem: UserSkillLibraryItemData | null,
  localItem: ManagedSkillInstallRecord | null,
): AdminSkillStoreItem {
  const normalized = normalizeCloudSkill(item, libraryItem, localItem);

  return {
    ...normalized,
    source: item.source,
    sourceLabel: item.source === 'private' ? '我的导入' : item.source === 'bundled' ? '系统预置' : '云端技能',
    active: item.active,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}

async function listManagedSkills(): Promise<ManagedSkillInstallRecord[]> {
  if (!isTauriRuntime()) {
    return [];
  }
  return invoke<ManagedSkillInstallRecord[]>('list_managed_skills');
}

async function installManagedSkill(input: ManagedSkillInstallInput): Promise<ManagedSkillInstallRecord | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  const record = await invoke<ManagedSkillInstallRecord>('install_managed_skill', { input });
  emitWindowEvent(SKILL_STORE_UPDATED_EVENT);
  return record;
}

async function removeManagedSkill(slug: string): Promise<boolean> {
  if (!isTauriRuntime()) {
    return false;
  }
  const removed = await invoke<boolean>('remove_managed_skill', { slug });
  if (removed) {
    emitWindowEvent(SKILL_STORE_UPDATED_EVENT);
  }
  return removed;
}

function normalizeCatalogPageMeta<T>(page: SkillCatalogPageData<T>) {
  return {
    total: page.total,
    limit: page.limit,
    offset: page.offset,
    hasMore: page.has_more,
    nextOffset: page.next_offset,
  };
}

export async function loadSkillStoreCatalogPage(input: {
  client: IClawClient;
  accessToken: string | null;
  offset?: number;
  limit?: number;
  tagKeywords?: string[];
}): Promise<SkillStoreCatalogPage> {
  const offset = Math.max(0, Math.floor(input.offset ?? 0));
  const limit = Math.max(1, Math.floor(input.limit ?? SKILL_STORE_INITIAL_CLOUD_LIMIT));
  const normalizedQuery = normalizeSkillStoreCatalogQuery({tagKeywords: input.tagKeywords});

  const [cloudPage, privatePage, libraryItems, localManagedItems] = await Promise.all([
    input.client.listSkillsCatalogPage({ limit, offset, tagKeywords: normalizedQuery.tagKeywords }),
    input.accessToken && offset === 0
      ? input.client.listPersonalSkillsCatalogPage(input.accessToken, { limit: 200, offset: 0 }).catch(() => null)
      : Promise.resolve(null),
    input.accessToken ? input.client.getSkillLibrary(input.accessToken).catch(() => []) : Promise.resolve([]),
    listManagedSkills().catch(() => []),
  ]);

  const libraryBySlug = new Map(libraryItems.map((item) => [item.slug, item]));
  const localBySlug = new Map(localManagedItems.map((item) => [item.slug, item]));
  const cloudItems = cloudPage.items
    .map((item) => normalizeCloudSkill(item, libraryBySlug.get(item.slug) || null, localBySlug.get(item.slug) || null));
  const privateItems =
    privatePage?.items
      .filter((item) => item.source === 'private')
      .map((item) => normalizeCloudSkill(item, libraryBySlug.get(item.slug) || null, localBySlug.get(item.slug) || null)) || [];
  const page = toSkillStoreCatalogPage({
    items: mergeSkillStoreItems(privateItems, cloudItems),
    ...normalizeCatalogPageMeta(cloudPage),
    total: privateItems.length + cloudPage.total,
  });

  if (offset === 0) {
    persistSkillStoreCatalogSnapshot(page, normalizedQuery);
  }
  return page;
}

export async function loadSkillStoreCatalog(input: {
  client: IClawClient;
  accessToken: string | null;
}): Promise<SkillStoreItem[]> {
  const page = await loadSkillStoreCatalogPage(input);
  return page.items;
}

export async function loadAdminSkillStoreCatalogPage(input: {
  client: IClawClient;
  accessToken: string;
  offset?: number;
  limit?: number;
}): Promise<AdminSkillStoreCatalogPage> {
  const offset = Math.max(0, Math.floor(input.offset ?? 0));
  const limit = Math.max(1, Math.floor(input.limit ?? SKILL_STORE_INITIAL_CLOUD_LIMIT));
  const [adminPage, libraryItems, localManagedItems] = await Promise.all([
    input.client.listAdminSkillsCatalogPage(input.accessToken, { limit, offset }),
    input.client.getSkillLibrary(input.accessToken).catch(() => []),
    listManagedSkills().catch(() => []),
  ]);

  const libraryBySlug = new Map(libraryItems.map((item) => [item.slug, item]));
  const localBySlug = new Map(localManagedItems.map((item) => [item.slug, item]));

  return toSkillStoreCatalogPage({
    items: adminPage.items.map((item) =>
      normalizeAdminSkill(
        item,
        libraryBySlug.get(item.slug) || null,
        localBySlug.get(item.slug) || null,
      ),
    ),
    ...normalizeCatalogPageMeta(adminPage),
    total: adminPage.total,
  });
}

export async function loadAdminSkillStoreCatalog(input: {
  client: IClawClient;
  accessToken: string;
}): Promise<AdminSkillStoreItem[]> {
  const page = await loadAdminSkillStoreCatalogPage(input);
  return page.items;
}

export async function saveAdminSkillStoreEntry(input: {
  client: IClawClient;
  accessToken: string;
  item: {
    slug: string;
    name?: string;
    description?: string;
    featured?: boolean;
    market?: string | null;
    category?: string | null;
    skillType?: string | null;
    publisher?: string;
    distribution?: 'bundled' | 'cloud';
    tags?: string[];
    active?: boolean;
  };
}): Promise<void> {
  await input.client.upsertAdminSkillCatalogEntry({
    token: input.accessToken,
    slug: input.item.slug,
    name: input.item.name,
    description: input.item.description,
    featured: input.item.featured,
    market: input.item.market,
    category: input.item.category,
    skillType: input.item.skillType,
    publisher: input.item.publisher,
    distribution: input.item.distribution,
    tags: input.item.tags,
    active: input.item.active,
  });
  emitWindowEvent(SKILL_STORE_UPDATED_EVENT);
}

export async function deleteAdminSkillStoreEntry(input: {
  client: IClawClient;
  accessToken: string;
  slug: string;
}): Promise<boolean> {
  const result = await input.client.deleteAdminSkillCatalogEntry(input.accessToken, input.slug);
  if (result.removed) {
    emitWindowEvent(SKILL_STORE_UPDATED_EVENT);
  }
  return result.removed;
}

export async function loadSkillSyncSources(input: {
  client: IClawClient;
  accessToken: string;
}): Promise<SkillSyncSourceItem[]> {
  return input.client.listSkillSyncSources(input.accessToken);
}

export async function loadSkillSyncRuns(input: {
  client: IClawClient;
  accessToken: string;
  limit?: number;
}): Promise<SkillSyncRunItem[]> {
  return input.client.listSkillSyncRuns(input.accessToken, input.limit ?? 20);
}

export async function runSkillSync(input: {
  client: IClawClient;
  accessToken: string;
  sourceId: string;
}): Promise<SkillSyncRunItem> {
  const run = await input.client.runSkillSync(input.accessToken, input.sourceId);
  emitWindowEvent(SKILL_STORE_UPDATED_EVENT);
  return run;
}

export async function installSkillFromStore(input: {
  client: IClawClient;
  accessToken: string | null;
  item: SkillStoreItem;
  setupValues?: Record<string, unknown>;
  secretValues?: Record<string, string>;
}): Promise<void> {
  if (input.item.source !== 'cloud' && input.item.source !== 'private') {
    return;
  }
  if (!input.accessToken) {
    throw new Error('AUTH_REQUIRED');
  }

  if (!input.item.artifactUrl || !input.item.version) {
    throw new Error('skill artifact unavailable');
  }

  const libraryItem = await input.client.installSkill({
    token: input.accessToken,
    slug: input.item.slug,
    version: input.item.version,
    setupValues: input.setupValues,
    secretValues: input.secretValues,
  });

  await installManagedSkill({
    slug: input.item.slug,
    version: libraryItem.version,
    artifact_url: input.item.artifactUrl,
    artifact_sha256: input.item.artifactSha256,
    artifact_format: input.item.artifactFormat,
    source: input.item.source === 'private' ? 'private' : 'cloud',
  });
}

export async function loadExtensionInstallConfig(input: {
  client: IClawClient;
  accessToken: string;
  extensionType: 'skill' | 'mcp';
  extensionKey: string;
}): Promise<ExtensionInstallConfigSnapshot | null> {
  const record = await input.client.getExtensionInstallConfig(
    input.accessToken,
    input.extensionType,
    input.extensionKey,
  );
  if (!record) {
    return null;
  }
  return {
    setupValues: record.config_values || {},
    configuredSecretKeys: record.configured_secret_keys || [],
    status: record.status,
    schemaVersion: record.schema_version,
    updatedAt: record.updated_at,
  };
}

export async function saveExtensionInstallConfig(input: {
  client: IClawClient;
  accessToken: string;
  extensionType: 'skill' | 'mcp';
  extensionKey: string;
  setupValues?: Record<string, unknown>;
  secretValues?: Record<string, string>;
}): Promise<ExtensionInstallConfigSnapshot> {
  const record = await input.client.upsertExtensionInstallConfig({
    token: input.accessToken,
    extensionType: input.extensionType,
    extensionKey: input.extensionKey,
    setupValues: input.setupValues,
    secretValues: input.secretValues,
  });
  return {
    setupValues: record.config_values || {},
    configuredSecretKeys: record.configured_secret_keys || [],
    status: record.status,
    schemaVersion: record.schema_version,
    updatedAt: record.updated_at,
  };
}

export async function syncManagedSkills(input: {
  client: IClawClient;
  accessToken: string | null;
}): Promise<void> {
  if (!isTauriRuntime() || !input.accessToken) {
    return;
  }

  try {
    const [catalog, library, localManagedItems] = await Promise.all([
      input.client.listPersonalSkillsCatalog(input.accessToken),
      input.client.getSkillLibrary(input.accessToken),
      listManagedSkills(),
    ]);

    const catalogBySlug = new Map(catalog.map((item) => [item.slug, item]));
    const libraryBySlug = new Map(library.map((item) => [item.slug, item]));
    const localBySlug = new Map(localManagedItems.map((item) => [item.slug, item]));
    let changed = false;

    for (const libraryItem of library) {
      if (!libraryItem.enabled) {
        continue;
      }
      const catalogItem = catalogBySlug.get(libraryItem.slug);
      if (!catalogItem || !catalogItem.artifact_url) {
        continue;
      }
      const localItem = localBySlug.get(libraryItem.slug);
      if (localItem?.version === libraryItem.version) {
        continue;
      }

      await installManagedSkill({
        slug: libraryItem.slug,
        version: libraryItem.version,
        artifact_url: catalogItem.artifact_url,
        artifact_sha256: catalogItem.artifact_sha256,
        artifact_format: catalogItem.artifact_format,
        source: libraryItem.source,
      });
      changed = true;
    }

    for (const localItem of localManagedItems) {
      const libraryItem = libraryBySlug.get(localItem.slug);
      if (libraryItem?.enabled && libraryItem.version === localItem.version) {
        continue;
      }
      if (await removeManagedSkill(localItem.slug)) {
        changed = true;
      }
    }

    if (changed) {
      emitWindowEvent(SKILL_STORE_UPDATED_EVENT);
    }
  } catch {
    emitWindowEvent(SKILL_STORE_SYNC_ERROR_EVENT, '下载安装失败');
    throw new Error('下载安装失败');
  }
}

export async function importSkillFromGithub(input: {
  authBaseUrl: string;
  accessToken: string | null;
  repoUrl: string;
}): Promise<ImportedSkillResult | null> {
  if (!isTauriRuntime()) {
    throw new Error('DESKTOP_ONLY');
  }
  if (!input.accessToken) {
    throw new Error('AUTH_REQUIRED');
  }
  const result = await invoke<ImportedSkillResult>('import_github_skill', {
    input: {
      auth_base_url: input.authBaseUrl,
      access_token: input.accessToken,
      repo_url: input.repoUrl,
    } satisfies ImportGithubSkillInput,
  });
  emitWindowEvent(SKILL_STORE_UPDATED_EVENT);
  return result;
}

export async function importSkillFromLocalDirectory(input: {
  authBaseUrl: string;
  accessToken: string | null;
}): Promise<ImportedSkillResult | null> {
  if (!isTauriRuntime()) {
    throw new Error('DESKTOP_ONLY');
  }
  if (!input.accessToken) {
    throw new Error('AUTH_REQUIRED');
  }
  const result = await invoke<ImportedSkillResult | null>('import_local_skill', {
    input: {
      auth_base_url: input.authBaseUrl,
      access_token: input.accessToken,
    } satisfies ImportLocalSkillInput,
  });
  if (result) {
    emitWindowEvent(SKILL_STORE_UPDATED_EVENT);
  }
  return result;
}
