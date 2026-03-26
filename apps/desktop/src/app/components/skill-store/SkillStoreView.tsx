import { useEffect, useMemo, useState } from 'react';
import type { IClawClient } from '@iclaw/sdk';
import {
  AlertCircle,
  CheckCircle2,
  CloudDownload,
  Download,
  History,
  LoaderCircle,
  MessageSquare,
  Package,
  PencilLine,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
} from 'lucide-react';
import {
  type AdminSkillStoreItem,
  type AdminSkillStoreCatalogPage,
  type SkillStoreCategoryId,
  type SkillStoreCatalogPage,
  type SkillStoreItem,
  type SkillSyncRunItem,
  type SkillSyncSourceItem,
  deleteAdminSkillStoreEntry,
  importSkillFromGithub,
  importSkillFromLocalDirectory,
  installSkillFromStore,
  loadExtensionInstallConfig,
  loadAdminSkillStoreCatalogPage,
  loadBundledSkillCatalog,
  loadSkillSyncRuns,
  loadSkillSyncSources,
  loadSkillStoreCatalogPage,
  readSkillStoreCatalogSnapshot,
  runSkillSync,
  saveAdminSkillStoreEntry,
  saveExtensionInstallConfig,
  subscribeSkillStoreEvents,
} from '@/app/lib/skill-store';
import type { ExtensionInstallConfigSnapshot } from '@/app/lib/extension-setup';
import { Button } from '@/app/components/ui/Button';
import { Chip } from '@/app/components/ui/Chip';
import { FilterPill } from '@/app/components/ui/FilterPill';
import { MetricCard } from '@/app/components/ui/MetricCard';
import { PageContent, PageHeader, PageSurface } from '@/app/components/ui/PageLayout';
import { PressableCard } from '@/app/components/ui/PressableCard';
import { SegmentedTabs } from '@/app/components/ui/SegmentedTabs';
import { cn } from '@/app/lib/cn';
import { INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE } from '@/app/lib/ui-interactions';
import { SkillStoreAdminSheet } from './SkillStoreAdminSheet';
import { SkillStoreDetailSheet } from './SkillStoreDetailSheet';
import { SkillStoreImportSheet } from './SkillStoreImportSheet';
import { SkillGlyph, skillTagClassName } from './SkillStoreVisuals';
import { ExtensionInstallConfigModal } from '@/app/components/extensions/ExtensionInstallConfigModal';

export type SkillStoreViewPreset = 'all' | 'finance' | 'foundation';

const storeTabs = [
  { id: 'store', label: '技能库' },
  { id: 'myskills', label: '我的技能' },
] as const;

const categories: Array<{ id: SkillStoreCategoryId; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'official', label: '官方预置' },
  { id: 'a-share', label: 'A股' },
  { id: 'us-stock', label: '美股' },
  { id: 'data', label: '数据工具' },
  { id: 'research', label: '研究分析' },
  { id: 'portfolio', label: '组合与风险' },
  { id: 'report', label: '报告生成' },
  { id: 'general', label: '通用工具' },
];

type ActiveTab = (typeof storeTabs)[number]['id'];
type SkillInstallFilter = 'all' | 'installed' | 'available';
type SkillDisplayStatus = 'builtin' | 'installed' | 'available' | 'installing' | 'failed';

const installFilters: Array<{ id: SkillInstallFilter; label: string }> = [
  { id: 'all', label: '全部状态' },
  { id: 'installed', label: '已安装' },
  { id: 'available', label: '未安装' },
];

const tagFilterPriority = [
  '基础',
  '基础办公',
  '办公',
  'A股',
  '美股',
  'ESG',
  '量化',
  '因子',
  '估值',
  '财报分析',
  '运营增长',
  '自媒体',
  '超级个体',
  '办公效率',
  '风险管理',
  '行业轮动',
  '数据工具',
] as const;

const hiddenQuickFilterTags = new Set(['金融', '通用', '技能', '工具包', '研究报告']);
const FINANCE_TAG_KEYWORDS = [
  '财经',
  '金融',
  '投资',
  '股票',
  '股市',
  'a股',
  '美股',
  '港股',
  '基金',
  '债券',
  '期权',
  '量化',
  '因子',
  '财报',
  '研报',
  '研究报告',
  '市场',
  '行业',
  '宏观',
  '组合',
  '风控',
  '风险',
  '回撤',
  '估值',
  '交易',
  '加密',
  '币圈',
  'esg',
] as const;
const FOUNDATION_TAG_KEYWORDS = [
  '基础',
  '基础办公',
  '办公',
  '办公效率',
  '通用',
  '文档',
  '表格',
  '电子表格',
  'pdf',
  'docx',
  'xlsx',
  '演示',
  'ppt',
  '幻灯片',
  '搜索',
  '自动化',
  '协同',
  '知识库',
  '任务管理',
  '日程',
  '总结',
  '内容创作',
  '视频',
  'productivity',
  'automation',
  'search',
  'documentation',
  'document',
  'documents',
  'office',
  'excel',
  'word',
  'pptx',
  'slides',
  'presentation',
  'email',
  'calendar',
  'workflow',
  'knowledge',
  'notes',
  'markdown',
  'converter',
  'file',
  'files',
  'spreadsheet',
  'docs',
  'deck',
  'meeting',
  'meetings',
  'schedule',
  'planning',
  'todo',
  'base',
] as const;
const ALL_SKILL_INITIAL_LIMIT = 120;
const SPECIALIZED_INITIAL_LIMIT = 300;

function matchesCategory(skill: SkillStoreItem, categoryId: SkillStoreCategoryId): boolean {
  if (categoryId === 'all') return true;
  if (categoryId === 'official') return skill.official;
  if (categoryId === 'a-share') return skill.market === 'A股';
  if (categoryId === 'us-stock') return skill.market === '美股';
  return skill.categoryId === categoryId;
}

function matchesInstallFilter(skill: SkillStoreItem, filter: SkillInstallFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'installed') return skill.installed || skill.source === 'bundled';
  return !skill.installed && skill.source !== 'bundled';
}

function resolveDisplayStatus(skill: SkillStoreItem, actionLoading: boolean, installFailed: boolean): SkillDisplayStatus {
  if (installFailed) return 'failed';
  if (skill.source === 'bundled') return 'builtin';
  if (skill.installed) return 'installed';
  if (actionLoading) return 'installing';
  return 'available';
}

function formatDownloadCount(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  if (value >= 10000) {
    const compact = value >= 100000 ? Math.round(value / 10000).toString() : (value / 10000).toFixed(1).replace(/\.0$/, '');
    return `${compact} 万下载`;
  }
  return `${value.toLocaleString('zh-CN')} 下载`;
}

function compareSkillsByPopularity(left: SkillStoreItem, right: SkillStoreItem): number {
  if (left.featured !== right.featured) {
    return left.featured ? -1 : 1;
  }

  const leftDownloads = left.downloadCount ?? -1;
  const rightDownloads = right.downloadCount ?? -1;
  if (leftDownloads !== rightDownloads) {
    return rightDownloads - leftDownloads;
  }

  if (left.source !== right.source) {
    if (left.source === 'bundled') return -1;
    if (right.source === 'bundled') return 1;
  }

  return left.name.localeCompare(right.name, 'zh-CN');
}

function normalizeSkillTag(value: string): string {
  return value.trim().toLowerCase();
}

