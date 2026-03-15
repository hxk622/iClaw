import { useEffect, useMemo, useState } from 'react';
import type { IClawClient } from '@iclaw/sdk';
import {
  AlertCircle,
  Brain,
  Check,
  LayoutGrid,
  Package,
  PencilLine,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  type AdminSkillStoreItem,
  type SkillStoreCategoryId,
  type SkillStoreItem,
  deleteAdminSkillStoreEntry,
  installSkillFromStore,
  loadAdminSkillStoreCatalog,
  loadSkillStoreCatalog,
  saveAdminSkillStoreEntry,
  subscribeSkillStoreEvents,
} from '@/app/lib/skill-store';
import { Button } from '@/app/components/ui/Button';
import { Chip } from '@/app/components/ui/Chip';
import { PressableCard } from '@/app/components/ui/PressableCard';
import { cn } from '@/app/lib/cn';
import { SkillStoreAdminSheet } from './SkillStoreAdminSheet';

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

function matchesCategory(skill: SkillStoreItem, categoryId: SkillStoreCategoryId): boolean {
  if (categoryId === 'all') return true;
  if (categoryId === 'official') return skill.official;
  if (categoryId === 'a-share') return skill.market === 'A股';
  if (categoryId === 'us-stock') return skill.market === '美股';
  return skill.categoryId === categoryId;
}

function SummaryCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-[20px] border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-3 shadow-[var(--shadow-sm)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</div>
          <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-[var(--text-secondary)]">{note}</p>
        </div>
        <div className="shrink-0 text-[24px] font-semibold leading-none text-[var(--text-primary)]">{value}</div>
      </div>
    </div>
  );
}

function SkillCard({
  skill,
  actionLoading = false,
  compactFooter = false,
  adminMode = false,
  onAction,
  onEdit,
}: {
  skill: SkillStoreItem;
  actionLoading?: boolean;
  compactFooter?: boolean;
  adminMode?: boolean;
  onAction?: (skill: SkillStoreItem) => void;
  onEdit?: (skill: SkillStoreItem) => void;
}) {
  const isBundled = skill.source === 'bundled';
  const badgeLabel = isBundled ? '默认已安装' : skill.installed ? '已安装' : '云端技能';
  const buttonLabel = isBundled || skill.installed ? '已安装' : actionLoading ? '安装中…' : '安装';
  const cardActionable =
    !adminMode && Boolean(onAction) && skill.source === 'cloud' && !skill.installed && !actionLoading;
  const adminSkill = adminMode ? (skill as AdminSkillStoreItem) : null;

  return (
    <PressableCard
      as="article"
      interactive={cardActionable}
      onClick={cardActionable ? () => onAction?.(skill) : undefined}
      className={cn('group', !cardActionable && 'cursor-default')}
    >
      <div
        className="absolute inset-x-0 top-0 h-px opacity-70 dark:opacity-100"
        style={{
          background:
            'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(201,169,97,0.35) 48%, rgba(255,255,255,0) 100%)',
        }}
      />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--border-default)] text-[var(--brand-primary)]"
              style={{
                background: 'linear-gradient(135deg, rgba(201,169,97,0.16) 0%, rgba(201,169,97,0.04) 100%)',
              }}
            >
              <Brain className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="line-clamp-2 text-[15px] font-medium leading-6 text-[var(--text-primary)]">
                  {skill.name}
                </h3>
                <Chip tone="success" className="px-2 py-0.5 text-[11px] font-medium">
                  {skill.installed || isBundled ? <Check className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                  {badgeLabel}
                </Chip>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-[var(--text-secondary)]">
                <Chip>{skill.market}</Chip>
                <span>{skill.skillType}</span>
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
                  {skill.sourceLabel}
                </span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {adminMode ? (
              <Button
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit?.(skill);
                }}
                variant="ghost"
                size="sm"
                className="shrink-0"
                leadingIcon={<PencilLine className="h-3.5 w-3.5" />}
              >
                编辑
              </Button>
            ) : null}
            <Button
              disabled={isBundled || skill.installed || actionLoading}
              onClick={(event) => {
                event.stopPropagation();
                onAction?.(skill);
              }}
              variant="secondary"
              size="sm"
              className="shrink-0"
            >
              {buttonLabel}
            </Button>
          </div>
        </div>

        <p className="mt-4 line-clamp-3 text-[14px] leading-6 text-[var(--text-secondary)]">{skill.description}</p>

        {adminSkill ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[12px]">
            <Chip tone={adminSkill.active ? 'success' : 'outline'}>
              {adminSkill.active ? '启用中' : '已停用'}
            </Chip>
            <Chip tone={adminSkill.visibility === 'showcase' ? 'brand' : 'outline'}>
              {adminSkill.visibility === 'showcase' ? '商店展示' : '后台隐藏'}
            </Chip>
            <Chip tone="outline">{adminSkill.source === 'bundled' ? 'bundled' : 'cloud'}</Chip>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[var(--border-default)] px-5 py-4 text-[12px] text-[var(--text-secondary)]">
        <div className="flex flex-wrap items-center gap-2">
          <Chip>{skill.categoryLabel}</Chip>
          {skill.tags.slice(0, compactFooter ? 1 : 2).map((tag) => (
            <Chip key={tag} tone="outline">
              {tag}
            </Chip>
          ))}
        </div>
        <span>{compactFooter ? '已收纳到我的技能' : isBundled ? '系统预置 · 开箱可用' : '云端安装 · 自动恢复'}</span>
      </div>
    </PressableCard>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[32px] border border-dashed border-[var(--border-strong)] bg-[var(--bg-card)] px-8 py-20 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-[var(--bg-hover)] text-[var(--text-muted)]">
        <Search className="h-6 w-6" />
      </div>
      <h3 className="mt-5 text-lg font-medium text-[var(--text-primary)]">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
    </div>
  );
}

