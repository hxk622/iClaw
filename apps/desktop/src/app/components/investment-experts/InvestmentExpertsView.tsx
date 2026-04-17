import { useEffect, useMemo, useState } from 'react';
import type { IClawClient } from '@iclaw/sdk';
import { AlertCircle, Info, LoaderCircle, RefreshCw, Search } from 'lucide-react';

import { Button } from '@/app/components/ui/Button';
import { PageContent, PageHeader, PageSurface } from '@/app/components/ui/PageLayout';
import { SegmentedTabs } from '@/app/components/ui/SegmentedTabs';
import { STORE_SHELF_GRID_CLASS } from '@/app/components/ui/store-shelf';
import { cn } from '@/app/lib/cn';
import {
  loadInvestmentExpertDetail,
  loadInvestmentExperts,
  readCachedInvestmentExperts,
  resolveVisibleInvestmentExpertCategories,
  resolveVisibleInvestmentExpertStyles,
  toInstallableInvestmentExpertAgent,
  type InvestmentExpert,
  type InvestmentExpertFilter,
  type InvestmentExpertStyleFilter,
  type InvestmentExpertTab,
} from '@/app/lib/investment-experts';
import { installLobsterAgent, uninstallLobsterAgent } from '@/app/lib/lobster-store';
import { INTERACTIVE_FOCUS_RING, SPRING_PRESSABLE } from '@/app/lib/ui-interactions';
import { InvestmentExpertCard } from './InvestmentExpertCard';
import { InvestmentExpertDetailDialog } from './InvestmentExpertDetailDialog';
import { MyInvestmentExpertsView } from './MyInvestmentExpertsView';