function skillHasTagKeyword(skill: SkillStoreItem, keywords: readonly string[]): boolean {
  const normalizedTags = skill.tags.map(normalizeSkillTag);
  return normalizedTags.some((tag) => keywords.some((keyword) => tag.includes(keyword)));
}

function isFinanceSkill(skill: SkillStoreItem): boolean {
  return skillHasTagKeyword(skill, FINANCE_TAG_KEYWORDS);
}

function isFoundationSkill(skill: SkillStoreItem): boolean {
  return skillHasTagKeyword(skill, FOUNDATION_TAG_KEYWORDS);
}

function applySkillPreset<T extends SkillStoreItem>(items: T[], preset: SkillStoreViewPreset): T[] {
  if (preset === 'all') {
    return items;
  }
  if (preset === 'finance') {
    return items.filter(isFinanceSkill);
  }
  return items
    .filter(isFoundationSkill)
    .sort(compareSkillsByPopularity);
}

function SkillStatusBadge({ status }: {status: SkillDisplayStatus}) {
  if (status === 'builtin') {
    return (
      <span className="rounded-md border border-[rgba(201,169,97,0.22)] bg-[rgba(201,169,97,0.12)] px-2 py-0.5 text-[11px] text-[rgb(155,112,39)] dark:border-[rgba(201,169,97,0.20)] dark:bg-[rgba(201,169,97,0.16)] dark:text-[#f1d59c]">
        默认已安装
      </span>
    );
  }
  if (status === 'installed') {
    return (
      <span className="rounded-md border border-[rgba(34,197,94,0.18)] bg-[rgba(34,197,94,0.10)] px-2 py-0.5 text-[11px] text-[rgb(21,128,61)] dark:border-[rgba(111,221,149,0.20)] dark:bg-[rgba(34,197,94,0.18)] dark:text-[#c7f9d7]">
        已安装
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="rounded-md border border-[rgba(239,68,68,0.18)] bg-[rgba(239,68,68,0.10)] px-2 py-0.5 text-[11px] text-[rgb(185,28,28)] dark:border-[rgba(248,113,113,0.20)] dark:bg-[rgba(239,68,68,0.18)] dark:text-[#fecaca]">
        安装失败
      </span>
    );
  }
  if (status === 'installing') {
    return (
      <span className="rounded-md border border-[rgba(201,169,97,0.22)] bg-[rgba(201,169,97,0.12)] px-2 py-0.5 text-[11px] text-[rgb(155,112,39)] dark:border-[rgba(201,169,97,0.20)] dark:bg-[rgba(201,169,97,0.16)] dark:text-[#f1d59c]">
        安装中
      </span>
    );
  }
  return (
    <span className="rounded-md border border-[var(--border-default)] bg-transparent px-2 py-0.5 text-[11px] text-[var(--text-muted)]">
      未安装
    </span>
  );
}

function FeaturedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-[rgba(201,169,97,0.24)] bg-[rgba(201,169,97,0.12)] px-2 py-0.5 text-[11px] text-[rgb(155,112,39)] dark:border-[rgba(201,169,97,0.22)] dark:bg-[rgba(201,169,97,0.16)] dark:text-[#f1d59c]">
      <Sparkles className="h-3 w-3" />
      官方精选
    </span>
  );
}

function SourceBadge({ sourceLabel }: {sourceLabel: string}) {
  if (sourceLabel === '云端技能') {
    return (
      <span className="rounded-md border border-[rgba(74,107,138,0.16)] bg-[rgba(74,107,138,0.10)] px-2 py-0.5 text-[11px] text-[#4A6B8A] dark:border-[rgba(125,168,208,0.18)] dark:bg-[rgba(74,107,138,0.16)] dark:text-[#b7d0e5]">
        {sourceLabel}
      </span>
    );
  }
  if (sourceLabel === '我的导入') {
    return (
      <span className="rounded-md border border-[rgba(90,117,102,0.16)] bg-[rgba(90,117,102,0.10)] px-2 py-0.5 text-[11px] text-[#5A7566] dark:border-[rgba(122,149,134,0.18)] dark:bg-[rgba(90,117,102,0.16)] dark:text-[#c8ded0]">
        {sourceLabel}
      </span>
    );
  }
  return (
    <span className="rounded-md border border-[var(--border-default)] bg-[var(--bg-hover)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]">
      {sourceLabel}
    </span>
  );
}

function SkillCard({
  skill,
  adminMode,
  actionLoading,
  installFailed,
  onAction,
  onStartConversation,
  onOpenDetail,
  onEdit,
}: {
  skill: SkillStoreItem;
  adminMode: boolean;
  actionLoading: boolean;
  installFailed: boolean;
  onAction: (skill: SkillStoreItem) => void;
  onStartConversation: (skill: SkillStoreItem) => void;
  onOpenDetail: (skill: SkillStoreItem) => void;
  onEdit: (skill: SkillStoreItem) => void;
}) {
  const status = resolveDisplayStatus(skill, actionLoading, installFailed);
  const showInstallAction = skill.source !== 'bundled' && !adminMode;
  const needsSetup = skill.setupSchema != null && skill.setupStatus !== 'configured';
  const canStartConversation =
    !actionLoading && !installFailed && !needsSetup && (skill.source === 'bundled' || skill.installed);
  const actionLabel =
    status === 'failed'
      ? '重试安装'
      : needsSetup
        ? '配置'
      : canStartConversation
        ? '对话'
        : status === 'installing'
          ? '安装中…'
          : status === 'builtin'
            ? '对话'
            : '安装';
  const actionVariant = status === 'failed' ? 'danger' : canStartConversation ? 'secondary' : 'primary';
  const actionDisabled = status === 'installing';
  const downloadLabel = formatDownloadCount(skill.downloadCount);

  return (
    <PressableCard
      as="article"
      interactive={!adminMode}
      onClick={
        !adminMode
          ? () => {
              onOpenDetail(skill);
            }
          : undefined
      }
      className={cn(
        'flex h-full flex-col rounded-lg border-[var(--border-default)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-sm)]',
        skill.featured &&
          'border-[rgba(201,169,97,0.24)] bg-[linear-gradient(180deg,rgba(255,251,242,0.98),rgba(252,251,248,0.96))] dark:bg-[linear-gradient(180deg,rgba(39,31,18,0.42),rgba(24,21,18,0.96))]',
        !adminMode && 'hover:border-[rgba(201,169,97,0.22)] hover:shadow-[var(--shadow-md)]',
      )}
    >
      <div className="mb-3 flex items-start gap-3">
        <SkillGlyph skill={skill} className="h-11 w-11 rounded-[14px]" iconClassName="h-5 w-5" />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            {skill.featured ? <FeaturedBadge /> : null}
          </div>
          <h3 className="line-clamp-1 text-[15px] font-medium leading-snug text-[var(--text-primary)]">{skill.name}</h3>
          <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">{skill.description}</p>
        </div>
      </div>

      <div className="mt-auto space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {skill.tags.slice(0, 3).map((tag) => (
              <span key={tag} className={cn('rounded px-2 py-0.5 text-[11px]', skillTagClassName(tag, { flat: true }))}>
                {tag}
              </span>
            ))}
          </div>
          {downloadLabel ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--border-default)] bg-[var(--bg-hover)] px-2 py-1 text-[11px] text-[var(--text-secondary)]">
              <Download className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              {downloadLabel}
            </span>
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--border-default)] pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <SourceBadge sourceLabel={adminMode && skill.source === 'bundled' ? '系统预置' : skill.sourceLabel} />
            <SkillStatusBadge status={status} />
            {needsSetup ? <Chip tone="warning">需配置</Chip> : null}
          </div>

          {adminMode ? (
            <Button
              variant="ghost"
              size="sm"
              className="rounded-md px-3 py-1.5 text-[13px] font-normal shadow-none"
              leadingIcon={<PencilLine className="h-3.5 w-3.5" />}
              onClick={(event) => {
                event.stopPropagation();
                onEdit(skill);
              }}
            >
              编辑
            </Button>
          ) : (
            <Button
              variant={actionVariant}
              size="sm"
              disabled={actionDisabled}
              leadingIcon={canStartConversation ? <MessageSquare className="h-4 w-4" /> : undefined}
              className={cn(
                'rounded-md px-4 py-1.5 text-[13px] font-normal shadow-none',
                (status === 'installed' || status === 'builtin') &&
                  'border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-muted)]',
              )}
              onClick={(event) => {
                event.stopPropagation();
                if (canStartConversation) {
                  onStartConversation(skill);
                } else if (showInstallAction) {
                  onAction(skill);
                } else {
                  onOpenDetail(skill);
                }
              }}
            >
              {actionLabel}
            </Button>
          )}
        </div>
      </div>
    </PressableCard>
  );
}

