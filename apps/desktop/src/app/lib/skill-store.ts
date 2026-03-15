import { invoke } from '@tauri-apps/api/core';
import type {
  AdminSkillCatalogEntryData,
  IClawClient,
  SkillCatalogEntryData,
  SkillCatalogReleaseData,
  UserSkillLibraryItemData,
} from '@iclaw/sdk';

export type RawBundledSkillCatalogItem = {
  slug: string;
  name: string;
  description: string;
  visibility: string | null;
  tags: string[];
  license: string | null;
  homepage: string | null;
  market: string | null;
  category: string | null;
  skill_type: string | null;
  publisher: string | null;
  distribution: string | null;
  path: string;
  source: 'bundled';
};

type ManagedSkillInstallInput = {
  slug: string;
  version: string;
  artifact_url: string;
  artifact_sha256?: string | null;
  artifact_format?: string | null;
};

type ManagedSkillInstallRecord = {
  slug: string;
  version: string;
  source: string;
  installed_at: string;
  path: string;
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
  visibility: string;
  source: 'bundled' | 'cloud';
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
  latestRelease: SkillCatalogReleaseData | null;
};

export type AdminSkillStoreItem = SkillStoreItem & {
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

const CATEGORY_LABELS: Record<Exclude<SkillStoreCategoryId, 'all' | 'official' | 'a-share' | 'us-stock'>, string> = {
  data: '数据工具',
  research: '研究分析',
  portfolio: '组合与风险',
  report: '报告生成',
  general: '通用工具',
};

const SKILL_STORE_UPDATED_EVENT = 'iclaw-skill-store-updated';
const SKILL_STORE_SYNC_ERROR_EVENT = 'iclaw-skill-store-sync-error';

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
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

function normalizeBundledSkill(item: RawBundledSkillCatalogItem): SkillStoreItem {
  const market = inferMarket(item);
  const inferredCategoryId = inferCategoryId(item);
  const categoryId =
    market === 'A股' ? 'a-share' : market === '美股' ? 'us-stock' : inferredCategoryId;

  return {
    slug: item.slug,
    name: item.name,
    description: item.description,
    tags: item.tags,
    visibility: item.visibility || 'showcase',
    source: 'bundled',
    market,
    skillType: inferSkillType(item),
    categoryId,
    categoryLabel: categoryLabel(categoryId, market),
    official: true,
    installed: true,
    userInstalled: false,
    localInstalled: true,
    enabled: true,
    sourceLabel: '系统预置',
    publisher: item.publisher || 'iClaw',
    latestRelease: null,
  };
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
  const userInstalled = Boolean(libraryItem);
  const localInstalled = Boolean(localItem);
  const installed = userInstalled || localInstalled;
  const enabled = libraryItem?.enabled ?? installed;

  return {
    slug: item.slug,
    name: item.name,
    description: item.description,
    tags: item.tags,
    visibility: item.visibility || 'showcase',
    source: 'cloud',
    market,
    skillType: inferSkillType(item),
    categoryId,
    categoryLabel: categoryLabel(categoryId, market),
    official: normalizeText(item.publisher) === 'iclaw',
    installed,
    userInstalled,
    localInstalled,
    enabled,
    sourceLabel: '云端技能',
    publisher: item.publisher,
    latestRelease: item.latest_release,
  };
}

function normalizeAdminSkill(
  item: AdminSkillCatalogEntryData,
  libraryItem: UserSkillLibraryItemData | null,
  localItem: ManagedSkillInstallRecord | null,
  bundledItem: RawBundledSkillCatalogItem | null,
): AdminSkillStoreItem {
  const normalized =
    item.source === 'bundled' && bundledItem
      ? normalizeBundledSkill({
          ...bundledItem,
          name: item.name,
          description: item.description,
          visibility: item.visibility,
          tags: item.tags,
          market: item.market,
          category: item.category,
          skill_type: item.skill_type,
          publisher: item.publisher,
          distribution: item.distribution,
        })
      : normalizeCloudSkill(item, libraryItem, localItem);

  return {
    ...normalized,
    visibility: item.visibility || normalized.visibility,
    source: item.source,
    sourceLabel: item.source === 'bundled' ? '系统预置' : '云端技能',
    active: item.active,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}

async function loadBundledSkillCatalogRaw(): Promise<RawBundledSkillCatalogItem[]> {
  return isTauriRuntime()
    ? await invoke<RawBundledSkillCatalogItem[]>('load_bundled_skills_catalog')
    : await fetch('/__iclaw/bundled-skills').then(async (response) => {
        if (!response.ok) {
          throw new Error(`bundled skills request failed: ${response.status}`);
        }
        return (await response.json()) as RawBundledSkillCatalogItem[];
      });
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

export async function loadBundledSkillCatalog(): Promise<SkillStoreItem[]> {
  const rawItems = await loadBundledSkillCatalogRaw();
  return rawItems
    .map(normalizeBundledSkill)
    .filter((item) => item.visibility === 'showcase')
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
}

export async function loadSkillStoreCatalog(input: {
  client: IClawClient;
  accessToken: string | null;
}): Promise<SkillStoreItem[]> {
  const [bundledItems, cloudCatalog, libraryItems, localManagedItems] = await Promise.all([
    loadBundledSkillCatalog(),
    input.client.listSkillsCatalog().catch(() => []),
    input.accessToken ? input.client.getSkillLibrary(input.accessToken).catch(() => []) : Promise.resolve([]),
    listManagedSkills().catch(() => []),
  ]);

  const libraryBySlug = new Map(libraryItems.map((item) => [item.slug, item]));
  const localBySlug = new Map(localManagedItems.map((item) => [item.slug, item]));

  const cloudItems = cloudCatalog
    .map((item) => normalizeCloudSkill(item, libraryBySlug.get(item.slug) || null, localBySlug.get(item.slug) || null))
    .filter((item) => item.visibility === 'showcase');
  const merged = new Map<string, SkillStoreItem>();

  for (const item of bundledItems) {
    merged.set(item.slug, item);
  }
  for (const item of cloudItems) {
    if (!merged.has(item.slug)) {
      merged.set(item.slug, item);
    }
  }

  return Array.from(merged.values()).sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
}

export async function loadAdminSkillStoreCatalog(input: {
  client: IClawClient;
  accessToken: string;
}): Promise<AdminSkillStoreItem[]> {
  const [bundledRawItems, adminCatalog, libraryItems, localManagedItems] = await Promise.all([
    loadBundledSkillCatalogRaw(),
    input.client.listAdminSkillsCatalog(input.accessToken),
    input.client.getSkillLibrary(input.accessToken).catch(() => []),
    listManagedSkills().catch(() => []),
  ]);

  const libraryBySlug = new Map(libraryItems.map((item) => [item.slug, item]));
  const localBySlug = new Map(localManagedItems.map((item) => [item.slug, item]));
  const bundledBySlug = new Map(bundledRawItems.map((item) => [item.slug, item]));

  return adminCatalog
    .map((item) =>
      normalizeAdminSkill(
        item,
        libraryBySlug.get(item.slug) || null,
        localBySlug.get(item.slug) || null,
        bundledBySlug.get(item.slug) || null,
      ),
    )
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
}

export async function saveAdminSkillStoreEntry(input: {
  client: IClawClient;
  accessToken: string;
  item: {
    slug: string;
    name?: string;
    description?: string;
    visibility?: 'showcase' | 'internal';
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
    visibility: input.item.visibility,
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

export async function installSkillFromStore(input: {
  client: IClawClient;
  accessToken: string | null;
  item: SkillStoreItem;
}): Promise<void> {
  if (input.item.source !== 'cloud') {
    return;
  }
  if (!input.accessToken) {
    throw new Error('AUTH_REQUIRED');
  }

  const release = input.item.latestRelease;
  if (!release?.artifact_url) {
    throw new Error('skill artifact unavailable');
  }

  const libraryItem = await input.client.installSkill({
    token: input.accessToken,
    slug: input.item.slug,
    version: release.version,
  });

  await installManagedSkill({
    slug: input.item.slug,
    version: libraryItem.version,
    artifact_url: release.artifact_url,
    artifact_sha256: release.artifact_sha256,
    artifact_format: release.artifact_format,
  });
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
      input.client.listSkillsCatalog(),
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
      const release = catalogItem?.latest_release;
      if (!catalogItem || !release?.artifact_url) {
        continue;
      }
      const localItem = localBySlug.get(libraryItem.slug);
      if (localItem?.version === libraryItem.version) {
        continue;
      }

      await installManagedSkill({
        slug: libraryItem.slug,
        version: libraryItem.version,
        artifact_url: release.artifact_url,
        artifact_sha256: release.artifact_sha256,
        artifact_format: release.artifact_format,
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
