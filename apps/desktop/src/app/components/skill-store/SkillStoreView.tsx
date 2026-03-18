import { useEffect, useMemo, useState } from 'react';
import type { IClawClient } from '@iclaw/sdk';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Package,
  PencilLine,
  RefreshCw,
  Search,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import {
  type AdminSkillStoreItem,
  type SkillStoreCategoryId,
  type SkillStoreItem,
  deleteAdminSkillStoreEntry,
  importSkillFromGithub,
  importSkillFromLocalDirectory,
  installSkillFromStore,
  loadAdminSkillStoreCatalog,
  loadSkillStoreCatalog,
  saveAdminSkillStoreEntry,
  subscribeSkillStoreEvents,
} from '@/app/lib/skill-store';
import { Button } from '@/app/components/ui/Button';
import { FilterPill } from '@/app/components/ui/FilterPill';
import { MetricCard } from '@/app/components/ui/MetricCard';
import { PressableCard } from '@/app/components/ui/PressableCard';
import { SegmentedTabs } from '@/app/components/ui/SegmentedTabs';
import { cn } from '@/app/lib/cn';
import { INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE } from '@/app/lib/ui-interactions';
import { SkillStoreAdminSheet } from './SkillStoreAdminSheet';
import { SkillStoreDetailSheet } from './SkillStoreDetailSheet';
import { SkillStoreImportSheet } from './SkillStoreImportSheet';
import { SkillGlyph, skillTagClassName } from './SkillStoreVisuals';

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