function EmptyState({ title, description }: {title: string; description: string}) {
  return (
    <div className="py-16 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-hover)]">
        <Package className="h-7 w-7 text-[var(--text-muted)]" />
      </div>
      <div className="mb-1 text-[15px] font-medium text-[var(--text-primary)]">{title}</div>
      <div className="text-[13px] text-[var(--text-secondary)]">{description}</div>
    </div>
  );
}

function SkillGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-sm)]"
        >
          <div className="mb-4 flex items-start gap-3">
            <div className="h-11 w-11 animate-pulse rounded-[14px] bg-[var(--bg-hover)]" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-28 animate-pulse rounded bg-[var(--bg-hover)]" />
              <div className="h-3 w-full animate-pulse rounded bg-[var(--bg-hover)]" />
              <div className="h-3 w-4/5 animate-pulse rounded bg-[var(--bg-hover)]" />
            </div>
          </div>
          <div className="mb-4 flex gap-2">
            <div className="h-6 w-14 animate-pulse rounded bg-[var(--bg-hover)]" />
            <div className="h-6 w-16 animate-pulse rounded bg-[var(--bg-hover)]" />
          </div>
          <div className="flex items-center justify-between border-t border-[var(--border-default)] pt-3">
            <div className="h-6 w-24 animate-pulse rounded bg-[var(--bg-hover)]" />
            <div className="h-8 w-20 animate-pulse rounded bg-[var(--bg-hover)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function mergeCatalogItems<T extends {slug: string; name: string}>(current: T[], incoming: T[]): T[] {
  const merged = new Map<string, T>();
  for (const item of current) {
    merged.set(item.slug, item);
  }
  for (const item of incoming) {
    merged.set(item.slug, item);
  }
  return Array.from(merged.values()).sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
}

