import { useCallback, useEffect, useMemo, useState } from 'react';
import type { IClawClient } from '@iclaw/sdk';
import { AlertCircle, LoaderCircle, Search, Sparkles } from 'lucide-react';

import type { AppUserAvatarSource } from '@/app/lib/user-avatar';
import { Chip } from '@/app/components/ui/Chip';
import {
  isLobsterStoreAgent,
  readCachedLobsterAgents,
  type LobsterAgent,
  type LobsterStoreCategory,
  type LobsterStoreTab,
  installLobsterAgent,
  loadLobsterAgents,
  uninstallLobsterAgent,
} from '@/app/lib/lobster-store';
import { PageContent, PageSurface } from '@/app/components/ui/PageLayout';
import { PageHeader } from '@/app/components/ui/PageLayout';
import { LobsterAgentCard } from './LobsterAgentCard';
import { LobsterAgentDetailDialog } from './LobsterAgentDetailDialog';
import { LobsterStoreTabs } from './LobsterStoreTabs';
import { MyLobsterView } from './MyLobsterView';

function matchesLobsterSearch(agent: LobsterAgent, query: string): boolean {
  if (!query) {
    return true;
  }

  const haystack = [
    agent.name,
    agent.description,
    agent.categoryLabel,
    agent.divisionLabel || '',
    ...agent.tags,
    ...agent.capabilities,
    ...agent.use_cases,
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(query);
}

export function LobsterStoreView({
  title,
  client,
  accessToken,
  authenticated,
  currentUser,
  onStartConversation,
  onRequestAuth,
}: {
  title: string;
  client: IClawClient;
  accessToken: string | null;
  authenticated: boolean;
  currentUser: AppUserAvatarSource;
  onStartConversation: (agent: LobsterAgent) => void;
  onRequestAuth: (mode?: 'login' | 'register', postAuthView?: 'account' | null) => void;
}) {
  const [activeTab, setActiveTab] = useState<LobsterStoreTab>('shop');
  const [agents, setAgents] = useState<LobsterAgent[]>(() =>
    (readCachedLobsterAgents() || []).filter((agent) => isLobsterStoreAgent(agent)),
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailSlug, setDetailSlug] = useState<string | null>(null);
  const [installBusySlug, setInstallBusySlug] = useState<string | null>(null);
  const [removeBusySlug, setRemoveBusySlug] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'featured' | LobsterStoreCategory>('all');
  const [activeDivision, setActiveDivision] = useState<'all' | string>('all');
  const [query, setQuery] = useState('');

  const refresh = useCallback(async () => {
    setLoading(agents.length === 0);
    setRefreshing(agents.length > 0);
    setError(null);
    try {
      const nextAgents = await loadLobsterAgents({ client, accessToken });
      setAgents(nextAgents.filter((agent) => isLobsterStoreAgent(agent)));
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : '加载龙虾商店失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken, agents.length, client]);

  useEffect(() => {
    const cachedAgents = (readCachedLobsterAgents() || []).filter((agent) => isLobsterStoreAgent(agent));
    if (cachedAgents.length > 0) {
      setAgents(cachedAgents);
      setLoading(false);
      setRefreshing(true);
    } else {
      setLoading(true);
      setRefreshing(false);
    }
    void refresh();
  }, [refresh]);

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.slug === detailSlug) || null,
    [agents, detailSlug],
  );
  const normalizedQuery = query.trim().toLowerCase();
  const installedAgents = useMemo(
    () => agents.filter((agent) => agent.installed && matchesLobsterSearch(agent, normalizedQuery)),
    [agents, normalizedQuery],
  );
  const categoryScopedAgents = useMemo(() => {
    if (activeFilter === 'all') {
      return agents;
    }
    if (activeFilter === 'featured') {
      return agents.filter((agent) => agent.featured);
    }
    return agents.filter((agent) => agent.category === activeFilter);
  }, [activeFilter, agents]);
  const divisionOptions = useMemo(() => {
    const groups = new Map<string, {label: string; count: number}>();

    for (const agent of categoryScopedAgents) {
      if (!agent.divisionSlug || !agent.divisionLabel) {
        continue;
      }
      const current = groups.get(agent.divisionSlug);
      if (current) {
        current.count += 1;
      } else {
        groups.set(agent.divisionSlug, {
          label: agent.divisionLabel,
          count: 1,
        });
      }
    }

    return [...groups.entries()]
      .map(([id, meta]) => ({id, label: meta.label, count: meta.count}))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, 'zh-CN'));
  }, [categoryScopedAgents]);
  const divisionScopedAgents = useMemo(() => {
    if (activeDivision === 'all') {
      return categoryScopedAgents;
    }
    return categoryScopedAgents.filter((agent) => agent.divisionSlug === activeDivision);
  }, [activeDivision, categoryScopedAgents]);
  const filteredAgents = useMemo(
    () => divisionScopedAgents.filter((agent) => matchesLobsterSearch(agent, normalizedQuery)),
    [divisionScopedAgents, normalizedQuery],
  );
  const featuredAgents = useMemo(() => filteredAgents.filter((agent) => agent.featured), [filteredAgents]);
  const shelfAgents = useMemo(
    () => (activeFilter === 'all' ? filteredAgents.filter((agent) => !agent.featured) : filteredAgents),
    [activeFilter, filteredAgents],
  );
  const groupedShelfAgents = useMemo(() => {
    if (activeDivision !== 'all') {
      return [];
    }

    const groups = new Map<string, {id: string; label: string; agents: LobsterAgent[]}>();
    for (const agent of shelfAgents) {
      const label = agent.divisionLabel || agent.categoryLabel;
      const id = agent.divisionSlug || agent.category;
      const current = groups.get(id);
      if (current) {
        current.agents.push(agent);
      } else {
        groups.set(id, {
          id,
          label,
          agents: [agent],
        });
      }
    }

    return [...groups.values()].sort((left, right) =>
      right.agents.length - left.agents.length || left.label.localeCompare(right.label, 'zh-CN'),
    );
  }, [activeDivision, shelfAgents]);

  useEffect(() => {
    if (activeDivision === 'all') {
      return;
    }
    if (!divisionOptions.some((division) => division.id === activeDivision)) {
      setActiveDivision('all');
    }
  }, [activeDivision, divisionOptions]);

  const filters: Array<{
    id: 'all' | 'featured' | LobsterStoreCategory;
    label: string;
    count: number;
    featured?: boolean;
  }> = useMemo(
    () => [
      { id: 'all', label: '全部', count: agents.length },
      { id: 'featured', label: '官方精选', count: agents.filter((agent) => agent.featured).length, featured: true },
      { id: 'finance', label: '金融研究', count: agents.filter((agent) => agent.category === 'finance').length },
      { id: 'content', label: '内容与品牌', count: agents.filter((agent) => agent.category === 'content').length },
      { id: 'productivity', label: '协同管理', count: agents.filter((agent) => agent.category === 'productivity').length },
      { id: 'commerce', label: '商业增长', count: agents.filter((agent) => agent.category === 'commerce').length },
      { id: 'general', label: '专业助手', count: agents.filter((agent) => agent.category === 'general').length },
    ],
    [agents],
  );

  const requireAuthBeforeInstall = () => {
    onRequestAuth('login');
  };

  const handleInstall = async (agent: LobsterAgent) => {
    if (!accessToken || !authenticated) {
      requireAuthBeforeInstall();
      return;
    }

    setInstallBusySlug(agent.slug);
    setError(null);
    try {
      await installLobsterAgent({ client, accessToken, slug: agent.slug });
      await refresh();
    } catch (installError) {
      setError(installError instanceof Error ? installError.message : '添加失败');
    } finally {
      setInstallBusySlug(null);
    }
  };

  const handleRemove = async (agent: LobsterAgent) => {
    if (!accessToken || !authenticated) {
      requireAuthBeforeInstall();
      return;
    }

    setRemoveBusySlug(agent.slug);
    setError(null);
    try {
      await uninstallLobsterAgent({ client, accessToken, slug: agent.slug });
      await refresh();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : '移除失败');
    } finally {
      setRemoveBusySlug(null);
    }
  };

  return (
    <PageSurface as="div" className="bg-[var(--lobster-page-bg)]">
      <PageContent className="max-w-none px-5 py-5 lg:px-6 2xl:px-8">
        <PageHeader
          className="gap-2.5"
          title={title}
          description={`你的专属 AI 助手库。精选 Agent 一键装配，即刻开工。${currentUser ? ' 已登录后可将预设助手加入“我的龙虾”。' : ''}`}
          contentClassName="space-y-1"
          titleClassName="mt-0 text-[24px] font-semibold tracking-[-0.045em] text-[var(--lobster-text-primary)]"
          descriptionClassName="mt-0 text-[12px] leading-5 text-[var(--lobster-text-secondary)]"
          actions={
            <label className="relative block w-full min-w-[260px] max-w-[360px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--lobster-text-muted)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索助手、能力、场景、专业分组..."
                className="h-10 w-full rounded-[12px] border border-[var(--lobster-border)] bg-[var(--lobster-card-elevated)] pl-10 pr-4 text-[13px] text-[var(--lobster-text-primary)] outline-none transition placeholder:text-[var(--lobster-text-muted)] focus:border-[var(--lobster-gold-border-strong)] focus:ring-2 focus:ring-[rgba(168,140,93,0.14)]"
              />
            </label>
          }
        />

        <div className="mt-3">
          <LobsterStoreTabs
            storeLabel={title}
            activeTab={activeTab}
            installedCount={installedAgents.length}
            onChange={setActiveTab}
          />
        </div>

        {error ? (
          <div className="mt-4 flex items-start gap-3 rounded-[18px] border border-[var(--lobster-danger-border)] bg-[var(--lobster-danger-soft)] px-4 py-3 text-[13px] leading-6 text-[var(--lobster-danger-text)]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {refreshing ? (
          <div className="mt-4 flex items-center gap-2 rounded-[16px] border border-[var(--lobster-border)] bg-[var(--lobster-card-elevated)] px-4 py-3 text-[13px] text-[var(--lobster-text-secondary)] shadow-[0_10px_24px_rgba(18,15,11,0.04)]">
            <LoaderCircle className="h-4 w-4 animate-spin text-[var(--lobster-gold-strong)]" />
            <span>正在更新助手库...</span>
            <div className="ml-auto h-1.5 w-24 overflow-hidden rounded-full bg-[var(--lobster-muted-bg)]">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-[var(--lobster-gold-strong)]" />
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-[22px] border border-[var(--lobster-border)] bg-[var(--lobster-card-bg)] px-4 py-4">
              <div className="flex flex-col gap-3">
                <div className="h-4 w-28 animate-pulse rounded-full bg-[var(--lobster-muted-bg)]" />
                <div className="h-3 w-56 animate-pulse rounded-full bg-[var(--lobster-muted-bg)]/80" />
                <div className="flex flex-wrap gap-2 pt-2">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-8 w-24 animate-pulse rounded-full border border-[var(--lobster-border)] bg-[var(--lobster-card-elevated)]"
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-[24px] border border-[var(--lobster-border)] bg-[var(--lobster-card-bg)] p-5 shadow-[0_10px_24px_rgba(18,15,11,0.04)]"
                >
                  <div className="flex items-start gap-4">
                    <div className="h-16 w-16 animate-pulse rounded-full bg-[var(--lobster-muted-bg)]" />
                    <div className="min-w-0 flex-1 space-y-2 pt-1">
                      <div className="h-4 w-28 animate-pulse rounded-full bg-[var(--lobster-muted-bg)]" />
                      <div className="h-3 w-20 animate-pulse rounded-full bg-[var(--lobster-muted-bg)]/80" />
                    </div>
                  </div>
                  <div className="mt-5 space-y-2">
                    <div className="h-3 w-full animate-pulse rounded-full bg-[var(--lobster-muted-bg)]/80" />
                    <div className="h-3 w-11/12 animate-pulse rounded-full bg-[var(--lobster-muted-bg)]/70" />
                    <div className="h-3 w-2/3 animate-pulse rounded-full bg-[var(--lobster-muted-bg)]/60" />
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {Array.from({ length: 3 }).map((__, chipIndex) => (
                      <div
                        key={chipIndex}
                        className="h-7 w-16 animate-pulse rounded-full bg-[var(--lobster-muted-bg)]/70"
                      />
                    ))}
                  </div>
                  <div className="mt-6 h-10 w-full animate-pulse rounded-[14px] bg-[var(--lobster-muted-bg)]" />
                </div>
              ))}
            </div>
          </div>
        ) : activeTab === 'shop' ? (
          <div className="mt-4">
            <div className="rounded-[22px] border border-[var(--lobster-border)] bg-[var(--lobster-card-bg)] px-4 py-3.5">
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[14px] font-medium text-[var(--lobster-text-primary)]">精选助手库</div>
                    <div className="mt-1 text-[12px] leading-5 text-[var(--lobster-text-secondary)]">
                      按职能筛选，像浏览商店货架一样挑选合适助手。
                    </div>
                  </div>
                  <div className="text-[12px] text-[var(--lobster-text-muted)]">当前展示 {filteredAgents.length} 个助手</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {filters.map((filter) => (
                    <Chip
                      key={filter.id}
                      clickable
                      tone={activeFilter === filter.id ? 'accent' : 'outline'}
                      leadingIcon={filter.featured ? <Sparkles className="h-3 w-3" /> : undefined}
                      className="gap-1.5 px-3 py-1.5 text-[12px] font-medium shadow-none"
                      onClick={() => setActiveFilter(filter.id)}
                    >
                      <span>{filter.label}</span>
                      <span className="text-[11px] opacity-75">{filter.count}</span>
                    </Chip>
                  ))}
                </div>
                {divisionOptions.length > 0 ? (
                  <div className="flex flex-wrap gap-2 border-t border-[var(--lobster-border)] pt-3">
                    <Chip
                      clickable
                      tone={activeDivision === 'all' ? 'accent' : 'outline'}
                      className="gap-1.5 px-3 py-1.5 text-[12px] font-medium shadow-none"
                      onClick={() => setActiveDivision('all')}
                    >
                      <span>全部专业分组</span>
                      <span className="text-[11px] opacity-75">{categoryScopedAgents.length}</span>
                    </Chip>
                    {divisionOptions.map((division) => (
                      <Chip
                        key={division.id}
                        clickable
                        tone={activeDivision === division.id ? 'accent' : 'outline'}
                        className="gap-1.5 px-3 py-1.5 text-[12px] font-medium shadow-none"
                        onClick={() => setActiveDivision(division.id)}
                      >
                        <span>{division.label}</span>
                        <span className="text-[11px] opacity-75">{division.count}</span>
                      </Chip>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {activeFilter === 'all' && featuredAgents.length > 0 ? (
              <section className="mt-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[16px] font-semibold text-[var(--lobster-text-primary)]">官方精选</div>
                    <div className="mt-1 text-[12px] leading-5 text-[var(--lobster-text-secondary)]">
                      优先推荐的预设助手，适合直接安装上手。
                    </div>
                  </div>
                  <Chip tone="accent" leadingIcon={<Sparkles className="h-3 w-3" />} className="px-2.5 py-1 text-[11px]">
                    {featuredAgents.length} 个精选
                  </Chip>
                </div>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
                  {featuredAgents.map((agent) => (
                    <LobsterAgentCard
                      key={`featured-${agent.slug}`}
                      agent={agent}
                      installBusy={installBusySlug === agent.slug}
                      onOpenDetail={(nextAgent) => setDetailSlug(nextAgent.slug)}
                      onInstall={handleInstall}
                      onStartConversation={onStartConversation}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {shelfAgents.length > 0 ? (
              <section className="mt-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-[16px] font-semibold text-[var(--lobster-text-primary)]">
                    {activeFilter === 'featured'
                      ? '官方精选'
                      : activeFilter === 'all'
                        ? '全部助手'
                        : filters.find((filter) => filter.id === activeFilter)?.label || '助手列表'}
                  </div>
                  <div className="text-[12px] text-[var(--lobster-text-muted)]">{shelfAgents.length} 个结果</div>
                </div>
                {activeDivision === 'all' ? (
                  <div className="space-y-6">
                    {groupedShelfAgents.map((group) => (
                      <section key={group.id}>
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-[var(--lobster-gold)]" />
                            <div className="text-[15px] font-semibold text-[var(--lobster-text-primary)]">
                              {group.label}
                            </div>
                          </div>
                          <div className="text-[12px] text-[var(--lobster-text-muted)]">{group.agents.length} 个</div>
                        </div>
                        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
                          {group.agents.map((agent) => (
                            <LobsterAgentCard
                              key={agent.slug}
                              agent={agent}
                              installBusy={installBusySlug === agent.slug}
                              onOpenDetail={(nextAgent) => setDetailSlug(nextAgent.slug)}
                              onInstall={handleInstall}
                              onStartConversation={onStartConversation}
                            />
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
                    {shelfAgents.map((agent) => (
                      <LobsterAgentCard
                        key={agent.slug}
                        agent={agent}
                        installBusy={installBusySlug === agent.slug}
                        onOpenDetail={(nextAgent) => setDetailSlug(nextAgent.slug)}
                        onInstall={handleInstall}
                        onStartConversation={onStartConversation}
                      />
                    ))}
                  </div>
                )}
              </section>
            ) : (
              <div className="mt-4 flex min-h-[220px] items-center justify-center rounded-[24px] border border-dashed border-[var(--lobster-border)] bg-[var(--lobster-card-bg)] px-6 text-center">
                <div>
                  <div className="text-[16px] font-medium text-[var(--lobster-text-primary)]">当前筛选下暂无助手</div>
                  <div className="mt-2 text-[13px] leading-6 text-[var(--lobster-text-secondary)]">
                    可以调整搜索词、专业分组或分类后再试。
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4">
            <MyLobsterView
              agents={installedAgents}
              removeBusySlug={removeBusySlug}
              onOpenDetail={(nextAgent) => setDetailSlug(nextAgent.slug)}
              onStartConversation={onStartConversation}
              onRemove={handleRemove}
            />
          </div>
        )}
      </PageContent>

      <LobsterAgentDetailDialog
        agent={selectedAgent}
        open={Boolean(selectedAgent)}
        installBusy={selectedAgent ? installBusySlug === selectedAgent.slug : false}
        onOpenChange={(open) => {
          if (!open) {
            setDetailSlug(null);
          }
        }}
        onInstall={handleInstall}
        onStartConversation={onStartConversation}
      />
    </PageSurface>
  );
}