export function SkillStoreView({
  client,
  accessToken,
  authenticated,
  currentUser,
  onRequestAuth,
}: {
  client: IClawClient;
  accessToken: string | null;
  authenticated: boolean;
  currentUser: {
    role?: 'user' | 'admin' | 'super_admin' | null;
  } | null;
  onRequestAuth: (mode?: 'login' | 'register', nextView?: 'account' | null) => void;
}) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('store');
  const [activeCategory, setActiveCategory] = useState<SkillStoreCategoryId>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [skills, setSkills] = useState<SkillStoreItem[]>([]);
  const [adminSkills, setAdminSkills] = useState<AdminSkillStoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [installingSlug, setInstallingSlug] = useState<string | null>(null);
  const [adminMode, setAdminMode] = useState(false);
  const [adminCapable, setAdminCapable] = useState(false);
  const [selectedAdminSkill, setSelectedAdminSkill] = useState<AdminSkillStoreItem | null>(null);
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminDeleting, setAdminDeleting] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const adminRoleKnown = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
  const shouldProbeAdminAccess = Boolean(accessToken) && !adminRoleKnown && currentUser?.role == null;
  const isAdmin = adminRoleKnown || adminCapable;

  const refreshCatalog = async (options?: {preferAdmin?: boolean}) => {
    const preferAdmin = Boolean(options?.preferAdmin);
    const catalog = await loadSkillStoreCatalog({ client, accessToken });
    setSkills(catalog);
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
          void refreshCatalog({ preferAdmin: adminMode })
            .catch(() => {});
        },
        (message) => {
          setError(message);
        },
      ),
    [accessToken, adminMode, client, isAdmin, selectedAdminSkill],
  );

  useEffect(() => {
    if (!isAdmin && adminMode) {
      setAdminMode(false);
      setSelectedAdminSkill(null);
      setAdminError(null);
    }
  }, [adminMode, isAdmin]);

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
      await refreshCatalog({ preferAdmin: adminMode });
    } catch (nextError) {
      if (nextError instanceof Error && nextError.message === 'AUTH_REQUIRED') {
        onRequestAuth('login');
      } else {
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

  const visibleSkills = adminMode ? adminSkills : skills;

  const filteredSkills = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return visibleSkills.filter((skill) => {
      if (activeTab === 'myskills' && !skill.userInstalled) {
        return false;
      }
      if (!matchesCategory(skill, activeCategory)) {
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
  }, [activeCategory, activeTab, searchQuery, visibleSkills]);

  const installedCount = useMemo(() => skills.filter((skill) => skill.userInstalled).length, [skills]);
  const researchCount = useMemo(() => visibleSkills.filter((skill) => skill.categoryId === 'research').length, [visibleSkills]);
  const marketCount = useMemo(
    () => visibleSkills.filter((skill) => skill.market === 'A股' || skill.market === '美股').length,
    [visibleSkills],
  );
  const hiddenCount = useMemo(
    () => adminSkills.filter((skill) => skill.visibility !== 'showcase' || !skill.active).length,
    [adminSkills],
  );

  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-[var(--bg-page)]">
      <div className="border-b border-[var(--border-default)] bg-[var(--bg-page)] px-8 pb-6 pt-6">
        <div
          className="rounded-[32px] border border-[var(--border-default)] p-6 shadow-[var(--shadow-sm)]"
          style={{
            background:
              'linear-gradient(135deg, rgba(201,169,97,0.11) 0%, rgba(255,255,255,0) 42%), var(--bg-card)',
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-hover)] px-3 py-1 text-[12px] text-[var(--text-secondary)]">
                <LayoutGrid className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
                Skills / MCP
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-medium text-[var(--brand-primary)]"
                  style={{ background: 'rgba(201,169,97,0.14)' }}
                >
                  MCP 即将推出
                </span>
              </div>
              <h1 className="mt-4 text-[30px] font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                技能商店
              </h1>
              <p className="mt-2 max-w-xl text-[14px] leading-6 text-[var(--text-secondary)]">
                {adminMode
                  ? '当前是超管管理视图。你可以直接编辑技能目录元数据，并立刻同步到 control-plane。'
                  : '统一查看系统预置能力与云端技能。登录后安装过的技能会自动同步到当前设备。'}
              </p>
            </div>

            <div className="flex w-full max-w-[520px] flex-col gap-3 sm:w-auto">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="搜索技能名称、市场或用途"
                  className="w-full rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-page)] py-3 pl-11 pr-4 text-[14px] text-[var(--text-primary)] outline-none transition-all focus:border-[var(--brand-primary)] focus:ring-4"
                  style={{ ['--tw-ring-color' as string]: 'rgba(201,169,97,0.14)' }}
                />
              </label>
              <div className="flex items-center justify-end gap-3">
                {isAdmin ? (
                  <Button
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
                    variant={adminMode ? 'primary' : 'secondary'}
                    size="md"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {adminMode ? '退出超管模式' : '进入超管模式'}
                  </Button>
                ) : null}
                <Button
                  onClick={() => {
                    void refreshCatalog({ preferAdmin: adminMode })
                      .catch(() => {
                        setError('下载安装失败');
                      });
                  }}
                  variant="primary"
                  size="md"
                  >
                  <Package className="h-4 w-4" />
                  刷新技能
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <SummaryCard label="我的技能" value={`${installedCount}`} note="这里只统计你亲手安装到账号里的云端技能，不包含系统预置。" />
            <SummaryCard label="研究分析" value={`${researchCount}`} note="研究、估值、财报、技术面等投研向能力可以统一管理与安装。" />
            <SummaryCard
              label={adminMode ? '待整理' : '市场覆盖'}
              value={`${adminMode ? hiddenCount : marketCount}`}
              note={
                adminMode
                  ? '隐藏或停用的技能也会被纳入超管视图，方便你直接清理和修正。'
                  : 'A股与美股相关技能会优先归类到市场标签中，便于检索。'
              }
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1 rounded-full border border-[var(--border-default)] bg-[var(--bg-card)] p-1">
            {storeTabs.map((tab) => {
              const active = tab.id === activeTab;
              return (
                <Chip
                  key={tab.id}
                  clickable
                  onClick={() => setActiveTab(tab.id)}
                  active={active}
                  className={cn(
                    'px-4 py-2 text-[14px] font-medium',
                    !active && 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                  )}
                >
                  {tab.label}
                  {tab.id === 'myskills' ? (
                    <span className="ml-2 rounded-full px-2 py-0.5 text-[12px]" style={{ background: 'rgba(255,255,255,0.16)' }}>
                      {installedCount}
                    </span>
                  ) : null}
                </Chip>
              );
            })}
          </div>

          <div className="flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2 text-[12px] text-[var(--text-secondary)]">
            <Settings2 className="h-3.5 w-3.5" />
            {adminMode ? '超管目录管理已开启' : 'bundled + cloud 已接入'}
          </div>
        </div>
      </div>

      <div className="flex-1 px-8 py-8">
        {activeTab === 'store' ? (
          <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
            {categories.map((category) => {
              const active = category.id === activeCategory;
              return (
                <Chip
                  key={category.id}
                  clickable
                  onClick={() => setActiveCategory(category.id)}
                  active={active}
                  tone={active ? 'brand' : 'outline'}
                  className={cn(
                    'whitespace-nowrap px-4 py-2 text-[13px] font-medium',
                    !active &&
                      'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
                  )}
                >
                  {category.label}
                </Chip>
              );
            })}
          </div>
        ) : (
          <div className="mb-6 rounded-[26px] border border-[var(--border-default)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-sm)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <Sparkles className="h-4 w-4 text-[var(--brand-primary)]" />
                  我的技能
                </div>
                <h2 className="mt-2 text-xl font-medium text-[var(--text-primary)]">你已经安装的技能</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
                  这里只显示你登录后亲手安装的云端技能。系统预置技能会继续留在技能库里，不会混进这里。
                </p>
              </div>
              <div className="rounded-[22px] bg-[var(--bg-hover)] px-4 py-3 text-right">
                <div className="text-[12px] uppercase tracking-[0.12em] text-[var(--text-muted)]">已收纳技能</div>
                <div className="mt-1 text-[28px] font-semibold text-[var(--text-primary)]">{installedCount}</div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="rounded-[32px] border border-[var(--border-default)] bg-[var(--bg-card)] px-8 py-14 text-sm text-[var(--text-secondary)]">
            正在加载技能目录…
          </div>
        ) : error ? (
          <div
            className="rounded-[32px] px-6 py-5 text-sm text-[var(--state-error)]"
            style={{
              border: '1px solid rgba(239,68,68,0.16)',
              background: 'rgba(239,68,68,0.08)',
            }}
          >
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
            title={searchQuery ? '没有匹配的技能' : '当前分类下暂无技能'}
            description={
              searchQuery
                ? `没有找到和“${searchQuery}”相关的技能，试试更换关键词或切换分类。`
                : '当前视图还没有可展示的技能。'
            }
          />
        ) : (
          <div className="grid gap-5 xl:grid-cols-3 lg:grid-cols-2">
            {filteredSkills.map((skill) => (
              <SkillCard
                key={skill.slug}
                skill={skill}
                compactFooter={activeTab === 'myskills'}
                adminMode={adminMode}
                actionLoading={installingSlug === skill.slug}
                onAction={handleInstall}
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
    </section>
  );
}