function formatSyncTimestamp(value: string | null): string {
  if (!value) return '未运行';
  try {
    return new Date(value).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function readSyncSummaryNumber(summary: Record<string, unknown>, key: string): number {
  const value = summary[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function syncRunTone(status: SkillSyncRunItem['status']): 'success' | 'warning' | 'danger' | 'outline' {
  if (status === 'succeeded') return 'success';
  if (status === 'partial_failed') return 'warning';
  if (status === 'failed') return 'danger';
  return 'outline';
}

export function SkillStoreView({
  client,
  accessToken,
  authBaseUrl,
  authenticated,
  currentUser,
  onRequestAuth,
  onStartConversation,
  preset = 'all',
  title,
  description = '统一查看系统预置能力与云端技能，安装后可自动同步到设备',
}: {
  client: IClawClient;
  accessToken: string | null;
  authBaseUrl: string;
  authenticated: boolean;
  currentUser: {
    role?: 'user' | 'admin' | 'super_admin' | null;
  } | null;
  onRequestAuth: (mode?: 'login' | 'register', nextView?: 'account' | null) => void;
  onStartConversation: (skill: SkillStoreItem) => void;
  preset?: SkillStoreViewPreset;
  title: string;
  description?: string;
}) {
  const catalogTagKeywords = useMemo(
    () =>
      preset === 'finance'
        ? [...FINANCE_TAG_KEYWORDS]
        : preset === 'foundation'
          ? [...FOUNDATION_TAG_KEYWORDS]
          : [],
    [preset],
  );
  const [initialCatalogSnapshot] = useState(() => readSkillStoreCatalogSnapshot({ tagKeywords: catalogTagKeywords }));
  const [activeTab, setActiveTab] = useState<ActiveTab>('store');
  const [activeCategory, setActiveCategory] = useState<SkillStoreCategoryId>('all');
  const [activeInstallFilter, setActiveInstallFilter] = useState<SkillInstallFilter>('all');
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [skills, setSkills] = useState<SkillStoreItem[]>(() => initialCatalogSnapshot?.items ?? []);
  const [adminSkills, setAdminSkills] = useState<AdminSkillStoreItem[]>([]);
  const [catalogTotal, setCatalogTotal] = useState<number>(() => initialCatalogSnapshot?.total ?? 0);
  const [catalogHasMore, setCatalogHasMore] = useState<boolean>(() => Boolean(initialCatalogSnapshot?.hasMore));
  const [catalogNextOffset, setCatalogNextOffset] = useState<number | null>(() => initialCatalogSnapshot?.nextOffset ?? null);
  const [adminTotal, setAdminTotal] = useState(0);
  const [adminHasMore, setAdminHasMore] = useState(false);
  const [adminNextOffset, setAdminNextOffset] = useState<number | null>(null);
  const [prefetchedCatalogPage, setPrefetchedCatalogPage] = useState<SkillStoreCatalogPage | null>(null);
  const [prefetchedAdminPage, setPrefetchedAdminPage] = useState<AdminSkillStoreCatalogPage | null>(null);
  const [initialHydrated, setInitialHydrated] = useState(Boolean(initialCatalogSnapshot));
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [installingSlug, setInstallingSlug] = useState<string | null>(null);
  const [installErrorSlugs, setInstallErrorSlugs] = useState<string[]>([]);
  const [adminMode, setAdminMode] = useState(false);
  const [adminCapable, setAdminCapable] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<SkillStoreItem | null>(null);
  const [selectedAdminSkill, setSelectedAdminSkill] = useState<AdminSkillStoreItem | null>(null);
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminDeleting, setAdminDeleting] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [importSheetOpen, setImportSheetOpen] = useState(false);
  const [githubImportUrl, setGithubImportUrl] = useState('');
  const [githubImportLoading, setGithubImportLoading] = useState(false);
  const [localImportLoading, setLocalImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [syncSources, setSyncSources] = useState<SkillSyncSourceItem[]>([]);
  const [syncRuns, setSyncRuns] = useState<SkillSyncRunItem[]>([]);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncBusySourceId, setSyncBusySourceId] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [setupSkill, setSetupSkill] = useState<SkillStoreItem | null>(null);
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [setupMode, setSetupMode] = useState<'install' | 'configure'>('install');
  const [setupInitialConfig, setSetupInitialConfig] = useState<ExtensionInstallConfigSnapshot | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);

  const adminRoleKnown = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
  const shouldProbeAdminAccess = Boolean(accessToken) && !adminRoleKnown && currentUser?.role == null;
  const isAdmin = adminRoleKnown || adminCapable;
  const catalogPageSize = preset === 'all' ? ALL_SKILL_INITIAL_LIMIT : SPECIALIZED_INITIAL_LIMIT;
  const allowLoadMore = true;

  const applyStorePage = (page: SkillStoreCatalogPage, options?: {append?: boolean}) => {
    setSkills((current) => (options?.append ? mergeCatalogItems(current, page.items) : page.items));
    setCatalogTotal(page.total);
    setCatalogHasMore(page.hasMore);
    setCatalogNextOffset(page.nextOffset);
    setPrefetchedCatalogPage(null);
    setInitialHydrated(true);
  };

  const applyAdminPage = (page: AdminSkillStoreCatalogPage, options?: {append?: boolean}) => {
    setAdminSkills((current) => (options?.append ? mergeCatalogItems(current, page.items) : page.items));
    setAdminTotal(page.total);
    setAdminHasMore(page.hasMore);
    setAdminNextOffset(page.nextOffset);
    setPrefetchedAdminPage(null);
  };

  const refreshCatalog = async (options?: {preferAdmin?: boolean}) => {
    const preferAdmin = Boolean(options?.preferAdmin);
    setLoading(true);
    try {
      const catalogPromise = loadSkillStoreCatalogPage({
        client,
        accessToken,
        offset: 0,
        limit: catalogPageSize,
        tagKeywords: catalogTagKeywords,
      });
      const adminCatalogPromise =
        accessToken && (preferAdmin || adminRoleKnown || shouldProbeAdminAccess)
          ? loadAdminSkillStoreCatalogPage({ client, accessToken, offset: 0, limit: catalogPageSize })
              .then((page) => ({ page, capable: true }))
              .catch(() => ({ page: null, capable: false }))
          : Promise.resolve({ page: null, capable: adminRoleKnown });
      const [catalogPage, adminResult] = await Promise.all([catalogPromise, adminCatalogPromise]);
      applyStorePage(catalogPage);
      if (adminResult.page) {
        applyAdminPage(adminResult.page);
      } else {
        setAdminSkills([]);
        setAdminTotal(0);
        setAdminHasMore(false);
        setAdminNextOffset(null);
        setPrefetchedAdminPage(null);
      }
      setAdminCapable(adminResult.capable);
      setError(null);
      return { catalog: catalogPage.items, adminCatalog: adminResult.page?.items || [] };
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!initialCatalogSnapshot) {
        try {
          const bundledCatalog = await loadBundledSkillCatalog();
          if (!cancelled) {
            setSkills((current) => (current.length > 0 ? current : bundledCatalog));
            setCatalogTotal((current) => (current > 0 ? current : bundledCatalog.length));
            setInitialHydrated(true);
          }
        } catch {
          // Ignore bundled fallback failures and continue with live fetch.
        }
      }

      setLoading(true);
      try {
        const catalogPromise = loadSkillStoreCatalogPage({
          client,
          accessToken,
          offset: 0,
          limit: catalogPageSize,
          tagKeywords: catalogTagKeywords,
        });
        const adminCatalogPromise =
          accessToken && (adminRoleKnown || shouldProbeAdminAccess)
            ? loadAdminSkillStoreCatalogPage({ client, accessToken, offset: 0, limit: catalogPageSize })
                .then((page) => ({ page, capable: true }))
                .catch(() => ({ page: null, capable: false }))
            : Promise.resolve({ page: null, capable: adminRoleKnown });
        const [catalog, adminResult] = await Promise.all([catalogPromise, adminCatalogPromise]);
        if (!cancelled) {
          applyStorePage(catalog);
          if (adminResult.page) {
            applyAdminPage(adminResult.page);
          } else {
            setAdminSkills([]);
            setAdminTotal(0);
            setAdminHasMore(false);
            setAdminNextOffset(null);
            setPrefetchedAdminPage(null);
          }
          setAdminCapable(adminResult.capable);
          setError(null);
        }
      } catch (nextError) {
        if (!cancelled) {
          setInitialHydrated(true);
          setError(nextError instanceof Error ? nextError.message : 'skills catalog unavailable');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken, adminRoleKnown, catalogPageSize, catalogTagKeywords, client, preset, shouldProbeAdminAccess]);

  useEffect(() => {
    if (!selectedSkill) return;
    setSelectedSkill(skills.find((item) => item.slug === selectedSkill.slug) || null);
  }, [selectedSkill, skills]);

  useEffect(() => {
    if (!selectedAdminSkill) return;
    setSelectedAdminSkill(adminSkills.find((item) => item.slug === selectedAdminSkill.slug) || null);
  }, [adminSkills, selectedAdminSkill]);

  useEffect(() => {
    if (adminMode || !allowLoadMore || !catalogHasMore || catalogNextOffset == null) {
      setPrefetchedCatalogPage(null);
      return;
    }
    if (prefetchedCatalogPage?.offset === catalogNextOffset) {
      return;
    }

    let cancelled = false;
    void loadSkillStoreCatalogPage({
      client,
      accessToken,
      offset: catalogNextOffset,
      limit: catalogPageSize,
      tagKeywords: catalogTagKeywords,
    })
      .then((page) => {
        if (!cancelled && page.offset === catalogNextOffset) {
          setPrefetchedCatalogPage(page);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [accessToken, adminMode, allowLoadMore, catalogHasMore, catalogNextOffset, catalogPageSize, catalogTagKeywords, client, prefetchedCatalogPage?.offset]);

  useEffect(() => {
    if (!adminMode || !allowLoadMore || !accessToken || !adminHasMore || adminNextOffset == null) {
      setPrefetchedAdminPage(null);
      return;
    }
    if (prefetchedAdminPage?.offset === adminNextOffset) {
      return;
    }

    let cancelled = false;
    void loadAdminSkillStoreCatalogPage({ client, accessToken, offset: adminNextOffset, limit: catalogPageSize })
      .then((page) => {
        if (!cancelled && page.offset === adminNextOffset) {
          setPrefetchedAdminPage(page);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [accessToken, adminHasMore, adminMode, adminNextOffset, allowLoadMore, catalogPageSize, client, prefetchedAdminPage?.offset]);

  useEffect(
    () =>
      subscribeSkillStoreEvents(
        () => {
          void refreshCatalog({ preferAdmin: adminMode }).catch(() => {});
        },
        (message) => {
          setError(message);
        },
      ),
    [accessToken, adminMode, client, selectedAdminSkill, selectedSkill],
  );

  useEffect(() => {
    if (!isAdmin && adminMode) {
      setAdminMode(false);
      setSelectedAdminSkill(null);
      setAdminError(null);
    }
  }, [adminMode, isAdmin]);

  useEffect(() => {
    if (adminMode && selectedSkill) {
      setSelectedSkill(null);
    }
  }, [adminMode, selectedSkill]);

  useEffect(() => {
    if (!adminMode && selectedAdminSkill) {
      setSelectedAdminSkill(null);
      setAdminError(null);
    }
  }, [adminMode, selectedAdminSkill]);

  useEffect(() => {
    if (!adminMode || !isAdmin || !accessToken) {
      setSyncSources([]);
      setSyncRuns([]);
      setSyncBusySourceId(null);
      setSyncError(null);
      setSyncLoading(false);
      return;
    }

    let cancelled = false;

    const loadSyncData = async () => {
      setSyncLoading(true);
      try {
        const [sources, runs] = await Promise.all([
          loadSkillSyncSources({ client, accessToken }),
          loadSkillSyncRuns({ client, accessToken, limit: 12 }),
        ]);
        if (!cancelled) {
          setSyncSources(sources);
          setSyncRuns(runs);
          setSyncError(null);
        }
      } catch (nextError) {
        if (!cancelled) {
          setSyncError(nextError instanceof Error ? nextError.message : '同步记录读取失败');
        }
      } finally {
        if (!cancelled) {
          setSyncLoading(false);
        }
      }
    };

    void loadSyncData();
    return () => {
      cancelled = true;
    };
  }, [accessToken, adminMode, client, isAdmin]);

  const performInstall = async (
    skill: SkillStoreItem,
    options?: {setupValues?: Record<string, unknown>; secretValues?: Record<string, string>},
  ) => {
    setInstallingSlug(skill.slug);
    setError(null);
    try {
      await installSkillFromStore({
        client,
        accessToken,
        item: skill,
        setupValues: options?.setupValues,
        secretValues: options?.secretValues,
      });
      setInstallErrorSlugs((current) => current.filter((slug) => slug !== skill.slug));
      await refreshCatalog({ preferAdmin: adminMode });
    } catch (nextError) {
      if (nextError instanceof Error && nextError.message === 'AUTH_REQUIRED') {
        onRequestAuth('login');
      } else {
        setInstallErrorSlugs((current) => (current.includes(skill.slug) ? current : [...current, skill.slug]));
        setError(nextError instanceof Error ? nextError.message : '下载安装失败');
        throw nextError;
      }
    } finally {
      setInstallingSlug(null);
    }
  };

  const openSetupModal = async (skill: SkillStoreItem, mode: 'install' | 'configure') => {
    if (!accessToken) {
      onRequestAuth('login');
      return;
    }
    setSetupSkill(skill);
    setSetupMode(mode);
    setSetupInitialConfig(null);
    setSetupModalOpen(true);
    if (!skill.userInstalled && mode === 'install') {
      return;
    }
    setSetupLoading(true);
    try {
      const config = await loadExtensionInstallConfig({
        client,
        accessToken,
        extensionType: 'skill',
        extensionKey: skill.slug,
      });
      setSetupInitialConfig(config);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '读取安装配置失败');
    } finally {
      setSetupLoading(false);
    }
  };

  const handleInstall = async (skill: SkillStoreItem) => {
    if (skill.source !== 'cloud') {
      return;
    }
    if (!authenticated || !accessToken) {
      onRequestAuth('login');
      return;
    }
    if (skill.installed) {
      if (skill.setupSchema) {
        await openSetupModal(skill, 'configure');
      }
      return;
    }
    if (skill.setupSchema) {
      await openSetupModal(skill, 'install');
      return;
    }
    await performInstall(skill);
  };

  const handleStartConversation = (skill: SkillStoreItem) => {
    if (!authenticated) {
      onRequestAuth('login');
      return;
    }
    setSelectedSkill(null);
    onStartConversation(skill);
  };

  const handleSetupSubmit = async (payload: {
    setupValues: Record<string, unknown>;
    secretValues: Record<string, string>;
  }) => {
    if (!setupSkill || !accessToken) {
      return;
    }
    setSetupLoading(true);
    try {
      if (setupMode === 'install') {
        await performInstall(setupSkill, payload);
      } else {
        await saveExtensionInstallConfig({
          client,
          accessToken,
          extensionType: 'skill',
          extensionKey: setupSkill.slug,
          setupValues: payload.setupValues,
          secretValues: payload.secretValues,
        });
        await refreshCatalog({ preferAdmin: adminMode });
      }
      setSetupModalOpen(false);
      setSetupSkill(null);
      setSetupInitialConfig(null);
    } catch {
      // Error state is surfaced by performInstall/saveExtensionInstallConfig callers.
    } finally {
      setSetupLoading(false);
    }
  };

  const handleAdminSave = async (payload: {
    slug: string;
    name: string;
    description: string;
    featured: boolean;
    market: string | null;
    category: string | null;
    skillType: string | null;
    publisher: string;
    distribution: 'bundled' | 'cloud';
    active: boolean;
    tags: string[];
  }) => {
    if (!isAdmin || !accessToken) {
      setAdminError('需要超管登录');
      return;
    }
    setAdminSaving(true);
    setAdminError(null);
    try {
      await saveAdminSkillStoreEntry({
        client,
        accessToken,
        item: payload,
      });
      const refreshed = await refreshCatalog({ preferAdmin: true });
      setSelectedAdminSkill(refreshed.adminCatalog.find((item) => item.slug === payload.slug) || null);
    } catch (nextError) {
      setAdminError(nextError instanceof Error ? nextError.message : '保存失败');
    } finally {
      setAdminSaving(false);
    }
  };

  const handleAdminDelete = async (slug: string) => {
    if (!isAdmin || !accessToken) {
      setAdminError('需要超管登录');
      return;
    }
    setAdminDeleting(true);
    setAdminError(null);
    try {
      await deleteAdminSkillStoreEntry({ client, accessToken, slug });
      await refreshCatalog({ preferAdmin: true });
      setSelectedAdminSkill(null);
    } catch (nextError) {
      setAdminError(nextError instanceof Error ? nextError.message : '删除失败');
    } finally {
      setAdminDeleting(false);
    }
  };

  const handleOpenImport = () => {
    if (!authenticated || !accessToken) {
      onRequestAuth('login');
      return;
    }
    setImportError(null);
    setImportSheetOpen(true);
  };

  const handleGithubImport = async () => {
    if (!accessToken) {
      onRequestAuth('login');
      return;
    }
    setGithubImportLoading(true);
    setImportError(null);
    try {
      await importSkillFromGithub({
        authBaseUrl,
        accessToken,
        repoUrl: githubImportUrl,
      });
      setImportSheetOpen(false);
      setGithubImportUrl('');
      await refreshCatalog({ preferAdmin: adminMode });
      setActiveTab('myskills');
    } catch (nextError) {
      const message =
        nextError instanceof Error && nextError.message === 'AUTH_REQUIRED'
          ? '需要登录后才能导入技能'
          : nextError instanceof Error
            ? nextError.message
            : '导入失败';
      setImportError(message);
    } finally {
      setGithubImportLoading(false);
    }
  };

  const handleLocalImport = async () => {
    if (!accessToken) {
      onRequestAuth('login');
      return;
    }
    setLocalImportLoading(true);
    setImportError(null);
    try {
      const result = await importSkillFromLocalDirectory({
        authBaseUrl,
        accessToken,
      });
      if (result) {
        setImportSheetOpen(false);
        await refreshCatalog({ preferAdmin: adminMode });
        setActiveTab('myskills');
      }
    } catch (nextError) {
      setImportError(nextError instanceof Error ? nextError.message : '导入失败');
    } finally {
      setLocalImportLoading(false);
    }
  };

  const handleRunSync = async (sourceId: string) => {
    if (!isAdmin || !accessToken) {
      setSyncError('需要超管登录');
      return;
    }

    setSyncBusySourceId(sourceId);
    setSyncError(null);
    try {
      await runSkillSync({ client, accessToken, sourceId });
      const [sources, runs] = await Promise.all([
        loadSkillSyncSources({ client, accessToken }),
        loadSkillSyncRuns({ client, accessToken, limit: 12 }),
      ]);
      await refreshCatalog({ preferAdmin: true });
      setSyncSources(sources);
      setSyncRuns(runs);
      setActiveTab('store');
    } catch (nextError) {
      setSyncError(nextError instanceof Error ? nextError.message : '同步执行失败');
    } finally {
      setSyncBusySourceId(null);
    }
  };

  const handleLoadMore = async () => {
    if (adminMode) {
      if (!allowLoadMore || !accessToken || !adminHasMore || adminNextOffset == null || loadingMore) {
        return;
      }
      setLoadingMore(true);
      setError(null);
      try {
        const page =
          prefetchedAdminPage?.offset === adminNextOffset
            ? prefetchedAdminPage
            : await loadAdminSkillStoreCatalogPage({
                client,
                accessToken,
                offset: adminNextOffset,
                limit: catalogPageSize,
              });
        applyAdminPage(page, { append: true });
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : '技能目录读取失败');
      } finally {
        setLoadingMore(false);
      }
      return;
    }

    if (!allowLoadMore || !catalogHasMore || catalogNextOffset == null || loadingMore) {
      return;
    }
    setLoadingMore(true);
    setError(null);
    try {
      const page =
        prefetchedCatalogPage?.offset === catalogNextOffset
          ? prefetchedCatalogPage
          : await loadSkillStoreCatalogPage({
              client,
              accessToken,
              offset: catalogNextOffset,
              limit: catalogPageSize,
              tagKeywords: catalogTagKeywords,
            });
      applyStorePage(page, { append: true });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '技能目录读取失败');
    } finally {
      setLoadingMore(false);
    }
  };

  const visibleSkills = useMemo(
    () => applySkillPreset(adminMode ? adminSkills : skills, preset),
    [adminMode, adminSkills, preset, skills],
  );

  const availableQuickTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const skill of visibleSkills) {
      if (activeTab === 'myskills' && !skill.userInstalled) {
        continue;
      }
      if (!matchesCategory(skill, activeCategory)) {
        continue;
      }
      if (activeTab === 'store' && !matchesInstallFilter(skill, activeInstallFilter)) {
        continue;
      }
      if (featuredOnly && !skill.featured) {
        continue;
      }
      for (const tag of skill.tags) {
        const normalized = tag.trim();
        if (!normalized || hiddenQuickFilterTags.has(normalized)) {
          continue;
        }
        counts.set(normalized, (counts.get(normalized) || 0) + 1);
      }
    }

    const priorityIndex = new Map<string, number>(tagFilterPriority.map((tag, index) => [tag, index]));
    return Array.from(counts.entries())
      .sort((left, right) => {
        const leftPriority = priorityIndex.get(left[0]) ?? Number.MAX_SAFE_INTEGER;
        const rightPriority = priorityIndex.get(right[0]) ?? Number.MAX_SAFE_INTEGER;
        if (leftPriority !== rightPriority) {
          return leftPriority - rightPriority;
        }
        if (right[1] !== left[1]) {
          return right[1] - left[1];
        }
        return left[0].localeCompare(right[0], 'zh-CN');
      })
      .slice(0, 18)
      .map(([tag]) => tag);
  }, [activeCategory, activeInstallFilter, activeTab, featuredOnly, visibleSkills]);

  useEffect(() => {
    if (activeTags.length === 0) return;
    const nextTags = activeTags.filter((tag) => availableQuickTags.includes(tag));
    if (nextTags.length !== activeTags.length) {
      setActiveTags(nextTags);
    }
  }, [activeTags, availableQuickTags]);

  const filteredSkills = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return visibleSkills
      .filter((skill) => {
        if (activeTab === 'myskills' && !skill.userInstalled) {
          return false;
        }
        if (!matchesCategory(skill, activeCategory)) {
          return false;
        }
        if (activeTab === 'store' && !matchesInstallFilter(skill, activeInstallFilter)) {
          return false;
        }
        if (featuredOnly && !skill.featured) {
          return false;
        }
        if (activeTags.length > 0 && !activeTags.some((tag) => skill.tags.includes(tag))) {
          return false;
        }
        if (!query) {
          return true;
        }
        return [skill.name, skill.description, skill.market, skill.skillType, skill.categoryLabel, ...skill.tags]
          .join(' ')
          .toLowerCase()
          .includes(query);
      })
      .sort(compareSkillsByPopularity);
  }, [activeCategory, activeInstallFilter, activeTab, activeTags, featuredOnly, searchQuery, visibleSkills]);

  const viewSkillCount = visibleSkills.length;
  const backendTotalCount = adminMode ? adminTotal : catalogTotal;
  const totalCount = viewSkillCount;
  const installedCount = visibleSkills.filter((skill) => skill.installed || skill.source === 'bundled').length;
  const builtinCount = visibleSkills.filter((skill) => skill.source === 'bundled').length;
  const featuredCount = visibleSkills.filter((skill) => skill.featured).length;
  const failedCount = installErrorSlugs.length;
  const mySkillsCount = visibleSkills.filter((skill) => skill.userInstalled).length;

  return (
    <PageSurface className="flex-col bg-[var(--bg-page)]">
      <PageContent className="max-w-[1480px] py-5">
        <div className="mb-5">
          <PageHeader
            className="mb-4 gap-2.5"
            title={title}
            description={description}
            contentClassName="space-y-1"
            titleClassName="mt-0 text-[24px] font-semibold tracking-[-0.045em]"
            descriptionClassName="mt-0 text-[12px] leading-5"
            actionsClassName="gap-2"
            actions={
              <>
              <Button variant="secondary" size="sm" className="rounded-lg px-3.5 py-1.5 text-[12px]" onClick={handleOpenImport} leadingIcon={<Upload className="h-3.5 w-3.5" />}>
                导入技能
              </Button>
              {isAdmin ? (
                <Button
                  variant={adminMode ? 'primary' : 'secondary'}
                  size="sm"
                  className="rounded-lg px-3.5 py-1.5 text-[12px]"
                  onClick={() => {
                    setAdminMode((current) => {
                      const next = !current;
                      if (!next) {
                        setSelectedAdminSkill(null);
                        setAdminError(null);
                      } else {
                        setActiveTab('store');
                        void refreshCatalog({ preferAdmin: true }).catch(() => {
                          setError('技能目录读取失败');
                        });
                      }
                      return next;
                    });
                  }}
                  leadingIcon={<ShieldCheck className="h-3.5 w-3.5" />}
                >
                  {adminMode ? '退出超管模式' : '进入超管模式'}
                </Button>
              ) : null}
              <Button
                variant="secondary"
                size="sm"
                className="rounded-lg px-3.5 py-1.5 text-[12px]"
                onClick={() => {
                  void refreshCatalog({ preferAdmin: adminMode }).catch(() => {
                    setError('下载安装失败');
                  });
                }}
                leadingIcon={<RefreshCw className="h-3.5 w-3.5" />}
              >
                刷新技能
              </Button>
              </>
            }
          />

          <div className="mb-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="搜索技能名称或描述..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] py-2.5 pl-11 pr-4 text-[12px] text-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[rgba(201,169,97,0.24)] focus:ring-2 dark:bg-[rgba(255,255,255,0.03)]"
                style={{ ['--tw-ring-color' as string]: 'rgba(201,169,97,0.12)' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              label="视图总数"
              value={totalCount}
              icon={<Package className="h-[18px] w-[18px]" />}
              iconWrapClassName="border-[rgba(201,169,97,0.20)] bg-[rgba(201,169,97,0.12)]"
              iconClassName="text-[rgb(155,112,39)] dark:text-[#f1d59c]"
            />
            <MetricCard
              label="已安装"
              value={installedCount}
              icon={<CheckCircle2 className="h-[18px] w-[18px]" />}
              iconWrapClassName="border-[rgba(34,197,94,0.18)] bg-[rgba(34,197,94,0.10)]"
              iconClassName="text-[rgb(21,128,61)] dark:text-[#c7f9d7]"
            />
            <MetricCard
              label="系统预置"
              value={builtinCount}
              icon={<Download className="h-[18px] w-[18px]" />}
              iconWrapClassName="border-[rgba(74,107,138,0.18)] bg-[rgba(74,107,138,0.10)]"
              iconClassName="text-[#4A6B8A] dark:text-[#b7d0e5]"
            />
            <MetricCard
              label="官方精选"
              value={featuredCount}
              icon={<Sparkles className="h-[18px] w-[18px]" />}
              iconWrapClassName="border-[rgba(201,169,97,0.20)] bg-[rgba(201,169,97,0.12)]"
              iconClassName="text-[rgb(155,112,39)] dark:text-[#f1d59c]"
            />
            <MetricCard
              label="安装失败"
              value={failedCount}
              icon={<AlertCircle className="h-[18px] w-[18px]" />}
              iconWrapClassName="border-[rgba(239,68,68,0.18)] bg-[rgba(239,68,68,0.10)]"
              iconClassName="text-[rgb(185,28,28)] dark:text-[#fecaca]"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-[12px] text-[var(--text-secondary)]">
            <Chip tone="outline">当前视图 {viewSkillCount}</Chip>
            <Chip tone="outline">筛选结果 {filteredSkills.length}</Chip>
            <Chip tone="outline">{adminMode ? `平台目录 ${backendTotalCount}` : `云端目录 ${backendTotalCount}`}</Chip>
            {loading ? (
              <Chip tone="accent" leadingIcon={<LoaderCircle className="h-3.5 w-3.5 animate-spin" />}>
                正在刷新云端技能
              </Chip>
            ) : null}
          </div>

          {adminMode ? (
            <div className="mt-4 rounded-[18px] border border-[rgba(201,169,97,0.18)] bg-[linear-gradient(180deg,rgba(255,251,242,0.98),rgba(252,251,248,0.96))] p-4 shadow-[var(--shadow-sm)] dark:border-[rgba(201,169,97,0.18)] dark:bg-[linear-gradient(180deg,rgba(39,31,18,0.42),rgba(24,21,18,0.96))]">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="text-[15px] font-medium text-[var(--text-primary)]">云端同步控制台</div>
                    <div className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">
                      统一查看同步源、最近运行记录，并直接触发 ClawHub / GitHub 来源同步。
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Chip tone="accent" leadingIcon={<CloudDownload className="h-3.5 w-3.5" />}>
                      来源 {syncSources.length}
                    </Chip>
                    <Chip tone="outline" leadingIcon={<History className="h-3.5 w-3.5" />}>
                      运行 {syncRuns.length}
                    </Chip>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="rounded-lg px-3.5 py-1.5 text-[12px]"
                      disabled={syncLoading}
                      leadingIcon={syncLoading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      onClick={async () => {
                        if (!accessToken) return;
                        setSyncLoading(true);
                        setSyncError(null);
                        try {
                          const [sources, runs] = await Promise.all([
                            loadSkillSyncSources({ client, accessToken }),
                            loadSkillSyncRuns({ client, accessToken, limit: 12 }),
                          ]);
                          setSyncSources(sources);
                          setSyncRuns(runs);
                        } catch (nextError) {
                          setSyncError(nextError instanceof Error ? nextError.message : '同步记录读取失败');
                        } finally {
                          setSyncLoading(false);
                        }
                      }}
                    >
                      刷新记录
                    </Button>
                  </div>
                </div>

                {syncError ? (
                  <div className="rounded-[14px] border border-[rgba(239,68,68,0.16)] bg-[rgba(239,68,68,0.08)] px-4 py-3 text-[12px] leading-5 text-[var(--state-error)]">
                    {syncError}
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                  <div className="rounded-[16px] border border-[var(--border-default)] bg-[var(--bg-card)] p-4 dark:bg-[rgba(255,255,255,0.03)]">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="text-[13px] font-medium text-[var(--text-primary)]">同步来源</div>
                      {syncLoading ? <LoaderCircle className="h-4 w-4 animate-spin text-[var(--text-muted)]" /> : null}
                    </div>
                    <div className="space-y-3">
                      {syncSources.length === 0 ? (
                        <div className="text-[12px] leading-5 text-[var(--text-secondary)]">暂无同步来源</div>
                      ) : (
                        syncSources.map((source) => {
                          const configLimit = typeof source.config.limit === 'number' ? source.config.limit : null;
                          const isFullSync = configLimit === 0;
                          return (
                            <div key={source.id} className="rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-3">
                              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="text-[13px] font-medium text-[var(--text-primary)]">{source.display_name}</div>
                                    <Chip tone={source.active ? 'success' : 'outline'}>{source.active ? '启用中' : '已停用'}</Chip>
                                    <Chip tone={isFullSync ? 'accent' : 'outline'}>{isFullSync ? '全量同步' : `限制 ${configLimit ?? '-'}`}</Chip>
                                  </div>
                                  <div className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">
                                    {source.source_url} · 最近运行 {formatSyncTimestamp(source.last_run_at)}
                                  </div>
                                </div>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  disabled={syncBusySourceId === source.id}
                                  className="rounded-lg px-3.5 py-1.5 text-[12px]"
                                  leadingIcon={
                                    syncBusySourceId === source.id ? (
                                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Play className="h-3.5 w-3.5" />
                                    )
                                  }
                                  onClick={() => void handleRunSync(source.id)}
                                >
                                  {syncBusySourceId === source.id ? '同步中...' : '立即同步'}
                                </Button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="rounded-[16px] border border-[var(--border-default)] bg-[var(--bg-card)] p-4 dark:bg-[rgba(255,255,255,0.03)]">
                    <div className="mb-3 text-[13px] font-medium text-[var(--text-primary)]">最近运行</div>
                    <div className="space-y-3">
                      {syncRuns.length === 0 ? (
                        <div className="text-[12px] leading-5 text-[var(--text-secondary)]">还没有同步记录</div>
                      ) : (
                        syncRuns.slice(0, 6).map((run) => (
                          <div key={run.id} className="rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-[13px] font-medium text-[var(--text-primary)]">{run.display_name}</div>
                              <Chip tone={syncRunTone(run.status)}>{run.status}</Chip>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-3 text-[12px] leading-5 text-[var(--text-secondary)]">
                              <span>开始 {formatSyncTimestamp(run.started_at)}</span>
                              <span>创建 {readSyncSummaryNumber(run.summary, 'created')}</span>
                              <span>更新 {readSyncSummaryNumber(run.summary, 'updated')}</span>
                              <span>跳过 {readSyncSummaryNumber(run.summary, 'skipped')}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mb-5 space-y-3">
          <div className="flex items-center gap-2 border-b border-[var(--border-default)] pb-3">
            <SegmentedTabs
              items={storeTabs.map((tab) => ({
                id: tab.id,
                label: tab.label,
                badge: tab.id === 'myskills' ? mySkillsCount : undefined,
              }))}
              activeId={activeTab}
              onChange={setActiveTab}
            />
            {adminMode ? (
              <span className="ml-2 rounded-md border border-[rgba(201,169,97,0.18)] bg-[rgba(201,169,97,0.10)] px-2.5 py-1 text-[11px] text-[rgb(155,112,39)] dark:border-[rgba(201,169,97,0.20)] dark:bg-[rgba(201,169,97,0.16)] dark:text-[#f1d59c]">
                超管模式
              </span>
            ) : null}
          </div>

          <div className="space-y-3">
            <div>
              <div className="mb-2 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">分类与策展</div>
              <div className="flex flex-wrap gap-1.5">
                <FilterPill active={featuredOnly} onClick={() => setFeaturedOnly((current) => !current)}>
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    官方精选
                  </span>
                </FilterPill>
                {categories.map((category) => (
                  <FilterPill key={category.id} active={activeCategory === category.id} onClick={() => setActiveCategory(category.id)}>
                    {category.label}
                  </FilterPill>
                ))}
              </div>
            </div>

            {availableQuickTags.length ? (
              <div>
                <div className="mb-2 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">标签筛选</div>
                <div className="flex flex-wrap gap-1.5">
                  {availableQuickTags.map((tag) => {
                    const active = activeTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() =>
                          setActiveTags((current) => (current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]))
                        }
                        className={cn(
                          'cursor-pointer rounded-md border px-3 py-1.5 text-[12px] transition-all',
                          SPRING_PRESSABLE,
                          INTERACTIVE_FOCUS_RING,
                          skillTagClassName(tag, { selected: active, flat: true }),
                        )}
                      >
                        {tag}
                      </button>
                    );
                  })}
                  {activeTags.length > 0 ? (
                    <FilterPill onClick={() => setActiveTags([])} className="px-3 py-1.5 text-[12px]">
                      清除
                    </FilterPill>
                  ) : null}
                </div>
              </div>
            ) : null}

            {activeTab === 'store' ? (
              <div>
                <div className="mb-2 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">安装状态</div>
                <div className="flex flex-wrap gap-1.5">
                  {installFilters.map((filter) => (
                    <FilterPill key={filter.id} active={activeInstallFilter === filter.id} onClick={() => setActiveInstallFilter(filter.id)}>
                      {filter.label}
                    </FilterPill>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {error ? (
          <div className="rounded-[18px] border border-[rgba(239,68,68,0.16)] bg-[rgba(239,68,68,0.08)] px-6 py-5 text-sm text-[var(--state-error)]">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-4.5 w-4.5 shrink-0" />
              <div>
                <div className="font-medium">{error === '下载安装失败' ? '下载安装失败' : '技能目录读取失败'}</div>
                <div className="mt-1 text-[13px] leading-6">{error}</div>
              </div>
            </div>
          </div>
        ) : null}

        {!initialHydrated && filteredSkills.length === 0 ? (
          <SkillGridSkeleton />
        ) : filteredSkills.length === 0 ? (
          <EmptyState
            title={searchQuery ? '未找到匹配的技能' : '当前筛选条件下暂无技能'}
            description={searchQuery ? '请尝试调整搜索条件或筛选器' : '请尝试切换分类或标签查看其它技能'}
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredSkills.map((skill) => (
              <SkillCard
                key={skill.slug}
                skill={skill}
                adminMode={adminMode}
                actionLoading={installingSlug === skill.slug}
                installFailed={installErrorSlugs.includes(skill.slug)}
                onAction={handleInstall}
                onStartConversation={handleStartConversation}
                onOpenDetail={(nextSkill) => {
                  if (!adminMode) {
                    setSelectedSkill(nextSkill);
                  }
                }}
                onEdit={(nextSkill) => {
                  if (!adminMode) return;
                  const adminSkill = adminSkills.find((item) => item.slug === nextSkill.slug);
                  if (adminSkill) {
                    setSelectedAdminSkill(adminSkill);
                    setAdminError(null);
                  }
                }}
              />
            ))}
          </div>
        )}

        {!adminMode && allowLoadMore && catalogHasMore ? (
          <div className="mt-6 flex justify-center">
            <Button
              variant="secondary"
              size="sm"
              disabled={loadingMore}
              className="rounded-lg px-5 py-2 text-[13px]"
              leadingIcon={loadingMore ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              onClick={() => void handleLoadMore()}
            >
              {loadingMore ? '加载中...' : '加载更多'}
            </Button>
          </div>
        ) : null}

        {adminMode && allowLoadMore && adminHasMore ? (
          <div className="mt-6 flex justify-center">
            <Button
              variant="secondary"
              size="sm"
              disabled={loadingMore}
              className="rounded-lg px-5 py-2 text-[13px]"
              leadingIcon={loadingMore ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              onClick={() => void handleLoadMore()}
            >
              {loadingMore ? '加载中...' : '加载更多'}
            </Button>
          </div>
        ) : null}
      </PageContent>

      <SkillStoreDetailSheet
        skill={selectedSkill}
        actionLoading={selectedSkill ? installingSlug === selectedSkill.slug : false}
        installFailed={selectedSkill ? installErrorSlugs.includes(selectedSkill.slug) : false}
        onInstall={handleInstall}
        onStartConversation={handleStartConversation}
        onClose={() => setSelectedSkill(null)}
      />
      <SkillStoreAdminSheet
        skill={selectedAdminSkill}
        saving={adminSaving}
        deleting={adminDeleting}
        error={adminError}
        onClose={() => {
          setSelectedAdminSkill(null);
          setAdminError(null);
        }}
        onSave={handleAdminSave}
        onDelete={handleAdminDelete}
      />
      <SkillStoreImportSheet
        open={importSheetOpen}
        githubUrl={githubImportUrl}
        githubLoading={githubImportLoading}
        localLoading={localImportLoading}
        error={importError}
        onGithubUrlChange={setGithubImportUrl}
        onImportGithub={() => void handleGithubImport()}
        onImportLocal={() => void handleLocalImport()}
        onClose={() => {
          if (githubImportLoading || localImportLoading) {
            return;
          }
          setImportSheetOpen(false);
          setImportError(null);
        }}
      />
      <ExtensionInstallConfigModal
        open={setupModalOpen}
        title={setupSkill ? `${setupMode === 'install' ? '安装' : '配置'} ${setupSkill.name}` : '安装配置'}
        description={
          setupLoading
            ? '正在读取已保存配置…'
            : setupSkill?.setupSchema
              ? '这个技能依赖外部配置或 API Key。补齐后再安装，后续升级会沿用这份配置。'
              : undefined
        }
        schema={setupSkill?.setupSchema || null}
        initialConfig={setupInitialConfig}
        saving={setupLoading}
        submitLabel={setupMode === 'install' ? '保存并安装' : '保存配置'}
        onClose={() => {
          if (setupLoading) return;
          setSetupModalOpen(false);
          setSetupSkill(null);
          setSetupInitialConfig(null);
        }}
        onSubmit={handleSetupSubmit}
      />
    </PageSurface>
  );
}