function matchesQuery(expert: InvestmentExpert, query: string): boolean {
  if (!query) {
    return true;
  }
  const haystack = [
    expert.name,
    expert.subtitle,
    expert.description,
    ...expert.tags,
    ...expert.skills.map((item) => `${item.title} ${item.description}`),
    ...expert.taskExamples,
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(query);
}

export function InvestmentExpertsView({
  title,
  client,
  accessToken,
  authenticated,
  onRequestAuth,
  onStartConversation,
}: {
  title: string;
  client: IClawClient;
  accessToken: string | null;
  authenticated: boolean;
  onRequestAuth: (mode?: 'login' | 'register', postAuthView?: 'account' | null) => void;
  onStartConversation: (expert: InvestmentExpert) => void;
}) {
  const [activeTab, setActiveTab] = useState<InvestmentExpertTab>('all');
  const [activeFilter, setActiveFilter] = useState<InvestmentExpertFilter>('all');
  const [activeStyleFilter, setActiveStyleFilter] = useState<InvestmentExpertStyleFilter>('all');
  const [query, setQuery] = useState('');
  const [experts, setExperts] = useState<InvestmentExpert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailSlug, setDetailSlug] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [installBusySlug, setInstallBusySlug] = useState<string | null>(null);
  const [removeBusySlug, setRemoveBusySlug] = useState<string | null>(null);

  const normalizedQuery = query.trim().toLowerCase();

  const refresh = async (options?: {
    forceRefresh?: boolean;
    background?: boolean;
  }) => {
    const showRefreshing = options?.background ?? experts.length > 0;
    setLoading(!showRefreshing);
    setRefreshing(showRefreshing);
    setError(null);
    try {
      const nextExperts = await loadInvestmentExperts({
        client,
        accessToken,
        forceRefresh: options?.forceRefresh,
      });
      setExperts((current) =>
        nextExperts.map((expert) => {
          const existing = current.find((item) => item.slug === expert.slug);
          return existing?.detailLoaded ? {...expert, ...existing, installed: expert.installed} : expert;
        }),
      );
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : '加载智能投资专家失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const cached = readCachedInvestmentExperts({accessToken});
    if (cached) {
      setExperts(cached);
      setLoading(false);
    }
    void refresh({forceRefresh: !cached, background: Boolean(cached)});
  }, [accessToken, client]);

  const selectedExpert = useMemo(
    () => experts.find((expert) => expert.slug === detailSlug) ?? null,
    [detailSlug, experts],
  );

  const ensureExpertDetail = async (slug: string): Promise<InvestmentExpert> => {
    const existing = experts.find((expert) => expert.slug === slug);
    if (existing?.detailLoaded) {
      return existing;
    }

    setDetailLoading(true);
    try {
      const detail = await loadInvestmentExpertDetail({client, accessToken, slug});
      setExperts((current) =>
        current.map((expert) =>
          expert.slug === slug ? {...detail, installed: expert.installed || detail.installed} : expert,
        ),
      );
      return detail;
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (!detailSlug) {
      return;
    }
    const existing = experts.find((expert) => expert.slug === detailSlug);
    if (existing?.detailLoaded) {
      return;
    }
    void ensureExpertDetail(detailSlug).catch((detailError) => {
      setError(detailError instanceof Error ? detailError.message : '加载专家详情失败');
    });
  }, [detailSlug, experts]);

  const shopExperts = useMemo(() => {
    return experts.filter((expert) => {
      const matchesDomain = activeFilter === 'all' || expert.domain === activeFilter;
      const matchesStyle = activeStyleFilter === 'all' || expert.style === activeStyleFilter;
      return matchesDomain && matchesStyle && matchesQuery(expert, normalizedQuery);
    });
  }, [activeFilter, activeStyleFilter, experts, normalizedQuery]);

  const myExperts = useMemo(() => {
    return experts.filter((expert) => {
      if (!expert.installed) {
        return false;
      }
      const matchesDomain = activeFilter === 'all' || expert.domain === activeFilter;
      const matchesStyle = activeStyleFilter === 'all' || expert.style === activeStyleFilter;
      return matchesDomain && matchesStyle && matchesQuery(expert, normalizedQuery);
    });
  }, [activeFilter, activeStyleFilter, experts, normalizedQuery]);

  const visibleCategories = useMemo(() => resolveVisibleInvestmentExpertCategories(experts), [experts]);
  const styleScopedExperts = useMemo(
    () => experts.filter((expert) => activeFilter === 'all' || expert.domain === activeFilter),
    [activeFilter, experts],
  );
  const visibleStyles = useMemo(() => resolveVisibleInvestmentExpertStyles(styleScopedExperts), [styleScopedExperts]);

  const groupedExperts = useMemo(() => {
    if (activeFilter === 'all') {
      return visibleCategories
        .filter((category) => category.id !== 'all')
        .map((category) => ({
          id: category.id,
          label: category.label,
          color: category.color,
          experts: shopExperts.filter((expert) => expert.domain === category.id),
        }))
        .filter((group) => group.experts.length > 0);
    }

    if (activeStyleFilter === 'all') {
      return visibleStyles
        .filter((style) => style.id !== 'all')
        .map((style) => ({
          id: style.id,
          label: style.label,
          color: style.color,
          experts: shopExperts.filter((expert) => expert.style === style.id),
        }))
        .filter((group) => group.experts.length > 0);
    }

    const selectedStyle = visibleStyles.find((style) => style.id === activeStyleFilter);
    return selectedStyle
      ? [
          {
            id: selectedStyle.id,
            label: selectedStyle.label,
            color: selectedStyle.color,
            experts: shopExperts,
          },
        ].filter((group) => group.experts.length > 0)
      : [];
  }, [activeFilter, activeStyleFilter, shopExperts, visibleCategories, visibleStyles]);

  const installedCount = useMemo(
    () => experts.filter((expert) => expert.installed).length,
    [experts],
  );

  useEffect(() => {
    if (activeFilter === 'all') {
      return;
    }
    if (!visibleCategories.some((category) => category.id === activeFilter)) {
      setActiveFilter('all');
    }
  }, [activeFilter, visibleCategories]);

  useEffect(() => {
    if (activeStyleFilter === 'all') {
      return;
    }
    if (!visibleStyles.some((style) => style.id === activeStyleFilter)) {
      setActiveStyleFilter('all');
    }
  }, [activeStyleFilter, visibleStyles]);

  const handleInstall = async (target: InvestmentExpert) => {
    if (!accessToken || !authenticated) {
      onRequestAuth('login');
      return;
    }

    setInstallBusySlug(target.slug);
    setError(null);
    try {
      const installTarget = target.detailLoaded ? target : await ensureExpertDetail(target.slug);
      await installLobsterAgent({client, accessToken, agent: toInstallableInvestmentExpertAgent(installTarget)});
      await refresh({forceRefresh: true});
    } catch (installError) {
      setError(installError instanceof Error ? installError.message : '安装失败');
    } finally {
      setInstallBusySlug(null);
    }
  };

  const handleRemove = async (target: InvestmentExpert) => {
    if (!accessToken || !authenticated) {
      onRequestAuth('login');
      return;
    }

    setRemoveBusySlug(target.slug);
    setError(null);
    try {
      await uninstallLobsterAgent({client, accessToken, slug: target.slug});
      await refresh({forceRefresh: true});
      setDetailSlug((current) => (current === target.slug ? null : current));
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : '移除失败');
    } finally {
      setRemoveBusySlug(null);
    }
  };

  return (
    <PageSurface as="div" className="bg-[var(--lobster-page-bg)]">
      <PageContent className="max-w-none px-4 py-5 lg:px-5 xl:px-6">
        <PageHeader
          className="gap-3"
          title={title}
          description="AI智能体 · 专业投资研究与资产配置专家团队"
          contentClassName="space-y-1"
          titleClassName="mt-0 text-[28px] font-semibold tracking-[-0.045em] text-[var(--lobster-text-primary)]"
          descriptionClassName="mt-0 text-[15px] leading-7 text-[var(--lobster-text-secondary)]"
          actions={
            <>
              <label className="relative block w-full min-w-[260px] max-w-[320px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--lobster-text-muted)]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索专家、人物、资产类别…"
                  className="h-11 w-full rounded-[12px] border border-[var(--lobster-border)] bg-[var(--lobster-card-elevated)] pl-10 pr-4 text-[14px] text-[var(--lobster-text-primary)] outline-none transition placeholder:text-[var(--lobster-text-muted)] focus:border-[var(--lobster-gold-border-strong)] focus:ring-2 focus:ring-[rgba(168,140,93,0.14)]"
                />
              </label>
              <Button
                variant="secondary"
                size="sm"
                disabled={refreshing}
                leadingIcon={refreshing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                onClick={() => void refresh({forceRefresh: true})}
              >
                {refreshing ? '刷新中…' : '刷新'}
              </Button>
            </>
          }
        />

        {error ? (
          <div className="mt-4 flex flex-col gap-3 rounded-[18px] border border-[var(--lobster-danger-border)] bg-[var(--lobster-danger-soft)] px-4 py-3 text-[14px] leading-7 text-[var(--lobster-danger-text)] sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
            <Button variant="ghost" size="sm" className="self-start" onClick={() => void refresh({forceRefresh: true})}>
              重新加载
            </Button>
          </div>
        ) : null}

        {refreshing ? (
          <div className="mt-4 flex items-center gap-2 rounded-[14px] border border-[var(--lobster-border)] bg-[var(--lobster-card-elevated)] px-4 py-3 text-[13px] text-[var(--lobster-text-secondary)]">
            <LoaderCircle className="h-4 w-4 animate-spin text-[var(--lobster-gold-strong)]" />
            <span>正在刷新专家目录…</span>
          </div>
        ) : null}

        <div className="mt-5">
          <SegmentedTabs
            items={[
              { id: 'all', label: '全部专家', badge: experts.length },
              { id: 'mine', label: '我的专家', badge: installedCount },
            ]}
            activeId={activeTab}
            onChange={setActiveTab}
          />
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
          {visibleCategories.map((category) => {
            const active = activeFilter === category.id;
            return (
              <button
                key={category.id}
                type="button"
                  onClick={() => setActiveFilter(category.id)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-medium transition cursor-pointer',
                  SPRING_PRESSABLE,
                  INTERACTIVE_FOCUS_RING,
                  active
                    ? 'bg-[linear-gradient(180deg,#ccb27b_0%,#b49154_100%)] text-[#120e09] shadow-[0_8px_20px_rgba(168,140,93,0.16)]'
                    : 'bg-[var(--lobster-muted-bg)] text-[var(--lobster-text-primary)] hover:bg-[color:color-mix(in_srgb,var(--lobster-muted-bg)_82%,white)]',
                )}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: active ? 'rgba(18,14,9,0.72)' : category.color }}
                />
                <span>{category.label}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
          {visibleStyles.map((style) => {
            const active = activeStyleFilter === style.id;
            return (
              <button
                key={style.id}
                type="button"
                onClick={() => setActiveStyleFilter(style.id)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-[12px] font-medium transition cursor-pointer',
                  SPRING_PRESSABLE,
                  INTERACTIVE_FOCUS_RING,
                  active
                    ? 'border border-[rgba(168,140,93,0.42)] bg-[rgba(168,140,93,0.16)] text-[var(--lobster-text-primary)]'
                    : 'border border-[var(--lobster-border)] bg-[var(--lobster-card-elevated)] text-[var(--lobster-text-secondary)] hover:bg-[color:color-mix(in_srgb,var(--lobster-card-elevated)_82%,white)]',
                )}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: active ? '#b49154' : style.color }}
                />
                <span>{style.label}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-3.5 flex items-center gap-2.5 rounded-[12px] border border-[var(--lobster-border)] bg-[var(--lobster-muted-bg)] px-3.5 py-2 text-[12px] leading-5 text-[var(--lobster-text-secondary)]">
          <Info className="h-3.5 w-3.5 shrink-0 self-center text-[var(--lobster-text-muted)]" />
          <span className="block flex-1 leading-5">一级看金融大类，二级看风格/方法。每位智能投资专家都是独立AI智能体，可接受指令、自主完成投研任务并输出结构化结果。</span>
        </div>

        {loading ? (
          <div className="mt-7 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-[316px] animate-pulse rounded-[18px] border border-[var(--lobster-border)] bg-[var(--lobster-card-elevated)]"
              />
            ))}
          </div>
        ) : activeTab === 'all' ? (
          <div className="mt-7 space-y-8">
            {groupedExperts.length > 0 ? (
              groupedExperts.map((group) => (
                <section key={group.id}>
                  <div className="mb-4 flex items-center gap-3">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: group.color }}
                    />
                    <h2 className="text-[18px] font-semibold text-[var(--lobster-text-primary)]">
                      {group.label}
                    </h2>
                    <span className="inline-flex items-center rounded-full bg-[var(--lobster-muted-bg)] px-2.5 py-0.5 text-[12px] text-[var(--lobster-text-secondary)]">
                      {group.experts.length}
                    </span>
                  </div>

                  <div className={STORE_SHELF_GRID_CLASS}>
                    {group.experts.map((expert) => (
                      <InvestmentExpertCard
                        key={expert.slug}
                        expert={expert}
                        installBusy={installBusySlug === expert.slug}
                        removeBusy={removeBusySlug === expert.slug}
                        onOpenDetail={(nextExpert) => setDetailSlug(nextExpert.slug)}
                        onInstall={handleInstall}
                        onRemove={handleRemove}
                        onStartConversation={onStartConversation}
                      />
                    ))}
                  </div>
                </section>
              ))
            ) : (
              <div className="flex min-h-[300px] items-center justify-center rounded-[20px] border border-dashed border-[var(--lobster-border)] bg-[var(--lobster-card-elevated)] px-6 text-center">
                <div>
                  <div className="text-[18px] font-semibold text-[var(--lobster-text-primary)]">
                    未找到匹配的专家
                  </div>
                  <div className="mt-2 text-[14px] leading-7 text-[var(--lobster-text-secondary)]">
                    可以切换分类、清空关键词，或换一个更具体的方向试试。
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-7">
            <MyInvestmentExpertsView
              experts={myExperts}
              removeBusySlug={removeBusySlug}
              onOpenDetail={(expert) => setDetailSlug(expert.slug)}
              onInstall={handleInstall}
              onRemove={handleRemove}
              onStartConversation={onStartConversation}
            />
          </div>
        )}
      </PageContent>

      <InvestmentExpertDetailDialog
        expert={selectedExpert}
        open={Boolean(selectedExpert)}
        loading={detailLoading && Boolean(selectedExpert) && !selectedExpert?.detailLoaded}
        installBusy={selectedExpert ? installBusySlug === selectedExpert.slug : false}
        removeBusy={selectedExpert ? removeBusySlug === selectedExpert.slug : false}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setDetailSlug(null);
          }
        }}
        onInstall={handleInstall}
        onRemove={handleRemove}
        onStartConversation={onStartConversation}
      />
    </PageSurface>
  );
}