function formatPublishedAt(value: string | null | undefined): string {
  if (!value) return '未发布';
  try {
    return new Date(value).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return value;
  }
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
  onOpenDetail,
  onEdit,
}: {
  skill: SkillStoreItem;
  adminMode: boolean;
  actionLoading: boolean;
  installFailed: boolean;
  onAction: (skill: SkillStoreItem) => void;
  onOpenDetail: (skill: SkillStoreItem) => void;
  onEdit: (skill: SkillStoreItem) => void;
}) {
  const status = resolveDisplayStatus(skill, actionLoading, installFailed);
  const showInstallAction = skill.source !== 'bundled' && !adminMode;
  const actionLabel =
    status === 'failed'
      ? '重试安装'
      : status === 'installed'
        ? '已安装'
        : status === 'installing'
          ? '安装中…'
          : status === 'builtin'
            ? '已内置'
            : '安装';
  const actionVariant = status === 'failed' ? 'danger' : status === 'installed' || status === 'builtin' ? 'secondary' : 'primary';
  const actionDisabled = status === 'installed' || status === 'builtin' || status === 'installing';

  return (
    <PressableCard
      as="article"
      interactive={!adminMode}
      onClick={!adminMode ? () => onOpenDetail(skill) : undefined}
      className={cn(
        'rounded-lg border-[var(--border-default)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-sm)]',
        !adminMode && 'hover:border-[rgba(201,169,97,0.22)] hover:shadow-[var(--shadow-md)]',
      )}
    >
      <div className="mb-3 flex items-start gap-3">
        <SkillGlyph skill={skill} className="h-11 w-11 rounded-[14px]" iconClassName="h-5 w-5" />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-1 text-[15px] font-medium leading-snug text-[var(--text-primary)]">{skill.name}</h3>
          <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">{skill.description}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {skill.tags.slice(0, 3).map((tag) => (
          <span key={tag} className={cn('rounded px-2 py-0.5 text-[11px]', skillTagClassName(tag, { flat: true }))}>
            {tag}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-[var(--border-default)] pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <SourceBadge sourceLabel={adminMode && skill.source === 'bundled' ? '系统预置' : skill.sourceLabel} />
          <SkillStatusBadge status={status} />
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
            className={cn(
              'rounded-md px-4 py-1.5 text-[13px] font-normal shadow-none',
              (status === 'installed' || status === 'builtin') &&
                'border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-muted)]',
            )}
            onClick={(event) => {
              event.stopPropagation();
              if (showInstallAction) {
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

export function SkillStoreView({
  client,
  accessToken,
  authBaseUrl,
  authenticated,
  currentUser,
  onRequestAuth,
}: {
  client: IClawClient;
  accessToken: string | null;
  authBaseUrl: string;
  authenticated: boolean;
  currentUser: {
    role?: 'user' | 'admin' | 'super_admin' | null;
  } | null;
  onRequestAuth: (mode?: 'login' | 'register', nextView?: 'account' | null) => void;
}) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('store');
  const [activeCategory, setActiveCategory] = useState<SkillStoreCategoryId>('all');
  const [activeInstallFilter, setActiveInstallFilter] = useState<SkillInstallFilter>('all');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [skills, setSkills] = useState<SkillStoreItem[]>([]);
  const [adminSkills, setAdminSkills] = useState<AdminSkillStoreItem[]>([]);
  const [loading, setLoading] = useState(true);
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

  const adminRoleKnown = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
  const shouldProbeAdminAccess = Boolean(accessToken) && !adminRoleKnown && currentUser?.role == null;
  const isAdmin = adminRoleKnown || adminCapable;

  const refreshCatalog = async (options?: {preferAdmin?: boolean}) => {
    const preferAdmin = Boolean(options?.preferAdmin);
    const catalog = await loadSkillStoreCatalog({ client, accessToken });
    setSkills(catalog);
    if (selectedSkill) {
      setSelectedSkill(catalog.find((item) => item.slug === selectedSkill.slug) || null);
    }
    let nextAdminCatalog: AdminSkillStoreItem[] = [];
    let nextAdminCapable = adminRoleKnown;
    if (accessToken && (preferAdmin || adminRoleKnown || shouldProbeAdminAccess)) {
      try {
        nextAdminCatalog = await loadAdminSkillStoreCatalog({ client, accessToken });
        nextAdminCapable = true;
        if (selectedAdminSkill) {
          setSelectedAdminSkill(nextAdminCatalog.find((item) => item.slug === selectedAdminSkill.slug) || null);
        }
      } catch {
        nextAdminCapable = false;
      }
    }
    setAdminSkills(nextAdminCatalog);
    setAdminCapable(nextAdminCapable);
    setError(null);
    return { catalog, adminCatalog: nextAdminCatalog };
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const catalogPromise = loadSkillStoreCatalog({ client, accessToken });
        const adminCatalogPromise =
          accessToken && (adminRoleKnown || shouldProbeAdminAccess)
            ? loadAdminSkillStoreCatalog({ client, accessToken })
                .then((items) => ({ items, capable: true }))
                .catch(() => ({ items: [] as AdminSkillStoreItem[], capable: false }))
            : Promise.resolve({ items: [] as AdminSkillStoreItem[], capable: adminRoleKnown });
        const [catalog, adminResult] = await Promise.all([catalogPromise, adminCatalogPromise]);
        if (!cancelled) {
          setSkills(catalog);
          setAdminSkills(adminResult.items);
          setAdminCapable(adminResult.capable);
          setError(null);
        }
      } catch (nextError) {
        if (!cancelled) {
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
  }, [accessToken, adminRoleKnown, client, shouldProbeAdminAccess]);

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

  const handleInstall = async (skill: SkillStoreItem) => {
    if (skill.source !== 'cloud' || skill.installed) {
      return;
    }
    if (!authenticated || !accessToken) {
      onRequestAuth('login');
      return;
    }

    setInstallingSlug(skill.slug);
    setError(null);
    try {
      await installSkillFromStore({ client, accessToken, item: skill });
      setInstallErrorSlugs((current) => current.filter((slug) => slug !== skill.slug));
      await refreshCatalog({ preferAdmin: adminMode });
    } catch (nextError) {
      if (nextError instanceof Error && nextError.message === 'AUTH_REQUIRED') {
        onRequestAuth('login');
      } else {
        setInstallErrorSlugs((current) => (current.includes(skill.slug) ? current : [...current, skill.slug]));
        setError('下载安装失败');
      }
    } finally {
      setInstallingSlug(null);
    }
  };

  const handleAdminSave = async (payload: {
    slug: string;
    name: string;
    description: string;
    market: string | null;
    category: string | null;
    skillType: string | null;
    publisher: string;
    visibility: 'showcase' | 'internal';
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

  const visibleSkills = adminMode ? adminSkills : skills;

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
  }, [activeCategory, activeInstallFilter, activeTab, visibleSkills]);

  useEffect(() => {
    if (activeTags.length === 0) return;
    const nextTags = activeTags.filter((tag) => availableQuickTags.includes(tag));
    if (nextTags.length !== activeTags.length) {
      setActiveTags(nextTags);
    }
  }, [activeTags, availableQuickTags]);

  const filteredSkills = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return visibleSkills.filter((skill) => {
      if (activeTab === 'myskills' && !skill.userInstalled) {
        return false;
      }
      if (!matchesCategory(skill, activeCategory)) {
        return false;
      }
      if (activeTab === 'store' && !matchesInstallFilter(skill, activeInstallFilter)) {
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
    });
  }, [activeCategory, activeInstallFilter, activeTab, activeTags, searchQuery, visibleSkills]);

  const totalCount = skills.length;
  const installedCount = skills.filter((skill) => skill.installed || skill.source === 'bundled').length;
  const builtinCount = skills.filter((skill) => skill.source === 'bundled').length;
  const failedCount = installErrorSlugs.length;

  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-[var(--bg-page)]">
      <div className="mx-auto w-full max-w-[1400px] px-8 py-8">
        <div className="mb-8">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="mb-2 text-[28px] font-medium tracking-tight text-[var(--text-primary)]">技能商店</h1>
              <p className="text-[14px] leading-relaxed text-[var(--text-secondary)]">
                统一查看系统预置能力与云端技能，安装后可自动同步到设备
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" className="rounded-lg px-3.5 py-2 text-[13px]" onClick={handleOpenImport} leadingIcon={<Upload className="h-3.5 w-3.5" />}>
                导入技能
              </Button>
              {isAdmin ? (
                <Button
                  variant={adminMode ? 'primary' : 'secondary'}
                  size="sm"
                  className="rounded-lg px-3.5 py-2 text-[13px]"
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
                className="rounded-lg px-3.5 py-2 text-[13px]"
                onClick={() => {
                  void refreshCatalog({ preferAdmin: adminMode }).catch(() => {
                    setError('下载安装失败');
                  });
                }}
                leadingIcon={<RefreshCw className="h-3.5 w-3.5" />}
              >
                刷新技能
              </Button>
            </div>
          </div>

          <div className="mb-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="搜索技能名称或描述..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] py-3 pl-11 pr-4 text-[14px] text-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[rgba(201,169,97,0.24)] focus:ring-2 dark:bg-[rgba(255,255,255,0.03)]"
                style={{ ['--tw-ring-color' as string]: 'rgba(201,169,97,0.12)' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="技能总数"
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
              label="安装失败"
              value={failedCount}
              icon={<AlertCircle className="h-[18px] w-[18px]" />}
              iconWrapClassName="border-[rgba(239,68,68,0.18)] bg-[rgba(239,68,68,0.10)]"
              iconClassName="text-[rgb(185,28,28)] dark:text-[#fecaca]"
            />
          </div>
        </div>

        <div className="mb-6 space-y-5">
          <div className="flex items-center gap-2 border-b border-[var(--border-default)] pb-4">
            <SegmentedTabs
              items={storeTabs.map((tab) => ({
                id: tab.id,
                label: tab.label,
                badge: tab.id === 'myskills' ? skills.filter((skill) => skill.userInstalled).length : undefined,
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

          <div>
            <div className="mb-2.5 text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)]">分类</div>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <FilterPill key={category.id} active={activeCategory === category.id} onClick={() => setActiveCategory(category.id)}>
                  {category.label}
                </FilterPill>
              ))}
            </div>
          </div>

          {availableQuickTags.length ? (
            <div>
              <div className="mb-2.5 text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)]">标签筛选</div>
              <div className="flex flex-wrap gap-2">
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
                  <FilterPill
                    onClick={() => setActiveTags([])}
                    className="px-3 py-1.5 text-[12px]"
                  >
                    清除
                  </FilterPill>
                ) : null}
              </div>
            </div>
          ) : null}

          <div>
            <div className="mb-2.5 text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)]">安装状态</div>
            <div className="flex flex-wrap gap-2">
              {installFilters.map((filter) => (
                <FilterPill key={filter.id} active={activeInstallFilter === filter.id} onClick={() => setActiveInstallFilter(filter.id)}>
                  {filter.label}
                </FilterPill>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-card)] px-6 py-10 text-[14px] text-[var(--text-secondary)]">
            正在加载技能目录...
          </div>
        ) : error ? (
          <div className="rounded-[18px] border border-[rgba(239,68,68,0.16)] bg-[rgba(239,68,68,0.08)] px-6 py-5 text-sm text-[var(--state-error)]">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-4.5 w-4.5 shrink-0" />
              <div>
                <div className="font-medium">{error === '下载安装失败' ? '下载安装失败' : '技能目录读取失败'}</div>
                <div className="mt-1 text-[13px] leading-6">{error}</div>
              </div>
            </div>
          </div>
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
      </div>

      <SkillStoreDetailSheet
        skill={selectedSkill}
        actionLoading={selectedSkill ? installingSlug === selectedSkill.slug : false}
        installFailed={selectedSkill ? installErrorSlugs.includes(selectedSkill.slug) : false}
        onInstall={handleInstall}
        onClose={() => setSelectedSkill(null)}
        publishedAtFormatter={formatPublishedAt}
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
    </section>
  );
}
